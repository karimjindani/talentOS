# GLM_Z.ai API Integration Analysis

> **Date:** 2026-07-07  
> **Version Baseline:** v0.14.2  
> **Branch:** `feat/applicant-ai-mentor-skeleton`  
> **Status:** Analysis only — no implementation yet

---

## 1. Current AI Mentor Flow

The AI Mentor is an applicant-facing chat interface at `/dashboard/mentor`. The current flow is:

1. **User** types a prompt in the chat box (`apps/applicant/app/dashboard/mentor/page.tsx`)
2. **Frontend** sends `POST /api/ai/mentor` with `{ prompt: string }`
3. **API route** (`apps/applicant/app/api/ai/mentor/route.ts`):
   - Calls `resolveTenantAccess()` to get the real `tenant.id` and `actorUserId`
   - Validates prompt (non-empty, max 2000 chars)
   - Persists the user message via `appendMessage()`
   - Calls `requestAIInteraction()` from `apps/applicant/lib/ai.ts`
   - Persists the mentor response (with `cardsJson`) via `appendMessage()`
   - Returns `{ status, message, cards? }`
4. **Stub service** (`apps/applicant/lib/ai.ts`):
   - `requestAIInteraction()` matches keywords in the prompt ("task", "progress", "timeline", "tips", "badge")
   - Returns a hardcoded `MentorCard` union response with `status: "stubbed"`
5. **Frontend** renders the response message + any cards via `CardRenderer`

**Key point:** No real LLM call is made. The `requestAIInteraction()` function is a keyword-matching stub.

---

## 2. Existing Files Related to AI Mentor

| File | Purpose |
|------|---------|
| `apps/applicant/lib/ai.ts` | AI service boundary — `AIInteractionRequest`, `MentorCard` union, `AIInteractionResponse`, `requestAIInteraction()` stub |
| `apps/applicant/app/api/ai/mentor/route.ts` | API endpoint — GET (load history) + POST (persist + respond) |
| `apps/applicant/app/dashboard/mentor/page.tsx` | Client component — chat UI, history loading, `CardRenderer` |
| `apps/applicant/lib/tenant-guard.ts` | `resolveTenantAccess()` — tenant + user resolution for auth |
| `apps/applicant/auth.ts` | Auth.js v5 Keycloak OIDC configuration |
| `packages/db/src/mentor.ts` | Persistence helpers — `getOrCreateConversation`, `appendMessage`, `loadConversationHistory` |
| `packages/db/prisma/schema.prisma` | Prisma models — `MentorConversation`, `MentorMessage`, `AIInteraction` |
| `docs/plans/v0.15.0_AI_Mentor_Roadmap.md` | 10-phase roadmap (phases 1-3 done, 4-10 pending) |
| `docs/AI_Strategy.md` | AI strategy document |
| `docs/Architecture.md` | Architecture overview |
| `.env` / `.env.example` | Environment config — no LLM keys present yet |

---

## 3. Current API Route Behavior

**`POST /api/ai/mentor`**
- **Auth:** Requires authenticated session via `resolveTenantAccess()`. Returns `401` if unauthenticated.
- **Validation:** Prompt must be non-empty and ≤ 2000 characters. Returns `400` on invalid input.
- **Persistence:** User message saved to `MentorMessage` (role: "user"). Mentor response saved to `MentorMessage` (role: "assistant") with `cardsJson`.
- **Response generation:** Calls `requestAIInteraction()` which returns a stubbed response based on keyword matching.
- **Response shape:** `{ status: "stubbed", message: string, cards?: MentorCard[] }`
- **Error handling:** Returns `500` with `{ error: "Failed to generate mentor response" }` on any exception.

**`GET /api/ai/mentor`**
- Returns conversation history for the authenticated user's tenant.
- Returns `401` if unauthenticated.

---

## 4. Where GLM_Z.ai API Should Be Connected

The integration point is **`apps/applicant/lib/ai.ts`** — specifically the `requestAIInteraction()` function.

**Current signature:**
```typescript
export async function requestAIInteraction(
  req: AIInteractionRequest
): Promise<AIInteractionResponse>
```

**Recommended approach:** Replace the stub body of `requestAIInteraction()` with a real call to the ZhipuAI (GLM) API. The function signature and return type (`AIInteractionResponse`) stay the same so the API route and frontend don't change.

**Alternative (per roadmap Phase 6):** Create a new shared package `packages/ai/` that wraps the ZhipuAI client, and have `lib/ai.ts` import from it. This is cleaner for multi-app usage but adds a package boundary.

**Decision:** For MVP, modify `lib/ai.ts` directly. Refactor to `packages/ai/` later if the admin app also needs LLM access.

---

## 5. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ZHIPUAI_API_KEY` | ZhipuAI API key for GLM access | `xxxxxxxx.xxxxxxxx` |
| `ZHIPUAI_BASE_URL` | Base URL for ZhipuAI API (optional, has default) | `https://open.bigmodel.cn/api/paas/v4` |
| `ZHIPUAI_MODEL` | Model identifier to use | `glm-4` or `glm-4-flash` |
| `LLM_MAX_TOKENS` | Max response tokens (optional) | `1024` |
| `LLM_TEMPERATURE` | Sampling temperature (optional) | `0.7` |

**Note:** These must be added to both `.env` and `.env.example`. The API key must NOT be committed to version control.

---

## 6. Expected Request Mapping

**ZhipuAI API request** (POST to `/chat/completions`):

```json
{
  "model": "glm-4-flash",
  "messages": [
    { "role": "system", "content": "You are an AI mentor for interns..." },
    { "role": "user", "content": "<user prompt>" }
  ],
  "max_tokens": 1024,
  "temperature": 0.7,
  "stream": false
}
```

**Mapping from our `AIInteractionRequest`:**
- `req.prompt` → `messages[1].content` (user message)
- System prompt → constructed from `req.purpose` + applicant context (Phase 4)
- `req.tenantId` / `req.userId` → used for logging/audit, not sent to GLM

**With RAG (Phase 5):** Retrieved knowledge base snippets prepended to the system message as context.

---

## 7. Expected Response Mapping

**ZhipuAI API response:**
```json
{
  "id": "chatcmpl-xxx",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "..." },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 50, "completion_tokens": 120, "total_tokens": 170 }
}
```

**Mapping to our `AIInteractionResponse`:**
- `choices[0].message.content` → `message` field
- `status` → `"ok"` (instead of `"stubbed"`)
- `cards` → Parse structured output from the LLM response (if using function calling / JSON mode) or omit cards and return plain text
- `usage` → Log to `AIInteraction` model for cost tracking

**Card generation strategy:** Use GLM function calling / JSON mode to ask the LLM to return structured `MentorCard[]` alongside its text response. Alternatively, parse a JSON block from the response content.

---

## 8. Error Handling Plan

| Scenario | Handling |
|----------|----------|
| `ZHIPUAI_API_KEY` not set | Return stubbed response with a warning log (graceful fallback) |
| API timeout (>30s) | Return `503` with "AI service temporarily unavailable" |
| API rate limit (429) | Return `429` with "Too many requests, please try again later" |
| API auth error (401/403) | Log alert, return `502` with "AI service configuration error" |
| Invalid response from GLM | Log raw response, return text-only response without cards |
| Network error | Retry once with backoff, then return `503` |
| Token limit exceeded | Truncate prompt, retry with shorter context |

**Implementation:** Wrap the fetch call in a try/catch. Use a retry wrapper (e.g., 1 retry with 2s delay). Log all errors to console with `console.error()` and optionally to `AIInteraction` table.

---

## 9. Token / Cost Considerations

- **Model choice:** `glm-4-flash` is cheaper than `glm-4`. Use flash for MVP, upgrade if quality is insufficient.
- **System prompt:** Keep concise (~200 tokens). Applicant context (Phase 4) adds ~300-500 tokens.
- **RAG context (Phase 5):** Limit to top 3-5 snippets (~1000 tokens max) to control cost.
- **Max tokens:** Set `max_tokens: 1024` for responses. Mentor responses should be concise.
- **Per-conversation cost:** ~2000 input + ~1000 output = ~3000 tokens per interaction. At GLM-4-flash rates, this is negligible per user.
- **Cost tracking:** Log `usage.total_tokens` to `AIInteraction.metadata` for auditing.
- **Rate limiting:** Consider a per-user rate limit (e.g., 20 messages/hour) to prevent abuse.

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| API key exposure | Key stays server-side only (API route, never sent to client). Never expose in Next.js public env vars. |
| Prompt injection | Sanitize user input. Use system prompt to instruct model to ignore malicious instructions. |
| PII in prompts | Avoid sending sensitive PII (SSN, email) to GLM. Strip or mask before sending. |
| Tenant isolation | `tenantId` is used for DB queries only, never sent to GLM. Each tenant's data is isolated. |
| Response validation | Validate GLM response structure before returning to client. Don't trust external API output. |
| Audit trail | All interactions logged to `AIInteraction` table with `promptHash` (not raw prompt) for privacy. |
| CORS | GLM API is called server-side only. No CORS exposure to browser. |
| SSRF | Use fixed `ZHIPUAI_BASE_URL`, don't allow user-controlled URLs. |

---

## 11. Files That Will Need Changes

| File | Change | Phase |
|------|--------|-------|
| `apps/applicant/lib/ai.ts` | Replace stub `requestAIInteraction()` with real GLM API call | 6 |
| `.env` | Add `ZHIPUAI_API_KEY`, `ZHIPUAI_MODEL`, etc. | 6 |
| `.env.example` | Document new env vars | 6 |
| `apps/applicant/package.json` | Add `zhipuai` SDK dependency (or use `fetch`) | 6 |
| `apps/applicant/lib/ai-context.ts` | **New** — builds applicant context for system prompt | 4 |
| `apps/applicant/lib/ai.ts` | Add RAG retrieval before LLM call | 5 |
| `packages/db/prisma/schema.prisma` | Add `KnowledgeBase` / `KnowledgeChunk` + pgvector models | 5 |
| `packages/db/src/knowledge.ts` | **New** — embedding + retrieval helpers | 5 |
| `apps/applicant/app/dashboard/mentor/page.tsx` | Minor — handle `status: "ok"` vs `"stubbed"` | 6 |
| `docs/plans/v0.15.0_AI_Mentor_Roadmap.md` | Update phase status checkboxes | 4-7 |

---

## 12. Step-by-Step Implementation Plan

### Phase 4: AI Context Integration
1. Create `apps/applicant/lib/ai-context.ts`
2. Query applicant's active applications, tasks, milestones from DB
3. Build a structured context string for the system prompt
4. Pass context to `requestAIInteraction()` as an additional parameter

### Phase 5: Knowledge Base (RAG)
1. Enable `pgvector` extension in PostgreSQL
2. Add `KnowledgeBase`, `KnowledgeChunk` models to Prisma schema
3. Create `packages/db/src/knowledge.ts` — embedding + retrieval helpers
4. Use ZhipuAI embedding API (`embedding-3`) to generate embeddings
5. Store embeddings in `KnowledgeChunk.embedding` (vector type)
6. Before LLM call, retrieve top-K relevant chunks via cosine similarity
7. Prepend retrieved context to the system prompt

### Phase 6: Real LLM Integration (GLM_Z.ai)
1. Add `ZHIPUAI_API_KEY` and related env vars to `.env` / `.env.example`
2. Install ZhipuAI SDK (`npm i zhipuai`) or use native `fetch`
3. Replace stub body of `requestAIInteraction()` in `lib/ai.ts`:
   - Build system prompt (from Phase 4 context + Phase 5 RAG snippets)
   - Call `POST https://open.bigmodel.cn/api/paas/v4/chat/completions`
   - Parse response → `AIInteractionResponse`
   - Log usage to `AIInteraction` table
4. Implement error handling per Section 8
5. Implement graceful fallback to stub if `ZHIPUAI_API_KEY` is not set
6. Update frontend to handle `status: "ok"` (real) vs `"stubbed"` (fallback)

### Phase 7: Smart Mentor (Proactive Recommendations)
1. On applicant login, check for stale tasks, upcoming deadlines, etc.
2. Generate a proactive mentor message using GLM
3. Display as a notification or pre-populated chat suggestion
4. Cache recommendations to avoid repeated LLM calls

---

## 13. Testing Plan

| Test Type | Scope | Tools |
|-----------|-------|-------|
| Unit tests | `requestAIInteraction()` with mocked GLM API response | Vitest + `vi.mock()` |
| Unit tests | Error handling (timeout, 429, 401, network error) | Vitest + mocked `fetch` |
| Unit tests | RAG retrieval (cosine similarity, top-K) | Vitest + test DB with pgvector |
| Integration tests | `POST /api/ai/mentor` end-to-end with real DB | Vitest + test DB |
| E2E tests | Chat UI flow — type, send, receive, render cards | Playwright |
| Manual tests | Real GLM API call with test prompts | Postman / curl |
| Load tests | Concurrent requests to mentor API | k6 or autocannon |

**Test env:** Use `ZHIPUAI_API_KEY=test-key` with mocked fetch in CI. Real API calls only in manual/staging tests.

---

## 14. Open Questions

1. **Which GLM model?** `glm-4-flash` (cheaper, faster) vs `glm-4` (better quality)? Start with flash, evaluate.
2. **SDK vs raw fetch?** ZhipuAI has an official Node SDK. Using it adds a dependency but handles auth/retries. Raw `fetch` is lighter but more manual code.
3. **Streaming responses?** GLM supports SSE streaming. Should the mentor chat stream responses token-by-token for better UX? (Adds complexity to API route + frontend.)
4. **Function calling / JSON mode?** Should we use GLM's function calling to get structured `MentorCard[]` output, or parse JSON from text response?
5. **Embedding model?** ZhipuAI offers `embedding-3`. Alternatively, use a local embedding model to avoid API calls for embeddings. Cost vs latency tradeoff.
6. **Knowledge base content?** What content goes into the KB? Company policies, program guides, technical docs? Who curates it?
7. **Multi-tenant KB?** Is the knowledge base shared across tenants or per-tenant? Affects schema design.
8. **Rate limiting?** Should we implement per-user rate limiting? At what threshold?
9. **Fallback behavior?** When GLM API is down, should we return the stub response or an error message?
10. **Cost monitoring?** How do we monitor and alert on API costs? Dashboard in ops app?

---

## Summary

The integration is straightforward: replace the stub `requestAIInteraction()` in `apps/applicant/lib/ai.ts` with a real call to the ZhipuAI GLM API. The existing API route, persistence layer, and frontend need minimal changes. The main work is in Phases 4-5 (context + RAG) to make the LLM responses genuinely useful. Phase 6 (the actual API connection) is a small change once the context is ready.

**Recommended order:** Phase 4 → Phase 5 → Phase 6 → Phase 7
