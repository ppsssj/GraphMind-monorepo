import { useNavigate } from "react-router-dom";
import "../styles/Intro.css";
import LoginModal from "../ui/LoginModal";
import { useState, useRef } from "react";
import ParticleBackground from "../components/ParticleBackground";
import MiniVaultDemo from "../components/MiniVaultDemo";
import Plot from "react-plotly.js";
import GraphCanvas from "../ui/GraphCanvas";
import { getToken } from "../api/apiClient";
import AuthStatusPanel from "../ui/AuthStatePanel";
export default function Intro() {
  const nav = useNavigate();
  const [activeIdx, setActiveIdx] = useState(null);
  const demoRef = useRef(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginOrigin, setLoginOrigin] = useState({ x: 0, y: 0 });
  const [authTick, setAuthTick] = useState(0); // 토큰 제거 후 헤더 리렌더용

  const openLoginFromEvent = (e) => {
    if (e?.currentTarget?.getBoundingClientRect) {
      const r = e.currentTarget.getBoundingClientRect();
      setLoginOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    } else {
      setLoginOrigin({ x: window.innerWidth - 120, y: 72 });
    }
    setLoginOpen(true);
  };
// ✅ 페이지 전환 Pop 애니메이션을 위한 origin 포함 네비게이션
  const navPop = (path, e) => {
    if (e?.currentTarget?.getBoundingClientRect) {
      const r = e.currentTarget.getBoundingClientRect();
      nav(path, {
        state: { origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } },
      });
    } else {
      nav(path);
    }
  };
const isAuthed = !!getToken(); // authTick로 재평가

  const handleLogout = () => {
    // LoginModal 안내 문구대로 gm_token 제거
    try {
      localStorage.removeItem("gm_token");
    } catch {}
    setAuthTick((v) => v + 1);
  };
  // 카드에서 사용할 데이터 (배경 이미지 + 설명 포함)
  const useCases = [
    {
      icon: "🎓",
      title: "Used as an educational visualized tool.",
      desc: "Perfect for classrooms and self-study: type equations, see them come alive in 3D, and manipulate parameters in real time. Turn abstract symbols into concrete intuition, then capture clean visuals for assignments and presentations. It also supports step-by-step demonstrations and live Q&A moments during lectures.",
      img: "/UseCases1.png",
      pos: "center 50%",
    },
    {
      icon: "🧪",
      title: "Simulation of thesis/research ideas.",
      desc: "Prototype research ideas quickly by iterating on formulas, constraints, and initial conditions in one place. Run lightweight parameter sweeps, compare scenarios side-by-side, and share reproducible, visual experiment setups with your lab or advisor. Logs and snapshots help you document changes as you refine your hypothesis.",
      img: "/UseCases2.png",
      pos: "center 40%",
    },
    {
      icon: "🧮",
      title: "Visual exploration of math problems.",
      desc: "Explore calculus, linear algebra, and geometry visually to build real problem-solving intuition. Trace roots and extrema, inspect curvature, and see how small parameter shifts ripple through a system before committing to formal proofs. Guided overlays and annotations help connect each visual insight back to theory.",
      img: "/UseCases3.png",
      pos: "center 50%",
    },
    {
      icon: "📝",
      title: "Creating interactive math notes.",
      desc: "Author living notes where graphs respond to input instead of staying as static screenshots. Combine text, equations, and interactive plots so readers can tweak parameters and learn immediately. Great for flipped classrooms and peer sharing, with export/embed options to reuse across courses and tutorials.",
      img: "/UseCases4.png",
      pos: "center 35%",
    },
  ];

  return (
    <div className="intro-root">
      <ParticleBackground density={0.00012} accentRatio={0.09} />
      {/* Header */}
      <header className="intro-header">
        <div className="brand">
          <img className="brand-logo" src="/Logo.png" alt="GraphMind logo" />
          <div className="brand-text">
            <div className="brand-name">GraphMind</div>
            <div className="brand-sub">Math. Graph. AI</div>
          </div>
        </div>
        {/* 네비게이션 바 추가 */}
        <nav className="intro-nav">
          <button
            className="nav-btn"
            onClick={() =>
              document
                .getElementById("features")
                .scrollIntoView({ behavior: "smooth" })
            }
          >
            Features
          </button>
          <button
            className="nav-btn"
            onClick={() =>
              document
                .getElementById("howto")
                .scrollIntoView({ behavior: "smooth" })
            }
          >
            How to use
          </button>
          <button
            className="nav-btn"
            onClick={() =>
              document
                .getElementById("cta-head")
                .scrollIntoView({ behavior: "smooth" })
            }
          >
            Get Started
          </button>
        </nav>
        {/* <button className="ghost" onClick={() => setLoginOpen(true)}>
          Login
        </button> */}
        {/* <AuthStatusPanel onLoginClick={openLoginFromEvent} /> */}
        <div className="header-auth" key={authTick}>
          {isAuthed ? (
            <>
              <button className="cta-small" onClick={(e) => navPop("/vault", e)}>
                Open Vault
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <button className="cta-small" onClick={openLoginFromEvent}>
              Sign in
            </button>
          )}
        </div>
         <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          origin={loginOrigin}
        />
      </header>

      {/* Hero */}
      <main className="intro-hero">
        <div className="intro-container">
          <div className="intro-hero-text">
            <h1 className="hero-title">
              <span className="accent">Think</span> in Math.
              <br />
              Visualize in <span className="accent">3D</span>.
            </h1>
            <p className="hero-sub">
              <span className="accent-strong">
                All ideas begin with formulas.
              </span>
              <br />
              GraphMind is an all-in-one interface that integrates formula
              input, graph generation, intuitive editing, and AI interpretation.
              Realize your mathematical imagination in{" "}
              <span className="accent-strong">real-time 3D</span>.
            </p>
            <button
              className="cta"
              onClick={(e) => {
                const t = getToken();
                if (!t) return openLoginFromEvent(e);
                navPop("/vault", e);
              }}
            >
              Start
            </button>
          </div>

          <div className="hero-image-wrapper">
            <img
              className="hero-image"
              src="/Logo.png"
              alt="3D graph example"
            />
          </div>
        </div>

        {/* Features #01 */}
        <section className="features" id="features">
          <span className="features-flow">[feature Section - #01]</span>
          <h2>Key Features</h2>
          <img
            className="feature-image"
            src="/feature01.png"
            alt="Feature illustration"
          />
        </section>

        {/* Features #02 */}
        <section className="features">
          <span className="features-flow">[feature Section - #02]</span>
          <h2>Use Cases</h2>

          <div className="UseCases-grid">
            {useCases.map((c, idx) => (
              <button
                key={idx}
                type="button"
                className={`UseCases-card ${activeIdx === idx ? "active" : ""}`}
                onClick={() => setActiveIdx(idx)}
                aria-label={c.title}
              >
                {/* 배경 전용 레이어 (이미지 + 포지션) */}
                <span
                  className="UseCases-bg"
                  style={{
                    backgroundImage: `url(${c.img})`,
                    backgroundPosition: c.pos || "center",
                  }}
                  aria-hidden="true"
                />
                {/* 텍스트 레이어 */}
                <div className="UseCases-content">
                  <div className="icon" aria-hidden="true">
                    {c.icon}
                  </div>
                  <div className="UseCases-texts">
                    <span className="UseCases-title">{c.title}</span>
                    <p className="UseCases-desc">{c.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Features #03 — Use Cases */}
        <section className="features">
          <span className="features-flow">[feature Section - #03]</span>
          <h2>From Formula to Space:</h2>
          <h2>A New Language of Mathematics</h2>
          <h4 style={{ color: "#BCBCBC" }}>
            A tool that Visualizes creative thinking
            <br />
            and empowers learning with clairity.
          </h4>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="icon">f(x)</div>
              <div className="f-title">Equation Input → 3D Graph</div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                Instantly turn equations into interactive curves in 3D space.
              </p>
            </div>
            <div className="feature-card">
              <div className="icon">◬</div>
              <div className="f-title">
                Your ideas deserve to be visualized.
              </div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                GraphMind lets your mathematical thinking take shape—literally.
                From formula to 3D, bring your thoughts into the world.
              </p>
            </div>
            <div className="feature-card">
              <div className="icon">⇄</div>
              <div className="f-title">
                Designed for learning, built for lasting insightc
              </div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                Whether you’re studying for a test or exploring a thesis,
                GraphMind helps you see the big picture—and save it for later.
              </p>
            </div>
            <div className="feature-card">
              <div className="icon">✨</div>
              <div className="f-title">
                Built to expand with your imagination.
              </div>
              <p style={{ fontSize: "12px", color: "#DCE1F5" }}>
                GraphMind is just the beginning. Future updates will include
                plugins, templates, and export options to match your creativity.
              </p>
            </div>
          </div>
        </section>
        <section className="features howto" id="howto">
          <span className="features-flow">[Flow Section - #01]</span>

          <h2>Vault Preview</h2>
          <div className="howto-grid">
            {/* LEFT: 버튼 */}
            <div className="howto-text">
              <h3>Mini Vault Demo</h3>
              <p>
                GraphMind의 Vault(저장소)에서 제공하는 미니 데모입니다.
                <br />
                버튼을 눌러 그래프에 노드/링크를 단계별로 추가해 보세요.
              </p>
              <div className="howto-actions">
                <button
                  onClick={() => demoRef.current?.step1()}
                  className="btn"
                >
                  1) sin(x) 노드 생성 (tag: sin)
                </button>
                <button
                  onClick={() => demoRef.current?.step2()}
                  className="btn"
                >
                  2) sin(x²) 노드 생성 (tag: sin)
                </button>
                <button
                  onClick={() => demoRef.current?.step3()}
                  className="btn"
                >
                  3) cos(x) 노드 생성 (tag: cos)
                </button>
                <button
                  onClick={() => demoRef.current?.step4()}
                  className="btn"
                >
                  4) log(x) 노드 생성 (tag: log){" "}
                </button>
                <button
                  onClick={() => demoRef.current?.reset()}
                  className="btn ghost"
                >
                  Reset
                </button>
              </div>
              <p className="hint">
                버튼을 눌러 그래프에 노드/링크를 단계별로 추가해 보세요.
              </p>
            </div>

            {/* RIGHT: 그래프 */}
            <div className="howto-graph">
              <MiniVaultDemo ref={demoRef} />
            </div>
          </div>
        </section>

        <section className="features howto">
          <span className="features-flow">[Flow Section - #02]</span>
          <h2>Studio Preview</h2>
          <div className="howto-grid">
            <div className="howto-text">
              <h3>Mini Studio Demo</h3>
              <p>GraphMind의 Studio(작업공간) 미니 데모입니다.</p>
              <p>마우스로 회전/이동, 휠 스크롤로 확대/축소가 가능합니다.</p>
              <p>아래 그래프는 sin(x) 입니다.</p>
            </div>

            <div className="howto-graph">
              <div className="studio-demo-graph">
                <GraphCanvas
                  points={[
                    { x: -2, y: Math.sin(-2) },
                    { x: 0, y: Math.sin(0) },
                    { x: 2, y: Math.sin(2) },
                  ]}
                  onPointChange={(idx, pos) =>
                    console.log("point moved", idx, pos)
                  }
                  xmin={-8}
                  xmax={8}
                  fn={(x) => Math.sin(x)} // 파랑: 근사
                  typedFn={(x) => Math.sin(x)} // 빨강: 입력식
                  curveKey="sin-demo"
                  showControls={false}
                />
              </div>
            </div>
          </div>
        </section>


<section className="cta-banner" aria-labelledby="cta-head">
  <div
    className="cta-banner-inner cta-hover"
    onMouseMove={(e) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty("--mx", `${x.toFixed(1)}%`);
      el.style.setProperty("--my", `${y.toFixed(1)}%`);
      el.style.setProperty("--hover", "1");
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget;
      el.style.setProperty("--mx", `50%`);
      el.style.setProperty("--my", `40%`);
      el.style.setProperty("--hover", "0");
    }}
  >
    <p className="cta-kicker">BEYOND SYMBOLS</p>
    <h2 id="cta-head" className="cta-headline">
      Math begins in abstraction and finds its proof in the graph.
    </h2>
    <p className="cta-sub">
      Draw your space with a single equation. <br />
      Explore, learn, and create in real-time 3D.
    </p>

    <button className="cta-large">Get Started</button>
  </div>
</section>

      </main>

      <footer className="intro-footer">© Git : ppsssj</footer>
    </div>
  );
}
