import {
  buildVoxelInstances,
  collectActivePositions,
  makeGetter,
  normalizeOrder,
  pickDims,
} from "./Array3DCanvas";

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children }) => children,
  useThree: () => ({
    camera: {
      position: { set: jest.fn() },
      lookAt: jest.fn(),
      updateProjectionMatrix: jest.fn(),
    },
    gl: { domElement: {} },
  }),
}));

jest.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Text: ({ children }) => children ?? null,
}));

jest.mock("./OrientationOverlay", () => () => null);

describe("Array3DCanvas helpers", () => {
  test("interprets default zyx array dimensions correctly", () => {
    const data = [
      [
        [1, 0, 0],
        [0, 2, 0],
      ],
      [
        [0, 0, 3],
        [4, 0, 0],
      ],
    ];

    expect(pickDims(data, "zyx")).toMatchObject({
      X: 3,
      Y: 2,
      Z: 2,
      ord: "zyx",
    });

    expect(collectActivePositions(data, 0, "zyx")).toEqual([
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 1],
      [0, 1, 1],
    ]);
  });

  test("respects threshold when collecting voxels", () => {
    const data = [
      [
        [1, 0],
        [2, 3],
      ],
    ];

    expect(collectActivePositions(data, 1, "zyx")).toEqual([
      [0, 1, 0],
      [1, 1, 0],
    ]);
  });

  test("supports alternate axis order getters", () => {
    const data = [
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ];

    const dims = pickDims(data, "xyz");
    const getValue = makeGetter(data, dims.ord);

    expect(dims).toMatchObject({ X: 2, Y: 2, Z: 2, ord: "xyz" });
    expect(getValue(0, 0, 0)).toBe(1);
    expect(getValue(1, 0, 0)).toBe(5);
    expect(getValue(0, 1, 1)).toBe(4);
    expect(normalizeOrder("bad")).toBe("zyx");
  });

  test("builds translucent value-mode instances from array values", () => {
    const data = [
      [
        [1, 2],
        [3, 4],
      ],
    ];

    const instances = buildVoxelInstances(data, 0, "zyx", "value");

    expect(instances).toHaveLength(4);
    expect(instances[0]).toMatchObject({
      position: [0, 0, 0],
      value: 1,
      label: "1",
    });
    expect(instances[3]).toMatchObject({
      position: [1, 1, 0],
      value: 4,
      label: "4",
    });
    expect(instances[0].scale).toBe(0.95);
    expect(instances[0].color).toBe("#d6dbe3");
    expect(instances[3].color).toBe("#d6dbe3");
  });

  test("uses near-white fill color for classic box mode", () => {
    const data = [[[5]]];

    const instances = buildVoxelInstances(data, 0, "zyx", "binary");

    expect(instances).toHaveLength(1);
    expect(instances[0].color).toBe("#f1f3f6");
  });
});
