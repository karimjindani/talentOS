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
  HelpCircle
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "mentor";
  content: string;
  cards?: MentorCard[];
  timestamp: Date;
};

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
  const [messages, setMessages] = useState<Message[]>([
    {
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
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when new messages arrive only if user is near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    
    if (isNearBottom) {
      scrollToBottom();
    } else {
      // Show scroll button when new messages arrive but user is not at bottom
      setShowScrollButton(true);
    }
  }, [messages]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

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

  function handleSuggestedQuestion(question: string) {
    setInput(question);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-6xl">
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
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Suggested questions */}
        <div className="hidden lg:block sticky top-0 h-[calc(100vh-80px)] w-64 border-r border-slate-200 bg-white/50">
          <div className="h-full overflow-y-auto p-4">
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

        {/* Chat area */}
        <div className="relative flex flex-1 flex-col">
          {/* Suggested questions for mobile */}
          <div className="border-b border-slate-200 bg-white p-4 lg:hidden">
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

          {/* Message list */}
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
                      <span className="text-sm text-slate-500">AI Mentor is thinking...</span>
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

          {/* Floating scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              aria-label="Scroll to latest message"
              className="fixed bottom-24 right-6 z-50 rounded-full bg-brand-blue p-3 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}

          {/* Input area */}
          <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-4 md:px-6">
            <div className="mx-auto max-w-3xl">
              {/* Additional suggested questions */}
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
      </div>
    </div>
  );
}
