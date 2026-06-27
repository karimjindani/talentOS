# Product Backlog

Code version: `v0.1.2`

Documentation update: `Engineering backlog direction`

## MVP

- Applications
- Programs
- Missions
- AI Mentor
- Knowledge Base
- GitHub Integration
- Portfolio
- Certificates
- Leaderboard
- Hiring Recommendations

## V2

- AI Assignment Review
- Slack Community
- AI Interview

## V3

- AI Video Analysis
- AI Customer
- AI Stakeholder Personas

## Engineering Backlog

### Major Platform Items

- IAM with Keycloak
  - Keycloak is the target IAM system for authentication, MFA, identity federation, roles and session management.
  - TalentOS application code should integrate with Keycloak instead of expanding custom authentication as the long-term IAM layer.

- Separate Admin and Applicant Portals
  - The Admin Portal and Applicant Portal should become two separate portal surfaces.
  - The current `v0.1.1` scaffold serves both portal shells from one Next.js app, but this is not the long-term architecture.

### MVP Engineering Deliverables

- Applications module
- Programs module
- Missions module
- AI Mentor boundary
- Knowledge Base
- GitHub Integration
- Portfolio
- Certificates
- Leaderboard
- Hiring Recommendations
