// src/ui/OrientationOverlay.jsx
import { GizmoHelper, GizmoViewport } from "@react-three/drei";

/**
 * ✅ 텍스트 HUD 제거 버전: 기즈모(방향 표시)만 렌더링
 *
 * 사용 예:
 * <OrientationOverlay />
 * <OrientationOverlay gizmoAlignment="bottom-right" gizmoMargin={[56, 56]} />
 */
export default function OrientationOverlay({
  gizmoAlignment = "bottom-right",
  gizmoMargin = [72, 72],
}) {
  return (
    <GizmoHelper alignment={gizmoAlignment} margin={gizmoMargin}>
      <GizmoViewport />
    </GizmoHelper>
  );
}
