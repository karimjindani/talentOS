import { describe, expect, it } from "vitest";
import { parseSafeMarkdown } from "./SafeMarkdown";

describe("parseSafeMarkdown", () => {
  it("returns structured headings, paragraphs and list items", () => {
    expect(parseSafeMarkdown("## Setup\nInstall the tools.\n\n- Node.js\n- Docker")).toEqual([
      { type: "heading", level: 2, text: "Setup" },
      { type: "paragraph", text: "Install the tools." },
      { type: "list", items: ["Node.js", "Docker"] }
    ]);
  });

  it("keeps HTML as plain text rather than executable markup", () => {
    expect(parseSafeMarkdown('<img src=x onerror="alert(1)">')).toEqual([
      { type: "paragraph", text: '<img src=x onerror="alert(1)">' }
    ]);
  });
});
