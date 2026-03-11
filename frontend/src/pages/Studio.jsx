// src/pages/Studio.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import LeftPanel from "../ui/LeftPanel";
import Toolbar from "../ui/Toolbar";
import Curve3DToolbar from "../ui/Curve3DToolbar";
import Surface3DToolbar from "../ui/Surface3DToolbar";
import GraphView from "../ui/GraphView";
import Array3DView from "../ui/Array3DView";
import Array3DToolbar from "../ui/Array3DToolBar";
import Curve3DView from "../ui/Curve3DView";
import Surface3DView from "../ui/Surface3DView";
import { dummyResources } from "../data/dummyEquations";
import { api } from "../api/apiClient";
import {
  VAULT_KEY,
  uid,
  titleFromFormula,
  normalizeFormula,
  exprToFn,
  cloneMarkers,
  cloneCurve3D,
  cloneSurface3D,
  curve3DSnapshotChanged,
  surface3DSnapshotChanged,
  isCurve3DCommitPatch,
  isSurface3DCommitPatch,
  normalizeCurve3DPatch,
  normalizeSurface3DPatch,
  fitPolyCoeffs,
  coeffsToFn,
  aiMakeParamFn,
  aiFitCurve3DFromMarkers,
  aiStripEq,
  aiMakeScalarFn2D,
  aiFitSurfaceDeltaPolynomial,
  aiSampleSurfaceExtremum,
  snapPointsToFn,
  fitRuleFromPoints,
  sanitizeCurve3DForPersist,
  sanitizeSurface3DForPersist,
  buildCurve3DInitialState,
  buildSurface3DInitialState,
} from "./studio/studioUtils";
// (studioReducer import removed: not used in this Studio-only integration)
import "../styles/Studio.css";
import AIPanel from "../components/ai/AIPanel";

export default function Studio() {
  const location = useLocation();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const [vaultResources, setVaultResources] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState("");

  const refreshVaultResources = useCallback(async () => {
    setVaultLoading(true);
    setVaultError("");
    try {
      // full???熬곣뫖利?猷몃뢾???curve/surface/studio ??????????썹땟???????썹땟???노꼥筌???쎛 ??롪퍓梨띄댚???
      const items = await api.listVaultItems({ view: "full" });
      const arr = Array.isArray(items) ? items : [];
      setVaultResources(arr);

      // (????ｋ?? fallback ?????
      try {
        localStorage.setItem("vaultResources", JSON.stringify(arr));
      } catch {}
    } catch (e) {
      const msg = e?.message || String(e);
      setVaultError(msg);

      // fallback: localStorage ??dummy
      try {
        const raw = localStorage.getItem("vaultResources");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setVaultResources(parsed);
          else setVaultResources(dummyResources);
        } else {
          setVaultResources(dummyResources);
        }
      } catch {
        setVaultResources(dummyResources);
      }

      if (Number(e?.status) === 401) {
        // ????썹땟???????intro????⑤슢??????꿔꺂??節뉖き?????醫딆쓧???
        // navigate("/", { replace: true });
      }
    } finally {
      setVaultLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshVaultResources();
  }, [refreshVaultResources]);

  // ??equation ??????怨룸섟 ????꾣뤃?饔낃퀣????좏뀴???LeftPanel "Equations" ???????????
  const equationsFromVault = useMemo(
    () => vaultResources.filter((r) => r.type === "equation"),
    [vaultResources]
  );

  // ?潁??용끏????????
  const rawType = location.state?.type ?? "equation";
  const initialType = rawType;

  const initialContent =
    initialType === "array3d" ? location.state?.content || [[[0]]] : null;

  // Vault????????嚥▲굧????癲? / ??????癲ル슢?뤸뤃?꿔궘????????됰Ŧ?뉒뜏類ｋ쭫???됱삩?
  const fromVault = location.state?.from === "vault";
  const initialVaultId =
    fromVault &&
    (initialType === "equation" ||
      initialType === "curve3d" ||
      initialType === "surface3d")
      ? location.state?.id ?? null
      : null;

  // ??curve3d ?潁??용끏???????쀪쑴??嚥????
  const initialCurve3d =
    initialType === "curve3d"
      ? (() => {
          const xExpr =
            location.state?.curve3d?.xExpr ?? location.state?.xExpr ?? "cos(t)";
          const yExpr =
            location.state?.curve3d?.yExpr ?? location.state?.yExpr ?? "sin(t)";
          const zExpr =
            location.state?.curve3d?.zExpr ?? location.state?.zExpr ?? "0";

          const tMin =
            location.state?.curve3d?.tMin ?? location.state?.tMin ?? 0;
          const tMax =
            location.state?.curve3d?.tMax ??
            location.state?.tMax ??
            6.283185307179586;
          const samples =
            location.state?.curve3d?.samples ?? location.state?.samples ?? 400;

          const editMode =
            location.state?.curve3d?.editMode ??
            location.state?.editMode ??
            "drag";

          const markers = location.state?.curve3d?.markers ??
            location.state?.markers ?? [
              { id: 0, t: tMin },
              { id: 1, t: (tMin + tMax) / 2, label: "vertex" },
              { id: 2, t: tMax },
            ];

          const baseXExpr = location.state?.curve3d?.baseXExpr ?? xExpr;
          const baseYExpr = location.state?.curve3d?.baseYExpr ?? yExpr;
          const baseZExpr = location.state?.curve3d?.baseZExpr ?? zExpr;

          return {
            baseXExpr,
            baseYExpr,
            baseZExpr,
            xExpr,
            yExpr,
            zExpr,
            tMin,
            tMax,
            samples,
            markers,
            editMode,
          };
        })()
      : undefined;

  // ??surface3d ?潁??용끏???????쀪쑴??嚥????
  const initialSurface3d =
    initialType === "surface3d"
      ? {
          expr:
            location.state?.surface3d?.expr ??
            location.state?.expr ??
            "sin(x) * cos(y)",
          xMin: location.state?.surface3d?.xMin ?? location.state?.xMin ?? -5,
          xMax: location.state?.surface3d?.xMax ?? location.state?.xMax ?? 5,
          yMin: location.state?.surface3d?.yMin ?? location.state?.yMin ?? -5,
          yMax: location.state?.surface3d?.yMax ?? location.state?.yMax ?? 5,
          nx: location.state?.surface3d?.nx ?? location.state?.nx ?? 80,
          ny: location.state?.surface3d?.ny ?? location.state?.ny ?? 80,
          gridMode:
            location.state?.surface3d?.gridMode ??
            location.state?.gridMode ??
            "major",
          gridStep:
            location.state?.surface3d?.gridStep ??
            location.state?.gridStep ??
            1,
          minorDiv:
            location.state?.surface3d?.minorDiv ??
            location.state?.minorDiv ??
            4,
        }
      : undefined;

  const initialFormula =
    initialType === "equation"
      ? normalizeFormula(
          typeof location.state?.formula === "string" &&
            location.state.formula.trim()
            ? location.state.formula.trim()
            : "0.5*x^3 - 2*x"
        )
      : "x";

  const firstTabId = useMemo(() => uid(), []);
  const [tabs, setTabs] = useState(() => ({
    byId: {
      [firstTabId]: {
        id: firstTabId,
        title:
          initialType === "equation"
            ? titleFromFormula(initialFormula)
            : location.state?.title ??
              (initialType === "array3d" ? "Array" : "Curve3D"),
      },
    },
    all: [firstTabId],
  }));

  const makeInitialPoints = useCallback(
    (formula, xmin = -8, xmax = 8, n = 8) => {
      const fn0 = exprToFn(formula);
      const xs = Array.from(
        { length: n },
        (_, i) => xmin + ((xmax - xmin) * i) / (n - 1)
      );
      return xs.map((x, i) => ({ id: i, x, y: Number(fn0(x)) || 0 }));
    },
    []
  );

  // ????????븐뻤???vaultId?????ㅻ쿋??
  const [tabState, setTabState] = useState(() => ({
    [firstTabId]: {
      type: initialType,
      equation: initialType === "equation" ? initialFormula : undefined,
      content: initialType === "array3d" ? initialContent : undefined,
      curve3d: initialType === "curve3d" ? initialCurve3d : undefined,
      surface3d: initialType === "surface3d" ? initialSurface3d : undefined,
      xmin: -8,
      xmax: 8,
      gridStep: 1,
      gridMode: "major",
      viewMode: "both",
      editMode: "drag",
      degree: 3,
      ruleMode: "free",
      rulePolyDegree: 3,
      ruleError: null,
      points:
        initialType === "equation" ? makeInitialPoints(initialFormula) : [],
      ver: 0,
      vaultId: initialVaultId,
      markers: [],
    },
  }));

  const [isSplit, setIsSplit] = useState(false);
  const [focusedPane, setFocusedPane] = useState("left");

  const [arrayThreshold, setArrayThreshold] = useState(0);
  const [arrayAxisOrder, setArrayAxisOrder] = useState("zyx");

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [panes, setPanes] = useState({
    left: { ids: [firstTabId], activeId: firstTabId },
    right: { ids: [], activeId: null },
  });

  // ??????沅???쒙쭫?????嶺뚮Ŋ?띄낼???嶺뚮??????꿔꺂????쭍??active tab????醫딆쓧??癲ル슢???몄쒜嚥▲룗??????꾣뤃管逾?ref
  const panesRef = useRef(panes);
  const focusedPaneRef = useRef(focusedPane);

  useEffect(() => {
    panesRef.current = panes;
  }, [panes]);
  useEffect(() => {
    focusedPaneRef.current = focusedPane;
  }, [focusedPane]);

  // ???곗뒩泳??怨ㅽ렫????嶺뚮Ĳ?됪뤃??
  const [leftPct, setLeftPct] = useState(55);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const container = document.querySelector(".vscode-split-root");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ???? Undo/Redo: per-tab history ??????????????????????????
  const tabStateRef = useRef(null);
  const tabsRef = useRef(null);
  const historyByTabRef = useRef({});
  const dragTxnRef = useRef(null);

  useEffect(() => {
    tabStateRef.current = tabState;
  }, [tabState]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const ensureHistory = useCallback((tabId) => {
    const map = historyByTabRef.current;
    if (!map[tabId]) map[tabId] = { undo: [], redo: [] };
    return map[tabId];
  }, []);

  // ??Toolbar????????????undo/redo ??醫딆쓧?????????????????????ㅻ덫??(???낇뀘???????????ㅼ굡??
  const getHistoryCounts = useCallback((tabId) => {
    const h = historyByTabRef.current?.[tabId];
    return {
      undo: h?.undo?.length ?? 0,
      redo: h?.redo?.length ?? 0,
    };
  }, []);

  const beginMoveTxn = useCallback((tabId) => {
    if (!tabId) return;
    const cur = tabStateRef.current?.[tabId];
    if (!cur || cur.type !== "equation") return;
    if (
      dragTxnRef.current &&
      dragTxnRef.current.tabId === tabId &&
      dragTxnRef.current.kind === "equation"
    )
      return;

    dragTxnRef.current = {
      tabId,
      kind: "equation",
      before: {
        equation: cur.equation,
        points: cur.points.map((p) => ({ ...p })),
      },
      vaultId: cur.vaultId ?? null,
    };
  }, []);

  const beginCurve3DTxn = useCallback((tabId) => {
    if (!tabId) return;
    const cur = tabStateRef.current?.[tabId];
    if (!cur || cur.type !== "curve3d") return;
    if (
      dragTxnRef.current &&
      dragTxnRef.current.tabId === tabId &&
      dragTxnRef.current.kind === "curve3d"
    )
      return;

    dragTxnRef.current = {
      tabId,
      kind: "curve3d",
      before: { curve3d: cloneCurve3D(cur.curve3d) },
      vaultId: cur.vaultId ?? null,
    };
  }, []);

  const beginSurface3DTxn = useCallback((tabId) => {
    if (!tabId) return;
    const cur = tabStateRef.current?.[tabId];
    if (!cur || cur.type !== "surface3d") return;
    if (
      dragTxnRef.current &&
      dragTxnRef.current.tabId === tabId &&
      dragTxnRef.current.kind === "surface3d"
    )
      return;

    dragTxnRef.current = {
      tabId,
      kind: "surface3d",
      before: { surface3d: cloneSurface3D(cur.surface3d) },
      vaultId: cur.vaultId ?? null,
    };
  }, []);

  // ???? Vault persistence (backend) ????????????????????????????????????????????????????????????????????????????????????????
  const isUnauthorized = (err) => Number(err?.status) === 401;

  // ??vault PATCH ?癲ル슢?뤸뤃?? apiClient??patchVaultItem/patchVaultContent??醫딆쓧? ????ㅼ굡?類㎮뵾?Studio??????꿔꺂??????癲ル슢????)

  const vaultRequest = useCallback(
    async (path, { method = "PATCH", body } = {}) => {
      const token = localStorage.getItem("gm_token") || "";

      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const raw = await res.text();
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = raw;
      }

      if (!res.ok) {
        const err = new Error("API_ERROR");
        err.status = res.status;
        err.body = parsed;
        throw err;
      }
      return parsed;
    },
    []
  );

  const patchVaultItemCompat = useCallback(
    (vaultId, patch) =>
      api.patchVaultItem
        ? api.patchVaultItem(vaultId, patch)
        : vaultRequest(`/api/v1/vault/items/${vaultId}`, {
            method: "PATCH",
            body: patch,
          }),
    [vaultRequest]
  );

  // ??/content PATCH ?癲ル슢?뤸뤃??????쑩딂キ?
  // - apiClient.request / vaultRequest??醫딆쓧? JSON.stringify??????????? ?????stringify ???궰???
  // - api.patchVaultContent??"raw content"??????袁⑦꺙???????????{content: ...}??????쑩?럴???β뼯爰????????
  const patchVaultContentCompat = useCallback(
    async (itemId, content) => {
      if (!itemId) return;

      if (api?.patchVaultContent) {
        // ??raw content??????썹땟???(????ㅔ??{content:{content:...}} ?熬곣뫖?삥납?)
        return api.patchVaultContent(itemId, content);
      }

      // ??fallback: ??嶺뚮Ĳ?됭짆??body??content ??? ???繹먮겧嫄х솾?????醫딆┫???content??????
      return vaultRequest(`/api/v1/vault/items/${itemId}/content`, {
        method: "PATCH",
        body: { content },
      });
    },
    [api, vaultRequest]
  );

  const lastEqSaveSigRef = useRef({});

 const patchVaultLocal = useCallback((vaultId, patch) => {
  if (!vaultId || !patch || typeof patch !== "object") return;

  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );

  setVaultResources((prev) => {
    const idx = prev.findIndex((n) => n.id === vaultId);

    // ??????ㅼ굡?類㎮뵾?????沅????꾩룆??????ㅻ샑筌??????β뼯爰녻キ???????
    if (idx === -1) {
      const created = {
        id: vaultId,
        title: clean.title ?? "(untitled)",
        type: clean.type ?? "unknown",
        tags: clean.tags ?? [],
        ...clean,
        updatedAt: new Date().toISOString(),
      };
      const next = [created, ...prev];
      try {
        localStorage.setItem(VAULT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    }

    const updated = {
      ...prev[idx],
      ...clean,
      updatedAt: new Date().toISOString(),
    };

    const next = [...prev];
    next[idx] = updated;

    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(next));
    } catch {}

    return next;
  });
}, []);


  const persistVaultMeta = useCallback(async (vaultId, meta) => {
    if (!vaultId) return;
    try {
      await api.patchVaultMeta(vaultId, meta || {});
    } catch (err) {
      if (isUnauthorized(err)) setVaultError("UNAUTHORIZED");
      console.error("[vault] meta save failed:", err);
      throw err;
    }
  }, []);

  const persistVaultContent = useCallback(async (vaultId, content) => {
    if (!vaultId) return;
    try {
      await patchVaultContentCompat(vaultId, content);
    } catch (err) {
      // backend??醫딆쓧? /content ???됰Ŧ??????癲? ???곌떽釉붾??? ?????놃닓 ?嚥▲굧????fallback
      if (Number(err?.status) === 404) {
        try {
          await patchVaultItemCompat(vaultId, { content });

          return;
        } catch (err2) {
          if (isUnauthorized(err2)) setVaultError("UNAUTHORIZED");
          console.error("[vault] content save fallback failed:", err2);
          throw err2;
        }
      }

      if (isUnauthorized(err)) setVaultError("UNAUTHORIZED");
      console.error("[vault] content save failed:", err);
      throw err;
    }
  }, []);

  const persistVaultItemPatch = useCallback(async (vaultId, patch) => {
    if (!vaultId) return;
    try {
      await patchVaultItemCompat(vaultId, patch || {});
    } catch (err) {
      if (isUnauthorized(err)) setVaultError("UNAUTHORIZED");
      console.error("[vault] item patch failed:", err);
      throw err;
    }
  }, []);

  const buildEquationContent = useCallback((payload) => {
    const pts = Array.isArray(payload?.points) ? payload.points : [];
    return {
      kind: "equation_graph",
      points: pts.map((p) => ({
        id: p?.id,
        x: Number(p?.x) || 0,
        y: Number(p?.y) || 0,
      })),
      domain: {
        xmin: Number(payload?.xmin),
        xmax: Number(payload?.xmax),
      },
      view: {
        gridStep: Number(payload?.gridStep),
        gridMode: payload?.gridMode,
        minorDiv: Number(payload?.minorDiv),
        viewMode: payload?.viewMode,
        editMode: payload?.editMode,
      },
      rule: {
        degree: Number(payload?.degree),
        ruleMode: payload?.ruleMode,
        rulePolyDegree: Number(payload?.rulePolyDegree),
      },
    };
  }, []);

  // ??equation?? meta(formula)?汝??吏??ㅻ㎦????嚥싳쇎紐??? (/content???癲ル슢?????? ????⑤９??
  const persistEquation = useCallback(
    (vaultId, payload) => {
      if (!vaultId) return;

      const equation = normalizeFormula(
        String(payload?.equation ?? payload?.formula ?? "x")
      );

      const points = Array.isArray(payload?.points) ? payload.points : [];
      const content = buildEquationContent({ ...payload, points });

      // ????怨뺣윞 payload 嚥싳쉶瑗??꾧틚???????熬곣뫖?삥납? (drag finalize/commitRule ?嚥싲갭큔????嚥싳쉶瑗??꾧틚???癲ル슢??????????繹먮굞??
      const sig =
        equation +
        "|" +
        String(payload?.xmin ?? "") +
        "|" +
        String(payload?.xmax ?? "") +
        "|" +
        points
          .map((p) => `${Number(p?.x) || 0},${Number(p?.y) || 0}`)
          .join(";");
      if (lastEqSaveSigRef.current[vaultId] === sig) return;
      lastEqSaveSigRef.current[vaultId] = sig;

      // UI???꿔꺂?ｉ뜮戮녹춹????醫딆┣???(optimistic)
      // - equation?????녾컯嶺???????癲ル슢??蹂?쭍??汝??吏??놁뗀?????븐뻤??content)????????β뼯源닻?
      //   ??嶺뚮Ĳ?됭짆?????formula(meta)?????嚥싳쇎紐???
      patchVaultLocal(vaultId, { formula: equation, content });

      // ?????됱뎽????ㅼ뒩??????? ??????熬곣뱭?
      void (async () => {
        try {
          await persistVaultMeta(vaultId, { formula: equation });
          // ??equation?? /content ???嚥싳쇎紐??鶯? ????⑤９??
        } catch (err) {
          // persistVaultMeta ??????????汝??吏??UNAUTHORIZED ?꿔꺂??節뉖き??
        }
      })();
    },
    [buildEquationContent, patchVaultLocal, persistVaultMeta]
  );

const persistCurve3D = useCallback(
  (vaultId, curve3d) => {
    if (!vaultId) return;

    const traceId = `curve3d:${vaultId}:${Date.now()}`;
    const content = sanitizeCurve3DForPersist(curve3d);

    // ??LeftPanel????⑤슢????top-level(x/y/z, tRange, samples ??????醫딆┻?????醫딆┣???
    const localPatch = {
      type: "curve3d",
      content,
      samples: content?.samples,
      // ??嶺?筌??嚥▲굧???????붺몭?겹럷?????썼キ?κ괌??????
      xExpr: content?.xExpr ?? content?.x,
      yExpr: content?.yExpr ?? content?.y,
      zExpr: content?.zExpr ?? content?.z,
      x: content?.xExpr ?? content?.x,
      y: content?.yExpr ?? content?.y,
      z: content?.zExpr ?? content?.z,
      tMin: content?.tMin ?? (Array.isArray(content?.tRange) ? content.tRange[0] : undefined),
      tMax: content?.tMax ?? (Array.isArray(content?.tRange) ? content.tRange[1] : undefined),
      tRange:
        Array.isArray(content?.tRange) ? content.tRange :
        (Number.isFinite(content?.tMin) && Number.isFinite(content?.tMax) ? [content.tMin, content.tMax] : undefined),
      editMode: content?.editMode,
      degree: content?.degree,
    };

    patchVaultLocal(vaultId, localPatch);

    void (async () => {
      try {
        console.info("[studio] persistCurve3D -> /content", {
          traceId,
          vaultId,
          contentKeys: Object.keys(content || {}),
          contentPreview: JSON.stringify(content)?.slice(0, 400),
        });

        await persistVaultContent(vaultId, content);

        // ????嶺뚮Ĳ?됭짆???잙갭큔?딆뼍吏?癲? ????⑤베鍮??熬곣뫖利?猷몃뢾????癲ル슢??節??updatedAt ???? ?????ロ꺙??
        await refreshVaultResources();

        // ????嶺뚮Ĳ?됭짆??醫딆쓧? top-level(x/y/z/expr)????⑤슢?????븐쪎影??뱺????嚥싳쇎紐??鶯? ?????놃닓 ????源???????
        // LeftPanel ??嶺?筌??醫딆쓧? ??????β뼯爰???????⑤베鍮??????汝??吏??놁뗀???濚??
        patchVaultLocal(vaultId, localPatch);
      } catch (err) {
        console.error("[studio] persistCurve3D failed", { traceId, vaultId, err });
      }
    })();
  },
  [patchVaultLocal, persistVaultContent, refreshVaultResources]
);


const persistSurface3D = useCallback(
  (vaultId, surface3d) => {
    if (!vaultId) return;

    const traceId = `surface3d:${vaultId}:${Date.now()}`;
    const content = sanitizeSurface3DForPersist(surface3d);

    // ??LeftPanel????⑤슢????top-level(expr/xMin/xMax/yMin/yMax ??????醫딆┻?????醫딆┣???
    const localPatch = {
      type: "surface3d",
      content,
      // ??嶺?筌??嚥▲굧???????붺몭?겹럷?????썼キ?κ괌??????
      expr: content?.expr ?? content?.zExpr ?? content?.formula,
      zExpr: content?.zExpr ?? content?.expr ?? content?.formula,
      formula: content?.formula ?? content?.expr ?? content?.zExpr,
      xMin: content?.xMin,
      xMax: content?.xMax,
      yMin: content?.yMin,
      yMax: content?.yMax,
      xRange:
        Array.isArray(content?.xRange) ? content.xRange :
        (Number.isFinite(content?.xMin) && Number.isFinite(content?.xMax) ? [content.xMin, content.xMax] : undefined),
      yRange:
        Array.isArray(content?.yRange) ? content.yRange :
        (Number.isFinite(content?.yMin) && Number.isFinite(content?.yMax) ? [content.yMin, content.yMax] : undefined),
      nx: content?.nx,
      ny: content?.ny,
      gridMode: content?.gridMode,
      gridStep: content?.gridStep,
      minorDiv: content?.minorDiv,
      markers: content?.markers,
      editMode: content?.editMode,
      degree: content?.degree,
    };

    patchVaultLocal(vaultId, localPatch);

    void (async () => {
      try {
        console.info("[studio] persistSurface3D -> /content", {
          traceId,
          vaultId,
          contentKeys: Object.keys(content || {}),
          contentPreview: JSON.stringify(content)?.slice(0, 400),
        });

        await persistVaultContent(vaultId, content);

        // ????嶺뚮Ĳ?됭짆???잙갭큔?딆뼍吏???????ロ꺙??
        await refreshVaultResources();

        // ????嶺?筌?????????壤굿?濡レ쑆?
        patchVaultLocal(vaultId, localPatch);
      } catch (err) {
        console.error("[studio] persistSurface3D failed", { traceId, vaultId, err });
      }
    })();
  },
  [patchVaultLocal, persistVaultContent, refreshVaultResources]
);




  // ??????沅???쒙쭫?????嶺뚮Ŋ?띄낼????? keepalive ???????됰Ŋ???????ш끽諭욥얠룊????? ?????노덫??
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8080";

  const flushActiveTabSave = useCallback(() => {
    const fp = focusedPaneRef.current || "left";
    const activeId = panesRef.current?.[fp]?.activeId;
    if (!activeId) return;

    const s = tabStateRef.current?.[activeId];
    if (!s?.vaultId) return;

    // ??/items PATCH????嶺뚮Ĳ?됭짆??????깅굴 ?꿔꺂?볟젆怨곷븶??브퀣??굢?500??????????⑥ろ맖 /content ??????????????
    let content = null;

    if (s.type === "equation") {
      content = buildEquationContent({
        points: s.points,
        xmin: s.xmin,
        xmax: s.xmax,
        gridStep: s.gridStep,
        gridMode: s.gridMode,
        minorDiv: s.minorDiv,
        viewMode: s.viewMode,
        editMode: s.editMode,
        ruleMode: s.ruleMode,
        rulePolyDegree: s.rulePolyDegree,
        degree: s.degree,
      });
    } else if (s.type === "curve3d") {
      content = cloneCurve3D(s.curve3d);
    } else if (s.type === "surface3d") {
      content = cloneSurface3D(s.surface3d);
    } else {
      return;
    }

    const token = localStorage.getItem("gm_token") || "";

    // keepalive: ????볥궙?袁р뵾???? ?癲ル슢??遺룔뀋??嚥싳쉶瑗??꾧틡???????썹땟戮щ빝???嶺뚮㉡????筌??節꾪렭?????沃섃뫂??먯낄??
    try {
      fetch(`${API_BASE}/api/v1/vault/items/${s.vaultId}/content`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      });
    } catch (e) {
      // ignore
    }
  }, [buildEquationContent]);

  useEffect(() => {
    const onPageHide = () => flushActiveTabSave();
    const onVisChange = () => {
      if (document.visibilityState === "hidden") flushActiveTabSave();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [flushActiveTabSave]);

  const finalizeMoveTxn = useCallback(
    (tabId) => {
      const txn = dragTxnRef.current;
      if (!txn || txn.tabId !== tabId) return;

      const cur = tabStateRef.current?.[tabId];
      if (!cur) {
        dragTxnRef.current = null;
        return;
      }

      const kind = txn.kind ?? cur.type;
      const before = txn.before;

      if (kind === "equation") {
        if (cur.type !== "equation") {
          dragTxnRef.current = null;
          return;
        }

        const after = {
          equation: cur.equation,
          points: cur.points.map((p) => ({ ...p })),
        };

        const changedEq = before.equation !== after.equation;
        const changedPts =
          before.points.length !== after.points.length ||
          before.points.some((p, i) => {
            const q = after.points[i];
            return !q || p.x !== q.x || p.y !== q.y;
          });

        if (changedEq || changedPts) {
          const hist = ensureHistory(tabId);
          hist.undo.push({
            kind: "equation",
            before,
            after,
            vaultId: txn.vaultId,
          });
          hist.redo.length = 0;

          // ??vault ????쇰뮚???????レ탳????嶺뚮슣?쒙쭛????녾컯嶺???points)?μ떜媛?걫?? ?熬곣뫖利?????????
          if (txn.vaultId) {
            persistEquation(txn.vaultId, {
              equation: after.equation,
              points: after.points,
              xmin: cur.xmin,
              xmax: cur.xmax,
              gridStep: cur.gridStep,
              gridMode: cur.gridMode,
              minorDiv: cur.minorDiv,
              viewMode: cur.viewMode,
              editMode: cur.editMode,
              ruleMode: cur.ruleMode,
              rulePolyDegree: cur.rulePolyDegree,
              degree: cur.degree,
            });
          }
        }

        dragTxnRef.current = null;
        return;
      }

      if (kind === "curve3d") {
        if (cur.type !== "curve3d") {
          dragTxnRef.current = null;
          return;
        }

        const after = { curve3d: cloneCurve3D(cur.curve3d) };
        if (curve3DSnapshotChanged(before.curve3d, after.curve3d)) {
          const hist = ensureHistory(tabId);
          hist.undo.push({
            kind: "curve3d",
            before,
            after,
            vaultId: txn.vaultId,
          });
          hist.redo.length = 0;

          if (txn.vaultId) persistCurve3D(txn.vaultId, after.curve3d);
        }

        dragTxnRef.current = null;
        return;
      }

      if (kind === "surface3d") {
        if (cur.type !== "surface3d") {
          dragTxnRef.current = null;
          return;
        }

        const after = { surface3d: cloneSurface3D(cur.surface3d) };
        if (surface3DSnapshotChanged(before.surface3d, after.surface3d)) {
          const hist = ensureHistory(tabId);
          hist.undo.push({
            kind: "surface3d",
            before,
            after,
            vaultId: txn.vaultId,
          });
          hist.redo.length = 0;

          if (txn.vaultId) persistSurface3D(txn.vaultId, after.surface3d);
        }

        dragTxnRef.current = null;
        return;
      }

      dragTxnRef.current = null;
    },
    [ensureHistory, persistEquation, persistCurve3D, persistSurface3D]
  );

  const scheduleFinalizeMoveTxn = useCallback(
    (tabId) => {
      requestAnimationFrame(() => finalizeMoveTxn(tabId));
    },
    [finalizeMoveTxn]
  );

  useEffect(() => {
    const onMouseUp = () => {
      const txn = dragTxnRef.current;
      if (!txn?.tabId) return;

      if (txn.kind === "equation") {
        scheduleFinalizeMoveTxn(txn.tabId);
        return;
      }

      const tabId = txn.tabId;
      window.setTimeout(() => finalizeMoveTxn(tabId), 120);
    };

    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [finalizeMoveTxn, scheduleFinalizeMoveTxn]);

  // ??Vault localStorage + state ????嶺뚮슣?쒙쭛??????욍걛???ш끽維??
  const updateVaultFormula = useCallback((vaultId, newEquation) => {
    if (!vaultId) return;
    setVaultResources((prev) => {
      const idx = prev.findIndex((n) => n.id === vaultId);
      if (idx === -1) return prev;
      const updated = {
        ...prev[idx],
        formula: newEquation,
        updatedAt: new Date().toISOString(),
      };
      const next = [...prev];
      next[idx] = updated;
      try {
        localStorage.setItem(VAULT_KEY, JSON.stringify(next));
      } catch (err) {
        console.error("Failed to update vault note formula from Studio:", err);
      }
      return next;
    });
  }, []);

  const applySnapshotToTab = useCallback(
    (tabId, snap, kind, vaultIdForUpdate) => {
      if (!tabId || !snap) return;

      setTabState((st) => {
        const cur = st[tabId];
        if (!cur) return st;

        const k = kind ?? cur.type ?? "equation";

        if (k === "equation" && cur.type === "equation") {
          return {
            ...st,
            [tabId]: {
              ...cur,
              equation: normalizeFormula(snap.equation),
              points: (snap.points || []).map((p) => ({ ...p })),
              ruleError: null,
              ver: (cur.ver ?? 0) + 1,
            },
          };
        }

        if (k === "curve3d" && cur.type === "curve3d") {
          const nextCurve3d = cloneCurve3D(snap.curve3d ?? snap);
          return {
            ...st,
            [tabId]: {
              ...cur,
              curve3d: { ...(cur.curve3d || {}), ...nextCurve3d },
              ver: (cur.ver ?? 0) + 1,
            },
          };
        }

        if (k === "surface3d" && cur.type === "surface3d") {
          const nextSurface3d = cloneSurface3D(snap.surface3d ?? snap);
          return {
            ...st,
            [tabId]: {
              ...cur,
              surface3d: { ...(cur.surface3d || {}), ...nextSurface3d },
              ver: (cur.ver ?? 0) + 1,
            },
          };
        }

        return st;
      });

      if ((kind ?? "equation") === "equation") {
        const normEq = normalizeFormula(snap.equation);
        setTabs((t) => {
          const prev = t.byId?.[tabId];
          if (!prev) return t;
          return {
            ...t,
            byId: {
              ...t.byId,
              [tabId]: { ...prev, title: titleFromFormula(normEq) },
            },
          };
        });

        if (vaultIdForUpdate) {
          const base = tabStateRef.current?.[tabId];
          persistEquation(vaultIdForUpdate, {
            equation: normEq,
            points: (snap.points || []).map((p) => ({ ...p })),
            xmin: base?.xmin,
            xmax: base?.xmax,
            gridStep: base?.gridStep,
            gridMode: base?.gridMode,
            minorDiv: base?.minorDiv,
            viewMode: base?.viewMode,
            editMode: base?.editMode,
            ruleMode: base?.ruleMode,
            rulePolyDegree: base?.rulePolyDegree,
            degree: base?.degree,
          });
        }
      }
    },
    [persistEquation]
  );

  const undoMove = useCallback(() => {
    const tabId = panes?.[focusedPane]?.activeId;
    if (!tabId) return;

    const cur = tabStateRef.current?.[tabId];
    if (!cur) return;

    dragTxnRef.current = null;

    const hist = ensureHistory(tabId);
    const entry = hist.undo.pop();
    if (!entry) return;

    hist.redo.push(entry);

    const kind = entry.kind ?? cur.type ?? "equation";
    applySnapshotToTab(tabId, entry.before, kind, entry.vaultId ?? cur.vaultId);
  }, [applySnapshotToTab, ensureHistory, focusedPane, panes]);

  const redoMove = useCallback(() => {
    const tabId = panes?.[focusedPane]?.activeId;
    if (!tabId) return;

    const cur = tabStateRef.current?.[tabId];
    if (!cur) return;

    dragTxnRef.current = null;

    const hist = ensureHistory(tabId);
    const entry = hist.redo.pop();
    if (!entry) return;

    hist.undo.push(entry);

    const kind = entry.kind ?? cur.type ?? "equation";
    applySnapshotToTab(tabId, entry.after, kind, entry.vaultId ?? cur.vaultId);
  }, [applySnapshotToTab, ensureHistory, focusedPane, panes]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const el = document.activeElement;
      const tag = el?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable)
        return;

      const isMac = navigator.platform?.toUpperCase?.().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const k = String(e.key || "").toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undoMove();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redoMove();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoMove, redoMove]);

  const deriveFor = useCallback(
    (tabId) => {
      if (!tabId) return null;
      const s = tabState[tabId];
      if (!s || s.type !== "equation") return null;

      const xs = s.points.map((p) => p.x);
      const ys = s.points.map((p) => p.y);
      const d = Math.min(s.degree, Math.max(0, s.points.length - 1));
      const coeffs = fitPolyCoeffs(xs, ys, d);

      const setRuleMode = (mode) =>
        setTabState((st) => ({
          ...st,
          [tabId]: { ...st[tabId], ruleMode: mode, ruleError: null },
        }));

      const setRulePolyDegree = (deg) =>
        setTabState((st) => ({
          ...st,
          [tabId]: { ...st[tabId], rulePolyDegree: deg, ruleError: null },
        }));

      const commitRule = (pointsOverride) => {
        const cur = tabState[tabId];
        if (!cur || cur.type !== "equation") return;

        beginMoveTxn(tabId);

        const pts = Array.isArray(pointsOverride) ? pointsOverride : cur.points;
        const ruleMode = cur.ruleMode ?? "free";
        const polyDegree = cur.rulePolyDegree ?? cur.degree;

        if (ruleMode === "free") {
          setTabState((st) => ({
            ...st,
            [tabId]: {
              ...st[tabId],
              points: pts,
              ruleError: null,
              ver: (st[tabId].ver ?? 0) + 1,
            },
          }));
          scheduleFinalizeMoveTxn(tabId);

          if (cur.vaultId) {
            persistEquation(cur.vaultId, {
              equation: cur.equation,
              points: pts,
              xmin: cur.xmin,
              xmax: cur.xmax,
              gridStep: cur.gridStep,
              gridMode: cur.gridMode,
              minorDiv: cur.minorDiv,
              viewMode: cur.viewMode,
              editMode: cur.editMode,
              ruleMode: cur.ruleMode,
              rulePolyDegree: cur.rulePolyDegree,
              degree: cur.degree,
            });
          }

          return;
        }

        const res = fitRuleFromPoints(ruleMode, pts, { polyDegree });

        if (!res.ok) {
          setTabState((st) => ({
            ...st,
            [tabId]: {
              ...st[tabId],
              points: pts,
              ruleError: res.message ?? "??????????쇨덫???????곌숯",
              ver: (st[tabId].ver ?? 0) + 1,
            },
          }));
          scheduleFinalizeMoveTxn(tabId);

          if (cur.vaultId) {
            persistEquation(cur.vaultId, {
              equation: cur.equation,
              points: pts,
              xmin: cur.xmin,
              xmax: cur.xmax,
              gridStep: cur.gridStep,
              gridMode: cur.gridMode,
              minorDiv: cur.minorDiv,
              viewMode: cur.viewMode,
              editMode: cur.editMode,
              ruleMode: cur.ruleMode,
              rulePolyDegree: cur.rulePolyDegree,
              degree: cur.degree,
            });
          }

          return;
        }

        const nextEq = res.equation ?? cur.equation;
        const snapped = snapPointsToFn(pts, res.fn, cur.xmin, cur.xmax);

        setTabState((st) => ({
          ...st,
          [tabId]: {
            ...st[tabId],
            equation: nextEq,
            points: snapped,
            ruleError: null,
            ver: (st[tabId].ver ?? 0) + 1,
          },
        }));

        setTabs((t) => ({
          ...t,
          byId: {
            ...t.byId,
            [tabId]: { ...t.byId[tabId], title: titleFromFormula(nextEq) },
          },
        }));

        scheduleFinalizeMoveTxn(tabId);

        if (cur.vaultId) {
          persistEquation(cur.vaultId, {
            equation: nextEq,
            points: snapped,
            xmin: cur.xmin,
            xmax: cur.xmax,
            gridStep: cur.gridStep,
            gridMode: cur.gridMode,
            minorDiv: cur.minorDiv,
            viewMode: cur.viewMode,
            editMode: cur.editMode,
            ruleMode: cur.ruleMode,
            rulePolyDegree: cur.rulePolyDegree,
            degree: cur.degree,
          });
        }
      };

      return {
        typedFn: exprToFn(s.equation),
        fittedFn: coeffsToFn(coeffs),
        xmin: s.xmin,
        xmax: s.xmax,
        gridStep: s.gridStep ?? 1,
        setGridStep: (v) =>
          setTabState((st) => ({
            ...st,
            [tabId]: { ...st[tabId], gridStep: Math.max(0.1, Number(v) || 2) },
          })),

        minorDiv: s.minorDiv ?? 4,
        setMinorDiv: (v) =>
          setTabState((st) => ({
            ...st,
            [tabId]: {
              ...st[tabId],
              minorDiv: Math.max(1, Math.floor(Number(v) || 4)),
            },
          })),

        gridMode: s.gridMode ?? "major",
        setGridMode: (mode) =>
          setTabState((st) => ({
            ...st,
            [tabId]: { ...st[tabId], gridMode: String(mode || "major") },
          })),

        viewMode: s.viewMode ?? "both",
        setViewMode: (mode) =>
          setTabState((st) => ({
            ...st,
            [tabId]: { ...st[tabId], viewMode: String(mode || "both") },
          })),

        editMode: s.editMode ?? "drag",
        setEditMode: (mode) =>
          setTabState((st) => ({
            ...st,
            [tabId]: { ...st[tabId], editMode: String(mode || "drag") },
          })),

        points: s.points,
        curveKey: coeffs.map((c) => c.toFixed(6)).join("|") + `|v${s.ver ?? 0}`,

        updatePoint: (idx, xy) => {
          beginMoveTxn(tabId);
          setTabState((st) => {
            const cur = st[tabId];
            const nextPts = cur.points.map((p, i) =>
              i === idx ? { ...p, ...xy } : p
            );
            return { ...st, [tabId]: { ...cur, points: nextPts } };
          });
        },

        commitRule,

        addPoint: (pt) => {
          const cur = tabState[tabId];
          if (!cur || cur.type !== "equation") return;

          const nextPts = [...(cur.points ?? [])];
          nextPts.push({ x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 });

          const mode = cur.ruleMode ?? "free";
          if (mode === "free") {
            beginMoveTxn(tabId);
            setTabState((st) => ({
              ...st,
              [tabId]: {
                ...st[tabId],
                points: nextPts,
                ruleError: null,
                ver: (st[tabId].ver ?? 0) + 1,
              },
            }));
            scheduleFinalizeMoveTxn(tabId);

            if (cur.vaultId) {
              persistEquation(cur.vaultId, {
                equation: cur.equation,
                points: nextPts,
                xmin: cur.xmin,
                xmax: cur.xmax,
                gridStep: cur.gridStep,
                gridMode: cur.gridMode,
                minorDiv: cur.minorDiv,
                viewMode: cur.viewMode,
                editMode: cur.editMode,
                ruleMode: cur.ruleMode,
                rulePolyDegree: cur.rulePolyDegree,
                degree: cur.degree,
              });
            }

            return;
          }

          commitRule(nextPts);
        },

        removePoint: (idxOrKey) => {
          const cur = tabState[tabId];
          if (!cur || cur.type !== "equation") return;

          const arr = Array.isArray(cur.points) ? cur.points : [];
          const idx =
            typeof idxOrKey === "number" ? idxOrKey : Number(idxOrKey);
          if (!Number.isFinite(idx)) return;

          const nextPts = arr.filter((_, i) => i !== idx);

          const mode = cur.ruleMode ?? "free";
          if (mode === "free") {
            beginMoveTxn(tabId);
            setTabState((st) => ({
              ...st,
              [tabId]: {
                ...st[tabId],
                points: nextPts,
                ruleError: null,
                ver: (st[tabId].ver ?? 0) + 1,
              },
            }));
            scheduleFinalizeMoveTxn(tabId);

            if (cur.vaultId) {
              persistEquation(cur.vaultId, {
                equation: cur.equation,
                points: nextPts,
                xmin: cur.xmin,
                xmax: cur.xmax,
                gridStep: cur.gridStep,
                gridMode: cur.gridMode,
                minorDiv: cur.minorDiv,
                viewMode: cur.viewMode,
                editMode: cur.editMode,
                ruleMode: cur.ruleMode,
                rulePolyDegree: cur.rulePolyDegree,
                degree: cur.degree,
              });
            }

            return;
          }

          commitRule(nextPts);
        },

        ruleMode: s.ruleMode ?? "free",
        setRuleMode,
        rulePolyDegree: s.rulePolyDegree ?? s.degree,
        setRulePolyDegree,
        ruleError: s.ruleError ?? null,
      };
    },
    [tabState, persistEquation, beginMoveTxn, scheduleFinalizeMoveTxn]
  );

  // ???? AI graph commands: extrema/roots/intersections ??markers ??????????????????????????????????
  const sampleExtremum = (fn, xmin, xmax, samples = 2500, kind = "max") => {
    const lo = Number(xmin),
      hi = Number(xmax);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return null;
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);

    let bestX = a;
    let bestY = kind === "min" ? Infinity : -Infinity;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = a + (b - a) * t;
      const y = fn ? fn(x) : NaN;
      if (!Number.isFinite(y)) continue;

      if (kind === "min") {
        if (y < bestY) {
          bestY = y;
          bestX = x;
        }
      } else {
        if (y > bestY) {
          bestY = y;
          bestX = x;
        }
      }
    }
    if (!Number.isFinite(bestY)) return null;
    return { x: bestX, y: bestY };
  };

  const bisectRoot = (fn, a, b, maxIter = 60, tol = 1e-6) => {
    let fa = fn(a),
      fb = fn(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;
    if (fa * fb > 0) return null;

    let lo = a,
      hi = b;
    for (let i = 0; i < maxIter; i++) {
      const mid = (lo + hi) / 2;
      const fm = fn(mid);
      if (!Number.isFinite(fm)) return null;
      if (Math.abs(fm) < tol) return mid;
      if (fa * fm <= 0) {
        hi = mid;
        fb = fm;
      } else {
        lo = mid;
        fa = fm;
      }
    }
    return (lo + hi) / 2;
  };

  const findRoots = (fn, xmin, xmax, samples = 2500, maxRoots = 12) => {
    const lo = Number(xmin),
      hi = Number(xmax);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return [];
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);

    const roots = [];
    let prevX = a;
    let prevY = fn(prevX);
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const x = a + (b - a) * t;
      const y = fn(x);

      if (Number.isFinite(prevY) && Number.isFinite(y)) {
        if (prevY === 0) roots.push(prevX);
        else if (y === 0) roots.push(x);
        else if (prevY * y < 0) {
          const r = bisectRoot(fn, prevX, x);
          if (r !== null) roots.push(r);
        }
      }

      prevX = x;
      prevY = y;

      if (roots.length >= maxRoots) break;
    }

    roots.sort((p, q) => p - q);
    const dedup = [];
    for (const r of roots) {
      if (!dedup.length || Math.abs(r - dedup[dedup.length - 1]) > 1e-3)
        dedup.push(r);
    }
    return dedup.slice(0, maxRoots);
  };

  const handleAICommand = useCallback(
    (payload) => {
      if (!payload) return;

      const commands = [];
      if (payload.type === "graph_command" && Array.isArray(payload.commands)) {
        commands.push(...payload.commands);
      } else if (payload.action) {
        commands.push({
          action: payload.action,
          target: payload.target,
          args: payload.args ?? {},
        });
      } else return;

      const debugEnabled = (() => {
        try {
          const v = window?.localStorage?.getItem?.("gm_ai_cmd_debug");
          if (v === "0" || v === "false") return false;
        } catch {}
        return true;
      })();
      const log = (...a) => debugEnabled && console.log("[AICommand]", ...a);
      const warn = (...a) => debugEnabled && console.warn("[AICommand]", ...a);

      const paneKey =
        payload.pane === "left" || payload.pane === "right"
          ? payload.pane
          : focusedPane;

      const tabId =
        payload.tabId ||
        panes?.[paneKey]?.activeId ||
        panes?.[focusedPane]?.activeId;
      if (!tabId) return;

      const tab = tabState?.[tabId];
      if (!tab) return;

      log("incoming", { tabId, tabType: tab.type, paneKey, commands });

      if (tab.type === "equation") {
        const pack = deriveFor(tabId);
        if (!pack) return;

        const pickFn = (target) =>
          target === "fit" ? pack.fittedFn : pack.typedFn;
        const xmin = pack.xmin;
        const xmax = pack.xmax;
        const nextMarkers = [];

        for (const c of commands) {
          const action = c.action;
          const target = c.target === "fit" ? "fit" : "typed";
          const fn = pickFn(target);
          const args = c.args ?? {};
          const samples = Number(args.samples) || 2500;

          if (action === "clear_markers") {
            nextMarkers.length = 0;
            continue;
          }

          if (action === "mark_max" || action === "find_max") {
            const max = sampleExtremum(fn, xmin, xmax, samples, "max");
            if (max) {
              nextMarkers.push({
                id: `max-${Date.now()}`,
                kind: "max",
                x: max.x,
                y: max.y,
                label: `max (${max.x.toFixed(2)}, ${max.y.toFixed(2)})`,
              });
            }
            continue;
          }

          if (action === "mark_min" || action === "find_min") {
            const min = sampleExtremum(fn, xmin, xmax, samples, "min");
            if (min) {
              nextMarkers.push({
                id: `min-${Date.now()}`,
                kind: "min",
                x: min.x,
                y: min.y,
                label: `min (${min.x.toFixed(2)}, ${min.y.toFixed(2)})`,
              });
            }
            continue;
          }

          if (action === "mark_roots" || action === "find_roots") {
            const roots = findRoots(
              fn,
              xmin,
              xmax,
              samples,
              Number(args.maxRoots) || 12
            );
            roots.forEach((r, idx) => {
              const y = fn(r);
              if (!Number.isFinite(y)) return;
              nextMarkers.push({
                id: `root-${Date.now()}-${idx}`,
                kind: "root",
                x: r,
                y,
                label: `root (${r.toFixed(2)}, ${y.toFixed(2)})`,
              });
            });
            continue;
          }

          if (
            action === "mark_intersections" ||
            action === "find_intersections"
          ) {
            const other = target === "fit" ? pack.typedFn : pack.fittedFn;
            const diff = (x) => fn(x) - other(x);
            const xs = findRoots(
              diff,
              xmin,
              xmax,
              samples,
              Number(args.maxIntersections) || 12
            );
            xs.forEach((x, idx) => {
              const y = fn(x);
              if (!Number.isFinite(y)) return;
              nextMarkers.push({
                id: `ix-${Date.now()}-${idx}`,
                kind: "intersection",
                x,
                y,
                label: `??(${x.toFixed(2)}, ${y.toFixed(2)})`,
              });
            });
            continue;
          }

          warn("unsupported action for equation", action);
        }

        setTabState((st) => ({
          ...st,
          [tabId]: {
            ...st[tabId],
            markers: nextMarkers,
            ver: (st[tabId].ver ?? 0) + 1,
          },
        }));
        log("equation markers applied", { tabId, count: nextMarkers.length });
        return;
      }

      // Curve3D / Surface3D AI ??影?れ쉠????汝??吏?癒곕㎦?? ???雅???? (??嶺뚮ㅎ???????ㅼ굡?????녾컯嶺?????????????
      // === ????썹땟????????? ???????雅??????怨뺣윞 ===

      if (tab.type === "curve3d") {
        const c3 = tab.curve3d || {};
        const tMin = Number.isFinite(Number(c3.tMin)) ? Number(c3.tMin) : 0;
        const tMax = Number.isFinite(Number(c3.tMax))
          ? Number(c3.tMax)
          : 2 * Math.PI;

        const pickExprSet = (target) => {
          const isBase = target === "fit";
          return {
            x: String(isBase ? c3.baseXExpr ?? c3.xExpr : c3.xExpr ?? "0"),
            y: String(isBase ? c3.baseYExpr ?? c3.yExpr : c3.yExpr ?? "0"),
            z: String(isBase ? c3.baseZExpr ?? c3.zExpr : c3.zExpr ?? "0"),
          };
        };

        const nextMarkers = cloneMarkers(c3.markers);
        let baseLen = nextMarkers.length;

        const fmt = (v, d = 2) => {
          const n = Number(v);
          return Number.isFinite(n) ? n.toFixed(d) : "NaN";
        };
        const fmtXYZ = (x, y, z) => `(${fmt(x)}, ${fmt(y)}, ${fmt(z)})`;

        for (const c of commands) {
          const action = c.action;
          const target = c.target === "fit" ? "fit" : "typed";
          const args = c.args ?? {};
          const samples = Math.max(64, Number(args.samples) || 800);
          const axis = String(args.axis ?? "z").toLowerCase();
          const maxRoots = Number(args.maxRoots) || 12;
          const maxIntersections = Number(args.maxIntersections) || 12;

          if (action === "clear_markers") {
            nextMarkers.length = 0;
            baseLen = 0;
            continue;
          }

          if (
            action === "fit_from_markers" ||
            action === "recalculate_from_markers"
          )
            continue;

          const exprs = pickExprSet(target);

          const xt = aiMakeParamFn(exprs.x, "t");
          const yt = aiMakeParamFn(exprs.y, "t");
          const zt = aiMakeParamFn(exprs.z, "t");

          const axisFn = (t) => {
            if (axis === "x") return xt(t);
            if (axis === "y") return yt(t);
            return zt(t);
          };

          if (action === "mark_max" || action === "find_max") {
            const max = sampleExtremum(axisFn, tMin, tMax, samples, "max");
            if (max) {
              const t = max.x;
              const X = xt(t),
                Y = yt(t),
                Z = zt(t);
              nextMarkers.push({
                id: `c3-max-${Date.now()}`,
                kind: "max",
                t,
                x: X,
                y: Y,
                z: Z,
                label: `max(${axis}) ${fmtXYZ(X, Y, Z)}`,
              });
            }
            continue;
          }

          if (action === "mark_min" || action === "find_min") {
            const min = sampleExtremum(axisFn, tMin, tMax, samples, "min");
            if (min) {
              const t = min.x;
              const X = xt(t),
                Y = yt(t),
                Z = zt(t);
              nextMarkers.push({
                id: `c3-min-${Date.now()}`,
                kind: "min",
                t,
                x: X,
                y: Y,
                z: Z,
                label: `min(${axis}) ${fmtXYZ(X, Y, Z)}`,
              });
            }
            continue;
          }

          if (action === "mark_roots" || action === "find_roots") {
            const roots = findRoots(axisFn, tMin, tMax, samples, maxRoots);
            roots.forEach((t, idx) => {
              const X = xt(t),
                Y = yt(t),
                Z = zt(t);
              nextMarkers.push({
                id: `c3-root-${Date.now()}-${idx}`,
                kind: "root",
                t,
                x: X,
                y: Y,
                z: Z,
                label: `root(${axis}) ${fmtXYZ(X, Y, Z)}`,
              });
            });
            continue;
          }

          if (action === "slice_t") {
            const t = Number(args.t);
            if (!Number.isFinite(t)) continue;
            const X = xt(t),
              Y = yt(t),
              Z = zt(t);
            nextMarkers.push({
              id: `c3-slice-${Date.now()}`,
              kind: "slice",
              t,
              x: X,
              y: Y,
              z: Z,
              label: `t=${fmt(t, 3)} ${fmtXYZ(X, Y, Z)}`,
            });
            continue;
          }

          if (action === "tangent_at") {
            const t0 = Number(args.t);
            if (!Number.isFinite(t0)) continue;
            const dt = Math.max(1e-6, Number(args.dt) || 1e-3);
            const tA = Math.max(tMin, Math.min(tMax, t0 - dt));
            const tB = Math.max(tMin, Math.min(tMax, t0 + dt));
            const denom = Math.max(1e-12, tB - tA);

            const dx = (xt(tB) - xt(tA)) / denom;
            const dy = (yt(tB) - yt(tA)) / denom;
            const dz = (zt(tB) - zt(tA)) / denom;

            const X = xt(t0),
              Y = yt(t0),
              Z = zt(t0);

            nextMarkers.push({
              id: `c3-tan-${Date.now()}`,
              kind: "tangent",
              t: t0,
              x: X,
              y: Y,
              z: Z,
              label: `tangent @ t=${fmt(t0, 3)} dir=(${fmt(dx, 3)}, ${fmt(
                dy,
                3
              )}, ${fmt(dz, 3)})`,
            });
            continue;
          }

          if (action === "closest_to_point") {
            const p = (() => {
              const raw = args.point;
              if (raw && typeof raw === "object") {
                const px = Number(raw.x),
                  py = Number(raw.y),
                  pz = Number(raw.z);
                if ([px, py, pz].every(Number.isFinite))
                  return { x: px, y: py, z: pz };
              }
              if (typeof raw === "string") {
                const parts = raw
                  .split(/[, ]+/)
                  .map((s) => Number(s))
                  .filter(Number.isFinite);
                if (parts.length >= 3)
                  return { x: parts[0], y: parts[1], z: parts[2] };
              }
              return { x: 0, y: 0, z: 0 };
            })();

            const dist2 = (t) => {
              const dx = xt(t) - p.x;
              const dy = yt(t) - p.y;
              const dz = zt(t) - p.z;
              return dx * dx + dy * dy + dz * dz;
            };

            const best = sampleExtremum(dist2, tMin, tMax, samples, "min");
            if (best) {
              const t = best.x;
              const X = xt(t),
                Y = yt(t),
                Z = zt(t);
              const d = Math.sqrt(Math.max(0, dist2(t)));
              nextMarkers.push({
                id: `c3-close-${Date.now()}`,
                kind: "closest",
                t,
                x: X,
                y: Y,
                z: Z,
                label: `closest to (${fmt(p.x)}, ${fmt(p.y)}, ${fmt(
                  p.z
                )}) d=${fmt(d, 3)} ${fmtXYZ(X, Y, Z)}`,
              });
            }
            continue;
          }

          if (
            action === "mark_intersections" ||
            action === "find_intersections"
          ) {
            const otherExprs = pickExprSet(target === "fit" ? "typed" : "fit");
            const oxt = aiMakeParamFn(otherExprs.x, "t");
            const oyt = aiMakeParamFn(otherExprs.y, "t");
            const ozt = aiMakeParamFn(otherExprs.z, "t");
            const otherAxisFn = (t) => {
              if (axis === "x") return oxt(t);
              if (axis === "y") return oyt(t);
              return ozt(t);
            };

            const diff = (t) => axisFn(t) - otherAxisFn(t);
            const ts = findRoots(diff, tMin, tMax, samples, maxIntersections);
            ts.forEach((t, idx) => {
              const X = xt(t),
                Y = yt(t),
                Z = zt(t);
              nextMarkers.push({
                id: `c3-ix-${Date.now()}-${idx}`,
                kind: "intersection",
                t,
                x: X,
                y: Y,
                z: Z,
                label: `??${axis}) ${fmtXYZ(X, Y, Z)}`,
              });
            });
            continue;
          }
        }

        const focusNonce = Date.now();
        const markersForState = nextMarkers.map((m, idx) =>
          idx >= baseLen ? { ...m, _focusNonce: focusNonce } : m
        );

        updateCurve3D(tabId, { markers: markersForState });

        const wantsFit = commands.some(
          (c) =>
            c.action === "fit_from_markers" ||
            c.action === "recalculate_from_markers"
        );

        if (wantsFit) {
          const baseXExpr = c3.baseXExpr ?? c3.xExpr ?? "0";
          const baseYExpr = c3.baseYExpr ?? c3.yExpr ?? "0";
          const baseZExpr = c3.baseZExpr ?? c3.zExpr ?? "0";

          const fitPatch = aiFitCurve3DFromMarkers({
            markers: markersForState,
            baseXExpr,
            baseYExpr,
            baseZExpr,
            deformSigma: c3.deformSigma ?? 0.6,
          });

          if (fitPatch) updateCurve3D(tabId, fitPatch);
        }

        return;
      }

      if (tab.type === "surface3d" || tab.type === "array3d") {
        const s3 = tab.surface3d || {};
        const domain = {
          xMin: Number.isFinite(Number(s3.xMin)) ? Number(s3.xMin) : -5,
          xMax: Number.isFinite(Number(s3.xMax)) ? Number(s3.xMax) : 5,
          yMin: Number.isFinite(Number(s3.yMin)) ? Number(s3.yMin) : -5,
          yMax: Number.isFinite(Number(s3.yMax)) ? Number(s3.yMax) : 5,
        };
        const nx = Math.max(20, Number(s3.nx) || 80);
        const ny = Math.max(20, Number(s3.ny) || 80);
        const degree = Number.isFinite(Number(s3.degree))
          ? Number(s3.degree)
          : tab.degree ?? 2;

        const nextMarkers = [];
        const fn = aiMakeScalarFn2D(s3.expr ?? "0");

        for (const c of commands) {
          const action = c.action;
          const args = c.args ?? {};
          const samplesX = Math.max(20, Number(args.samplesX) || nx);
          const samplesY = Math.max(20, Number(args.samplesY) || ny);
          const maxRoots = Number(args.maxRoots) || 12;
          const rootEps = Number(args.eps) || 1e-2;

          if (action === "clear_markers") {
            nextMarkers.length = 0;
            continue;
          }

          if (
            action === "fit_from_markers" ||
            action === "recalculate_from_markers"
          )
            continue;

          if (action === "mark_max" || action === "find_max") {
            const best = aiSampleSurfaceExtremum(
              fn,
              domain,
              samplesX,
              samplesY,
              "max"
            );
            if (best) {
              nextMarkers.push({
                id: `s3-max-${Date.now()}`,
                kind: "max",
                x: best.x,
                y: best.y,
                z: best.z,
                label: `max (${best.x.toFixed(2)}, ${best.y.toFixed(
                  2
                )}, ${best.z.toFixed(2)})`,
              });
            }
            continue;
          }

          if (action === "mark_min" || action === "find_min") {
            const best = aiSampleSurfaceExtremum(
              fn,
              domain,
              samplesX,
              samplesY,
              "min"
            );
            if (best) {
              nextMarkers.push({
                id: `s3-min-${Date.now()}`,
                kind: "min",
                x: best.x,
                y: best.y,
                z: best.z,
                label: `min (${best.x.toFixed(2)}, ${best.y.toFixed(
                  2
                )}, ${best.z.toFixed(2)})`,
              });
            }
            continue;
          }

          if (action === "mark_roots" || action === "find_roots") {
            const xMin = domain.xMin,
              xMax = domain.xMax,
              yMin = domain.yMin,
              yMax = domain.yMax;
            const cand = [];
            for (let iy = 0; iy < samplesY; iy++) {
              const ty = samplesY === 1 ? 0.5 : iy / (samplesY - 1);
              const y = yMin + (yMax - yMin) * ty;
              for (let ix = 0; ix < samplesX; ix++) {
                const tx = samplesX === 1 ? 0.5 : ix / (samplesX - 1);
                const x = xMin + (xMax - xMin) * tx;
                const z = fn(x, y);
                if (!Number.isFinite(z)) continue;
                const az = Math.abs(z);
                if (az <= rootEps) cand.push({ x, y, z, az });
              }
            }
            cand.sort((a, b) => a.az - b.az);
            const picked = [];
            const sep = Number(args.dedupDist) || 0.25;
            for (const p of cand) {
              if (picked.length >= maxRoots) break;
              if (!picked.length) picked.push(p);
              else {
                const ok = picked.every(
                  (q) => Math.hypot(p.x - q.x, p.y - q.y) > sep
                );
                if (ok) picked.push(p);
              }
            }
            picked.forEach((p, idx) => {
              nextMarkers.push({
                id: `s3-root-${Date.now()}-${idx}`,
                kind: "root",
                x: p.x,
                y: p.y,
                z: p.z,
                label: `root?? (${p.x.toFixed(2)}, ${p.y.toFixed(
                  2
                )}, ${p.z.toFixed(2)})`,
              });
            });
            continue;
          }
        }

        const focusNonce = Date.now();
        const markersForState = nextMarkers.map((m) => ({
          ...m,
          _focusNonce: focusNonce,
        }));
        updateSurface3D(tabId, { markers: markersForState });

        const wantsFit = commands.some(
          (c) =>
            c.action === "fit_from_markers" ||
            c.action === "recalculate_from_markers"
        );
        if (wantsFit) {
          const baseRhs = aiStripEq(s3.expr || "0") || "0";
          const baseFn = aiMakeScalarFn2D(baseRhs);
          const composeExpr = (deltaExpr) =>
            !deltaExpr || deltaExpr === "0"
              ? baseRhs
              : `(${baseRhs}) + (${deltaExpr})`;
          const res = aiFitSurfaceDeltaPolynomial(
            nextMarkers,
            degree,
            baseFn,
            domain,
            {
              markerWeight: 1.0,
              anchorWeight: 0.25,
              anchorGrid: 10,
              lambda: 1e-4,
            }
          );
          if (res.ok)
            updateSurface3D(tabId, { expr: composeExpr(res.deltaExpr) });
        }
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deriveFor, focusedPane, panes, tabState]
  );

  const leftActiveId = panes.left.activeId;
  const rightActiveId = panes.right.activeId;
  const leftPack = deriveFor(leftActiveId);
  const rightPack = deriveFor(rightActiveId);
  const leftActive = leftActiveId ? tabState[leftActiveId] : null;
  const rightActive = rightActiveId ? tabState[rightActiveId] : null;

  // ??ops
  const setActive = (paneKey, id) => {
    setPanes((s) => ({ ...s, [paneKey]: { ...s[paneKey], activeId: id } }));
    setFocusedPane(paneKey);
  };

  const createTab = useCallback(
    (
      raw,
      targetPane = focusedPane,
      tabType = "equation",
      tabContent = null,
      tabTitle = null,
      vaultId = null
    ) => {
      const effectiveVaultId = vaultId ?? raw?.id ?? tabContent?.id ?? null;

      const id = uid();
      const type = tabType || "equation";
      const eq = type === "equation" ? normalizeFormula(raw ?? "x") : undefined;

      let curve3dInit = undefined;
      let surface3dInit = undefined;

      if (type === "curve3d") {
        curve3dInit = buildCurve3DInitialState(raw, tabContent);
      }

      if (type === "surface3d") {
        surface3dInit = buildSurface3DInitialState(raw, tabContent);
      }

      const title =
        tabTitle ??
        (type === "equation"
          ? titleFromFormula(eq)
          : raw?.title ??
            (type === "array3d"
              ? "Array"
              : type === "curve3d"
              ? "Curve3D"
              : type === "surface3d"
              ? "Surface3D"
              : "Untitled"));

      setTabs((t) => ({
        byId: { ...t.byId, [id]: { id, title } },
        all: [...t.all, id],
      }));

      setTabState((st) => ({
        ...st,
        [id]: {
          type,
          equation: eq,
          content: type === "array3d" ? tabContent : undefined,
          curve3d: type === "curve3d" ? curve3dInit : undefined,
          surface3d: type === "surface3d" ? surface3dInit : undefined,
          xmin: -8,
          xmax: 8,
          gridStep: 1,
          gridMode: "major",
          viewMode: "both",
          editMode: "drag",
          degree: 3,
          ruleMode: "free",
          rulePolyDegree: 3,
          ruleError: null,
          points: type === "equation" ? makeInitialPoints(eq) : [],
          ver: 0,
          vaultId: effectiveVaultId,
          markers: [],
        },
      }));

      setPanes((p) => {
        const nextIds = [...p[targetPane].ids, id];
        return { ...p, [targetPane]: { ids: nextIds, activeId: id } };
      });
      setFocusedPane(targetPane);
    },
    [focusedPane, makeInitialPoints]
  );

  const closeTab = (paneKey, id) => {
    setPanes((p) => {
      const ids = p[paneKey].ids.filter((x) => x !== id);
      let nextActive = p[paneKey].activeId;
      if (nextActive === id) nextActive = ids[ids.length - 1] ?? null;
      const next = { ...p, [paneKey]: { ids, activeId: nextActive } };
      if (paneKey === "right" && ids.length === 0) {
        setIsSplit(false);
        return { ...next, right: { ids: [], activeId: null } };
      }
      if (paneKey === "left" && ids.length === 0) {
        if (p.right.ids.length) {
          const [moved] = p.right.ids;
          return {
            left: { ids: [moved], activeId: moved },
            right: {
              ids: p.right.ids.slice(1),
              activeId: p.right.ids.slice(1)[0] ?? null,
            },
          };
        }
        return {
          left: { ids: [], activeId: null },
          right: { ids: [], activeId: null },
        };
      }
      return next;
    });
    setTabState((st) => {
      const ns = { ...st };
      delete ns[id];
      return ns;
    });
  };

  const moveTabToPane = (tabId, fromKey, toKey) => {
    if (fromKey === toKey) return;
    setPanes((p) => {
      const fromIds = p[fromKey].ids.filter((x) => x !== tabId);
      const toIds = [...p[toKey].ids, tabId];
      return {
        left: {
          ids: fromKey === "left" ? fromIds : toIds,
          activeId:
            fromKey === "left"
              ? p.left.activeId === tabId
                ? fromIds[0] ?? null
                : p.left.activeId
              : p.left.activeId,
        },
        right: {
          ids: fromKey === "right" ? fromIds : toIds,
          activeId:
            fromKey === "right"
              ? p.right.activeId === tabId
                ? fromIds[0] ?? null
                : p.right.activeId
              : tabId,
        },
      };
    });
  };

  // ??DnD
  const [dragMeta, setDragMeta] = useState(null);
  const dragPreviewRef = useRef(null);

  const makeDragCanvas = (text) => {
    const scale = window.devicePixelRatio || 1;
    const padX = 10;
    const fontPx = 12;
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d");
    tctx.font = `${
      fontPx * scale
    }px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    const tw = tctx.measureText(text).width / scale;
    const w = Math.min(240, Math.max(80, Math.ceil(tw) + padX * 2));
    const h = 28;

    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#1e2430";
    ctx.strokeStyle = "#4c8dff";
    ctx.lineWidth = 1;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 6;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `${fontPx}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, h / 2);
    return canvas;
  };

  const onTabDragStart = (tabId, fromPane, e) => {
    setDragMeta({ tabId, fromPane });
    e.dataTransfer.setData("text/plain", tabId);
    e.dataTransfer.effectAllowed = "move";
    const title = tabs.byId[tabId]?.title ?? "Untitled";
    const img = makeDragCanvas(title);
    img.style.position = "fixed";
    img.style.top = "-1000px";
    img.style.left = "-1000px";
    document.body.appendChild(img);
    dragPreviewRef.current = img;
    document.body.classList.add("dragging-tab");
    e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
  };

  const onTabDragEnd = () => {
    setDragMeta(null);
    document.body.classList.remove("dragging-tab");
    if (dragPreviewRef.current) {
      try {
        document.body.removeChild(dragPreviewRef.current);
      } catch {}
      dragPreviewRef.current = null;
    }
  };

  const onTabClickSendOther = (tabId, fromPane) => {
    const toPane = fromPane === "left" ? "right" : "left";
    if (!isSplit && toPane === "right") {
      setIsSplit(true);
      moveTabToPane(tabId, "left", "right");
      setFocusedPane("right");
    } else {
      moveTabToPane(tabId, "right", "left");
      setFocusedPane("left");
    }
  };

  const onDropZoneEnter = (e) => {
    if (!dragMeta) return;
    e.currentTarget.classList.add("drop-active");
  };
  const onDropZoneLeave = (e) => {
    e.currentTarget.classList.remove("drop-active");
  };
  const onRightDropOver = (e) => {
    if (!dragMeta) return;
    e.preventDefault();
    e.currentTarget.classList.add("drop-active");
  };
  const onRightDrop = (e) => {
    e.preventDefault();
    if (!dragMeta) return;
    if (!isSplit) setIsSplit(true);
    moveTabToPane(dragMeta.tabId, dragMeta.fromPane, "right");
    setFocusedPane("right");
    onTabDragEnd();
  };

  // ??嶺?????
  const activeId = panes[focusedPane].activeId;
  const active = activeId ? tabState[activeId] : null;
  const activeEqPack =
    activeId && tabState[activeId]?.type === "equation"
      ? deriveFor(activeId)
      : null;

  // ??Toolbar??醫딆쓧? ?????????????됲닓 ?????????????????됱뎽??(??????됰Þ??UndoRedo/??⑤㈇?????Vault)
  const activeTabMeta = useMemo(() => {
    if (!activeId || !active) return null;

    const title = tabs.byId?.[activeId]?.title ?? "Untitled";
    const pane = focusedPane;
    const { undo, redo } = getHistoryCounts(activeId);

    const vaultItem =
      active.vaultId != null
        ? vaultResources.find((r) => r.id === active.vaultId)
        : null;

    const pointCount =
      active.type === "equation"
        ? Array.isArray(active.points)
          ? active.points.length
          : 0
        : null;

    const markerCount = (() => {
      if (active.type === "equation")
        return Array.isArray(active.markers) ? active.markers.length : 0;
      if (active.type === "curve3d")
        return Array.isArray(active.curve3d?.markers)
          ? active.curve3d.markers.length
          : 0;
      if (active.type === "surface3d")
        return Array.isArray(active.surface3d?.markers)
          ? active.surface3d.markers.length
          : 0;
      return 0;
    })();

    return {
      tabId: activeId,
      title,
      pane,
      type: active.type,
      isSplit,
      showLeftPanel,
      canUndo: undo > 0,
      canRedo: redo > 0,
      undoCount: undo,
      redoCount: redo,
      pointCount,
      markerCount,
      vaultId: active.vaultId ?? null,
      vaultTitle: vaultItem?.title ?? null,
      vaultUpdatedAt: vaultItem?.updatedAt ?? null,
    };
  }, [
    active,
    activeId,
    focusedPane,
    getHistoryCounts,
    isSplit,
    showLeftPanel,
    tabs.byId,
    vaultResources,
  ]);

  // AIPanel??????썹땟?????β뼯爰귨㎘???????????됱뎽
  const currentContext = useMemo(() => {
    try {
      const paneKey = focusedPane;
      const aid = panes[paneKey]?.activeId;
      const tab = tabs.byId[aid] || null;
      const s = tabState[aid] || null;
      if (!s) return { type: null };

      const base = {
        tabId: aid || null,
        pane: paneKey,
        title: tab?.title ?? null,
        type: s.type,
      };

      if (s.type === "equation") {
        return {
          ...base,
          equation: s.equation,
          xmin: s.xmin,
          xmax: s.xmax,
          gridStep: s.gridStep ?? 1,
          gridMode: s.gridMode ?? "major",
          viewMode: s.viewMode ?? "both",
          editMode: s.editMode ?? "drag",
          degree: s.degree,
          points: s.points,
        };
      }
      if (s.type === "curve3d") {
        const c = s.curve3d || {};
        return {
          ...base,
          xExpr: c.xExpr ?? c.x,
          yExpr: c.yExpr ?? c.y,
          zExpr: c.zExpr ?? c.z,
          tMin: c.tMin,
          tMax: c.tMax,
          samples: c.samples,
        };
      }
      if (s.type === "surface3d") {
        const surf = s.surface3d || {};
        return {
          ...base,
          expr: surf.expr,
          xMin: surf.xMin,
          xMax: surf.xMax,
          yMin: surf.yMin,
          yMax: surf.yMax,
          nx: surf.nx,
          ny: surf.ny,
          gridMode: surf.gridMode,
          gridStep: surf.gridStep,
        };
      }
      if (s.type === "array3d") return { ...base, content: s.content };
      return base;
    } catch {
      return { type: null };
    }
  }, [tabState, panes, focusedPane, tabs.byId]);

  const activeUpdate = (patch) => {
    if (!activeId) return;
    setTabState((st) => ({ ...st, [activeId]: { ...st[activeId], ...patch } }));
  };

  const setEquationExprWrapped = (eq) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    const norm = normalizeFormula(eq);
    setTabState((st) => ({
      ...st,
      [activeId]: { ...st[activeId], equation: norm },
    }));
  };

  const setDegreeWrapped = (deg) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    activeUpdate({ degree: deg });
  };

  const setDomainXmin = (v) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    activeUpdate({ xmin: num });
  };
  const setDomainXmax = (v) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    activeUpdate({ xmax: num });
  };

  // ??curve3d ????븐뻤???????욍걛???ш끽維??
  const updateCurve3D = useCallback(
    (tabId, patch) => {
      if (!tabId) return;
      const normalizedPatch = normalizeCurve3DPatch(patch);
      const commitLike = isCurve3DCommitPatch(patch);
      console.info("[studio] curve3d patch", {
        tabId,
        commitLike,
        keys:
          normalizedPatch && typeof normalizedPatch === "object"
            ? Object.keys(normalizedPatch)
            : typeof normalizedPatch,
        vaultId: tabStateRef.current?.[tabId]?.vaultId ?? null,
      });
      // markers drag / expr commit ??"????????됲닓 ??⑤슢堉???????嶺뚮??ｆ뤃??????txn??????ㅿ폎??before ????⑥쥓猷???癲ル슢???ъ쒜?
      if (
        patch &&
        typeof patch === "object" &&
        ("markers" in patch || commitLike)
      ) {
        beginCurve3DTxn(tabId);
      }

      setTabState((st) => {
        const cur = st[tabId];
        if (!cur || cur.type !== "curve3d") return st;

        const nextCurve3d = { ...(cur.curve3d || {}), ...patch };

        const next = {
          ...st,
          [tabId]: { ...cur, curve3d: nextCurve3d, ver: (cur.ver ?? 0) + 1 },
        };

        const txn = dragTxnRef.current;
        if (
          commitLike &&
          txn &&
          txn.tabId === tabId &&
          txn.kind === "curve3d"
        ) {
          const before = txn.before;
          const after = { curve3d: cloneCurve3D(nextCurve3d) };

          if (curve3DSnapshotChanged(before.curve3d, after.curve3d)) {
            const hist = ensureHistory(tabId);
            hist.undo.push({
              kind: "curve3d",
              before,
              after,
              vaultId: txn.vaultId,
            });
            hist.redo.length = 0;
          }

          // ??vault ????쇰뮚??????backend ????(commit-like patch)
          if (txn.vaultId) persistCurve3D(txn.vaultId, nextCurve3d);

          dragTxnRef.current = null;
        }

        return next;
      });
    },
    [beginCurve3DTxn, ensureHistory, persistCurve3D]
  );

  // ??surface3d ????븐뻤???????욍걛???ш끽維??
  const updateSurface3D = useCallback(
    (tabId, patch) => {
      if (!tabId) return;
      const normalizedPatch = normalizeSurface3DPatch(patch);
      const commitLike = isSurface3DCommitPatch(patch);
      console.info("[studio] surface3d patch", {
        tabId,
        commitLike,
        keys:
          normalizedPatch && typeof normalizedPatch === "object"
            ? Object.keys(normalizedPatch)
            : typeof normalizedPatch,
        vaultId: tabStateRef.current?.[tabId]?.vaultId ?? null,
      });
      // markers drag / expr commit ??"????????됲닓 ??⑤슢堉???????嶺뚮??ｆ뤃??????txn??????ㅿ폎??before ????⑥쥓猷???癲ル슢???ъ쒜?
      if (
        patch &&
        typeof patch === "object" &&
        ("markers" in patch || commitLike)
      ) {
        beginSurface3DTxn(tabId);
      }

      setTabState((st) => {
        const cur = st[tabId];
        if (!cur || cur.type !== "surface3d") return st;

        const nextSurface3d = { ...(cur.surface3d || {}), ...patch };

        const next = {
          ...st,
          [tabId]: {
            ...cur,
            surface3d: nextSurface3d,
            ver: (cur.ver ?? 0) + 1,
          },
        };

        const txn = dragTxnRef.current;
        if (
          commitLike &&
          txn &&
          txn.tabId === tabId &&
          txn.kind === "surface3d"
        ) {
          const before = txn.before;
          const after = { surface3d: cloneSurface3D(nextSurface3d) };

          if (surface3DSnapshotChanged(before.surface3d, after.surface3d)) {
            const hist = ensureHistory(tabId);
            hist.undo.push({
              kind: "surface3d",
              before,
              after,
              vaultId: txn.vaultId,
            });
            hist.redo.length = 0;
          }

          // ??vault ????쇰뮚??????backend ????(commit-like patch)
          if (txn.vaultId) persistSurface3D(txn.vaultId, nextSurface3d);

          dragTxnRef.current = null;
        }

        return next;
      });
    },
    [beginSurface3DTxn, ensureHistory, persistSurface3D]
  );

  const applyEquation = () => {
    if (!active || !activeId) return;
    if (active.type !== "equation") return;

    const equation = normalizeFormula(active.equation);
    const fn = exprToFn(equation);

    // ????嶺뚮Ŋ猷꾥굜???醫딆┣???
    setTabs((t) => ({
      ...t,
      byId: {
        ...t.byId,
        [activeId]: {
          ...t.byId[activeId],
          title: titleFromFormula(equation),
        },
      },
    }));

    // points ?????+ ????payload 嚥싳쉶瑗ц짆堉샕??
    const s = tabStateRef.current?.[activeId];
    if (!s || s.type !== "equation") return;

    const xs = (s.points || []).map((p) => p.x);
    const ys = xs.map((x) => {
      const y = fn(x);
      return Number.isFinite(y) ? y : 0;
    });

    const d = Math.min(s.degree, Math.max(0, (s.points || []).length - 1));
    const coeffs = fitPolyCoeffs(xs, ys, d);
    const fitted = coeffsToFn(coeffs);
    const nextPts = xs.map((x, i) => ({
      ...(s.points?.[i] || { id: i }),
      x,
      y: fitted(x),
    }));

    setTabState((st) => {
      const cur = st[activeId];
      if (!cur || cur.type !== "equation") return st;
      return {
        ...st,
        [activeId]: {
          ...cur,
          equation,
          points: nextPts,
          ver: (cur.ver ?? 0) + 1,
        },
      };
    });

    // ??vault ????쇰뮚???????レ탳???熬곣뫖利??????곌퇈猷쀯쭔??꿔꺂??? ????
    if (s.vaultId) {
      persistEquation(s.vaultId, {
        equation,
        points: nextPts,
        xmin: s.xmin,
        xmax: s.xmax,
        gridStep: s.gridStep,
        gridMode: s.gridMode,
        minorDiv: s.minorDiv,
        viewMode: s.viewMode,
        editMode: s.editMode,
        ruleMode: s.ruleMode,
        rulePolyDegree: s.rulePolyDegree,
        degree: s.degree,
      });
    }
  };

  const resampleDomain = () => {
    if (!activeId) return;

    const s = tabStateRef.current?.[activeId];
    if (!s || s.type !== "equation") return;

    const fn = exprToFn(s.equation);
    const xs = Array.from({ length: 8 }, (_, i) => {
      const t = i / 7;
      return s.xmin + (s.xmax - s.xmin) * t;
    });
    const pts = xs.map((x, i) => ({ id: i, x, y: Number(fn(x)) || 0 }));

    setTabState((st) => {
      const cur = st[activeId];
      if (!cur || cur.type !== "equation") return st;
      return {
        ...st,
        [activeId]: { ...cur, points: pts, ver: (cur.ver ?? 0) + 1 },
      };
    });

    if (s.vaultId) {
      persistEquation(s.vaultId, {
        equation: normalizeFormula(s.equation),
        points: pts,
        xmin: s.xmin,
        xmax: s.xmax,
        gridStep: s.gridStep,
        gridMode: s.gridMode,
        minorDiv: s.minorDiv,
        viewMode: s.viewMode,
        editMode: s.editMode,
        ruleMode: s.ruleMode,
        rulePolyDegree: s.rulePolyDegree,
        degree: s.degree,
      });
    }
  };

  function TabBar({ paneKey }) {
    const ids = panes[paneKey].ids;
    const act = panes[paneKey].activeId;
    return (
      <div className="tabbar">
        {ids.map((id) => (
          <div
            key={id}
            className={`tab ${act === id ? "active" : ""}`}
            draggable
            onDragStart={(e) => onTabDragStart(id, paneKey, e)}
            onDragEnd={onTabDragEnd}
            onClick={() => setActive(paneKey, id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTabClickSendOther(id, paneKey);
            }}
            title="Drag to reorder or right-click to move to the other pane"
          >
            <span className="tab-title">
              {tabs.byId[id]?.title ?? "Untitled"}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(paneKey, id);
              }}
            >
              ??
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="studio-root">
      {showLeftPanel && (
        <LeftPanel
          onOpenQuick={(f) => createTab(f, "left")}
          onNew={() => createTab("x", "left")}
          equations={equationsFromVault}
          resources={vaultResources}
          onPreview={(f) => {
            const tid = panes.left.activeId;
            const s = tid ? tabState[tid] : null;
            if (tid && s?.type === "equation") {
              const norm = normalizeFormula(f);
              setTabState((st) => ({
                ...st,
                [tid]: {
                  ...st[tid],
                  equation: norm,
                  ver: (st[tid].ver ?? 0) + 1,
                },
              }));
              setTabs((t) => ({
                ...t,
                byId: {
                  ...t.byId,
                  [tid]: { ...t.byId[tid], title: titleFromFormula(norm) },
                },
              }));
            }
            setFocusedPane("left");
          }}
          onOpenArray={(res) => {
            const vid =
              res?.id ?? res?.vaultId ?? res?.itemId ?? res?.key ?? null;
            return createTab(
              null,
              "left",
              "array3d",
              res.content,
              res.title,
              vid
            );
          }}
          onOpenResource={(res) => {
            const vid =
              res?.id ?? res?.vaultId ?? res?.itemId ?? res?.key ?? null;
            if (vid != null) {
              const paneKeys = ["left", "right"];
              for (const paneKey of paneKeys) {
                const paneTabIds = panes[paneKey].ids;
                const foundId = paneTabIds.find(
                  (tid) => tabState[tid]?.vaultId === vid
                );
                if (foundId) {
                  setActive(paneKey, foundId);
                  setFocusedPane(paneKey);
                  return;
                }
              }
            }

            if (res.type === "curve3d") {
              const payload = res?.content ?? res; // ???????
  createTab(payload, "left", "curve3d", payload, res.title, vid); 
            } else if (res.type === "equation") {
              createTab(res.formula, "left", "equation", null, res.title, vid);
            } else if (res.type === "array3d") {
              createTab(null, "left", "array3d", res.content, res.title, vid);
            } else if (res.type === "surface3d") {
               const payload = res?.content ?? res?.surface3d ?? res; // ???????
  createTab(payload, "left", "surface3d", payload, res.title, vid);
            }
          }}
        />
      )}

      <div className="studio-main">
        {/* ????욱룏??Toolbar ????쇨덧??*/}
        {active && active.type === "equation" ? (
          <Toolbar
            // ???뚯????props
            equationExpr={active.equation}
            setEquationExpr={setEquationExprWrapped}
            onApply={applyEquation}
            degree={active.degree}
            setDegree={setDegreeWrapped}
            xmin={active.xmin}
            xmax={active.xmax}
            setXmin={setDomainXmin}
            setXmax={setDomainXmax}
            onResampleDomain={resampleDomain}
            gridMode={activeEqPack?.gridMode}
            setGridMode={activeEqPack?.setGridMode}
            gridStep={activeEqPack?.gridStep}
            setGridStep={activeEqPack?.setGridStep}
            viewMode={activeEqPack?.viewMode}
            setViewMode={activeEqPack?.setViewMode}
            editMode={activeEqPack?.editMode}
            setEditMode={activeEqPack?.setEditMode}
            ruleMode={activeEqPack?.ruleMode}
            setRuleMode={activeEqPack?.setRuleMode}
            rulePolyDegree={activeEqPack?.rulePolyDegree}
            setRulePolyDegree={activeEqPack?.setRulePolyDegree}
            ruleError={activeEqPack?.ruleError}
            showLeftPanel={showLeftPanel}
            onToggleLeftPanel={() => setShowLeftPanel((v) => !v)}
            // ?????ㅻ쿋??: Toolbar??醫딆쓧? ???????????븐뻤????????????????ㅻ덫??
            context={activeTabMeta}
            onUndo={undoMove}
            onRedo={redoMove}
          />
        ) : active && active.type === "array3d" ? (
          <Array3DToolbar
            data={active.content}
            isSplit={isSplit}
            setIsSplit={setIsSplit}
            threshold={arrayThreshold}
            setThreshold={setArrayThreshold}
            axisOrder={arrayAxisOrder}
            setAxisOrder={setArrayAxisOrder}
            // ?????ㅻ쿋??: ??????????됱뎽/undo/redo/????裕??????
            context={activeTabMeta}
            onUndo={undoMove}
            onRedo={redoMove}
            showLeftPanel={showLeftPanel}
            onToggleLeftPanel={() => setShowLeftPanel((v) => !v)}
          />
        ) : active && active.type === "curve3d" ? (
          <Curve3DToolbar
            curve3d={active.curve3d}
            onChange={(patch) => updateCurve3D(activeId, patch)}
            onApply={(patch) => updateCurve3D(activeId, patch)}
            showLeftPanel={showLeftPanel}
            onToggleLeftPanel={() => setShowLeftPanel((v) => !v)}
            // ?????ㅻ쿋??
            context={activeTabMeta}
            onUndo={undoMove}
            onRedo={redoMove}
          />
        ) : active && active.type === "surface3d" ? (
          <Surface3DToolbar
            surface3d={active.surface3d}
            onChange={(patch) => updateSurface3D(activeId, patch)}
            onApply={(patch) => updateSurface3D(activeId, patch)}
            // ?????ㅻ쿋??: ????裕?????? + ??????????됱뎽/undo/redo
            showLeftPanel={showLeftPanel}
            onToggleLeftPanel={() => setShowLeftPanel((v) => !v)}
            context={activeTabMeta}
            onUndo={undoMove}
            onRedo={redoMove}
          />
        ) : null}

        <div className={`vscode-split-root ${isSplit ? "is-split" : ""}`}>
          {/* ???リ옇?ユ뤃?Pane */}
          <div
            className="pane"
            style={{ width: isSplit ? `${leftPct}%` : "100%" }}
          >
            <div className="pane-title">Left</div>
            <TabBar paneKey="left" />
            <div className="pane-content">
              {leftActive && leftActive.type === "equation" ? (
                leftPack ? (
                  <GraphView
                    key={`left-${leftActiveId}`}
                    points={leftPack.points}
                    updatePoint={leftPack.updatePoint}
                    xmin={leftPack.xmin}
                    xmax={leftPack.xmax}
                    gridStep={leftPack.gridStep}
                    setGridStep={leftPack.setGridStep}
                    gridMode={leftPack.gridMode}
                    setGridMode={leftPack.setGridMode}
                    viewMode={leftPack.viewMode}
                    setViewMode={leftPack.setViewMode}
                    editMode={leftPack.editMode}
                    setEditMode={leftPack.setEditMode}
                    fittedFn={leftPack.fittedFn}
                    typedFn={leftPack.typedFn}
                    curveKey={leftPack.curveKey}
                    markers={leftActive?.markers ?? []}
                    commitRule={leftPack.commitRule}
                    addPoint={leftPack.addPoint}
                    removePoint={leftPack.removePoint}
                    ruleMode={leftPack.ruleMode}
                    setRuleMode={leftPack.setRuleMode}
                    rulePolyDegree={leftPack.rulePolyDegree}
                    setRulePolyDegree={leftPack.setRulePolyDegree}
                    ruleError={leftPack.ruleError}
                    showControls={true}
                  />
                ) : (
                  <div className="empty-hint">???リ옇?ユ뤃???????????????ㅿ폍??????딅젩.</div>
                )
              ) : leftActive && leftActive.type === "array3d" ? (
                <Array3DView
                  data={leftActive.content}
                  threshold={arrayThreshold}
                  axisOrder={arrayAxisOrder}
                />
              ) : leftActive && leftActive.type === "curve3d" ? (
                <Curve3DView
                  key={`curve-left-${leftActiveId}-${leftActive.vaultId ?? ""}`}
                  curve3d={leftActive.curve3d}
                  onChange={(patch) => updateCurve3D(leftActiveId, patch)}
                />
              ) : leftActive && leftActive.type === "surface3d" ? (
                <Surface3DView
                  key={`surface-left-${leftActiveId}-${
                    leftActive.vaultId ?? ""
                  }`}
                  surface3d={leftActive.surface3d}
                  onChange={(patch) => updateSurface3D(leftActiveId, patch)}
                />
              ) : (
                <div className="empty-hint">???リ옇?ユ뤃???????????????ㅿ폍??????딅젩.</div>
              )}
            </div>
          </div>

          {/* ???곗뒩泳??怨ㅽ렫??*/}
          {isSplit && (
            <div
              className="divider"
              onMouseDown={() => (draggingRef.current = true)}
              title="Drag to resize"
            />
          )}

          {/* ?????봔饔낃퀣??Pane */}
          {isSplit ? (
            <div className="pane" style={{ width: `${100 - leftPct}%` }}>
              <div
                className="right-drop-zone"
                onDragEnter={onDropZoneEnter}
                onDragOver={onRightDropOver}
                onDragLeave={onDropZoneLeave}
                onDrop={onRightDrop}
              >
                <div className="pane-title">Right</div>
                <TabBar paneKey="right" />
                <div className="pane-content">
                  {rightActive && rightActive.type === "equation" ? (
                    rightPack ? (
                      <GraphView
                        key={`right-${rightActiveId}`}
                        points={rightPack.points}
                        updatePoint={rightPack.updatePoint}
                        xmin={rightPack.xmin}
                        xmax={rightPack.xmax}
                        gridStep={rightPack.gridStep}
                        setGridStep={rightPack.setGridStep}
                        gridMode={rightPack.gridMode}
                        setGridMode={rightPack.setGridMode}
                        viewMode={rightPack.viewMode}
                        setViewMode={rightPack.setViewMode}
                        editMode={rightPack.editMode}
                        setEditMode={rightPack.setEditMode}
                        fittedFn={rightPack.fittedFn}
                        typedFn={rightPack.typedFn}
                        curveKey={rightPack.curveKey}
                        markers={rightActive?.markers ?? []}
                        commitRule={rightPack.commitRule}
                        addPoint={rightPack.addPoint}
                        removePoint={rightPack.removePoint}
                        ruleMode={rightPack.ruleMode}
                        setRuleMode={rightPack.setRuleMode}
                        rulePolyDegree={rightPack.rulePolyDegree}
                        setRulePolyDegree={rightPack.setRulePolyDegree}
                        ruleError={rightPack.ruleError}
                        showControls={false}
                      />
                    ) : (
                      <div className="empty-hint">
                        ????욱룏?????????????쇨덧?????Β????嶺뚮Ĳ?됪뤃???녾컯嶺????鶯??????봔饔낃퀣?????됰Ŧ六?????Β??
                        ??????嶺뚮ㅎ????
                      </div>
                    )
                  ) : rightActive && rightActive.type === "array3d" ? (
                    // ??BUGFIX: rightActive.content ????
                    <Array3DView
                      data={rightActive.content}
                      threshold={arrayThreshold}
                      axisOrder={arrayAxisOrder}
                    />
                  ) : rightActive && rightActive.type === "curve3d" ? (
                    <Curve3DView
                      key={`curve-right-${rightActiveId}-${
                        rightActive.vaultId ?? ""
                      }`}
                      curve3d={rightActive.curve3d}
                      onChange={(patch) => updateCurve3D(rightActiveId, patch)}
                    />
                  ) : rightActive && rightActive.type === "surface3d" ? (
                    <Surface3DView
                      key={`surface-right-${rightActiveId}-${
                        rightActive.vaultId ?? ""
                      }`}
                      surface3d={rightActive.surface3d}
                      onChange={(patch) =>
                        updateSurface3D(rightActiveId, patch)
                      }
                    />
                  ) : (
                    <div className="empty-hint">
                      ????욱룏?????????????쇨덧?????Β????嶺뚮Ĳ?됪뤃???녾컯嶺????鶯??????봔饔낃퀣?????됰Ŧ六?????Β??
                      ??????嶺뚮ㅎ????
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="split-ghost-drop"
              onDragEnter={onDropZoneEnter}
              onDragOver={onRightDropOver}
              onDragLeave={onDropZoneLeave}
              onDrop={onRightDrop}
              title="Drop here to split the view"
            />
          )}
        </div>
      </div>

      {/* FAB + AI Panel */}
      <button
        className="ai-fab"
        type="button"
        onClick={() => setIsAIPanelOpen(true)}
      >
        <span className="ai-fab-icon">AI</span>
      </button>

      <AIPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        currentContext={currentContext}
        onCommand={handleAICommand}
      />
    </div>
  );
}
