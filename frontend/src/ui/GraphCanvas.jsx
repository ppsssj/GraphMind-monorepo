// src/ui/GraphCanvas.jsx
import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Text,
  useCursor,
} from "@react-three/drei";
import * as THREE from "three";

import { HandInputProvider } from "../input/HandInputProvider";
import { useInputPrefs } from "../store/useInputPrefs";
import OrientationOverlay from "./OrientationOverlay";

function CameraControlBridge({
  cameraApiRef,
  target = new THREE.Vector3(0, 0, 0),
}) {
  const { camera, viewport } = useThree();
  const targetRef = useRef(target.clone());
  const sphericalRef = useRef(new THREE.Spherical());

  useEffect(() => {
    const pos = camera.position.clone().sub(targetRef.current);
    sphericalRef.current.setFromVector3(pos);
  }, [camera]);

  useEffect(() => {
    if (!cameraApiRef) return;

    cameraApiRef.current = {
      zoomBy: (delta) => {
        const next = camera.zoom * (1 + delta);
        camera.zoom = Math.max(20, Math.min(260, next));
        camera.updateProjectionMatrix();
      },

      panBy: (dxNorm, dyNorm) => {
        const dxWorld = -dxNorm * viewport.width;
        const dyWorld = dyNorm * viewport.height;

        camera.position.x += dxWorld;
        camera.position.y += dyWorld;

        targetRef.current.x += dxWorld;
        targetRef.current.y += dyWorld;
      },

      rotateBy: (dYaw, dPitch) => {
        const s = sphericalRef.current;

        s.theta += dYaw;
        s.phi = Math.max(0.15, Math.min(Math.PI - 0.15, s.phi + dPitch));

        const v = new THREE.Vector3()
          .setFromSpherical(s)
          .add(targetRef.current);
        camera.position.copy(v);
        camera.lookAt(targetRef.current);
      },
    };

    return () => {
      cameraApiRef.current = null;
    };
  }, [camera, viewport, cameraApiRef]);

  return null;
}

function AutoFocus2D({ markers, controlsRef, enabled = true }) {
  const { camera, viewport } = useThree();
  const lastSigRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const ms = Array.isArray(markers) ? markers : [];
    if (ms.length === 0) return;

    // Prefer AI focus nonce if present; otherwise fall back to a lightweight signature.
    const sig = ms
      .map((m, i) => String(m?._focusNonce ?? m?.id ?? `${i}:${m?.x},${m?.y}`))
      .join("|");

    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const m of ms) {
      const x = Number(m?.x);
      const y = Number(m?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const newTarget = new THREE.Vector3(cx, cy, 0);

    const oldTarget =
      controlsRef?.current?.target?.clone?.() ?? new THREE.Vector3(0, 0, 0);
    const offset = camera.position.clone().sub(oldTarget);

    // Move camera keeping the current view direction/offset, and retarget controls.
    camera.position.copy(newTarget.clone().add(offset));
    camera.lookAt(newTarget);
    if (controlsRef?.current?.target)
      controlsRef.current.target.copy(newTarget);

    // Soft zoom: only a tiny zoom-in (or zoom-out if needed) to ensure visibility.
    // Clamp prevents over-zoom on single-point markers.
    const padding = 1.35;
    const spanX = Math.max(0.25, (maxX - minX) * padding);
    const spanY = Math.max(0.25, (maxY - minY) * padding);

    const fitFactor = Math.min(viewport.width / spanX, viewport.height / spanY);
    const currentZoom = Number(camera.zoom) || 60;

    let nextZoom = currentZoom * fitFactor;

    const MAX_ZOOM_IN_FACTOR = 1.03; // <= 3% zoom-in
    const MAX_ZOOM_OUT_FACTOR = 0.8; // allow zoom-out if marker is out of view

    nextZoom = Math.min(currentZoom * MAX_ZOOM_IN_FACTOR, nextZoom);
    nextZoom = Math.max(currentZoom * MAX_ZOOM_OUT_FACTOR, nextZoom);

    // Keep existing zoom clamps consistent with CameraControlBridge.zoomBy
    camera.zoom = Math.max(20, Math.min(260, nextZoom));
    camera.updateProjectionMatrix();
    controlsRef?.current?.update?.();
  }, [markers, enabled, camera, viewport.width, viewport.height, controlsRef]);

  return null;
}

function buildLineSegments(segments) {
  // segments: [[x1,y1,z1,x2,y2,z2], ...]
  const arr = new Float32Array(segments.length * 6);
  for (let i = 0; i < segments.length; i++) {
    const o = i * 6;
    const s = segments[i];
    arr[o + 0] = s[0];
    arr[o + 1] = s[1];
    arr[o + 2] = s[2];
    arr[o + 3] = s[3];
    arr[o + 4] = s[4];
    arr[o + 5] = s[5];
  }
  return arr;
}

function snapUp(v, step) {
  if (!Number.isFinite(v) || !Number.isFinite(step) || step <= 0) return v;
  return Math.ceil(v / step) * step;
}

function GridAndAxes({
  xmin = -8,
  xmax = 8,
  ymin = -8,
  ymax = 8,

  // ✅ gridStep = major step
  gridStep = 1,
  // ✅ minorDiv = major 1칸 분할 수
  minorDiv = 4,

  gridMode = "major", // off | box | major | full
}) {
  const x0 = xmin;
  const x1 = xmax;
  const y0 = ymin;
  const y1 = ymax;

  const zGrid = 0.0;
  const zAxis = 0.01; // z-fighting 방지
  const axisThickness = 0.06; // surface/curve 쪽 느낌에 맞게 적당히 얇게

  const majorStep = Math.max(0.1, Number(gridStep) || 1);
  const div = Math.max(1, Math.floor(Number(minorDiv) || 4));
  const minorStep = majorStep / div;

  const { minorPositions, majorPositions, boxPositions } = useMemo(() => {
    const boxSegs = [
      [x0, y0, zGrid, x1, y0, zGrid],
      [x1, y0, zGrid, x1, y1, zGrid],
      [x1, y1, zGrid, x0, y1, zGrid],
      [x0, y1, zGrid, x0, y0, zGrid],
    ];

    const majorSegs = [];
    const mxStart = snapUp(x0, majorStep);
    const myStart = snapUp(y0, majorStep);

    for (let x = mxStart; x <= x1 + 1e-9; x += majorStep) {
      majorSegs.push([x, y0, zGrid, x, y1, zGrid]);
    }
    for (let y = myStart; y <= y1 + 1e-9; y += majorStep) {
      majorSegs.push([x0, y, zGrid, x1, y, zGrid]);
    }

    const minorSegs = [];
    const sxStart = snapUp(x0, minorStep);
    const syStart = snapUp(y0, minorStep);

    for (let x = sxStart; x <= x1 + 1e-9; x += minorStep) {
      minorSegs.push([x, y0, zGrid, x, y1, zGrid]);
    }
    for (let y = syStart; y <= y1 + 1e-9; y += minorStep) {
      minorSegs.push([x0, y, zGrid, x1, y, zGrid]);
    }

    return {
      minorPositions: buildLineSegments(minorSegs),
      majorPositions: buildLineSegments(majorSegs),
      boxPositions: buildLineSegments(boxSegs),
    };
  }, [x0, x1, y0, y1, majorStep, minorStep]);

  // === 축을 "중심(cx,cy)"가 아니라 "원점(0,0)"에 고정 ===
  const showXAxis = y0 <= 0 && y1 >= 0; // y=0 이 bounds 안에 있을 때만
  const showYAxis = x0 <= 0 && x1 >= 0; // x=0 이 bounds 안에 있을 때만

  const sizeX = Math.max(1e-6, Math.abs(x1 - x0));
  const sizeY = Math.max(1e-6, Math.abs(y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  return (
    <group>
      {gridMode === "box" && (
        <lineSegments key={`box-${x0}-${x1}-${y0}-${y1}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={boxPositions}
              count={boxPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#7f8a9a" transparent opacity={0.55} />
        </lineSegments>
      )}

      {gridMode === "major" && (
        <lineSegments key={`major-${x0}-${x1}-${y0}-${y1}-${majorStep}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={majorPositions}
              count={majorPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#7f8a9a" transparent opacity={0.45} />
        </lineSegments>
      )}

      {gridMode === "full" && (
        <group key={`full-${x0}-${x1}-${y0}-${y1}-${majorStep}-${minorStep}`}>
          <lineSegments key={`minor-${x0}-${x1}-${y0}-${y1}-${minorStep}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={minorPositions}
                count={minorPositions.length / 3}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#7f8a9a" transparent opacity={0.18} />
          </lineSegments>

          <lineSegments key={`major2-${x0}-${x1}-${y0}-${y1}-${majorStep}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={majorPositions}
                count={majorPositions.length / 3}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#7f8a9a" transparent opacity={0.45} />
          </lineSegments>
        </group>
      )}

      {/* === axes (일반적인 축 느낌: 그리드보다 조금 더 밝은 회색) === */}
      {showXAxis && (
        <mesh position={[cx, 0, zAxis]}>
          <boxGeometry args={[sizeX, axisThickness, axisThickness]} />
          <meshStandardMaterial color="#cfd6e6" />
        </mesh>
      )}

      {showYAxis && (
        <mesh position={[0, cy, zAxis]}>
          <boxGeometry args={[axisThickness, sizeY, axisThickness]} />
          <meshStandardMaterial color="#cfd6e6" />
        </mesh>
      )}
    </group>
  );
}

function Curve({ fn, xmin, xmax, color = "white" }) {
  const positions = useMemo(() => {
    const steps = 220;
    const dx = (xmax - xmin) / steps;
    const arr = new Float32Array((steps + 1) * 3);

    for (let i = 0; i <= steps; i++) {
      const x = xmin + dx * i;
      const yRaw = fn ? fn(x) : NaN;
      const y = Number.isFinite(yRaw) ? yRaw : 0;
      const o = i * 3;
      arr[o + 0] = x;
      arr[o + 1] = y;
      arr[o + 2] = 0;
    }
    return arr;
  }, [fn, xmin, xmax]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

function EditablePoint({
  index,
  position,
  onChange,
  onCommit,
  setControlsBusy,
}) {
  const tcRef = useRef();

  useEffect(() => {
    if (tcRef.current?.object) {
      tcRef.current.object.position.set(position.x, position.y, 0);
    }
  }, [position.x, position.y]);

  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const handleChange = () => {
      const obj = tc.object;
      if (!obj) return;
      onChange(index, { x: obj.position.x, y: obj.position.y });
    };

    const onDraggingChanged = (e) => {
      const dragging = !!e.value;
      setControlsBusy(dragging);
      if (!dragging) onCommit?.(index);
    };

    tc.addEventListener("change", handleChange);
    tc.addEventListener("dragging-changed", onDraggingChanged);

    return () => {
      tc.removeEventListener("change", handleChange);
      tc.removeEventListener("dragging-changed", onDraggingChanged);
    };
  }, [index, onChange, onCommit, setControlsBusy]);

  return (
    <group>
      <TransformControls ref={tcRef} mode="translate" showX showY showZ={false}>
        <mesh>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshStandardMaterial color="#ffc107" />
        </mesh>
      </TransformControls>

      <group position={[position.x + 0.08, position.y + 0.08, 0]}>
        <Text
          fontSize={0.16}
          anchorX="left"
          anchorY="bottom"
          outlineWidth={0.004}
          outlineColor="black"
        >
          {`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`}
        </Text>
      </group>
    </group>
  );
}

function DraggablePoint({
  index,
  position,
  xmin,
  xmax,
  ymin,
  ymax,
  onChange,
  onCommit,
  setControlsBusy,

  // ✅ selection/group move + delete
  points,
  selectedKeys,
  setSelectedKeys,
  pointKey,
  onPointRemove,
  suppressAddRef,
}) {
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    []
  );
  const hit = useRef(new THREE.Vector3());
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useRef(new THREE.Vector2());

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  useCursor(hovered);

  const dragRef = useRef({
    group: false,
    startHit: null,
    startPos: null,
    selIdxs: null,
  });

  const { camera, gl } = useThree();

  const commit = () => onCommit?.(index);

  const toggleSelect = (multi) => {
    setSelectedKeys?.((prev) => {
      const next = new Set(prev instanceof Set ? prev : []);
      if (!multi) {
        next.clear();
        next.add(pointKey);
        return next;
      }
      if (next.has(pointKey)) next.delete(pointKey);
      else next.add(pointKey);
      return next;
    });
  };

  const onPointerDown = (e) => {
    e.stopPropagation();
    try {
      suppressAddRef.current = true;
      requestAnimationFrame(() => (suppressAddRef.current = false));
    } catch {}

    const multi = !!(e.ctrlKey || e.metaKey);
    toggleSelect(multi);

    setDragging(true);
    setControlsBusy?.(true);

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}

    // plane hit at z=0
    const rect = gl.domElement.getBoundingClientRect();
    ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    ray.setFromCamera(ndc.current, camera);
    const ok = ray.ray.intersectPlane(plane, hit.current);
    if (!ok) return;

    // group drag if this point is selected and selection has >=2
    const sel = selectedKeys instanceof Set ? selectedKeys : new Set();
    const group = sel.has(pointKey) && sel.size >= 2;

    if (group && Array.isArray(points)) {
      const keyOf = (p, i) => p?.id ?? i;
      const selIdxs = [];
      for (let i = 0; i < points.length; i++) {
        const k = keyOf(points[i], i);
        if (sel.has(k)) selIdxs.push(i);
      }
      dragRef.current = {
        group: true,
        selIdxs,
        startHit: hit.current.clone(),
        startPos: points.map((p) => ({ x: p.x, y: p.y })),
      };
    } else {
      dragRef.current = {
        group: false,
        startHit: hit.current.clone(),
        startPos: { x: position.x, y: position.y },
      };
    }
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();

    const rect = gl.domElement.getBoundingClientRect();
    ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    ray.setFromCamera(ndc.current, camera);
    const ok = ray.ray.intersectPlane(plane, hit.current);
    if (!ok) return;

    const startHit = dragRef.current.startHit;
    if (!startHit) return;
    const dx = hit.current.x - startHit.x;
    const dy = hit.current.y - startHit.y;

    const clampXY = (x, y) => {
      let xx = x;
      let yy = y;
      if (Number.isFinite(xmin) && Number.isFinite(xmax))
        xx = Math.max(xmin, Math.min(xmax, xx));
      if (Number.isFinite(ymin) && Number.isFinite(ymax))
        yy = Math.max(ymin, Math.min(ymax, yy));
      return { x: xx, y: yy };
    };

    if (dragRef.current.group && Array.isArray(points)) {
      const selIdxs = dragRef.current.selIdxs || [];
      const startPos = dragRef.current.startPos || [];
      for (const i of selIdxs) {
        const s0 = startPos[i];
        if (!s0) continue;
        const next = clampXY(s0.x + dx, s0.y + dy);
        onChange?.(i, next);
      }
      return;
    }

    const s = dragRef.current.startPos;
    if (!s) return;
    const next = clampXY(s.x + dx, s.y + dy);
    onChange?.(index, next);
  };

  const endDrag = (e) => {
    e.stopPropagation();
    setDragging(false);
    setControlsBusy?.(false);

    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch {}

    // group commit: commit all selected indices, else single
    if (dragRef.current.group && Array.isArray(dragRef.current.selIdxs)) {
      for (const i of dragRef.current.selIdxs) onCommit?.(i);
    } else {
      commit();
    }
  };

  const onContextMenu = (e) => {
    e.stopPropagation();
    e?.nativeEvent?.preventDefault?.();
    e?.preventDefault?.();
    try {
      suppressAddRef.current = true;
      requestAnimationFrame(() => (suppressAddRef.current = false));
    } catch {}

    // ✅ 우클릭 삭제: "요청 전달"을 확실히 보장
    if (typeof onPointRemove === "function") {
      onPointRemove(index, pointKey);
    } else {
      console.warn(
        "[GraphCanvas] onPointRemove is not provided; cannot remove point."
      );
    }
  };

  return (
    <group>
      <mesh
        position={[position.x, position.y, 0.03]}
        onContextMenu={onContextMenu}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshStandardMaterial
          color={
            dragging
              ? "#ff9800"
              : selectedKeys instanceof Set && selectedKeys.has(pointKey)
              ? "#38bdf8"
              : hovered
              ? "#ffd54f"
              : "#ffc107"
          }
          emissive={dragging ? "#ff9800" : "#000000"}
          emissiveIntensity={dragging ? 0.25 : 0}
        />
      </mesh>

      <group position={[position.x + 0.08, position.y + 0.08, 0]}>
        <Text
          fontSize={0.16}
          anchorX="left"
          anchorY="bottom"
          outlineWidth={0.004}
          outlineColor="black"
        >
          {`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`}
        </Text>
      </group>
    </group>
  );
}

function AltInteractionPlane({
  enabled,
  xmin,
  xmax,
  points,
  markers,
  fn,
  typedFn,
  showFit,
  showTyped,
  onPointAdd,
  onPointCommit,
  selectedKeys,
  setSelectedKeys,
  setMarquee,
  suppressAddRef,
}) {
  const { camera, gl } = useThree();
  const planeRef = useRef();
  const dragRef = useRef(null);

  // click -> world point comes from e.point (plane intersection)
  const pickSnapY = (x) => {
    // ✅ Alt+클릭: equation(typedFn) 곡선에 스냅 (표시 여부와 무관하게 typedFn 우선)
    if ((showTyped || !showTyped) && typeof typedFn === "function") {
      try {
        const y = Number(typedFn(x));
        if (Number.isFinite(y)) return y;
      } catch {}
    }
    // typedFn이 없으면 fitted 곡선으로 폴백
    if ((showFit || !showFit) && typeof fn === "function") {
      try {
        const y = Number(fn(x));
        if (Number.isFinite(y)) return y;
      } catch {}
    }
    return null;
  };

  const computeBoxKeys = (x0, y0, x1, y1) => {
    const rect = gl.domElement.getBoundingClientRect();
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    const ps = Array.isArray(points) ? points : [];
    const out = [];
    const v = new THREE.Vector3();

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      v.set(Number(p?.x) || 0, Number(p?.y) || 0, 0).project(camera);
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        out.push(p?.id ?? i);
      }
    }
    return out;
  };

  const doAdd = (x, yGuess) => {
    if (suppressAddRef?.current) return;

    // ✅ x는 domain으로 클램프
    let xx = x;
    if (Number.isFinite(xmin) && Number.isFinite(xmax)) {
      const lo = Math.min(xmin, xmax);
      const hi = Math.max(xmin, xmax);
      xx = Math.max(lo, Math.min(hi, xx));
    }

    const ySnap = pickSnapY(xx);
    if (!Number.isFinite(ySnap)) return;

    const pt = { x: xx, y: ySnap };

    if (typeof onPointAdd === "function") {
      onPointAdd(pt);
      return;
    }
    // fallback: upsert/append if parent supports it
    console.warn(
      "[GraphCanvas] onPointAdd is not provided; cannot add point. Pass onPointAdd from parent."
    );
  };

  const onPointerDown = (e) => {
    if (!enabled) return;
    if (!e.altKey) return;
    if (e.button !== 0) return; // left only
    e.stopPropagation();

    // begin marquee
    const ox = e.nativeEvent.offsetX;
    const oy = e.nativeEvent.offsetY;
    dragRef.current = { x0: ox, y0: oy, x1: ox, y1: oy, moved: false };
    setMarquee?.({ x0: ox, y0: oy, x1: ox, y1: oy, active: true });

    try {
      gl.domElement.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (!e.altKey) return;
    e.stopPropagation();

    const ox = e.nativeEvent.offsetX;
    const oy = e.nativeEvent.offsetY;
    d.x1 = ox;
    d.y1 = oy;

    const dx = ox - d.x0;
    const dy = oy - d.y0;
    if (!d.moved && dx * dx + dy * dy > 16) d.moved = true;

    setMarquee?.({ x0: d.x0, y0: d.y0, x1: ox, y1: oy, active: true });
  };

  const finalize = (e) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    e.stopPropagation();

    setMarquee?.(null);
    try {
      gl.domElement.releasePointerCapture(e.pointerId);
    } catch {}

    const multi = !!(e.ctrlKey || e.metaKey);

    if (!d.moved) {
      // Alt-click: add point snapped to curve near click
      const world = e.point; // on plane z=0
      doAdd(world.x, world.y);
      return;
    }

    // Alt-drag: box select points
    const keys = computeBoxKeys(d.x0, d.y0, d.x1, d.y1);
    setSelectedKeys?.((prev) => {
      const next = new Set(prev instanceof Set ? prev : []);
      if (!multi) next.clear();
      for (const k of keys) next.add(k);
      return next;
    });
  };

  const onContextMenu = (e) => {
    // prevent browser menu while alt selecting
    if (!enabled) return;
    e.stopPropagation();
    e?.nativeEvent?.preventDefault?.();
  };

  return (
    <mesh
      ref={planeRef}
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finalize}
      onPointerCancel={finalize}
      onContextMenu={onContextMenu}
    >
      <planeGeometry args={[5000, 5000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

export default function GraphCanvas({
  points,
  onPointChange,
  onPointCommit,
  // ✅ optional: add/remove points from canvas interactions
  onPointAdd,
  onPointRemove,
  xmin,
  xmax,
  ymin,
  ymax,

  gridStep,
  setGridStep,

  // ✅ 추가: 격자 모드(외부에서 제어 가능)
  gridMode,
  setGridMode,
  minorDiv,
  setMinorDiv,

  fn,
  typedFn,
  curveKey,
  markers = [],

  ruleMode = "free",
  setRuleMode,
  rulePolyDegree = 3,
  setRulePolyDegree,
  ruleError,
  tightGridToCurves = true,
  showControls = true,
}) {
  const wrapperRef = useRef(null);
  const cameraApiRef = useRef(null);
  const controlsRef = useRef();
  const [controlsBusy, setControlsBusy] = useState(false);
  const [viewMode, setViewMode] = useState("both"); // typed | fit | both
  const [editMode, setEditMode] = useState("drag"); // arrows | drag

  // ✅ selection set for box-select/group-move
  const keyOfPoint = (p, i) => p?.id ?? i;
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [marquee, setMarquee] = useState(null); // {x0,y0,x1,y1,active}
  const [altDown, setAltDown] = useState(false);
  const suppressAddRef = useRef(false);

  // ✅ deep-ish signatures to force grid recompute even if parent mutates arrays in-place
  const pointsSig = Array.isArray(points)
    ? points
        .map((p, i) => {
          const id = p?.id ?? i;
          const x = Number(p?.x ?? 0);
          const y = Number(p?.y ?? 0);
          return `${id}:${x.toFixed(4)},${y.toFixed(4)}`;
        })
        .join("|")
    : "";

  const markersSig = Array.isArray(markers)
    ? markers
        .map((m, i) => {
          const id = m?.id ?? i;
          const x = Number(m?.x ?? 0);
          const y = Number(m?.y ?? 0);
          return `${id}:${x.toFixed(4)},${y.toFixed(4)}`;
        })
        .join("|")
    : "";

  // Alt key tracking (for OrbitControls disable + UI)
  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === "Alt") setAltDown(true);
    };
    const onKeyUp = (ev) => {
      if (ev.key === "Alt") setAltDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handEnabled = useInputPrefs((s) => s.handControlEnabled);

  const [openPanel, setOpenPanel] = useState(null);

  useEffect(() => {
    if (handEnabled) setOpenPanel((p) => p ?? "gestures");
    else setOpenPanel((p) => (p === "gestures" ? null : p));
  }, [handEnabled]);

  // ✅ keep selection keys valid when points change
  useEffect(() => {
    const ps = Array.isArray(points) ? points : [];
    const valid = new Set(ps.map((p, i) => keyOfPoint(p, i)));
    setSelectedKeys((prev) => {
      if (!(prev instanceof Set) || prev.size === 0) {
        return ps.length ? new Set([keyOfPoint(ps[0], 0)]) : new Set();
      }
      const next = new Set();
      for (const k of prev) if (valid.has(k)) next.add(k);
      if (next.size === 0 && ps.length) next.add(keyOfPoint(ps[0], 0));
      return next;
    });
  }, [points]);

  // grid step (기존)
  const [gridStepLocal, setGridStepLocal] = useState(gridStep ?? 1);
  useEffect(() => {
    if (gridStep !== undefined) setGridStepLocal(gridStep);
  }, [gridStep]);

  const gridStepEff = Math.max(0.1, Number(gridStep ?? gridStepLocal) || 1);

  const setGridStepEff = (v) => {
    const n = Math.max(0.1, Number(v) || 1);
    if (typeof setGridStep === "function") setGridStep(n);
    else setGridStepLocal(n);
  };
  // ✅ minorDiv (Curve3D 스타일: major 1칸을 몇 등분할지)
  const [minorDivLocal, setMinorDivLocal] = useState(minorDiv ?? 4);

  useEffect(() => {
    if (minorDiv !== undefined) setMinorDivLocal(minorDiv);
  }, [minorDiv]);

  const minorDivEff = Math.max(
    1,
    Math.floor(Number(minorDiv ?? minorDivLocal) || 4)
  );

  const setMinorDivEff = (v) => {
    const n = Math.max(1, Math.floor(Number(v) || 4));
    if (typeof setMinorDiv === "function") setMinorDiv(n);
    else setMinorDivLocal(n);
  };

  // ✅ grid mode (추가)
  const [gridModeLocal, setGridModeLocal] = useState(gridMode ?? "major");
  useEffect(() => {
    if (gridMode !== undefined) setGridModeLocal(gridMode);
  }, [gridMode]);

  const gridModeEff = (gridMode ?? gridModeLocal) || "major";

  const setGridModeEff = (v) => {
    const next = String(v || "major");
    if (typeof setGridMode === "function") setGridMode(next);
    else setGridModeLocal(next);
  };

  const showTyped = typedFn && (viewMode === "typed" || viewMode === "both");
  const showFit = fn && (viewMode === "fit" || viewMode === "both");

  // 드래그/편집 제한 범위(기존 동작 유지)
  const dragYMin = Number.isFinite(ymin) ? ymin : xmin;
  const dragYMax = Number.isFinite(ymax) ? ymax : xmax;

  // ✅ 요청 반영: "그래프가 렌더링되는 구간"에 대해서만 그리드 출력
  // - 표시 중인 곡선(fn/typedFn)을 샘플링해서 y-bounds를 계산
  // - 비정상적으로 큰 값(비연속/점근선 등)은 MAX_ABS로 컷
  // - 5%~95% 분위수로 안정적인 범위를 잡고 약간의 padding만 부여
  // ✅ 요청 반영: "그래프가 렌더링되는 구간"에 대해서만 그리드 출력 +
  // ✅ 추가: grid bounds padding(여유) + step 단위로 바깥쪽 스냅
  const gridBounds = useMemo(() => {
    const x0 = Number(xmin);
    const x1 = Number(xmax);

    if (!Number.isFinite(x0) || !Number.isFinite(x1) || x0 === x1) {
      return { xmin: x0, xmax: x1, ymin: dragYMin, ymax: dragYMax };
    }

    // grid를 곡선에 타이트하게 붙이지 않는 옵션(기존 유지)
    if (!tightGridToCurves) {
      return { xmin: x0, xmax: x1, ymin: dragYMin, ymax: dragYMax };
    }

    const ys = [];
    const N = 420;
    const dx = (x1 - x0) / N;
    const MAX_ABS = 1e5;

    const sampleFn = (f) => {
      if (typeof f !== "function") return;
      for (let i = 0; i <= N; i++) {
        const x = x0 + dx * i;
        let y;
        try {
          y = f(x);
        } catch {
          continue;
        }
        const n = Number(y);
        if (!Number.isFinite(n)) continue;
        if (Math.abs(n) > MAX_ABS) continue;
        ys.push(n);
      }
    };

    // 현재 표시 중인 곡선만 bounds 계산에 사용
    if (showFit) sampleFn(fn);
    if (showTyped) sampleFn(typedFn);

    // 곡선이 없거나 유효 샘플이 부족하면 기존 범위 사용
    if (ys.length < 8) {
      return { xmin: x0, xmax: x1, ymin: dragYMin, ymax: dragYMax };
    }

    ys.sort((a, b) => a - b);

    // ✅ 전체 곡선/포인트가 그리드 밖으로 나가지 않도록 min/max 기반으로 bounds 산정
    let yLo = ys[0];
    let yHi = ys[ys.length - 1];

    // points / markers도 포함해서 bounds 확장
    if (Array.isArray(points)) {
      for (const p of points) {
        const yy = Number(p?.y);
        if (Number.isFinite(yy)) {
          yLo = Math.min(yLo, yy);
          yHi = Math.max(yHi, yy);
        }
      }
    }
    if (Array.isArray(markers)) {
      for (const m of markers) {
        const yy = Number(m?.y);
        if (Number.isFinite(yy)) {
          yLo = Math.min(yLo, yy);
          yHi = Math.max(yHi, yy);
        }
      }
    }

    const step = Math.max(0.1, Number(gridStepEff) || 1);

    // 거의 평평한 경우: 최소 높이 확보
    let span = yHi - yLo;
    if (!Number.isFinite(span) || Math.abs(span) < step * 0.5) {
      const mid = (yLo + yHi) / 2;
      yLo = mid - step * 2;
      yHi = mid + step * 2;
      span = yHi - yLo;
    }

    // 1차 패딩(기존): 곡선 주변 여유
    const corePad = Math.max(step * 0.5, span * 0.08);
    let xMinGrid = x0;
    let xMaxGrid = x1;
    let yMinGrid = yLo - corePad;
    let yMaxGrid = yHi + corePad;

    // ✅ 추가 패딩(요청): "그래프와 격자가 딱 맞는 느낌" 제거용
    // - 비율 패딩 + 최소 패딩(스텝 2칸) 같이 적용
    const PAD_RATIO = 0.12;
    const PAD_MIN = step * 2;

    const xSpan = Math.max(1e-6, xMaxGrid - xMinGrid);
    const ySpan = Math.max(1e-6, yMaxGrid - yMinGrid);

    const padX = Math.max(PAD_MIN, xSpan * PAD_RATIO);
    const padY = Math.max(PAD_MIN, ySpan * PAD_RATIO);

    xMinGrid -= padX;
    xMaxGrid += padX;
    yMinGrid -= padY;
    yMaxGrid += padY;

    // ✅ 그리드 라인이 "딱 떨어지게" step 단위로 바깥쪽 스냅
    const snapOut = (v, s, dir) => {
      if (!Number.isFinite(v) || !Number.isFinite(s) || s <= 0) return v;
      return dir < 0 ? Math.floor(v / s) * s : Math.ceil(v / s) * s;
    };

    xMinGrid = snapOut(xMinGrid, step, -1);
    xMaxGrid = snapOut(xMaxGrid, step, +1);
    yMinGrid = snapOut(yMinGrid, step, -1);
    yMaxGrid = snapOut(yMaxGrid, step, +1);

    return { xmin: xMinGrid, xmax: xMaxGrid, ymin: yMinGrid, ymax: yMaxGrid };
  }, [
    xmin,
    xmax,
    dragYMin,
    dragYMax,
    tightGridToCurves,
    showFit,
    showTyped,
    fn,
    typedFn,
    gridStepEff,
    points,
    pointsSig,
    markers,
    markersSig,
    viewMode,
    curveKey,
  ]);

  const commit = (idx) => onPointCommit?.(idx);

  const handlePointAdd = (pt) => {
    if (typeof onPointAdd === "function") {
      onPointAdd(pt);
      return;
    }
    // fallback: append/upsert via onPointChange if parent supports it
    const arr = Array.isArray(points) ? points : [];
    const idx = arr.length;
    onPointChange?.(idx, pt);
    onPointCommit?.(idx);
  };

  const handlePointRemove = (index, key) => {
    // ✅ 삭제 요청이 왔는지 로그로 남겨서 '전달 여부'를 확실히 확인 가능
    try {
      console.info("[GraphCanvas] remove point requested", { index, key });
    } catch {}

    if (typeof onPointRemove === "function") {
      try {
        // (index, key) 형태를 받는 구현 대응
        if (onPointRemove.length >= 2) {
          onPointRemove(index, key);
          return;
        }

        // (id) 형태를 받는 구현 대응: key가 index와 다르면 key를 우선 전달
        const hasKey = key !== undefined && key !== null;
        if (hasKey && key !== index) {
          onPointRemove(key);
          return;
        }

        // 기본: (index)
        onPointRemove(index);
        return;
      } catch (err) {
        console.warn("[GraphCanvas] onPointRemove threw an error:", err);
        return;
      }
    }

    console.warn(
      "[GraphCanvas] onPointRemove is not provided; cannot remove point."
    );
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {handEnabled && (
        <HandInputProvider
          targetRef={wrapperRef}
          cameraApiRef={cameraApiRef}
          enabled={true}
          mirror={true}
          modelPath="/models/hand_landmarker.task"
        />
      )}

      <Canvas
        orthographic
        camera={{ zoom: 60, position: [0, 0, 10] }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0)
        }
      >
        <CameraControlBridge cameraApiRef={cameraApiRef} />

        {/* ✅ Auto focus on newly created markers (AI results) */}
        <AutoFocus2D
          markers={markers}
          controlsRef={controlsRef}
          enabled={true}
        />

        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 6]} intensity={0.9} />

        <AltInteractionPlane
          enabled={true}
          xmin={xmin}
          xmax={xmax}
          points={points}
          markers={markers}
          fn={fn}
          typedFn={typedFn}
          showFit={showFit}
          showTyped={showTyped}
          onPointAdd={handlePointAdd}
          onPointCommit={onPointCommit}
          selectedKeys={selectedKeys}
          setSelectedKeys={setSelectedKeys}
          setMarquee={setMarquee}
          suppressAddRef={suppressAddRef}
        />

        {/* ✅ gridMode 적용 */}
        <GridAndAxes
          xmin={gridBounds.xmin}
          xmax={gridBounds.xmax}
          ymin={gridBounds.ymin}
          ymax={gridBounds.ymax}
          gridStep={gridStepEff}
          minorDiv={minorDivEff}
          gridMode={gridModeEff}
        />

        {showFit && (
          <Curve
            key={curveKey + "|fit"}
            fn={fn}
            xmin={xmin}
            xmax={xmax}
            color="#64b5f6"
          />
        )}
        {showTyped && (
          <Curve
            key={curveKey + "|typed"}
            fn={typedFn}
            xmin={xmin}
            xmax={xmax}
            color="#ff5252"
          />
        )}

        {Array.isArray(markers) &&
          markers.map((m) => (
            <group key={m.id ?? `${m.kind}-${m.x}-${m.y}`}>
              <mesh position={[m.x, m.y, 0.03]}>
                <sphereGeometry args={[0.12, 24, 24]} />
                <meshStandardMaterial
                  color="#00e676"
                  emissive="#00e676"
                  emissiveIntensity={0.25}
                />
              </mesh>
              {m.label && (
                <group position={[m.x + 0.16, m.y + 0.16, 0.03]}>
                  <Text
                    fontSize={0.18}
                    anchorX="left"
                    anchorY="bottom"
                    outlineWidth={0.004}
                    outlineColor="black"
                  >
                    {m.label}
                  </Text>
                </group>
              )}
            </group>
          ))}

        {points.map((p, i) =>
          editMode === "arrows" ? (
            <EditablePoint
              key={"e-" + (p.id ?? i)}
              index={i}
              position={{ x: p.x, y: p.y }}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
              onCommit={commit}
            />
          ) : (
            <DraggablePoint
              key={"d-" + (p.id ?? i)}
              index={i}
              position={{ x: p.x, y: p.y }}
              points={points}
              pointKey={keyOfPoint(p, i)}
              selectedKeys={selectedKeys}
              setSelectedKeys={setSelectedKeys}
              onPointRemove={handlePointRemove}
              suppressAddRef={suppressAddRef}
              xmin={xmin}
              xmax={xmax}
              ymin={dragYMin}
              ymax={dragYMax}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
              onCommit={commit}
            />
          )
        )}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!controlsBusy && !handEnabled && !altDown && !marquee}
        />
        <OrientationOverlay controlsRef={controlsRef} />
      </Canvas>

      {marquee?.active && (
        <div
          style={{
            position: "absolute",
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
            border: "1px dashed rgba(148, 163, 184, 0.95)",
            background: "rgba(56, 189, 248, 0.10)",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 30,
          }}
        />
      )}

      {showControls && (
        <div
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            zIndex: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "flex-start",
            maxWidth: "calc(100% - 16px)",
            boxSizing: "border-box",
            justifyContent: "flex-end",
            pointerEvents: "auto",
          }}
        >
          {(() => {
            const Panel = ({ id, title, children, hidden = false }) => {
              if (hidden) return null;
              const isOpen = openPanel === id;

              return (
                <div
                  style={{
                    background: "rgba(0,0,0,0.28)",
                    color: "#fff",
                    borderRadius: 10,
                    fontSize: 11,
                    overflow: "hidden",
                    minWidth: 180,
                    backdropFilter: "blur(6px)",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <button
                    onClick={() => setOpenPanel((p) => (p === id ? null : id))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}
                    title={isOpen ? "접기" : "펼치기"}
                  >
                    <span>{title}</span>
                    <span style={{ opacity: 0.8 }}>{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        padding: "8px 10px",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {children}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                <Panel id="rule" title="규칙 기반 편집">
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <select
                      value={ruleMode}
                      onChange={(e) => setRuleMode?.(e.target.value)}
                      style={{
                        flex: 1,
                        background: "rgba(10,10,10,0.85)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        padding: "4px 6px",
                        outline: "none",
                        fontSize: 11,
                      }}
                    >
                      <option value="free">자유(수식 고정)</option>
                      <option value="linear">선형: a·x + b</option>
                      <option value="poly">다항식: 차수 고정</option>
                      <option value="sin">사인: A·sin(ωx+φ)+C</option>
                      <option value="cos">코사인: A·cos(ωx+φ)+C</option>
                      <option value="tan">탄젠트: A·tan(ωx+φ)+C</option>
                      <option value="exp">지수: A·exp(kx)+C</option>
                      <option value="log">로그: A·log(kx)+C</option>
                      <option value="power">거듭제곱: A·x^p + C</option>
                    </select>

                    {ruleMode === "poly" && (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={rulePolyDegree}
                        onChange={(e) =>
                          setRulePolyDegree?.(Number(e.target.value))
                        }
                        style={{
                          width: 64,
                          background: "rgba(10,10,10,0.85)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          padding: "4px 6px",
                          outline: "none",
                          fontSize: 11,
                        }}
                        title="다항 차수"
                      />
                    )}
                  </div>

                  <div
                    style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.35 }}
                  >
                    점을 드래그한 뒤 놓으면, 선택한 규칙(함수 family)을 유지한
                    채 파라미터만 갱신됩니다.
                  </div>

                  {ruleError && (
                    <div
                      style={{
                        marginTop: 6,
                        color: "#ffcc80",
                        lineHeight: 1.35,
                      }}
                    >
                      {ruleError}
                    </div>
                  )}
                </Panel>

                <Panel id="view" title="보기">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setViewMode("typed")}
                      style={btnStyle(viewMode === "typed", "#ff5252")}
                    >
                      수식만
                    </button>
                    <button
                      onClick={() => setViewMode("fit")}
                      style={btnStyle(viewMode === "fit", "#64b5f6")}
                    >
                      근사만
                    </button>
                    <button
                      onClick={() => setViewMode("both")}
                      style={btnStyle(viewMode === "both", "#ffffff")}
                    >
                      둘다
                    </button>
                  </div>
                </Panel>

                {/* ✅ 격자: 모드 + 간격 */}
                <Panel id="grid" title="Grid">
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <label style={{ opacity: 0.75, width: 34 }}>Mode</label>
                    <select
                      value={gridModeEff}
                      onChange={(e) => setGridModeEff(e.target.value)}
                      style={{
                        flex: 1,
                        background: "rgba(10,10,10,0.85)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        padding: "4px 6px",
                        outline: "none",
                        fontSize: 11,
                      }}
                    >
                      <option value="off">Off</option>
                      <option value="box">Box</option>
                      <option value="major">Major</option>
                      <option value="full">Full</option>
                    </select>
                  </div>

                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <label style={{ opacity: 0.75, width: 34 }}>Step</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={gridStepEff}
                      onChange={(e) => setGridStepEff(e.target.value)}
                      style={{
                        width: 86,
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.25)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#fff",
                        outline: "none",
                      }}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                      title={
                        gridModeEff === "off" || gridModeEff === "box"
                          ? "현재 모드에서는 Step이 적용되지 않습니다."
                          : "격자 간격"
                      }
                    />
                    <button
                      onClick={() => setGridStepEff(1)}
                      style={btnStyle(false, "#ffffff")}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                    >
                      1
                    </button>
                    <button
                      onClick={() => setGridStepEff(2)}
                      style={btnStyle(false, "#ffffff")}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                    >
                      2
                    </button>
                    <button
                      onClick={() => setGridStepEff(4)}
                      style={btnStyle(false, "#ffffff")}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                    >
                      4
                    </button>
                  </div>
                </Panel>

                <Panel id="edit" title="편집">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setEditMode("arrows")}
                      style={btnStyle(editMode === "arrows", "#ffffff")}
                    >
                      화살표
                    </button>
                    <button
                      onClick={() => setEditMode("drag")}
                      style={btnStyle(editMode === "drag", "#ffffff")}
                    >
                      드래그
                    </button>
                  </div>
                </Panel>

                <Panel id="hand" title="손 입력">
                  <HandToggle />
                  <div
                    style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.35 }}
                  >
                    손 입력을 켜면 “손 제스처” 패널이 자동으로 활성화됩니다.
                  </div>
                </Panel>

                <Panel id="gestures" title="손 제스처" hidden={!handEnabled}>
                  <div style={{ opacity: 0.9, lineHeight: 1.45 }}>
                    • 오른손 핀치: 드래그
                    <br />• 양손 핀치: 줌<br />• 왼손 펼침: 팬<br />• 오른손
                    주먹: 회전
                  </div>
                </Panel>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );

  function btnStyle(active, activeColor) {
    return {
      padding: "4px 6px",
      borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.25)",
      background: active ? activeColor : "transparent",
      color: active ? "#000" : "#fff",
      cursor: "pointer",
    };
  }

  function HandToggle() {
    const enabled = useInputPrefs((s) => s.handControlEnabled);
    const setEnabled = useInputPrefs((s) => s.setHandControlEnabled);

    return (
      <button
        onClick={() => setEnabled(!enabled)}
        style={{
          padding: "6px 8px",
          borderRadius: 6,
          border: enabled
            ? "1px solid #7cf"
            : "1px solid rgba(255,255,255,0.25)",
          background: enabled ? "#7cf" : "transparent",
          color: enabled ? "#000" : "#fff",
          cursor: "pointer",
        }}
        title={enabled ? "손 입력 비활성화" : "손 입력 활성화"}
      >
        {enabled ? "활성" : "비활성"}
      </button>
    );
  }
}
