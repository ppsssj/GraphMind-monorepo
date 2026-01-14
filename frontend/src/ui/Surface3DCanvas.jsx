// src/ui/Surface3DCanvas.jsx
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";
import OrientationOverlay from "./OrientationOverlay";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

const mathjs = create(all, {});

// z = f(x,y)
function makeScalarFn(expr) {
  if (!expr) return () => 0;

  const rhs = String(expr).includes("=") ? String(expr).split("=").pop() : expr;
  const trimmed = String(rhs ?? "").trim() || "0";

  try {
    const compiled = mathjs.compile(trimmed);
    return (x, y) => {
      try {
        const v = compiled.evaluate({ x, y });
        const num = Number(v);
        return Number.isFinite(num) ? num : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
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

function getFocusNonceFromMarkers(markers) {
  const ms = Array.isArray(markers) ? markers : [];
  const n = ms.find(
    (m) => m?._focusNonce !== undefined && m?._focusNonce !== null
  )?._focusNonce;
  return n ?? null;
}

/**
 * 격자(큐브 라티스)
 * - bounds 변경 시 R3F에서 geometry 업데이트가 안 먹는 케이스 방지:
 *   상위에서 key로 remount 강제 가능
 */
function CubeLatticeGrid({
  bounds,
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
}) {
  const mode = ["off", "box", "major", "full"].includes(String(gridMode))
    ? String(gridMode)
    : "major";
  const b = bounds;

  const buildCoords = (minV, maxV, step, maxDivisions) => {
    const s = Math.max(0.1, Number(step) || 1);
    const coords = [];

    const start = Math.ceil(minV / s) * s;
    for (let v = start; v <= maxV + 1e-6; v += s) coords.push(v);

    if (coords.length === 0 || Math.abs(coords[0] - minV) > 1e-6)
      coords.unshift(minV);
    if (Math.abs(coords[coords.length - 1] - maxV) > 1e-6) coords.push(maxV);

    if (coords.length > maxDivisions + 1) {
      const n = maxDivisions;
      coords.length = 0;
      for (let i = 0; i <= n; i++) coords.push(minV + ((maxV - minV) * i) / n);
    }
    return { coords, step: s };
  };

  const buildLatticePositions = (
    xs,
    ys,
    zs,
    xmin,
    xmax,
    ymin,
    ymax,
    zmin,
    zmax
  ) => {
    const nx = xs.length;
    const ny = ys.length;
    const nz = zs.length;

    const lineCount = ny * nz + nx * nz + nx * ny;
    const arr = new Float32Array(lineCount * 2 * 3);
    let o = 0;

    for (let yi = 0; yi < ny; yi++) {
      for (let zi = 0; zi < nz; zi++) {
        const y = ys[yi];
        const z = zs[zi];
        arr[o++] = xmin;
        arr[o++] = y;
        arr[o++] = z;
        arr[o++] = xmax;
        arr[o++] = y;
        arr[o++] = z;
      }
    }
    for (let xi = 0; xi < nx; xi++) {
      for (let zi = 0; zi < nz; zi++) {
        const x = xs[xi];
        const z = zs[zi];
        arr[o++] = x;
        arr[o++] = ymin;
        arr[o++] = z;
        arr[o++] = x;
        arr[o++] = ymax;
        arr[o++] = z;
      }
    }
    for (let xi = 0; xi < nx; xi++) {
      for (let yi = 0; yi < ny; yi++) {
        const x = xs[xi];
        const y = ys[yi];
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = zmin;
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = zmax;
      }
    }

    return arr;
  };

  const edgesGeo = useMemo(() => {
    if (!b || mode === "off") return null;
    const w = b.xmax - b.xmin;
    const h = b.ymax - b.ymin;
    const d = b.zmax - b.zmin;

    const box = new THREE.BoxGeometry(
      Math.max(1e-6, w),
      Math.max(1e-6, h),
      Math.max(1e-6, d)
    );
    box.translate(b.xmin + w / 2, b.ymin + h / 2, b.zmin + d / 2);
    return box;
  }, [b, mode]);

  useEffect(() => {
    return () => {
      try {
        edgesGeo?.dispose();
      } catch {}
    };
  }, [edgesGeo]);

  const { majorPositions, minorPositions } = useMemo(() => {
    if (!b || mode === "off" || mode === "box")
      return { majorPositions: null, minorPositions: null };

    const { coords: xs, step: majorStepNorm } = buildCoords(
      b.xmin,
      b.xmax,
      gridStep,
      50
    );
    const { coords: ys } = buildCoords(b.ymin, b.ymax, gridStep, 50);
    const { coords: zs } = buildCoords(b.zmin, b.zmax, gridStep, 50);

    const major = buildLatticePositions(
      xs,
      ys,
      zs,
      b.xmin,
      b.xmax,
      b.ymin,
      b.ymax,
      b.zmin,
      b.zmax
    );
    if (mode !== "full") return { majorPositions: major, minorPositions: null };

    const div = Math.max(2, Math.floor(Number(minorDiv) || 4));
    const minorStep = Math.max(0.1, majorStepNorm / div);

    const { coords: xs2 } = buildCoords(b.xmin, b.xmax, minorStep, 60);
    const { coords: ys2 } = buildCoords(b.ymin, b.ymax, minorStep, 60);
    const { coords: zs2 } = buildCoords(b.zmin, b.zmax, minorStep, 60);

    const eps = 1e-5;
    const filterNotOnMajor = (arr, baseStep) =>
      arr.filter((v) => {
        const k = Math.round(v / baseStep);
        return Math.abs(v - k * baseStep) > eps;
      });

    const xsMinor = filterNotOnMajor(xs2, majorStepNorm);
    const ysMinor = filterNotOnMajor(ys2, majorStepNorm);
    const zsMinor = filterNotOnMajor(zs2, majorStepNorm);

    const minor = buildLatticePositions(
      xsMinor,
      ysMinor,
      zsMinor,
      b.xmin,
      b.xmax,
      b.ymin,
      b.ymax,
      b.zmin,
      b.zmax
    );
    return { majorPositions: major, minorPositions: minor };
  }, [b, mode, gridStep, minorDiv]);

  if (mode === "off" || !b) return null;

  return (
    <group>
      {edgesGeo && (
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial
            color="#64748b"
            transparent
            opacity={0.25}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {majorPositions && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={majorPositions}
              count={majorPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#334155"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {minorPositions && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={minorPositions}
              count={minorPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#334155"
            transparent
            opacity={0.04}
            depthWrite={false}
          />
        </lineSegments>
      )}
    </group>
  );
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function roundKey(x) {
  if (!Number.isFinite(x)) return "nan";
  // key 안정성: 지나친 변동 방지용
  return String(Math.round(x * 1000) / 1000);
}

function normalizeBounds(b) {
  if (!b) return null;
  const xmin = Math.min(b.xmin, b.xmax);
  const xmax = Math.max(b.xmin, b.xmax);
  const ymin = Math.min(b.ymin, b.ymax);
  const ymax = Math.max(b.ymin, b.ymax);
  const zmin = Math.min(b.zmin, b.zmax);
  const zmax = Math.max(b.zmin, b.zmax);
  return { xmin, xmax, ymin, ymax, zmin, zmax };
}

function padBounds(b, padFrac = 0.08) {
  const nb = normalizeBounds(b);
  if (!nb) return null;

  const sx = Math.max(1e-6, nb.xmax - nb.xmin);
  const sy = Math.max(1e-6, nb.ymax - nb.ymin);
  const sz = Math.max(1e-6, nb.zmax - nb.zmin);
  const span = Math.max(sx, sy, sz);

  const pad = Math.max(1e-3, span * padFrac);
  return {
    xmin: nb.xmin - pad,
    xmax: nb.xmax + pad,
    ymin: nb.ymin - pad,
    ymax: nb.ymax + pad,
    zmin: nb.zmin - pad,
    zmax: nb.zmax + pad,
  };
}

/**
 * Scene 컴포넌트(반드시 Canvas 내부)
 * - Alt+클릭: 표면 스냅 노드 생성
 * - 우클릭: 노드 삭제 요청 전달
 * - Alt+드래그: 박스 선택(옵션 구현)
 * - 선택 후 드래그: 그룹 이동(A안: 카메라 평행 평면)
 * - Alt 편집 중 OrbitControls disable
 * - 입력은 R3F 오브젝트(onPointer...)로 처리(요구사항 5)
 */
function Surface3DScene({
  expr,
  f,
  meshData,
  combinedBounds,
  gridMode,
  gridStep,
  minorDiv,
  markers,
  markerRender,
  editMode,
  degree,
  onPointAdd,
  onPointRemove,
  onMarkersChange,
  onCommit,
  setSelectRectUI,
  surfaceObjRef,
}) {
  const controlsRef = useRef(null);
  //const surfaceRef = useRef(null);
  const planeRef = useRef(null);

  const { camera, gl, size } = useThree();

  const [altPressed, setAltPressed] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const selectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const selectionCurRef = useRef({ x: 0, y: 0 });
  const selectionUnionRef = useRef(false);
  const altClickCandidateRef = useRef({ active: false, x: 0, y: 0 });

  const dragGroupRef = useRef({
    active: false,
    pointerId: null,
    plane: new THREE.Plane(),
    startHit: new THREE.Vector3(),
    startById: new Map(), // id -> {x,y,z}
    ids: [],
  });

  // Alt 키 상태 추적(카메라 disable)
  useEffect(() => {
    const onDown = (e) => {
      if (e.key === "Alt") setAltPressed(true);
    };
    const onUp = (e) => {
      if (e.key === "Alt") setAltPressed(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // OrbitControls enabled 제어
  useEffect(() => {
    const editingHold =
      Boolean(editMode) &&
      (altPressed || selectingRef.current || dragGroupRef.current.active);
    if (controlsRef.current) controlsRef.current.enabled = !editingHold;
  }, [altPressed, editMode]);

  // bounds 기반 interaction plane 구성(표면 아래에 깔아서 surface 이벤트를 가로채지 않게)
  const planeConfig = useMemo(() => {
    const b = combinedBounds ?? meshData?.bounds ?? null;
    const pb = padBounds(b, 0.12);
    if (!pb) return { cx: 0, cz: 0, y: -10, size: 200 };
    const cx = (pb.xmin + pb.xmax) / 2;
    const cz = (pb.zmin + pb.zmax) / 2;
    const y = pb.ymin - Math.max(0.5, (pb.ymax - pb.ymin) * 0.15); // 표면보다 충분히 아래
    const spanX = pb.xmax - pb.xmin;
    const spanZ = pb.zmax - pb.zmin;
    const s = Math.max(40, Math.max(spanX, spanZ) * 3);
    return { cx, cz, y, size: s };
  }, [combinedBounds, meshData?.bounds]);

  const getLocalXY = useCallback(
    (nativeEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      return {
        x: clamp01((nativeEvent.clientX - rect.left) / rect.width) * rect.width,
        y:
          clamp01((nativeEvent.clientY - rect.top) / rect.height) * rect.height,
      };
    },
    [gl]
  );

  const projectWorldToScreen = useCallback(
    (v3) => {
      const v = v3.clone().project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      return { x, y };
    },
    [camera, size.width, size.height]
  );

  const finalizeSelection = useCallback(() => {
    if (!selectingRef.current) return;

    const x0 = Math.min(selectionStartRef.current.x, selectionCurRef.current.x);
    const x1 = Math.max(selectionStartRef.current.x, selectionCurRef.current.x);
    const y0 = Math.min(selectionStartRef.current.y, selectionCurRef.current.y);
    const y1 = Math.max(selectionStartRef.current.y, selectionCurRef.current.y);

    const hits = new Set();
    for (const m of markerRender) {
      const w = new THREE.Vector3(m.worldX, m.worldY, m.worldZ);
      const sxy = projectWorldToScreen(w);
      if (sxy.x >= x0 && sxy.x <= x1 && sxy.y >= y0 && sxy.y <= y1)
        hits.add(m.id);
    }

    setSelectedIds((prev) => {
      if (selectionUnionRef.current) {
        const next = new Set(prev);
        for (const id of hits) next.add(id);
        return next;
      }
      return hits;
    });

    selectingRef.current = false;
    setSelectRectUI(null);
  }, [markerRender, projectWorldToScreen, setSelectRectUI]);

  const addPointByRaySnap = useCallback(
    (eRay) => {
      if (!editMode) return;

      // 1) surface raycast
      const surf = surfaceObjRef.current;
      if (surf) {
        const raycaster = new THREE.Raycaster();
        raycaster.ray.copy(eRay);
        const hits = raycaster.intersectObject(surf, true);
        if (hits && hits.length) {
          const p = hits[0].point;
          const x = p.x;
          const y = p.z; // domain y
          const z = p.y; // height

          if ([x, y, z].every(Number.isFinite)) {
            const pt = {
              id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              x,
              y,
              z,
            };
            console.log(
              "[Surface3D] add point requested (alt+click, surface hit)",
              pt
            );
            onPointAdd?.(pt);
            return true;
          }
        }
      }

      // 2) fallback: y=0 plane로 투영 후, 가장 가까운 표면 샘플 포인트로 스냅(요구사항 2)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
      const hit = new THREE.Vector3();
      const ok = eRay.intersectPlane(plane, hit);
      if (!ok) return false;

      const xmin = Number(meshData?.domain?.xmin);
      const xmax = Number(meshData?.domain?.xmax);
      const ymin = Number(meshData?.domain?.ymin);
      const ymax = Number(meshData?.domain?.ymax);
      const gx = Number(meshData?.domain?.gx);
      const gy = Number(meshData?.domain?.gy);
      const dx = Number(meshData?.domain?.dx);
      const dy = Number(meshData?.domain?.dy);

      if (![xmin, xmax, ymin, ymax, gx, gy, dx, dy].every(Number.isFinite))
        return false;

      const tx = (hit.x - xmin) / (xmax - xmin);
      const ty = (hit.z - ymin) / (ymax - ymin);

      const i = Math.max(0, Math.min(gx - 1, Math.round(tx * (gx - 1))));
      const j = Math.max(0, Math.min(gy - 1, Math.round(ty * (gy - 1))));

      const x = xmin + i * dx;
      const y = ymin + j * dy;
      const z = f(x, y);

      if (![x, y, z].every(Number.isFinite)) return false;

      const pt = {
        id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        x,
        y,
        z,
      };
      console.log(
        "[Surface3D] add point requested (alt+click, fallback snap)",
        pt
      );
      onPointAdd?.(pt);
      return true;
    },
    [editMode, f, meshData?.domain, meshData, onPointAdd]
  );

  const handlePlanePointerDown = useCallback(
    (e) => {
      if (!editMode) return;
      if (!e.altKey) return;
      if (e.button !== 0) return;

      // Alt+드래그: 박스 선택, Alt+클릭: 포인트 생성(드래그 여부로 분기)
      e.stopPropagation();
      try {
        e.nativeEvent.preventDefault?.();
      } catch {}

      // camera stop
      if (controlsRef.current) controlsRef.current.enabled = false;

      const { x, y } = getLocalXY(e.nativeEvent);
      selectionStartRef.current = { x, y };
      selectionCurRef.current = { x, y };
      selectionUnionRef.current = Boolean(e.ctrlKey || e.metaKey);

      selectingRef.current = false; // 아직 클릭 후보
      altClickCandidateRef.current = { active: true, x, y };

      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}

      setSelectRectUI({ x0: x, y0: y, x1: x, y1: y });
    },
    [editMode, getLocalXY, setSelectRectUI]
  );

  const handlePlanePointerMove = useCallback(
    (e) => {
      if (!editMode) return;
      if (!e.altKey) return;
      if (!altClickCandidateRef.current.active && !selectingRef.current) return;

      e.stopPropagation();

      const { x, y } = getLocalXY(e.nativeEvent);
      selectionCurRef.current = { x, y };

      const dx = x - altClickCandidateRef.current.x;
      const dy = y - altClickCandidateRef.current.y;
      const dist2 = dx * dx + dy * dy;

      // 4px threshold 이상이면 드래그 선택으로 간주
      if (!selectingRef.current && dist2 > 16) {
        selectingRef.current = true;
        altClickCandidateRef.current.active = false; // 클릭 후보 해제 -> 선택 모드 확정
      }

      // 드래그 선택 모드 UI 업데이트
      if (selectingRef.current) {
        setSelectRectUI({
          x0: selectionStartRef.current.x,
          y0: selectionStartRef.current.y,
          x1: x,
          y1: y,
        });
      }
    },
    [editMode, getLocalXY, setSelectRectUI]
  );

  const handlePlanePointerUp = useCallback(
    (e) => {
      if (!editMode) return;
      if (e.button !== 0) return;

      e.stopPropagation();
      try {
        e.nativeEvent.preventDefault?.();
      } catch {}

      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {}

      // 드래그 선택이었으면 selection finalize
      if (selectingRef.current) {
        finalizeSelection();
      } else {
        // 드래그가 아니었으면 Alt+클릭: 노드 생성 시도
        if (e.altKey) {
          addPointByRaySnap(e.ray);
        }
        setSelectRectUI(null);
      }

      altClickCandidateRef.current.active = false;
      selectingRef.current = false;

      // camera resume
      if (controlsRef.current) controlsRef.current.enabled = true;
    },
    [editMode, finalizeSelection, addPointByRaySnap, setSelectRectUI]
  );

  const toggleSelectOne = useCallback((id, union = false) => {
    setSelectedIds((prev) => {
      const next = new Set(union ? prev : []);
      if (union) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      next.add(id);
      return next;
    });
  }, []);

  const beginGroupDrag = useCallback(
    (e, markerId) => {
      if (!editMode) return;
      if (e.button !== 0) return;
      if (e.altKey) return; // Alt는 박스 선택/추가에 사용(충돌 방지)

      e.stopPropagation();
      try {
        e.nativeEvent.preventDefault?.();
      } catch {}

      // 선택 집합 준비
      setSelectedIds((prev) => {
        const has = prev.has(markerId);
        const next = has ? prev : new Set([markerId]);
        return next;
      });

      // controls disable
      if (controlsRef.current) controlsRef.current.enabled = false;

      // 현재 선택 ids 스냅샷
      const ids = Array.from(
        selectedIds.has(markerId) ? selectedIds : new Set([markerId])
      );
      const startById = new Map();
      for (const m of markers) {
        if (!m) continue;
        const id = m.id ?? null;
        if (!id || !ids.includes(id)) continue;
        startById.set(id, { x: Number(m.x), y: Number(m.y), z: Number(m.z) });
      }

      // 카메라 평행 드래그 평면(A안): normal = camera forward, point = marker world position
      const mr = markerRender.find((mm) => mm.id === markerId);
      const pivot = mr
        ? new THREE.Vector3(mr.worldX, mr.worldY, mr.worldZ)
        : new THREE.Vector3(0, 0, 0);

      const n = new THREE.Vector3();
      camera.getWorldDirection(n).normalize();

      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, pivot);

      const startHit = new THREE.Vector3();
      const ok = e.ray.intersectPlane(plane, startHit);
      if (!ok) return;

      dragGroupRef.current.active = true;
      dragGroupRef.current.pointerId = e.pointerId;
      dragGroupRef.current.plane.copy(plane);
      dragGroupRef.current.startHit.copy(startHit);
      dragGroupRef.current.startById = startById;
      dragGroupRef.current.ids = ids;

      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
    },
    [camera, editMode, markerRender, markers, selectedIds]
  );

  const moveGroupDrag = useCallback(
    (e) => {
      if (!dragGroupRef.current.active) return;
      e.stopPropagation();

      const plane = dragGroupRef.current.plane;
      const hit = new THREE.Vector3();
      const ok = e.ray.intersectPlane(plane, hit);
      if (!ok) return;

      const delta = hit.clone().sub(dragGroupRef.current.startHit);
      const ids = dragGroupRef.current.ids;

      // 마커는 domain 좌표계: worldX = x, worldZ = y
      const next = (Array.isArray(markers) ? markers : []).map((m) => ({
        ...m,
      }));
      let touched = 0;

      for (let i = 0; i < next.length; i++) {
        const id = next[i]?.id;
        if (!id || !ids.includes(id)) continue;
        const start = dragGroupRef.current.startById.get(id);
        if (!start) continue;

        const nx = start.x + delta.x;
        const ny = start.y + delta.z;

        if (Number.isFinite(nx)) next[i].x = nx;
        if (Number.isFinite(ny)) next[i].y = ny;
        // z는 “제약점”으로 유지(기존 Surface3D 규칙 유지)
        touched++;
      }

      if (touched > 0) {
        onMarkersChange?.(next, { fit: false });
      }
    },
    [markers, onMarkersChange]
  );

  const endGroupDrag = useCallback(
    (e) => {
      if (!dragGroupRef.current.active) return;

      e.stopPropagation();
      try {
        e.nativeEvent.preventDefault?.();
      } catch {}

      dragGroupRef.current.active = false;

      try {
        e.target.releasePointerCapture(dragGroupRef.current.pointerId);
      } catch {}

      if (controlsRef.current) controlsRef.current.enabled = true;

      // 드래그 종료 시에만 commit/fit
      onCommit?.();
    },
    [onCommit]
  );

  const handleMarkerContextMenu = useCallback(
    (e, markerId, index) => {
      e.stopPropagation();
      try {
        e.nativeEvent.preventDefault?.();
      } catch {}

      console.log("[Surface3D] remove point requested (right click)", {
        id: markerId,
        index,
      });
      onPointRemove?.({ id: markerId, index });
    },
    [onPointRemove]
  );

  const axesSize = useMemo(() => {
    const b = combinedBounds ?? meshData?.bounds ?? null;
    if (!b) return 8;
    const sx = Math.abs(b.xmax - b.xmin);
    const sy = Math.abs(b.ymax - b.ymin);
    const sz = Math.abs(b.zmax - b.zmin);
    return Math.max(4, Math.min(40, Math.max(sx, sy, sz)));
  }, [combinedBounds, meshData?.bounds]);

  const gridKey = useMemo(() => {
    const b = combinedBounds ?? meshData?.bounds ?? null;
    if (!b) return "grid_null";
    return [
      roundKey(b.xmin),
      roundKey(b.xmax),
      roundKey(b.ymin),
      roundKey(b.ymax),
      roundKey(b.zmin),
      roundKey(b.zmax),
      String(gridMode),
      String(gridStep),
      String(minorDiv),
    ].join("|");
  }, [combinedBounds, meshData?.bounds, gridMode, gridStep, minorDiv]);

  // HUD에서 보이는 z는 “현재 표면 위”로 표기(UX: 노드가 표면에 붙어 보이도록)
  const markerRenderWithSurfaceSnap = useMemo(() => {
    const b = combinedBounds ?? meshData?.bounds ?? null;
    const span = b
      ? Math.max(
          1e-6,
          Math.max(b.xmax - b.xmin, b.ymax - b.ymin, b.zmax - b.zmin)
        )
      : 10;
    const zOffset = Math.max(0.01, span * 0.003); // 허용되는 “약간 떠 보이는” 오프셋

    return markerRender.map((m) => {
      const zSurf = f(m.x, m.y);
      const zShown = Number.isFinite(zSurf) ? zSurf : m.z;
      return {
        ...m,
        worldY: zShown + zOffset,
        label: `(${m.x.toFixed(2)}, ${m.y.toFixed(2)}, ${zShown.toFixed(2)})`,
      };
    });
  }, [markerRender, f, combinedBounds, meshData?.bounds]);

  // ✅ Auto focus to AI-generated markers (when _focusNonce changes)
  const lastFocusNonceRef = useRef(null);
  useEffect(() => {
    const nonce = getFocusNonceFromMarkers(markerRenderWithSurfaceSnap);
    if (!nonce) return;
    if (lastFocusNonceRef.current === nonce) return;
    lastFocusNonceRef.current = nonce;

    const pts = [];
    for (const m of markerRenderWithSurfaceSnap || []) {
      const x = Number(m?.worldX);
      const y = Number(m?.worldY);
      const z = Number(m?.worldZ);
      if ([x, y, z].every(Number.isFinite))
        pts.push(new THREE.Vector3(x, y, z));
    }
    if (!pts.length) return;

    const box = new THREE.Box3().setFromPoints(pts);
    fitCameraToBox({
      camera,
      controls: controlsRef.current,
      box,
      padding: 1.55,
    });
  }, [markerRenderWithSurfaceSnap, camera]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 8]} intensity={0.9} />

      <axesHelper args={[axesSize]} />

      {/* bounds 변경 시 key로 remount -> geometry 업데이트 불발 방지 */}
      <CubeLatticeGrid
        key={gridKey}
        bounds={combinedBounds ?? meshData?.bounds}
        gridMode={gridMode}
        gridStep={gridStep}
        minorDiv={minorDiv}
      />

      {/* Surface mesh */}
      <mesh ref={surfaceObjRef} geometry={meshData.geometry}>
        <meshStandardMaterial
          vertexColors
          roughness={0.6}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Interaction plane (Alt 편집 입력 전용; 표면 아래에 위치) */}
      <mesh
        ref={planeRef}
        position={[planeConfig.cx, planeConfig.y, planeConfig.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onPointerDown={handlePlanePointerDown}
        onPointerMove={handlePlanePointerMove}
        onPointerUp={handlePlanePointerUp}
      >
        <planeGeometry args={[planeConfig.size, planeConfig.size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Nodes */}
      {markerRenderWithSurfaceSnap.map((m, idx) => {
        const isSelected = selectedIds.has(m.id);
        const span =
          combinedBounds ?? meshData?.bounds
            ? Math.max(
                1e-6,
                Math.max(
                  (combinedBounds ?? meshData?.bounds).xmax -
                    (combinedBounds ?? meshData?.bounds).xmin,
                  (combinedBounds ?? meshData?.bounds).ymax -
                    (combinedBounds ?? meshData?.bounds).ymin,
                  (combinedBounds ?? meshData?.bounds).zmax -
                    (combinedBounds ?? meshData?.bounds).zmin
                )
              )
            : 10;

        const rBase = Math.max(0.06, Math.min(0.16, span * 0.015));
        const r = isSelected ? rBase * 1.25 : rBase;

        const fontBase = Math.max(0.18, Math.min(0.32, span * 0.02));
        const font = isSelected ? fontBase * 1.05 : fontBase;

        return (
          <group key={m.id} position={[m.worldX, m.worldY, m.worldZ]}>
            <mesh
              onPointerDown={(e) => {
                // Alt+클릭 on marker: 선택 토글(Union: Ctrl/Cmd)
                if (editMode && e.altKey && e.button === 0) {
                  e.stopPropagation();
                  try {
                    e.nativeEvent.preventDefault?.();
                  } catch {}
                  toggleSelectOne(m.id, Boolean(e.ctrlKey || e.metaKey));
                  return;
                }
                // 일반 드래그: 그룹 이동
                beginGroupDrag(e, m.id);
              }}
              onPointerMove={moveGroupDrag}
              onPointerUp={endGroupDrag}
              onContextMenu={(e) => handleMarkerContextMenu(e, m.id, idx)}
            >
              <sphereGeometry args={[r, 24, 24]} />
              <meshStandardMaterial
                color={
                  isSelected ? "#60a5fa" : editMode ? "#22c55e" : "#ffc107"
                }
              />
            </mesh>

            <Text
              position={[r * 1.4, r * 1.2, 0]}
              fontSize={font}
              color="#ffffff"
              anchorX="left"
              anchorY="bottom"
              outlineWidth={0.04}
              outlineColor="black"
            >
              {m.label}
            </Text>
          </group>
        );
      })}

      {/* OrbitControls (Alt 편집/드래그 중 disable은 effect로 제어) */}
      <OrbitControls ref={controlsRef} makeDefault />

      <OrientationOverlay controlsRef={controlsRef} />

      {/* HUD는 캔버스 외부에서 렌더(상위에서) */}
    </>
  );
}

export default function Surface3DCanvas({
  expr,
  // (optional) baseExpr: base surface bounds까지 고려하고 싶을 때(요구사항 1의 "(있다면)" 대응)
  baseExpr = null,

  xMin,
  xMax,
  yMin,
  yMax,
  nx,
  ny,
  markers = [],

  editMode = true,
  degree = 2,

  // ✅ GraphCanvas/Curve3DCanvas 스타일 브릿지(권장)
  onPointAdd,
  onPointRemove,

  // ✅ 기존 호환(최소 변경)
  onAddMarker,
  onMarkersChange,

  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
}) {
  const f = useMemo(() => makeScalarFn(expr), [expr]);
  const baseF = useMemo(() => makeScalarFn(baseExpr), [baseExpr]);
  const surfaceObjRef = useRef(null);
  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportOBJ = useCallback(() => {
    const surf = surfaceObjRef.current;
    if (!surf) return;

    // 월드 변환 반영
    surf.updateMatrixWorld(true);

    // OBJ Export (형상 위주)
    const exporter = new OBJExporter();
    const objText = exporter.parse(surf);

    downloadText("graphmind-surface.obj", objText);
  }, []);
  // 선택 박스 UI(HTML overlay)
  const [selectRectUI, setSelectRectUI] = useState(null);
  // ✅ 드래그 중 최신 markers 스냅샷 유지(최종 fit 시 stale markers 문제 방지)
  const latestMarkersRef = useRef(Array.isArray(markers) ? markers : []);
  useEffect(() => {
    latestMarkersRef.current = Array.isArray(markers) ? markers : [];
  }, [markers]);

  const emitMarkersChange = useCallback(
    (nextMarkers, opts) => {
      latestMarkersRef.current = Array.isArray(nextMarkers) ? nextMarkers : [];
      onMarkersChange?.(nextMarkers, opts);
    },
    [onMarkersChange]
  );

  const emitPointAdd = useCallback(
    (pt) => {
      // alt+click 생성 요청
      if (typeof onPointAdd === "function") onPointAdd(pt);
      else onAddMarker?.(pt);
    },
    [onPointAdd, onAddMarker]
  );

  const emitPointRemove = useCallback(
    (payload) => {
      onPointRemove?.(payload);
    },
    [onPointRemove]
  );

  // surface mesh 생성
  const meshData = useMemo(() => {
    const xmin = Number(xMin);
    const xmax = Number(xMax);
    const ymin = Number(yMin);
    const ymax = Number(yMax);
    const gx = Math.max(8, Number(nx) || 60);
    const gy = Math.max(8, Number(ny) || 60);

    if (![xmin, xmax, ymin, ymax].every((v) => Number.isFinite(v))) {
      const g = new THREE.BufferGeometry();
      return { geometry: g, zMin: -5, zMax: 5, bounds: null, domain: null };
    }

    const positions = new Float32Array(gx * gy * 3);
    const colors = new Float32Array(gx * gy * 3);
    const indices = [];

    const dx = (xmax - xmin) / (gx - 1);
    const dy = (ymax - ymin) / (gy - 1);

    let zMinV = Infinity;
    let zMaxV = -Infinity;

    // base surface까지 bounds에 포함(요구사항 1)
    let zMinBase = Infinity;
    let zMaxBase = -Infinity;

    for (let j = 0; j < gy; j++) {
      const y = ymin + dy * j;
      for (let i = 0; i < gx; i++) {
        const x = xmin + dx * i;
        const z = f(x, y);

        const idx = j * gx + i;
        const o = idx * 3;

        // world = (x, z, y)
        positions[o + 0] = x;
        positions[o + 1] = z;
        positions[o + 2] = y;

        if (z < zMinV) zMinV = z;
        if (z > zMaxV) zMaxV = z;

        if (baseExpr) {
          const zb = baseF(x, y);
          if (zb < zMinBase) zMinBase = zb;
          if (zb > zMaxBase) zMaxBase = zb;
        }
      }
    }

    if (!Number.isFinite(zMinV) || !Number.isFinite(zMaxV)) {
      zMinV = -5;
      zMaxV = 5;
    }
    if (Math.abs(zMaxV - zMinV) < 1e-6) {
      zMinV -= 0.5;
      zMaxV += 0.5;
    }

    // bounds에 base surface까지 포함
    if (baseExpr && Number.isFinite(zMinBase) && Number.isFinite(zMaxBase)) {
      zMinV = Math.min(zMinV, zMinBase);
      zMaxV = Math.max(zMaxV, zMaxBase);
      if (Math.abs(zMaxV - zMinV) < 1e-6) {
        zMinV -= 0.5;
        zMaxV += 0.5;
      }
    }
    const span = zMaxV - zMinV || 1;
    const c = new THREE.Color();
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const idx = j * gx + i;
        const o = idx * 3;
        const z = positions[o + 1];
        const t = (z - zMinV) / span; // 0~1
        c.setHSL(0.7 - 0.5 * t, 0.8, 0.5 + 0.15 * t);
        colors[o + 0] = c.r;
        colors[o + 1] = c.g;
        colors[o + 2] = c.b;
      }
    }

    for (let j = 0; j < gy - 1; j++) {
      for (let i = 0; i < gx - 1; i++) {
        const a = j * gx + i;
        const b = j * gx + (i + 1);
        const c0 = (j + 1) * gx + i;
        const d = (j + 1) * gx + (i + 1);
        indices.push(a, c0, b, b, c0, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const bounds = {
      xmin: Math.min(xmin, xmax),
      xmax: Math.max(xmin, xmax),
      ymin: zMinV, // world.y bounds = z-range
      ymax: zMaxV,
      zmin: Math.min(ymin, ymax), // world.z bounds = input y-range
      zmax: Math.max(ymin, ymax),
    };

    const domain = {
      xmin: Math.min(xmin, xmax),
      xmax: Math.max(xmin, xmax),
      ymin: Math.min(ymin, ymax),
      ymax: Math.max(ymin, ymax),
      gx,
      gy,
      dx: (xmax - xmin) / (gx - 1),
      dy: (ymax - ymin) / (gy - 1),
    };

    return { geometry, zMin: zMinV, zMax: zMaxV, bounds, domain };
  }, [xMin, xMax, yMin, yMax, nx, ny, f, baseExpr, baseF]);

  useEffect(() => {
    return () => {
      try {
        meshData.geometry.dispose();
      } catch {}
    };
  }, [meshData]);

  // marker 렌더용 전처리 (domain -> world)
  const markerRender = useMemo(() => {
    const b = meshData.bounds;
    const span = b
      ? Math.max(
          1e-6,
          Math.max(b.xmax - b.xmin, b.ymax - b.ymin, b.zmax - b.zmin)
        )
      : 10;
    const r = Math.max(0.06, Math.min(0.16, span * 0.015));
    const font = Math.max(0.18, Math.min(0.32, span * 0.02));

    return (Array.isArray(markers) ? markers : [])
      .map((m, idx) => {
        const x = Number(m?.x);
        const y = Number(m?.y);
        const z = Number(m?.z);
        if (![x, y, z].every(Number.isFinite)) return null;

        return {
          id: m?.id ?? idx,
          x,
          y,
          z,
          worldX: x,
          worldY: z,
          worldZ: y,
          r,
          font,
          label: `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
        };
      })
      .filter(Boolean);
  }, [markers, meshData.bounds]);

  // ✅ bounds 자동 재계산(요구사항 1)
  // - surface 샘플 bounds + (base surface bounds는 meshData에서 반영) + markers(표면 스냅 표시 z까지 고려)
  const combinedBounds = useMemo(() => {
    const b = meshData.bounds;
    if (!b) return null;

    let xmin = b.xmin,
      xmax = b.xmax;
    let ymin = b.ymin,
      ymax = b.ymax;
    let zmin = b.zmin,
      zmax = b.zmax;

    // markers 포함: 표시 z는 f(x,y) 우선(노드가 표면에 붙어 보이므로)
    for (const m of markerRender) {
      const zx = Number(m?.x);
      const zy = Number(m?.y);
      if (![zx, zy].every(Number.isFinite)) continue;

      const zSurf = f(zx, zy);
      const yWorld = Number.isFinite(zSurf) ? zSurf : Number(m?.z);

      // world: (x, yWorld, y(domain)->z-axis)
      xmin = Math.min(xmin, zx);
      xmax = Math.max(xmax, zx);

      ymin = Math.min(ymin, yWorld);
      ymax = Math.max(ymax, yWorld);

      zmin = Math.min(zmin, zy);
      zmax = Math.max(zmax, zy);
    }

    const padded = padBounds({ xmin, xmax, ymin, ymax, zmin, zmax }, 0.08);
    return padded ?? { xmin, xmax, ymin, ymax, zmin, zmax };
  }, [meshData.bounds, markerRender, f]);

  const commitFit = useCallback(() => {
    // 드래그 끝에서만 자동 fit(최종 1회)
    const latest =
      latestMarkersRef.current ?? (Array.isArray(markers) ? markers : []);
    emitMarkersChange(latest, { fit: true });
  }, [emitMarkersChange, markers]);

  // HUD용
  const nodeCount = Array.isArray(markers) ? markers.length : 0;

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
      onContextMenu={(e) => {
        // 브라우저 기본 context menu 방지(요구사항 3)
        e.preventDefault();
      }}
    >
      <Canvas
        camera={{ position: [6, 6, 6], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0)
        }
      >
        <Surface3DScene
          expr={expr}
          f={f}
          meshData={meshData}
          combinedBounds={combinedBounds}
          gridMode={gridMode}
          gridStep={gridStep}
          minorDiv={minorDiv}
          markers={Array.isArray(markers) ? markers : []}
          markerRender={markerRender}
          editMode={editMode}
          degree={degree}
          onPointAdd={emitPointAdd}
          onPointRemove={emitPointRemove}
          onMarkersChange={emitMarkersChange}
          onCommit={commitFit}
          setSelectRectUI={setSelectRectUI}
          surfaceObjRef={surfaceObjRef}
        />
      </Canvas>
      <button
        onClick={handleExportOBJ}
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 20,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.18)",
          padding: "6px 10px",
          borderRadius: 10,
          cursor: "pointer",
          fontSize: 12,
        }}
        title="Export surface as OBJ"
      >
        Export OBJ
      </button>

      {/* Selection Box UI (옵션) */}
      {selectRectUI && (
        <div
          style={{
            position: "absolute",
            left: Math.min(selectRectUI.x0, selectRectUI.x1),
            top: Math.min(selectRectUI.y0, selectRectUI.y1),
            width: Math.abs(selectRectUI.x1 - selectRectUI.x0),
            height: Math.abs(selectRectUI.y1 - selectRectUI.y0),
            border: "1px solid rgba(96,165,250,0.9)",
            background: "rgba(96,165,250,0.08)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {/* HUD */}
      {/* <div
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          padding: "6px 8px",
          borderRadius: 10,
          fontSize: 11,
          lineHeight: 1.35,
          maxWidth: 360,
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          Surface3D (Alt Editing)
        </div>
        <div style={{ opacity: 0.9 }}>
          Alt+Click: Add point (surface snap) · RightClick: Remove point
          <br />
          Alt+Drag: Box select · Drag selected: Group move
          <br />
          Ctrl/Cmd+Alt+Drag: Union select
        </div>
        <div style={{ marginTop: 6 }}>z = {expr}</div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          points: {nodeCount} · degree: {degree}
          <br />
          grid: {gridMode}, step: {gridStep}, minorDiv: {minorDiv}
        </div>
      </div> */}
    </div>
  );
}
