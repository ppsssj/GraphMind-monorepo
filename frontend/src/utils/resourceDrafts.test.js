import { buildVaultItemPayload } from "./resourceDrafts";

describe("buildVaultItemPayload", () => {
  test("preserves array3d content and dimensions", () => {
    const content = [
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [
        [7, 8, 9],
        [10, 11, 12],
      ],
    ];

    const result = buildVaultItemPayload({
      type: "array3d",
      title: "Array Check",
      tags: ["array"],
      dims: { x: 3, y: 2, z: 2 },
      content,
    });

    expect(result).toEqual({
      type: "array3d",
      title: "Array Check",
      tags: ["array"],
      content,
      sizeX: 3,
      sizeY: 2,
      sizeZ: 2,
    });
  });
});
