# 🔗 FRONTEND INTEGRATION GUIDE

## Where to Add Components in Dashboard

### 1. **Consent Modal in Dashboard**

**Current Location:** `apps/applicant/app/dashboard/page.tsx`

**Add this import:**
```typescript
import { GraduateConsentModal } from "@/components/GraduateConsentModal";
```

**Add this in the JSX (after all missions are complete):**
```typescript
{applicantHasCompletedAllMissions && (
  <GraduateConsentModal
    userName={user?.name || "Graduate"}
    missionRatings={missions.map(m => ({
      name: m.name,
      rating: m.rating
    }))}
    overallRating={applicant.overallRating}
    onPublish={() => {
      // Refresh dashboard or redirect to /graduates
      router.refresh();
    }}
    onSkip={() => {
      // Close modal or hide
      setShowConsentModal(false);
    }}
  />
)}
```

---

## How to Use Each Component

### **GraduateCard**

```typescript
import { GraduateCard } from "@/components/GraduateCard";

<GraduateCard
  id="uuid-123"
  slug="john-smith"
  name="John Smith"
  photo="https://example.com/photo.jpg"
  rating={4.8}
  bio="Backend engineer passionate about distributed systems"
  completionDate="2026-07-15"
  linkedinUrl="https://linkedin.com/in/john-smith"
  githubUrl="https://github.com/johnsmith"
/>
```

---

### **RecruiterAccessForm**

```typescript
import { RecruiterAccessForm } from "@/components/RecruiterAccessForm";

<RecruiterAccessForm
  graduateSlug="john-smith"
  graduateName="John Smith"
  onSubmitSuccess={() => {
    alert("Email sent!");
  }}
/>
```

---

### **PublicGraduateDirectory**

```typescript
import { PublicGraduateDirectory } from "@/components/PublicGraduateDirectory";

// Entire component handles fetching and displaying
<PublicGraduateDirectory />
```

---

### **GraduateProfileForm**

```typescript
import { GraduateProfileForm } from "@/components/GraduateProfileForm";

<GraduateProfileForm
  onSuccess={() => {
    alert("Profile saved!");
  }}
  initialData={{
    bio: "Existing bio...",
    linkedinUrl: "https://linkedin.com/...",
    githubUrl: "https://github.com/...",
  }}
/>
```

---

### **GraduateConsentModal**

```typescript
import { GraduateConsentModal } from "@/components/GraduateConsentModal";

<GraduateConsentModal
  userName="John Doe"
  missionRatings={[
    { name: "Foundation", rating: 4.5 },
    { name: "Build", rating: 4.8 },
    { name: "Deploy", rating: 4.2 },
  ]}
  overallRating={4.5}
  onPublish={() => console.log("Published!")}
  onSkip={() => console.log("Skipped!")}
/>
```

---

## Testing URLs

### Public Pages (No Auth Required)

```
http://localhost:3100/graduates
  → Browse all public graduates

http://localhost:3100/graduates/john-smith
  → View specific graduate profile

http://localhost:3100/graduates/verify?token=abc123xyz
  → Email verification page
```

### Protected/Auth Pages

```
http://localhost:3100/dashboard
  → Should show consent modal after missions

http://localhost:3100/graduates/john-smith/portfolio
  → Full portfolio (requires token)
```

---

## Environment Setup

Make sure these are in `.env`:

```env
# Already configured
NEXTAUTH_URL=http://localhost:3100
DATABASE_URL=postgresql://...

# For email verification
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@talentos.io
```

---

## Testing Flow

1. **As Recruiter:**
   - Visit `/graduates`
   - Search and find a graduate
   - Click "View Profile"
   - Fill out recruiter form
   - Check email for verification link
   - Click link to access portfolio

2. **As Graduate:**
   - Login to dashboard
   - Complete all missions
   - See consent modal
   - Click "Publish Profile"
   - Fill out profile form
   - Profile appears in `/graduates` directory

---

## Common Issues & Fixes

### Issue: Pages not loading
**Solution:** Make sure API endpoints are working (`/api/graduates`)

### Issue: Form not submitting
**Solution:** Check network tab for API errors, verify email service is configured

### Issue: Images not showing
**Solution:** Use valid image URLs or upload to imgur.com first

### Issue: Styling looks broken
**Solution:** Make sure Tailwind CSS is configured in next.config.mjs

---

## Files Modified

✅ `apps/applicant/components/` - 5 new components added
✅ `apps/applicant/app/graduates/` - 4 new pages added
✅ `TESTING_PORTAL_DASHBOARD.html` - Public portal links added

---

## Files NOT Modified (As Requested)

✅ No changes to existing components
✅ No changes to ApplicantShell.tsx
✅ No changes to PortalHeader.tsx
✅ No changes to dashboard logic
✅ No changes to API endpoints

---

**Ready for Dashboard Integration! 🚀**

