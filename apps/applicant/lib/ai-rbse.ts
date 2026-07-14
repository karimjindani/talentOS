/**
 * Rule-Based System Engine (RBSE) for AI Mentor
 * 
 * This module classifies user questions and provides direct answers for
 * internship-related queries without calling the LLM.
 */

import type { ApplicantContext } from "./ai-context";
import type { AIInteractionResponse } from "./ai";

export type RBSEAction = 
  | { type: "blocked"; response: AIInteractionResponse }
  | { type: "direct_answer"; response: AIInteractionResponse }
  | { type: "allow_llm" };

/**
 * Allowed topics for internship-related questions
 */
const ALLOWED_TOPICS = [
  // Core internship concepts
  "internship",
  "intern",
  "program",
  "talentos",
  "talent os",
  
  // Tasks and assignments
  "task",
  "assignment",
  "mission",
  "project",
  "deliverable",
  "prd",
  "user story",
  "user stories",
  "requirement",
  
  // Progress tracking
  "progress",
  "status",
  "completion",
  "complete",
  "done",
  "finished",
  
  // Timeline and schedule
  "timeline",
  "schedule",
  "week",
  "deadline",
  "due",
  "calendar",
  
  // Submissions
  "submission",
  "submit",
  "submitted",
  "review",
  "feedback",
  
  // SDLC and SEM
  "sdlc",
  "software development lifecycle",
  "sem",
  "spiral engineering method",
  "engineering method",
  
  // Testing
  "test",
  "testing",
  "unit test",
  "integration test",
  "regression",
  "vitest",
  "tdd",
  "quality",
  
  // Deployment
  "deploy",
  "deployment",
  "ci",
  "cd",
  "cicd",
  "pipeline",
  "docker",
  "container",
  "rollback",
  
  // Engineering practices
  "engineering",
  "practice",
  "best practice",
  "code",
  "coding",
  "programming",
  "development",
  "software",
  
  // Knowledge base
  "knowledge",
  "documentation",
  "doc",
  "guide",
  "tutorial",
  "how to",
  "what is",
  "explain",
  
  // Career guidance (internship-related only)
  "career",
  "guidance",
  "advice",
  "mentor",
  "mentorship",
  "professional",
  "skill",
  "competency",
  "learning",
];

/**
 * Blocked topics - questions that should be refused
 */
const BLOCKED_TOPICS = [
  // Math and calculations
  "calculate",
  "math",
  "equation",
  "solve",
  "formula",
  "number",
  "plus",
  "minus",
  "multiply",
  "divide",
  "=",
  "+",
  "-",
  "*",
  "/",
  
  // Politics
  "politics",
  "political",
  "government",
  "election",
  "vote",
  "president",
  "prime minister",
  "minister",
  "party",
  
  // Sports
  "sports",
  "sport",
  "football",
  "soccer",
  "basketball",
  "cricket",
  "tennis",
  "game",
  "player",
  "team",
  "score",
  "win",
  "lose",
  
  // Movies and entertainment
  "movie",
  "film",
  "tv",
  "television",
  "series",
  "actor",
  "actress",
  "director",
  "story",
  "plot",
  "entertainment",
  
  // General knowledge (unrelated)
  "general knowledge",
  "trivia",
  "fact",
  "history",
  "science",
  "physics",
  "chemistry",
  "biology",
  "quantum",
  "space",
  "universe",
  
  // Unrelated coding questions
  "game code",
  "snake game",
  "tic tac toe",
  "calculator app",
  "weather app",
  "todo app",
  "chat app",
  "portfolio website",
  
  // Personal advice (outside internship)
  "personal",
  "relationship",
  "family",
  "friend",
  "health",
  "medical",
  "financial",
  "money",
  "investment",
  "stock",
  "crypto",
  
  // Other unrelated topics
  "weather",
  "news",
  "current events",
  "celebrity",
  "gossip",
  "joke",
  "funny",
  "riddle",
  "puzzle",
];

/**
 * Direct answer patterns - questions that can be answered directly from context
 */
const DIRECT_ANSWER_PATTERNS = [
  // Progress queries
  { pattern: /what('s| is) my progress/i, type: "progress" as const },
  { pattern: /show my progress/i, type: "progress" as const },
  { pattern: /how am i doing/i, type: "progress" as const },
  { pattern: /my completion status/i, type: "progress" as const },
  { pattern: /how much have i completed/i, type: "progress" as const },
  
  // Task queries
  { pattern: /what('s| is) my task (today|now|currently)/i, type: "task" as const },
  { pattern: /what should i work on/i, type: "task" as const },
  { pattern: /next task/i, type: "task" as const },
  { pattern: /current task/i, type: "task" as const },
  { pattern: /what to do (today|now)/i, type: "task" as const },
  
  // Timeline queries
  { pattern: /show my timeline/i, type: "timeline" as const },
  { pattern: /what('s| is) my schedule/i, type: "timeline" as const },
  { pattern: /upcoming weeks/i, type: "timeline" as const },
  { pattern: /what('s| is) next week/i, type: "timeline" as const },
  
  // Submission queries
  { pattern: /submission status/i, type: "submission" as const },
  { pattern: /what have i submitted/i, type: "submission" as const },
  { pattern: /my submissions/i, type: "submission" as const },
  { pattern: /submission history/i, type: "submission" as const },
];

/**
 * Check if a question is allowed (internship-related)
 */
function isQuestionAllowed(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check if prompt contains any allowed topics
  const hasAllowedTopic = ALLOWED_TOPICS.some(topic => 
    lowerPrompt.includes(topic.toLowerCase())
  );
  
  // Check if prompt contains any blocked topics
  const hasBlockedTopic = BLOCKED_TOPICS.some(topic => 
    lowerPrompt.includes(topic.toLowerCase())
  );
  
  // Special case: if prompt is very short and doesn't contain allowed topics, block it
  if (prompt.trim().split(/\s+/).length < 3 && !hasAllowedTopic) {
    return false;
  }
  
  // Allow if it has allowed topics AND doesn't have blocked topics
  // OR if it's a general question about the internship/program
  return (hasAllowedTopic && !hasBlockedTopic) || 
         lowerPrompt.includes("internship") ||
         lowerPrompt.includes("talentos") ||
         lowerPrompt.includes("program");
}

/**
 * Check if a question matches direct answer patterns
 */
function getDirectAnswerType(prompt: string): "progress" | "task" | "timeline" | "submission" | null {
  for (const { pattern, type } of DIRECT_ANSWER_PATTERNS) {
    if (pattern.test(prompt)) {
      return type;
    }
  }
  return null;
}

/**
 * Generate a direct answer from applicant context
 */
function generateDirectAnswer(
  type: "progress" | "task" | "timeline" | "submission",
  context?: ApplicantContext
): AIInteractionResponse {
  const programName = context?.program?.name ?? "your program";
  const overallPct = context?.progress?.overallPercentage ?? 0;
  const completedTasks = context?.progress?.completedTasks ?? 0;
  const totalTasks = context?.progress?.totalTasks ?? 0;
  const daysRemaining = context?.daysRemaining;
  const nextTask = context?.upcomingTasks?.[0];
  const missions = context?.missions ?? [];
  const submissions = context?.submissions ?? [];

  switch (type) {
    case "progress":
      return {
        status: "stubbed",
        message: context?.program
          ? `You're ${overallPct}% through ${programName}. ${completedTasks} of ${totalTasks} tasks completed${daysRemaining != null ? `, ${daysRemaining} days remaining` : ""}.`
          : "I don't have your progress information yet. Please check your dashboard for the latest updates.",
        cards: context?.program
          ? [
              { kind: "progress" as const, title: "Overall Progress", percentage: overallPct },
              {
                kind: "badge" as const,
                label: "Submission Status",
                value: `${completedTasks} of ${totalTasks} tasks completed`,
              },
            ]
          : undefined,
      };

    case "task":
      return {
        status: "stubbed",
        message: nextTask
          ? `Your next task in ${programName} is: "${nextTask.title}" (Week ${nextTask.weekNumber}). ${nextTask.overdue ? "This task is overdue — prioritize it now." : "Focus on completing it before the deadline."}`
          : `I don't see any upcoming tasks. Please check your dashboard or contact your program coordinator.`,
        cards: nextTask
          ? [
              {
                kind: "task" as const,
                title: `Week ${nextTask.weekNumber} — ${nextTask.title}`,
                description: nextTask.overdue
                  ? "This task is overdue. Please complete and submit as soon as possible."
                  : "Continue working on this task and mark it complete when done.",
                dueDate: nextTask.dueAt
                  ? new Date(nextTask.dueAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : undefined,
                estimatedTime: "~4 hours",
              },
            ]
          : undefined,
      };

    case "timeline":
      const missionItems = missions.length
        ? missions
            .sort((a, b) => a.weekNumber - b.weekNumber)
            .map((m) => `Week ${m.weekNumber}: ${m.title} (${m.difficulty})`)
        : [
            "Week 1–2: Onboarding & setup",
            "Week 3–4: Mission 1 — Frontend fundamentals",
            "Week 5–6: Mission 2 — Database design",
            "Week 7–8: Mission 3 — API development",
            "Week 9–10: Mission 4 — Deployment & CI/CD",
          ];

      return {
        status: "stubbed",
        message: context?.program
          ? `Here's the timeline for ${programName}.`
          : "Here's the standard internship timeline at a glance.",
        cards: [
          {
            kind: "timeline" as const,
            title: context?.program ? `${programName} Timeline` : "Internship Timeline",
            items: missionItems,
          },
        ],
      };

    case "submission":
      const submissionCount = submissions.length;
      const latestSubmission = submissions[0];
      
      return {
        status: "stubbed",
        message: submissionCount > 0
          ? `You have ${submissionCount} submission${submissionCount === 1 ? '' : 's'}. ${latestSubmission ? `Your latest submission is for "${latestSubmission.missionTitle}" (Week ${latestSubmission.weekNumber}) with status: ${latestSubmission.status}.` : ''}`
          : "You haven't submitted any missions yet. Complete your tasks and submit them through the dashboard.",
        cards: submissionCount > 0
          ? [
              {
                kind: "badge" as const,
                label: "Total Submissions",
                value: `${submissionCount}`,
              },
              ...(latestSubmission
                ? [
                    {
                      kind: "badge" as const,
                      label: "Latest Submission",
                      value: `${latestSubmission.missionTitle} (${latestSubmission.status})`,
                    },
                  ]
                : []),
            ]
          : undefined,
      };
  }
}

/**
 * Generate blocked response for non-internship questions
 */
function generateBlockedResponse(): AIInteractionResponse {
  return {
    status: "stubbed",
    message: "I'm your AI Mentor for the TalentOS Internship Program. I can help you with your internship tasks, missions, progress, submissions, project documentation, SDLC, SEM, PRD, testing, deployment, and engineering guidance. I can't answer unrelated general questions.",
    cards: [
      {
        kind: "tips" as const,
        title: "What I can help with",
        items: [
          "Internship tasks and missions",
          "Progress tracking and timelines",
          "Submission status and feedback",
          "SDLC and SEM methodology",
          "PRD writing and requirements",
          "Testing strategies and best practices",
          "Deployment and CI/CD guidance",
          "Engineering career advice",
        ],
      },
    ],
  };
}

/**
 * Main RBSE classifier function
 * 
 * Analyzes the user prompt and determines the appropriate action:
 * 1. Block non-internship related questions
 * 2. Provide direct answers for specific context-based queries
 * 3. Allow LLM processing for other internship-related questions
 */
export function classifyQuestion(
  prompt: string,
  context?: ApplicantContext
): RBSEAction {
  // Step 1: Check if question is allowed (internship-related)
  if (!isQuestionAllowed(prompt)) {
    console.log(`[ai-rbse] Question blocked: "${prompt.substring(0, 100)}..."`);
    return {
      type: "blocked",
      response: generateBlockedResponse(),
    };
  }

  // Step 2: Check for direct answer patterns
  const directAnswerType = getDirectAnswerType(prompt);
  if (directAnswerType) {
    console.log(`[ai-rbse] Direct answer for type "${directAnswerType}": "${prompt.substring(0, 100)}..."`);
    return {
      type: "direct_answer",
      response: generateDirectAnswer(directAnswerType, context),
    };
  }

  // Step 3: Allow LLM processing
  console.log(`[ai-rbse] Allowing LLM for: "${prompt.substring(0, 100)}..."`);
  return { type: "allow_llm" };
}

/**
 * Test helper for manual verification
 */
export function testRBSE(prompt: string, context?: ApplicantContext): RBSEAction {
  return classifyQuestion(prompt, context);
}