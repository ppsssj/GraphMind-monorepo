import {
  buildStudioStateFromVaultNote,
  getInitialStudioSession,
} from "./routeState";

describe("studio route state", () => {
  test("builds array3d route state from vault note", () => {
    const note = {
      id: "vault-array-1",
      type: "array3d",
      title: "Saved Array",
      content: [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ],
    };

    expect(buildStudioStateFromVaultNote(note)).toEqual({
      id: "vault-array-1",
      type: "array3d",
      title: "Saved Array",
      content: [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ],
      from: "vault",
    });
  });

  test("keeps vault id when studio opens array3d from vault", () => {
    const session = getInitialStudioSession({
      id: "vault-array-1",
      type: "array3d",
      title: "Saved Array",
      from: "vault",
      content: [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    });

    expect(session).toEqual({
      initialType: "array3d",
      initialContent: [
        [
          [1, 2],
          [3, 4],
        ],
      ],
      fromVault: true,
      initialVaultId: "vault-array-1",
    });
  });
});
