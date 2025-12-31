// src/ui/Array3DCanvas.jsx
import React, { useMemo, useLayoutEffect, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import OrientationOverlay from "./OrientationOverlay";
import * as THREE from "three";

// ---- utils (기존 Array3DView.jsx에서 분리) ----
function normalizeOrder(order) {
  const ord = String(order || "zyx").toLowerCase();
  return /^[xyz]{3}$/.test(ord) ? ord : "zyx";
}

function pickDims(data, order = "zyx") {
  const a0 = Array.isArray(data) ? data.length : 0;
  const a1 = Array.isArray(data?.[0]) ? data[0].length : 0;
  const a2 = Array.isArray(data?.[0]?.[0]) ? data[0][0].length : 0;

  const ord = normalizeOrder(order);
  const dims = { x: 0, y: 0, z: 0 };
  dims[ord[0]] = a0;
  dims[ord[1]] = a1;
  dims[ord[2]] = a2;

  return { X: dims.x, Y: dims.y, Z: dims.z, ord, a0, a1, a2 };
}

function makeGetter(data, ord) {
  const idxOf = { x: -1, y: -1, z: -1 };
  idxOf[ord[0]] = 0;
  idxOf[ord[1]] = 1;
  idxOf[ord[2]] = 2;

  return (x, y, z) => {
    const a = [0, 0, 0];
    a[idxOf.x] = x;
    a[idxOf.y] = y;
    a[idxOf.z] = z;

    const v = data?.[a[0]]?.[a[1]]?.[a[2]];
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
}

// ---- Camera Controller (Graph/Curve/Surface에서 쓰던 방식과 유사) ----
function CameraController({
  target = [0, 0, 0],
  fitKey, // data 변경 시 카메라 자동 fit 트리거
  defaultPosition = [6, 5, 8],
  minDistance = 0.5,
  maxDistance = 500,
  enablePan = true,
  enableRotate = true,
  enableZoom = true,
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);

  // 초기 셋업
  useEffect(() => {
    camera.position.set(...defaultPosition);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fitKey가 바뀌면 카메라/타겟 리셋 + controls sync
  useEffect(() => {
    camera.position.set(...defaultPosition);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(...target);
      controlsRef.current.update();
    }
  }, [fitKey, defaultPosition, target, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      target={target}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.8}
      zoomSpeed={0.9}
      panSpeed={0.8}
      minDistance={minDistance}
      maxDistance={maxDistance}
      enablePan={enablePan}
      enableRotate={enableRotate}
      enableZoom={enableZoom}
      makeDefault
    />
  );
}

// ---- Voxels ----
function Voxels({ data, threshold = 0, axisOrder = "zyx" }) {
  const { X, Y, Z, ord } = useMemo(
    () => pickDims(data, axisOrder),
    [data, axisOrder]
  );
  const getV = useMemo(() => makeGetter(data, ord), [data, ord]);

  const positions = useMemo(() => {
    if (!Array.isArray(data) || X <= 0 || Y <= 0 || Z <= 0) return [];
    const pos = [];
    for (let z = 0; z < Z; z++) {
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          const v = getV(x, y, z);
          if (v > threshold) pos.push([x, y, z]);
        }
      }
    }
    return pos;
  }, [data, X, Y, Z, threshold, getV]);

  const center = useMemo(
    () => [(X - 1) / 2, (Y - 1) / 2, (Z - 1) / 2],
    [X, Y, Z]
  );

  const meshRef = useRef(null);

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;

    // instances 수 갱신
    m.count = positions.length;

    // 인스턴스 매트릭스 업데이트
    const temp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(0.95, 0.95, 0.95);

    // 성능: dynamic usage 권장
    if (m.instanceMatrix) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      temp.compose(new THREE.Vector3(x, y, z), q, s);
      m.setMatrixAt(i, temp);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group position={[-center[0], -center[1], -center[2]]}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(1, positions.length)]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}

// ---- Canvas Wrapper ----
export default function Array3DCanvas({
  data,
  threshold = 0,
  axisOrder = "zyx",
  // 카메라/컨트롤 옵션 (필요하면 Toolbar에서 제어 가능)
  enablePan = true,
  enableRotate = true,
  enableZoom = true,
}) {
  const { X, Y, Z } = useMemo(
    () => pickDims(data, axisOrder),
    [data, axisOrder]
  );
  const maxDim = Math.max(1, X, Y, Z);

  // 기존 로직 유지: 데이터 크기에 따라 카메라 기본 위치 산정
  const defaultPosition = useMemo(
    () => [maxDim * 0.9, maxDim * 0.8, maxDim * 1.2],
    [maxDim]
  );

  // 그리드/축은 원점 기준. Voxels가 center shift되어 있으므로 바닥 y는 -centerY - 0.5
  const gridY = useMemo(() => -((Y - 1) / 2) - 0.5, [Y]);
  const gridSize = useMemo(() => Math.max(10, maxDim * 2 + 2), [maxDim]);
  const axesLen = useMemo(() => Math.max(5, maxDim * 1.2), [maxDim]);

  // data 변화 시 camera fit 트리거 (컨트롤러에서 fitKey 감지)
  const fitKey = useMemo(
    () => `${X}x${Y}x${Z}-${axisOrder}`,
    [X, Y, Z, axisOrder]
  );

  return (
    <Canvas camera={{ position: defaultPosition, fov: 55 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 12, 8]} intensity={0.9} />

      <axesHelper args={[axesLen]} />
      <gridHelper args={[gridSize, gridSize]} position={[0, gridY, 0]} />

      <Voxels data={data} threshold={threshold} axisOrder={axisOrder} />

      <CameraController
        target={[0, 0, 0]}
        fitKey={fitKey}
        defaultPosition={defaultPosition}
        minDistance={Math.max(1, maxDim * 0.25)}
        maxDistance={Math.max(50, maxDim * 20)}
        enablePan={enablePan}
        enableRotate={enableRotate}
        enableZoom={enableZoom}
      />
      <OrientationOverlay
        gizmoAlignment="bottom-right"
        gizmoMargin={[72, 72]}
      />
    </Canvas>
  );
}
