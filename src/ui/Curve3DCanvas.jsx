import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Text,
  useCursor,
} from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";
import OrientationOverlay from "./OrientationOverlay.jsx";

const math = create(all, {});

// -----------------------------
// math expr -> param fn
// -----------------------------
function normalizeNestedAssign(expr) {
  const s = String(expr ?? "");
  // ((x(t)=BASE) + (REST))  ->  x(t) = ((BASE) + (REST))
  const m = s.match(
    /^\(\(\s*([xyz]\(t\))\s*=\s*([\s\S]*?)\)\s*\+\s*\(([\s\S]+)\)\)\s*$/
  );
  if (!m) return s;
  const lhs = m[1];
  const base = (m[2] ?? "0").trim() || "0";
  const rest = (m[3] ?? "0").trim() || "0";
  return `${lhs} = ((${base}) + (${rest}))`;
}

function makeParamFn(expr, paramName = "t") {
  const normalized = normalizeNestedAssign(expr);
  const rhs = normalized.includes("=")
    ? normalized.split("=").pop()
    : normalized;

  const trimmed = String(rhs ?? "").trim();
  if (!trimmed) return () => 0;

  let compiled;
  try {
    compiled = math.parse(trimmed).compile();
  } catch (e) {
    console.warn("Curve3D: failed to parse expression:", normalized, {
      rhs: trimmed,
      error: e,
    });
    return () => 0;
  }

  return (t) => {
    try {
      const v = compiled.evaluate({
        [paramName]: t,
        t,
        pi: Math.PI,
        e: Math.E,
      });
      const n = typeof v === "number" ? v : Number(v?.valueOf?.());
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };
}

// -----------------------------
// label utils
// -----------------------------
function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
function coordLabel(m) {
  return `(${fmtNum(m?.x)}, ${fmtNum(m?.y)}, ${fmtNum(m?.z)})`;
}

// -----------------------------
// auto-focus (zoom to markers) utils
// - triggers only when markers contain _focusNonce (set by AI commands in Studio)
// -----------------------------
function fitCameraToBox({
  camera,
  controls,
  box,
  padding = 1.35,
  minZoomFactor = 0.85,
  minRadius = 0.75,
}) {
  if (!box) return;

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Use bounding sphere for stable sizing (Box3 size can be ~0 for a single point)
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  let radius = Number(sphere.radius);
  if (!Number.isFinite(radius) || radius < 1e-6) radius = minRadius;

  const fov = THREE.MathUtils.degToRad(camera.fov || 50);
  const desiredDist = (radius / Math.sin(fov / 2)) * padding;

  const curTarget =
    controls?.target && controls.target.clone
      ? controls.target.clone()
      : new THREE.Vector3(0, 0, 0);
  const curDist = camera.position.distanceTo(curTarget);

  // Prevent over-zoom-in: never get closer than a fraction of the current distance.
  const dist = Math.max(desiredDist, curDist * minZoomFactor);

  // Keep current view direction
  const dir = camera.position.clone().sub(curTarget);
  if (dir.lengthSq() < 1e-12) dir.set(1, 1, 1);
  dir.normalize();

  camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
  camera.near = Math.max(0.01, dist / 200);
  camera.far = Math.max(50, dist * 200);
  camera.updateProjectionMatrix?.();

  if (controls) {
    controls.target.copy(center);
    controls.update?.();
  }
}

function AutoFocusOnMarkers3D({ markers, controlsRef }) {
  const { camera } = useThree();
  const lastNonceRef = useRef(null);

  useEffect(() => {
    const ms = Array.isArray(markers) ? markers : [];
    // focus only when Studio tagged markers with _focusNonce
    const nonces = ms
      .map((m) => m?._focusNonce)
      .filter((v) => v !== undefined && v !== null);
    if (!nonces.length) return;

    const nonce = nonces[0]; // all markers in a batch share the same nonce
    if (lastNonceRef.current === nonce) return;
    lastNonceRef.current = nonce;

    const pts = [];
    for (const m of ms) {
      const x = Number(m?.x),
        y = Number(m?.y),
        z = Number(m?.z);
      if ([x, y, z].every(Number.isFinite))
        pts.push(new THREE.Vector3(x, y, z));
    }
    if (!pts.length) return;

    const box = new THREE.Box3().setFromPoints(pts);
    const controls = controlsRef?.current;
    fitCameraToBox({ camera, controls, box, padding: 1.45 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return null;
}

// -----------------------------
// safe event utils
// -----------------------------
function safePreventContextMenu(e) {
  try {
    e?.stopPropagation?.();
  } catch {}
  try {
    e?.nativeEvent?.stopPropagation?.();
  } catch {}
  try {
    e?.nativeEvent?.preventDefault?.();
  } catch {}
  try {
    e?.preventDefault?.();
  } catch {}
}

// -----------------------------
// bbox utils (for local grid)
// -----------------------------
function computeBBoxFromPositions(positions) {
  if (!positions || positions.length < 3) return null;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
      continue;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function snapBBoxToStep(b, step) {
  const s = Math.max(0.1, Number(step) || 1);
  const floorS = (v) => Math.floor(v / s) * s;
  const ceilS = (v) => Math.ceil(v / s) * s;

  return {
    minX: floorS(b.minX),
    minY: floorS(b.minY),
    minZ: floorS(b.minZ),
    maxX: ceilS(b.maxX),
    maxY: ceilS(b.maxY),
    maxZ: ceilS(b.maxZ),
  };
}

// -----------------------------
// robust line component (positions update)
// -----------------------------
function Line3D({ positions, color = "#22c55e", linewidth = 2, lineObjRef }) {
  const geomRef = useRef(null);

  useEffect(() => {
    if (!geomRef.current || !positions) return;
    geomRef.current.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    geomRef.current.attributes.position.needsUpdate = true;
    geomRef.current.computeBoundingSphere();
  }, [positions]);

  if (!positions) return null;

  return (
    <line ref={lineObjRef}>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial color={color} linewidth={linewidth} />
    </line>
  );
}

function AltClickAddMarker({
  enabled = true,
  editLineRef,
  baseLineRef,
  tMin,
  tMax,
  addMarkerAt,
  suppressRef,
  // ✅ for box selection UI + selection set
  markers = [],
  onMarqueeChange = () => {},
  onSelectKeys = () => {},
  onAltGestureActiveChange = () => {},
}) {
  const { camera, gl, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  // reusable helpers for snapping pointer hit to nearest segment
  const segA = useMemo(() => new THREE.Vector3(), []);
  const segB = useMemo(() => new THREE.Vector3(), []);
  const snap = useMemo(() => new THREE.Vector3(), []);
  const line3 = useMemo(() => new THREE.Line3(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  const pendingRef = useRef(null); // {pointerId,startX,startY,x,y,moved}

  useEffect(() => {
    const el = gl.domElement;
    if (!el) return;

    // ✅ 브라우저 기본 우클릭 메뉴 방지
    const onContextMenu = (ev) => {
      ev.preventDefault();
    };

    const setMarquee = (x0, y0, x1, y1) => {
      onMarqueeChange?.({ active: true, x0, y0, x1, y1 });
    };
    const clearMarquee = () => onMarqueeChange?.(null);

    const projectToCanvasPx = (world) => {
      const rect = el.getBoundingClientRect();
      tmpV.copy(world).project(camera);
      return {
        x: (tmpV.x * 0.5 + 0.5) * rect.width,
        y: (-tmpV.y * 0.5 + 0.5) * rect.height,
      };
    };

    const computeKeysInRect = (x0, y0, x1, y1) => {
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);

      const out = [];
      const ms = Array.isArray(markers) ? markers : [];
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        const wx = Number(m?.x) || 0;
        const wy = Number(m?.y) || 0;
        const wz = Number(m?.z) || 0;

        const p = projectToCanvasPx(new THREE.Vector3(wx, wy, wz));
        if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
          out.push(m?.id ?? i);
        }
      }
      return out;
    };

    const doRaycastAddMarker = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(ndc, camera);

      // ✅ marker 위에서 시작한 Alt 제스처는 "추가/박스"를 하지 않음
      const anyHits = raycaster.intersectObjects(scene.children, true);
      if (anyHits?.length) {
        const hit0 = anyHits[0];
        if (hit0?.object?.userData?.__gmMarker) return;
      }

      raycaster.params.Line = raycaster.params.Line || {};
      raycaster.params.Line.threshold = 0.35;

      const pick = (ref) => {
        const obj = ref?.current;
        if (!obj) return null;
        const hits = raycaster.intersectObject(obj, true);
        return hits && hits.length ? hits[0] : null;
      };

      // edit 곡선 우선, 없으면 base
      const hit = pick(editLineRef) || pick(baseLineRef);
      if (!hit?.point) return;

      const obj = hit.object;
      const posAttr = obj?.geometry?.attributes?.position;
      const vCount = posAttr?.count || 0;
      if (vCount < 2) return;

      // ✅ Line Raycast hit.point가 "라인 위 점"이 아닐 수 있어서, 실제 세그먼트 위로 다시 스냅
      const segIndex0 = Math.max(
        0,
        Math.min(vCount - 2, Number.isFinite(hit.index) ? hit.index : 0)
      );

      segA
        .fromBufferAttribute(posAttr, segIndex0)
        .applyMatrix4(obj.matrixWorld);
      segB
        .fromBufferAttribute(posAttr, segIndex0 + 1)
        .applyMatrix4(obj.matrixWorld);

      line3.set(segA, segB);
      line3.closestPointToPoint(hit.point, true, snap);

      const segLen = segA.distanceTo(segB);
      const frac = segLen > 1e-9 ? snap.distanceTo(segA) / segLen : 0;
      const alpha = Math.max(0, Math.min(1, (segIndex0 + frac) / (vCount - 1)));

      const t = Number(tMin) + (Number(tMax) - Number(tMin)) * alpha;

      addMarkerAt?.({ t, x: snap.x, y: snap.y, z: snap.z });
    };

    const onPointerDown = (ev) => {
      if (!enabled) return;
      if (ev.button !== 0) return; // left click only
      if (!ev.altKey) return; // ✅ Alt + 클릭/드래그만
      if (suppressRef?.current) return;

      // Alt 제스처 동안 카메라 비활성화(키 이벤트 누락 대비)
      onAltGestureActiveChange?.(true);

      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      pendingRef.current = {
        pointerId: ev.pointerId,
        startX: x,
        startY: y,
        x,
        y,
        moved: false,
      };

      setMarquee(x, y, x, y);

      try {
        el.setPointerCapture(ev.pointerId);
      } catch {}

      // 브라우저/컨트롤 기본 동작 방지
      try {
        ev.preventDefault();
      } catch {}
    };

    const onPointerMove = (ev) => {
      const p = pendingRef.current;
      if (!p) return;
      if (ev.pointerId !== p.pointerId) return;

      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      p.x = x;
      p.y = y;

      const dx = x - p.startX;
      const dy = y - p.startY;
      const dist2 = dx * dx + dy * dy;

      if (!p.moved && dist2 > 16) p.moved = true; // 4px threshold
      setMarquee(p.startX, p.startY, x, y);

      try {
        ev.preventDefault();
      } catch {}
    };

    const finalize = (ev) => {
      const p = pendingRef.current;
      if (!p) return;
      if (ev.pointerId !== p.pointerId) return;

      pendingRef.current = null;

      clearMarquee();
      onAltGestureActiveChange?.(false);

      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {}

      // ✅ Alt+클릭: 마커 추가
      if (!p.moved) {
        doRaycastAddMarker(ev.clientX, ev.clientY);
        return;
      }

      // ✅ Alt+드래그: 박스 내부 마커들을 "클릭된 것처럼" 선택 처리
      const keys = computeKeysInRect(p.startX, p.startY, p.x, p.y);
      const append = !!(ev.ctrlKey || ev.metaKey);
      onSelectKeys?.(keys, { append });
    };

    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", finalize);
    el.addEventListener("pointercancel", finalize);

    return () => {
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finalize);
      el.removeEventListener("pointercancel", finalize);
    };
  }, [
    enabled,
    gl,
    camera,
    scene,
    raycaster,
    ndc,
    editLineRef,
    baseLineRef,
    tMin,
    tMax,
    addMarkerAt,
    suppressRef,
    markers,
    onMarqueeChange,
    onSelectKeys,
    onAltGestureActiveChange,
    segA,
    segB,
    snap,
    line3,
    tmpV,
  ]);

  return null;
}

// -----------------------------
function Axes3D({
  size = 6,
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
  bbox = null,
}) {
  return (
    <group>
      <axesHelper args={[size]} />
      <CubeGrid3D
        half={size}
        gridMode={gridMode}
        majorStep={gridStep}
        minorDiv={minorDiv}
        bbox={bbox}
      />
    </group>
  );
}

function buildCoords(min, max, step, maxCount = 120) {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0)
    return { coords: [min, max], effectiveStep: step };

  const roughCount = Math.floor(span / step) + 1;
  let effectiveStep = step;

  // 안전장치: 너무 촘촘하면 step을 키워서 라인 수 제한
  if (roughCount > maxCount) {
    const factor = Math.ceil(roughCount / maxCount);
    effectiveStep = step * factor;
  }

  const coords = [];
  for (let v = min; v <= max + 1e-9; v += effectiveStep) coords.push(v);

  // 경계 포함 보정
  if (coords.length === 0 || coords[0] !== min) coords.unshift(min);
  if (coords[coords.length - 1] !== max) coords.push(max);

  return { coords, effectiveStep };
}

// 3D 큐브 격자(내부 라티스)
function CubeGrid3D({
  half = 6,
  gridMode = "major",
  majorStep = 1,
  minorDiv = 4,
  bbox = null,
}) {
  const mode = ["off", "box", "major", "full"].includes(String(gridMode))
    ? String(gridMode)
    : "major";

  const stepMajor = Math.max(0.1, Number(majorStep) || 1);
  const div = Math.max(2, Number(minorDiv) || 4);
  const stepMinor = stepMajor / div;

  // ✅ bbox(로컬 범위) 적용: box/major/full 모두 지원
  const range = useMemo(() => {
    if (bbox && mode !== "off") {
      return {
        minX: bbox.minX,
        maxX: bbox.maxX,
        minY: bbox.minY,
        maxY: bbox.maxY,
        minZ: bbox.minZ,
        maxZ: bbox.maxZ,
      };
    }
    return {
      minX: -half,
      maxX: half,
      minY: -half,
      maxY: half,
      minZ: -half,
      maxZ: half,
    };
  }, [mode, bbox, half]);

  // ✅ box 모드: bbox 범위에 맞춘 12개 엣지 라인(동적 재계산)
  const boxEdgesGeo = useMemo(() => {
    if (mode !== "box") return null;
    const { minX, maxX, minY, maxY, minZ, maxZ } = range;

    const pts = [
      // bottom rectangle
      minX,
      minY,
      minZ,
      maxX,
      minY,
      minZ,
      maxX,
      minY,
      minZ,
      maxX,
      minY,
      maxZ,
      maxX,
      minY,
      maxZ,
      minX,
      minY,
      maxZ,
      minX,
      minY,
      maxZ,
      minX,
      minY,
      minZ,

      // top rectangle
      minX,
      maxY,
      minZ,
      maxX,
      maxY,
      minZ,
      maxX,
      maxY,
      minZ,
      maxX,
      maxY,
      maxZ,
      maxX,
      maxY,
      maxZ,
      minX,
      maxY,
      maxZ,
      minX,
      maxY,
      maxZ,
      minX,
      maxY,
      minZ,

      // vertical edges
      minX,
      minY,
      minZ,
      minX,
      maxY,
      minZ,
      maxX,
      minY,
      minZ,
      maxX,
      maxY,
      minZ,
      maxX,
      minY,
      maxZ,
      maxX,
      maxY,
      maxZ,
      minX,
      minY,
      maxZ,
      minX,
      maxY,
      maxZ,
    ];

    return new Float32Array(pts);
  }, [
    mode,
    range.minX,
    range.maxX,
    range.minY,
    range.maxY,
    range.minZ,
    range.maxZ,
  ]);

  // ✅ “중복 제거”된 내부 라티스: X방향 / Y방향 / Z방향 3 family만 생성
  const majorLineGeo = useMemo(() => {
    if (!(mode === "major" || mode === "full")) return null;

    const pts = [];

    const xs = buildCoords(range.minX, range.maxX, stepMajor).coords;
    const ys = buildCoords(range.minY, range.maxY, stepMajor).coords;
    const zs = buildCoords(range.minZ, range.maxZ, stepMajor).coords;

    // lines parallel X for each (y,z)
    for (const y of ys) {
      for (const z of zs) {
        pts.push(range.minX, y, z, range.maxX, y, z);
      }
    }
    // lines parallel Y for each (x,z)
    for (const x of xs) {
      for (const z of zs) {
        pts.push(x, range.minY, z, x, range.maxY, z);
      }
    }
    // lines parallel Z for each (x,y)
    for (const x of xs) {
      for (const y of ys) {
        pts.push(x, y, range.minZ, x, y, range.maxZ);
      }
    }

    return pts.length ? new Float32Array(pts) : null;
  }, [
    mode,
    range.minX,
    range.maxX,
    range.minY,
    range.maxY,
    range.minZ,
    range.maxZ,
    stepMajor,
  ]);

  const minorLineGeo = useMemo(() => {
    if (mode !== "full") return null;

    const pts = [];

    const xs = buildCoords(range.minX, range.maxX, stepMinor).coords;
    const ys = buildCoords(range.minY, range.maxY, stepMinor).coords;
    const zs = buildCoords(range.minZ, range.maxZ, stepMinor).coords;

    for (const y of ys) {
      for (const z of zs) pts.push(range.minX, y, z, range.maxX, y, z);
    }
    for (const x of xs) {
      for (const z of zs) pts.push(x, range.minY, z, x, range.maxY, z);
    }
    for (const x of xs) {
      for (const y of ys) pts.push(x, y, range.minZ, x, y, range.maxZ);
    }

    return pts.length ? new Float32Array(pts) : null;
  }, [
    mode,
    range.minX,
    range.maxX,
    range.minY,
    range.maxY,
    range.minZ,
    range.maxZ,
    stepMinor,
  ]);

  if (mode === "off") return null;

  // ✅ 조금 더 투명한 톤(요청 반영) + Full에서 minor가 보이도록만 유지
  const BOX_MAT = { color: "#94a3b8", opacity: 0.28 };
  const MAJOR_MAT = { color: "#64748b", opacity: 0.2 };
  const MINOR_MAT = { color: "#475569", opacity: 0.12 };

  return (
    <group>
      {/* box only (global) */}
      {mode === "box" && boxEdgesGeo && (
        <lineSegments
          key={`box-${range.minX}-${range.maxX}-${range.minY}-${range.maxY}-${range.minZ}-${range.maxZ}`}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={boxEdgesGeo}
              count={boxEdgesGeo.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={BOX_MAT.color}
            transparent
            opacity={BOX_MAT.opacity}
          />
        </lineSegments>
      )}

      {/* major grid (local when bbox present) */}
      {(mode === "major" || mode === "full") && majorLineGeo && (
        <lineSegments
          key={`major-${range.minX}-${range.maxX}-${range.minY}-${range.maxY}-${range.minZ}-${range.maxZ}-${stepMajor}`}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={majorLineGeo}
              count={majorLineGeo.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={MAJOR_MAT.color}
            transparent
            opacity={MAJOR_MAT.opacity}
          />
        </lineSegments>
      )}

      {/* minor grid (full only, local when bbox present) */}
      {mode === "full" && minorLineGeo && (
        <lineSegments
          key={`minor-${range.minX}-${range.maxX}-${range.minY}-${range.maxY}-${range.minZ}-${range.maxZ}-${stepMinor}`}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={minorLineGeo}
              count={minorLineGeo.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={MINOR_MAT.color}
            transparent
            opacity={MINOR_MAT.opacity}
          />
        </lineSegments>
      )}
    </group>
  );
}

// -----------------------------
// marker visuals
// -----------------------------
function MarkerLabel({ position, label }) {
  return (
    <Text
      position={[position.x, position.y + 0.25, position.z ?? 0]}
      fontSize={0.18}
      color="#e5e7eb"
      anchorX="center"
      anchorY="bottom"
      outlineWidth={0.01}
      outlineColor="#020617"
    >
      {label}
    </Text>
  );
}

// (토글 대상) 마커를 잇는 폴리라인
function MarkerCurve({ markers }) {
  const positions = useMemo(() => {
    if (!markers || markers.length < 2) return null;
    const pts = [];
    for (const m of markers) pts.push(m.x ?? 0, m.y ?? 0, m.z ?? 0);
    return pts.length ? new Float32Array(pts) : null;
  }, [markers]);

  return <Line3D positions={positions} color="#22c55e" linewidth={2} />;
}

function DraggableMarker3D({
  marker,
  markerKey,
  markers,
  selectedKeys,
  onMarkersChange,
  onRemove,
  onSelect,
  isSelected,
  onChange,
  onDragEnd,
  setControlsBusy,
  suppressAltClick,
}) {
  const meshRef = useRef();
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  useCursor(hovered || isSelected);

  const plane = useMemo(() => new THREE.Plane(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  // { group:boolean, selIdxs:number[], startHit:Vector3, startAll:[{x,y,z}] }
  const dragStartRef = useRef(null);

  // ✅ 선택/비선택 색: 초록/노랑
  const baseColor = isSelected ? "#22c55e" : "#facc15";
  const hoverColor = isSelected ? "#34d399" : "#fde047";

  const keyOf = (mm, idx) => mm?.id ?? idx;

  const onPointerDown = (e) => {
    e.stopPropagation();
    suppressAltClick?.();

    // support ctrl/meta append/toggle selection when clicking
    onSelect?.(markerKey, { append: !!(e.ctrlKey || e.metaKey) });

    setDragging(true);
    setControlsBusy?.(true);

    // intersect plane (screen drag)
    const rect = gl.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(ndc, camera);

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, meshRef.current.position);

    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (ok) {
      // ✅ 그룹 이동 대상: "박스 선택된 노드들" (Alt 누를 필요 없음)
      const sel =
        selectedKeys instanceof Set && selectedKeys.size > 0 && isSelected
          ? selectedKeys
          : new Set([markerKey]);

      const selIdxs = [];
      const ms = Array.isArray(markers) ? markers : [];
      for (let i = 0; i < ms.length; i++) {
        const k = keyOf(ms[i], i);
        if (sel.has(k)) selIdxs.push(i);
      }

      dragStartRef.current = {
        group: selIdxs.length > 0 && typeof onMarkersChange === "function",
        selIdxs,
        startHit: hit.clone(),
        startAll: ms.map((mm) => ({
          x: Number(mm?.x) || 0,
          y: Number(mm?.y) || 0,
          z: Number(mm?.z) || 0,
        })),
      };
    } else {
      dragStartRef.current = { group: false };
    }

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();

    const rect = gl.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(ndc, camera);

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, meshRef.current.position);

    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (!ok) return;

    // ✅ 그룹 이동: "선택된(selIdxs) 노드만" 동일 Δ 적용
    if (
      dragStartRef.current?.group &&
      dragStartRef.current?.startHit &&
      Array.isArray(dragStartRef.current?.startAll) &&
      Array.isArray(dragStartRef.current?.selIdxs)
    ) {
      const d = new THREE.Vector3().subVectors(
        hit,
        dragStartRef.current.startHit
      );
      const startAll = dragStartRef.current.startAll;
      const selSet = new Set(dragStartRef.current.selIdxs);

      const next = (markers || []).map((mm, i) => {
        const s0 = startAll[i] || { x: 0, y: 0, z: 0 };
        if (!selSet.has(i)) return { ...mm, x: s0.x, y: s0.y, z: s0.z };
        return { ...mm, x: s0.x + d.x, y: s0.y + d.y, z: s0.z + d.z };
      });

      onMarkersChange?.(next);
      return;
    }

    // ✅ 단일 이동(기존)
    onChange?.(markerKey, { x: hit.x, y: hit.y, z: hit.z });
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    setControlsBusy?.(false);
    onDragEnd?.();
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[marker.x ?? 0, marker.y ?? 0, marker.z ?? 0]}
        userData={{ __gmMarker: true, markerKey }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={(e) => (e.stopPropagation(), setHovered(false))}
        onContextMenu={(e) => (
          safePreventContextMenu(e), onRemove?.(markerKey)
        )}
      >
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color={hovered ? hoverColor : baseColor} />
      </mesh>

      <MarkerLabel
        position={
          new THREE.Vector3(marker.x ?? 0, marker.y ?? 0, marker.z ?? 0)
        }
        label={coordLabel(marker)}
      />
    </group>
  );
}

function EditableMarker3D({
  marker,
  markerKey,
  onRemove,
  onSelect,
  isSelected,
  onChange,
  onDragEnd,
  setControlsBusy,
  suppressAltClick,
}) {
  const objRef = useRef();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered || isSelected);

  const baseColor = isSelected ? "#22c55e" : "#facc15";
  const hoverColor = isSelected ? "#34d399" : "#fde047";

  const handleDraggingChanged = (e) => {
    const v = typeof e === "boolean" ? e : e?.value;
    setControlsBusy?.(!!v);
    if (v === false) onDragEnd?.();
  };

  const handleObjectChange = () => {
    if (!objRef.current) return;
    const p = objRef.current.position;
    onChange?.(markerKey, { x: p.x, y: p.y, z: p.z });
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    suppressAltClick?.();
    onSelect?.(markerKey, { append: !!(e.ctrlKey || e.metaKey) });
  };

  return (
    <group>
      <TransformControls
        object={objRef}
        mode="translate"
        onDraggingChanged={handleDraggingChanged}
        onObjectChange={handleObjectChange}
      />
      <mesh
        ref={objRef}
        position={[marker.x ?? 0, marker.y ?? 0, marker.z ?? 0]}
        userData={{ __gmMarker: true, markerKey }}
        onPointerDown={handleSelect}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={(e) => (e.stopPropagation(), setHovered(false))}
        onContextMenu={(e) => (
          safePreventContextMenu(e), onRemove?.(markerKey)
        )}
      >
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color={hovered ? hoverColor : baseColor} />
      </mesh>
      <MarkerLabel
        position={
          new THREE.Vector3(marker.x ?? 0, marker.y ?? 0, marker.z ?? 0)
        }
        label={coordLabel(marker)}
      />
    </group>
  );
}

// -----------------------------
// main canvas
// -----------------------------
export default function Curve3DCanvas({
  baseXExpr,
  baseYExpr,
  baseZExpr,
  xExpr,
  yExpr,
  zExpr,
  tMin = -2,
  tMax = 2,
  samples = 200,

  // Grid
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,

  markers = [],
  onMarkerChange,
  onMarkersChange,
  onRecalculateExpressions,
  editMode = "drag",

  // Deform constraints
  deformSigma = 0.6,
  maxDelta = 1.5,

  // Marker polyline toggle
  showMarkerPolyline = false,
}) {
  // 기준(회색) 곡선: base가 있으면 base 사용, 없으면 edit 사용
  const refXExpr = baseXExpr ?? xExpr;
  const refYExpr = baseYExpr ?? yExpr;
  const refZExpr = baseZExpr ?? zExpr;

  const controlsRef = useRef();

  const xtRef = useMemo(() => makeParamFn(refXExpr, "t"), [refXExpr]);
  const ytRef = useMemo(() => makeParamFn(refYExpr, "t"), [refYExpr]);
  const ztRef = useMemo(() => makeParamFn(refZExpr, "t"), [refZExpr]);

  // 편집 수식(저장용)
  const xt = useMemo(() => makeParamFn(xExpr, "t"), [xExpr]);
  const yt = useMemo(() => makeParamFn(yExpr, "t"), [yExpr]);
  const zt = useMemo(() => makeParamFn(zExpr, "t"), [zExpr]);

  const markerKeys = useMemo(() => {
    const ms = Array.isArray(markers) ? markers : [];
    return ms.map((m, idx) => m?.id ?? idx);
  }, [markers]);

  const [selectedKeys, setSelectedKeys] = useState(() => new Set());

  // keep selection valid when markers change
  useEffect(() => {
    setSelectedKeys((prev) => {
      const valid = new Set(markerKeys);
      const base = prev instanceof Set ? prev : new Set();
      const next = new Set();
      for (const k of base) if (valid.has(k)) next.add(k);
      if (next.size === 0 && markerKeys.length > 0) next.add(markerKeys[0]);
      return next;
    });
  }, [markerKeys]);

  const selectedKey = useMemo(() => {
    const it = selectedKeys.values().next();
    return it.done ? null : it.value;
  }, [selectedKeys]);

  // select helper: replace selection or append/toggle when opts.append true
  const selectKey = (k, opts) => {
    setSelectedKeys((prev) => {
      const base = prev instanceof Set ? new Set(prev) : new Set();
      const append = !!opts?.append;
      if (!append) return new Set([k]);
      if (base.has(k)) {
        base.delete(k);
        return base;
      }
      base.add(k);
      return base;
    });
  };

  // base curve positions
  const basePositions = useMemo(() => {
    if (!refXExpr || !refYExpr || !refZExpr || samples < 2) return null;
    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;
      const x = xtRef(t);
      const y = ytRef(t);
      const z = ztRef(t);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))
        pts.push(x, y, z);
    }
    return pts.length ? new Float32Array(pts) : null;
  }, [refXExpr, refYExpr, refZExpr, tMin, tMax, samples, xtRef, ytRef, ztRef]);

  // markers: 좌표 없는 경우 기준식으로 채움
  const displayMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return markers.map((m) => {
      let x = Number.isFinite(m.x) ? m.x : undefined;
      let y = Number.isFinite(m.y) ? m.y : undefined;
      let z = Number.isFinite(m.z) ? m.z : undefined;

      if (
        (x === undefined || y === undefined || z === undefined) &&
        typeof m.t === "number"
      ) {
        const tx = xtRef(m.t);
        const ty = ytRef(m.t);
        const tz = ztRef(m.t);
        x = x ?? (Number.isFinite(tx) ? tx : 0);
        y = y ?? (Number.isFinite(ty) ? ty : 0);
        z = z ?? (Number.isFinite(tz) ? tz : 0);
      }

      return { ...m, x: x ?? 0, y: y ?? 0, z: z ?? 0 };
    });
  }, [markers, xtRef, ytRef, ztRef]);

  const isAIMarker = (m) =>
    m?._focusNonce !== undefined && m?._focusNonce !== null;

  // 노드 기반 커널 변형(즉시 프리뷰)
  const kernelDeform = useMemo(() => {
    const tPoints = (displayMarkers || []).filter(
      (m) => typeof m.t === "number" && !isAIMarker(m)
    );
    const s = Math.max(1e-6, Number(deformSigma) || 0.6);
    const eps = 1e-9;

    const w = (t, ti) => Math.exp(-(((t - ti) / s) ** 2));

    const dx = [];
    const dy = [];
    const dz = [];

    for (const m of tPoints) {
      const ti = m.t;
      const bx = xtRef(ti);
      const by = ytRef(ti);
      const bz = ztRef(ti);
      if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz))
        continue;

      dx.push({ ti, di: Number(m.x) - bx });
      dy.push({ ti, di: Number(m.y) - by });
      dz.push({ ti, di: Number(m.z) - bz });
    }

    const makeDeltaFn = (arr) => (t) => {
      let num = 0;
      let den = eps;
      for (const { ti, di } of arr) {
        if (!Number.isFinite(di)) continue;
        const wi = w(t, ti);
        num += di * wi;
        den += wi;
      }
      return num / den;
    };

    const dfx = makeDeltaFn(dx);
    const dfy = makeDeltaFn(dy);
    const dfz = makeDeltaFn(dz);

    return {
      hasPoints: tPoints.length >= 2,
      x: (t) => xtRef(t) + dfx(t),
      y: (t) => ytRef(t) + dfy(t),
      z: (t) => ztRef(t) + dfz(t),
    };
  }, [displayMarkers, deformSigma, xtRef, ytRef, ztRef]);

  // 편집 곡선: (노드 2개 이상이면) 프리뷰로 계산, 아니면 식 자체로 계산
  const editPositions = useMemo(() => {
    if (samples < 2) return null;
    const usePreview = !!kernelDeform?.hasPoints;

    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;

      const x = usePreview ? kernelDeform.x(t) : xt(t);
      const y = usePreview ? kernelDeform.y(t) : yt(t);
      const z = usePreview ? kernelDeform.z(t) : zt(t);

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))
        pts.push(x, y, z);
    }

    return pts.length ? new Float32Array(pts) : null;
  }, [tMin, tMax, samples, kernelDeform, xt, yt, zt]);

  // ✅ 로컬 격자 bbox: 현재 렌더링 곡선(edit 우선, 없으면 base) 기준으로 계산
  const localGridBBox = useMemo(() => {
    // major/full에서만 사용
    if (!(gridMode === "box" || gridMode === "major" || gridMode === "full"))
      return null;

    const src = editPositions ?? basePositions;
    // ✅ 곡선 + (현재 표시되는) 마커 좌표까지 포함해서 bbox 계산
    const b0 = computeBBoxFromPositions(src);
    let b = b0;
    const ms = Array.isArray(displayMarkers) ? displayMarkers : [];
    for (const m of ms) {
      const x = Number(m?.x);
      const y = Number(m?.y);
      const z = Number(m?.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
        continue;
      if (!b) {
        b = { minX: x, minY: y, minZ: z, maxX: x, maxY: y, maxZ: z };
      } else {
        if (x < b.minX) b.minX = x;
        if (y < b.minY) b.minY = y;
        if (z < b.minZ) b.minZ = z;
        if (x > b.maxX) b.maxX = x;
        if (y > b.maxY) b.maxY = y;
        if (z > b.maxZ) b.maxZ = z;
      }
    }
    if (!b) return null;

    const step = Math.max(0.1, Number(gridStep) || 1);
    const pad = step * 2; // 여유 마진(취향)

    const padded = {
      minX: b.minX - pad,
      minY: b.minY - pad,
      minZ: b.minZ - pad,
      maxX: b.maxX + pad,
      maxY: b.maxY + pad,
      maxZ: b.maxZ + pad,
    };

    return snapBBoxToStep(padded, step);
  }, [gridMode, editPositions, basePositions, gridStep, displayMarkers]);
  // ✅ axes/grid 시각 범위도 bbox를 따라가도록(체감상 '격자 재계산'이 안되는 문제 예방)
  const gridHalf = useMemo(() => {
    if (!localGridBBox) return 6;
    const sx = (localGridBBox.maxX - localGridBBox.minX) / 2;
    const sy = (localGridBBox.maxY - localGridBBox.minY) / 2;
    const sz = (localGridBBox.maxZ - localGridBBox.minZ) / 2;
    const m = Math.max(sx, sy, sz);
    return Number.isFinite(m) ? Math.max(6, m) : 6;
  }, [localGridBBox]);

  const [controlsBusy, setControlsBusy] = useState(false);
  const controlsBusyRef = useRef(false);
  useEffect(() => {
    controlsBusyRef.current = controlsBusy;
  }, [controlsBusy]);

  const editLineRef = useRef(null);
  const baseLineRef = useRef(null);

  // ✅ Alt+클릭 추가에서 마커 클릭/드래그와 충돌 방지
  const suppressAltClickRef = useRef(false);
  const suppressAltClick = () => {
    suppressAltClickRef.current = true;
    requestAnimationFrame(() => {
      suppressAltClickRef.current = false;
    });
  };

  // ✅ 키 상태(TransformControls에서도 사용 가능)
  const [altDown, setAltDown] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState(null);
  const [altGestureActive, setAltGestureActive] = useState(false);

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === "Alt") {
        setAltDown(true);
        // 키 입력 순간에도 OrbitControls 비활성화(첫 프레임 카메라 이동 방지)
        if (controlsRef.current) controlsRef.current.enabled = false;
      }
    };
    const onKeyUp = (ev) => {
      if (ev.key === "Alt") {
        setAltDown(false);
        if (controlsRef.current)
          controlsRef.current.enabled = !controlsBusyRef.current;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ✅ Alt 조작 중에는 카메라(OrbitControls)가 절대 움직이지 않도록 즉시 반영
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = !(controlsBusy || altDown);
  }, [controlsBusy, altDown]);

  const keyToIndex = useMemo(() => {
    const map = new Map();
    const ms = Array.isArray(markers) ? markers : [];
    ms.forEach((m, idx) => map.set(m?.id ?? idx, idx));
    return map;
  }, [markers]);

  const makeId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return `m_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    }
  };

  const removeMarkerByKey = (markerKey) => {
    const idx = keyToIndex.get(markerKey);
    if (typeof idx !== "number") return;
    const ms = Array.isArray(markers) ? markers : [];
    const next = ms.filter((_, i) => i !== idx);
    onMarkersChange?.(next);
    setSelectedKeys((prev) => {
      if (!(prev instanceof Set)) return prev;
      const ns = new Set(prev);
      ns.delete(markerKey);
      return ns;
    });
  };

  const addMarkerAt = ({ t, x, y, z }) => {
    const ms = Array.isArray(markers) ? markers : [];
    const next = [
      ...ms,
      {
        id: makeId(),
        kind: "control",
        t: typeof t === "number" && Number.isFinite(t) ? t : undefined,
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        z: Number.isFinite(z) ? z : 0,
      },
    ];
    onMarkersChange?.(next);
  };

  const handleMarkerChangeByKey = (markerKey, pos) => {
    const idx = keyToIndex.get(markerKey);
    if (typeof idx !== "number") return;

    const m =
      (displayMarkers && displayMarkers[idx]) ||
      (markers && markers[idx]) ||
      null;
    const t = m && typeof m.t === "number" ? m.t : null;

    // 기준 곡선에서 과도하게 벗어나지 않도록 clamp
    const md = Number(maxDelta);
    if (t !== null && Number.isFinite(md) && md > 0) {
      const bx = xtRef(t);
      const by = ytRef(t);
      const bz = ztRef(t);

      if (Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bz)) {
        const baseV = new THREE.Vector3(bx, by, bz);
        const p = new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
        const d = p.clone().sub(baseV);
        const len = d.length();

        if (len > md) {
          d.setLength(md);
          const clamped = baseV.add(d);
          onMarkerChange?.(idx, { x: clamped.x, y: clamped.y, z: clamped.z });
          return;
        }
      }
    }

    onMarkerChange?.(idx, pos);
  };

  // 드래그 끝: 현재 노드 상태를 “수식”으로 확정
  const handleMarkerDragEnd = () => {
    setTimeout(() => {
      try {
        const tPoints = (displayMarkers || []).filter(
          (m) => typeof m.t === "number" && Number.isFinite(m.t)
        );

        if (tPoints.length < 2) return;

        const s = Math.max(1e-6, Number(deformSigma) || 0.6);
        const eps = 1e-9;

        const buildKernelDeformExpr = (deltas) => {
          const wExpr = (ti) => `exp(-(((t)-(${ti}))/(${s}))^2)`;

          const numTerms = [];
          const denTerms = [];

          for (const d of deltas) {
            const ti = Number(d.t);
            const di = Number(d.delta);
            if (!Number.isFinite(ti) || !Number.isFinite(di)) continue;
            if (Math.abs(di) < 1e-12) continue;

            const wi = wExpr(ti);
            numTerms.push(`((${di})*(${wi}))`);
            denTerms.push(`(${wi})`);
          }

          if (numTerms.length === 0) return "0";
          const num = numTerms.join(" + ");
          const den = denTerms.length
            ? `${denTerms.join(" + ")} + (${eps})`
            : `${eps}`;
          return `((${num})/(${den}))`;
        };

        const dx = [];
        const dy = [];
        const dz = [];

        for (const m of tPoints) {
          const t = m.t;

          const bx = xtRef(t);
          const by = ytRef(t);
          const bz = ztRef(t);
          if (
            !Number.isFinite(bx) ||
            !Number.isFinite(by) ||
            !Number.isFinite(bz)
          )
            continue;

          dx.push({ t, delta: Number(m.x) - bx });
          dy.push({ t, delta: Number(m.y) - by });
          dz.push({ t, delta: Number(m.z) - bz });
        }

        const rhsOf = (expr) => {
          const s = String(expr ?? "").trim();
          if (!s) return "0";
          if (s.includes("=")) return s.split("=").pop().trim() || "0";
          return s;
        };

        const baseXRhs = rhsOf(refXExpr ?? "0");
        const baseYRhs = rhsOf(refYExpr ?? "0");
        const baseZRhs = rhsOf(refZExpr ?? "0");

        const newXExpr = `x(t) = ((${baseXRhs}) + (${buildKernelDeformExpr(
          dx
        )}))`;
        const newYExpr = `y(t) = ((${baseYRhs}) + (${buildKernelDeformExpr(
          dy
        )}))`;
        const newZExpr = `z(t) = ((${baseZRhs}) + (${buildKernelDeformExpr(
          dz
        )}))`;

        onRecalculateExpressions?.({
          xExpr: newXExpr,
          yExpr: newYExpr,
          zExpr: newZExpr,
        });
      } catch {
        // silent
      }
    }, 0);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        background: "#020617",
        borderRadius: 16,
        border: "1px solid rgba(148, 163, 184, 0.25)",
      }}
    >
      <Canvas
        camera={{ position: [6, 6, 6], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color("#020617"), 1.0)
        }
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 3]} intensity={1.2} />

        <AltClickAddMarker
          enabled={typeof onMarkersChange === "function"}
          editLineRef={editLineRef}
          baseLineRef={baseLineRef}
          tMin={tMin}
          tMax={tMax}
          addMarkerAt={addMarkerAt}
          suppressRef={suppressAltClickRef}
          markers={displayMarkers}
          onMarqueeChange={setMarqueeBox}
          onSelectKeys={(keys, opts) =>
            setSelectedKeys((prev) => {
              const base = prev instanceof Set ? prev : new Set();
              if (opts?.append) {
                const next = new Set(base);
                for (const k of keys || []) next.add(k);
                return next;
              }
              return new Set(keys || []);
            })
          }
          onAltGestureActiveChange={setAltGestureActive}
        />

        {/* ✅ Major/Full일 때는 bbox 기반 로컬 격자 */}
        <Axes3D
          size={gridHalf}
          gridMode={gridMode}
          gridStep={gridStep}
          minorDiv={minorDiv}
          bbox={localGridBBox}
        />

        {/* 기준(회색) */}
        <Line3D
          positions={basePositions}
          color="#9ca3af"
          linewidth={1}
          lineObjRef={baseLineRef}
        />

        {/* 편집(녹색 라인): 노드 기반 프리뷰 */}
        <Line3D
          positions={editPositions}
          color="#22c55e"
          linewidth={2}
          lineObjRef={editLineRef}
        />

        {/* 마커 연결선 토글 */}
        {showMarkerPolyline && <MarkerCurve markers={displayMarkers} />}

        {displayMarkers.map((m, idx) => {
          const markerKey = m?.id ?? idx;
          const isSelected = selectedKeys.has(markerKey);

          return editMode === "arrows" ? (
            <EditableMarker3D
              key={markerKey}
              marker={m}
              markerKey={markerKey}
              onRemove={removeMarkerByKey}
              onSelect={selectKey}
              isSelected={isSelected}
              suppressAltClick={suppressAltClick}
              onChange={handleMarkerChangeByKey}
              onDragEnd={handleMarkerDragEnd}
              setControlsBusy={setControlsBusy}
            />
          ) : (
            <DraggableMarker3D
              key={markerKey}
              marker={m}
              markerKey={markerKey}
              markers={displayMarkers}
              selectedKeys={selectedKeys}
              onMarkersChange={onMarkersChange}
              onRemove={removeMarkerByKey}
              onSelect={selectKey}
              isSelected={isSelected}
              suppressAltClick={suppressAltClick}
              onChange={handleMarkerChangeByKey}
              onDragEnd={handleMarkerDragEnd}
              setControlsBusy={setControlsBusy}
            />
          );
        })}

        <AutoFocusOnMarkers3D
          markers={displayMarkers}
          controlsRef={controlsRef}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!controlsBusy && !altDown && !altGestureActive}
          enableDamping
          dampingFactor={0.08}
        />
        <OrientationOverlay controlsRef={controlsRef} />
      </Canvas>

      {marqueeBox?.active && (
        <div
          style={{
            position: "absolute",
            left: Math.min(marqueeBox.x0, marqueeBox.x1),
            top: Math.min(marqueeBox.y0, marqueeBox.y1),
            width: Math.abs(marqueeBox.x1 - marqueeBox.x0),
            height: Math.abs(marqueeBox.y1 - marqueeBox.y0),
            border: "1px dashed rgba(148, 163, 184, 0.9)",
            background: "rgba(56, 189, 248, 0.08)",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
