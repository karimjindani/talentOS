/**
 * Knowledge Base Retrieval (Phase 5)
 *
 * Simple file-based keyword retrieval from project documentation.
 * No external LLM, no embeddings, no pgvector — just keyword matching
 * against curated doc snippets baked into this module.
 *
 * The knowledge entries are sourced from:
 *   - docs/sdlc.md          (Software Development Lifecycle principles)
 *   - docs/SEM.md           (Spiral Engineering Method)
 *   - docs/Mission_Framework.md (Mission structure & deliverables)
 *   - docs/Product_Vision.md    (Educational philosophy)
 *   - docs/Testing_Strategy.md  (Testing requirements)
 *   - docs/Competency_Framework.md (Competency areas)
 *   - docs/Graduate_Profile.md   (Graduate capabilities)
 *   - docs/AI_Strategy.md       (AI mentor role)
 *
 * Future Phase 5+ will replace this with pgvector + embeddings for
 * semantic retrieval. This module is the MVP stepping stone.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single knowledge entry with keywords for matching. */
type KnowledgeEntry = {
  /** Unique identifier for the entry. */
  id: string;
  /** Human-readable title of the knowledge topic. */
  title: string;
  /** Source document name. */
  source: string;
  /** Keywords that trigger this entry when present in the user's prompt. */
  keywords: string[];
  /** The knowledge content returned to the mentor. */
  content: string;
};

/** A retrieved knowledge snippet with relevance score. */
export type KnowledgeSnippet = {
  id: string;
  title: string;
  source: string;
  content: string;
  /** Number of keyword matches (higher = more relevant). */
  score: number;
};

// ---------------------------------------------------------------------------
// Knowledge Base (curated from project docs)
// ---------------------------------------------------------------------------

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "sdlc-principles",
    title: "Software Development Principles (SDLC)",
    source: "docs/sdlc.md",
    keywords: ["sdlc", "principle", "software development", "development principle", "shift left", "secure design"],
    content: `TalentOS follows these core software development principles:
1. Do what is documented. Always document what you do.
2. Every iteration must ensure previously committed and tested work remains functional.
3. A single product architecture document is updated on each iteration.
4. Testing is done for each new iteration; regression test suite is updated every time.
5. Product runs on Docker containers for easy deployment.
6. Data Model and Data Dictionary are created and updated on each iteration.
7. Product must be secure from the 1st iteration — Shift-left security is fundamental.

Version control: Every plan stored as Markdown in docs/plans/. Every version includes testing details in docs/testing/. Version baselines recorded in docs/Version_Baseline.md.

Source control: Trunk-based branching (main is always releasable). Branch naming: <type>/vX.Y.Z-<slug>. Conventional Commits required. Every change lands via PR with ≥1 approving review and CI green.`,
  },
  {
    id: "sem-lifecycle",
    title: "Spiral Engineering Method (SEM)",
    source: "docs/SEM.md",
    keywords: ["sem", "spiral", "engineering method", "lifecycle", "spiral engineering"],
    content: `TalentOS follows the Spiral Engineering Method (SEM).

Core principle: Do everything every week. Increase complexity every week. Do not separate theory from practice.

The 10-step lifecycle (completed every week):
1. Discover — Understand the problem
2. Analyze — Break down requirements
3. Specify — Write PRD and user stories
4. Design — Architecture and system design
5. Build — Implement the solution
6. Test — Validate correctness
7. Deploy — Ship to production
8. Present — Demo to stakeholders
9. Reflect — Review what went well/poorly
10. Production Readiness Review — Assess deployment readiness

Participants complete the full engineering lifecycle from Day 1. The lifecycle remains constant while complexity increases.`,
  },
  {
    id: "mission-structure",
    title: "Mission Structure & Deliverables",
    source: "docs/Mission_Framework.md",
    keywords: ["mission", "assignment", "deliverable", "prd", "user stori", "architecture", "loom", "journal"],
    content: `Assignments are called Missions. Every mission simulates a real software engineering engagement.

Mission workflow:
Mission Brief → Clarification Questions → Research → PRD → Design → Build → Test → Deploy → Demo → Reflection

Required deliverables for each mission:
- PRD (Product Requirements Document)
- User Stories
- Architecture document
- GitHub Repository
- Deployment URL
- Documentation
- Loom Video (demo)
- Engineering Journal

Difficulty levels: Beginner → Intermediate → Advanced → Expert
Completion levels: Bronze → Silver → Gold → Platinum

Every mission requires: Analysis, Design, Implementation, Testing, Deployment, Presentation, and Reflection.`,
  },
  {
    id: "prd-guidance",
    title: "How to Write a PRD",
    source: "docs/Mission_Framework.md + docs/Graduate_Profile.md",
    keywords: ["prd", "product requirement", "requirements document", "write a prd", "specify"],
    content: `A PRD (Product Requirements Document) is a required deliverable for every mission.

To write a good PRD:
1. Start with the problem statement — What business problem are you solving?
2. Define the target users and their needs
3. List functional requirements as user stories ("As a <user>, I want <action> so that <benefit>")
4. Define acceptance criteria for each user story
5. Specify non-functional requirements (performance, security, scalability)
6. Include constraints and assumptions
7. Define the scope — what is in and out of bounds

The PRD is created during the "Specify" phase of the SEM lifecycle, after Discover and Analyze.

A graduate of TalentOS should be capable of independently: Understanding business problems, Asking clarification questions, Writing a PRD, Defining user stories, and Defining acceptance criteria.`,
  },
  {
    id: "testing-strategy",
    title: "Testing Your Work",
    source: "docs/Testing_Strategy.md",
    keywords: ["test", "testing", "regression", "vitest", "unit test", "tdd", "quality"],
    content: `Testing is mandatory for every iteration. Previously committed and tested work must remain functional.

Two regression layers:
1. Unit regression — Fast Vitest coverage for utilities, server actions, guards, and DB helpers.
2. Scenario regression — End-to-end journeys through OIDC login flows, portal routes, and database state transitions.

Test levels include:
- Unit Tests: Tenant resolution, role authorization, capability matrix, password hashing, TOTP, application status transitions
- Auth/RBAC Tests: Keycloak OIDC, unauthenticated redirects, role-based access
- Application Lifecycle Tests: Status transitions, duplicate prevention, audit logging
- Programs Management Tests: State machine (DRAFT → PUBLISHED → ARCHIVED), tenant scoping

Best practices:
- Write tests before refactoring — they catch regressions early
- Keep functions small and focused on a single responsibility
- The regression suite is updated every time new updates are done
- The Ops Console can run the full scenario suite and shows pass/fail/skip counts`,
  },
  {
    id: "competency-framework",
    title: "Competency Framework",
    source: "docs/Competency_Framework.md",
    keywords: ["competency", "skill", "capability", "what should i learn", "learning area"],
    content: `TalentOS develops 12 core competencies:

1. Problem Discovery — Understand business objectives
2. Requirements Engineering — Convert ideas into requirements
3. Solution Design — Design maintainable systems
4. AI Collaboration — Work effectively with AI
5. Software Construction — Build production-grade software
6. Quality Engineering — Validate and test solutions
7. Deployment & Operations — Deploy and troubleshoot
8. Documentation — Create maintainable documentation
9. Communication — Present and defend solutions
10. Professionalism — Work independently
11. Engineering Leadership — Plan and organize work
12. Production Readiness — Evaluate deployment readiness

Each mission tags competencies it develops. Track your growth across all 12 areas.`,
  },
  {
    id: "product-vision",
    title: "Product Vision & Educational Philosophy",
    source: "docs/Product_Vision.md",
    keywords: ["vision", "philosophy", "talentos", "why", "purpose", "goal", "objective"],
    content: `TalentOS exists to bridge the gap between AI-assisted coding and production-grade software engineering.

Modern AI tools enable rapid software creation but do not automatically create engineers capable of delivering software that is secure, maintainable, scalable, and deployable.

TalentOS develops AI-native software engineers who can:
- Understand business problems
- Gather requirements
- Design solutions
- Build, test, and deploy software
- Present solutions
- Evaluate production readiness

Educational philosophy: Learning occurs by building. There are no theory-only weeks. Every mission requires analysis, design, implementation, testing, deployment, presentation, and reflection. Participants deploy software from Week 1.`,
  },
  {
    id: "graduate-profile",
    title: "Graduate Profile — What You'll Be Able to Do",
    source: "docs/Graduate_Profile.md",
    keywords: ["graduate", "career", "outcome", "after", "capable", "independent"],
    content: `A graduate of TalentOS should be capable of independently:

- Understanding business problems
- Asking clarification questions
- Writing a PRD
- Defining user stories and acceptance criteria
- Designing solutions
- Using AI effectively
- Building, testing, and deploying software
- Creating documentation
- Presenting solutions
- Assessing production readiness

Graduates are not expected to review other engineers' code. The objective is to create independent engineers, not senior engineers.`,
  },
  {
    id: "ai-strategy",
    title: "AI Strategy — How AI Helps You",
    source: "docs/AI_Strategy.md",
    keywords: ["ai strategy", "ai mentor", "ai help", "knowledge assistant", "ai role"],
    content: `TalentOS AI Strategy:

The AI Mentor is your primary source of guidance throughout the program.

The AI Knowledge Assistant answers questions using program knowledge (SDLC, SEM, missions, testing, etc.).

Future AI components (V2): AI Assignment Reviewer, AI Interviewer
Future AI personas (V3): AI Customer, AI CTO, AI Product Manager, AI QA Lead, AI Security Officer — these simulate real stakeholders.

The AI Mentor helps you with: understanding missions, planning your work, tracking progress, engineering tips, and answering knowledge questions about the program.`,
  },
  {
    id: "deployment-practices",
    title: "Deployment & CI/CD Practices",
    source: "docs/sdlc.md",
    keywords: ["deploy", "deployment", "ci", "cd", "cicd", "pipeline", "docker", "container", "rollback"],
    content: `Deployment and CI/CD practices at TalentOS:

CI gate: db:generate → typecheck → lint → test → build — all must pass to merge.
Images build from a single root Dockerfile, tagged with both the version (vX.Y.Z) and git SHA.
Environment promotion: dev (local Compose) → staging (auto-deploy on main) → prod (manual approval).
Per-environment secrets are never committed to version control.
Rollback: redeploy the previous known-good image tag. Never hand-reverse a live schema change — use a new forward migration.

The product runs on Docker containers so deployment is easy. Deployment steps are documented in markdown.`,
  },
];

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieve relevant knowledge snippets for a given prompt.
 *
 * Uses simple keyword matching: for each knowledge entry, count how many
 * of its keywords appear in the prompt. Return entries with ≥1 match,
 * sorted by score (descending). Max 3 results.
 *
 * This is a placeholder for future semantic retrieval (pgvector + embeddings).
 */
export function retrieveKnowledge(prompt: string, maxResults = 3): KnowledgeSnippet[] {
  const lower = prompt.toLowerCase();

  const scored: KnowledgeSnippet[] = [];

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        score += 1;
      }
    }

    if (score > 0) {
      scored.push({
        id: entry.id,
        title: entry.title,
        source: entry.source,
        content: entry.content,
        score,
      });
    }
  }

  // Sort by score descending, then alphabetically by title for stability
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  return scored.slice(0, maxResults);
}

/**
 * Format retrieved knowledge snippets as a context string for the AI prompt.
 *
 * Returns empty string if no snippets were found.
 */
export function knowledgeToPromptSection(snippets: KnowledgeSnippet[]): string {
  if (snippets.length === 0) return "";

  const sections = snippets.map((s, i) =>
    `[${i + 1}] ${s.title} (source: ${s.source})\n${s.content}`
  );

  return `Relevant Knowledge:\n\n${sections.join("\n\n")}`;
}

/**
 * Check if a prompt is a knowledge-type question (vs. a task/progress query).
 *
 * Knowledge questions ask about concepts, frameworks, how-tos, or definitions.
 * Task/progress questions ask about the user's specific tasks or status.
 */
export function isKnowledgeQuestion(prompt: string): boolean {
  const lower = prompt.toLowerCase();

  // Question indicators
  const questionWords = ["what is", "what are", "how do", "how should", "how to", "why", "explain", "tell me about", "what does"];
  const isQuestion = questionWords.some((w) => lower.includes(w));

  // Not a task/progress query
  const isTaskQuery = lower.includes("my task") || lower.includes("my progress") || lower.includes("my status") || lower.includes("my timeline") || lower.includes("my schedule");

  return isQuestion && !isTaskQuery;
}
