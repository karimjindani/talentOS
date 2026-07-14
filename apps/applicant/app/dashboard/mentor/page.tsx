"use client";

import { useState, useRef, useEffect } from "react";
import type { MentorCard } from "@/lib/ai";
import { MessageBubble } from "./components/MessageBubble";
import { WarningCard } from "./components/CardRenderer";
import {
  ChevronDown,
  Sparkles,
  Send,
  Clock,
  Calendar,
  TrendingUp,
  Target,
  BookOpen,
  FileText,
  Zap,
  HelpCircle,
  Trash2,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "mentor";
  content: string;
  cards?: MentorCard[];
  timestamp: Date;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isLoading?: boolean;
};

const STORAGE_KEY = "talentos:mentor-conversations";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "mentor",
  content: `# 👋 Welcome to AI Mentor!

I'm your structured learning assistant for the Virtual Internship Program. I can help you with:

## 📋 **Today's Tasks**
- Check your current assignments
- Review progress on ongoing missions
- Get guidance on technical challenges

## 📊 **Progress Tracking**
- Monitor your completion percentage
- View upcoming deadlines
- Track skill development

## 🎯 **Learning Resources**
- Explain SDLC (Software Development Lifecycle)
- Understand SEM (Software Engineering Methodology)
- Review testing strategies and deployment processes

## 💡 **Quick Actions**
Use the suggested questions above or ask me anything specific about your internship!`,
  timestamp: new Date(),
};

/** Load all conversations from localStorage. */
function loadConversationsFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    // Revive Date objects and strip any stale isLoading flag
    return parsed.map((c) => ({
      ...c,
      isLoading: false,
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

/** Persist conversations to localStorage. */
function saveConversationsToStorage(conversations: Conversation[]) {
  try {
    // Strip transient isLoading so it doesn't persist across page reloads
    const clean = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messages: c.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/** Create a new empty conversation with a welcome message. */
function createNewConversation(): Conversation {
  const now = Date.now();
  return {
    id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New Chat",
    messages: [{ ...WELCOME_MESSAGE, id: `welcome-${now}`, timestamp: new Date(now) }],
    createdAt: now,
    updatedAt: now,
  };
}

/** Derive a short title from the first user message. */
function deriveTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Chat";
  const text = firstUserMsg.content.replace(/[#*`]/g, "").trim();
  return text.length > 40 ? text.slice(0, 40) + "…" : text;
}

const SUGGESTED_QUESTIONS = [
  { text: "Today's Task", icon: Target, color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { text: "Show Progress", icon: TrendingUp, color: "bg-green-100 text-green-700 hover:bg-green-200" },
  { text: "Timeline", icon: Calendar, color: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
  { text: "My Missions", icon: Target, color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { text: "Explain SDLC", icon: BookOpen, color: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" },
  { text: "Explain SEM", icon: FileText, color: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
  { text: "Testing Strategy", icon: Zap, color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  { text: "Deployment", icon: Clock, color: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200" },
  { text: "PRD Guide", icon: HelpCircle, color: "bg-violet-100 text-violet-700 hover:bg-violet-200" },
];

/**
 * AI Mentor chat page with enhanced UI.
 * Features:
 * - Auto-scroll to latest message
 * - Floating scroll-to-bottom button
 * - Suggested questions chips
 * - Structured response templates
 * - Rich card components
 * - Markdown rendering with syntax highlighting
 */
export default function MentorPage() {
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Derive messages and loading state from the active conversation
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [{ ...WELCOME_MESSAGE, timestamp: new Date() }];
  const isSending = activeConversation?.isLoading ?? false;

  // Track elapsed time while waiting for AI response
  useEffect(() => {
    if (!isSending) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSending]);

  // Load conversations from localStorage on mount; fall back to API history once
  useEffect(() => {
    async function loadHistory() {
      // 1. Try localStorage first
      const stored = loadConversationsFromStorage();
      if (stored.length > 0) {
        const sorted = stored.sort((a, b) => b.updatedAt - a.updatedAt);
        setConversations(sorted);
        setActiveConversationId(sorted[0].id);
        setIsLoadingHistory(false);
        return;
      }

      // 2. Fall back to API history (and migrate into localStorage)
      try {
        const res = await fetch("/api/ai/mentor", { method: "GET" });
        if (res.ok) {
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
            const apiMessages: Message[] = data.messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "mentor",
              content: m.content,
              cards: m.cards,
              timestamp: new Date(m.timestamp),
            }));
            const now = Date.now();
            const conv: Conversation = {
              id: `conv-${now}`,
              title: deriveTitle(apiMessages),
              messages: apiMessages,
              createdAt: now,
              updatedAt: now,
            };
            setConversations([conv]);
            setActiveConversationId(conv.id);
            saveConversationsToStorage([conv]);
          }
        }
      } catch {
        // Silently fall back to welcome message
      } finally {
        setIsLoadingHistory(false);
        // If no conversation was loaded (fresh user), create one so Send works
        if (!activeConversationId) {
          const newConv = createNewConversation();
          setConversations([newConv]);
          setActiveConversationId(newConv.id);
          saveConversationsToStorage([newConv]);
        }
      }
    }

    loadHistory();
  }, []);

  /** Persist updated conversations to both state and localStorage. */
  function persistConversations(updated: Conversation[]) {
    const sorted = updated.sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(sorted);
    saveConversationsToStorage(sorted);
  }

  // Auto-scroll to bottom when messages change or loading state toggles
  useEffect(() => {
    // Use rAF + setTimeout(0) to ensure DOM has painted before scrolling
    const id = setTimeout(() => {
      requestAnimationFrame(() => scrollToBottom());
    }, 0);
    return () => clearTimeout(id);
  }, [messages.length, isSending, activeConversationId]);

  // Check if user has scrolled away from bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 120;
      setShowScrollButton(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    setShowScrollButton(false);
  };

  /** Update a single conversation by id inside the conversations array. */
  function updateConversation(convId: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === convId ? updater(c) : c));
      const sorted = next.sort((a, b) => b.updatedAt - a.updatedAt);
      saveConversationsToStorage(sorted);
      return sorted;
    });
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // Capture the conversation ID at send time so the response always lands here
    let targetConvId = activeConversationId;
    if (!targetConvId) {
      // No active conversation — create one on the fly so Send works
      const newConv = createNewConversation();
      setConversations((prev) => [...prev, newConv]);
      setActiveConversationId(newConv.id);
      saveConversationsToStorage([newConv]);
      targetConvId = newConv.id;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    // Append user message + set loading on the target conversation only
    updateConversation(targetConvId, (c) => ({
      ...c,
      messages: [...c.messages, userMessage],
      title: deriveTitle([...c.messages, userMessage]),
      updatedAt: Date.now(),
      isLoading: true,
    }));

    setInput("");
    setError(null);

    // Force scroll to bottom immediately after sending (instant, not smooth)
    setTimeout(() => {
      requestAnimationFrame(() => scrollToBottom());
    }, 0);

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

      // Append AI response ONLY to the conversation that started the request
      updateConversation(targetConvId, (c) => ({
        ...c,
        messages: [...c.messages, mentorMessage],
        updatedAt: Date.now(),
        isLoading: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      // Clear loading state on error
      updateConversation(targetConvId, (c) => ({ ...c, isLoading: false }));
    }
  }

  function handleSuggestedQuestion(question: string) {
    setInput(question);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    const newConv = createNewConversation();
    persistConversations([...conversations, newConv]);
    setActiveConversationId(newConv.id);
    setInput("");
    setError(null);
    setTimeout(() => scrollToBottom(), 0);
  }

  function handleClearChat() {
    setShowClearConfirm(true);
  }

  function confirmClearChat() {
    if (activeConversationId) {
      // Delete the active conversation from storage
      const remaining = conversations.filter((c) => c.id !== activeConversationId);
      persistConversations(remaining);

      if (remaining.length > 0) {
        // Load the most recent remaining conversation
        setActiveConversationId(remaining[0].id);
      } else {
        // No chats left — create a fresh empty one
        const newConv = createNewConversation();
        persistConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    }
    setShowClearConfirm(false);
    setTimeout(() => scrollToBottom(), 0);
  }

  /** Load a specific conversation from history. */
  function handleSelectConversation(convId: string) {
    setActiveConversationId(convId);
    setError(null);
    setTimeout(() => scrollToBottom(), 0);
  }

  /** Delete a specific conversation from the history list. */
  function handleDeleteConversation(convId: string) {
    const remaining = conversations.filter((c) => c.id !== convId);
    persistConversations(remaining);

    if (convId === activeConversationId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        const newConv = createNewConversation();
        persistConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    }
    setTimeout(() => scrollToBottom(), 0);
  }

  function cancelClearChat() {
    setShowClearConfirm(false);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
      {/* ───────── Left column: Chat History + Quick Actions + Tips ───────── */}
      <div className="hidden lg:flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="p-4">
          {/* Chat History Controls */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-blue" />
                Chat History
              </span>
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleNewChat}
                className="w-full rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 text-left text-sm font-medium text-blue-700 transition-all hover:scale-[1.02] hover:from-blue-100 hover:to-blue-200"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>New Chat</span>
                </div>
              </button>
              <button
                onClick={handleClearChat}
                className="w-full rounded-lg bg-gradient-to-r from-rose-50 to-rose-100 px-3 py-2 text-left text-sm font-medium text-rose-700 transition-all hover:scale-[1.02] hover:from-rose-100 hover:to-rose-200"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  <span>Clear Chat</span>
                </div>
              </button>
            </div>

            {/* Recent conversations list */}
            {conversations.length > 0 && (
              <div className="mt-3 space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:scale-[1.02] ${
                      conv.id === activeConversationId
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex-1 truncate">{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      aria-label="Delete conversation"
                      className="ml-2 shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-blue" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              {SUGGESTED_QUESTIONS.map((q, i) => {
                const Icon = q.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q.text)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all hover:scale-[1.02] ${q.color}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{q.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">💡 Tips</h4>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-blue"></span>
                Ask about specific missions
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-blue"></span>
                Request progress updates
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-blue"></span>
                Get technical guidance
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ───────── Right column: Header + Messages + Input ───────── */}
      <div className="relative flex flex-1 flex-col min-h-0">
        {/* Header — pinned to top of right column */}
        <header className="shrink-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-brand-blue" />
                AI Mentor
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Your structured learning assistant for the Virtual Internship Program
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Online
              </div>
              <div className="text-xs text-slate-500">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile suggested questions — only visible on small screens */}
        <div className="shrink-0 border-b border-slate-200 bg-white p-4 lg:hidden">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => {
              const Icon = q.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(q.text)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${q.color}`}
                >
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    <span>{q.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages — the only region that scrolls */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-6"
        >
          <div className="mx-auto max-w-3xl space-y-6">
            {isLoadingHistory && (
              <div className="flex justify-center py-8">
                <div className="flex gap-1 rounded-full bg-white px-4 py-2 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:300ms]" />
                  </div>
                  <span className="text-sm text-slate-500">Loading conversation...</span>
                </div>
              </div>
            )}

            {!isLoadingHistory && messages.map((msg, index) => (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                cards={msg.cards}
                timestamp={msg.timestamp}
                isLatest={index === messages.length - 1}
              />
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue [animation-delay:300ms]" />
                    </div>
                    <span className="text-sm text-slate-500">
                      {elapsedSeconds < 20
                        ? "Generating response..."
                        : `Still working, this may take a little longer (${elapsedSeconds}s)`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto max-w-md">
                <WarningCard
                  title="Error"
                  message={error}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll-to-bottom button — positioned above input, inside right column */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom(true)}
            aria-label="Scroll to latest message"
            className="absolute bottom-28 right-6 z-30 rounded-full bg-brand-blue p-3 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}

        {/* Input bar — pinned to bottom of right column */}
        <div className="shrink-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-4 md:px-6 shadow-lg">
          <div className="mx-auto max-w-3xl">
            {/* Quick prompt chips above input */}
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.slice(4).map((q, i) => {
                const Icon = q.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q.text)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${q.color}`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      <span>{q.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your mentor anything about missions, progress, or technical guidance..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  disabled={isSending}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {input.length}/1000
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5">Enter</kbd> to send,{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5">Shift</kbd> +{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5">Enter</kbd> for new line
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span>AI Mentor is online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Chat Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Clear Chat History</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to clear all messages in this chat? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelClearChat}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearChat}
                className="rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-sm font-medium text-white hover:from-rose-600 hover:to-rose-700"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
