# 🔧 Backend Documentation - TalentOS Public Portal

**Location:** `docs/public-portal/backend/`

## Files in this folder:

### 1. **API_ENDPOINTS.md** - All API routes
   - GET /api/graduates - List public profiles
   - GET /api/graduates/[slug] - Get public profile
   - POST /api/graduates/[slug]/request-access - Request access
   - POST /api/graduates/profile - Create profile
   - GET /api/graduates/profile - Get user profile
   - POST /api/graduates/verify - Verify token

### 2. **DATABASE_SCHEMA.md** - Database models
   - GraduateProfile model
   - RecruiterAccessRequest model
   - ProfileViewAudit model
   - Relationships and indexes

### 3. **SERVICES.md** - Service layer
   - graduates.ts (database functions)
   - slug-generator.ts (URL slug generation)
   - token-generator.ts (secure tokens)
   - email-service.ts (email functionality)

### 4. **SETUP.md** - Backend setup
   - Database migration
   - Environment variables
   - Email configuration
   - Dependencies installation

### 5. **TESTING.md** - Backend testing
   - API testing scenarios
   - cURL examples
   - Database verification
   - Error cases

---

## Source Code Files Location

```
packages/db/src/
├── graduates.ts              ✅ Database functions
├── slug-generator.ts         ✅ Slug utilities
└── token-generator.ts        ✅ Token utilities

apps/applicant/app/api/graduates/
├── route.ts                  ✅ List graduates
├── profile/route.ts          ✅ Create profile
├── [slug]/route.ts           ✅ Get profile
├── [slug]/request-access/route.ts    ✅ Request access
└── verify/route.ts           ✅ Verify token

apps/applicant/lib/
└── email-service.ts          ✅ Email service

packages/db/prisma/
├── schema.prisma             ✅ Database models
└── migrations/               ✅ Database migration
```

---

## Status

✅ Database: Complete
✅ API Endpoints: Complete
✅ Email Service: Complete
✅ Token Security: Complete
✅ Testing: Ready

---

**Backend is 100% complete and ready for frontend integration!**
