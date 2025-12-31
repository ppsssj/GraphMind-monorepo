import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import "../styles/HowtoWizard.css";

const MiniVaultDemo = forwardRef(function MiniVaultDemo(_, ref) {
  const fgRef = useRef(null);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [glowIds, setGlowIds] = useState(() => new Set());
  const [log, setLog] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState(null); // 추가: hover된 노드 ID 상태
  const [clickedNodeId, setClickedNodeId] = useState(null); // 클릭된 노드 ID 상태

  // 이웃/노드 인덱스 (드래그 동기 이동용) // ★
  const neighborsRef = useRef(new Map());
  const nodeByIdRef = useRef(new Map());

  // 태그 계층 정의
  const tagMap = {
    sin: { color: "#22d3ee", parent: "삼각함수" },
    cos: { color: "#f472b6", parent: "삼각함수" },
    tan: { color: "#a3e635", parent: "삼각함수" },
    log: { color: "#f59e0b", parent: "함수" },
  };

  // tag 노드 색 (짙은 계열)
  const tagColors = {
    sin: "#0ea5e9",
    cos: "#db2777",
    tan: "#65a30d",
    log: "#d97706",
  };

  // 상위 함수 노드 색
  const superTagColors = {
    "삼각함수": "#9333ea",
    "함수": "#eab308",
  };

  // 노드 추가 (수식 중심, 좌우로 tag / 상위tag)
  const addNode = (id, tag = "etc") => {
    setGraph((prev) => {
      if (prev.nodes.some((n) => n.id === id)) return prev;

      const tagInfo = tagMap[tag] || { color: "#9ca3af", parent: null };
      const nodeColor = tagInfo.color;
      const parentTag = tagInfo.parent;

      const newNode = {
        id,
        tag,
        color: nodeColor,
        isTag: false,
        isSuperTag: false,
        x: 0,
        y: 0,
      };

      let newNodes = [...prev.nodes];
      let newLinks = [...prev.links];

      const tagNodeId = `tag:${tag}`;
      if (!prev.nodes.some((n) => n.id === tagNodeId)) {
        newNodes.push({
          id: tagNodeId,
          tag,
          color: tagColors[tag] || "#6b7280",
          isTag: true,
          isSuperTag: false,
        });
      }
      newLinks.push({ source: tagNodeId, target: id });

      if (parentTag) {
        const superTagId = `tag:${parentTag}`;
        if (!prev.nodes.some((n) => n.id === superTagId)) {
          newNodes.push({
            id: superTagId,
            tag: parentTag,
            color: superTagColors[parentTag] || "#ffffff",
            isTag: false,
            isSuperTag: true,
          });
        }
        newLinks.push({ source: id, target: superTagId });
      }

      return {
        nodes: [...newNodes, newNode],
        links: newLinks,
      };
    });
  };

  const pulse = (ids) => {
    const s = new Set(ids);
    setGlowIds(s);
    setTimeout(() => setGlowIds(new Set()), 1000);
  };

  // 외부에서 호출할 단계 API
  useImperativeHandle(ref, () => ({
    step1() {
      addNode("sin(x)", "sin");
      pulse(["sin(x)"]);
      setLog("Step 1: sin(x) 추가됨 (sinTag → 삼각함수Tag).");
    },
    step2() {
      addNode("sin(x^2)", "sin");
      pulse(["sin(x^2)", "sin(x)"]);
      setLog("Step 2: sin(x^2) 추가됨 (sinTag → 삼각함수Tag).");
    },
    step3() {
      addNode("cos(x)", "cos");
      pulse(["cos(x)"]);
      setLog("Step 3: cos(x) 추가됨 (cosTag → 삼각함수Tag).");
    },
    step4() {
      addNode("log(x)", "log");
      pulse(["log(x)"]);
      setLog("Step 4: log(x) 추가됨 (logTag → 함수Tag).");
    },
    reset() {
      setGraph({ nodes: [], links: [] });
      setGlowIds(new Set());
      setLog("그래프 초기화됨.");
    },
  }));

  const linkColor = (link) => {
    const a = typeof link.source === "object" ? link.source.id : link.source;
    const b = typeof link.target === "object" ? link.target.id : link.target;
    if (glowIds.has(a) || glowIds.has(b)) return "rgba(255,255,255,0.95)";
    return "rgba(200,200,200,0.5)";
  };

  // 이웃/노드 인덱스 재계산 // ★
  useEffect(() => {
    const idMap = new Map();
    graph.nodes.forEach((n) => idMap.set(n.id, n));
    nodeByIdRef.current = idMap;

    const nb = new Map();
    graph.nodes.forEach((n) => nb.set(n.id, new Set()));
    graph.links.forEach((l) => {
      const a = typeof l.source === "object" ? l.source.id : l.source;
      const b = typeof l.target === "object" ? l.target.id : l.target;
      nb.get(a)?.add(b);
      nb.get(b)?.add(a);
    });
    neighborsRef.current = nb;
  }, [graph]);

  // —— Force 튜닝 —— (수식은 고정하지 않음) // 기존 그대로
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;

    const isObj = (v) => v && typeof v === "object";
    const isFormula = (n) => n && !n.isTag && !n.isSuperTag;

    const linkF = fg.d3Force("link");
    if (linkF) {
      linkF
        .id((d) => d.id)
        .distance((link) => {
          const a = isObj(link.source) ? link.source : graph.nodes.find(n => n.id === link.source);
          const b = isObj(link.target) ? link.target : graph.nodes.find(n => n.id === link.target);
          if ((a?.isTag && isFormula(b)) || (b?.isTag && isFormula(a))) return 70;
          if ((a?.isSuperTag && isFormula(b)) || (b?.isSuperTag && isFormula(a))) return 140;
          return 100;
        })
        .strength(1);
    }

    const chargeF = fg.d3Force("charge");
    if (chargeF) {
      chargeF.strength(-160).distanceMax(400).theta(0.9);
    }

    fg.d3Force("center", null);
    fg.d3ReheatSimulation();
  }, [graph.nodes, graph.links.length]);

  return (
    <div className="mvw-graph" style={{ position: "relative" }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graph}
        width={360}
        height={300}
        backgroundColor="#0b0b10"
        nodeRelSize={6}
        linkColor={linkColor}
        linkWidth={1}
        cooldownTicks={90}
        nodeLabel={(node) => {
          if (node.isTag) return `${node.tag}Tag`;
          if (node.isSuperTag) return `${node.tag}Tag`;
          return `${node.id}\n[tag=${node.tag}]`;
        }}
        nodeCanvasObjectMode={() => "after"}
        nodeCanvasObject={(node, ctx, scale) => {
          const radius = node.isSuperTag
            ? 14 / scale
            : node.isTag
            ? 10 / scale
            : 8 / scale;

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle =
            node.id === clickedNodeId
              ? "#ff6600" // 클릭된 노드 색상
              : node.id === hoveredNodeId
              ? "#ffcc00" // hover된 노드 색상
              : node.color || "#6b7280";
          ctx.fill();
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = node.isSuperTag
            ? "gold"
            : node.isTag
            ? "white"
            : "rgba(255,255,255,0.7)";
          ctx.stroke();

          let label, baseline, ty;
          if (node.isSuperTag) {
            label = `${node.tag}Tag`;
            baseline = "middle";
            ty = node.y;
          } else if (node.isTag) {
            label = `${node.tag}Tag`;
            baseline = "middle";
            ty = node.y;
          } else {
            label = `${node.id}`;
            baseline = "top";
            ty = node.y + radius + 2 / scale;
          }

          const fontSize = node.isSuperTag
            ? 14 / scale
            : node.isTag
            ? 12 / scale
            : 11 / scale;

          ctx.font = `${node.isSuperTag ? "bold " : ""}${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = node.isSuperTag
            ? "white"
            : node.isTag
            ? "white"
            : "#e5e7eb";
          ctx.textAlign = "center";
          ctx.textBaseline = baseline;
          ctx.fillText(label, node.x, ty);
        }}
        onNodeHover={(node) => setHoveredNodeId(node ? node.id : null)}
        onNodeClick={(node) => setClickedNodeId(node ? node.id : null)}
      />

      {/* 로그 설명 */}
      <div
        className="graph-log"
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          fontSize: "11px",
          color: "#9ca3af",
          background: "rgba(0,0,0,0.6)",
          padding: "4px 8px",
          borderRadius: "6px",
          maxWidth: "240px",
        }}
      >
        {log}
      </div>
    </div>
  );
});

export default MiniVaultDemo;
