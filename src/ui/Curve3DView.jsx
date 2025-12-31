// src/ui/Curve3DView.jsx
import React from "react";
import Curve3DCanvas from "./Curve3DCanvas";

export default function Curve3DView({ curve3d, onChange }) {
  if (!curve3d) {
    return <div className="empty-hint">3D 곡선 정보가 없습니다.</div>;
  }

  const merged = {
    baseXExpr: curve3d.baseXExpr ?? curve3d.xExpr ?? "",
    baseYExpr: curve3d.baseYExpr ?? curve3d.yExpr ?? "",
    baseZExpr: curve3d.baseZExpr ?? curve3d.zExpr ?? "",
    xExpr: curve3d.xExpr ?? "",
    yExpr: curve3d.yExpr ?? "",
    zExpr: curve3d.zExpr ?? "",
    tMin: curve3d.tMin ?? 0,
    tMax: curve3d.tMax ?? 2 * Math.PI,
    samples: curve3d.samples ?? 400,

    gridMode: curve3d.gridMode ?? "major",
    gridStep: curve3d.gridStep ?? 1,
    minorDiv: curve3d.minorDiv ?? 4,

    deformSigma: curve3d.deformSigma ?? 0.6,
    maxDelta: curve3d.maxDelta ?? 1.5,

    markers: Array.isArray(curve3d.markers) ? curve3d.markers : [],
    editMode: curve3d.editMode ?? "drag",
  };

  const handleMarkerChange = (index, pos) => {
    const next = [...merged.markers];
    const prev = next[index] || {};
    next[index] = { ...prev, ...pos };
    onChange?.({ markers: next });
  };
  const handleMarkersChange = (nextMarkers) => {
    onChange?.({ markers: Array.isArray(nextMarkers) ? nextMarkers : [] });
  };


  const handleRecalculateExpressions = (patch) => {
    onChange?.(patch);
  };

  return (
    <div className="graph-view">
      <Curve3DCanvas
        baseXExpr={merged.baseXExpr}
        baseYExpr={merged.baseYExpr}
        baseZExpr={merged.baseZExpr}
        xExpr={merged.xExpr}
        yExpr={merged.yExpr}
        zExpr={merged.zExpr}
        tMin={merged.tMin}
        tMax={merged.tMax}
        samples={merged.samples}
        gridMode={merged.gridMode}
        gridStep={merged.gridStep}
        minorDiv={merged.minorDiv}
        markers={merged.markers}
        onMarkerChange={handleMarkerChange}
        onMarkersChange={handleMarkersChange}
        onRecalculateExpressions={handleRecalculateExpressions}
        editMode={merged.editMode}
        deformSigma={merged.deformSigma}
        maxDelta={merged.maxDelta}
      />
    </div>
  );
}
