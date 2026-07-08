# Mission Framework

Assignments are called Missions.

Every mission simulates a real software engineering engagement.

## Mission Structure

Mission Brief

↓

Clarification Questions

↓

Research

↓

PRD

↓

Design

↓

Build

↓

Test

↓

Deploy

↓

Demo

↓

Reflection

## Deliverables

- PRD
- User Stories
- Architecture
- GitHub Repository
- Deployment URL
- Documentation
- Loom Video
- Engineering Journal

## Difficulty Levels

- Beginner
- Intermediate
- Advanced
- Expert

## Completion Levels

- Bronze
- Silver
- Gold
- Platinum

## Current Mission Fields

The implemented Mission Engine stores one mission per tenant program. Mission authoring currently uses
these fields:

- Program: the program that owns the mission. Applicants only see published missions for their accepted
  program.
- Difficulty: expected complexity (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`). Difficulty does
  not change access, grading or workflow behavior.
- Title: a short mission name that appears in admin and applicant mission lists.
- Week number: the program sequence bucket for the mission.
- Display order: ordering within the same week.
- Objective: the learning outcome the applicant should reach.
- Mission brief: the real-world customer/problem context, constraints, expected outcome and resources.
- Deliverables: the evidence applicants must submit or maintain, such as repository, deployment,
  walkthrough and Engineering Journal.
- Acceptance criteria: the minimum bar for a submission to be accepted.
- Evaluation criteria: guidance for staff review quality judgments.
- Competency tags: comma-separated tags attached to the mission.

## Mission Lifecycle

Missions currently support three statuses:

- Draft: staff-only; hidden from applicant mission lists.
- Published: visible to accepted applicants in the mission's program.
- Archived: hidden from applicant mission lists.

Status transitions are controlled by the Mission Engine workflow. Archiving a mission hides it from
applicant mission lists; it does not delete submissions or change the submission review workflow.

## Submissions Dependency

The Mission Submission Workflow depends on published missions. Applicants can create or revise
submissions only for published missions that belong to their accepted program and tenant. The mission
title is used in review context and notifications.

When staff accept a mission submission, that accepted submission becomes evidence for the mission's
competency tags. Keep competency tag names consistent because they become evidence metadata for later
portfolio, graduation and competency reporting work.

## SEM Authoring Guidance

Mission authors should use each mission to guide applicants through the Spiral Engineering Method:

1. Discover
2. Analyze
3. Specify
4. Design
5. Build
6. Test
7. Deploy
8. Present
9. Reflect
10. Production Readiness Review

The form fields are intentionally freeform today, so the author is responsible for making the SEM loop
clear in the objective, brief, deliverables, acceptance criteria and evaluation criteria.

## Future Work

The current Mission Engine does not yet include:

- Mission templates or a reusable template catalog.
- Structured SEM lifecycle fields.
- A controlled competency catalog.
- Structured rubrics.
- Scoring or completion-level calculations.
