import React, { useEffect, useState } from "react";

const isTouchDevice = () => {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
};

export default function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [isClicking, setIsClicking] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // 모바일/터치 디바이스에서는 비활성화
    if (isTouchDevice()) {
      setEnabled(false);
      return;
    }
    setEnabled(true);

    const handleMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    const handleDown = () => setIsClicking(true);
    const handleUp = () => setIsClicking(false);

    const handleOver = (e) => {
      const target = e.target;
      if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.getAttribute("role") === "button" ||
        target.classList.contains("cursor-pointer")
      ) {
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mouseover", handleOver);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mouseover", handleOver);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      className={`custom-cursor ${
        isClicking ? "clicking" : ""
      } ${isActive ? "active" : ""}`}
      style={{
        left: pos.x,
        top: pos.y,
      }}
    />
  );
}
