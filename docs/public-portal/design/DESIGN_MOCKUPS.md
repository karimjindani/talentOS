# PUBLIC PORTAL DESIGN SPECIFICATION

## Overview
TalentOS Public Graduate Portal is a verifiable talent marketplace where:
- Graduates publish their completed work
- Recruiters discover talent
- Email verification protects data
- All views are audited

---

# DESIGN MOCKUPS

## Mockup 1: Graduate Consent Screen

```
╔════════════════════════════════════════════════════════════════════╗
║                    TalentOS Academy Dashboard                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  🎉 Congratulations!                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                    ║
║  You've successfully completed all 4 missions!                     ║
║                                                                    ║
║  📊 Your Results:                                                  ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ Mission 1: REST API Design           ⭐⭐⭐⭐⭐ 4.5/5       │ ║
║  │ Mission 2: Database Optimization     ⭐⭐⭐⭐⭐ 4.8/5       │ ║
║  │ Mission 3: Deployment Pipeline       ⭐⭐⭐⭐⭐ 5.0/5       │ ║
║  │ Mission 4: Production Monitoring     ⭐⭐⭐⭐⭐ 4.7/5       │ ║
║  │                                                              │ ║
║  │ Overall Rating: 4.75/5 ⭐⭐⭐⭐⭐                           │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║  🌍 Publish Your Profile?                                         ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ Would you like employers to discover your work?              │ ║
║  │ Your profile will appear on the TalentOS Graduate Directory. │ ║
║  │                                                              │ ║
║  │ Your public profile will show:                              │ ║
║  │ ✓ Name, Photo, Rating                                       │ ║
║  │ ✓ Bio, Completion Date                                      │ ║
║  │ ✓ LinkedIn & GitHub Links                                  │ ║
║  │                                                              │ ║
║  │ Recruiters must verify their email to see your full        │ ║
║  │ portfolio with all assignments and journal entries.         │ ║
║  │                                                              │ ║
║  │ [✓ Publish My Profile]  [× Not Now]                         │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Mockup 2: Public Graduate Directory

```
╔════════════════════════════════════════════════════════════════════╗
║              TalentOS Graduate Directory (Public)                   ║
║                   graduates.talentos.io                             ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  🔍 Search & Filter                                               ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ 🔎 Search by name or skills...       [Search]             │  ║
║  │ Filter: [All Programs ▼] [All Countries ▼] [July ▼]       │  ║
║  │ Sort: [Highest Rating ▼]     Results: 127 graduates        │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ╔════════════════════╗  ╔════════════════════╗  ╔═══════════════╗║
║  ║ 📷 John Smith      ║  ║ 📷 Jane Doe        ║  ║ 📷 Bob Tech    ║║
║  ║ ⭐⭐⭐⭐⭐ 4.8     ║  ║ ⭐⭐⭐⭐⭐ 4.9     ║  ║ ⭐⭐⭐⭐ 4.5  ║║
║  ║ Backend engineer   ║  ║ Full-stack dev     ║  ║ DevOps eng     ║║
║  ║ passionate about   ║  ║ love building web  ║  ║ Kubernetes     ║║
║  ║ distributed sys.   ║  ║ apps with React    ║  ║ enthusiast     ║║
║  ║ Completed:         ║  ║ Completed:         ║  ║ Completed:     ║║
║  ║ 15 July 2026       ║  ║ 10 July 2026       ║  ║ 8 July 2026    ║║
║  ║ [LinkedIn] [GitHub]║  ║ [LinkedIn] [GitHub]║  ║ [LinkedIn] [G] ║║
║  ║ [View Profile]     ║  ║ [View Profile]     ║  ║ [View Profile] ║║
║  ╚════════════════════╝  ╚════════════════════╝  ╚═══════════════╝║
║                                                                    ║
║  [← Previous] Page 1 of 5 [Next →]                               ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Mockup 3: Public Profile (Basic Info)

```
╔════════════════════════════════════════════════════════════════════╗
║          John Smith - Graduate Profile (Public)                    ║
║              graduates.talentos.io/john-smith                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │                                                             │  ║
║  │         📷                                                  │  ║
║  │       [Photo]                                               │  ║
║  │                                                             │  ║
║  │  John Smith                                                 │  ║
║  │  ⭐⭐⭐⭐⭐ 4.8/5.0                                           │  ║
║  │  "Backend engineer passionate about distributed systems"   │  ║
║  │  📅 Completed: 15 July 2026                                │  ║
║  │  🌍 San Francisco, USA                                     │  ║
║  │  [LinkedIn]  [GitHub]                                      │  ║
║  │  [🔗 Share Profile]                                        │  ║
║  │                                                             │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  To view John's full portfolio with all assignments,              ║
║  engineering journal, and evaluation, please fill the form below. ║
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ 📋 Request Full Portfolio Access                           │  ║
║  │                                                             │  ║
║  │ Full Name:          [John Recruiter                    ]    │  ║
║  │ Organization:       [Google                            ]    │  ║
║  │ Designation:        [Senior Recruiter                  ]    │  ║
║  │ Email: *            [john@google.com                   ]    │  ║
║  │ Phone (Optional):   [+1-650-253-0000                   ]    │  ║
║  │ What are you...?    [Looking for backend engineers...  ]    │  ║
║  │                                                             │  ║
║  │ [Cancel]  [Request Access]                                │  ║
║  │                                                             │  ║
║  │ Your information will be verified via email.               │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Mockup 4: Full Profile (After Email Verification)

```
╔════════════════════════════════════════════════════════════════════╗
║        John Smith - Full Portfolio [VERIFIED]                      ║
║         graduates.talentos.io/john-smith?token=...                ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ━━━━━ SECTION 1: PROFILE OVERVIEW ━━━━━                          ║
║  📷 John Smith | ⭐⭐⭐⭐⭐ 4.8/5 | "Backend engineer..."        ║
║  Email: john.smith@email.com                                       ║
║  Location: San Francisco, USA                                      ║
║  LinkedIn: linkedin.com/in/john-smith | GitHub: github.com/...    ║
║                                                                    ║
║  ━━━━━ SECTION 2: PROGRAM RESULTS ━━━━━                           ║
║  Mission 1: REST API Design              ⭐⭐⭐⭐ 4.5/5          ║
║  Mission 2: Database Optimization        ⭐⭐⭐⭐⭐ 4.8/5        ║
║  Mission 3: Deployment Pipeline          ⭐⭐⭐⭐⭐ 5.0/5        ║
║  Mission 4: Production Monitoring        ⭐⭐⭐⭐ 4.7/5          ║
║  Overall Rating: 4.75/5                                            ║
║                                                                    ║
║  ━━━━━ SECTION 3: ASSIGNMENT PORTFOLIO ━━━━━                      ║
║  📌 Mission 1: REST API Design (4.5/5)                            ║
║     Completed: 2 July 2026                                         ║
║     Evidence: [Journal] [GitHub] [Loom Video] [Deployment]        ║
║     Details: Designed scalable REST API...                         ║
║                                                                    ║
║  📌 Mission 2: Database Optimization (4.8/5)                      ║
║     [Similar structure...]                                         ║
║                                                                    ║
║  ━━━━━ SECTION 4: ENGINEERING JOURNAL ━━━━━                       ║
║  📓 Daily Reflection & Learning Notes (Read-only)                 ║
║  2 July 2026: Started working on REST API...                      ║
║  3 July 2026: Implemented pagination...                           ║
║  4 July 2026: Refactored all endpoints...                         ║
║  [View All 127 Entries]                                            ║
║                                                                    ║
║  ━━━━━ SECTION 5: AI EVALUATION ━━━━━                             ║
║  Technical Skills: ⭐⭐⭐⭐⭐ 4.8/5                                 ║
║  Problem Solving: ⭐⭐⭐⭐ 4.6/5                                   ║
║  Communication: ⭐⭐⭐⭐⭐ 4.7/5                                    ║
║  Ownership: ⭐⭐⭐⭐⭐ 4.9/5                                        ║
║                                                                    ║
║  ━━━━━ SECTION 6: RECRUITER ACTIONS ━━━━━                         ║
║  [📥 Download Report] [✉️ Contact] [💾 Save] [📤 Share]          ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Mockup 5: Verification Email

```
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║  From: noreply@talentos.io                                        ║
║  To: jane@google.com                                              ║
║  Subject: Access to TalentOS Graduate Profile                     ║
║                                                                    ║
║  ────────────────────────────────────────────────────────────────  ║
║                                                                    ║
║  Hi Jane,                                                          ║
║                                                                    ║
║  You've requested access to view John Smith's full portfolio on   ║
║  TalentOS Graduate Directory.                                     ║
║                                                                    ║
║  🔗 Verify Your Access                                            ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ [Click here to verify and view the full portfolio]        │  ║
║  │ https://graduates.talentos.io/verify?token=abc123xyz...   │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  This link will expire on July 22, 2026                           ║
║                                                                    ║
║  If you didn't request this, you can safely ignore this email.    ║
║                                                                    ║
║  © 2026 TalentOS. All rights reserved.                            ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## User Journeys

### Journey 1: Graduate Publishing
```
Graduate completes Mission 4 → Dashboard shows congratulations 
→ Sees "Publish Profile?" option → Fills profile form (bio, links) 
→ System generates slug (john-smith) → Profile published 
→ Profile now visible on /graduates
```

### Journey 2: Recruiter Discovery
```
Recruiter visits /graduates → Sees list of profiles → Searches for skills 
→ Finds "john-smith" → Clicks to view → Sees public profile 
→ Fills recruiter form (name, email, org)
```

### Journey 3: Email Verification
```
Recruiter submits form → System generates secure token 
→ Sends verification email → Recruiter clicks link in email 
→ Token verified → Redirected to full portfolio
```

### Journey 4: Full Portfolio Access
```
Recruiter views full profile → Sees all 4 missions + ratings 
→ Reads engineering journal → Views AI evaluation → Downloads report 
→ System logs view in audit table
```

---

**Next: Frontend components implementing these designs**
