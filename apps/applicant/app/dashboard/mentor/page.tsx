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
  Square,
  Menu,
  X,
  Search,
  Pin,
  Pencil,
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
  pinned?: boolean;
};

type MentorContextSummary = {
  programName: string | null;
  overallPercentage: number | null;
  completedTasks: number | null;
  totalTasks: number | null;
  daysRemaining: number | null;
  missionCount: number;
  nextTask: { title: string; weekNumber: number; overdue: boolean; dueAt: string | null } | null;
  submissions: { missionTitle: string; status: string }[];
};

const STORAGE_KEY = "talentos:mentor-conversations";
const FEEDBACK_KEY = "talentos:mentor-feedback";
const MAX_INPUT_LENGTH = 2000;

/** Build a personalized welcome message from the applicant context summary. */
function buildWelcomeMessage(ctx: MentorContextSummary | null): string {
  if (!ctx || !ctx.programName) {
    return `# 👋 Welcome to AI Mentor!

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
Use the suggested questions above or ask me anything specific about your internship!`;
  }

  const progressLine =
    ctx.overallPercentage != null && ctx.totalTasks != null
      ? `\n\nYou're **${ctx.overallPercentage}%** through the program (${ctx.completedTasks ?? 0} of ${ctx.totalTasks} tasks done).`
      : "";
  const daysLine = ctx.daysRemaining != null ? `\n📅 **${ctx.daysRemaining} days remaining** in the program.` : "";
  const nextTaskLine = ctx.nextTask
    ? `\n\n## 🔭 **Your next task**\n**Week ${ctx.nextTask.weekNumber} — ${ctx.nextTask.title}**${ctx.nextTask.overdue ? " — ⚠️ this is overdue, prioritize it now." : ""}`
    : "";
  const missionLine = ctx.missionCount > 0 ? `\n\nYou have **${ctx.missionCount} mission${ctx.missionCount === 1 ? "" : "s"}** in this program. Ask me about any of them.` : "";

  return `# 👋 Welcome back!

I'm your AI Mentor for **${ctx.programName}**.${progressLine}${daysLine}${nextTaskLine}${missionLine}

## 💡 **How I can help**
- **"Today's Task"** — what to work on right now
- **"Show Progress"** — your completion status
- **"Timeline"** — your mission schedule
- **"Explain SDLC" / "Testing Strategy"** — engineering concepts

Ask me anything, or tap a quick action below.`;
}

/** Load all conversations from localStorage. */
function loadConversationsFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
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
    const clean = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messages: c.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      pinned: c.pinned,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/** Load the feedback map from localStorage. */
function loadFeedbackFromStorage(): Record<string, "up" | "down"> {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "{}") as Record<string, "up" | "down">;
  } catch {
    return {};
  }
}

/** Create a new empty conversation with a welcome message. */
function createNewConversation(welcomeContent: string): Conversation {
  const now = Date.now();
  return {
    id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New Chat",
    messages: [{ id: `welcome-${now}`, role: "mentor", content: welcomeContent, timestamp: new Date(now) }],
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

/** Sort conversations: pinned first, then by updatedAt descending. */
function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });
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

export default function MentorPage() {
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mentorContext, setMentorContext] = useState<MentorContextSummary | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});
  const [now, setNow] = useState(() => new Date());
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [{ id: "welcome", role: "mentor" as const, content: buildWelcomeMessage(mentorContext), timestamp: new Date() }];
  const isSending = activeConversation?.isLoading ?? false;

  // Live clock — updates every 30s so the header time isn't stale.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

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

  // Load feedback map from localStorage
  useEffect(() => {
    setFeedbackMap(loadFeedbackFromStorage());
  }, []);

  // Fetch applicant context for the personalized welcome + disclosure panel.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/mentor?context=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { context?: MentorContextSummary } | null) => {
        if (cancelled || !data?.context) return;
        const ctx = data.context;
        setMentorContext(ctx);
        // Refresh any fresh conversation's welcome message with the personalized version.
        setConversations((prev) =>
          prev.map((c) => {
            const hasUserMsg = c.messages.some((m) => m.role === "user");
            if (hasUserMsg) return c;
            const welcomeMsg = c.messages.find((m) => m.id.startsWith("welcome"));
            if (!welcomeMsg) return c;
            return {
              ...c,
              messages: c.messages.map((m) => (m.id === welcomeMsg.id ? { ...m, content: buildWelcomeMessage(ctx) } : m)),
            };
          })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load conversations from localStorage on mount; fall back to API history once
  useEffect(() => {
    async function loadHistory() {
      let loadedConversation = false;
      setFeedbackMap(loadFeedbackFromStorage());
      const stored = loadConversationsFromStorage();
      if (stored.length > 0) {
        setConversations(sortConversations(stored));
        setActiveConversationId(sortConversations(stored)[0].id);
        setIsLoadingHistory(false);
        return;
      }

      try {
        const res = await fetch("/api/ai/mentor", { method: "GET" });
        if (res.ok) {
          const data = (await res.json()) as {
            conversationId?: string;
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
            const nowMs = Date.now();
            const conv: Conversation = {
              id: data.conversationId ?? `conv-${nowMs}`,
              title: deriveTitle(apiMessages),
              messages: apiMessages,
              createdAt: nowMs,
              updatedAt: nowMs,
            };
            setConversations([conv]);
            setActiveConversationId(conv.id);
            saveConversationsToStorage([conv]);
            loadedConversation = true;
          }
        }
      } catch {
        // Silently fall back to welcome message
      } finally {
        setIsLoadingHistory(false);
        if (!loadedConversation) {
          const newConv = createNewConversation(buildWelcomeMessage(mentorContext));
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
    const sorted = sortConversations(updated);
    setConversations(sorted);
    saveConversationsToStorage(sorted);
  }

  // Auto-scroll to bottom when messages change or loading state toggles
  useEffect(() => {
    const id = setTimeout(() => {
      requestAnimationFrame(() => scrollToBottom());
    }, 0);
    return () => clearTimeout(id);
  }, [messages.length, messages.at(-1)?.content, isSending, activeConversationId]);

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

  /** Lightweight token update — no sort, no localStorage write (perf during streaming). */
  function updateStreamingToken(convId: string, messageId: string, content: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, content } : m)) }
          : c
      )
    );
  }

  /** Update a single conversation by id inside the conversations array. */
  function updateConversation(convId: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === convId ? updater(c) : c));
      const sorted = sortConversations(next);
      saveConversationsToStorage(sorted);
      return sorted;
    });
  }

  /**
   * Core streaming helper shared by send / regenerate / edit-and-resend.
   * Streams the mentor response for `prompt` into the placeholder `mentorMessageId`
   * on conversation `convId`. Handles id remapping, cards, errors, and loading state.
   */
  async function streamResponse(convId: string, prompt: string, mentorMessageId: string) {
    updateConversation(convId, (c) => ({ ...c, isLoading: true, updatedAt: Date.now() }));

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const res = await fetch("/api/ai/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, conversationId: convId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }

      if (!res.body) throw new Error("Response stream is unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let serverConversationId = convId;
      let cards: MentorCard[] | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; token?: string; error?: string; conversationId?: string; cards?: MentorCard[] };
          if (event.type === "error") throw new Error(event.error ?? "Failed to get response");
          if (event.type === "token" && event.token) {
            content += event.token;
            updateStreamingToken(convId, mentorMessageId, content);
          }
          if (event.type === "done") {
            serverConversationId = event.conversationId ?? convId;
            cards = event.cards;
          }
        }
      }
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                id: serverConversationId,
                messages: c.messages.map((m) => (m.id === mentorMessageId ? { ...m, content, cards } : m)),
                updatedAt: Date.now(),
                isLoading: false,
              }
            : c
        );
        saveConversationsToStorage(next);
        return sortConversations(next);
      });
      if (serverConversationId !== convId) setActiveConversationId(serverConversationId);
    } catch (err) {
      const wasCancelled = err instanceof Error && err.name === "AbortError";
      setError(wasCancelled ? null : err instanceof Error ? err.message : "Failed to get response");
      updateConversation(convId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.id !== mentorMessageId || m.content.length > 0),
        isLoading: false,
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }

  async function handleSend(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isSending) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      const newConv = createNewConversation(buildWelcomeMessage(mentorContext));
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
    const mentorMessageId = `mentor-${Date.now()}`;

    updateConversation(targetConvId, (c) => ({
      ...c,
      messages: [...c.messages, userMessage, { id: mentorMessageId, role: "mentor", content: "", timestamp: new Date() }],
      title: deriveTitle([...c.messages, userMessage]),
      updatedAt: Date.now(),
    }));

    setInput("");
    setError(null);

    setTimeout(() => {
      requestAnimationFrame(() => scrollToBottom());
    }, 0);

    await streamResponse(targetConvId, trimmed, mentorMessageId);
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  /** Suggested questions send immediately instead of just filling the input. */
  function handleSuggestedQuestion(question: string) {
    void handleSend(question);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  /** Regenerate a mentor answer: re-run the preceding user prompt. */
  function handleRegenerate(mentorMessageId: string) {
    if (!activeConversationId || isSending) return;
    const conv = activeConversation;
    if (!conv) return;
    const mentorIndex = conv.messages.findIndex((m) => m.id === mentorMessageId);
    if (mentorIndex < 1) return;
    const userMessage = [...conv.messages.slice(0, mentorIndex)].reverse().find((m) => m.role === "user");
    if (!userMessage) return;

    const newMentorId = `mentor-${Date.now()}`;
    updateConversation(conv.id, (c) => ({
      ...c,
      messages: [
        ...c.messages.slice(0, mentorIndex),
        { id: newMentorId, role: "mentor", content: "", timestamp: new Date() },
      ],
      updatedAt: Date.now(),
    }));
    void streamResponse(conv.id, userMessage.content, newMentorId);
  }

  /** Edit a user message and resend: truncate everything after it, then re-run. */
  function handleEditAndResend(userMessageId: string, newContent: string) {
    if (!activeConversationId || isSending) return;
    const conv = activeConversation;
    if (!conv) return;
    const userIndex = conv.messages.findIndex((m) => m.id === userMessageId);
    if (userIndex < 0) return;

    const newMentorId = `mentor-${Date.now()}`;
    updateConversation(conv.id, (c) => ({
      ...c,
      messages: [
        ...c.messages.slice(0, userIndex),
        { id: userMessageId, role: "user", content: newContent, timestamp: new Date() },
        { id: newMentorId, role: "mentor", content: "", timestamp: new Date() },
      ],
      title: deriveTitle([...c.messages.slice(0, userIndex), { id: userMessageId, role: "user", content: newContent, timestamp: new Date() }]),
      updatedAt: Date.now(),
    }));
    setError(null);
    setTimeout(() => {
      requestAnimationFrame(() => scrollToBottom());
    }, 0);
    void streamResponse(conv.id, newContent, newMentorId);
  }

  /** Persist thumbs up/down feedback for a message (localStorage). */
  function handleFeedback(messageId: string, feedback: "up" | "down") {
    setFeedbackMap((prev) => {
      const clean = { ...prev };
      if (clean[messageId] === feedback) delete clean[messageId];
      else clean[messageId] = feedback;
      try {
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify(clean));
      } catch {
        // ignore
      }
      return clean;
    });
  }

  function handleNewChat() {
    const newConv = createNewConversation(buildWelcomeMessage(mentorContext));
    persistConversations([...conversations, newConv]);
    setActiveConversationId(newConv.id);
    setInput("");
    setError(null);
    setShowMobileSidebar(false);
    setTimeout(() => scrollToBottom(), 0);
  }

  function handleClearChat() {
    setShowClearConfirm(true);
  }

  function confirmClearChat() {
    if (activeConversationId) {
      if (!activeConversationId.startsWith("conv-")) {
        void fetch(`/api/ai/mentor?conversationId=${encodeURIComponent(activeConversationId)}`, { method: "DELETE" });
      }
      const remaining = conversations.filter((c) => c.id !== activeConversationId);
      persistConversations(remaining);

      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        const newConv = createNewConversation(buildWelcomeMessage(mentorContext));
        persistConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    }
    setShowClearConfirm(false);
    setTimeout(() => scrollToBottom(), 0);
  }

  function handleSelectConversation(convId: string) {
    setActiveConversationId(convId);
    setError(null);
    setShowMobileSidebar(false);
    setTimeout(() => scrollToBottom(), 0);
  }

  function handleDeleteConversation(convId: string) {
    if (!convId.startsWith("conv-")) {
      void fetch(`/api/ai/mentor?conversationId=${encodeURIComponent(convId)}`, { method: "DELETE" });
    }
    const remaining = conversations.filter((c) => c.id !== convId);
    persistConversations(remaining);

    if (convId === activeConversationId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        const newConv = createNewConversation(buildWelcomeMessage(mentorContext));
        persistConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    }
    setTimeout(() => scrollToBottom(), 0);
  }

  function handleTogglePin(convId: string) {
    updateConversation(convId, (c) => ({ ...c, pinned: !c.pinned }));
  }

  function startRename(convId: string, currentTitle: string) {
    setRenamingId(convId);
    setRenameDraft(currentTitle);
  }

  function commitRename() {
    if (!renamingId) return;
    const trimmed = renameDraft.trim() || "Untitled";
    updateConversation(renamingId, (c) => ({ ...c, title: trimmed }));
    setRenamingId(null);
  }

  function cancelClearChat() {
    setShowClearConfirm(false);
  }

  const filteredConversations = searchQuery
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  /** Sidebar content — shared by the desktop rail and the mobile drawer. */
  function renderSidebarContent() {
    return (
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

          {/* Search */}
          {conversations.length > 1 && (
            <div className="mt-3 relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30"
              />
            </div>
          )}

          {/* Recent conversations list */}
          {filteredConversations.length > 0 && (
            <div className="mt-3 space-y-1">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:scale-[1.02] ${
                    conv.id === activeConversationId
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {conv.pinned ? <Pin className="mr-1 h-3 w-3 shrink-0 text-brand-blue" /> : null}
                  {renamingId === conv.id ? (
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={commitRename}
                      autoFocus
                      className="flex-1 rounded border border-brand-blue bg-white px-1 py-0.5 text-sm focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(conv.id, conv.title);
                      }}
                    >
                      {conv.title}
                    </span>
                  )}
                  <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(conv.id);
                      }}
                      aria-label="Pin conversation"
                      className={`rounded p-1 hover:bg-blue-100 ${conv.pinned ? "text-brand-blue" : "text-slate-400 hover:text-brand-blue"}`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(conv.id, conv.title);
                      }}
                      aria-label="Rename conversation"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      aria-label="Delete conversation"
                      className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
      {/* ───────── Left column: Chat History + Quick Actions + Tips ───────── */}
      <div className="hidden lg:flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/80 backdrop-blur-sm">
        {renderSidebarContent()}
      </div>

      {/* ───────── Mobile drawer ───────── */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Menu</span>
              <button onClick={() => setShowMobileSidebar(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* ───────── Right column: Header + Messages + Input ───────── */}
      <div className="relative flex flex-1 flex-col min-h-0">
        {/* Header — pinned to top of right column */}
        <header className="shrink-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm md:px-6 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileSidebar(true)}
                aria-label="Open menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-brand-navy flex items-center gap-2 md:text-2xl">
                  <Sparkles className="h-5 w-6 text-brand-blue md:h-6" />
                  AI Mentor
                </h1>
                <p className="mt-0.5 text-xs text-slate-600 md:text-sm">
                  Your structured learning assistant for the Virtual Internship Program
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`rounded-full px-3 py-1 text-xs font-medium ${isSending ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                {isSending ? "Thinking…" : "Online"}
              </div>
              <div className="hidden text-xs text-slate-500 sm:block">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>

          {/* Context disclosure — what the mentor knows about you */}
          {mentorContext?.programName && (
            <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                What I know about you: {mentorContext.programName}
                {mentorContext.overallPercentage != null && ` • ${mentorContext.overallPercentage}% complete`}
                {mentorContext.daysRemaining != null && ` • ${mentorContext.daysRemaining} days left`}
              </summary>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {mentorContext.completedTasks != null && mentorContext.totalTasks != null && (
                  <p>Tasks: {mentorContext.completedTasks} of {mentorContext.totalTasks} completed</p>
                )}
                {mentorContext.nextTask && (
                  <p>Next task: Week {mentorContext.nextTask.weekNumber} — {mentorContext.nextTask.title}{mentorContext.nextTask.overdue ? " (overdue)" : ""}</p>
                )}
                {mentorContext.missionCount > 0 && <p>{mentorContext.missionCount} missions in this program</p>}
                {mentorContext.submissions.length > 0 && (
                  <p>Submissions: {mentorContext.submissions.map((s) => `${s.missionTitle} (${s.status})`).join(", ")}</p>
                )}
              </div>
            </details>
          )}
        </header>

        {/* Mobile suggested questions — only visible on small screens */}
        <div className="shrink-0 border-b border-slate-200 bg-white p-3 lg:hidden">
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

            {!isLoadingHistory && messages.map((msg, index) => (msg.content || msg.cards?.length) ? (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                cards={msg.cards}
                timestamp={msg.timestamp}
                isLatest={index === messages.length - 1}
                isStreaming={isSending && index === messages.length - 1 && msg.role === "mentor"}
                feedback={feedbackMap[msg.id] ?? null}
                onRegenerate={msg.role === "mentor" ? handleRegenerate : undefined}
                onEditAndResend={msg.role === "user" ? handleEditAndResend : undefined}
                onFeedback={handleFeedback}
              />
            ) : null)}

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
                  maxLength={MAX_INPUT_LENGTH}
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  disabled={isSending}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <span className={`text-xs ${input.length > MAX_INPUT_LENGTH * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
                    {input.length}/{MAX_INPUT_LENGTH}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={isSending ? handleStop : () => void handleSend()}
                disabled={!isSending && !input.trim()}
                aria-label={isSending ? "Stop generating" : "Send message"}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5">Enter</kbd> to send,{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5">Shift</kbd> +{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5">Enter</kbd> for new line
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`h-2 w-2 rounded-full ${isSending ? "bg-amber-500" : "bg-green-500"}`}></span>
                <span>{isSending ? "AI Mentor is thinking" : "AI Mentor is online"}</span>
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
