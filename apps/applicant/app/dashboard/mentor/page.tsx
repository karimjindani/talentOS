"use client";

import { useState, useRef, useEffect } from "react";
import type { MentorCard } from "@/lib/ai";

type Message = {
  id: string;
  role: "user" | "mentor";
  content: string;
  cards?: MentorCard[];
  timestamp: Date;
};

/**
 * AI Mentor chat page.
 *
 * Sends chat messages to the backend API stub at /api/ai/mentor.
 * The API returns structured dummy responses with optional rich cards.
 */
export default function MentorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "mentor",
      content:
        "Hi! I'm your AI Mentor. Ask me about tasks, progress, timelines, or engineering tips.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/ai/mentor", { method: "GET" });
        if (!res.ok) return;

        const data = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: string;
            content: string;
            cards?: MentorCard[];
            timestamp: string;
          }>;
        };

        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "mentor",
              content: m.content,
              cards: m.cards,
              timestamp: new Date(m.timestamp),
            }))
          );
        }
      } catch {
        // Silently fall back to welcome message
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }

      const data = (await res.json()) as {
        message: string;
        cards?: MentorCard[];
      };

      const mentorMessage: Message = {
        id: `mentor-${Date.now()}`,
        role: "mentor",
        content: data.message,
        cards: data.cards,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, mentorMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-brand-navy">AI Mentor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Get guidance on missions, engineering practices, and your career path.
        </p>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {isLoadingHistory && (
            <div className="flex justify-center py-8">
              <span className="inline-flex items-center gap-1 text-sm text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:300ms]" />
                <span className="ml-2">Loading conversation history…</span>
              </span>
            </div>
          )}
          {!isLoadingHistory && messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-4 py-3 text-sm shadow-sm max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-brand-blue text-white"
                    : "bg-white text-slate-800 border border-slate-200"
                }`}
              >
                {msg.role === "mentor" && (
                  <span className="mb-1 block text-xs font-semibold text-brand-navy">
                    AI Mentor
                  </span>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Rich cards */}
                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.cards.map((card, i) => (
                      <CardRenderer key={i} card={card} />
                    ))}
                  </div>
                )}

                <span
                  className={`mt-1 block text-xs ${
                    msg.role === "user" ? "text-brand-mist" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="mx-auto max-w-md rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-600">
              {error}
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your mentor anything…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            disabled={isSending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-slate-400">
          Press Enter to send, Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
}

/** Renders a rich card inside an AI mentor message. */
function CardRenderer({ card }: { card: MentorCard }) {
  switch (card.kind) {
    case "task":
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-brand-navy">{card.title}</p>
          <p className="mt-1 text-xs text-slate-600">{card.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {card.dueDate && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Due: {card.dueDate}
              </span>
            )}
            {card.estimatedTime && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {card.estimatedTime}
              </span>
            )}
          </div>
        </div>
      );

    case "progress":
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-navy">{card.title}</p>
            <span className="text-sm font-bold text-brand-blue">{card.percentage}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-blue transition-all"
              style={{ width: `${card.percentage}%` }}
            />
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-brand-navy">{card.title}</p>
          <ol className="mt-2 space-y-1">
            {card.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      );

    case "tips":
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-brand-navy">{card.title}</p>
          <ul className="mt-2 space-y-1">
            {card.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 text-brand-blue">▸</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "badge":
      return (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-medium text-slate-500">{card.label}</span>
          <span className="text-sm font-semibold text-brand-navy">{card.value}</span>
        </div>
      );

    default:
      return null;
  }
}
