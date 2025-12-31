// src/state/studioReducer.js

export const initialStudioState = {
  nodes: [],
  equationExpr: "",
  undoStack: [],
  redoStack: [],
};

export const actions = {
  setNodes: (nodes) => ({ type: "SET_NODES", payload: { nodes } }),

  // 드래그 중 실시간 반영(히스토리 쌓지 않음)
  previewMove: (nodeId, pos) => ({ type: "PREVIEW_MOVE", payload: { nodeId, pos } }),

  // 드래그 끝났을 때만 1회 커밋(히스토리 1개 쌓임)
  commitMove: ({ nodeId, before, after, beforeExpr, afterExpr }) => ({
    type: "COMMIT_MOVE",
    payload: { nodeId, before, after, beforeExpr, afterExpr },
  }),

  undo: () => ({ type: "UNDO" }),
  redo: () => ({ type: "REDO" }),
};

export function studioReducer(state, action) {
  switch (action.type) {
    case "SE xadT_NODES": {
      return { ...state, nodes: action.payload.nodes };
    }

    case "PREVIEW_MOVE": {
      const { nodeId, pos } = action.payload;
      const nodes = state.nodes.map((n) => (n.id === nodeId ? { ...n, pos } : n));
      return { ...state, nodes };
    }

    case "COMMIT_MOVE": {
      const { nodeId, before, after, beforeExpr, afterExpr } = action.payload;

      // 변동 없으면 기록하지 않음
      if (
        before.x === after.x &&
        before.y === after.y &&
        before.z === after.z
      ) {
        return state;
      }

      const nodes = state.nodes.map((n) => (n.id === nodeId ? { ...n, pos: after } : n));

      const cmd = {
        kind: "MOVE",
        nodeId,
        before,
        after,
        beforeExpr,
        afterExpr,
      };

      return {
        ...state,
        nodes,
        equationExpr: afterExpr ?? state.equationExpr,
        undoStack: [...state.undoStack, cmd],
        redoStack: [], // 새 커밋 발생 시 redo 초기화
      };
    }

    case "UNDO": {
      const last = state.undoStack[state.undoStack.length - 1];
      if (!last) return state;

      if (last.kind === "MOVE") {
        const nodes = state.nodes.map((n) => (n.id === last.nodeId ? { ...n, pos: last.before } : n));
        return {
          ...state,
          nodes,
          equationExpr: last.beforeExpr ?? state.equationExpr,
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, last],
        };
      }
      return state;
    }

    case "REDO": {
      const last = state.redoStack[state.redoStack.length - 1];
      if (!last) return state;

      if (last.kind === "MOVE") {
        const nodes = state.nodes.map((n) => (n.id === last.nodeId ? { ...n, pos: last.after } : n));
        return {
          ...state,
          nodes,
          equationExpr: last.afterExpr ?? state.equationExpr,
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, last],
        };
      }
      return state;
    }

    default:
      return state;
  }
}
