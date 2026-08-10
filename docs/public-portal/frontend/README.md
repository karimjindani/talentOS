# 🎨 Frontend Documentation - TalentOS Public Portal

**Location:** `docs/public-portal/frontend/`

## What To Build (Frontend Components)

This folder contains specifications for all frontend components needed for the public portal.

---

## Phase 3: Frontend Components (TODO)

### Components Needed

1. **GraduateConsentModal.tsx**
   - Shows congratulations message
   - Displays mission ratings and overall rating
   - Explains public profile features
   - [Publish] and [Not Now] buttons
   - Optional: profile form for bio/links

2. **GraduateProfileForm.tsx**
   - Form to fill profile details
   - Fields: bio, linkedin, github, country, photo, skills
   - Auto-generates slug from name
   - Pre-fills existing data if editing

3. **PublicGraduateDirectory.tsx**
   - List all public profiles
   - Search box
   - Filter dropdowns (country, program, month)
   - Sort options (rating, date, name)
   - Pagination controls
   - Graduate cards grid

4. **GraduateCard.tsx**
   - Displays one graduate
   - Shows: photo, name, rating, bio, completion date
   - LinkedIn and GitHub links
   - "View Profile" button

5. **RecruiterAccessForm.tsx**
   - Modal form for recruiter access request
   - Fields: name, email, organization, designation, phone
   - Submit button
   - Error/success messages

---

## Phase 4: Pages (TODO)

1. **/graduates** - Public directory listing page
   - Uses PublicGraduateDirectory component
   - No authentication required

2. **/graduates/[slug]** - Public profile page
   - Uses GraduateCard + RecruiterAccessForm
   - Shows basic profile info
   - Form to request access

3. **/graduates/verify** - Email verification page
   - After clicking email link
   - Shows loading state
   - Redirects to full portfolio

4. **/dashboard/graduate-consent** - Consent modal
   - Inside applicant dashboard
   - Shows after all missions completed

---

## Phase 5: Full Portfolio Components (TODO)

1. **FullPortfolioView.tsx**
   - 6 sections (overview, results, assignments, journal, eval, actions)
   - After email verification token validated

2. **MissionResultsCard.tsx**
   - Shows one mission rating and details

3. **AssignmentPortfolioItem.tsx**
   - Shows one assignment with links
   - GitHub, Loom, Deployment links

4. **EngineeringJournalViewer.tsx**
   - Display journal entries (read-only)
   - Date filtering

5. **RecruiterActions.tsx**
   - Download report button
   - Contact candidate button
   - Save candidate button
   - Share button

---

## UI Components Library

These components are already available:

- **Button** - All button types
- **Form** - Form wrapper and fields
- **Modal** - Modal dialogs
- **Card** - Card containers
- **Badge** - Rating badges
- **Icon** - Lucide React icons

---

## Styling

- **Tailwind CSS** - Already configured
- **Theme colors**: Primary (#667eea), Secondary (#764ba2)
- **Responsive**: Mobile-first design
- **Dark mode**: Inherit from app theme

---

## Data Flow

```
PublicGraduateDirectory
  ↓
GET /api/graduates (paginated list)
  ↓
GraduateCard (for each graduate)
  ↓
[View Profile] click
  ↓
Navigate to /graduates/[slug]
  ↓
GET /api/graduates/[slug] (public profile)
  ↓
RecruiterAccessForm
  ↓
POST /api/graduates/[slug]/request-access
  ↓
Verification email sent
  ↓
Recruiter clicks email link
  ↓
/graduates/verify?token=xyz
  ↓
POST /api/graduates/verify
  ↓
FullPortfolioView (all sections)
```

---

## Status

- [ ] Phase 3: Components - TODO
- [ ] Phase 4: Pages - TODO
- [ ] Phase 5: Full Portfolio - TODO
- [ ] Admin Analytics - TODO

---

**Backend ready. Frontend to be built next!**
