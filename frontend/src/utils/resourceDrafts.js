export const RESOURCE_TYPE_META = [
  { key: "equation", label: "2D Equation (y = f(x))" },
  { key: "surface3d", label: "3D Surface (z = f(x, y))" },
  { key: "curve3d", label: "3D Curve (x(t), y(t), z(t))" },
  { key: "surfaceParam", label: "Parametric Surface" },
  { key: "vectorField", label: "Vector Field" },
  { key: "array3d", label: "3D Array (JSON)" },
];

export function buildVaultItemPayload(payload) {
  const {
    type,
    title,
    formula,
    tags,
    content,
    dims,
    x,
    y,
    z,
    tRange,
    samples,
    xRange,
    yRange,
    ...rest
  } = payload || {};

  const resolvedType = type === "equation3d" ? "surface3d" : type;

  const body = {
    type: resolvedType,
    title: title || "Untitled",
    tags: Array.isArray(tags) ? tags : [],
    ...rest,
  };

  if (resolvedType === "equation") {
    body.formula = formula || "x^2+1";
    return body;
  }

  if (resolvedType === "curve3d") {
    const safeTRange =
      Array.isArray(tRange) && tRange.length === 2 ? tRange : [0, 2 * Math.PI];
    body.content = {
      xExpr: x || "cos(t)",
      yExpr: y || "sin(t)",
      zExpr: z || "t",
      tMin: safeTRange[0],
      tMax: safeTRange[1],
      tRange: safeTRange,
      samples: samples ?? 400,
    };
    body.samples = samples ?? 400;
    return body;
  }

  if (resolvedType === "surface3d") {
    const xr = Array.isArray(xRange) && xRange.length === 2 ? xRange : [-5, 5];
    const yr = Array.isArray(yRange) && yRange.length === 2 ? yRange : [-5, 5];
    body.content = {
      expr: formula || "sin(x)*cos(y)",
      xMin: xr[0],
      xMax: xr[1],
      yMin: yr[0],
      yMax: yr[1],
      xRange: xr,
      yRange: yr,
      nx: samples ?? 80,
      ny: samples ?? 80,
      samples: samples ?? 80,
    };
    body.samples = samples ?? 80;
    return body;
  }

  if (resolvedType === "array3d") {
    body.content = content || [[[0]]];
    body.sizeX = dims?.x;
    body.sizeY = dims?.y;
    body.sizeZ = dims?.z;
    return body;
  }

  return body;
}
