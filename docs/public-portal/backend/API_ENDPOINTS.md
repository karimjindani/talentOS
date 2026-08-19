# API Endpoints - TalentOS Public Portal

## Overview

6 API endpoints providing complete public graduate portal functionality.

---

## 1. LIST GRADUATE PROFILES

**Endpoint:** `GET /api/graduates`

**Authentication:** None (public)

**Description:** Get list of all public graduate profiles with search, filter, and sort capabilities.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Results per page (max 100) |
| `sort` | string | rating | Sort by: `rating`, `date`, `name` |
| `search` | string | - | Search by name or skills |
| `country` | string | - | Filter by country |
| `monthFrom` | date | - | Filter from date (YYYY-MM-DD) |
| `monthTo` | date | - | Filter to date (YYYY-MM-DD) |

### Request Example

```bash
curl "http://localhost:3100/api/graduates?page=1&limit=20&sort=rating&search=react"
```

### Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "slug": "john-smith",
      "name": "John Smith",
      "photo": "https://example.com/photo.jpg",
      "rating": 4.8,
      "bio": "Backend engineer passionate about distributed systems",
      "completionDate": "2026-07-15T00:00:00Z",
      "linkedinUrl": "https://linkedin.com/in/john-smith",
      "githubUrl": "https://github.com/johnsmith"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 127,
    "pages": 7
  }
}
```

---

## 2. GET PUBLIC PROFILE

**Endpoint:** `GET /api/graduates/[slug]`

**Authentication:** None (public)

**Description:** Get basic profile information for a specific graduate.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | Graduate's URL slug (e.g., john-smith) |

### Request Example

```bash
curl "http://localhost:3100/api/graduates/john-smith"
```

### Response Example

```json
{
  "success": true,
  "profile": {
    "id": "uuid-123",
    "slug": "john-smith",
    "name": "John Smith",
    "photo": "https://example.com/photo.jpg",
    "rating": 4.8,
    "bio": "Backend engineer passionate about distributed systems",
    "country": "United States",
    "completionDate": "2026-07-15T00:00:00Z",
    "linkedinUrl": "https://linkedin.com/in/john-smith",
    "githubUrl": "https://github.com/johnsmith"
  }
}
```

### Response Error (404)

```json
{
  "error": "Profile not found"
}
```

---

## 3. REQUEST FULL PORTFOLIO ACCESS

**Endpoint:** `POST /api/graduates/[slug]/request-access`

**Authentication:** None (public)

**Description:** Recruiter submits form to request access to full portfolio. System generates secure token and sends verification email.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | Graduate's URL slug |

### Request Body

```json
{
  "recruiterName": "Jane Recruiter",
  "recruiterOrganization": "Google",
  "recruiterDesignation": "Senior Recruiter",
  "recruiterEmail": "jane@google.com",
  "recruiterPhone": "+1-650-253-0000",
  "hiringRequirement": "Looking for backend engineers"
}
```

### Request Example

```bash
curl -X POST "http://localhost:3100/api/graduates/john-smith/request-access" \
  -H "Content-Type: application/json" \
  -d '{
    "recruiterName": "Jane Recruiter",
    "recruiterEmail": "jane@google.com",
    "recruiterOrganization": "Google",
    "recruiterDesignation": "Senior Recruiter"
  }'
```

### Response (Success)

```json
{
  "success": true,
  "message": "Verification email sent to jane@google.com",
  "expiresAt": "2026-07-22T10:00:00Z",
  "accessRequestId": "access-uuid-123"
}
```

### Response Error (Invalid Email)

```json
{
  "error": "Invalid email format"
}
```

---

## 4. VERIFY TOKEN

**Endpoint:** `POST /api/graduates/verify`

**Authentication:** None (public)

**Description:** Verify email verification token. Called when recruiter clicks email link. Logs profile view.

### Request Body

```json
{
  "token": "secure_token_from_email_link"
}
```

### Request Example

```bash
curl -X POST "http://localhost:3100/api/graduates/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123xyz..."
  }'
```

### Response (Success)

```json
{
  "success": true,
  "valid": true,
  "graduateId": "graduate-uuid-123",
  "expiresAt": "2026-07-22T10:00:00Z"
}
```

### Response Error (Invalid/Expired)

```json
{
  "error": "Invalid or expired token"
}
```

---

## 5. CREATE/UPDATE GRADUATE PROFILE

**Endpoint:** `POST /api/graduates/profile`

**Authentication:** Required (Applicant logged in)

**Description:** Graduate publishes or updates their profile. Sets `public_profile_enabled = true`.

### Request Body

```json
{
  "bio": "Backend engineer passionate about distributed systems",
  "linkedinUrl": "https://linkedin.com/in/john-smith",
  "githubUrl": "https://github.com/johnsmith",
  "country": "United States",
  "profilePhotoUrl": "https://example.com/photo.jpg",
  "skills": ["nodejs", "react", "kubernetes"],
  "interests": ["microservices", "devops"],
  "emailPublic": false
}
```

### Request Example

```bash
curl -X POST "http://localhost:3100/api/graduates/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "bio": "Backend engineer...",
    "linkedinUrl": "https://linkedin.com/in/john-smith",
    "githubUrl": "https://github.com/johnsmith"
  }'
```

### Response (Success)

```json
{
  "success": true,
  "profile": {
    "id": "uuid-123",
    "slug": "john-smith",
    "publicProfileEnabled": true,
    "bio": "Backend engineer passionate about distributed systems",
    "linkedinUrl": "https://linkedin.com/in/john-smith",
    "githubUrl": "https://github.com/johnsmith",
    "overallRating": 4.8,
    "graduationDate": "2026-07-15T00:00:00Z"
  }
}
```

### Response Error (Unauthorized)

```json
{
  "error": "Unauthorized"
}
```

---

## 6. GET USER'S PROFILE

**Endpoint:** `GET /api/graduates/profile`

**Authentication:** Required (Applicant logged in)

**Description:** Get current user's graduate profile status.

### Request Example

```bash
curl "http://localhost:3100/api/graduates/profile" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Response (Success)

```json
{
  "success": true,
  "profile": {
    "id": "uuid-123",
    "userId": "user-uuid",
    "publicProfileEnabled": true,
    "bio": "Backend engineer...",
    "linkedinUrl": "https://linkedin.com/in/john-smith",
    "githubUrl": "https://github.com/johnsmith",
    "overallRating": 4.8,
    "graduationDate": "2026-07-15T00:00:00Z",
    "slug": "john-smith",
    "consentDate": "2026-07-15T10:00:00Z"
  }
}
```

### Response Error (Not Found)

```json
{
  "error": "No graduate profile found"
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (auth required) |
| 404 | Not found |
| 500 | Server error |

---

## Rate Limiting

- Public endpoints: No rate limiting
- Authenticated endpoints: 100 requests per hour
- Email endpoints: 10 requests per hour per IP

---

## CORS

- Public endpoints: CORS enabled for `*.lvh.me` and `http://localhost:*`
- Authenticated endpoints: CORS enabled for same-origin only

---

**All endpoints tested and production-ready!**
