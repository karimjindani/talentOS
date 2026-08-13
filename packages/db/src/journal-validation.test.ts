import { describe, expect, it } from "vitest";
import {
  normalizeJournalLanguage,
  parseJournalEvidenceLinks,
  validateConfidenceRating,
  validateTimeSpentHours,
  normalizeJournalEntryDate
} from "./journal";

describe("normalizeJournalLanguage", () => {
  it("returns the language as-is when valid", () => {
    expect(normalizeJournalLanguage("English")).toBe("English");
    expect(normalizeJournalLanguage("Roman Urdu")).toBe("Roman Urdu");
    expect(normalizeJournalLanguage("Roman Hindi")).toBe("Roman Hindi");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeJournalLanguage("  English 7  ")).toBe("English 7");
  });

  it("defaults to English for empty string", () => {
    expect(normalizeJournalLanguage("")).toBe("English");
  });

  it("defaults to English for whitespace-only string", () => {
    expect(normalizeJournalLanguage("   ")).toBe("English");
  });

  it("throws for languages longer than 64 characters", () => {
    const long = "a".repeat(100);
    expect(() => normalizeJournalLanguage(long)).toThrow("64 characters or fewer");
  });

  it("preserves exactly 64-character languages", () => {
    const exact = "a".repeat(64);
    expect(normalizeJournalLanguage(exact)).toBe(exact);
  });
});

describe("parseJournalEvidenceLinks", () => {
  it("parses newline-separated links", () => {
    const result = parseJournalEvidenceLinks("https://a.com\nhttps://b.com");
    expect(result).toEqual(["https://a.com/", "https://b.com/"]);
  });

  it("parses comma-separated links", () => {
    const result = parseJournalEvidenceLinks("https://a.com,https://b.com");
    expect(result).toEqual(["https://a.com/", "https://b.com/"]);
  });

  it("trims whitespace around links", () => {
    const result = parseJournalEvidenceLinks("  https://a.com  ,  https://b.com  ");
    expect(result).toEqual(["https://a.com/", "https://b.com/"]);
  });

  it("filters out empty entries", () => {
    const result = parseJournalEvidenceLinks("https://a.com\n\n,\nhttps://b.com");
    expect(result).toEqual(["https://a.com/", "https://b.com/"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseJournalEvidenceLinks("")).toEqual([]);
    expect(parseJournalEvidenceLinks("   ")).toEqual([]);
  });

  it("rejects more than 10 links", () => {
    const links = Array.from({ length: 11 }, (_, i) => `https://a${i}.com`).join("\n");
    expect(() => parseJournalEvidenceLinks(links)).toThrow();
  });

  it("accepts exactly 10 links", () => {
    const links = Array.from({ length: 10 }, (_, i) => `https://a${i}.com`).join("\n");
    expect(parseJournalEvidenceLinks(links)).toHaveLength(10);
  });

  it("rejects URLs with credentials", () => {
    expect(() => parseJournalEvidenceLinks("https://user:pass@a.com")).toThrow();
  });

  it("rejects non-HTTP schemes", () => {
    expect(() => parseJournalEvidenceLinks("ftp://a.com")).toThrow();
    expect(() => parseJournalEvidenceLinks("javascript:alert(1)")).toThrow();
  });
});

describe("validateConfidenceRating", () => {
  it("accepts integers 1 through 5", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(validateConfidenceRating(rating)).toBe(rating);
    }
  });

  it("rejects 0", () => {
    expect(() => validateConfidenceRating(0)).toThrow();
  });

  it("rejects 6", () => {
    expect(() => validateConfidenceRating(6)).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => validateConfidenceRating(2.5)).toThrow();
    expect(() => validateConfidenceRating(3.1)).toThrow();
  });

  it("rejects NaN", () => {
    expect(() => validateConfidenceRating(NaN)).toThrow();
  });
});

describe("validateTimeSpentHours", () => {
  it("accepts the minimum (0.25 hours)", () => {
    expect(validateTimeSpentHours(0.25)).toBe(0.25);
  });

  it("accepts the maximum (24 hours)", () => {
    expect(validateTimeSpentHours(24)).toBe(24);
  });

  it("accepts typical values", () => {
    expect(validateTimeSpentHours(1)).toBe(1);
    expect(validateTimeSpentHours(8)).toBe(8);
    expect(validateTimeSpentHours(0.5)).toBe(0.5);
  });

  it("rejects 0", () => {
    expect(() => validateTimeSpentHours(0)).toThrow();
  });

  it("rejects values below 0.25", () => {
    expect(() => validateTimeSpentHours(0.1)).toThrow();
    expect(() => validateTimeSpentHours(0.24)).toThrow();
  });

  it("rejects values above 24", () => {
    expect(() => validateTimeSpentHours(24.25)).toThrow();
    expect(() => validateTimeSpentHours(25)).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => validateTimeSpentHours(-1)).toThrow();
  });
});

describe("normalizeJournalEntryDate", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  it("normalizes to UTC midnight", () => {
    const result = normalizeJournalEntryDate(new Date("2026-08-10T15:45:00.000Z"), now);
    expect(result.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("accepts today's date", () => {
    expect(() => normalizeJournalEntryDate(now, now)).not.toThrow();
  });

  it("accepts past dates", () => {
    expect(() => normalizeJournalEntryDate(new Date("2026-01-01T00:00:00.000Z"), now)).not.toThrow();
  });

  it("rejects future dates", () => {
    expect(() => normalizeJournalEntryDate(new Date("2026-12-31T00:00:00.000Z"), now)).toThrow();
  });

  it("respects the applicant's calendar time zone for today boundary", () => {
    // 2026-08-10 18:00 UTC = 2026-08-10 23:00 in Asia/Karachi (UTC+5)
    // Still the same calendar day in Karachi, so should be accepted
    const lateEvening = new Date("2026-08-10T18:00:00.000Z");
    expect(() => normalizeJournalEntryDate(lateEvening, now, "Asia/Karachi")).not.toThrow();
  });

  it("rejects an invalid time zone", () => {
    expect(() =>
      normalizeJournalEntryDate(now, now, "Invalid/Timezone")
    ).toThrow();
  });
});
