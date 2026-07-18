import type { ReactNode } from "react";

type MarkdownBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export function parseSafeMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
      flushParagraph();
      flushList();
      const markerLength = line.startsWith("### ") ? 4 : line.startsWith("## ") ? 3 : 2;
      blocks.push({
        type: "heading",
        level: markerLength === 4 ? 3 : 2,
        text: line.slice(markerLength).trim()
      });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function SafeMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="grid gap-3 text-sm leading-6 text-slate-700">
      {parseSafeMarkdown(markdown).map((block, index): ReactNode => {
        if (block.type === "heading") {
          return block.level === 3 ? (
            <h4 key={index} className="font-semibold text-slate-900">{block.text}</h4>
          ) : (
            <h3 key={index} className="text-base font-semibold text-slate-900">{block.text}</h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
