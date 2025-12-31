// src/input/HandInputProvider.jsx
import { useEffect, useRef } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

/**
 * Gesture mapping (optimized, conflict-free)
 * - RIGHT pinch (thumb-index)  : DRAG (node drag)
 * - BOTH pinch                 : ZOOM (distance between pinch points)
 * - LEFT open palm             : PAN  (hand center translation)
 * - RIGHT fist                 : ROTATE (hand center translation -> yaw/pitch)
 *
 * Priority: ZOOM > DRAG > ROTATE > PAN > HOVER
 * - hysteresis + deadzone + cooldown to avoid flicker
 * - during hand mode, GraphCanvas disables OrbitControls to prevent unwanted rotation
 */
export function HandInputProvider({
  targetRef,
  targetElId,
  cameraApiRef, // { zoomBy(delta), panBy(dxNorm, dyNorm), rotateBy(dYaw, dPitch) }
  enabled = true,
  mirror = true, // selfie
  modelPath = "/models/hand_landmarker.task",
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const landmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // pointer (for DRAG)
  const pointerDownRef = useRef(false);
  const pointerId = 1; // stable

  // cursor smoothing
  const smoothX = useRef(0.5);
  const smoothY = useRef(0.5);

  // mode
  const modeRef = useRef("IDLE"); // IDLE | HOVER | DRAG | ZOOM | PAN | ROTATE
  const lastModeChangeMs = useRef(0);

  // DRAG pinch hysteresis
  const pinchOn = 0.04;
  const pinchOff = 0.06;
  const rightPinchedRef = useRef(false);
  const leftPinchedRef = useRef(false);

  // PALM/FIST scoring (normalized by palm size)
  // - openPalmScore: avg tipDist/palmSize
  // - fistScore    : avg tipDist/palmSize (low => fist)
  const openOn = 1.7;
  const openOff = 1.55;
  const fistOn = 1.12;
  const fistOff = 1.25;
  const leftOpenRef = useRef(false);
  const rightFistRef = useRef(false);

  // ZOOM
  const lastZoomDistRef = useRef(null);

  // PAN/ROTATE movement anchors
  const lastLeftCenterRef = useRef(null);
  const lastRightCenterRef = useRef(null);

  // knobs
  const cursorAlpha = 0.28; // 0~1, higher = snappier cursor
  const deadMove = 0.0025; // normalized screen delta deadzone
  const modeCooldownMs = 220; // prevent rapid mode switching
  const zoomSensitivity = 2.2; // zoom speed
  const panSensitivity = 1.15; // pan speed
  const rotSensitivity = 2.4; // rotate speed (yaw/pitch)

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // Provider 활성 기간 동안만 pointerCapture 예외를 흡수(내부(r3f)에서 호출돼도 안전)
    const origRel = Element.prototype.releasePointerCapture;
    const origSet = Element.prototype.setPointerCapture;

    Element.prototype.releasePointerCapture = function (pid) {
      try {
        return origRel.call(this, pid);
      } catch (e) {
        if (e?.name === "NotFoundError") return;
        throw e;
      }
    };
    Element.prototype.setPointerCapture = function (pid) {
      try {
        return origSet.call(this, pid);
      } catch {
        return;
      }
    };

    const getTargetCanvas = () => {
      const root =
        (targetRef && targetRef.current) ||
        (targetElId ? document.getElementById(targetElId) : null);
      if (!root) return null;
      return root.querySelector("canvas") || root;
    };

    const dist2 = (a, b) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.hypot(dx, dy);
    };

    const applyMirrorX = (x) => (mirror ? 1 - x : x);

    const centerOfPalm = (L) => {
      // robust center: average of wrist(0), index_mcp(5), middle_mcp(9), pinky_mcp(17)
      const pts = [L[0], L[5], L[9], L[17]];
      const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      return { x, y };
    };

    const palmSize = (L) => {
      // wrist(0) <-> middle_mcp(9)
      const w = L[0],
        m = L[9];
      return Math.max(1e-6, Math.hypot(w.x - m.x, w.y - m.y));
    };

    const fingerTipScore = (L) => {
      // avg dist(wrist, tips) / palmSize
      const w = L[0];
      const ps = palmSize(L);
      const tips = [8, 12, 16, 20].map((i) => L[i]); // index/middle/ring/pinky tips
      const avg =
        tips.reduce((s, t) => s + Math.hypot(w.x - t.x, w.y - t.y), 0) /
        tips.length;
      return avg / ps;
    };

    const computePinch = (L) => {
      // thumb_tip(4) - index_tip(8)
      const thumb = L[4];
      const index = L[8];
      // mirror x for consistent behavior
      const a = { x: applyMirrorX(thumb.x), y: thumb.y };
      const b = { x: applyMirrorX(index.x), y: index.y };
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const pinchPoint = (L) => {
      const t = L[4];
      const i = L[8];
      const x = (applyMirrorX(t.x) + applyMirrorX(i.x)) * 0.5;
      const y = (t.y + i.y) * 0.5;
      return { x, y };
    };

    const dispatchPointer = (target, type, nx, ny, buttons) => {
      const rect = target.getBoundingClientRect();
      const clientX = rect.left + nx * rect.width;
      const clientY = rect.top + ny * rect.height;

      const ev = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        clientX,
        clientY,
        buttons,
        button: buttons ? 0 : -1,
        pressure: buttons ? 0.5 : 0,
      });

      target.dispatchEvent(ev);
    };

    const pointerMoveDownUp = (target, nx, ny, wantDown) => {
      dispatchPointer(
        target,
        "pointermove",
        nx,
        ny,
        pointerDownRef.current ? 1 : 0
      );

      if (wantDown && !pointerDownRef.current) {
        dispatchPointer(target, "pointerdown", nx, ny, 1);
        pointerDownRef.current = true;
      } else if (!wantDown && pointerDownRef.current) {
        dispatchPointer(target, "pointerup", nx, ny, 0);
        pointerDownRef.current = false;
      }
    };

    const setMode = (m) => {
      const now = performance.now();
      if (m === modeRef.current) return;
      // cooldown to prevent flicker
      if (now - lastModeChangeMs.current < modeCooldownMs) return;

      // leaving modes: cleanup
      if (modeRef.current === "ZOOM") lastZoomDistRef.current = null;
      if (modeRef.current === "PAN") lastLeftCenterRef.current = null;
      if (modeRef.current === "ROTATE") lastRightCenterRef.current = null;

      // if leaving DRAG: ensure pointer up
      if (modeRef.current === "DRAG" && pointerDownRef.current) {
        const target = getTargetCanvas();
        if (target)
          pointerMoveDownUp(target, smoothX.current, smoothY.current, false);
      }

      modeRef.current = m;
      lastModeChangeMs.current = now;
    };

    async function start() {
      // camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (cancelled) return;

      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();

      // tasks-vision init
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      landmarkerRef.current = handLandmarker;

      const loop = () => {
        if (cancelled) return;

        const target = getTargetCanvas();
        const api = cameraApiRef?.current;
        const lm = landmarkerRef.current;
        const video = videoRef.current;

        if (!target || !lm || !video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // avoid duplicate inference on same frame
        const nowT = video.currentTime;
        if (nowT === lastVideoTimeRef.current) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        lastVideoTimeRef.current = nowT;

        const ts = performance.now();
        const result = lm.detectForVideo(video, ts);

        const hands = result?.landmarks || [];
        const handed = result?.handednesses || result?.handedness || []; // defensive

        // if no hands -> cleanup to safe state
        if (!hands.length) {
          setMode("IDLE");
          leftOpenRef.current = false;
          rightFistRef.current = false;
          leftPinchedRef.current = false;
          rightPinchedRef.current = false;

          if (pointerDownRef.current) {
            pointerMoveDownUp(target, smoothX.current, smoothY.current, false);
          }

          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        // assign left/right by handedness if available, else by x position
        let left = null;
        let right = null;

        const pickLabel = (i) => {
          const h = handed[i];
          const cat = h?.[0] || h?.categories?.[0];
          return cat?.categoryName || cat?.displayName || null; // "Left"/"Right"
        };

        for (let i = 0; i < hands.length; i++) {
          const label = pickLabel(i);
          if (label === "Left") left = hands[i];
          else if (label === "Right") right = hands[i];
        }

        if (!left || !right) {
          // fallback: sort by mirrored x center
          const items = hands
            .map((L) => {
              const c = centerOfPalm(L);
              const x = applyMirrorX(c.x);
              return { L, x };
            })
            .sort((a, b) => a.x - b.x);
          if (!left && items[0]) left = items[0].L;
          if (!right && items[items.length - 1])
            right = items[items.length - 1].L;
        }

        // compute gesture metrics
        const haveLeft = !!left;
        const haveRight = !!right;

        // RIGHT cursor = index tip
        if (haveRight) {
          const idx = right[8];
          const nx = applyMirrorX(idx.x);
          const ny = idx.y;

          smoothX.current =
            smoothX.current + (nx - smoothX.current) * cursorAlpha;
          smoothY.current =
            smoothY.current + (ny - smoothY.current) * cursorAlpha;
        }

        // pinch states (hysteresis)
        if (haveRight) {
          const d = computePinch(right);
          if (!rightPinchedRef.current && d < pinchOn)
            rightPinchedRef.current = true;
          else if (rightPinchedRef.current && d > pinchOff)
            rightPinchedRef.current = false;
        } else {
          rightPinchedRef.current = false;
        }

        if (haveLeft) {
          const d = computePinch(left);
          if (!leftPinchedRef.current && d < pinchOn)
            leftPinchedRef.current = true;
          else if (leftPinchedRef.current && d > pinchOff)
            leftPinchedRef.current = false;
        } else {
          leftPinchedRef.current = false;
        }

        // open palm / fist states
        if (haveLeft) {
          const score = fingerTipScore(left); // higher => open
          if (!leftOpenRef.current && score > openOn)
            leftOpenRef.current = true;
          else if (leftOpenRef.current && score < openOff)
            leftOpenRef.current = false;
        } else {
          leftOpenRef.current = false;
        }

        if (haveRight) {
          const score = fingerTipScore(right); // lower => fist
          if (!rightFistRef.current && score < fistOn)
            rightFistRef.current = true;
          else if (rightFistRef.current && score > fistOff)
            rightFistRef.current = false;
        } else {
          rightFistRef.current = false;
        }

        // choose mode by priority
        const bothPinch =
          haveLeft &&
          haveRight &&
          leftPinchedRef.current &&
          rightPinchedRef.current;
        const drag =
          haveRight && rightPinchedRef.current && !leftPinchedRef.current; // right-only pinch
        const rotate = haveRight && rightFistRef.current; // right fist
        const pan =
          haveLeft && leftOpenRef.current && !bothPinch && !drag && !rotate; // left open palm

        if (bothPinch) setMode("ZOOM");
        else if (drag) setMode("DRAG");
        else if (rotate) setMode("ROTATE");
        else if (pan) setMode("PAN");
        else if (haveRight) setMode("HOVER");
        else setMode("IDLE");

        // execute mode actions
        const m = modeRef.current;

        // HOVER: move cursor only (optional: pointermove without down)
        if (m === "HOVER" && haveRight) {
          pointerMoveDownUp(target, smoothX.current, smoothY.current, false);
        }

        // DRAG: pointer down/move/up
        if (m === "DRAG" && haveRight) {
          pointerMoveDownUp(target, smoothX.current, smoothY.current, true);
        } else if (m !== "DRAG" && pointerDownRef.current) {
          // ensure released if mode changed
          pointerMoveDownUp(target, smoothX.current, smoothY.current, false);
        }

        // ZOOM: use distance between left/right pinch points
        if (m === "ZOOM" && bothPinch && api?.zoomBy) {
          const pL = pinchPoint(left);
          const pR = pinchPoint(right);
          const D = Math.hypot(pL.x - pR.x, pL.y - pR.y);

          if (lastZoomDistRef.current == null) {
            lastZoomDistRef.current = D;
          } else {
            const diff = D - lastZoomDistRef.current; // + => hands apart => zoom in
            lastZoomDistRef.current = D;

            // deadzone
            if (Math.abs(diff) > 0.0018) {
              const delta = diff * zoomSensitivity;
              // 규약: +면 줌인, -면 줌아웃
              api.zoomBy(delta);
            }
          }
        }

        // PAN: left palm center translation
        if (m === "PAN" && haveLeft && api?.panBy) {
          const c = centerOfPalm(left);
          const cur = { x: applyMirrorX(c.x), y: c.y };

          if (!lastLeftCenterRef.current) {
            lastLeftCenterRef.current = cur;
          } else {
            const prev = lastLeftCenterRef.current;
            const dx = cur.x - prev.x;
            const dy = cur.y - prev.y;
            lastLeftCenterRef.current = cur;

            if (Math.abs(dx) > deadMove || Math.abs(dy) > deadMove) {
              api.panBy(dx * panSensitivity, dy * panSensitivity);
            }
          }
        }

        // ROTATE: right fist center translation -> yaw/pitch
        if (m === "ROTATE" && haveRight && api?.rotateBy) {
          const c = centerOfPalm(right);
          const cur = { x: applyMirrorX(c.x), y: c.y };

          if (!lastRightCenterRef.current) {
            lastRightCenterRef.current = cur;
          } else {
            const prev = lastRightCenterRef.current;
            const dx = cur.x - prev.x;
            const dy = cur.y - prev.y;
            lastRightCenterRef.current = cur;

            if (Math.abs(dx) > deadMove || Math.abs(dy) > deadMove) {
              // dx => yaw, dy => pitch (screen space)
              const dYaw = -dx * rotSensitivity * 2.0; // yaw sensitivity
              const dPitch = -dy * rotSensitivity * 1.6; // pitch sensitivity
              api.rotateBy(dYaw, dPitch);
            }
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    }

    start().catch((e) => console.error("HandInputProvider init failed:", e));

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      // cleanup
      pointerDownRef.current = false;
      modeRef.current = "IDLE";
      lastZoomDistRef.current = null;
      lastLeftCenterRef.current = null;
      lastRightCenterRef.current = null;

      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      Element.prototype.releasePointerCapture = origRel;
      Element.prototype.setPointerCapture = origSet;
    };
  }, [enabled, mirror, modelPath, targetElId, targetRef, cameraApiRef]);

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        width: 160,
        height: 120,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.25)",
        opacity: 0.7,
        zIndex: 50,
        transform: "scaleX(-1)",
      }}
    />
  );
}
