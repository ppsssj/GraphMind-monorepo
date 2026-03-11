import { all, create } from "mathjs";

const math = create(all, {});

export const VAULT_KEY = "vaultResources";

export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const titleFromFormula = (formula) => {
  const core = String(formula || "")
    .replace(/^y\s*=\s*/i, "")
    .replace(/\s+/g, "")
    .trim();

  if (!core) return "Untitled";
  return `y=${core.length > 24 ? `${core.slice(0, 24)}...` : core}`;
};

export function normalizeFormula(raw) {
  if (!raw) return "x";

  let text = String(raw).trim();
  text = text.replace(/^y\s*=\s*/i, "");
  text = text.replace(/e\s*\^\s*\{([^}]+)\}/gi, "exp($1)");
  text = text.replace(/(\d)(x)/gi, "$1*$2");
  return text;
}

export function exprToFn(raw) {
  const rhs = raw?.includes("=") ? raw.split("=").pop() : raw;
  const expr = String(rhs ?? "").trim();

  if (!expr) return () => NaN;

  try {
    const compiled = math.compile(expr);
    return (x) => {
      const y = Number(compiled.evaluate({ x }));
      return Number.isFinite(y) ? y : NaN;
    };
  } catch {
    return () => NaN;
  }
}

export const cloneMarkers = (arr) =>
  Array.isArray(arr) ? arr.map((marker) => ({ ...marker })) : [];

export const cloneCurve3D = (curve) => ({
  ...(curve || {}),
  markers: cloneMarkers(curve?.markers),
});

export const cloneSurface3D = (surface) => ({
  ...(surface || {}),
  markers: cloneMarkers(surface?.markers),
});

export const curve3DSnapshotChanged = (a, b) => {
  const ax = String(a?.xExpr ?? "");
  const ay = String(a?.yExpr ?? "");
  const az = String(a?.zExpr ?? "");
  const bx = String(b?.xExpr ?? "");
  const by = String(b?.yExpr ?? "");
  const bz = String(b?.zExpr ?? "");

  if (ax !== bx || ay !== by || az !== bz) return true;

  const am = Array.isArray(a?.markers) ? a.markers : [];
  const bm = Array.isArray(b?.markers) ? b.markers : [];
  if (am.length !== bm.length) return true;

  for (let i = 0; i < am.length; i += 1) {
    const p = am[i] || {};
    const q = bm[i] || {};
    if (
      p.id !== q.id ||
      p.t !== q.t ||
      p.x !== q.x ||
      p.y !== q.y ||
      p.z !== q.z
    ) {
      return true;
    }
  }

  return false;
};

export const surface3DSnapshotChanged = (a, b) => {
  if (String(a?.expr ?? "") !== String(b?.expr ?? "")) return true;

  const am = Array.isArray(a?.markers) ? a.markers : [];
  const bm = Array.isArray(b?.markers) ? b.markers : [];
  if (am.length !== bm.length) return true;

  for (let i = 0; i < am.length; i += 1) {
    const p = am[i] || {};
    const q = bm[i] || {};
    if (p.id !== q.id || p.x !== q.x || p.y !== q.y || p.z !== q.z) {
      return true;
    }
  }

  return false;
};

export const isCurve3DCommitPatch = (patch) =>
  Boolean(
    patch &&
      typeof patch === "object" &&
      ("xExpr" in patch ||
        "yExpr" in patch ||
        "zExpr" in patch ||
        "baseXExpr" in patch ||
        "baseYExpr" in patch ||
        "baseZExpr" in patch ||
        "x" in patch ||
        "y" in patch ||
        "z" in patch)
  );

export const isSurface3DCommitPatch = (patch) =>
  Boolean(
    patch &&
      typeof patch === "object" &&
      ("expr" in patch || "zExpr" in patch || "formula" in patch)
  );

export const normalizeCurve3DPatch = (patch) => {
  if (!patch || typeof patch !== "object") return patch;

  const next = { ...patch };
  if ("x" in next && !("xExpr" in next)) next.xExpr = next.x;
  if ("y" in next && !("yExpr" in next)) next.yExpr = next.y;
  if ("z" in next && !("zExpr" in next)) next.zExpr = next.z;
  return next;
};

export const normalizeSurface3DPatch = (patch) => {
  if (!patch || typeof patch !== "object") return patch;

  const next = { ...patch };
  if ("zExpr" in next && !("expr" in next)) next.expr = next.zExpr;
  if ("formula" in next && !("expr" in next)) next.expr = next.formula;
  return next;
};

export function fitPolyCoeffs(xs, ys, degree) {
  const vandermonde = xs.map((x) => {
    const row = new Array(degree + 1);
    let power = 1;
    for (let j = 0; j <= degree; j += 1) {
      row[j] = power;
      power *= x;
    }
    return row;
  });

  const xt = math.transpose(vandermonde);
  const a = math.multiply(xt, vandermonde);
  const b = math.multiply(xt, ys);
  const solution = math.lusolve(a, b);
  return solution.map((value) => (Array.isArray(value) ? value[0] : value));
}

export const coeffsToFn = (coeffs) => (x) => {
  let y = 0;
  let power = 1;
  for (let i = 0; i < coeffs.length; i += 1) {
    y += coeffs[i] * power;
    power *= x;
  }
  return y;
};

export function normalizeNestedAssign(expr) {
  const source = String(expr ?? "");
  const match = source.match(
    /^\(\(\s*([xyz]\(t\))\s*=\s*([\s\S]*?)\)\s*\+\s*\(([\s\S]+)\)\)\s*$/
  );

  if (!match) return source;

  const lhs = match[1];
  const base = (match[2] ?? "0").trim() || "0";
  const rest = (match[3] ?? "0").trim() || "0";
  return `${lhs} = ((${base}) + (${rest}))`;
}

export function aiMakeParamFn(expr, paramName = "t") {
  if (!expr) return () => 0;

  const normalized = normalizeNestedAssign(expr);
  const rhs = String(normalized).includes("=")
    ? String(normalized).split("=").pop()
    : normalized;
  const trimmed = String(rhs ?? "").trim() || "0";

  let compiled;
  try {
    compiled = math.parse(trimmed).compile();
  } catch (error) {
    console.warn("[AICommand] Curve3D parse failed:", expr, error);
    return () => 0;
  }

  return (t) => {
    try {
      const value = compiled.evaluate({
        [paramName]: t,
        t,
        pi: Math.PI,
        e: Math.E,
      });
      const num = typeof value === "number" ? value : Number(value?.valueOf?.());
      return Number.isFinite(num) ? num : 0;
    } catch {
      return 0;
    }
  };
}

export function aiBuildKernelDeformExpr(deltas, sigma) {
  const s = Math.max(1e-6, Number(sigma) || 0.6);
  const eps = 1e-9;
  const weightExpr = (ti) => `exp(-(((t)-(${ti}))/(${s}))^2)`;

  const numTerms = [];
  const denTerms = [];
  for (const delta of deltas || []) {
    const t = Number(delta.t);
    const d = Number(delta.delta);
    if (!Number.isFinite(t) || !Number.isFinite(d)) continue;
    if (Math.abs(d) < 1e-12) continue;

    const weight = weightExpr(t);
    numTerms.push(`((${d})*(${weight}))`);
    denTerms.push(`(${weight})`);
  }

  if (!numTerms.length) return "0";
  const num = numTerms.join(" + ");
  const den = denTerms.length ? `${denTerms.join(" + ")} + (${eps})` : `${eps}`;
  return `((${num})/(${den}))`;
}

export function aiFitCurve3DFromMarkers({
  markers,
  baseXExpr,
  baseYExpr,
  baseZExpr,
  deformSigma,
}) {
  const points = Array.isArray(markers) ? markers : [];
  const controls = points.filter(
    (marker) =>
      typeof marker?.t === "number" &&
      Number.isFinite(marker.t) &&
      (!marker.kind || marker.kind === "control")
  );

  if (controls.length < 2) return null;

  const xt = aiMakeParamFn(baseXExpr ?? "0", "t");
  const yt = aiMakeParamFn(baseYExpr ?? "0", "t");
  const zt = aiMakeParamFn(baseZExpr ?? "0", "t");

  const dx = [];
  const dy = [];
  const dz = [];
  for (const marker of controls) {
    const t = Number(marker.t);
    const bx = xt(t);
    const by = yt(t);
    const bz = zt(t);
    if (![bx, by, bz].every(Number.isFinite)) continue;

    dx.push({ t, delta: Number(marker.x) - bx });
    dy.push({ t, delta: Number(marker.y) - by });
    dz.push({ t, delta: Number(marker.z) - bz });
  }

  const rhsOf = (source) => {
    const text = String(source ?? "").trim();
    if (!text) return "0";
    return text.includes("=") ? text.split("=").pop().trim() || "0" : text;
  };

  return {
    xExpr: `x(t) = ((${rhsOf(baseXExpr ?? "0")}) + (${aiBuildKernelDeformExpr(
      dx,
      deformSigma
    )}))`,
    yExpr: `y(t) = ((${rhsOf(baseYExpr ?? "0")}) + (${aiBuildKernelDeformExpr(
      dy,
      deformSigma
    )}))`,
    zExpr: `z(t) = ((${rhsOf(baseZExpr ?? "0")}) + (${aiBuildKernelDeformExpr(
      dz,
      deformSigma
    )}))`,
  };
}

export function aiStripEq(expr) {
  const text = String(expr ?? "");
  return text.includes("=") ? text.split("=").pop().trim() : text.trim();
}

export function aiMakeScalarFn2D(expr) {
  const rhs = aiStripEq(expr || "0") || "0";

  try {
    const compiled = math.compile(rhs);
    return (x, y) => {
      try {
        const value = compiled.evaluate({ x, y });
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

export function aiFmtCoef(x) {
  if (!Number.isFinite(x)) return "0";
  return x.toFixed(6).replace(/\.?0+$/, "");
}

export function aiBuildPolyExpr2D(terms) {
  const parts = [];

  for (const term of terms || []) {
    const coef = term.coef;
    if (!Number.isFinite(coef) || Math.abs(coef) < 1e-10) continue;

    const sign = coef >= 0 ? "+" : "-";
    const abs = Math.abs(coef);
    const coefStr = aiFmtCoef(abs);
    const factors = [];

    if (!(abs === 1 && (term.i !== 0 || term.j !== 0))) factors.push(coefStr);
    if (term.i > 0) factors.push(term.i === 1 ? "x" : `x^${term.i}`);
    if (term.j > 0) factors.push(term.j === 1 ? "y" : `y^${term.j}`);

    parts.push({ sign, body: factors.length ? factors.join("*") : "0" });
  }

  if (!parts.length) return "0";

  let expr = `${parts[0].sign === "-" ? "-" : ""}${parts[0].body}`;
  for (let i = 1; i < parts.length; i += 1) {
    expr += ` ${parts[i].sign} ${parts[i].body}`;
  }
  return expr;
}

export function aiFitSurfaceDeltaPolynomial(markers, degree, baseFn, domain, opts = {}) {
  const d = Math.max(1, Math.min(6, Math.floor(Number(degree) || 2)));
  const base = typeof baseFn === "function" ? baseFn : () => 0;
  const markerWeight = Number.isFinite(opts.markerWeight) ? opts.markerWeight : 1;
  const anchorWeight = Number.isFinite(opts.anchorWeight) ? opts.anchorWeight : 0.25;
  const lambda = Number.isFinite(opts.lambda) ? opts.lambda : 1e-4;
  const anchorGrid = Math.max(3, Math.min(20, Math.floor(opts.anchorGrid ?? 10)));

  const points = (Array.isArray(markers) ? markers : [])
    .map((marker) => ({
      x: Number(marker?.x),
      y: Number(marker?.y),
      z: Number(marker?.z),
    }))
    .filter((point) => [point.x, point.y].every(Number.isFinite) && Number.isFinite(point.z));

  if (points.length < 1) return { ok: false, reason: "points insufficient" };

  const basis = [];
  for (let i = 0; i <= d; i += 1) {
    for (let j = 0; j <= d - i; j += 1) basis.push({ i, j });
  }

  const rows = points.map((point) => ({
    x: point.x,
    y: point.y,
    r: point.z - base(point.x, point.y),
    w: markerWeight,
  }));

  if (
    domain &&
    Number.isFinite(domain.xMin) &&
    Number.isFinite(domain.xMax) &&
    Number.isFinite(domain.yMin) &&
    Number.isFinite(domain.yMax)
  ) {
    for (let iy = 0; iy < anchorGrid; iy += 1) {
      const ty = anchorGrid === 1 ? 0.5 : iy / (anchorGrid - 1);
      const y = domain.yMin + (domain.yMax - domain.yMin) * ty;
      for (let ix = 0; ix < anchorGrid; ix += 1) {
        const tx = anchorGrid === 1 ? 0.5 : ix / (anchorGrid - 1);
        const x = domain.xMin + (domain.xMax - domain.xMin) * tx;
        rows.push({ x, y, r: 0, w: anchorWeight });
      }
    }
  }

  const a = math.zeros(rows.length, basis.length);
  const r = math.zeros(rows.length, 1);
  const w = math.zeros(rows.length, rows.length);

  for (let row = 0; row < rows.length; row += 1) {
    const current = rows[row];
    r.set([row, 0], current.r);
    w.set([row, row], Math.max(1e-8, current.w));
    for (let col = 0; col < basis.length; col += 1) {
      const term = basis[col];
      a.set([row, col], Math.pow(current.x, term.i) * Math.pow(current.y, term.j));
    }
  }

  const at = math.transpose(a);
  const atw = math.multiply(at, w);
  const atwa = math.multiply(atw, a);
  const atwr = math.multiply(atw, r);
  const identity = math.identity(basis.length);

  let solution;
  try {
    solution = math.lusolve(math.add(atwa, math.multiply(lambda, identity)), atwr);
  } catch {
    return { ok: false, reason: "solve failed" };
  }

  const terms = basis.map((term, index) => ({
    i: term.i,
    j: term.j,
    coef: Number(solution.get([index, 0])),
  }));

  return {
    ok: true,
    deltaExpr: aiBuildPolyExpr2D(terms),
    degree: d,
  };
}

export function aiSampleSurfaceExtremum(fn, domain, nx = 60, ny = 60, mode = "max") {
  if (!fn || !domain) return null;

  const xMin = Number(domain.xMin);
  const xMax = Number(domain.xMax);
  const yMin = Number(domain.yMin);
  const yMax = Number(domain.yMax);
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return null;

  const sx = Math.max(2, Math.floor(nx));
  const sy = Math.max(2, Math.floor(ny));
  let best = null;

  for (let iy = 0; iy < sy; iy += 1) {
    const ty = sy === 1 ? 0.5 : iy / (sy - 1);
    const y = yMin + (yMax - yMin) * ty;
    for (let ix = 0; ix < sx; ix += 1) {
      const tx = sx === 1 ? 0.5 : ix / (sx - 1);
      const x = xMin + (xMax - xMin) * tx;
      const z = fn(x, y);
      if (!Number.isFinite(z)) continue;
      if (!best || (mode === "max" ? z > best.z : z < best.z)) best = { x, y, z };
    }
  }

  return best;
}

export const isFiniteNum = (value) => Number.isFinite(value);

export const roundNum = (n, digits = 6) => {
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
};

export const fmtNum = (n, digits = 6) => {
  if (!isFiniteNum(n)) return "0";
  const rounded = roundNum(n, digits);
  return String(Object.is(rounded, -0) ? 0 : rounded);
};

export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

export function polyEquationFromCoeffs(coeffs) {
  const terms = [];
  for (let i = coeffs.length - 1; i >= 0; i -= 1) {
    const coef = coeffs[i];
    if (!isFiniteNum(coef) || Math.abs(coef) < 1e-10) continue;

    const abs = Math.abs(coef);
    let term = "";
    if (i === 0) term = fmtNum(abs);
    else if (i === 1) term = Math.abs(abs - 1) < 1e-10 ? "x" : `${fmtNum(abs)}*x`;
    else term = Math.abs(abs - 1) < 1e-10 ? `x^${i}` : `${fmtNum(abs)}*x^${i}`;

    if (terms.length === 0) terms.push((coef < 0 ? "-" : "") + term);
    else terms.push(` ${coef < 0 ? "-" : "+"} ${term}`);
  }
  return terms.length ? terms.join("") : "0";
}

export function leastSquaresLinear(xs, ys) {
  const n = xs.length;
  if (n < 2) return { a: 0, b: ys[0] ?? 0 };

  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }

  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return { a: 0, b: sy / n };

  return {
    a: (n * sxy - sx * sy) / denom,
    b: (sy - ((n * sxy - sx * sy) / denom) * sx) / n,
  };
}

export function nelderMead(
  f,
  x0,
  { step = 1, maxIter = 80, tol = 1e-7, alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5 } = {}
) {
  const dim = x0.length;
  const simplex = new Array(dim + 1);
  simplex[0] = { x: x0.slice(), fx: f(x0) };

  for (let i = 0; i < dim; i += 1) {
    const x = x0.slice();
    x[i] += step;
    simplex[i + 1] = { x, fx: f(x) };
  }

  const centroid = (points) => {
    const c = new Array(dim).fill(0);
    for (const point of points) {
      for (let i = 0; i < dim; i += 1) c[i] += point.x[i];
    }
    for (let i = 0; i < dim; i += 1) c[i] /= points.length;
    return c;
  };

  const distSimplex = () => {
    const best = simplex[0].x;
    let max = 0;
    for (let i = 1; i < simplex.length; i += 1) {
      let dist = 0;
      for (let j = 0; j < dim; j += 1) dist += (simplex[i].x[j] - best[j]) ** 2;
      max = Math.max(max, Math.sqrt(dist));
    }
    return max;
  };

  for (let iter = 0; iter < maxIter; iter += 1) {
    simplex.sort((a, b) => a.fx - b.fx);
    if (distSimplex() < tol) break;

    const best = simplex[0];
    const worst = simplex[dim];
    const secondWorst = simplex[dim - 1];
    const c = centroid(simplex.slice(0, dim));

    const xr = c.map((ci, i) => ci + alpha * (ci - worst.x[i]));
    const fr = f(xr);

    if (fr < best.fx) {
      const xe = c.map((ci, i) => ci + gamma * (xr[i] - ci));
      const fe = f(xe);
      simplex[dim] = fe < fr ? { x: xe, fx: fe } : { x: xr, fx: fr };
      continue;
    }

    if (fr < secondWorst.fx) {
      simplex[dim] = { x: xr, fx: fr };
      continue;
    }

    const xc = c.map((ci, i) => ci + rho * (worst.x[i] - ci));
    const fc = f(xc);

    if (fc < worst.fx) {
      simplex[dim] = { x: xc, fx: fc };
      continue;
    }

    for (let i = 1; i < simplex.length; i += 1) {
      const xs = simplex[i].x.map((value, j) => best.x[j] + sigma * (value - best.x[j]));
      simplex[i] = { x: xs, fx: f(xs) };
    }
  }

  simplex.sort((a, b) => a.fx - b.fx);
  return simplex[0].x;
}

export function snapPointsToFn(points, fn, xmin, xmax) {
  return points.map((point) => {
    const x = clamp(point.x, xmin, xmax);
    const y = fn ? fn(x) : point.y;
    return { ...point, x, y: isFiniteNum(y) ? y : 0 };
  });
}

export function fitRuleFromPoints(ruleMode, points, { polyDegree = 3 } = {}) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  if (ruleMode === "free") return { ok: true, equation: null, fn: null, message: null };

  if (ruleMode === "linear") {
    if (points.length < 2) return { ok: false, message: "Linear mode requires at least 2 points." };
    const { a, b } = leastSquaresLinear(xs, ys);
    return {
      ok: true,
      equation: `${fmtNum(a)}*x + ${fmtNum(b)}`,
      fn: (x) => a * x + b,
      message: null,
    };
  }

  if (ruleMode === "poly") {
    const degree = Math.max(0, Math.floor(polyDegree));
    const useDegree = Math.min(degree, Math.max(0, points.length - 1));
    const coeffs = fitPolyCoeffs(xs, ys, useDegree);
    return {
      ok: true,
      equation: polyEquationFromCoeffs(coeffs),
      fn: coeffsToFn(coeffs),
      message: null,
    };
  }

  const sse = (pred) => {
    let error = 0;
    for (let i = 0; i < xs.length; i += 1) {
      const yhat = pred(xs[i]);
      const residual = (isFiniteNum(yhat) ? yhat : 0) - ys[i];
      error += residual * residual;
    }
    return error;
  };

  if (ruleMode === "sin") {
    if (points.length < 3) return { ok: false, message: "Sin mode requires at least 3 points." };
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const x0 = [(yMax - yMin) / 2 || 1, 1, 0, (yMax + yMin) / 2 || 0];
    const [a, wRaw, phi, c] = nelderMead(
      (v) => sse((x) => v[0] * Math.sin(Math.max(1e-6, Math.abs(v[1])) * x + v[2]) + v[3]),
      x0,
      { step: 0.35, maxIter: 90 }
    );
    const w = Math.max(1e-6, Math.abs(wRaw));
    return {
      ok: true,
      equation: `${fmtNum(a)}*sin(${fmtNum(w)}*x + ${fmtNum(phi)}) + ${fmtNum(c)}`,
      fn: (x) => a * Math.sin(w * x + phi) + c,
      message: null,
    };
  }

  if (ruleMode === "exp") {
    if (points.length < 3) return { ok: false, message: "Exp mode requires at least 3 points." };
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const [a, k, c] = nelderMead(
      (v) =>
        sse((x) => {
          const z = clamp(v[1] * x, -30, 30);
          return v[0] * Math.exp(z) + v[2];
        }),
      [yMax - yMin || 1, 0.3, yMin],
      { step: 0.25, maxIter: 90 }
    );
    return {
      ok: true,
      equation: `${fmtNum(a)}*exp(${fmtNum(k)}*x) + ${fmtNum(c)}`,
      fn: (x) => a * Math.exp(clamp(k * x, -30, 30)) + c,
      message: null,
    };
  }

  if (ruleMode === "log") {
    if (points.some((point) => point.x <= 0)) {
      return { ok: false, message: "Log mode requires x > 0." };
    }
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const [a, kRaw, c] = nelderMead(
      (v) => sse((x) => v[0] * Math.log(Math.max(1e-6, Math.abs(v[1])) * x) + v[2]),
      [yMax - yMin || 1, 1, (yMax + yMin) / 2 || 0],
      { step: 0.25, maxIter: 90 }
    );
    const k = Math.max(1e-6, Math.abs(kRaw));
    return {
      ok: true,
      equation: `${fmtNum(a)}*log(${fmtNum(k)}*x) + ${fmtNum(c)}`,
      fn: (x) => a * Math.log(k * x) + c,
      message: null,
    };
  }

  if (ruleMode === "power") {
    if (points.some((point) => point.x <= 0)) {
      return { ok: false, message: "Power mode requires x > 0." };
    }
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const [a, p, c] = nelderMead(
      (v) => sse((x) => v[0] * x ** v[1] + v[2]),
      [yMax - yMin || 1, 1, yMin],
      { step: 0.25, maxIter: 100 }
    );
    return {
      ok: true,
      equation: `${fmtNum(a)}*x^(${fmtNum(p)}) + ${fmtNum(c)}`,
      fn: (x) => a * x ** p + c,
      message: null,
    };
  }

  return { ok: false, message: "Unsupported rule mode." };
}

export const sanitizeCurve3DForPersist = (curve) => {
  const src = curve || {};
  const {
    geometry,
    mesh,
    vertices,
    indices,
    normals,
    positions,
    points,
    samples,
    cached,
    cache,
    buffers,
    ...rest
  } = src;

  return {
    ...rest,
    markers: cloneMarkers(src?.markers),
  };
};

export const sanitizeSurface3DForPersist = (surface) => {
  const src = surface || {};
  const {
    geometry,
    mesh,
    vertices,
    indices,
    normals,
    positions,
    points,
    samples,
    grid,
    cached,
    cache,
    buffers,
    ...rest
  } = src;

  return {
    ...rest,
    markers: cloneMarkers(src?.markers),
  };
};

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function buildCurve3DInitialState(raw, tabContent) {
  const root = asObject(tabContent);
  const fallbackRoot = asObject(raw);
  const source = Object.keys(root).length ? root : fallbackRoot;
  const nestedContent = asObject(source.content);
  const content = Object.keys(nestedContent).length ? nestedContent : source;
  const tRange = Array.isArray(content.tRange) ? content.tRange : [];

  const xExpr = content.x ?? content.xExpr ?? "cos(t)";
  const yExpr = content.y ?? content.yExpr ?? "sin(t)";
  const zExpr = content.z ?? content.zExpr ?? "0";
  const tMin = content.tMin ?? tRange[0] ?? 0;
  const tMax = content.tMax ?? tRange[1] ?? 2 * Math.PI;

  return {
    baseXExpr: content.baseXExpr ?? xExpr,
    baseYExpr: content.baseYExpr ?? yExpr,
    baseZExpr: content.baseZExpr ?? zExpr,
    xExpr,
    yExpr,
    zExpr,
    tMin,
    tMax,
    samples: content.samples ?? content.sample ?? 400,
    markers: content.markers ?? [
      { id: 0, t: tMin },
      { id: 1, t: (tMin + tMax) / 2, label: "vertex" },
      { id: 2, t: tMax },
    ],
    editMode: content.editMode ?? "drag",
  };
}

export function buildSurface3DInitialState(raw, tabContent) {
  const root = asObject(tabContent);
  const fallbackRoot = asObject(raw);
  const source = Object.keys(root).length ? root : fallbackRoot;
  const nestedContent = asObject(source.content);
  const content = Object.keys(nestedContent).length ? nestedContent : source;
  const xRange = Array.isArray(content.xRange) ? content.xRange : [];
  const yRange = Array.isArray(content.yRange) ? content.yRange : [];

  return {
    expr: content.expr ?? content.zExpr ?? content.formula ?? "sin(x) * cos(y)",
    xMin: content.xMin ?? xRange[0] ?? -5,
    xMax: content.xMax ?? xRange[1] ?? 5,
    yMin: content.yMin ?? yRange[0] ?? -5,
    yMax: content.yMax ?? yRange[1] ?? 5,
    nx: content.nx ?? content.samplesX ?? 80,
    ny: content.ny ?? content.samplesY ?? 80,
    gridMode: content.gridMode ?? "major",
    gridStep: content.gridStep ?? 1,
    viewMode: content.viewMode ?? "both",
    editMode: content.editMode ?? "drag",
    minorDiv: content.minorDiv ?? 4,
  };
}
