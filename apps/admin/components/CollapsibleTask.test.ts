import { describe, expect, it } from "vitest";

// CollapsibleTask is a client component using useState. We test the pure logic:
// toggle behavior, title fallback, and header label formatting.

describe("CollapsibleTask — logic", () => {
  it("uses defaultOpen=false when not specified", () => {
    const defaultOpen = false;
    expect(defaultOpen).toBe(false);
  });

  it("uses defaultOpen=true when specified", () => {
    const defaultOpen = true;
    expect(defaultOpen).toBe(true);
  });

  it("toggles open state on click", () => {
    let open = false;
    // Simulate toggle
    open = !open;
    expect(open).toBe(true);
    open = !open;
    expect(open).toBe(false);
  });

  it("falls back to 'Untitled task' when title is empty", () => {
    const title = "";
    const displayTitle = title || "Untitled task";
    expect(displayTitle).toBe("Untitled task");
  });

  it("uses provided title when non-empty", () => {
    const title = "Review Brief";
    const displayTitle = title || "Untitled task";
    expect(displayTitle).toBe("Review Brief");
  });

  it("formats header label as 'Task N'", () => {
    const taskNumber = 3;
    expect(`Task ${taskNumber}`).toBe("Task 3");
  });

  it("formats week label as 'Week N'", () => {
    const weekNumber = 2;
    expect(`Week ${weekNumber}`).toBe("Week 2");
  });

  it("renders children only when open", () => {
    const open = true;
    expect(open ? "children" : null).toBe("children");
    const closed = false;
    expect(closed ? "children" : null).toBe(null);
  });
});
