import { describe, expect, it } from "vitest";
import { classifyQuestion } from "./ai-rbse";
import type { ApplicantContext } from "./ai-context";

const emptyContext: ApplicantContext = {
  tenantId: "t1",
  userId: "u1",
  program: null,
  applicationStatus: null,
  progress: null,
  upcomingTasks: [],
  missions: [],
  submissions: [],
  daysRemaining: null,
};

const fullContext: ApplicantContext = {
  tenantId: "t1",
  userId: "u1",
  program: { id: "p1", name: "Full-Stack Engineering", slug: "fse", startsAt: null, endsAt: null },
  applicationStatus: "ACCEPTED",
  progress: {
    totalTasks: 10,
    completedTasks: 4,
    pendingTasks: 6,
    overallPercentage: 40,
    weeks: [{ weekNumber: 1, totalTasks: 5, completedTasks: 3, percentage: 60 }],
  },
  upcomingTasks: [
    { id: "task-1", title: "Build REST API", weekNumber: 3, dueAt: "2026-07-15T00:00:00Z", completed: false, overdue: false },
  ],
  missions: [{ id: "m1", title: "API Development", weekNumber: 3, difficulty: "Intermediate" }],
  submissions: [],
  daysRemaining: 30,
};

describe("RBSE classifyQuestion", () => {
  // UT-RBSE-01: Block inappropriate questions
  describe("blocking off-topic questions", () => {
    it("blocks questions about sports", () => {
      const result = classifyQuestion("Who won the football match yesterday?");
      expect(result.type).toBe("blocked");
      if (result.type === "blocked") {
        expect(result.response.status).toBe("stubbed");
        expect(result.response.message).toContain("AI Mentor");
      }
    });

    it("blocks questions about politics", () => {
      const result = classifyQuestion("Who should I vote for in the election?");
      expect(result.type).toBe("blocked");
    });

    it("blocks questions about movies", () => {
      const result = classifyQuestion("What's the plot of the latest movie?");
      expect(result.type).toBe("blocked");
    });

    it("blocks questions about personal relationships", () => {
      const result = classifyQuestion("How do I fix my relationship problems?");
      expect(result.type).toBe("blocked");
    });

    it("blocks questions about financial advice", () => {
      const result = classifyQuestion("Should I invest in crypto?");
      expect(result.type).toBe("blocked");
    });

    it("blocks very short prompts with no allowed topics", () => {
      const result = classifyQuestion("hi there");
      expect(result.type).toBe("blocked");
    });

    it("blocked response includes tips card with allowed topics", () => {
      const result = classifyQuestion("Tell me a funny joke");
      expect(result.type).toBe("blocked");
      if (result.type === "blocked") {
        expect(result.response.cards).toBeDefined();
        expect(result.response.cards!.some((c) => c.kind === "tips")).toBe(true);
      }
    });
  });

  // UT-RBSE-02: Direct answer for known patterns
  describe("direct answers for known patterns", () => {
    it("returns direct answer for 'what is my progress'", () => {
      const result = classifyQuestion("What is my progress?", fullContext);
      expect(result.type).toBe("direct_answer");
      if (result.type === "direct_answer") {
        expect(result.response.message).toContain("40%");
      }
    });

    it("returns direct answer for 'show my progress'", () => {
      const result = classifyQuestion("Show my progress", fullContext);
      expect(result.type).toBe("direct_answer");
    });

    it("returns direct answer for 'what is my task today'", () => {
      const result = classifyQuestion("What is my task today?", fullContext);
      expect(result.type).toBe("direct_answer");
      if (result.type === "direct_answer") {
        expect(result.response.message).toContain("Build REST API");
      }
    });

    it("returns direct answer for 'show my timeline'", () => {
      const result = classifyQuestion("Show my timeline", fullContext);
      expect(result.type).toBe("direct_answer");
      if (result.type === "direct_answer") {
        expect(result.response.cards).toBeDefined();
        expect(result.response.cards!.some((c) => c.kind === "timeline")).toBe(true);
      }
    });

    it("returns direct answer for 'my submissions'", () => {
      const result = classifyQuestion("What is my submission status?", fullContext);
      expect(result.type).toBe("direct_answer");
    });

    it("direct answer for progress without context returns fallback message", () => {
      const result = classifyQuestion("What is my progress?", emptyContext);
      expect(result.type).toBe("direct_answer");
      if (result.type === "direct_answer") {
        expect(result.response.message).toContain("progress");
      }
    });
  });

  // UT-RBSE-03: Allow LLM for complex questions
  describe("allowing LLM for complex internship questions", () => {
    it("allows LLM for 'explain SDLC phases in detail'", () => {
      const result = classifyQuestion("Explain SDLC phases in detail");
      expect(result.type).toBe("allow_llm");
    });

    it("allows LLM for 'how do I write unit tests for my API'", () => {
      const result = classifyQuestion("How do I write unit tests for my API?");
      expect(result.type).toBe("allow_llm");
    });

    it("allows LLM for 'what is the Spiral Engineering Method'", () => {
      const result = classifyQuestion("What is the Spiral Engineering Method?");
      expect(result.type).toBe("allow_llm");
    });

    it("allows LLM for 'how should I deploy my Docker container'", () => {
      const result = classifyQuestion("How should I deploy my Docker container?");
      expect(result.type).toBe("allow_llm");
    });

    it("allows LLM for 'how to write a good PRD for my mission'", () => {
      const result = classifyQuestion("How to write a good PRD for my mission?");
      expect(result.type).toBe("allow_llm");
    });
  });

  // UT-RBSE-04: Allowed topics list
  describe("allowed topic recognition", () => {
    const allowedTopicQueries = [
      "Tell me about my internship program",
      "What is my task for this week?",
      "How do I complete my mission?",
      "Explain the SDLC process",
      "What is SEM in engineering?",
      "How do I test my code?",
      "How do I deploy my application?",
      "What is the CICD pipeline?",
      "How do I use Docker for deployment?",
      "Give me engineering best practices",
      "How do I write a PRD?",
      "What are user stories?",
      "How is my progress in the program?",
      "What is my submission status?",
      "Show me my timeline for the program",
    ];

    for (const query of allowedTopicQueries) {
      it(`does not block: "${query}"`, () => {
        const result = classifyQuestion(query);
        expect(result.type).not.toBe("blocked");
      });
    }
  });

  // UT-RBSE-05: Blocked topics are exhaustive
  describe("blocked topic recognition", () => {
    const blockedQueries = [
      "Tell me about the history of France?",
      "Who won the basketball game?",
      "Tell me about quantum physics",
      "What's the weather today?",
      "Tell me a riddle",
      "How do I solve this math equation?",
      "Who is the president?",
      "Recommend me a movie to watch",
    ];

    for (const query of blockedQueries) {
      it(`blocks: "${query}"`, () => {
        const result = classifyQuestion(query);
        expect(result.type).toBe("blocked");
      });
    }
  });
});
