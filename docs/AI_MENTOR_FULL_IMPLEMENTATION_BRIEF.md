# AI Mentor — Full Implementation Brief

> This document is a complete technical breakdown of how the AI Mentor works inside the TalentOS Virtual Intern Platform. It is written to be given to another AI (e.g., ChatGPT) for deep discussion, design review, or brainstorming.

---

## 1. What the AI Mentor Is

The AI Mentor is the primary guidance system inside **TalentOS**, a platform that trains AI-native software engineering interns. It is **not** a generic chatbot. It is a scoped, context-aware mentor that:

- Knows the intern's program, progress, tasks, missions, submissions, and timeline.
- Answers questions about engineering practices (SDLC, SEM, testing, deployment, PRD).
- Refuses off-topic questions (sports, politics, math, entertainment, personal advice).
- Can answer some questions **without calling the LLM at all** (progress, task, timeline, submission queries are answered directly from the database).
- Streams responses token-by-token to the UI.
- Persists full conversation history to the database.
- Falls back gracefully to a stub response if the LLM API is unavailable.

---

## 2. High-Level Architecture (Request Flow)

```
User types a message in the Mentor chat UI
        ↓
POST /api/ai/mentor  (route handler)
        ↓
1. resolveTenantAccess()  →  auth check + tenant isolation
        ↓
2. Load last 8 conversation messages as history
        ↓
3. Persist the user's message to the DB
        ↓
4. buildApplicantContext(tenantId, userId)
   →  program, progress %, tasks, missions, submissions, days remaining
        ↓
5. retrieveKnowledge(prompt, 2)
   →  top 2 keyword-matched knowledge snippets from curated docs
        ↓
6. requestAIInteraction({ prompt, context, knowledge, history, onToken })
        ↓
7. classifyQuestion(prompt, context)   ← RBSE (Rule-Based System Engine)
   ├── "blocked"       →  return refusal (NO LLM call)
   ├── "direct_answer" →  return context-based answer (NO LLM call)
   └── "allow_llm"     →  proceed to LLM
        ↓
8. Check LLM cache (dynamic key = tenant + user + context signature + prompt)
   ├── cache HIT  →  return cached response (NO LLM call)
   └── cache MISS →  proceed
        ↓
9. buildSystemPrompt(context, knowledge)
   =  role + rules + applicant context section + knowledge section
        ↓
10. callGLM(systemPrompt, prompt, history, onToken)
    POST to ZhipuAI /chat/completions  (stream: true, SSE)
        ↓
11. parseSSEStream() → tokens streamed to UI in real time
        ↓
12. On primary model failure → retry with fallback model (glm-5.1)
    On both fail → generateStubResponse() (knowledge-based fallback)
        ↓
13. Cache the successful response
        ↓
14. Persist mentor response to DB (with cards JSON)
        ↓
15. UI receives NDJSON stream: { token } → { done, conversationId, cards }
```

---

## 3. The "Thinking" Pipeline — How the Mentor Decides What to Do

The mentor does **not** blindly send every message to the LLM. It runs a multi-stage decision pipeline:

### Stage 1: RBSE Classification (Rule-Based System Engine)

**File:** `apps/applicant/lib/ai-rbse.ts`

Before any LLM call, `classifyQuestion(prompt, context)` runs. This is a **deterministic rule engine** that categorizes the user's prompt into one of three outcomes:

| Outcome | Meaning | LLM Called? |
|---------|---------|-------------|
| `blocked` | Off-topic question (sports, politics, math, movies, personal advice, etc.) | ❌ No |
| `direct_answer` | Question answerable from the intern's database context (progress, task, timeline, submissions) | ❌ No |
| `allow_llm` | Legitimate question that needs LLM reasoning | ✅ Yes |

**Why this matters:** 60–70% of typical intern questions (progress, task, timeline) are answered in <100ms from the database without spending LLM tokens. Off-topic questions are blocked instantly. Only genuine mentoring questions hit the LLM.

#### Allowed Topics (50+ keywords)
internship, task, assignment, mission, project, deliverable, PRD, user story, requirement, progress, status, timeline, schedule, deadline, submission, review, feedback, SDLC, SEM, testing, unit test, TDD, deployment, CI/CD, Docker, engineering, code, coding, career, guidance, mentor, skill, competency, learning, milestone, roadmap, etc.

#### Blocked Topics (60+ keywords)
- **Math:** calculate, equation, solve, formula
- **Politics:** government, election, vote, president, party
- **Sports:** football, soccer, cricket, game, player
- **Entertainment:** movie, film, TV, actor, story, plot
- **General knowledge:** trivia, history, physics, quantum, space
- **Unrelated coding:** snake game, tic-tac-toe, calculator app, weather app
- **Personal advice:** relationship, family, health, financial, crypto, stock
- **Identity:** "who is [name]", "who am I", "your name"

#### Direct Answer Patterns (regex-matched)
- **Progress:** `what's my progress`, `how am I doing`, `my completion status`
- **Task:** `what's my task today`, `what should I work on`, `next task`
- **Timeline:** `show my timeline`, `what's my schedule`, `upcoming weeks`
- **Submission:** `submission status`, `what have I submitted`, `my submissions`

When a direct answer is matched, `generateDirectAnswer()` builds a response **entirely from the ApplicantContext** (database data) — no LLM needed. For example:
- Progress → "You're 40% through Full-Stack Engineering Internship. 4 of 10 tasks completed, 30 days remaining." + a ProgressCard + a BadgeCard.
- Task → "Your next task is: Build REST API (Week 3)." + a TaskCard with due date.
- Timeline → mission items with status labels (🔒 Not assigned, ✅ Completed, 📝 Submitted, 🔧 In progress, 📋 Assigned).

### Stage 2: LLM Cache Check

**File:** `apps/applicant/lib/ai.ts` (lines 55–110)

If RBSE allows the LLM, the mentor checks an in-memory cache before calling the API:

- **Cache size:** 200 entries (LRU eviction)
- **TTL:** 5 minutes
- **Two key strategies:**
  - **Dynamic key** (personalized responses): `dynamic:{tenantId}:{userId}:{contextSignature}:{prompt}` — includes a hash of the applicant's current context (program, progress, task IDs, mission IDs, submission statuses). If the intern completes a task, the context signature changes → cache miss → fresh response.
  - **Static key** (shared knowledge): `static:{prompt}` — for general knowledge questions (SDLC, SEM, testing). Same answer for all users, so it's shared.

**Cache is never used when there's conversation history** — multi-turn conversations are always fresh.

### Stage 3: System Prompt Construction

**File:** `apps/applicant/lib/ai.ts` — `buildSystemPrompt(context, knowledge)`

The system prompt is the "brain" of the mentor. It has four parts:

#### Part A — Role & Rules
```
You are an AI Mentor for TalentOS, a platform that develops AI-native software engineers.
You are a supportive, practical AI Mentor for TalentOS—not a documentation reader.
Guide interns through tasks, missions, progress, and engineering practices (SDLC, SEM, testing, deployment).

RULES:
- Start with a direct, human answer; do not dump documentation or repeat the user's context.
- Continue naturally from recent turns. Treat short replies such as yes, no, done, not yet,
  an error message, or a platform name as answers to your previous question.
- Match the applicant's language and tone. If they use Roman Urdu mixed with English,
  reply naturally in the same mix while keeping technical terms in English.
- Briefly acknowledge progress or frustration when it is relevant; never restart with a
  generic introduction during an active conversation.
- Give exactly one small, concrete next action tailored to the applicant's current progress.
- End with at most one short, purposeful follow-up question only when it helps the learner.
- For simple questions, use only: What to do now and Next step.
  Use a detailed guide only when explicitly requested.
- Finish every sentence and section; do not begin an extra section if there is not enough room.
- Keep normal responses under 220 words unless the user explicitly asks for a detailed explanation.
- NEVER complete assignments for the intern — guide and explain only.
- If you don't know something, say so honestly.
```

#### Part B — Applicant Context (from database)
Rendered as human-readable text:
```
Program: Full-Stack Engineering Internship
Application Status: ACCEPTED
Days Remaining: 30
Overall Progress: 40% (4/10 tasks completed)
  Week 1: 3/5 tasks (60%)
  Week 2: 1/3 tasks (33%)
Upcoming Tasks:
  - [OVERDUE] Build REST API (Week 3, due Jul 15, 2026)
  - Write Unit Tests (Week 3, due Jul 18, 2026)
Missions:
  - Week 3: API Development (Intermediate) — assigned=IN_PROGRESS, submission=SUBMITTED
Submissions:
  - API Development: SUBMITTED
```

#### Part C — Knowledge Snippets (top 2 keyword-matched)
```
Relevant Knowledge:

[1] Software Development Principles (SDLC) (source: docs/sdlc.md)
Shift-left security, secure by design, iterative development...

[2] Testing Your Work (source: docs/Testing_Strategy.md)
Unit tests, integration tests, regression testing, TDD...
```

#### Part D — Conversation History
The last 8 messages (role "user" / "assistant"), each truncated to 1200 chars, appended to the messages array so the LLM has conversational continuity.

### Stage 4: LLM API Call

**File:** `apps/applicant/lib/ai.ts` — `callGLM()`

- **Provider:** ZhipuAI (Z.AI)
- **Primary model:** `glm-5.2` (configurable via `AI_MODEL` env var)
- **Fallback model:** `glm-5.1` (configurable via `AI_FALLBACK_MODEL` env var)
- **Endpoint:** `{AI_BASE_URL}/chat/completions` (default: `https://api.z.ai/api/coding/paas/v4`)
- **Streaming:** SSE (`stream: true`, `stream_options: { include_usage: true }`)
- **Max tokens:** 512 (configurable via `LLM_MAX_TOKENS`)
- **Temperature:** 0.7 (configurable via `LLM_TEMPERATURE`)
- **Timeout:** 60 seconds (via `AbortController`)
- **Retry:** 1 retry on 5xx server errors. No retry on 401/403 (auth), 429 (rate limit), or timeout.

**Messages array sent to LLM:**
```json
[
  { "role": "system", "content": "<system prompt from Stage 3>" },
  { "role": "user", "content": "<history msg 1>" },
  { "role": "assistant", "content": "<history msg 2>" },
  ...
  { "role": "user", "content": "<current prompt>" }
]
```

**SSE parsing:** `parseSSEStream()` reads `data: {...}` lines from the response body, extracts `choices[0].delta.content` fragments, and calls the `onToken` callback for each fragment — which streams tokens to the UI in real time.

### Stage 5: Fallback Chain

If the LLM call fails:
1. Retry with fallback model `glm-5.1`
2. If that also fails → `generateStubResponse()` — a deterministic fallback that uses the knowledge base and context to produce a useful response without any LLM:
   - If knowledge snippets matched → return the top snippet content + a TipsCard
   - If prompt mentions "task" → return a TaskCard with the next task
   - If prompt mentions "progress" → return a ProgressCard
   - If prompt mentions "timeline" → return a TimelineCard
   - If prompt mentions "tip/help" → return a TipsCard with engineering tips
   - Otherwise → generic guidance message

---

## 4. Applicant Context — What the Mentor Knows About the Intern

**File:** `apps/applicant/lib/ai-context.ts`

`buildApplicantContext(tenantId, userId)` gathers all data about the intern in parallel:

```typescript
ApplicantContext = {
  tenantId, userId,
  program: { id, name, slug, startsAt, endsAt } | null,
  applicationStatus: string | null,           // "ACCEPTED", etc.
  progress: {
    totalTasks, completedTasks, pendingTasks,
    overallPercentage,                        // 0-100
    weeks: [{ weekNumber, totalTasks, completedTasks, percentage }]
  } | null,
  upcomingTasks: [{                           // max 5, overdue first
    id, title, description, weekNumber,
    dueDate, estimatedTime, isCompleted
  }],
  missions: [{ id, title, weekNumber, difficulty }],
  assignments: [{ missionId, status }],       // ASSIGNED, IN_PROGRESS, etc.
  submissions: [{ missionTitle, status, submittedAt }],
  daysRemaining: number | null
}
```

**Key design decisions:**
- **Never throws** — returns a safe empty context on any database error, so the mentor always works even if the DB is partially unavailable.
- **Tenant isolation** — all queries are scoped by `tenantId + userId`.
- **Context signature** — `buildContextSignature(ctx)` hashes the context into a cache key component. If the intern completes a task, the signature changes, ensuring the next LLM response reflects the new progress.

---

## 5. Knowledge Base — What the Mentor Knows About Engineering

**File:** `apps/applicant/lib/knowledge-base.ts`

A **keyword-based retrieval system** (no embeddings, no pgvector — this is an MVP stepping stone). 10 curated knowledge entries are stored in code:

| # | Title | Source Doc | Keywords |
|---|-------|-----------|----------|
| 1 | Software Development Principles (SDLC) | `docs/sdlc.md` | sdlc, principle, software development, shift left, secure design |
| 2 | Spiral Engineering Method (SEM) | `docs/SEM.md` | sem, spiral, engineering method, lifecycle |
| 3 | Mission Structure & Deliverables | `docs/Mission_Framework.md` | mission, assignment, deliverable, prd, user story, architecture |
| 4 | How to Write a PRD | `docs/Mission_Framework.md` + `docs/Graduate_Profile.md` | prd, product requirement, requirements document |
| 5 | Testing Your Work | `docs/Testing_Strategy.md` | test, testing, regression, vitest, unit test, tdd |
| 6 | Competency Framework | `docs/Competency_Framework.md` | competency, skill, capability, learning area |
| 7 | Product Vision & Educational Philosophy | `docs/Product_Vision.md` | vision, philosophy, talentos, purpose, goal |
| 8 | Graduate Profile | `docs/Graduate_Profile.md` | graduate, career, outcome, capable, independent |
| 9 | AI Strategy | `docs/AI_Strategy.md` | ai strategy, ai mentor, ai help, knowledge assistant |
| 10 | Deployment & CI/CD Practices | `docs/sdlc.md` | deploy, deployment, ci, cd, cicd, pipeline, docker |

`retrieveKnowledge(prompt, maxResults=3)` counts keyword matches per entry, returns entries with ≥1 match sorted by score descending. The top 2 are injected into the system prompt.

---

## 6. Conversation Persistence

**File:** `packages/db/src/mentor.ts` (Prisma)

The mentor remembers conversations across sessions:

```prisma
model MentorConversation {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  title     String   @default("New Conversation")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  MentorMessage[]
  @@index([tenantId, userId, updatedAt])
}

model MentorMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           MentorMessageRole   // "user" | "mentor"
  content        String
  cardsJson      String?             // JSON-serialized MentorCard[]
  createdAt      DateTime @default(now())
  conversation   MentorConversation @relation(...)
  @@index([conversationId])
}
```

**Functions:**
- `getOrCreateConversation(tenantId, userId, title)` — finds most recent or creates new
- `appendMessage(conversationId, role, content, cardsJson)` — adds message + bumps `updatedAt`
- `loadConversationHistory(tenantId, userId, conversationId?)` — loads messages sorted by `createdAt` asc
- `listConversations(tenantId, userId)` — lists conversations without messages
- `deleteConversation(tenantId, userId, conversationId)` — deletes only if belongs to tenant + user

All queries are scoped by `tenantId + userId` — a user in one tenant can never see another tenant's conversations.

---

## 7. Response Cards — Structured UI Output

The mentor doesn't just return text. It can return **structured cards** alongside the text message:

| Card Type | Purpose | Fields |
|-----------|---------|--------|
| `task` | Show the intern's next task | title, description, dueDate, estimatedTime, "Start Task" button |
| `progress` | Visual progress indicator | percentage, animated bar, status label |
| `timeline` | Mission roadmap | numbered steps with "Current" badge |
| `tips` | Engineering tips list | numbered tips, "Save Tips" button |
| `badge` | Achievement badge | label, value, checkmark, "Share" button |

Cards are generated in two ways:
1. **Direct answers** (RBSE) — the `generateDirectAnswer()` function attaches cards to the response.
2. **Stub responses** — the `generateStubResponse()` function attaches cards based on keyword matching.
3. **LLM responses** — the LLM does NOT generate cards directly; cards come from the stub/direct-answer paths. The LLM response is text-only (markdown).

---

## 8. The UI Layer

**File:** `apps/applicant/app/dashboard/mentor/page.tsx`

- **Two-column layout:** Left sidebar (chat history list, quick actions, tips) + right column (header, message stream, input box).
- **Streaming:** The UI reads the NDJSON stream from the POST response. As `{ type: "token", token }` chunks arrive, the current mentor message is updated incrementally — the user sees text appear word-by-word.
- **Markdown rendering:** `react-markdown` + `remark-gfm` (GitHub Flavored Markdown) with syntax highlighting via `react-syntax-highlighter` (Prism, vscDarkPlus theme).
- **9 suggested question chips:** Today's Task, Show Progress, Timeline, My Missions, Explain SDLC, Explain SEM, Testing Strategy, Deployment, PRD Guide — color-coded, one-click.
- **Conversation management:** Multiple conversations, New Chat, Clear Chat, Delete Conversation, stored in localStorage + synced to DB.
- **Auto-scroll:** Scrolls to bottom on new messages; floating scroll-to-bottom button when user scrolls up.
- **Elapsed time indicator:** Shows "Generating response..." then "Still working... (Ns)" after 20 seconds.
- **Input:** Multi-line textarea, Enter to send, Shift+Enter for newline, character counter, Send/Stop button.

---

## 9. Model Configuration (Environment Variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GLM_Z_API_KEY` / `ZHIPUAI_API_KEY` | — | API key for ZhipuAI |
| `AI_BASE_URL` | `https://api.z.ai/api/coding/paas/v4` | LLM API base URL |
| `AI_MODEL` | `glm-5.2` | Primary model |
| `AI_FALLBACK_MODEL` | `glm-5.1` | Fallback model |
| `LLM_MAX_TOKENS` | `512` | Max response tokens |
| `LLM_TEMPERATURE` | `0.7` | Sampling temperature |
| `LLM_TIMEOUT_MS` | `60000` | Request timeout (60s) |
| `LLM_MAX_RETRIES` | `1` | Max retries on server error |

---

## 10. Performance Characteristics

| Path | Latency | LLM Cost |
|------|---------|----------|
| RBSE blocked | <100ms | $0 |
| RBSE direct answer | <100ms | $0 |
| Cache hit | <200ms | $0 |
| LLM call (streaming) | 2–5s | tokens × price |
| Stub fallback | <100ms | $0 |

The RBSE + cache combination means the majority of interactions cost nothing and respond instantly.

---

## 11. Testing

108 unit tests across 6 test files:

| File | Tests | Covers |
|------|-------|--------|
| `ai-rbse.test.ts` | 41 | Blocking, direct answers, allow-LLM, topic recognition |
| `ai.test.ts` | 15 | Stub fallback, LLM success, retry logic, SSE parsing, system prompt |
| `ai-context.test.ts` | 11 | Context building, safe fallback, tenant isolation, error resilience |
| `ai-cache.test.ts` | 6 | Cache hit/miss, static vs dynamic, never cache errors, per-user isolation |
| `knowledge-base.test.ts` | 22 | Keyword retrieval, scoring, limit, formatting, question classification |
| `mentor.test.ts` | 13 | Conversation CRUD, message append, history loading, tenant isolation |

---

## 12. The Educational Framework Behind the Mentor

The mentor is not ad-hoc — it's grounded in a structured educational framework:

### Spiral Engineering Method (SEM)
Every week follows: **Discover → Analyze → Specify → Design → Build → Test → Deploy → Present → Reflect → Production Readiness Review**. The mentor guides interns through this cycle.

### Mission Framework
Missions simulate real software engineering engagements. Each mission has:
- **Workflow:** Mission Brief → Clarification → Research → PRD → Design → Build → Test → Deploy → Demo → Reflection
- **Deliverables:** PRD, User Stories, Architecture, GitHub Repo, Deployment URL, Documentation, Loom Video, Engineering Journal
- **Difficulty:** Beginner → Intermediate → Advanced → Expert
- **Completion:** Bronze → Silver → Gold → Platinum

### Competency Framework
12 core competencies: Problem Discovery, Requirements Engineering, Solution Design, AI Collaboration, Software Construction, Quality Engineering, Deployment & Operations, Documentation, Communication, Professionalism, Engineering Leadership, Production Readiness.

### Graduate Profile
The goal: "create independent engineers, not senior engineers." Graduates should be able to: understand business problems, ask clarification questions, write PRDs, define user stories, design solutions, use AI effectively, build/test/deploy software, create documentation, present solutions, assess production readiness.

---

## 13. What the AI Mentor Does NOT Do (Current Limitations)

1. **No automated submission scoring/rubrics** — The RBSE name means "Rule-Based System Engine" (question classification), NOT "Rubric-Based Skill Evaluation." Rubrics and scoring are listed as future work.
2. **No AI Assignment Reviewer** — Listed as a V2 future component. Would evaluate submitted work against rubrics.
3. **No AI Interviewer** — Also V2. Would conduct mock technical interviews.
4. **No embeddings/vector search** — Knowledge retrieval is keyword-based. A pgvector + embeddings upgrade is planned.
5. **No multi-tenant model isolation** — All tenants use the same LLM model. Per-tenant model config is future work.
6. **Cards are not LLM-generated** — The LLM produces markdown text only. Structured cards come from the RBSE direct-answer and stub-response paths.
7. **No context window management** — Conversation history is capped at 8 messages × 1200 chars. No summarization or sliding window with summarization.

---

## 14. Future Roadmap (from docs/AI_Strategy.md)

| Phase | Component | Status |
|-------|-----------|--------|
| V1 (current) | AI Mentor | ✅ Implemented |
| V1 (current) | AI Knowledge Assistant | ✅ Implemented (merged into Mentor) |
| V2 | AI Assignment Reviewer | 🔜 Planned — evaluate submissions against rubrics |
| V2 | AI Interviewer | 🔜 Planned — mock technical interviews |
| V3 | AI Customer | 🔜 — Simulate a real customer for requirements practice |
| V3 | AI CTO | 🔜 — Simulate a CTO for architecture review |
| V3 | AI Product Manager | 🔜 — Simulate a PM for PRD review |
| V3 | AI QA Lead | 🔜 — Simulate a QA lead for test review |
| V3 | AI Security Officer | 🔜 — Simulate a security officer for security review |

---

## 15. Complete File Inventory

| File | Role |
|------|------|
| `apps/applicant/lib/ai.ts` | Core orchestration: system prompt, LLM call, cache, fallback, stub |
| `apps/applicant/lib/ai-rbse.ts` | Rule-Based System Engine: question classification |
| `apps/applicant/lib/ai-context.ts` | Applicant context builder (database → context object) |
| `apps/applicant/lib/knowledge-base.ts` | Keyword-based knowledge retrieval |
| `apps/applicant/app/api/ai/mentor/route.ts` | API route handler (POST/GET/DELETE) |
| `packages/db/src/mentor.ts` | Prisma persistence layer for conversations |
| `apps/applicant/app/dashboard/mentor/page.tsx` | Mentor chat UI page |
| `apps/applicant/app/dashboard/mentor/components/MessageBubble.tsx` | Markdown + syntax highlight rendering |
| `apps/applicant/app/dashboard/mentor/components/CardRenderer.tsx` | Structured card rendering (5 types) |
| `apps/applicant/lib/ai-rbse.test.ts` | 41 RBSE tests |
| `apps/applicant/lib/ai.test.ts` | 15 AI core tests |
| `apps/applicant/lib/ai-context.test.ts` | 11 context tests |
| `apps/applicant/lib/ai-cache.test.ts` | 6 cache tests |
| `apps/applicant/lib/knowledge-base.test.ts` | 22 knowledge base tests |
| `packages/db/src/mentor.test.ts` | 13 persistence tests |

---

## 16. Summary — How the Mentor "Thinks"

1. **Filter:** Is this question on-topic? (RBSE blocked check → refuse if off-topic)
2. **Shortcut:** Can I answer this from the database? (RBSE direct answer → respond instantly with context + cards)
3. **Remember:** Have I answered this exact question for this user in this context recently? (Cache check → return cached)
4. **Reason:** Build a system prompt with the intern's real context + relevant knowledge + conversation history, then ask the LLM (glm-5.2) to generate a response.
5. **Stream:** Send tokens to the UI as they arrive.
6. **Protect:** If the LLM fails, try the fallback model, then fall back to a knowledge-based stub.
7. **Persist:** Save both the user's message and the mentor's response to the database.
8. **Guide, don't solve:** The system prompt explicitly says "NEVER complete assignments for the intern — guide and explain only."

The mentor is a **scoped, context-aware, cost-optimized guidance system** — not a general-purpose chatbot. Every design decision (RBSE, cache, stub fallback, context injection, knowledge retrieval, topic blocking) serves the goal of giving interns fast, relevant, personalized guidance while minimizing LLM cost and maximizing uptime.
