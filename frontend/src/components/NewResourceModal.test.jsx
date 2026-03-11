import { fireEvent, render, screen } from "@testing-library/react";
import NewResourceModal from "./NewResourceModal";

describe("NewResourceModal array3d flow", () => {
  test("creates array3d payload from matrix inputs", () => {
    const handleCreate = jest.fn();

    render(
      <NewResourceModal
        title="Create Graph"
        allowedTypes={["array3d"]}
        onClose={() => {}}
        onCreate={handleCreate}
      />
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Array Matrix" },
    });

    const spinButtons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinButtons[0], { target: { value: "2" } });
    fireEvent.change(spinButtons[1], { target: { value: "2" } });
    fireEvent.change(spinButtons[2], { target: { value: "2" } });

    fireEvent.change(screen.getByLabelText("Cell x0 y0 z0"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Cell x1 y0 z0"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Cell x0 y1 z0"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Cell x1 y1 z0"), {
      target: { value: "4" },
    });

    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } });

    fireEvent.change(screen.getByLabelText("Cell x0 y0 z1"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Cell x1 y0 z1"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Cell x0 y1 z1"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Cell x1 y1 z1"), {
      target: { value: "8" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(handleCreate).toHaveBeenCalledTimes(1);
    expect(handleCreate).toHaveBeenCalledWith(
      {
        type: "array3d",
        title: "Array Matrix",
        tags: [],
        dims: { x: 2, y: 2, z: 2 },
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
      },
      { key: "create", label: "Create", persist: true }
    );
  });
});
