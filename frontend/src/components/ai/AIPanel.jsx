// src/components/ai/AIPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "../../styles/AIPanel.css";

const PROXY_API_URL = "http://localhost:4000/api/ai/chat";
const HISTORY_API_URL = "http://localhost:8080/api/ai/history";
const TABS = [
  { id: "explain", label: "그래프 설명" },
  { id: "equation", label: "수식 도우미" },
  { id: "chat", label: "질문하기" },
  { id: "control", label: "그래프 조작" },
  { id: "history", label: "History" },
];

const GLOBAL_HISTORY_KEY = "gm_ai_history:all";
const TAB_HISTORY_KEY = (ctx) =>
  `gm_ai_history:${ctx?.type ?? "none"}:${ctx?.tabId ?? "none"}`;

const PANEL_SIZE_KEY = "gm_ai_panel_size_v1";
const PANEL_POS_KEY = "gm_ai_panel_pos_v1";

const DEFAULT_PANEL_SIZE = { width: 460, height: 720 };
const MIN_PANEL_SIZE = { width: 360, height: 520 };
const MAX_PANEL_SIZE = { width: 920, height: 980 };

// 기본 위치(우상단 느낌)
const DEFAULT_PANEL_POS = { right: 12, top: 12 }; // right/top 방식
// Drag-to-move는 left/top으로 전환해서 움직이게 처리
const DEFAULT_PANEL_POS_LT = { left: null, top: 12, right: 12 };

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function nowISO() {
  return new Date().toISOString();
}

function safeJsonStringify(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function extractJsonFromText(text) {
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  const firstObj = text.match(/\{[\s\S]*\}/);
  if (firstObj?.[0]) {
    try {
      return JSON.parse(firstObj[0]);
    } catch {}
  }
  return null;
}

function normalizeCmd(obj) {
  if (!obj || typeof obj !== "object") return null;

  const action = String(obj.action ?? "none");
  const target = obj.target ? String(obj.target) : undefined;
  const args = obj.args && typeof obj.args === "object" ? obj.args : undefined;
  const message = obj.message ? String(obj.message) : undefined;

  const allowed = new Set([
    "none",
    "mark_max",
    "mark_min",
    "mark_roots",
    "mark_intersections",
    "clear_markers",
    "closest_to_point",
    "slice_t",
    "tangent_at",
    "slice_x",
    "slice_y",
    "contour_z",
  ]);
  if (!allowed.has(action)) return null;

  return { action, target, args, message };
}

function buildContextPrefix(ctx) {
  if (!ctx) return "";

  if (ctx.type === "equation") {
    return `현재 탭: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})
수식: ${ctx.equation}
도메인: [${ctx.xmin}, ${ctx.xmax}]

`;
  }
  if (ctx.type === "curve3d") {
    return `현재 3D 곡선: ${ctx.title ?? "(untitled)"} (tabId:${
      ctx.tabId ?? "-"
    })
x(t): ${ctx.xExpr}
y(t): ${ctx.yExpr}
z(t): ${ctx.zExpr}

`;
  }
  if (ctx.type === "array3d" || ctx.type === "surface3d") {
    const expr = ctx.expr ?? ctx.zExpr ?? ctx.equation ?? null;
    const xMin = ctx.xMin ?? ctx.xmin ?? null;
    const xMax = ctx.xMax ?? ctx.xmax ?? null;
    const yMin = ctx.yMin ?? null;
    const yMax = ctx.yMax ?? null;
    return (
      `현재 3D 표면: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})
` +
      (expr ? `z(x,y): ${expr}\n` : "") +
      (xMin !== null && xMax !== null ? `X 범위: [${xMin}, ${xMax}]\n` : "") +
      (yMin !== null && yMax !== null ? `Y 범위: [${yMin}, ${yMax}]\n` : "") +
      "\n"
    );
  }
  return `현재 탭: ${ctx.title ?? "(untitled)"} (tabId:${
    ctx.tabId ?? "-"
  })\n\n`;
}

function buildControlResultText({ parsed, ctx, rawMessage }) {
  if (!parsed || parsed.action === "none") return rawMessage ?? "";

  const type = ctx?.type ?? "none";
  const action = parsed.action;
  const args = parsed.args ?? {};

  const head = parsed.message?.trim() || "요청을 처리했습니다.";

  const commonTip =
    "\n\nTip) 표시된 좌표 노드(마커)는 화면에 남아 있으며, 필요 시 '마커 지워줘'로 초기화할 수 있습니다.";

  if (action === "clear_markers") {
    return (
      head +
      "\n- 기존에 표시되어 있던 좌표 노드(마커)를 모두 제거했습니다.\n- 그래프 자체(수식/데이터)는 변경하지 않습니다."
    );
  }

  if (type === "equation") {
    if (action === "mark_max") {
      return (
        head +
        "\n- 현재 도메인 내에서 최대값 후보 지점에 좌표 노드(마커)를 생성했습니다." +
        `\n- 탐색 샘플 수: ${
          args.samples ?? 2500
        } (정밀도가 필요하면 samples를 올리세요)` +
        commonTip
      );
    }
    if (action === "mark_min") {
      return (
        head +
        "\n- 현재 도메인 내에서 최소값 후보 지점에 좌표 노드(마커)를 생성했습니다." +
        `\n- 탐색 샘플 수: ${args.samples ?? 2500}` +
        commonTip
      );
    }
    if (action === "mark_roots") {
      return (
        head +
        "\n- x축과 만나는 지점(근/영점)에 좌표 노드(마커)를 생성했습니다." +
        `\n- 최대 근 개수: ${args.maxRoots ?? 12}, tol: ${args.tol ?? 1e-6}` +
        "\n- 근이 촘촘하거나 민감하면 samples를 증가시키는 것이 유리합니다." +
        commonTip
      );
    }
    if (action === "mark_intersections") {
      return (
        head +
        "\n- '입력 수식(typed)'과 '기준/피팅(fit)' 그래프의 교차 지점에 좌표 노드(마커)를 생성했습니다." +
        `\n- 최대 교점 개수: ${args.maxIntersections ?? 12}, tol: ${
          args.tol ?? 1e-6
        }` +
        commonTip
      );
    }
  }

  if (type === "curve3d") {
    const axis = args.axis ?? "z";
    if (action === "mark_max" || action === "mark_min") {
      return (
        head +
        `\n- 3D 곡선에서 ${axis.toUpperCase()}축 기준 ${
          action === "mark_max" ? "최대" : "최소"
        } 지점 후보에 마커를 생성했습니다.` +
        `\n- 샘플 수: ${args.samples ?? 800}` +
        commonTip
      );
    }
    if (action === "closest_to_point") {
      const p = args.point ?? { x: 0, y: 0, z: 0 };
      return (
        head +
        `\n- 기준점 (${p.x}, ${p.y}, ${p.z})에 가장 가까운 곡선 위 지점에 마커를 생성했습니다.` +
        `\n- 샘플 수: ${args.samples ?? 800}` +
        commonTip
      );
    }
    if (action === "slice_t") {
      return (
        head +
        `\n- t=${
          args.t ?? "(미지정)"
        } 에서의 곡선 좌표를 계산해 마커로 표시했습니다.` +
        commonTip
      );
    }
    if (action === "tangent_at") {
      return (
        head +
        `\n- t=${
          args.t ?? "(미지정)"
        } 에서의 접선(수치 미분 기반)을 계산했습니다.` +
        `\n- dt: ${args.dt ?? 1e-3}` +
        commonTip
      );
    }
  }

  if (type === "surface3d" || type === "array3d") {
    if (action === "mark_max" || action === "mark_min") {
      return (
        head +
        `\n- 3D 표면에서 z 기준 ${
          action === "mark_max" ? "최대" : "최소"
        } 지점 후보에 마커를 생성했습니다.` +
        `\n- 샘플 격자: ${args.samplesX ?? 80} x ${args.samplesY ?? 80}` +
        commonTip
      );
    }
    if (action === "contour_z") {
      return (
        head +
        `\n- z=${args.level ?? 0} 등고선(컨투어)을 계산해 표시했습니다.` +
        `\n- eps: ${args.eps ?? 1e-2}, dedupDist: ${args.dedupDist ?? 0.25}` +
        commonTip
      );
    }
    if (action === "slice_x") {
      return (
        head +
        `\n- x=${args.x ?? "(미지정)"} 단면을 계산해 표시했습니다.` +
        commonTip
      );
    }
    if (action === "slice_y") {
      return (
        head +
        `\n- y=${args.y ?? "(미지정)"} 단면을 계산해 표시했습니다.` +
        commonTip
      );
    }
    if (action === "closest_to_point") {
      const p = args.point ?? { x: 0, y: 0, z: 0 };
      return (
        head +
        `\n- 기준점 (${p.x}, ${p.y}, ${p.z})에 가장 가까운 표면 위 지점에 마커를 생성했습니다.` +
        commonTip
      );
    }
  }

  return head + commonTip;
}

function formatKST(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { hour12: false });
  } catch {
    return iso;
  }
}

function safeParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function relativeTime(iso) {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s 전`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h 전`;
    const d = Math.floor(h / 24);
    return `${d}d 전`;
  } catch {
    return "";
  }
}

function dayKey(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR");
  } catch {
    return "Unknown";
  }
}

function badgeLabel(tab) {
  if (tab === "control") return "CMD";
  if (tab === "chat") return "CHAT";
  if (tab === "equation") return "EQ";
  if (tab === "explain") return "EX";
  return String(tab ?? "-").toUpperCase();
}

function truncate(s, n) {
  const t = (s ?? "").toString().replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + "…";
}

function buildControlExtractorPrompt(ctx) {
  const type = ctx?.type ?? "none";

  const common = `
You are GraphMind Command Extractor.
Return ONLY ONE JSON object. No markdown. No commentary.

BaseSchema:
{
  "action": string,
  "target": "typed|fit",
  "args": object,
  "message": "Korean short status message"
}

GlobalRules:
- If unclear => action="none" and message asks for clarification.
- Defaults: target="typed"
`.trim();

  if (type === "equation") {
    return (
      common +
      `

Allowed actions (2D):
- none | mark_max | mark_min | mark_roots | mark_intersections | clear_markers

Args:
{
  "samples"?: number,
  "maxRoots"?: number,
  "maxIntersections"?: number,
  "tol"?: number
}

Rules:
- "최대값/최댓값" => mark_max
- "최소값/최솟값" => mark_min
- "근/영점/zero/roots" => mark_roots
- "교점/교차점/intersection" => mark_intersections
- "지워/삭제/클리어" => clear_markers

Defaults:
- args.samples=2500
- args.maxRoots=12
- args.maxIntersections=12
- args.tol=1e-6
`.trim()
    );
  }

  if (type === "curve3d") {
    return (
      common +
      `

Allowed actions (Curve3D parametric):
- none | mark_max | mark_min | mark_roots | mark_intersections | clear_markers
- closest_to_point | slice_t | tangent_at

Args:
{
  "axis"?: "x"|"y"|"z",
  "samples"?: number,
  "maxRoots"?: number,
  "maxIntersections"?: number,
  "point"?: { "x": number, "y": number, "z": number },
  "t"?: number,
  "dt"?: number
}

Rules:
- axis 언급 없으면 axis="z"
- "가장 가까운 점/원점에 가장 가까운" => closest_to_point
- "t=..." 또는 "t에서 점" => slice_t
- "접선/tangent" => tangent_at

Defaults:
- args.axis="z"
- args.samples=800
- args.maxRoots=12
- args.maxIntersections=12
- args.point=(0,0,0) if missing
`.trim()
    );
  }

  if (type === "surface3d" || type === "array3d") {
    return (
      common +
      `

Allowed actions (Surface3D z=f(x,y)):
- none | mark_max | mark_min | mark_roots | clear_markers
- contour_z | slice_x | slice_y | closest_to_point

Args:
{
  "samplesX"?: number,
  "samplesY"?: number,
  "maxRoots"?: number,
  "eps"?: number,
  "dedupDist"?: number,
  "level"?: number,
  "x"?: number,
  "y"?: number,
  "point"?: { "x": number, "y": number, "z": number }
}

Rules:
- "등고선/contour/z=..." => contour_z
- "x=... 단면/자르기" => slice_x
- "y=... 단면/자르기" => slice_y
- "가장 가까운 점/원점에 가장 가까운" => closest_to_point

Defaults:
- args.samplesX=80, args.samplesY=80
- args.level=0
- args.point=(0,0,0) if missing
`.trim()
    );
  }

  return (
    common +
    `

Allowed actions:
- none | clear_markers
`.trim()
  );
}

function normalizeLLMText(s = "") {
  return String(s)
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
}

function MarkdownResult({ text, variant }) {
  if (!text) return null;
  const md = normalizeLLMText(text);

  return (
    <div className={"ai-md-card" + (variant ? ` ${variant}` : "")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

// ✅ ContextSummary는 이전 버전 그대로 사용(간결히)
function ContextSummary({ ctx }) {
  const type = ctx?.type ?? "none";
  const title = ctx?.title ?? "(untitled)";
  const tabId = ctx?.tabId ?? "-";

  if (!ctx) {
    return (
      <div className="ai-ctx-card">
        <div className="ai-ctx-title">현재 탭</div>
        <div className="ai-ctx-row">
          <span className="ai-ctx-k">상태</span>
          <span className="ai-ctx-v">컨텍스트 없음</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-ctx-card">
      <div className="ai-ctx-title">
        현재 탭 정보 <span className="ai-ctx-badge">{type}</span>
      </div>

      <div className="ai-ctx-row">
        <span className="ai-ctx-k">제목</span>
        <span className="ai-ctx-v">{title}</span>
      </div>
      <div className="ai-ctx-row">
        <span className="ai-ctx-k">Tab ID</span>
        <span className="ai-ctx-v">{tabId}</span>
      </div>

      {type === "equation" && (
        <>
          <div className="ai-ctx-row">
            <span className="ai-ctx-k">수식</span>
            <span className="ai-ctx-v ai-mono">{ctx.equation ?? "-"}</span>
          </div>
          <div className="ai-ctx-row">
            <span className="ai-ctx-k">도메인</span>
            <span className="ai-ctx-v">
              [{ctx.xmin ?? "?"}, {ctx.xmax ?? "?"}]
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function AIPanel({
  isOpen,
  onClose,
  currentContext,
  onCommand,
}) {
  const [activeTab, setActiveTab] = useState("explain");

  // ✅ 탭별 input/output 분리 (중요)
  const [tabIO, setTabIO] = useState({
    explain: { input: "", output: "" },
    equation: { input: "", output: "" },
    chat: { input: "", output: "" },
    control: { input: "", output: "" },
  });

  const activeInput = tabIO?.[activeTab]?.input ?? "";
  const activeOutput = tabIO?.[activeTab]?.output ?? "";

  // 기존 코드 호환용 wrapper (JSX 수정 최소화)
  const setInputText = (v) => {
    setTabIO((prev) => ({
      ...prev,
      [activeTab]: { ...(prev?.[activeTab] ?? {}), input: v },
    }));
  };

  const setResultText = (v) => {
    setTabIO((prev) => ({
      ...prev,
      [activeTab]: { ...(prev?.[activeTab] ?? {}), output: v },
    }));
  };

  const [isLoading, setIsLoading] = useState(false);

  const [localEdit, setLocalEdit] = useState(null);
  const [debouncedContext, setDebouncedContext] = useState(currentContext);

  const [historyScope, setHistoryScope] = useState("all");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const [showCtxDetail, setShowCtxDetail] = useState(false);

  // ✅ panel size
  const [panelSize, setPanelSize] = useState(DEFAULT_PANEL_SIZE);
  const resizingRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startW: DEFAULT_PANEL_SIZE.width,
    startH: DEFAULT_PANEL_SIZE.height,
  });

  // ✅ panel position (Drag to move)
  const [panelPos, setPanelPos] = useState(DEFAULT_PANEL_POS_LT);
  const draggingRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  // 현재 컨텍스트 기준 키
  const ctxForKey = localEdit ||
    debouncedContext || { type: "none", tabId: "none" };
  const tabKey = TAB_HISTORY_KEY(ctxForKey);

  // ---- Load size/pos on open ----
  useEffect(() => {
    if (!isOpen) return;

    // size
    try {
      const raw = localStorage.getItem(PANEL_SIZE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v.width === "number" && typeof v.height === "number") {
          setPanelSize({
            width: clamp(v.width, MIN_PANEL_SIZE.width, MAX_PANEL_SIZE.width),
            height: clamp(
              v.height,
              MIN_PANEL_SIZE.height,
              MAX_PANEL_SIZE.height
            ),
          });
        }
      }
    } catch {}

    // pos
    try {
      const raw = localStorage.getItem(PANEL_POS_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v.left === "number" && typeof v.top === "number") {
          setPanelPos({ left: v.left, top: v.top, right: null });
        }
      }
    } catch {}
  }, [isOpen]);

  // ---- Persist size/pos ----
  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(panelSize));
    } catch {}
  }, [panelSize, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      if (
        typeof panelPos.left === "number" &&
        typeof panelPos.top === "number"
      ) {
        localStorage.setItem(
          PANEL_POS_KEY,
          JSON.stringify({ left: panelPos.left, top: panelPos.top })
        );
      }
    } catch {}
  }, [panelPos, isOpen]);

  // ---- Resize listeners ----
  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current.active) return;
      e.preventDefault();

      const dx = e.clientX - resizingRef.current.startX;
      const dy = e.clientY - resizingRef.current.startY;

      const nextW = clamp(
        resizingRef.current.startW + dx,
        MIN_PANEL_SIZE.width,
        MAX_PANEL_SIZE.width
      );
      const nextH = clamp(
        resizingRef.current.startH + dy,
        MIN_PANEL_SIZE.height,
        MAX_PANEL_SIZE.height
      );

      setPanelSize({ width: nextW, height: nextH });
    };

    const onUp = () => {
      if (!resizingRef.current.active) return;
      resizingRef.current.active = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = (e) => {
    e.preventDefault();
    resizingRef.current.active = true;
    resizingRef.current.startX = e.clientX;
    resizingRef.current.startY = e.clientY;
    resizingRef.current.startW = panelSize.width;
    resizingRef.current.startH = panelSize.height;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "nwse-resize";
  };

  // ---- Drag to move listeners (header only) ----
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current.active) return;
      e.preventDefault();

      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;

      const nextLeft = draggingRef.current.startLeft + dx;
      const nextTop = draggingRef.current.startTop + dy;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const maxLeft = Math.max(0, vw - panelSize.width);
      const maxTop = Math.max(0, vh - panelSize.height);

      setPanelPos({
        left: clamp(nextLeft, 0, maxLeft),
        top: clamp(nextTop, 0, maxTop),
        right: null,
      });
    };

    const onUp = () => {
      if (!draggingRef.current.active) return;
      draggingRef.current.active = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panelSize.width, panelSize.height]);

  const startDragPanel = (e) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target?.closest?.("button")) return;

    e.preventDefault();

    const rect = e.currentTarget.closest(".ai-panel")?.getBoundingClientRect();
    const currentLeft =
      typeof panelPos.left === "number" ? panelPos.left : rect?.left ?? 0;
    const currentTop =
      typeof panelPos.top === "number" ? panelPos.top : rect?.top ?? 0;

    draggingRef.current.active = true;
    draggingRef.current.startX = e.clientX;
    draggingRef.current.startY = e.clientY;
    draggingRef.current.startLeft = currentLeft;
    draggingRef.current.startTop = currentTop;

    setPanelPos({ left: currentLeft, top: currentTop, right: null });

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  // ---- Context debounce ----
  useEffect(() => {
    setLocalEdit(
      currentContext ? JSON.parse(JSON.stringify(currentContext)) : null
    );
    const t = setTimeout(() => setDebouncedContext(currentContext), 250);
    return () => clearTimeout(t);
  }, [currentContext]);

  // ---- History ----
  const loadHistory = async () => {
    const ctx = localEdit || debouncedContext || { tabId: null };
    const tabId = ctx?.tabId ?? null;

    // scope=tab이면 tabId 필요
    if (historyScope === "tab" && !tabId) {
      setHistory([]);
      setSelectedId(null);
      return;
    }

    const params = new URLSearchParams();
    params.set("scope", historyScope);
    if (historyScope === "tab") params.set("tabId", tabId);
    params.set("filter", historyFilter);
    if (historyQuery?.trim()) params.set("q", historyQuery.trim());
    params.set("limit", "200");

    try {
      const res = await fetch(`${HISTORY_API_URL}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = Array.isArray(data?.items) ? data.items : [];
      setHistory(items);

      if (items.length && !items.some((x) => x.id === selectedId))
        setSelectedId(items[0].id);
      if (!items.length) setSelectedId(null);
    } catch (e) {
      // 실패 시에도 UI는 살아있게
      setHistory([]);
      setSelectedId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, historyScope, tabKey, historyFilter, historyQuery]);

  const appendHistory = async (entry) => {
    try {
      const res = await fetch(HISTORY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json(); // { item: {...} } or {...}

      const item = created?.item ?? created;

      // 현재 scope가 all이면 항상 보임
      // scope가 tab이면 tabId가 같을 때만 보임
      const ctx = localEdit || debouncedContext || { tabId: null };
      const currentTabId = ctx?.tabId ?? null;

      const shouldShow =
        historyScope === "all" ||
        (historyScope === "tab" && item?.tabId && item.tabId === currentTabId);

      if (shouldShow) {
        setHistory((prev) => [item, ...(prev ?? [])].slice(0, 200));
        setSelectedId((prev) => prev ?? item.id);
      }
    } catch {
      // 저장 실패는 UI를 막지 않음(원하면 toast 처리)
    }
  };

  const clearHistory = async () => {
    const ctx = localEdit || debouncedContext || { tabId: null };
    const tabId = ctx?.tabId ?? null;

    if (historyScope === "tab" && !tabId) {
      setHistory([]);
      setSelectedId(null);
      return;
    }

    const params = new URLSearchParams();
    params.set("scope", historyScope);
    if (historyScope === "tab") params.set("tabId", tabId);

    try {
      const res = await fetch(`${HISTORY_API_URL}?${params.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {}

    setHistory([]);
    setSelectedId(null);
  };

  // ✅ History 복원도 "해당 탭"에만 반영
  const restoreFromEntry = (e) => {
    if (!e) return;
    const tab = e.tab ?? "chat";
    setActiveTab(tab);
    setTabIO((prev) => ({
      ...prev,
      [tab]: { input: e.input ?? "", output: e.output ?? "" },
    }));
  };

  const reapplyCommand = (e) => {
    if (!e?.parsed) return;
    if (typeof onCommand !== "function") return;
    const parsed = e.parsed;
    if (!parsed.action || parsed.action === "none") return;

    onCommand({ ...parsed, tabId: e.tabId ?? null, type: e.ctxType ?? null });

    // control 탭으로 이동 + 해당 탭 output만 기록
    setActiveTab("control");
    setTabIO((prev) => ({
      ...prev,
      control: {
        ...(prev.control ?? {}),
        output: parsed.message ?? "명령을 다시 적용했습니다.",
      },
    }));
  };

  const copyText = async (t) => {
    try {
      await navigator.clipboard.writeText(t ?? "");
    } catch {}
  };

  // ✅ callLLM: meta.tab에 해당하는 탭 output만 업데이트 (탭 이동해도 안전)
  const callLLM = async (messages, meta = {}) => {
    const tab = meta.tab ?? activeTab;

    setIsLoading(true);
    setTabIO((prev) => ({
      ...prev,
      [tab]: { ...(prev?.[tab] ?? {}), output: "" },
    }));

    const ctx = localEdit || debouncedContext || { type: null };
    const entryBase = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: nowISO(),
      tabId: ctx?.tabId ?? null,
      ctxType: ctx?.type ?? null,
      ctxTitle: ctx?.title ?? null,
      tab,
      input: meta.input ?? tabIO?.[tab]?.input ?? "",
    };

    try {
      const res = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-5-chat-latest", messages }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const data = await res.json();
      const content =
        data?.choices?.[0]?.message?.content ?? safeJsonStringify(data);

      const parsed = normalizeCmd(extractJsonFromText(content));
      const outputTextBase = parsed?.message ? parsed.message : content;

      const outputText =
        tab === "control"
          ? buildControlResultText({
              parsed,
              ctx: localEdit || debouncedContext || currentContext,
              rawMessage: outputTextBase,
            })
          : outputTextBase;

      setTabIO((prev) => ({
        ...prev,
        [tab]: { ...(prev?.[tab] ?? {}), output: outputText },
      }));

      appendHistory({
        ...entryBase,
        output: outputText,
        raw: content,
        parsed,
      });

      if (
        parsed &&
        parsed.action !== "none" &&
        typeof onCommand === "function"
      ) {
        onCommand({
          ...parsed,
          tabId: ctx?.tabId ?? null,
          type: ctx?.type ?? null,
        });
      }
    } catch (err) {
      const msg = String(err?.message ?? err);
      setTabIO((prev) => ({
        ...prev,
        [tab]: { ...(prev?.[tab] ?? {}), output: msg },
      }));
      appendHistory({ ...entryBase, output: msg, raw: msg, parsed: null });
    } finally {
      setIsLoading(false);
    }
  };

  const ctx = localEdit || debouncedContext || { type: null };
  const prefix = buildContextPrefix(ctx);

  const handleExplainGraph = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 학습용 설명가다. 현재 그래프/탭 정보를 바탕으로 관찰 포인트를 한국어로 마크다운으로 정리해라. 강조(**), 목록, 수식은 LaTeX(\\( \\), $$ $$)를 사용해라.",
      },
      {
        role: "user",
        content: prefix + "아래 정보를 설명해줘.\n\n" + safeJsonStringify(ctx),
      },
    ];
    callLLM(messages, { tab: "explain", input: safeJsonStringify(ctx) });
  };

  const handleEquation = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수식 정리 도우미다. 표준 형태로 정리하고 문법/연산자 우선순위를 한국어로 마크다운으로 설명해라. 필요한 수식 표기는 LaTeX(\\( \\), $$ $$)를 사용해라.",
      },
      { role: "user", content: prefix + "수식:\n" + activeInput },
    ];
    callLLM(messages, { tab: "equation", input: activeInput });
  };

  const handleChat = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 Q&A 튜터다. 질문에 관련 개념을 한국어로 마크다운으로 설명해라. 필요하면 단계적으로 풀어줘. 필요한 수식 표기는 LaTeX(\\( \\), $$ $$)를 사용해라.",
      },
      { role: "user", content: prefix + "질문:\n" + activeInput },
    ];
    callLLM(messages, { tab: "chat", input: activeInput });
  };

  const handleControl = () => {
    if (!activeInput.trim()) {
      // control 탭 output만 쓰도록 명시적으로 업데이트
      setTabIO((prev) => ({
        ...prev,
        control: {
          ...(prev.control ?? {}),
          output:
            "요청을 입력해 주세요. 예) '최대값 표시해줘', '근 표시해줘', '교점 표시해줘', '마커 지워줘'",
        },
      }));
      return;
    }
    const messages = [
      {
        role: "developer",
        content: buildControlExtractorPrompt(
          debouncedContext || currentContext
        ),
      },
      { role: "user", content: prefix + "UserRequest:\n" + activeInput },
    ];
    callLLM(messages, { tab: "control", input: activeInput });
  };

  // ✅ 예시(quick fill)
  const EQUATION_EXAMPLES = [
    "0.5*x^3 - 2*x",
    "sin(x) + 0.3*cos(2*x)",
    "(x-1)^2 + 3",
    "exp(-x^2) * sin(3*x)",
  ];
  const CHAT_EXAMPLES = [
    "sin(x) 그래프는 왜 주기적인가요?",
    "미분과 접선의 관계를 예시로 설명해줘",
    "극값과 변곡점 차이를 쉽게 설명해줘",
    "정적분이 의미하는 바를 직관적으로 알려줘",
  ];

  // ---- History compute ----
  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return (history ?? []).filter((e) => {
      if (historyFilter !== "all" && e.tab !== historyFilter) return false;
      if (!q) return true;
      const hay = `${e.tab ?? ""} ${e.ctxTitle ?? ""} ${e.input ?? ""} ${
        e.output ?? ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [history, historyFilter, historyQuery]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const e of filteredHistory) {
      const k = dayKey(e.ts);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return Array.from(m.entries()).map(([k, arr]) => [k, arr]);
  }, [filteredHistory]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (history ?? []).find((x) => x.id === selectedId) ?? null;
  }, [history, selectedId]);

  if (!isOpen) return null;

  const panelStyle =
    typeof panelPos.left === "number"
      ? { left: panelPos.left, top: panelPos.top, right: "auto" }
      : { right: DEFAULT_PANEL_POS.right, top: DEFAULT_PANEL_POS.top };

  return (
    <>
      <div className="ai-panel-backdrop" onClick={onClose} />
      <aside
        className="ai-panel"
        style={{
          width: panelSize.width,
          height: panelSize.height,
          ...panelStyle,
        }}
      >
        <header
          className="ai-panel-header ai-panel-header-draggable"
          onMouseDown={startDragPanel}
          title="드래그로 패널 이동"
        >
          <div className="ai-panel-title">AI Panel</div>
          <button className="ai-panel-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ai-panel-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={
                "ai-panel-tab" +
                (activeTab === tab.id ? " ai-panel-tab-active" : "")
              }
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ai-panel-body">
          {activeTab === "explain" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">현재 탭 정보</div>

              <ContextSummary ctx={ctx} />

              <div className="ai-ctx-actions">
                <button
                  className="ai-btn"
                  onClick={() => setShowCtxDetail((v) => !v)}
                >
                  {showCtxDetail ? "상세 숨기기" : "상세 보기(JSON)"}
                </button>
              </div>

              {showCtxDetail && (
                <pre className="ai-panel-result-text">
                  {safeJsonStringify(ctx)}
                </pre>
              )}

              <button
                className="ai-panel-primary-btn"
                onClick={handleExplainGraph}
                disabled={isLoading}
              >
                {isLoading ? "생성 중..." : "그래프 설명 생성"}
              </button>

              <div className="ai-panel-result">
                {activeOutput ? (
                  <MarkdownResult text={activeOutput} variant="explain" />
                ) : (
                  <div className="ai-panel-placeholder">
                    출력이 여기 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "equation" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">수식 입력</div>

              <div className="ai-quick-examples">
                {EQUATION_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    className="ai-chip"
                    onClick={() => setInputText(ex)}
                    disabled={isLoading}
                  >
                    {ex}
                  </button>
                ))}
              </div>

              <textarea
                className="ai-panel-textarea"
                placeholder={`예시:\n- 0.5*x^3 - 2*x\n- sin(x) + 0.3*cos(2*x)\n- (x-1)^2 + 3\n\n입력한 수식을 정리하고 설명합니다.`}
                value={activeInput}
                onChange={(e) => setInputText(e.target.value)}
              />

              <button
                className="ai-panel-primary-btn"
                onClick={handleEquation}
                disabled={isLoading}
              >
                {isLoading ? "정리 중..." : "수식 정리/설명"}
              </button>

              <div className="ai-panel-result">
                {activeOutput ? (
                  <MarkdownResult text={activeOutput} variant="equation" />
                ) : (
                  <div className="ai-panel-placeholder">
                    출력이 여기 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">질문</div>

              <div className="ai-quick-examples">
                {CHAT_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    className="ai-chip"
                    onClick={() => setInputText(ex)}
                    disabled={isLoading}
                  >
                    {ex}
                  </button>
                ))}
              </div>

              <textarea
                className="ai-panel-textarea"
                placeholder={`예시:\n- sin(x) 그래프는 왜 주기적인가요?\n- 미분과 접선의 관계를 예시로 설명해줘\n- 극값과 변곡점 차이를 쉽게 설명해줘\n\n질문을 입력하면 개념+예시로 답변합니다.`}
                value={activeInput}
                onChange={(e) => setInputText(e.target.value)}
              />

              <button
                className="ai-panel-primary-btn"
                onClick={handleChat}
                disabled={isLoading}
              >
                {isLoading ? "답변 생성 중..." : "질문 보내기"}
              </button>

              <div className="ai-panel-result">
                {activeOutput ? (
                  <MarkdownResult text={activeOutput} variant="chat" />
                ) : (
                  <div className="ai-panel-placeholder">
                    출력이 여기 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "control" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">그래프 조작</div>

              <div className="ai-control-presets">
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => setInputText("최대값 표시해줘")}
                >
                  Max
                </button>
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => setInputText("최소값 표시해줘")}
                >
                  Min
                </button>
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => setInputText("근 표시해줘")}
                >
                  Roots
                </button>
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => setInputText("교점 표시해줘")}
                >
                  Intersections
                </button>
                <button
                  className="ai-btn danger"
                  disabled={isLoading}
                  onClick={() => setInputText("마커 지워줘")}
                >
                  Clear
                </button>
              </div>

              <textarea
                className="ai-panel-textarea"
                placeholder="예) 최대값 표시해줘 / 근 표시해줘 / 교점 표시해줘 / 마커 지워줘"
                value={activeInput}
                onChange={(e) => setInputText(e.target.value)}
              />

              <button
                className="ai-panel-primary-btn"
                onClick={handleControl}
                disabled={isLoading}
              >
                {isLoading ? "실행 중..." : "명령 실행"}
              </button>

              <div className="ai-panel-result">
                {activeOutput ? (
                  <MarkdownResult text={activeOutput} variant="control" />
                ) : (
                  <div className="ai-panel-placeholder">결과가 표시됩니다.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="ai-history">
              <div className="ai-history-topbar">
                <div className="ai-history-topbar-left">
                  <select
                    className="ai-select"
                    value={historyScope}
                    onChange={(e) => setHistoryScope(e.target.value)}
                  >
                    <option value="tab">현재 탭</option>
                    <option value="all">전체</option>
                  </select>

                  <select
                    className="ai-select"
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                  >
                    <option value="all">전체</option>
                    <option value="control">조작</option>
                    <option value="chat">질문</option>
                    <option value="equation">수식</option>
                    <option value="explain">설명</option>
                  </select>

                  <input
                    className="ai-input"
                    placeholder="검색"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                  />
                </div>

                <div className="ai-history-topbar-right">
                  <button
                    className="ai-btn"
                    onClick={() => loadHistory()}
                    title="새로고침"
                  >
                    ⟳
                  </button>
                  <button
                    className="ai-btn danger"
                    onClick={clearHistory}
                    title="삭제"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="ai-history-grid">
                <div className="ai-history-list">
                  {grouped.length === 0 ? (
                    <div className="ai-panel-placeholder">기록이 없습니다.</div>
                  ) : (
                    grouped.map(([k, arr]) => (
                      <div key={k} className="ai-history-group">
                        <div className="ai-history-day">{k}</div>
                        <div className="ai-history-items">
                          {arr.map((e) => {
                            const isSel = e.id === selectedId;
                            const title = truncate(
                              e.ctxTitle ?? "(untitled)",
                              34
                            );
                            const inPrev = truncate(e.input, 46);
                            const outPrev = truncate(e.output, 56);

                            return (
                              <button
                                key={e.id}
                                className={
                                  "ai-history-row" + (isSel ? " selected" : "")
                                }
                                onClick={() => setSelectedId(e.id)}
                                title={formatKST(e.ts)}
                              >
                                <div className="ai-history-row-top">
                                  <span className={"ai-pill " + (e.tab ?? "")}>
                                    {badgeLabel(e.tab)}
                                  </span>
                                  <span className="ai-history-row-title">
                                    {title}
                                  </span>
                                  <span className="ai-history-row-time">
                                    {relativeTime(e.ts)}
                                  </span>
                                </div>
                                <div className="ai-history-row-line">
                                  <span className="ai-dim">In</span>
                                  <span className="ai-strong">
                                    {inPrev || "-"}
                                  </span>
                                </div>
                                <div className="ai-history-row-line">
                                  <span className="ai-dim">Out</span>
                                  <span className="ai-dim2">
                                    {outPrev || "-"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="ai-history-detail">
                  {!selected ? (
                    <div className="ai-panel-placeholder">
                      왼쪽에서 기록을 선택하세요.
                    </div>
                  ) : (
                    <>
                      <div className="ai-history-detail-head">
                        <div className="ai-history-detail-head-left">
                          <span className={"ai-pill " + (selected.tab ?? "")}>
                            {badgeLabel(selected.tab)}
                          </span>
                          <div className="ai-history-detail-title">
                            <div className="ai-history-detail-title-main">
                              {selected.ctxTitle ?? "(untitled)"}
                            </div>
                            <div className="ai-history-detail-sub">
                              {formatKST(selected.ts)}
                            </div>
                          </div>
                        </div>

                        <div className="ai-history-detail-actions">
                          <button
                            className="ai-iconbtn"
                            onClick={() => restoreFromEntry(selected)}
                            title="다시보기"
                          >
                            ↩
                          </button>
                          <button
                            className="ai-iconbtn"
                            onClick={() => copyText(selected.output)}
                            title="출력 복사"
                          >
                            ⧉
                          </button>
                          <button
                            className="ai-iconbtn"
                            onClick={() => copyText(selected.input)}
                            title="입력 복사"
                          >
                            ⌁
                          </button>
                          {selected?.parsed?.action &&
                            selected.parsed.action !== "none" && (
                              <button
                                className="ai-iconbtn"
                                onClick={() => reapplyCommand(selected)}
                                title="재적용"
                              >
                                ⟲
                              </button>
                            )}
                          <button
                            className={
                              "ai-iconbtn" + (showRaw ? " active" : "")
                            }
                            onClick={() => setShowRaw((v) => !v)}
                            title="모델 응답 원문(가공 전) 보기"
                          >
                            Raw
                          </button>
                        </div>
                      </div>

                      <div className="ai-history-detail-body">
                        <div className="ai-card">
                          <div className="ai-card-h">Input</div>

                          {selected.tab === "explain" ? (
                            <div className="ai-card-md">
                              <ContextSummary
                                ctx={safeParseJSON(selected.input)}
                              />
                              <div className="ai-inline-actions">
                                <button
                                  className="ai-btn"
                                  onClick={() => copyText(selected.input)}
                                >
                                  JSON 복사
                                </button>
                              </div>
                            </div>
                          ) : (
                            <pre className="ai-card-pre">
                              {selected.input ?? ""}
                            </pre>
                          )}
                        </div>

                        <div className="ai-card">
                          <div className="ai-card-h">Output</div>
                          <div className="ai-card-md">
                            <MarkdownResult
                              text={selected.output ?? ""}
                              variant={selected.tab ?? "history"}
                            />
                          </div>
                        </div>

                        {showRaw && (
                          <div className="ai-card">
                            <div className="ai-card-h">Raw</div>
                            <pre className="ai-card-pre">
                              {selected.raw ?? ""}
                            </pre>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="ai-history-footnote">
                History는 localStorage에 저장됩니다. (현재 탭 / 전체)
              </div>
            </div>
          )}
        </div>

        <footer className="ai-panel-footer">
          <div className="ai-panel-helper-text">AI 출력은 누적 저장됩니다.</div>
        </footer>

        <div
          className="ai-panel-resizer"
          onMouseDown={startResize}
          title="드래그로 크기 조절"
        />
      </aside>
    </>
  );
}
