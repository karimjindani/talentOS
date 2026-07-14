"use client";

import { useState, useEffect, useRef } from "react";
import type { MentorCard } from "@/lib/ai";
import { CardRenderer } from "./CardRenderer";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MessageBubbleProps {
  id: string;
  role: "user" | "mentor";
  content: string;
  cards?: MentorCard[];
  timestamp: Date;
  isLatest: boolean;
}

export function MessageBubble({
  id,
  role,
  content,
  cards,
  timestamp,
  isLatest,
}: MessageBubbleProps) {
  const [_isVisible, _setIsVisible] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLatest && role === "mentor") {
      _setIsVisible(true);
    }
  }, [isLatest, role]);

  const isUser = role === "user";
  const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });

  return (
    <div
      ref={bubbleRef}
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
      style={{ animationDelay: isLatest ? "0.1s" : "0s" }}
    >
      <div
        className={`relative rounded-2xl px-4 py-3 shadow-sm max-w-[85%] md:max-w-[75%] transition-all duration-300 ${
          isUser
            ? "bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-br-none"
            : "bg-gradient-to-r from-white to-slate-50 text-slate-800 border border-slate-200 rounded-bl-none"
        } ${isLatest ? "scale-[1.02]" : ""}`}
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
            {isLatest && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                New
              </span>
            )}
          </div>
        )}

        {/* Message content with markdown */}
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

        {/* Rich cards */}
        {cards && cards.length > 0 && (
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
    </div>
  );
}