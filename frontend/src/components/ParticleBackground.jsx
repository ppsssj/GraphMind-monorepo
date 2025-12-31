import { useEffect, useRef } from "react";

export default function ParticleBackground({
  density = 0.00012,     // 화면 픽셀당 입자 밀도
  maxParticles = 360,
  minRadius = 0.6,
  maxRadius = 2.2,
  minSpeed = 8,          // px/s
  maxSpeed = 28,         // px/s
  // 기본(화이트/그레이) 팔레트
  colors = [
    [255, 255, 255],
    [235, 238, 245],
    [215, 220, 232],
    [200, 205, 220],
  ],
  // 🔴 포인트용 빨간 입자 옵션
  accentRatio = 0.015,   // 전체 중 빨간 비율(1.5% 권장: 0.005~0.02 사이 추천)
  accentColors = [
    [255, 80, 80],
    [255, 95, 95],
  ],
  accentRadiusBoost = 1.15,  // 빨간 입자 크기 살짝 키움
  accentSpeedBoost = 0.85,   // 빨간 입자 조금 느리게
  accentAlphaBoost = 1.1,    // 투명도 살짝 더 선명
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const lastTsRef = useRef(0);
  const reduceMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    : false;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const { innerWidth: w, innerHeight: h } = window;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wanted = Math.min(maxParticles, Math.max(60, Math.floor(w * h * density)));
    const ps = particlesRef.current;

    while (ps.length < wanted) ps.push(makeParticle(w, h));
    if (ps.length > wanted) ps.splice(wanted);
  }

  function makeParticle(w, h) {
    const isAccent = Math.random() < accentRatio;

    const rBase = rand(minRadius, maxRadius);
    const r = isAccent ? rBase * accentRadiusBoost : rBase;

    const speedBase = rand(minSpeed, maxSpeed);
    const speed = isAccent ? speedBase * accentSpeedBoost : speedBase;

    const angle = rand(0, Math.PI * 2);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const [cr, cg, cb] = isAccent ? pick(accentColors) : pick(colors);

    // 기본은 은은하게, 빨간 포인트는 살짝 더 선명
    const baseAlpha = (isAccent ? rand(0.26, 0.66) * accentAlphaBoost : rand(0.18, 0.6));
    const pulseAmp = isAccent ? rand(0.05, 0.12) : rand(0.06, 0.18);
    const pulseFreq = isAccent ? rand(0.25, 0.8) : rand(0.4, 1.2);
    const phase = rand(0, Math.PI * 2);

    return {
      x: rand(0, w), y: rand(0, h), r, vx, vy,
      cr, cg, cb,
      baseAlpha, pulseAmp, pulseFreq, phase,
      isAccent,
    };
  }

  function step(ts) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { innerWidth: w, innerHeight: h } = window;
    const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
    lastTsRef.current = ts;

    ctx.clearRect(0, 0, w, h);

    // 살짝 빛 번지는 합성감
    ctx.globalCompositeOperation = "lighter";

    const ps = particlesRef.current;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];

      // 이동 + 화면 밖으로 나가면 반대편으로 랩
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -p.r) p.x = w + p.r;
      if (p.x > w + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = h + p.r;
      if (p.y > h + p.r) p.y = -p.r;

      // 은은한 투명도 펄스
      const a = p.baseAlpha + Math.sin(ts * 0.001 * 2 * Math.PI * p.pulseFreq + p.phase) * p.pulseAmp;
      const alpha = Math.max(0, Math.min(1, a));

      // 부드러운 가장자리
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
      const c0 = `rgba(${p.cr},${p.cg},${p.cb},${alpha})`;
      const c1 = `rgba(${p.cr},${p.cg},${p.cb},0)`;
      grad.addColorStop(0.0, c0);
      grad.addColorStop(0.6, `rgba(${p.cr},${p.cg},${p.cb},${alpha * 0.55})`);
      grad.addColorStop(1.0, c1);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    if (!reduceMotion) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) step(0);
    }
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <div className="particle-layer" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
