// src/ui/Array3DView.jsx
import React from "react";
import Array3DCanvas from "./Array3DCanvas";
import "./Array3DView.css";

export default function Array3DView({
  data,
  threshold = 0,
  axisOrder = "zyx",
  // 필요하면 Studio/Toolbar에서 제어
  enablePan = true,
  enableRotate = true,
  enableZoom = true,
}) {
  return (
    <div className="array3d-root">
      <Array3DCanvas
        data={data}
        threshold={threshold}
        axisOrder={axisOrder}
        enablePan={enablePan}
        enableRotate={enableRotate}
        enableZoom={enableZoom}
      />
    </div>
  );
}
