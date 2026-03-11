// src/ui/Array3DCanvas.jsx
import React, { useMemo, useLayoutEffect, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls, Text } from "@react-three/drei";
import OrientationOverlay from "./OrientationOverlay";
import * as THREE from "three";

export function normalizeOrder(order) {
  const ord = String(order || "zyx").toLowerCase();
  return /^[xyz]{3}$/.test(ord) ? ord : "zyx";
}

export function pickDims(data, order = "zyx") {
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

export function makeGetter(data, ord) {
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

export function collectActivePositions(data, threshold = 0, axisOrder = "zyx") {
  const { X, Y, Z, ord } = pickDims(data, axisOrder);
  const getV = makeGetter(data, ord);
  const positions = [];

  if (!Array.isArray(data) || X <= 0 || Y <= 0 || Z <= 0) return positions;

  for (let z = 0; z < Z; z++) {
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        const v = getV(x, y, z);
        if (v > threshold) positions.push([x, y, z]);
      }
    }
  }

  return positions;
}

export function buildVoxelInstances(
  data,
  threshold = 0,
  axisOrder = "zyx",
  renderMode = "binary"
) {
  const { X, Y, Z, ord } = pickDims(data, axisOrder);
  const getV = makeGetter(data, ord);
  const items = [];

  if (!Array.isArray(data) || X <= 0 || Y <= 0 || Z <= 0) return items;

  for (let z = 0; z < Z; z++) {
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        const value = getV(x, y, z);
        if (value > threshold) {
          items.push({
            position: [x, y, z],
            value,
            label: String(value),
            scale: 0.95,
            color: renderMode === "value" ? "#d6dbe3" : "#f1f3f6",
          });
        }
      }
    }
  }

  return items;
}

function CameraController({
  target = [0, 0, 0],
  fitKey,
  defaultPosition = [6, 5, 8],
  minDistance = 0.5,
  maxDistance = 500,
  enablePan = true,
  enableRotate = true,
  enableZoom = true,
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);

  useEffect(() => {
    camera.position.set(...defaultPosition);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, []);

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

function ValueLabels({ instances, center }) {
  return (
    <group position={[-center[0], -center[1], -center[2]]}>
      {instances.map((entry) => {
        const [x, y, z] = entry.position;
        return (
          <Billboard key={`label-${x}-${y}-${z}`} position={[x, y, z]} follow>
            <Text
              fontSize={0.24}
              color="#f7f8fb"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.03}
              outlineColor="#0f172a"
            >
              {entry.label}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}

function BinaryVoxels({
  data,
  threshold = 0,
  axisOrder = "zyx",
}) {
  const { X, Y, Z } = useMemo(() => pickDims(data, axisOrder), [data, axisOrder]);
  const instances = useMemo(
    () => buildVoxelInstances(data, threshold, axisOrder, "binary"),
    [data, threshold, axisOrder]
  );
  const center = useMemo(() => [(X - 1) / 2, (Y - 1) / 2, (Z - 1) / 2], [X, Y, Z]);
  const meshRef = useRef(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.count = instances.length;
    if (mesh.instanceMatrix) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();

    for (let i = 0; i < instances.length; i++) {
      const { position, scale, color } = instances[i];
      const [x, y, z] = position;
      matrix.compose(
        new THREE.Vector3(x, y, z),
        quaternion,
        new THREE.Vector3(scale, scale, scale)
      );
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, new THREE.Color(color));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances]);

  return (
    <>
      <group position={[-center[0], -center[1], -center[2]]}>
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, Math.max(1, instances.length)]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            vertexColors
            color="#f4f5f7"
            emissive="#d9dde4"
            emissiveIntensity={0.22}
            roughness={0.58}
            metalness={0}
          />
        </instancedMesh>
      </group>
    </>
  );
}

function ValueVoxels({ data, threshold = 0, axisOrder = "zyx" }) {
  const { X, Y, Z } = useMemo(() => pickDims(data, axisOrder), [data, axisOrder]);
  const instances = useMemo(
    () => buildVoxelInstances(data, threshold, axisOrder, "value"),
    [data, threshold, axisOrder]
  );
  const center = useMemo(() => [(X - 1) / 2, (Y - 1) / 2, (Z - 1) / 2], [X, Y, Z]);
  const edgeGeometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.95, 0.95)),
    []
  );

  useEffect(() => {
    return () => {
      edgeGeometry.dispose();
    };
  }, [edgeGeometry]);

  return (
    <>
      <group position={[-center[0], -center[1], -center[2]]}>
        {instances.map((entry) => {
          const [x, y, z] = entry.position;
          return (
            <lineSegments key={`voxel-edge-${x}-${y}-${z}`} geometry={edgeGeometry} position={[x, y, z]}>
              <lineBasicMaterial color={entry.color} transparent opacity={0.95} />
            </lineSegments>
          );
        })}
      </group>
      <ValueLabels instances={instances} center={center} />
    </>
  );
}

export default function Array3DCanvas({
  data,
  threshold = 0,
  axisOrder = "zyx",
  renderMode = "binary",
  enablePan = true,
  enableRotate = true,
  enableZoom = true,
}) {
  const { X, Y, Z } = useMemo(() => pickDims(data, axisOrder), [data, axisOrder]);
  const maxDim = Math.max(1, X, Y, Z);
  const defaultPosition = useMemo(() => [maxDim * 0.9, maxDim * 0.8, maxDim * 1.2], [maxDim]);
  const gridY = useMemo(() => -((Y - 1) / 2) - 0.5, [Y]);
  const gridSize = useMemo(() => Math.max(10, maxDim * 2 + 2), [maxDim]);
  const axesLen = useMemo(() => Math.max(5, maxDim * 1.2), [maxDim]);
  const fitKey = useMemo(
    () => `${X}x${Y}x${Z}-${axisOrder}-${renderMode}`,
    [X, Y, Z, axisOrder, renderMode]
  );

  return (
    <Canvas camera={{ position: defaultPosition, fov: 55 }}>
      <ambientLight intensity={1.05} />
      <directionalLight position={[10, 12, 8]} intensity={1.1} />

      <axesHelper args={[axesLen]} />
      <gridHelper args={[gridSize, gridSize]} position={[0, gridY, 0]} />

      {renderMode === "value" ? (
        <ValueVoxels data={data} threshold={threshold} axisOrder={axisOrder} />
      ) : (
        <BinaryVoxels data={data} threshold={threshold} axisOrder={axisOrder} />
      )}

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
      <OrientationOverlay gizmoAlignment="bottom-right" gizmoMargin={[72, 72]} />
    </Canvas>
  );
}
