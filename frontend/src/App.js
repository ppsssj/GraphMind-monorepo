import React, { useMemo, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import "katex/dist/katex.min.css";

import Intro from "./pages/Intro";
import Vault from "./pages/Vault";
import Studio from "./pages/Studio";
import CustomCursor from "./components/CustomCursor";

import "./styles/routePop.css";

function RoutePopWrapper({ origin, pageKey, children }) {
  const firstRenderRef = useRef(true);

  // 첫 진입(초기 렌더)은 애니메이션을 과하게 주지 않는 편이 UX가 안정적입니다.
  const shouldAnimate = useMemo(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return false;
    }
    return true;
  }, [pageKey]);

  const ox = origin?.x ?? window.innerWidth / 2;
  const oy = origin?.y ?? window.innerHeight * 0.2;

  const style = {
    "--ox": `${ox}px`,
    "--oy": `${oy}px`,
  };

  return (
    <div
      key={pageKey} // ✅ key를 걸어야 페이지 이동마다 애니메이션이 다시 재생됩니다.
      className={shouldAnimate ? "route-pop" : "route-pop route-pop--noanim"}
      style={style}
    >
      {children}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const origin = location.state?.origin;

  return (
    <>
      <CustomCursor />

      {/* location.key 기반으로 wrapper key를 돌려서 “페이지 전환마다” pop 재생 */}
      <Routes location={location}>
        <Route
          path="/"
          element={
            <RoutePopWrapper origin={origin} pageKey={location.key}>
              <Intro />
            </RoutePopWrapper>
          }
        />
        <Route
          path="/vault"
          element={
            <RoutePopWrapper origin={origin} pageKey={location.key}>
              <Vault />
            </RoutePopWrapper>
          }
        />
        <Route
          path="/studio"
          element={
            <RoutePopWrapper origin={origin} pageKey={location.key}>
              <Studio />
            </RoutePopWrapper>
          }
        />
      </Routes>
    </>
  );
}
