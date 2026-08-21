# AI Mentor — Architecture, Concepts & End-to-End Flow

**Version:** v0.20.6 (working draft)
**Date:** August 21, 2026
**Scope:** Applicant portal AI Mentor — all logic, concepts, and request flow

---

## 1. Overview

The AI Mentor is the applicant portal's built-in coaching assistant. It answers questions about missions, tasks, progress, journal entries, submissions, engineering concepts (SDLC, SEM, testing, deployment), and program rules — using the applicant's real data plus a knowledge base plus the project documentation.

**Key design principle:** The mentor never guesses. It either answers from verified knowledge (curated rules, docs, applicant context) or says "I don't know." It never completes assignments for the intern — it guides and explains only.

---

## 2. Concepts Applied

The AI Mentor combines **six concepts** in a layered pipeline:

| # | Concept | What it does | Where |
|---|---------|-------------|-------|
| 1 | **RBSE** (Rule-Based System Engine) | Classifies every question before any LLM call — blocks off-topic, answers simple queries directly, allows complex ones to the LLM | `lib/ai-rbse.ts` |
| 2 | **RAG** (Retrieval-Augmented Generation) | Retrieves relevant knowledge snippets and docs sections, injects them into the LLM prompt so answers are grounded in real documentation | `lib/knowledge-base.ts` + `data/docs-index.ts` |
| 3 | **Context-Aware Prompting** | Builds a real-time applicant context (program, missions, progress, journal counts, task completion, submissions) and injects it into the system prompt | `lib/ai-context.ts` |
| 4 | **Streaming** (Server-Sent Events / NDJSON) | Streams the LLM response token-by-token to the browser so the user sees text appear live | `route.ts` + `page.tsx` |
| 5 | **Smart Caching** | Caches LLM responses by a context signature — if the applicant's data hasn't changed, the same question returns the cached answer without calling the LLM | `lib/ai.ts` |
| 6 | **Graceful Degradation** | If the LLM is unavailable (no API key, timeout, error), falls back to a stub response built from the knowledge base + applicant context | `lib/ai.ts` |

---

## 3. The Six Concepts in Detail

### 3.1 RBSE — Rule-Based System Engine

**Purpose:** A pre-LLM gate that classifies every question into one of three actions, so the LLM is only called when needed. This saves API costs, enforces safety, and gives instant answers for simple queries.

**File:** `apps/applicant/lib/ai-rbse.ts`

**Three classifications:**

```
User question
     │
     ▼
classifyQuestion(prompt, context)
     │
     ├──► "blocked"         → Return refusal response. LLM never called.
     │                        (off-topic: sports, politics, personal names, etc.)
     │
     ├──► "direct_answer"   → Return canned response from applicant context.
     │                        (progress, tasks, timeline, submissions — no LLM needed)
     │
     └──► "allow_llm"       → Proceed to LLM (or stub fallback)
                              (everything else: SDLC, SEM, mission details, etc.)
```

**How blocking works:**
- `BLOCKED_TOPICS` — a list of off-topic substrings (sports, politics, movies, etc.)
- `PERSONAL_NAME_PATTERNS` — regex patterns that match "tell me about \<Name\>", "who is \<Name\>", etc.
- `NAME_PATTERN_ALLOWLIST` — internship terms (mission, task, SDLC, etc.) that override the name patterns — so "tell me about mission 1" is NOT blocked, but "tell me about John" IS blocked
- Short prompts (< 3 words) with no allowed topic are blocked

**How direct answers work:**
- `DIRECT_ANSWER_PATTERNS` — regex patterns for common queries:
  - Progress: "what's my progress", "how am i doing"
  - Task: "what should i work on", "next task"
  - Timeline: "show my timeline", "my missions"
  - Submission: "submission status", "what have i submitted"
- These return a structured response (text + cards) built from the applicant context — no LLM call needed

### 3.2 RAG — Retrieval-Augmented Generation

**Purpose:** Ground the LLM's answers in real documentation so it doesn't hallucinate. Two layers:

**File:** `apps/applicant/lib/knowledge-base.ts` + `apps/applicant/data/docs-index.ts`

**Layer 1 — Curated Knowledge Base (17 entries):**
- Hand-written entries for platform-enforced rules that come from code, not docs
- High precision — keywords are carefully chosen
- Gets a score boost (+10) so it wins over docs sections
- Entries: SDLC principles, SEM lifecycle, mission structure, PRD guidance, testing strategy, competency framework, product vision, graduate profile, AI strategy, deployment/CI-CD, journal rules, mission lifecycle, tasks, submission workflow, applications, recruiter portal, calendar

**Layer 2 — Auto-Generated Docs Index (347 sections):**
- Generated at build time by `scripts/build-docs-index.mjs`
- Reads all 28 `docs/*.md` files, splits into sections by markdown headers
- Extracts keywords for each section (frequency-based, stop-word filtered)
- Written to `apps/applicant/data/docs-index.ts` (auto-generated, never edit manually)
- Runs automatically on every Docker build (Dockerfile step) and `npm run build`
- **Auto-stays-current:** when developers add features and document them in `docs/`, the mentor automatically knows about them on the next build — no manual KB update needed

**Retrieval flow:**

```
User prompt
     │
     ▼
retrieveKnowledge(prompt, maxResults)
     │
     ├──► Search Layer 1: Curated KB (17 entries)
     │    Keyword match: prompt.includes(keyword) → score += 1
     │    Curated boost: score += 10
     │    Track covered source files (for dedup)
     │
     ├──► Search Layer 2: Docs Index (347 sections)
     │    Skip sections whose source is already covered by Layer 1
     │    Keyword match: prompt.includes(keyword) → score += 1
     │
     ├──► Merge + sort by score (desc)
     │
     └──► Return top N snippets → injected into LLM system prompt
```

**What the LLM receives:**
```
Relevant Knowledge:

[1] Engineering Journal Rules (source: docs/Mission_Framework.md + platform enforcement)
Engineering Journal — rules and requirements:
... (full content)

[2] Mission Lifecycle & Deadlines (source: docs/Mission_Framework.md + platform enforcement)
Mission Lifecycle & Deadlines:
... (full content)
```

### 3.3 Context-Aware Prompting

**Purpose:** Give the LLM the applicant's real data so it can answer specifically (not generically).

**File:** `apps/applicant/lib/ai-context.ts`

**What `buildApplicantContext` fetches from the database:**
- User's accepted application + program (name, dates)
- Published missions (id, title, week, difficulty)
- Mission assignments (status, deadline)
- Submissions (status, submitted date)
- Program tasks (required, published, mission-scoped)
- Task completions (which tasks the user has completed)
- Engineering journal entries (count per mission)
- Overall progress (task completion %, per-week breakdown)
- Days remaining in the program

**Per-mission readiness summary (`missionStatus`):**
For each mission, the context includes an unambiguous status block:
```
Mission 1: Build a Production-Grade Automated Testing Suite (BEGINNER)
  - Assignment: you accepted the assignment (started; NOT yet completed), deadline Aug 27
  - Submission: NOT YET SUBMITTED
  - Tasks: 1/1 required tasks done
  - Journal: 0 entries (4 required before submission)
  - Status: IN PROGRESS — not yet submitted
```

This prevents the LLM from misreading "ACCEPTED" assignment status as "mission completed" or conflating task % with mission completion.

**Context signature (cache key):**
`buildContextSignature` creates a hash of all dynamic fields (program id, task completions, mission statuses, journal counts, submission statuses, days remaining). If any field changes, the signature changes → cache miss → fresh LLM call.

### 3.4 Streaming (NDJSON)

**Purpose:** Show the LLM's response appearing live, token by token, instead of waiting for the full response.

**How it works:**
1. The API route creates a `TransformStream` and returns it as the response body
2. The LLM API is called with `stream: true` — it returns an SSE stream (`data: {...}` lines)
3. `parseSSEStream` reads the stream, extracts `choices[0].delta.content` fragments
4. Each fragment is written to the TransformStream as a JSON line: `{"type":"token","token":"Hello"}`
5. The browser reads the stream with `response.body.getReader()`, parses each line, and appends the token to the message
6. When the stream ends, a final `{"type":"done","conversationId":"...","cards":[...]}` event is sent

**Streaming-safe rendering:**
While streaming, the message is rendered as plain text (with a blinking cursor) — not markdown. This avoids the jank of ReactMarkdown re-parsing partial code fences and tables on every token. Once streaming completes, the full markdown is rendered.

### 3.5 Smart Caching

**Purpose:** Avoid redundant LLM calls when the answer hasn't changed.

**File:** `apps/applicant/lib/ai.ts`

**How it works:**
- Cache key = `dynamic:tenantId:userId:contextSignature:prompt` (for dynamic questions)
- Cache key = `static:prompt` (for static knowledge questions — same for all users)
- Dynamic vs. static is determined by `isDynamicAction()` — questions about "my task", "my progress", "my timeline" are dynamic; questions about "SDLC", "SEM", "testing" are static
- TTL: 5 minutes
- Max size: 200 entries (oldest evicted when full)
- Never caches: errors, responses that used conversation history (those are personal to the learner)

### 3.6 Graceful Degradation (Stub Fallback)

**Purpose:** The mentor still works even if the LLM API is down or not configured.

**When stub mode activates:**
- No `GLM_Z_API_KEY` configured → stub mode for all LLM-allowed questions
- LLM call fails (timeout, auth error, rate limit, network error) → falls back to stub

**What the stub does:**
- `generateStubResponse()` builds a response from:
  - Knowledge snippets (if any matched) → returns the top snippet's content
  - Applicant context (if available) → context-aware canned responses for task/progress/timeline keywords
  - Generic fallback → "I can help you with tasks, progress, timelines, tips..."
- The response is marked `status: "stubbed"` (or `"error"` if the LLM failed)
- If the LLM failed, a note is appended: "(The AI service was unavailable, showing a cached response.)"

---

## 4. End-to-End Request Flow

Here is the complete flow from the user typing a message to the response appearing on screen:

### Step 1: User types and sends (Client)

**File:** `apps/applicant/app/dashboard/mentor/page.tsx` — `handleSend()`

```
User types "tell me about mission 1" and hits Enter
     │
     ▼
handleSend() — page.tsx:290
     │
     ├──► Creates user message + empty mentor placeholder
     ├──► Appends both to the active conversation
     ├──► Sets isLoading = true on the conversation
     ├──► Clears the input field
     │
     └──► Calls streamResponse(convId, prompt, mentorMessageId) — page.tsx:335
```

### Step 2: Client sends fetch to API (Client → Server)

**File:** `apps/applicant/app/dashboard/mentor/page.tsx` — `streamResponse()`

```
streamResponse() — page.tsx:335
     │
     ├──► POST /api/ai/mentor
     │    Body: { prompt: "tell me about mission 1", conversationId: "conv-..." }
     │    signal: AbortController (for stop button)
     │
     ├──► Response is a stream (application/x-ndjson)
     │
     ├──► Reads stream with response.body.getReader()
     │
     ├──► For each line:
     │    ├──► { type: "token", token: "Your" } → append to mentor message content
     │    ├──► { type: "done", conversationId, cards } → set final content + cards
     │    └──► { type: "error", error } → show error
     │
     └──► On completion: isLoading = false, save to localStorage
```

### Step 3: API route receives request (Server)

**File:** `apps/applicant/app/api/ai/mentor/route.ts` — `POST handler`

```
POST /api/ai/mentor — route.ts:59
     │
     ├──► resolveTenantAccess() — verify the user is authenticated
     │    Returns: { tenant, actorUserId } or 401
     │
     ├──► Validate prompt (non-empty, ≤ 2000 chars)
     │
     ├──► Load or create conversation (getOrCreateConversation)
     │    Loads last 8 messages as conversation history
     │    Maps role "mentor" → "assistant" for the LLM
     │    Truncates each turn to 1200 chars
     │
     ├──► Persist the user's message (appendMessage)
     │
     ├──► Build applicant context (buildApplicantContext) — see Step 4
     │
     ├──► Retrieve knowledge (retrieveKnowledge) — see Step 5
     │
     ├──► Create a TransformStream for streaming response
     │
     └──► Call requestAIInteraction() asynchronously — see Step 6
          Results are streamed back through the TransformStream
```

### Step 4: Build applicant context (Server)

**File:** `apps/applicant/lib/ai-context.ts` — `buildApplicantContext()`

```
buildApplicantContext(tenantId, userId) — ai-context.ts:114
     │
     ├──► Find the user's ACCEPTED application
     │    If none → return empty context (all fields null/empty)
     │
     ├──► Parallel DB queries (Promise.all):
     │    ├──► listProgramTasks — all tasks for the program
     │    ├──► listCompletedTaskIds — which tasks the user completed
     │    ├──► listPublishedProgramMissions — published missions
     │    ├──► getApplicantProgramProgress — per-week progress
     │    ├──► prisma.submission.findMany — submissions
     │    ├──► listApplicantMissionAssignmentStatuses — assignment states
     │    └──► prisma.engineeringJournalEntry.findMany — journal entries
     │
     ├──► Build per-mission readiness summary (missionStatus):
     │    For each mission:
     │    ├──► assignmentStatus (ACCEPTED, IN_PROGRESS, PASSED, etc.)
     │    ├──► hasSubmission + submissionStatus
     │    ├──► journalEntryCount
     │    └──► requiredTaskCompleted / requiredTaskTotal
     │
     ├──► Build upcoming tasks (max 5, overdue first, then by due date)
     │
     ├──► Compute days remaining
     │
     └──► Return ApplicantContext object
          │
          ▼
     contextToPromptSection(ctx) — ai-context.ts:339
          Renders as human-readable text for the LLM:
          ┌──────────────────────────────────────────────┐
          │ Program: Cloud-Native Computer Science        │
          │ Application Status: ACCEPTED                  │
          │ Days Remaining: 6                             │
          │ Task Completion: 100% (1/1 program tasks      │
          │   done). NOTE: this is TASK completion, NOT   │
          │   mission completion...                       │
          │                                               │
          │ Missions (authoritative status):              │
          │   Mission 1: Build a Production-Grade...      │
          │     - Assignment: you accepted the...         │
          │     - Submission: NOT YET SUBMITTED           │
          │     - Tasks: 1/1 required tasks done          │
          │     - Journal: 0 entries (4 required)         │
          │     - Status: IN PROGRESS — not yet submitted │
          └──────────────────────────────────────────────┘
```

### Step 5: Retrieve knowledge (Server)

**File:** `apps/applicant/lib/knowledge-base.ts` — `retrieveKnowledge()`

```
retrieveKnowledge("tell me about mission 1", 2) — knowledge-base.ts:426
     │
     ├──► Layer 1: Search curated KB (17 entries)
     │    "mission" matches:
     │    ├──► "Mission Structure & Deliverables" (score: 1 + 10 = 11)
     │    ├──► "Mission Lifecycle & Deadlines" (score: 1 + 10 = 11)
     │    ├──► "Tasks & Weekly Tasks" (score: 0 — no match)
     │    └──► etc.
     │    Covered sources: docs/Mission_Framework.md
     │
     ├──► Layer 2: Search docs index (347 sections)
     │    Skip sections from docs/Mission_Framework.md (already covered)
     │    "mission" matches other docs sections → score by keyword hits
     │
     ├──► Merge + sort by score (curated first, then docs)
     │
     └──► Return top 2 snippets
          │
          ▼
     knowledgeToPromptSection(snippets) — knowledge-base.ts:464
          Renders as:
          ┌──────────────────────────────────────────────┐
          │ Relevant Knowledge:                          │
          │                                              │
          │ [1] Mission Lifecycle & Deadlines            │
          │ (source: docs/Mission_Framework.md)          │
          │ Mission Lifecycle & Deadlines:               │
          │ ... (full content)                            │
          │                                              │
          │ [2] Mission Structure & Deliverables         │
          │ (source: docs/Mission_Framework.md)          │
          │ ... (full content)                            │
          └──────────────────────────────────────────────┘
```

### Step 6: RBSE classification (Server)

**File:** `apps/applicant/lib/ai-rbse.ts` — `classifyQuestion()`

```
classifyQuestion("tell me about mission 1", context) — ai-rbse.ts
     │
     ├──► isQuestionAllowed("tell me about mission 1")
     │    ├──► hasAllowedTopic? "mission" ∈ ALLOWED_TOPICS → YES
     │    ├──► hasBlockedTopic? "tell me about " was REMOVED from BLOCKED_TOPICS → NO
     │    ├──► matchesPersonalName? "mission" ∈ NAME_PATTERN_ALLOWLIST → NO
     │    └──► Return: true (allowed)
     │
     ├──► getDirectAnswerType("tell me about mission 1")
     │    └──► No DIRECT_ANSWER_PATTERN matches → null
     │
     └──► Return: { type: "allow_llm" }
          → Proceed to LLM (or stub fallback)
```

### Step 7: LLM call or stub (Server)

**File:** `apps/applicant/lib/ai.ts` — `requestAIInteraction()`

```
requestAIInteraction() — ai.ts:588
     │
     ├──► Step 1: RBSE classification (Step 6)
     │    ├──► "blocked" → return refusal (no LLM)
     │    ├──► "direct_answer" → return canned response (no LLM)
     │    └──► "allow_llm" → continue
     │
     ├──► Step 2: Check LLM config
     │    hasLLMConfig()? → GLM_Z_API_KEY set?
     │    ├──► NO → generateStubResponse() (Step 7b)
     │    └──► YES → continue
     │
     ├──► Step 3: Check cache
     │    cacheKey = dynamic:tenantId:userId:contextSignature:prompt
     │    canUseCache? (no conversation history)
     │    ├──► Cache HIT → return cached response (no LLM call)
     │    └──► Cache MISS → continue
     │
     ├──► Step 4: Build system prompt
     │    buildSystemPrompt(context, knowledge) — ai.ts:137
     │    ┌──────────────────────────────────────────────┐
     │    │ You are an AI Mentor for TalentOS...          │
     │    │ RULES:                                        │
     │    │ - Start with a direct, human answer...        │
     │    │ - Do NOT end with a follow-up question...     │
     │    │ - Keep under 220 words...                     │
     │    │ - NEVER complete assignments...               │
     │    │                                               │
     │    │ --- Applicant Context ---                     │
     │    │ Program: Cloud-Native Computer Science        │
     │    │ ... (from contextToPromptSection)             │
     │    │                                               │
     │    │ Relevant Knowledge:                           │
     │    │ [1] Mission Lifecycle & Deadlines...          │
     │    │ [2] Mission Structure & Deliverables...       │
     │    └──────────────────────────────────────────────┘
     │
     ├──► Step 5: Call LLM
     │    callGLM(systemPrompt, prompt, maxTokens, model, history, onToken)
     │    │
     │    ├──► POST {AI_BASE_URL}/chat/completions
     │    │    Headers: Authorization: Bearer {GLM_Z_API_KEY}
     │    │    Body: { model, messages, max_tokens, temperature, stream: true }
     │    │
     │    ├──→ SSE stream response (data: {...} lines)
     │    │    parseSSEStream() extracts delta.content fragments
     │    │    Each fragment → onToken(token) → streamed to client
     │    │
     │    ├──► On success → return { content, usage }
     │    │
     │    ├──► On failure (primary model glm-5.2):
     │    │    └──► Retry with fallback model (glm-5.1)
     │    │         └──► If fallback also fails → throw
     │    │
     │    └──► Timeout: 60 seconds (AbortController)
     │
     ├──► Step 6: Cache the response
     │    setCachedLLMResponse(cacheKey, content)
     │
     └──► Return { status: "ok", message: content }
          │
          ├──► If LLM failed (both models):
          │    generateStubResponse() → return { status: "error", message: stub + note }
          │
          ▼
     Step 7b: Stub fallback (if no LLM key or LLM failed)
          generateStubResponse(prompt, context, knowledge) — ai.ts:402
          ├──► If knowledge matched → return top snippet content + badge card
          ├──► If "task" keyword → return next task from context + task card
          ├──► If "progress" keyword → return progress % + progress card
          ├──► If "timeline" keyword → return mission timeline + timeline card
          ├──► If "tip" keyword → return tips + tips card
          └──► Else → generic "I can help you with..." response
```

### Step 8: Persist and stream response (Server)

**File:** `apps/applicant/app/api/ai/mentor/route.ts`

```
requestAIInteraction() returns
     │
     ├──► If tokens were streamed (emitted = true):
     │    The client already received them via the stream
     │
     ├──► If no tokens were streamed (stub/cache hit):
     │    send({ type: "token", token: response.message })
     │    → sends the full message as one token
     │
     ├──► Persist the mentor's response:
     │    appendMessage(conversation.id, "mentor", response.message, cardsJson)
     │
     ├──► Send final event:
     │    send({ type: "done", conversationId, cards, status })
     │
     └──► Close the stream
```

### Step 9: Client renders response (Client)

**File:** `apps/applicant/app/dashboard/mentor/page.tsx` + `components/MessageBubble.tsx`

```
Stream events arrive at the browser
     │
     ├──► { type: "token", token: "Your" }
     │    updateStreamingToken(convId, messageId, "Your")
     │    → MessageBubble renders plain text + blinking cursor (streaming-safe)
     │
     ├──► { type: "token", token: " Mission" }
     │    updateStreamingToken(convId, messageId, "Your Mission")
     │    → plain text updates live
     │
     ├──► ... (more tokens stream in)
     │
     ├──► { type: "done", conversationId, cards }
     │    ├──► Set final content + cards on the message
     │    ├──► isLoading = false
     │    ├──► Save conversations to localStorage
     │    └──► Remap conversation ID if server assigned a new one
     │
     └──► MessageBubble re-renders:
          ├──► isStreaming = false → full ReactMarkdown render (headings, lists, code, tables)
          ├──► Cards rendered via CardRenderer (task, progress, timeline, tips, badge, code, resource)
          └──► Hover action bar appears (copy, regenerate, edit, thumbs up/down)
```

---

## 5. Configuration

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `GLM_Z_API_KEY` | LLM API key (GLM/Z.AI or LiteLLM proxy) | `sk-...` |
| `AI_BASE_URL` | LLM API base URL (appends `/chat/completions`) | `http://10.10.80.31:4000/v1` |
| `AI_MODEL` | Primary model name | `glm-5.2` |
| `AI_FALLBACK_MODEL` | Fallback model if primary fails | `glm-5.1` |
| `LLM_MAX_TOKENS` | Max tokens per response | `512` |
| `LLM_TEMPERATURE` | LLM temperature | `0.7` |

Set in `.env` (gitignored). Docker Compose passes them to the container.

### Build Commands

| Command | Purpose |
|---------|---------|
| `npm run build:docs-index` | Regenerate the docs index from `docs/*.md` |
| `npm run build` | Build docs index + both apps |
| `docker compose up -d --build applicant` | Rebuild + restart the applicant container |

---

## 6. File Map

| File | Role |
|------|------|
| `apps/applicant/app/dashboard/mentor/page.tsx` | Chat UI (client) — send, stream, render, conversations |
| `apps/applicant/app/dashboard/mentor/components/MessageBubble.tsx` | Single message render — markdown, cards, actions |
| `apps/applicant/app/dashboard/mentor/components/CardRenderer.tsx` | Rich card rendering — task, progress, timeline, tips, badge, code, resource |
| `apps/applicant/app/api/ai/mentor/route.ts` | API route — GET (history/context), POST (send), DELETE (conversation) |
| `apps/applicant/lib/ai.ts` | Core orchestrator — RBSE dispatch, LLM call, cache, stub fallback |
| `apps/applicant/lib/ai-rbse.ts` | Rule-Based System Engine — classify, block, direct-answer |
| `apps/applicant/lib/ai-context.ts` | Applicant context builder — DB queries, prompt rendering, cache signature |
| `apps/applicant/lib/knowledge-base.ts` | RAG retrieval — curated KB + docs index search |
| `apps/applicant/data/docs-index.ts` | Auto-generated docs index (347 sections from `docs/*.md`) |
| `scripts/build-docs-index.mjs` | Build-time docs indexer — reads `docs/*.md`, writes `docs-index.ts` |
| `.env` | LLM configuration (API key, base URL, model) |

---

## 7. Decision Summary

| Decision | Why |
|----------|-----|
| RBSE before LLM | Save API costs, enforce safety, instant answers for simple queries |
| Two-layer RAG (curated + docs) | Curated = precise platform rules; docs = broad auto-current coverage |
| Build-time docs index (not runtime) | Works in Docker standalone build; no runtime filesystem access needed |
| Context signature for caching | Cache invalidates automatically when applicant data changes |
| Stub fallback | Mentor still works if LLM is down or not configured |
| Streaming-safe rendering | Plain text while streaming, markdown after — avoids re-parse jank |
| Per-mission readiness in context | Prevents LLM from misreading "ACCEPTED" as "completed" or task % as mission % |
| No follow-up questions | System prompt explicitly prohibits "Next step" prompts — just answer and stop |
