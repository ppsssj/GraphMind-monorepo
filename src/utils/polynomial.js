export function sampleXs(xmin, xmax, n) {
  if (n <= 1) return [xmin];
  const dx = (xmax - xmin) / (n - 1);
  return Array.from({ length: n }, (_, i) => xmin + i * dx);
}

export function fitPolynomial(xs, ys, degree) {
  // Build normal equations: (V^T V) a = V^T y, where V[i,j] = x_i^j
  const m = xs.length;
  const d = degree;
  const A = Array.from({ length: d + 1 }, () => Array(d + 1).fill(0));
  const b = Array(d + 1).fill(0);

  for (let row = 0; row <= d; row++) {
    for (let col = 0; col <= d; col++) {
      let sum = 0;
      for (let i = 0; i < m; i++) sum += Math.pow(xs[i], row + col);
      A[row][col] = sum;
    }
    let s = 0;
    for (let i = 0; i < m; i++) s += ys[i] * Math.pow(xs[i], row);
    b[row] = s;
  }

  // Solve linear system A * a = b via Gaussian elimination (small sizes, OK)
  const a = gaussianSolve(A, b);
  return a; // [a0, a1, ..., ad]
}

export function coeffsToFunction(coeffs) {
  return (x) => coeffs.reduce((acc, c, i) => acc + c * Math.pow(x, i), 0);
}

export function coeffsToString(coeffs, digits = 3) {
  function fmt(n) {
    const s = n.toFixed(digits);
    return /-/.test(s) ? s : `+${s}`;
  }
  if (!coeffs || coeffs.length === 0) return "0";
  const parts = coeffs.map((c, i) => {
    const t = fmt(c);
    if (i === 0) return t.replace("+", "");
    if (i === 1) return `${t}·x`;
    return `${t}·x^${i}`;
  });
  // Join and clean up leading +
  let out = parts.join(" ");
  out = out.replace(/^\+/, "");
  return out;
}

function gaussianSolve(A, b) {
  // Deep copy
  A = A.map((row) => row.slice());
  b = b.slice();
  const n = b.length;

  for (let i = 0; i < n; i++) {
    // Pivot
    let maxRow = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[maxRow][i])) maxRow = r;
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    const pivot = A[i][i] || 1e-12;
    for (let j = i; j < n; j++) A[i][j] /= pivot;
    b[i] /= pivot;

    // Eliminate
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = A[r][i];
      for (let j = i; j < n; j++) A[r][j] -= factor * A[i][j];
      b[r] -= factor * b[i];
    }
  }
  return b; // now contains solution
}