"use client";

import { useState, useEffect, useRef } from "react";
import type { MentorCard } from "@/lib/ai";
import { CardRenderer } from "./CardRenderer";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  X,
  Send,
} from "lucide-react";

interface MessageBubbleProps {
  id: string;
  role: "user" | "mentor";
  content: string;
  cards?: MentorCard[];
  timestamp: Date;
  isLatest: boolean;
  isStreaming?: boolean;
  feedback?: "up" | "down" | null;
  onRegenerate?: (id: string) => void;
  onEditAndResend?: (id: string, content: string) => void;
  onFeedback?: (id: string, feedback: "up" | "down") => void;
}

export function MessageBubble({
  id,
  role,
  content,
  cards,
  timestamp,
  isLatest,
  isStreaming = false,
  feedback = null,
  onRegenerate,
  onEditAndResend,
  onFeedback,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isUser = role === "user";
  const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft.length]);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function startEdit() {
    setDraft(content);
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== content) {
      onEditAndResend?.(id, trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
      style={{ animationDelay: isLatest ? "0.1s" : "0s" }}
    >
      <div className="flex flex-col items-end gap-1">
        <div
          className={`relative rounded-2xl px-4 py-3 shadow-sm max-w-[85%] md:max-w-[75%] transition-all duration-300 ${
            isUser
              ? "bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-br-none"
              : "bg-gradient-to-r from-white to-slate-50 text-slate-800 border border-slate-200 rounded-bl-none"
          } ${isLatest && !isStreaming ? "scale-[1.02]" : ""}`}
        >
          {/* Role indicator */}
          {!isUser && (
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-brand-blue to-blue-500">
                <span className="text-xs font-bold text-white">AI</span>
              </div>
              <span className="text-xs font-semibold text-brand-navy">
                AI Mentor
              </span>
              {isLatest && !isStreaming && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  New
                </span>
              )}
            </div>
          )}

          {/* Editing mode for user messages */}
          {editing && isUser ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                className="w-full resize-none rounded-lg bg-white/90 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-medium text-white hover:bg-white/30"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button
                  onClick={commitEdit}
                  className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-brand-blue hover:bg-blue-50"
                >
                  <Send className="h-3 w-3" /> Send
                </button>
              </div>
            </div>
          ) : isStreaming ? (
            /* Streaming-safe: render plain text while tokens arrive to avoid
               ReactMarkdown re-parsing partial fences/tables every token. */
            <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isUser ? "" : "text-slate-800"}`}>
              {content}
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand-blue align-middle" />
            </div>
          ) : (
            /* Message content with markdown — only once streaming is done */
            <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ ...props }) => (
                    <h1 className="mb-3 mt-4 text-lg font-bold text-brand-navy" {...props} />
                  ),
                  h2: ({ ...props }) => (
                    <h2 className="mb-2 mt-3 text-base font-semibold text-brand-navy" {...props} />
                  ),
                  h3: ({ ...props }) => (
                    <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-700" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="mb-2 leading-relaxed" {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul className="mb-3 ml-4 list-disc space-y-1" {...props} />
                  ),
                  ol: ({ ...props }) => (
                    <ol className="mb-3 ml-4 list-decimal space-y-1" {...props} />
                  ),
                  li: ({ ...props }) => (
                    <li className="pl-1" {...props} />
                  ),
                  strong: ({ ...props }) => (
                    <strong className="font-semibold text-brand-navy" {...props} />
                  ),
                  em: ({ ...props }) => (
                    <em className="italic text-slate-600" {...props} />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote
                      className="my-3 border-l-4 border-brand-blue/30 bg-blue-50/50 px-4 py-2 italic text-slate-700"
                      {...props}
                    />
                  ),
                  code: (props) => {
                    const { inline, className, children, ...rest } = props as React.ComponentPropsWithoutRef<'code'> & { inline?: boolean };
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <div className="my-3 overflow-hidden rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
                          <span className="text-xs font-mono text-slate-300">
                            {match[1]}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
                            }}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          className="!m-0 !bg-slate-900 !p-4 text-sm"
                          showLineNumbers
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code
                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800"
                        {...rest}
                      >
                        {children}
                      </code>
                    );
                  },
                  table: ({ ...props }) => (
                    <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200" {...props} />
                    </div>
                  ),
                  thead: ({ ...props }) => (
                    <thead className="bg-slate-50" {...props} />
                  ),
                  th: ({ ...props }) => (
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700"
                      {...props}
                    />
                  ),
                  td: ({ ...props }) => (
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600" {...props} />
                  ),
                  a: ({ ...props }) => (
                    <a
                      className="text-brand-blue hover:text-blue-700 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

          {/* Rich cards */}
          {cards && cards.length > 0 && !isStreaming && (
            <div className="mt-4 space-y-3">
              {cards.map((card, i) => (
                <CardRenderer key={`${id}-card-${i}`} card={card} />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div
            className={`mt-2 flex items-center justify-between text-xs ${
              isUser ? "text-blue-100" : "text-slate-400"
            }`}
          >
            <span>{timeAgo}</span>
            {!isUser && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                AI Mentor
              </span>
            )}
          </div>

          {/* Decorative corner */}
          {isUser && (
            <div className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full bg-gradient-to-r from-brand-blue to-blue-600"></div>
          )}
          {!isUser && (
            <div className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-gradient-to-r from-white to-slate-50 border border-slate-200"></div>
          )}
        </div>

        {/* Per-message action bar — appears on hover, hidden while streaming */}
        {!isStreaming && !editing && (content || cards?.length) && (
          <div className={`flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? "pr-1" : "pl-1"}`}>
            <button
              onClick={handleCopy}
              title="Copy"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {isUser && onEditAndResend && (
              <button
                onClick={startEdit}
                title="Edit & resend"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!isUser && onRegenerate && (
              <button
                onClick={() => onRegenerate(id)}
                title="Regenerate"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            {!isUser && onFeedback && (
              <>
                <button
                  onClick={() => onFeedback(id, "up")}
                  title="Good response"
                  className={`flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 ${feedback === "up" ? "text-green-600" : "text-slate-400 hover:text-slate-700"}`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(id, "down")}
                  title="Poor response"
                  className={`flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 ${feedback === "down" ? "text-rose-600" : "text-slate-400 hover:text-slate-700"}`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
