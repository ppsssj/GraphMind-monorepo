import { Routes, Route } from "react-router-dom";
import "katex/dist/katex.min.css";
import Intro from "./pages/Intro";
import Vault from "./pages/Vault";
import Studio from "./pages/Studio";
import CustomCursor from "./components/CustomCursor";

export default function App() {
  return (
    <>
      {/* 전체 화면에서 사용하는 전역 커서 */}
      <CustomCursor />

      {/* 기존 라우팅 구조 그대로 유지 */}
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/studio" element={<Studio />} />
      </Routes>
    </>
  );
}
