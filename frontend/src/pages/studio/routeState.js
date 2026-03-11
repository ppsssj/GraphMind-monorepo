function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function buildStudioStateFromVaultNote(note) {
  if (!note) return null;

  const content = note.type === "array3d" ? note.content : asObject(note.content);

  if (note.type === "equation") {
    return {
      type: "equation",
      id: note.id,
      title: note.title,
      formula: note.formula ?? note.expr ?? "x",
      from: "vault",
    };
  }

  if (note.type === "array3d") {
    return {
      type: "array3d",
      id: note.id,
      title: note.title,
      content: Array.isArray(content) ? content : [[[0]]],
      from: "vault",
    };
  }

  if (note.type === "curve3d") {
    const tRange = Array.isArray(content.tRange)
      ? content.tRange
      : Array.isArray(note.tRange)
      ? note.tRange
      : [];

    return {
      type: "curve3d",
      id: note.id,
      title: note.title,
      from: "vault",
      curve3d: {
        xExpr: content.xExpr ?? content.x ?? note.xExpr ?? note.x ?? "cos(t)",
        yExpr: content.yExpr ?? content.y ?? note.yExpr ?? note.y ?? "sin(t)",
        zExpr: content.zExpr ?? content.z ?? note.zExpr ?? note.z ?? "0",
        tMin: content.tMin ?? note.tMin ?? tRange[0] ?? 0,
        tMax: content.tMax ?? note.tMax ?? tRange[1] ?? 2 * Math.PI,
        samples: content.samples ?? note.samples ?? 400,
        markers: Array.isArray(content.markers) ? content.markers : undefined,
        editMode: content.editMode ?? note.editMode,
        baseXExpr: content.baseXExpr ?? note.baseXExpr,
        baseYExpr: content.baseYExpr ?? note.baseYExpr,
        baseZExpr: content.baseZExpr ?? note.baseZExpr,
      },
    };
  }

  if (note.type === "surface3d") {
    const xRange = Array.isArray(content.xRange)
      ? content.xRange
      : Array.isArray(note.xRange)
      ? note.xRange
      : [];
    const yRange = Array.isArray(content.yRange)
      ? content.yRange
      : Array.isArray(note.yRange)
      ? note.yRange
      : [];

    return {
      type: "surface3d",
      id: note.id,
      title: note.title,
      from: "vault",
      surface3d: {
        expr:
          content.expr ??
          content.zExpr ??
          content.formula ??
          note.expr ??
          note.zExpr ??
          note.formula ??
          "sin(x)*cos(y)",
        xMin: content.xMin ?? note.xMin ?? xRange[0] ?? -5,
        xMax: content.xMax ?? note.xMax ?? xRange[1] ?? 5,
        yMin: content.yMin ?? note.yMin ?? yRange[0] ?? -5,
        yMax: content.yMax ?? note.yMax ?? yRange[1] ?? 5,
        nx: content.nx ?? content.samples ?? note.samples ?? note.samplesX ?? 80,
        ny: content.ny ?? content.samples ?? note.samples ?? note.samplesY ?? 80,
        markers: Array.isArray(content.markers) ? content.markers : undefined,
        gridMode: content.gridMode ?? note.gridMode,
        gridStep: content.gridStep ?? note.gridStep,
        minorDiv: content.minorDiv ?? note.minorDiv,
      },
    };
  }

  return null;
}

export function getInitialStudioSession(locationState) {
  const rawType = locationState?.type ?? "equation";
  const initialType = rawType;
  const fromVault = locationState?.from === "vault";

  return {
    initialType,
    initialContent:
      initialType === "array3d" ? locationState?.content || [[[0]]] : null,
    fromVault,
    initialVaultId:
      fromVault &&
      (initialType === "equation" ||
        initialType === "curve3d" ||
        initialType === "surface3d" ||
        initialType === "array3d")
        ? locationState?.id ?? null
        : null,
  };
}
