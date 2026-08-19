# TalentOS Public Graduate Portal
## Complete Documentation & Implementation Guide

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [User Journeys](#user-journeys)
3. [Design Mockups & Wireframes](#design-mockups--wireframes)
4. [How It Works - Step by Step](#how-it-works---step-by-step)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Technical Architecture](#technical-architecture)
8. [Security & Privacy](#security--privacy)
9. [Implementation Phases](#implementation-phases)

---

## 📚 Overview

### What is the Public Graduate Portal?

A public-facing talent marketplace where:
- **Graduates** who complete all 4 missions can choose to publish their profile
- **Anyone** can browse published profiles and see basic information
- **Recruiters** can request access to view full portfolios
- **Recruiters** are verified via email before accessing sensitive data
- **System** maintains audit logs for analytics and privacy compliance

### Why It's Valuable

| Stakeholder | Value |
|-------------|-------|
| **Graduates** | Showcase their work, get discovered by employers, incentive to perform well |
| **Recruiters** | Find verified talent with proven work samples, not just resumes |
| **TalentOS** | Verifiable talent marketplace, builds credibility, network effect |

### Key Features

✅ Graduate consent-based publishing  
✅ Public search & filtering by skills, ratings, completion date  
✅ Recruiter verification via email  
✅ Secure token-based access to full portfolios  
✅ Audit logging of all profile views  
✅ Analytics dashboard for admins  

---

## 🎭 User Journeys

### Journey 1: Graduate Publishing Profile

```
Graduate completes Mission 4
        ↓
Dashboard shows: "Congratulations! Want to publish?"
        ↓
Graduate clicks: "Publish My Profile"
        ↓
System stores consent & creates profile
        ↓
Graduate sees: "✓ Your profile is now public!"
        ↓
Profile appears on /graduates page
```

### Journey 2: Recruiter Discovering Graduate

```
Recruiter visits: graduates.talentos.io
        ↓
Sees: List of profiles (sorted by rating)
        ↓
Filters: Search "React" → 12 results
        ↓
Clicks: John Smith (4.8⭐) → Public profile
        ↓
Sees: Name, Bio, Rating, LinkedIn, GitHub
        ↓
Clicks: "View Full Portfolio"
```

### Journey 3: Recruiter Requesting Access

```
Recruiter fills form:
  - Name: John Recruiter
  - Organization: Google
  - Email: john@google.com
  - Designation: Senior Recruiter
        ↓
Clicks: "Request Access"
        ↓
System sends email: "Verify your access to profile"
        ↓
Recruiter clicks: Email verification link
        ↓
Redirected to: Full portfolio (with secure token)
```

### Journey 4: Recruiter Viewing Full Portfolio

```
Full portfolio displays:
  ✓ Graduate overview
  ✓ All 4 mission ratings
  ✓ Each assignment with links & evidence
  ✓ Engineering journal entries
  ✓ AI evaluation scores
  ✓ Contact options
        ↓
System logs: Who viewed, when, from where
        ↓
Graduate can see: Profile was viewed by Google recruiter
```

---

## 🎨 Design Mockups & Wireframes

### MOCKUP 1: Graduate Dashboard - Consent Screen

```
╔════════════════════════════════════════════════════════════════════╗
║                    TalentOS Academy Dashboard                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  🎉 Congratulations!                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                    ║
║  You've successfully completed all 4 missions in the               ║
║  TalentOS Engineering Program!                                     ║
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ 📊 Your Results:                                             │ ║
║  │                                                              │ ║
║  │ Mission 1 (REST API Design)           ⭐⭐⭐⭐⭐ 4.5/5     │ ║
║  │ Mission 2 (Database Optimization)     ⭐⭐⭐⭐⭐ 4.8/5     │ ║
║  │ Mission 3 (Deployment Pipeline)       ⭐⭐⭐⭐⭐ 5.0/5     │ ║
║  │ Mission 4 (Production Monitoring)     ⭐⭐⭐⭐⭐ 4.7/5     │ ║
║  │                                                              │ ║
║  │ Overall Rating: 4.75/5 ⭐⭐⭐⭐⭐                          │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ 🌍 Publish Your Profile                                      │ ║
║  │                                                              │ ║
║  │ Would you like employers to discover your work? Your         │ ║
║  │ profile will appear on the TalentOS Graduate Directory,      │ ║
║  │ where recruiters from top companies look for talent.         │ ║
║  │                                                              │ ║
║  │ Your public profile will show:                              │ ║
║  │ ✓ Name & Photo                                              │ ║
║  │ ✓ Overall Rating                                            │ ║
║  │ ✓ Bio / One-liner                                           │ ║
║  │ ✓ Completion Date                                           │ ║
║  │ ✓ LinkedIn & GitHub Links                                  │ ║
║  │                                                              │ ║
║  │ Recruiters must fill a form & verify their email to         │ ║
║  │ see your full portfolio with all assignments & journal.     │ ║
║  │                                                              │ ║
║  │ [✓ Publish My Profile]  [× Not Now]                         │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### MOCKUP 2: Graduate Profile Setup (If Needed)

```
╔════════════════════════════════════════════════════════════════════╗
║                    Complete Your Profile                           ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Before publishing, please add these details:                      ║
║                                                                    ║
║  📝 Bio (One-liner)                                               ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ Backend engineer passionate about distributed systems     │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  🔗 LinkedIn Profile (Optional)                                   ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ https://linkedin.com/in/john-smith                        │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  🐙 GitHub Profile (Optional)                                     ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ https://github.com/johnsmith                              │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  🌍 Country (Optional)                                            ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ United States                                   [Dropdown] │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  👤 Profile Photo (Optional)                                      ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ [Upload Photo]                                             │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║                                [Cancel]  [Publish Profile]        ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### MOCKUP 3: Public Graduate Directory

```
╔════════════════════════════════════════════════════════════════════╗
║                  TalentOS Graduate Directory                        ║
║                    graduates.talentos.io                            ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  🔍 Search & Filter                                              ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ 🔎 Search by name or skills...           [Search]         │  ║
║  │                                                            │  ║
║  │ Filter by:                                               │  ║
║  │  Program: [All v] | Month: [All v] | Country: [All v]   │  ║
║  │  Sort: [Highest Rating v]                               │  ║
║  │                                    Results: 127 graduates │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ╔════════════════════╗  ╔════════════════════╗  ╔══════════════╗ ║
║  ║ 📷 John Smith      ║  ║ 📷 Jane Doe        ║  ║ 📷 Bob Tech   ║ ║
║  ║                    ║  ║                    ║  ║               ║ ║
║  ║ ⭐⭐⭐⭐⭐ 4.8     ║  ║ ⭐⭐⭐⭐⭐ 4.9     ║  ║ ⭐⭐⭐⭐ 4.5 ║ ║
║  ║                    ║  ║                    ║  ║               ║ ║
║  ║ Backend engineer   ║  ║ Full-stack dev     ║  ║ DevOps eng    ║ ║
║  ║ passionate about   ║  ║ love building web  ║  ║ Kubernetes    ║ ║
║  ║ distributed sys.   ║  ║ apps with React    ║  ║ enthusiast    ║ ║
║  ║                    ║  ║                    ║  ║               ║ ║
║  ║ Completed:         ║  ║ Completed:         ║  ║ Completed:    ║ ║
║  ║ 15 July 2026       ║  ║ 10 July 2026       ║  ║ 8 July 2026   ║ ║
║  ║                    ║  ║                    ║  ║               ║ ║
║  ║ [LinkedIn] [GitHub]║  ║ [LinkedIn] [GitHub]║  ║ [LinkedIn] [G]║ ║
║  ║                    ║  ║                    ║  ║               ║ ║
║  ║ [View Profile]     ║  ║ [View Profile]     ║  ║ [View Profile]║ ║
║  ╚════════════════════╝  ╚════════════════════╝  ╚══════════════╝ ║
║                                                                    ║
║  ╔════════════════════╗  ╔════════════════════╗  ╔══════════════╗ ║
║  ║ ... (more cards)   ║  ║ ... (more cards)   ║  ║ ... (more)    ║ ║
║  ╚════════════════════╝  ╚════════════════════╝  ╚══════════════╝ ║
║                                                                    ║
║  [← Previous] Page 1 of 5 [Next →]                               ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### MOCKUP 4: Public Profile Page (Basic Info)

```
╔════════════════════════════════════════════════════════════════════╗
║                  John Smith - Graduate Profile                     ║
║                graduates.talentos.io/john-smith                    ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │                                                             │  ║
║  │         📷                                                  │  ║
║  │       [Photo]                                               │  ║
║  │                                                             │  ║
║  │  John Smith                                                 │  ║
║  │  ⭐⭐⭐⭐⭐ 4.8/5.0                                           │  ║
║  │                                                             │  ║
║  │  "Backend engineer passionate about distributed systems"   │  ║
║  │                                                             │  ║
║  │  📅 Completed: 15 July 2026                                │  ║
║  │  🌍 San Francisco, USA                                     │  ║
║  │                                                             │  ║
║  │  [LinkedIn]  [GitHub]                                      │  ║
║  │                                                             │  ║
║  │  [🔗 Share Profile]                                        │  ║
║  │                                                             │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  This is a public profile. To view John's full portfolio with    ║
║  all assignments, engineering journal, and detailed evaluation,  ║
║  please fill the form below.                                     ║
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ 📋 Request Access to Full Portfolio                        │  ║
║  │                                                             │  ║
║  │ Full Name:                                                  │  ║
║  │ ┌─────────────────────────────────────────────────────────┐ │  ║
║  │ │ John Recruiter                                          │ │  ║
║  │ └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                             │  ║
║  │ Organization:                                               │  ║
║  │ ┌─────────────────────────────────────────────────────────┐ │  ║
║  │ │ Google                                                  │ │  ║
║  │ └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                             │  ║
║  │ Designation:                                                │  ║
║  │ ┌─────────────────────────────────────────────────────────┐ │  ║
║  │ │ Senior Recruiter                                        │ │  ║
║  │ └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                             │  ║
║  │ Email: *                                                    │  ║
║  │ ┌─────────────────────────────────────────────────────────┐ │  ║
║  │ │ john@google.com                                         │ │  ║
║  │ └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                             │  ║
║  │ Phone (Optional):                                           │  ║
║  │ ┌─────────────────────────────────────────────────────────┐ │  ║
║  │ │ +1-650-253-0000                                         │ │  ║
║  │ └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                             │  ║
║  │ What are you looking for?                                   │  ║
║  │ ┌─────────────────────────────────────────────────────────┐ │  ║
║  │ │ Backend engineers for our platform team                │ │  ║
║  │ └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                             │  ║
║  │ [Cancel]  [Request Access]                                │  ║
║  │                                                             │  ║
║  │ Your information will be used to verify your identity.     │  ║
║  │ A verification link will be sent to your email.            │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### MOCKUP 5: Verification Email

```
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║  From: noreply@talentos.io                                        ║
║  To: john@google.com                                              ║
║  Subject: Access to TalentOS Graduate Profile                     ║
║                                                                    ║
║  ────────────────────────────────────────────────────────────────  ║
║                                                                    ║
║  Hi John,                                                          ║
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
║  This link will expire in 7 days.                                 ║
║                                                                    ║
║  If you didn't request this, you can safely ignore this email.    ║
║                                                                    ║
║  —                                                                 ║
║  TalentOS Team                                                     ║
║  www.talentos.io                                                   ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### MOCKUP 6: Full Profile Page (After Verification)

```
╔════════════════════════════════════════════════════════════════════╗
║              John Smith - Full Portfolio [VERIFIED]                ║
║           graduates.talentos.io/john-smith?token=...              ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ━━━━━ SECTION 1: PROFILE OVERVIEW ━━━━━                          ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ 📷 John Smith                                              │  ║
║  │ ⭐⭐⭐⭐⭐ 4.8/5.0                                           │  ║
║  │ "Backend engineer passionate about distributed systems"   │  ║
║  │                                                            │  ║
║  │ Email: john.smith@email.com                               │  ║
║  │ Location: San Francisco, USA                              │  ║
║  │ LinkedIn: linkedin.com/in/john-smith                      │  ║
║  │ GitHub: github.com/johnsmith                              │  ║
║  │                                                            │  ║
║  │ Program Badge: TalentOS Graduate - Class of 2026          │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ━━━━━ SECTION 2: PROGRAM RESULTS ━━━━━                           ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │                                                            │  ║
║  │  Mission                          Rating                  │  ║
║  │  ─────────────────────────────────────────────────────     │  ║
║  │  Mission 1: REST API Design       ⭐⭐⭐⭐ 4.5/5           │  ║
║  │  Mission 2: DB Optimization       ⭐⭐⭐⭐⭐ 4.8/5         │  ║
║  │  Mission 3: Deploy Pipeline       ⭐⭐⭐⭐⭐ 5.0/5         │  ║
║  │  Mission 4: Prod Monitoring       ⭐⭐⭐⭐ 4.7/5           │  ║
║  │                                                            │  ║
║  │  ═════════════════════════════════════════════════        │  ║
║  │  Overall Rating:                  ⭐⭐⭐⭐⭐ 4.75/5        │  ║
║  │                                                            │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ━━━━━ SECTION 3: ASSIGNMENT PORTFOLIO ━━━━━                      ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │                                                            │  ║
║  │ 📌 Mission 1: REST API Design                 (4.5/5)     │  ║
║  │ ─────────────────────────────────────────────────────────  │  ║
║  │                                                            │  ║
║  │ Completed: 2 July 2026                                     │  ║
║  │                                                            │  ║
║  │ Summary:                                                   │  ║
║  │ Designed and implemented a scalable REST API for a        │  ║
║  │ user management system. Implemented pagination, proper    │  ║
║  │ error handling, and comprehensive API documentation.      │  ║
║  │                                                            │  ║
║  │ Evidence & Links:                                         │  ║
║  │  📔 Engineering Journal: [View Journal Entries]            │  ║
║  │  🐙 GitHub Repository: github.com/johnsmith/api-mission   │  ║
║  │  🎥 Loom Video Demo: loom.com/share/abc123xyz             │  ║
║  │  🌐 Deployed URL: api-mission.example.com                 │  ║
║  │                                                            │  ║
║  │ Rating Breakdown:                                         │  ║
║  │  Code Quality: 4.5/5    Documentation: 4.4/5              │  ║
║  │  Testing: 4.6/5         Performance: 4.5/5                │  ║
║  │                                                            │  ║
║  │ ─────────────────────────────────────────────────────────  │  ║
║  │                                                            │  ║
║  │ 📌 Mission 2: Database Optimization            (4.8/5)    │  ║
║  │ [Similar structure...]                                     │  ║
║  │                                                            │  ║
║  │ 📌 Mission 3: Deployment Pipeline              (5.0/5)    │  ║
║  │ [Similar structure...]                                     │  ║
║  │                                                            │  ║
║  │ 📌 Mission 4: Production Monitoring            (4.7/5)    │  ║
║  │ [Similar structure...]                                     │  ║
║  │                                                            │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ━━━━━ SECTION 4: ENGINEERING JOURNAL ━━━━━                       ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │ 📓 Daily Reflection & Learning Notes (Read-only)          │  ║
║  │                                                            │  ║
║  │ 📅 2 July 2026                                             │  ║
║  │ Started working on REST API design. Researched best       │  ║
║  │ practices for API versioning and discovered several       │  ║
║  │ approaches. Leaning towards URL-based versioning.         │  ║
║  │                                                            │  ║
║  │ 📅 3 July 2026                                             │  ║
║  │ Implemented pagination. Got valuable feedback from        │  ║
║  │ mentor about offset vs cursor-based pagination. Cursor    │  ║
║  │ is better for large datasets. Need to refactor.           │  ║
║  │                                                            │  ║
║  │ 📅 4 July 2026                                             │  ║
║  │ Refactored all endpoints to use cursor-based pagination.  │  ║
║  │ All tests passing. Ready for review.                      │  ║
║  │                                                            │  ║
║  │ [View All Journal Entries (127 total)]                    │  ║
║  │                                                            │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ━━━━━ SECTION 5: AI EVALUATION SUMMARY ━━━━━                     ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │                                                            │  ║
║  │  Generated by TalentOS AI Analysis                         │  ║
║  │                                                            │  ║
║  │  Technical Skills           ⭐⭐⭐⭐⭐ 4.8/5                │  ║
║  │  Problem Solving            ⭐⭐⭐⭐ 4.6/5                  │  ║
║  │  Communication              ⭐⭐⭐⭐⭐ 4.7/5                │  ║
║  │  Ownership & Initiative     ⭐⭐⭐⭐⭐ 4.9/5                │  ║
║  │  Team Collaboration         ⭐⭐⭐⭐ 4.5/5                  │  ║
║  │                                                            │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║  ━━━━━ SECTION 6: RECRUITER ACTIONS ━━━━━                         ║
║  ┌────────────────────────────────────────────────────────────┐  ║
║  │                                                            │  ║
║  │  [📥 Download Candidate Report (PDF)]                     │  ║
║  │  [✉️  Contact Candidate]                                  │  ║
║  │  [💾 Save Candidate]                                      │  ║
║  │  [📤 Share with Team]                                     │  ║
║  │                                                            │  ║
║  └────────────────────────────────────────────────────────────┘  ║
║                                                                    ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 📖 How It Works - Step by Step

### STEP 1: Graduate Completes Mission 4

**What happens:**
- Graduate submits final evidence for Mission 4
- System validates all 4 missions are complete
- Database: `applications.status = "COMPLETED"`

**System checks:**
```
✓ Mission 1: Completed
✓ Mission 2: Completed
✓ Mission 3: Completed
✓ Mission 4: Completed
✓ All ratings available
✓ Status = COMPLETED
```

---

### STEP 2: Dashboard Shows Consent Modal

**When:**
- Next time graduate logs in to dashboard
- System checks: `public_profile_enabled = NULL` (not yet decided)

**What they see:**
- Congratulations message
- Summary of all 4 mission ratings
- Overall rating (average of all 4)
- Explanation: What will be public vs what requires verification
- Two buttons: "Publish My Profile" or "Not Now"

**If "Not Now":**
- Dismisses modal
- Can revisit later from settings

**If "Publish My Profile":**
- Goes to STEP 3

---

### STEP 3: Graduate Completes Profile (Optional)

**If fields are empty, show form:**
- Bio (required): "What's your one-liner?"
- LinkedIn URL (optional)
- GitHub URL (optional)
- Country (optional)
- Profile Photo (optional)

**After submission:**
- System creates `GraduateProfile` record:
  ```
  {
    user_id: john-123,
    public_profile_enabled: true,
    bio: "Backend engineer passionate about distributed systems",
    linkedin_url: "https://linkedin.com/in/john-smith",
    github_url: "https://github.com/johnsmith",
    graduation_date: "2026-07-15",
    overall_rating: 4.75,
    slug: "john-smith",
    consent_date: "2026-07-15T10:30:00Z",
    created_at: now,
    updated_at: now
  }
  ```

**System generates slug:**
- From: `FirstName LastName` → `"john-smith"`
- If exists, append number: `"john-smith-2"`

---

### STEP 4: Profile Published - Visible on Directory

**Now public at:**
- `graduates.talentos.io` or `/graduates`
- Shows in search results
- Can be filtered & sorted

**What's visible (public):**
- Name
- Photo
- Overall rating
- Bio
- Completion date
- LinkedIn link
- GitHub link

**What's hidden (public):**
- Email
- Full assignments
- Journal entries
- Private info

---

### STEP 5: Recruiter Discovers Profile

**Recruiter journey:**
1. Visits: `graduates.talentos.io`
2. Sees list of graduates (sorted by rating by default)
3. Can search: "React", "Backend", "Python"
4. Can filter: Month, Program, Country
5. Can sort: Rating, Date, Alphabetical
6. Clicks: "View Profile" on a graduate card

---

### STEP 6: Recruiter Sees Public Profile

**What recruiter sees:**
- Basic info only (Name, Rating, Bio, Links)
- No email
- No assignments
- No journal
- Button: "View Full Portfolio"

**Clicking button:**
- Modal opens with recruiter interest form
- 5 required fields + 2 optional

---

### STEP 7: Recruiter Fills Access Request Form

**Form fields:**
```
Full Name:           (Required)  John Recruiter
Organization:        (Required)  Google
Designation:         (Required)  Senior Recruiter
Email:               (Required)  john@google.com
Phone:               (Optional)  +1-650-253-0000
Hiring Requirement:  (Optional)  Looking for backend engineers...
```

**Recruiter clicks:**
- Button: "Request Access"

**System does:**
1. Validates all required fields
2. Creates `RecruiterAccessRequest`:
   ```
   {
     id: uuid-123,
     graduate_id: john-smith-123,
     recruiter_name: "John Recruiter",
     recruiter_organization: "Google",
     recruiter_designation: "Senior Recruiter",
     recruiter_email: "john@google.com",
     recruiter_phone: "+1-650-253-0000",
     hiring_requirement: "Backend engineers...",
     token: "secure_random_token_xyz",
     expires_at: now + 7 days,
     approved_at: null,
     created_at: now
   }
   ```
3. Sends verification email
4. Shows message: "Check your email to verify access"

---

### STEP 8: Verification Email Sent

**Email contains:**
- Subject: "Access to TalentOS Graduate Profile"
- Body: Personalized greeting
- Verification link: `graduates.talentos.io/verify?token=xyz`
- Expiry: 7 days
- Unsubscribe option

**When recruiter clicks link:**
- System verifies token is valid
- Token hasn't expired
- Sets: `approved_at = now()`
- Redirects to full portfolio URL with token

---

### STEP 9: Full Portfolio Page Loads (After Verification)

**URL format:**
```
/graduates/[slug]?token=[secure-token]
```

**System verifies:**
- Token is valid
- Token matches graduate
- Token hasn't expired
- NOT single-use (can view multiple times while valid)

**If invalid token:**
- Redirect to public profile
- Show message: "Link expired, submit form again"

**If valid token:**
- Display full portfolio with 6 sections:
  1. Overview
  2. Program Results
  3. Assignment Portfolio
  4. Engineering Journal
  5. AI Evaluation
  6. Recruiter Actions

---

### STEP 10: System Logs View

**Audit log entry created:**
```
{
  id: uuid-456,
  graduate_id: john-smith-123,
  recruiter_email: "john@google.com",
  recruiter_name: "John Recruiter",
  recruiter_organization: "Google",
  viewed_at: now,
  ip_address: "203.0.113.45",
  user_agent: "Mozilla/5.0..."
}
```

**Graduate can see:**
- "Your profile was viewed by John Recruiter (Google) on July 15, 2026"

**Admin can see:**
- Analytics dashboard with view statistics

---

## 🗄️ Database Schema

### Table 1: GraduateProfile

```sql
CREATE TABLE graduate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to user
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Publication status
  public_profile_enabled BOOLEAN DEFAULT false,
  consent_date TIMESTAMP,
  consent_version INT DEFAULT 1,
  
  -- Profile info
  bio VARCHAR(500),
  linkedin_url VARCHAR(500),
  github_url VARCHAR(500),
  profile_photo_url VARCHAR(500),
  country VARCHAR(100),
  
  -- Computed fields
  graduation_date TIMESTAMP NOT NULL,
  overall_rating FLOAT NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX idx_graduate_profiles_slug ON graduate_profiles(slug);
CREATE INDEX idx_graduate_profiles_enabled ON graduate_profiles(public_profile_enabled);
CREATE INDEX idx_graduate_profiles_rating ON graduate_profiles(overall_rating DESC);
```

---

### Table 2: RecruiterAccessRequest

```sql
CREATE TABLE recruiter_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to graduate
  graduate_id UUID NOT NULL REFERENCES graduate_profiles(id) ON DELETE CASCADE,
  
  -- Recruiter info
  recruiter_name VARCHAR(200) NOT NULL,
  recruiter_organization VARCHAR(200),
  recruiter_designation VARCHAR(200),
  recruiter_email VARCHAR(200) NOT NULL,
  recruiter_phone VARCHAR(20),
  hiring_requirement TEXT,
  
  -- Verification token
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  approved_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(token)
);

-- Indexes
CREATE INDEX idx_recruiter_requests_graduate ON recruiter_access_requests(graduate_id);
CREATE INDEX idx_recruiter_requests_token ON recruiter_access_requests(token);
CREATE INDEX idx_recruiter_requests_email ON recruiter_access_requests(recruiter_email);
```

---

### Table 3: ProfileViewAudit

```sql
CREATE TABLE profile_view_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to graduate
  graduate_id UUID NOT NULL REFERENCES graduate_profiles(id) ON DELETE CASCADE,
  
  -- Recruiter info
  recruiter_email VARCHAR(200),
  recruiter_name VARCHAR(200),
  recruiter_organization VARCHAR(200),
  
  -- View info
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(100),
  user_agent TEXT,
  
  -- Metadata
  access_request_id UUID REFERENCES recruiter_access_requests(id)
);

-- Indexes for analytics
CREATE INDEX idx_profile_audits_graduate ON profile_view_audits(graduate_id);
CREATE INDEX idx_profile_audits_viewed_at ON profile_view_audits(viewed_at DESC);
CREATE INDEX idx_profile_audits_org ON profile_view_audits(recruiter_organization);
```

---

### Updates to Existing Tables

**Applications table:**
```sql
-- Add columns if not exists
ALTER TABLE applications ADD COLUMN IF NOT EXISTS
  program_completed_at TIMESTAMP;

-- Mark as completed when all 4 missions submitted
UPDATE applications 
SET program_completed_at = NOW()
WHERE status = 'ACCEPTED' AND (
  SELECT COUNT(*) FROM submissions 
  WHERE submissions.application_id = applications.id
) >= 4;
```

---

## 🔌 API Endpoints

### 1. Create/Update Graduate Profile

```
POST /api/graduates/profile
Content-Type: application/json
Authorization: Bearer {user-token}

Request:
{
  "bio": "Backend engineer passionate about distributed systems",
  "linkedin_url": "https://linkedin.com/in/john-smith",
  "github_url": "https://github.com/johnsmith",
  "country": "United States",
  "profile_photo": "base64-encoded-image or url"
}

Response:
{
  "success": true,
  "profile": {
    "id": "uuid-123",
    "user_id": "user-123",
    "public_profile_enabled": true,
    "slug": "john-smith",
    "overall_rating": 4.75,
    "...": "..."
  }
}
```

---

### 2. Get Public Graduate List

```
GET /api/graduates?page=1&limit=20&sort=rating&search=react&country=US

Response:
{
  "success": true,
  "total": 127,
  "page": 1,
  "limit": 20,
  "graduates": [
    {
      "id": "uuid-123",
      "name": "John Smith",
      "slug": "john-smith",
      "photo": "url",
      "rating": 4.8,
      "bio": "Backend engineer...",
      "completion_date": "2026-07-15",
      "linkedin_url": "...",
      "github_url": "..."
    },
    "..."
  ]
}
```

---

### 3. Get Public Profile

```
GET /api/graduates/{slug}

Response:
{
  "success": true,
  "profile": {
    "name": "John Smith",
    "photo": "url",
    "rating": 4.8,
    "bio": "Backend engineer...",
    "completion_date": "2026-07-15",
    "country": "United States",
    "linkedin_url": "...",
    "github_url": "...",
    // NO EMAIL, NO ASSIGNMENTS, NO JOURNAL
  }
}
```

---

### 4. Request Access to Full Portfolio

```
POST /api/graduates/{slug}/request-access
Content-Type: application/json

Request:
{
  "recruiter_name": "John Recruiter",
  "recruiter_organization": "Google",
  "recruiter_designation": "Senior Recruiter",
  "recruiter_email": "john@google.com",
  "recruiter_phone": "+1-650-253-0000",
  "hiring_requirement": "Backend engineers..."
}

Response:
{
  "success": true,
  "message": "Verification email sent to john@google.com",
  "expires_at": "2026-07-22T12:00:00Z"
}
```

---

### 5. Verify Access Token

```
GET /api/graduates/verify?token=secure_token_xyz

Response:
{
  "success": true,
  "valid": true,
  "graduate_id": "john-smith-123",
  "expires_at": "2026-07-22T12:00:00Z"
}

// If invalid/expired:
{
  "success": false,
  "valid": false,
  "message": "Token expired or invalid"
}
```

---

### 6. Get Full Profile (With Token)

```
GET /api/graduates/{slug}/full?token=secure_token_xyz
Authorization: Optional (can be anonymous with valid token)

Response:
{
  "success": true,
  "profile": {
    // SECTION 1: Overview
    "overview": {
      "name": "John Smith",
      "email": "john.smith@email.com",
      "photo": "url",
      "bio": "...",
      "location": "San Francisco, USA",
      "linkedin_url": "...",
      "github_url": "..."
    },
    
    // SECTION 2: Program Results
    "program_results": {
      "missions": [
        {
          "number": 1,
          "name": "REST API Design",
          "rating": 4.5,
          "completed_at": "2026-07-02"
        },
        "..."
      ],
      "overall_rating": 4.75
    },
    
    // SECTION 3: Assignment Portfolio
    "assignments": [
      {
        "mission_id": "mission-1",
        "mission_name": "REST API Design",
        "rating": 4.5,
        "completed_date": "2026-07-02",
        "summary": "Designed scalable REST API...",
        "evidence": {
          "journal_entries": [...],
          "github_url": "...",
          "loom_video": "...",
          "deployment_url": "...",
          "artifacts": [...]
        }
      },
      "..."
    ],
    
    // SECTION 4: Engineering Journal
    "journal_entries": [...], // All entries
    
    // SECTION 5: AI Evaluation
    "ai_evaluation": {
      "technical_skills": 4.8,
      "problem_solving": 4.6,
      "communication": 4.7,
      "ownership": 4.9,
      "collaboration": 4.5
    }
  }
}
```

---

### 7. Log Profile View

```
POST /api/graduates/{slug}/log-view
Content-Type: application/json

Request:
{
  "token": "secure_token_xyz",
  "recruiter_email": "john@google.com",
  "recruiter_name": "John Recruiter",
  "recruiter_organization": "Google"
}

Response:
{
  "success": true,
  "logged": true
}
```

---

### 8. Get Profile View Analytics

```
GET /api/admin/graduates/{slug}/analytics
Authorization: Bearer {admin-token}

Response:
{
  "success": true,
  "views": [
    {
      "id": "audit-1",
      "recruiter_name": "John Recruiter",
      "recruiter_organization": "Google",
      "recruiter_email": "john@google.com",
      "viewed_at": "2026-07-15T14:30:00Z",
      "ip_address": "203.0.113.45"
    },
    "..."
  ],
  "total_views": 15,
  "unique_organizations": 8
}
```

---

## 🏗️ Technical Architecture

### File Structure

```
talentOS/
├── apps/
│   ├── applicant/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   └── graduate-consent/
│   │   │   │       ├── page.tsx          (Consent modal)
│   │   │   │       └── actions.ts        (Consent logic)
│   │   │   ├── graduates/
│   │   │   │   ├── page.tsx              (Directory listing)
│   │   │   │   ├── [slug]/
│   │   │   │   │   ├── page.tsx          (Public profile)
│   │   │   │   │   └── full/
│   │   │   │   │       └── page.tsx      (Full profile after verification)
│   │   │   │   └── verify/
│   │   │   │       └── page.tsx          (Token verification page)
│   │   │   └── api/
│   │   │       └── graduates/
│   │   │           ├── route.ts          (List graduates)
│   │   │           ├── [slug]/
│   │   │           │   ├── route.ts      (Get public profile)
│   │   │           │   ├── full/
│   │   │           │   │   └── route.ts  (Get full profile)
│   │   │           │   ├── request-access/
│   │   │           │   │   └── route.ts  (Recruiter request form)
│   │   │           │   └── log-view/
│   │   │           │       └── route.ts  (Log profile view)
│   │   │           ├── profile/
│   │   │           │   └── route.ts      (Create/update profile)
│   │   │           └── verify/
│   │   │               └── route.ts      (Verify token)
│   │   ├── components/
│   │   │   ├── GraduateConsentModal.tsx
│   │   │   ├── GraduateProfileForm.tsx
│   │   │   ├── GraduateCard.tsx
│   │   │   ├── RecruiterAccessForm.tsx
│   │   │   └── FullPortfolioSection.tsx
│   │   └── lib/
│   │       └── graduates.ts             (Client utilities)
│   │
│   └── admin/
│       ├── app/
│       │   └── api/
│       │       └── admin/
│       │           └── graduates/
│       │               ├── [slug]/
│       │               │   └── analytics/
│       │               │       └── route.ts
│       │               └── analytics/
│       │                   └── route.ts
│       └── pages/
│           └── graduate-analytics/
│               └── page.tsx
│
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma             (DATABASE MODELS - STEP 1)
│   │   │   └── migrations/
│   │   │       └── xxx_add_graduate_tables/
│   │   │           └── migration.sql
│   │   └── src/
│   │       ├── graduates.ts              (Database queries)
│   │       ├── recruiter-access.ts       (Access request queries)
│   │       └── audit.ts                  (Audit log queries)
│   │
│   ├── auth/
│   │   └── src/
│   │       └── graduates-permissions.ts  (Check who can publish)
│   │
│   └── storage/
│       └── src/
│           └── graduate-photos.ts        (Photo upload/download)
│
├── docs/
│   ├── PUBLIC_PORTAL_DESIGN.md           (THIS FILE)
│   ├── PUBLIC_PORTAL_IMPLEMENTATION.md   (Step-by-step coding)
│   └── PUBLIC_PORTAL_API.md              (API reference)
│
└── scripts/
    └── seed-graduates.ts                 (Seed test data)
```

---

## 🔐 Security & Privacy

### What's Public (No Auth)

```
✓ Name
✓ Photo
✓ Overall Rating
✓ Bio
✓ Completion Date
✓ LinkedIn link
✓ GitHub link
✗ Email
✗ Full name (possibly)
✗ Assignments
✗ Journal
✗ Private info
```

### What Requires Verification

```
Full Portfolio requires:
✓ Recruiter fills form
✓ Receives verification email
✓ Clicks email link
✓ Token validated (not expired)
✓ Token matches graduate
✓ Then can view full profile
```

### Token Security

```
Generation:
├─ Use crypto.randomBytes(32) for entropy
├─ Convert to URL-safe base64
├─ Hash before storing in DB
└─ Example: "aB3xY9kL2mN4pQ6rS8tU0vW1xY2z"

Validation:
├─ Token must exist in DB
├─ Must not be expired
├─ Must match graduate_id
├─ Must have approved_at = null or be allowed multiple views
└─ Example: Valid for 7 days from request

Single-use vs Reusable:
├─ CURRENT: Reusable within 7 days
├─ ALTERNATIVE: Single-use after first click
├─ PROS (reusable): Recruiter can share link internally
├─ CONS (reusable): Less secure
```

### Privacy Controls

```
Graduate can:
✓ Choose to publish or not
✓ See who viewed their profile
✓ Download view analytics
✓ Retract profile anytime
✓ Control email visibility

Admin can:
✓ See all views and access requests
✓ Generate reports
✓ Block abusive recruiters
✓ Audit all activities

Compliance:
✓ GDPR compliant (consent required)
✓ Audit trail for all views
✓ Data deletion on request
✓ Privacy policy reference
```

---

## 🚀 Implementation Phases

### Phase 1: Database Setup ✅ (We'll do this)
- Create Prisma models
- Run migrations
- Add relationships

### Phase 2: Graduate Consent Flow ✅ (We'll do this)
- Add button to dashboard
- Consent modal
- Profile form
- Store in database

### Phase 3: Public Directory ✅ (We'll do this)
- List all graduates
- Search & filter
- Sort by rating/date
- Graduate cards

### Phase 4: Public Profile ✅ (We'll do this)
- Basic profile page
- Recruiter form
- Email integration

### Phase 5: Verification & Full Portfolio ✅ (We'll do this)
- Token system
- Email verification
- Full profile display
- Audit logging

### Phase 6: Admin Analytics (Later)
- View analytics dashboard
- Download reports

---

## 📊 Summary

| Component | Type | Status |
|-----------|------|--------|
| Database Schema | Backend | Planning |
| Graduate Consent | Frontend + Backend | Planning |
| Public Directory | Frontend + Backend | Planning |
| Public Profile | Frontend + Backend | Planning |
| Recruiter Access | Frontend + Backend | Planning |
| Email Verification | Backend | Planning |
| Full Portfolio | Frontend + Backend | Planning |
| Audit Logging | Backend | Planning |
| Admin Analytics | Frontend + Backend | Later |

---

**Next: Let's start CODING Phase 1! 🚀**

