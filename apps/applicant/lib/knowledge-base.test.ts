import { describe, expect, it } from "vitest";
import {
  retrieveKnowledge,
  knowledgeToPromptSection,
  isKnowledgeQuestion,
} from "./knowledge-base";

describe("Knowledge Base — retrieveKnowledge", () => {
  // UT-KB-01: Keyword retrieval
  it("returns knowledge snippets matching prompt keywords", () => {
    const results = retrieveKnowledge("What is SDLC?");
    expect(results.length).toBeGreaterThan(0);
    const sdlcSnippet = results.find((r) => r.id === "sdlc-principles");
    expect(sdlcSnippet).toBeDefined();
    expect(sdlcSnippet!.title).toBe("Software Development Principles (SDLC)");
    expect(sdlcSnippet!.source).toBe("docs/sdlc.md");
    expect(sdlcSnippet!.content).toContain("TalentOS");
    expect(sdlcSnippet!.score).toBeGreaterThan(0);
  });

  it("returns SEM snippet for 'spiral engineering method'", () => {
    const results = retrieveKnowledge("Explain the Spiral Engineering Method");
    const semSnippet = results.find((r) => r.id === "sem-lifecycle");
    expect(semSnippet).toBeDefined();
    expect(semSnippet!.source).toBe("docs/SEM.md");
  });

  it("returns testing snippet for 'how to write unit tests'", () => {
    const results = retrieveKnowledge("How do I write unit tests?");
    const testingSnippet = results.find((r) => r.id === "testing-strategy");
    expect(testingSnippet).toBeDefined();
  });

  it("returns deployment snippet for 'how to deploy with Docker'", () => {
    const results = retrieveKnowledge("How do I deploy with Docker and CI/CD?");
    const deploySnippet = results.find((r) => r.id === "deployment-practices");
    expect(deploySnippet).toBeDefined();
  });

  it("returns PRD snippet for 'how to write a PRD'", () => {
    const results = retrieveKnowledge("How do I write a PRD?");
    const prdSnippet = results.find((r) => r.id === "prd-guidance");
    expect(prdSnippet).toBeDefined();
  });

  // UT-KB-02: No match returns empty array
  it("returns empty array when no keywords match", () => {
    const results = retrieveKnowledge("xyz random unrelated query zzz");
    expect(results).toEqual([]);
  });

  // UT-KB-03: Limit parameter
  it("respects the limit parameter of 1", () => {
    const results = retrieveKnowledge("SDLC testing deployment mission", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("respects the limit parameter of 2", () => {
    const results = retrieveKnowledge("SDLC testing deployment mission", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("respects the default limit of 3", () => {
    const results = retrieveKnowledge("SDLC SEM testing deployment mission PRD");
    expect(results.length).toBeLessThanOrEqual(3);
  });

  // UT-KB-04: Score ranking
  it("sorts results by score descending", () => {
    const results = retrieveKnowledge("SDLC testing deployment mission PRD", 5);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("higher keyword match gets higher score", () => {
    const results = retrieveKnowledge("sdlc principle software development", 5);
    const sdlcSnippet = results.find((r) => r.id === "sdlc-principles");
    expect(sdlcSnippet).toBeDefined();
    // "sdlc", "principle", "software development" = 3 keyword matches
    expect(sdlcSnippet!.score).toBeGreaterThanOrEqual(3);
  });

  // UT-KB-05: All snippets have required fields
  it("all returned snippets have id, title, source, content, and score", () => {
    const results = retrieveKnowledge("SDLC");
    for (const r of results) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.title).toBe("string");
      expect(typeof r.source).toBe("string");
      expect(typeof r.content).toBe("string");
      expect(typeof r.score).toBe("number");
    }
  });
});

describe("Knowledge Base — knowledgeToPromptSection", () => {
  // UT-KB-05: Formats snippets as prompt section
  it("formats knowledge snippets as prompt section", () => {
    const snippets = retrieveKnowledge("SDLC");
    const section = knowledgeToPromptSection(snippets);
    expect(typeof section).toBe("string");
    expect(section).toContain("Relevant Knowledge");
    expect(section).toContain("Software Development Principles (SDLC)");
    expect(section).toContain("docs/sdlc.md");
  });

  it("returns empty string for empty snippets array", () => {
    const section = knowledgeToPromptSection([]);
    expect(section).toBe("");
  });

  it("includes numbered indices", () => {
    const snippets = retrieveKnowledge("SDLC SEM", 2);
    const section = knowledgeToPromptSection(snippets);
    expect(section).toContain("[1]");
    if (snippets.length > 1) {
      expect(section).toContain("[2]");
    }
  });

  it("includes source annotation", () => {
    const snippets = retrieveKnowledge("SDLC");
    const section = knowledgeToPromptSection(snippets);
    expect(section).toContain("source:");
  });
});

describe("Knowledge Base — isKnowledgeQuestion", () => {
  it("identifies 'what is' questions as knowledge questions", () => {
    expect(isKnowledgeQuestion("What is SDLC?")).toBe(true);
  });

  it("identifies 'how to' questions as knowledge questions", () => {
    expect(isKnowledgeQuestion("How to deploy with Docker?")).toBe(true);
  });

  it("identifies 'explain' questions as knowledge questions", () => {
    expect(isKnowledgeQuestion("Explain the SEM lifecycle")).toBe(true);
  });

  it("does not identify task queries as knowledge questions", () => {
    expect(isKnowledgeQuestion("What is my task today?")).toBe(false);
  });

  it("does not identify progress queries as knowledge questions", () => {
    expect(isKnowledgeQuestion("What is my progress?")).toBe(false);
  });

  it("does not identify non-questions as knowledge questions", () => {
    expect(isKnowledgeQuestion("SDLC is important")).toBe(false);
  });
});
