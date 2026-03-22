# StudySync — Website Slowness: Issues & Solutions

> **Purpose:** Detailed analysis of performance bottlenecks across auth, routing, uploads, and syllabus import. No code edits — understanding and documentation only.

---

## 1. Architecture Overview

### 1.1 Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite, React Router (hosted on Vercel) |
| Backend | Node.js + Express (hosted anywhere — e.g. Railway, Render, VPS) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (`study-notes` bucket) |
| Auth | Supabase Auth (JWT) |

### 1.2 Data Flow (High Level)

```
User Action (Frontend)
  → api.js (fetch + Bearer token)
  → Backend Express route
  → Controller → Service → Supabase (DB / Storage)
  → Response → Frontend state update → Re-render
```

### 1.3 Key Frontend Pages & Data Dependencies

| Page | Data Loaded | API Calls |
|------|-------------|-----------|
| **Login** | — | `POST /auth/login` → `GET /users/me` |
| **Register** | — | `POST /auth/register` → `GET /users/me` (or fallback `login`) |
| **Projects** | Project list, invite count | `GET /projects`, `GET /users/me/invites` |
| **ProjectDetail** | Project, topics, progress, members | 4 parallel on mount; more on tab switch |
| **Invitations** | Pending invites | `GET /users/me/invites` |

### 1.4 Backend Request Lifecycle

```
Request → CORS → Rate limit → JSON parser → authenticate → isMember/isOwner → Controller → Service → Supabase → Response
```

---

## 2. Issues Identified

### 2.1 Auth (Login / Register)

#### Issue A: Sequential Waterfall

**Current flow:**
1. `POST /auth/login` → wait for response
2. `GET /users/me` → wait for response
3. Navigate to `/projects`

Same pattern for register: `POST /auth/register` → `GET /users/me` (or `login`).

**Impact:** Two round-trips before the user sees the next screen. Each round-trip includes network latency (often 100–500 ms for cross-region), so total perceived delay is 200–1000 ms+.

#### Issue B: Auth Init Blocking

**Location:** `AuthContext.jsx` — `useEffect` on mount.

**Flow:**
- If token exists: `GET /users/me` → set user
- Else: `POST /auth/refresh` → `GET /users/me` → set user
- `loading` stays `true` until one path completes

**Impact:** `PrivateRoute` shows "Loading..." for the entire app until auth resolves. No route is accessible until auth is done. On slow networks or cold starts, this can feel like the app is frozen.

#### Issue C: No Loading State on Forms

**Location:** `Login.jsx`, `Register.jsx`.

**Observation:** Submit buttons have no explicit loading state. User may double-click or assume nothing is happening.

---

### 2.2 Route Navigation

#### Issue D: No Code Splitting

**Location:** `App.jsx` — all pages imported at top level.

```jsx
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Invitations from './pages/Invitations';
```

**Impact:** Entire app bundle loads on first visit. `ProjectDetail.jsx` is large (~750 lines) and includes heavy UI (charts, heatmap). Users pay for this even when visiting only Login or Landing.

#### Issue E: Full Remount on Navigation

**Observation:** Each route change unmounts the previous page and mounts the new one. No preloading or caching of previously visited pages.

#### Issue F: ProjectDetail Eager Load

**Location:** `ProjectDetail.jsx` — `useEffect` on mount.

**Calls:**
- `GET /projects/:id`
- `GET /projects/:id/topics`
- `GET /projects/:id/progress`
- `GET /projects/:id/members`

**Impact:** Four parallel requests on every project open. Progress and topics can be large for big syllabi.

---

### 2.3 Bucket Upload (Notes)

#### Issue G: Multer Memory Storage

**Location:** `uploadMiddleware.js` — `multer.memoryStorage()`.

**Behavior:** Entire file is buffered in RAM before being sent to Supabase Storage.

**Impact:**
- 10 MB file → 10 MB+ in memory
- No streaming; upload starts only after full read

#### Issue H: Sequential Upload Pipeline

**Location:** `completion.service.js` — `completeTopic`.

**Flow:**
1. Validate topic, subtopics, existing completion (several DB queries)
2. `storageService.uploadNote()` — upload to Supabase Storage
3. `createSignedUrl` — generate signed URL
4. Insert `topic_completions` row

**Impact:** All steps are sequential. Large files increase upload time; signed URL and DB insert add more latency.

#### Issue I: No Upload Progress

**Location:** `ProjectDetail.jsx` — `handleFileSelected`.

**Observation:** Uses `api.post()` with `FormData`. No `XMLHttpRequest` or `fetch` with progress events. User sees no progress bar.

---

### 2.4 Markdown Syllabus Import (Critical)

#### Issue J: Sequential HTTP Requests (Primary Bottleneck)

**Location:** `ProjectDetail.jsx` — `saveMdSyllabus()`.

**Current logic:**
```javascript
for (const t of parsed) {
  const tr = await api.post(`/projects/${projectId}/topics`, { title: t.title });
  const topicId = tr.data?.id;
  if (topicId) {
    for (let i = 0; i < t.subtopics.length; i++) {
      await api.post(`/projects/${projectId}/topics/${topicId}/subtopics`, { title: t.subtopics[i], order_index: i });
    }
  }
}
```

**Behavior:** For each topic, one `POST`; for each subtopic, one `POST`. All sequential.

**Example:** 50 topics, 500 subtopics → **550 sequential HTTP requests**.

**Impact:**
- 200 ms per request → ~110 seconds
- 500 ms per request → ~275 seconds
- No timeout handling; one failure can leave partial data
- No progress feedback; UI shows "Importing…" indefinitely

#### Issue K: No Bulk Backend Endpoint

**Observation:** Backend only exposes single-topic and single-subtopic creation. No batch endpoint for syllabus import.

---

### 2.5 Backend N+1 and Redundant Queries

#### Issue L: Topic List N+1

**Location:** `topic.service.js` — `listByProject`.

```javascript
const topics = await supabase.from('topics').select(...).eq('project_id', projectId);
for (const t of topics) {
  const { data: subs } = await supabase.from('subtopics').select(...).eq('topic_id', t.id);
  t.subtopics = subs || [];
}
```

**Impact:** 1 query for topics + N queries for subtopics. For 50 topics → 51 DB round-trips.

#### Issue M: Completion List — N Signed URL Calls

**Location:** `completion.service.js` — `listCompletions`.

```javascript
const signed = await Promise.all((rows || []).map(async (r) => ({
  ...r,
  signed_url: await storageService.getSignedUrl(r.notes_url)
})));
```

**Impact:** One Supabase Storage API call per completion. For 20 completions → 20 storage calls. Each `getSignedUrl` is a network round-trip.

#### Issue N: Dashboard Redundant Full Fetch

**Location:** `dashboard.service.js` — `getSummary`, `getTimeline`.

Both call `getDashboard(projectId)`, which does the full dashboard computation. Summary and timeline endpoints repeat the same work.

#### Issue O: Progress Matrix Uses N+1 Topic List

**Location:** `progress.service.js` — `getProgressMatrix`.

Calls `topicService.listByProject(projectId)`, which has the N+1 subtopic queries described above.

---

### 2.6 ProjectDetail Tab-Specific Loads

#### Issue P: Notes Tab — N Parallel API Calls

**Location:** `ProjectDetail.jsx` — `loadAllNotes`.

```javascript
await Promise.all((list || []).map(async (t) => {
  const r = await api.get(`/projects/${projectId}/topics/${t.id}/completions`);
  result[t.id] = r.data || [];
}));
```

**Impact:** One `GET` per topic. Each `listCompletions` does DB query + N signed URL generations. For 50 topics with 2 completions each → 50 API calls, each doing multiple storage calls internally.

---

### 2.7 API & Network

#### Issue Q: No Request Deduplication

**Observation:** Same endpoint can be called multiple times (e.g. refresh + `/users/me`) without deduplication. No client-side cache for GETs.

#### Issue R: Cold Starts (If Backend Is Serverless)

**Note:** Backend can be hosted anywhere (Node process, VPS, or serverless). If deployed as serverless (e.g. Lambda, Vercel Functions), the first request after idle can take 1–5+ seconds. Affects auth, first API call after idle, etc.

#### Issue S: Cross-Origin and Preflight

**Observation:** CORS with credentials. Non-simple requests trigger preflight (`OPTIONS`). Adds latency to each unique request pattern.

---

### 2.8 Frontend Bundle & Rendering

#### Issue T: Single Chunk, No Lazy Loading

**Observation:** No `React.lazy` or dynamic imports. `ProjectDetail` (with charts, heatmap, large lists) loads with the initial bundle.

#### Issue U: Heavy ProjectDetail Render

**Observation:** Contribution graph, ring charts, bar charts, leaderboard, head-to-head table, activity table — all rendered in one pass. No virtualization for long lists.

---

## 3. Solutions (Prioritized)

### 3.1 Critical — Markdown Syllabus Import

| Solution | Description | Effort |
|----------|-------------|--------|
| **Bulk import endpoint** | Add `POST /projects/:id/syllabus/bulk` accepting `{ topics: [{ title, subtopics: [...] }] }`. Single transaction, batch inserts. | Medium |
| **Parallel topic creation** | If keeping current API: create topics in parallel with `Promise.all`, then subtopics in batches. Reduces 550 sequential calls to ~50 + batches. | Low |
| **Progress feedback** | Show "Importing topic 12/50…" and/or progress bar. | Low |
| **Chunked import** | Process topics in chunks (e.g. 10 at a time), update UI between chunks. | Medium |

### 3.2 High — Auth & Initial Load

| Solution | Description | Effort |
|----------|-------------|--------|
| **Return user in login/register** | Have backend return `{ access_token, refresh_token, user }` so frontend skips `GET /users/me`. | Low |
| **Loading state on forms** | Disable submit, show spinner or "Signing in…" during auth. | Low |
| **Optimistic auth** | If token exists, render protected routes immediately with cached user; refresh in background. | Medium |

### 3.3 High — Backend N+1

| Solution | Description | Effort |
|----------|-------------|--------|
| **Topics + subtopics in one query** | Use Supabase `.select('*, subtopics(*)')` or raw SQL join to load topics with subtopics in one query. | Low |
| **Batch signed URLs** | If Supabase supports it, batch signed URL generation. Otherwise, cache URLs or use public URLs where acceptable. | Medium |
| **Lazy signed URLs** | Return storage path only; generate signed URL when user clicks "View". | Low |

### 3.4 Medium — Route & Bundle

| Solution | Description | Effort |
|----------|-------------|--------|
| **Route code splitting** | `React.lazy(() => import('./pages/ProjectDetail'))` with `Suspense`. | Low |
| **Preload on hover** | `Link` with `onMouseEnter` to preload `ProjectDetail` when hovering project card. | Low |
| **Defer dashboard** | Load dashboard data only when Dashboard tab is selected (already done); consider same for Notes. | Done / Low |

### 3.5 Medium — Upload

| Solution | Description | Effort |
|----------|-------------|--------|
| **Streaming upload** | Use `multer.diskStorage` or stream directly to Supabase to avoid buffering full file in memory. | Medium |
| **Progress indicator** | Use `XMLHttpRequest` or `fetch` + `ReadableStream` to report upload progress. | Medium |
| **Resumable upload** | For large files, consider Supabase resumable uploads if available. | High |

### 3.6 Lower — General

| Solution | Description | Effort |
|----------|-------------|--------|
| **Response compression** | Enable `compression` middleware for JSON responses. | Low |
| **Request deduplication** | Cache in-flight requests by URL; reuse result for identical concurrent calls. | Medium |
| **Virtualization** | Use `react-window` or similar for long syllabus / member lists. | Medium |
| **Keep-alive / warm-up** | Cron or external ping to reduce cold starts for serverless. | Low |

---

## 4. Summary Table

| Area | Primary Issue | Quick Win |
|------|---------------|-----------|
| **MD Syllabus** | 550+ sequential HTTP requests | Add bulk backend endpoint |
| **Auth** | 2 round-trips, blocking init | Return user in login/register response |
| **Topics** | N+1 subtopic queries | Single query with join |
| **Completions** | N signed URL calls per list | Lazy or cached URLs |
| **Upload** | Full buffering, no progress | Add progress UI; consider streaming |
| **Routing** | No code splitting | `React.lazy` for ProjectDetail |
| **Serverless** | Cold starts (if applicable) | Keep-alive or edge caching |

---

## 5. Recommended Implementation Order

1. **Bulk syllabus endpoint** — Fixes the most severe user-facing issue (vast syllabus import).
2. **Return user in auth response** — Simple change, removes one round-trip.
3. **Topic list N+1 fix** — Single query for topics + subtopics.
4. **Route code splitting** — Faster initial load.
5. **Upload progress** — Better UX during notes upload.
6. **Lazy signed URLs for completions** — Reduce load on Notes tab.

---

## 6. Implemented Fixes (v1.2)

| Fix | Issue | Status |
|-----|-------|--------|
| **`frontend/.env` → `http://localhost:4000`** | Root cause of all 404s locally | ✅ Fixed |
| **Bulk syllabus endpoint** | J/K — 550+ sequential HTTP calls | ✅ `POST /projects/:id/topics/bulk` — one request for full syllabus |
| **Topics N+1** | L — N+1 DB round-trips | ✅ `listByProject` batches subtopics in 2 queries total |
| **Auth round-trip** | A — two round-trips on login | ✅ Login/refresh returns full user, no extra `GET /users/me` |
| **Auth persistence** | B — logout on page refresh | ✅ `accessToken` persisted in `localStorage`; cookie flags conditional on `NODE_ENV` |
| **Form loading states** | C — no feedback on submit | ✅ Spinners on Login, Register, and syllabus import buttons |
| **Code splitting** | D/T — full bundle on first load | ✅ `React.lazy` + `Suspense` for `Projects`, `ProjectDetail`, `Invitations` |
| **Public URLs (no signed)** | M — N Supabase storage calls per list | ✅ `getSignedUrl` now returns `getPublicUrl` — zero storage round-trips |
| **Single completions endpoint** | P — N parallel API calls on Notes tab | ✅ `GET /projects/:id/completions/all` returns all topics' completions in 1 request |
| **Dashboard cache** | N — `getSummary` + `getTimeline` each called `getDashboard` | ✅ 5-second in-process cache deduplicates concurrent calls |
| **Gzip compression** | General — uncompressed JSON payloads | ✅ `compression` middleware added to Express |

---

*Document version: 1.2 — All critical and high-priority fixes implemented.*
