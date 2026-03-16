# StudySync — Backend Architecture & API Documentation

> Collaborative Study Progress Tracker  
> Stack: Node.js + Express · Supabase (PostgreSQL) · Supabase Storage · JWT Auth

## 1. Project Overview

### 1.1 Core Concept

StudySync transforms self-studying into a transparent, group-accountable experience. Friends who want to study the same subject together join a shared **Project**, study against the same syllabus, and track individual progress that is visible to everyone in the group.

The platform is built around four pillars:

- **Structured Syllabi** — The project creator defines the exact Topic → Subtopic index that all members study against. Every member sees the same map.
- **Individual Progress Tracking** — Each member marks their own subtopic completions independently. Progress is personal but visible to the group.
- **Proof-Gated Completion** — A topic cannot be marked complete until the user uploads handwritten notes or a PDF. Completion reflects genuine effort, not just checkbox clicking.
- **Comparative Dashboard** — A shared analytics view shows who is ahead, who is behind, completion velocity over time, and head-to-head comparisons.

### 1.2 Data Hierarchy

```
User
 └── belongs to → Projects (via project_members)

Project
 └── has → Topics (ordered)
       └── has → Subtopics (ordered)

Per User × Per Project:
 ├── subtopic_progress  (one row per user per subtopic)
 └── topic_completions  (one row per user per topic — created only after notes upload)
```

### 1.3 Technology Stack

|Layer|Technology|
|---|---|
|Runtime|Node.js|
|Framework|Express.js|
|Database|Supabase (PostgreSQL)|
|File Storage|Supabase Storage (`study-notes` bucket)|
|Authentication|Email + Password only — JWT via Supabase Auth|
|API Style|RESTful JSON|
|File Upload|Multer (multipart/form-data → Supabase Storage)|

---

## 2. Database Schema

### 2.1 `profiles`

Extends Supabase Auth. A database trigger creates this row automatically whenever a user registers via `auth.users`.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK — mirrors `auth.users.id`|
|`email`|`text`|Unique|
|`full_name`|`text`|Display name|
|`avatar_url`|`text`|Optional|
|`created_at`|`timestamptz`|Auto|

---

### 2.2 `projects`

A project represents a study subject (e.g. "JavaScript", "DSA"). One user creates it and becomes the owner.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`title`|`text`|e.g. "React", "Power BI"|
|`description`|`text`|Optional scope description|
|`created_by`|`uuid`|FK → `profiles.id`|
|`created_at`|`timestamptz`|Auto|

---

### 2.3 `project_members`

Controls who belongs to which project. This table is the **single source of truth for access control**. If a user has no row here for a project, they cannot see or interact with it — period.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`project_id`|`uuid`|FK → `projects.id`|
|`user_id`|`uuid`|FK → `profiles.id`|
|`role`|`enum`|`'owner'` or `'member'`|
|`joined_at`|`timestamptz`|Auto|

> **Unique constraint:** `(project_id, user_id)` — a user appears only once per project.

---

### 2.4 `topics`

Top-level syllabus sections within a project. Ordered by `order_index`.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`project_id`|`uuid`|FK → `projects.id` (cascade delete)|
|`title`|`text`|e.g. "Execution and Mental Model"|
|`order_index`|`integer`|Display order in the syllabus|
|`created_at`|`timestamptz`|Auto|

---

### 2.5 `subtopics`

Atomic study units nested under a topic. These are the items users tick off.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`topic_id`|`uuid`|FK → `topics.id` (cascade delete)|
|`title`|`text`|e.g. "Hoisting", "Scope Chain"|
|`order_index`|`integer`|Display order within the topic|
|`created_at`|`timestamptz`|Auto|

---

### 2.6 `subtopic_progress`

Tracks each member's individual completion of every subtopic. `project_id` is **denormalized** here intentionally — the dashboard can fetch all progress for a project in one query without chaining joins.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`subtopic_id`|`uuid`|FK → `subtopics.id`|
|`user_id`|`uuid`|FK → `profiles.id`|
|`project_id`|`uuid`|FK → `projects.id` (denormalized)|
|`is_completed`|`boolean`|Default `false`|
|`completed_at`|`timestamptz`|Set when toggled to `true`|

> **Unique constraint:** `(subtopic_id, user_id)` — one progress record per user per subtopic.

---

### 2.7 `topic_completions`

The **proof-of-study record**. Created only when both conditions are met: (1) the user has completed every subtopic under the topic, AND (2) they have uploaded study notes. This record is permanent — it cannot be toggled off.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`topic_id`|`uuid`|FK → `topics.id`|
|`user_id`|`uuid`|FK → `profiles.id`|
|`project_id`|`uuid`|FK → `projects.id` (denormalized)|
|`notes_url`|`text`|Supabase Storage path|
|`notes_type`|`text`|`'image'` or `'pdf'`|
|`uploaded_at`|`timestamptz`|Auto|

> **Unique constraint:** `(topic_id, user_id)` — one completion record per user per topic.

---

### 2.8 `project_invites`

Manages the full invite lifecycle. Invites can be issued to emails that haven't registered yet.

|Column|Type|Notes|
|---|---|---|
|`id`|`uuid`|PK|
|`project_id`|`uuid`|FK → `projects.id`|
|`invited_by`|`uuid`|FK → `profiles.id`|
|`invited_email`|`text`|Email of the invitee|
|`status`|`enum`|`'pending'`, `'accepted'`, `'declined'`|
|`created_at`|`timestamptz`|Auto|
|`responded_at`|`timestamptz`|Set on accept/decline|

> **Unique constraint:** `(project_id, invited_email)` — one active invite per email per project.

---

## 3. Supabase Storage

### 3.1 Bucket Name

```
study-notes
```

### 3.2 Path Convention

The backend enforces this path structure on every upload:

```
study-notes/
  {project_id}/
    {topic_id}/
      {user_id}/
        {timestamp}_{original_filename}.pdf
        {timestamp}_{original_filename}.jpg
```

**Example:**

```
study-notes/
  proj_abc123/
    topic_xyz789/
      user_def456/
        1704067200000_scope_chain_notes.pdf
```

### 3.3 Why This Convention

- `project_id` at root — groups all assets per project; easy to clean up when a project is deleted
- `topic_id` as second level — scopes files to the exact topic they prove
- `user_id` as third level — isolates each member's uploads; zero filename collisions
- Timestamp prefix — guarantees uniqueness even on re-uploads of the same filename

### 3.4 Signed URLs

The raw storage path is never sent to the frontend. After upload, the backend generates a **signed URL** (7-day expiry) and stores the path in `topic_completions.notes_url`. When a project member needs to view notes, the backend generates a fresh signed URL on demand.

> **Constraints:** Max file size 10 MB. Accepted MIME types: `application/pdf`, `image/jpeg`, `image/png`. Both validated by the backend before the file reaches Supabase Storage.

---

## 4. Authentication Architecture

### 4.1 Method

**Email + Password only.** No OAuth, no social login, no magic links.

### 4.2 Flow

```
1.  User submits { email, password }
2.  Backend calls Supabase Auth → signInWithPassword()
3.  Supabase returns { access_token (JWT), refresh_token }
4.  Backend sends:
      - access_token  → response body (frontend stores in memory)
      - refresh_token → HttpOnly cookie (not accessible to JS)
5.  All subsequent API requests include:
      Authorization: Bearer <access_token>
6.  Auth middleware validates JWT signature via Supabase JWKS
7.  Decoded user ID (sub claim) is attached to req.user
8.  On 401, frontend uses the refresh_token cookie to get a new access_token silently
```

### 4.3 JWT Contents (relevant claims)

|Claim|Value|
|---|---|
|`sub`|`profiles.id` (the user's UUID)|
|`email`|User's email|
|`exp`|Expiry timestamp|
|`role`|`authenticated` (Supabase default)|

### 4.4 Registration Flow

```
1.  User submits { email, password, full_name }
2.  Backend calls Supabase Auth → signUp()
3.  Supabase creates auth.users row
4.  Database trigger fires → inserts row into public.profiles
5.  On login, backend checks project_invites for pending invites
    matching the user's email and surfaces them
```

---

## 5. Backend Architecture

### 5.1 Layer Overview

```
┌─────────────────────────────────────────────┐
│                  Express App                │
├─────────────────────────────────────────────┤
│  Routes Layer        /api/v1/...            │
│  (route definitions only, no logic)         │
├─────────────────────────────────────────────┤
│  Controller Layer                           │
│  (request parsing, response shaping)        │
├─────────────────────────────────────────────┤
│  Service Layer                              │
│  (all business logic, validation,           │
│   orchestration between DB calls)           │
├─────────────────────────────────────────────┤
│  Data Access Layer (Supabase Client)        │
│  (raw Supabase queries — no logic here)     │
├─────────────────────────────────────────────┤
│  Supabase PostgreSQL + Storage              │
└─────────────────────────────────────────────┘
```

### 5.2 Request Lifecycle

```
Incoming Request
  → CORS middleware
  → Rate limiter
  → JSON body parser
  → authenticate middleware  (verifies JWT, attaches req.user)
  → isMember middleware      (verifies user belongs to the project — on all project-scoped routes)
  → isOwner middleware       (verifies owner role — on destructive/management routes)
  → Controller
  → Service
  → Supabase query
  → Response
```

### 5.3 Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # used server-side only — never exposed to frontend
SUPABASE_ANON_KEY=
JWT_SECRET=                    # matches Supabase JWT secret
PORT=4000
NODE_ENV=production
```

---

## 6. Middleware

### `authenticate`

Validates the `Authorization: Bearer <token>` header on every protected route. Decodes the JWT, verifies it against Supabase's JWKS, and attaches `req.user = { id, email }`. Returns `401` if token is missing, malformed, or expired.

### `isMember`

Applied to all routes that are scoped to a project (i.e. any route with `:projectId`). Queries `project_members` to confirm `req.user.id` has a row for the given `projectId`. Returns `403` if not found. This is the primary access gate — **no project data is ever returned to a non-member**.

### `isOwner`

Applied on top of `isMember` for routes that modify the project structure (creating/deleting topics, removing members, etc.). Checks that the member's `role` is `'owner'`. Returns `403` for members who are not owners.

### `uploadMiddleware`

Multer configuration that accepts `multipart/form-data`. Validates file MIME type (`pdf`, `jpeg`, `png`) and rejects files over 10 MB before the file is streamed to Supabase Storage.

---

## 7. API Routes — Full Reference

> All routes are prefixed with `/api/v1`  
> 🔒 = requires `authenticate` middleware  
> 👑 = requires `isOwner` middleware (also implies 🔒 + isMember)  
> 👥 = requires `isMember` middleware (also implies 🔒)

---

### 7.1 Auth Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/auth/register`|Register with email + password + full_name|
|`POST`|`/auth/login`|Login — returns JWT access token + sets refresh cookie|
|`POST`|`/auth/logout`|🔒 Invalidates session, clears refresh cookie|
|`POST`|`/auth/refresh`|Uses HttpOnly refresh cookie to issue new access token|

---

### 7.2 User Routes

|Method|Endpoint|Description|
|---|---|---|
|`GET`|`/users/me`|🔒 Get own profile|
|`PATCH`|`/users/me`|🔒 Update full_name or avatar_url|
|`GET`|`/users/me/invites`|🔒 List all pending invites for the logged-in user's email|

> When a user logs in, the frontend should call `GET /users/me/invites` immediately to surface any pending project invitations.

---

### 7.3 Project Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/projects`|🔒 Create a new project. Creator is auto-added to project_members as owner|
|`GET`|`/projects`|🔒 List all projects the logged-in user is a member of|
|`GET`|`/projects/:projectId`|👥 Get project details (title, description, owner)|
|`PATCH`|`/projects/:projectId`|👑 Update project title or description|
|`DELETE`|`/projects/:projectId`|👑 Delete project and all cascade data|
|`GET`|`/projects/:projectId/members`|👥 List all members of a project (name, role, joined_at)|
|`DELETE`|`/projects/:projectId/members/:userId`|👑 Remove a member from the project|

---

### 7.4 Invite Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/projects/:projectId/invites`|👑 Invite a user by email to the project|
|`GET`|`/projects/:projectId/invites`|👑 List all invites for a project (pending, accepted, declined)|
|`DELETE`|`/projects/:projectId/invites/:inviteId`|👑 Cancel a pending invite|
|`POST`|`/invites/:inviteId/accept`|🔒 Accept an invite — creates project_members row|
|`POST`|`/invites/:inviteId/decline`|🔒 Decline an invite|

> **Invite ownership check:** On `accept`/`decline`, the backend verifies that the logged-in user's email matches `project_invites.invited_email`. A user cannot accept an invite meant for someone else.

---

### 7.5 Topic Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/projects/:projectId/topics`|👑 Create a new topic in the syllabus|
|`GET`|`/projects/:projectId/topics`|👥 Get full ordered topic list (with subtopics nested)|
|`PATCH`|`/projects/:projectId/topics/:topicId`|👑 Rename a topic or update order_index|
|`DELETE`|`/projects/:projectId/topics/:topicId`|👑 Delete topic and all its subtopics (cascades progress)|
|`PATCH`|`/projects/:projectId/topics/reorder`|👑 Bulk reorder topics by passing new order_index values|

---

### 7.6 Subtopic Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/projects/:projectId/topics/:topicId/subtopics`|👑 Add a subtopic under a topic|
|`PATCH`|`/projects/:projectId/topics/:topicId/subtopics/:subtopicId`|👑 Rename subtopic or update order_index|
|`DELETE`|`/projects/:projectId/topics/:topicId/subtopics/:subtopicId`|👑 Delete a subtopic (cascades progress rows)|
|`PATCH`|`/projects/:projectId/topics/:topicId/subtopics/reorder`|👑 Bulk reorder subtopics|

---

### 7.7 Progress Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/projects/:projectId/subtopics/:subtopicId/complete`|👥 Mark a subtopic as completed by the logged-in user|
|`DELETE`|`/projects/:projectId/subtopics/:subtopicId/complete`|👥 Unmark a subtopic as completed (only if parent topic not yet fully completed + notes uploaded)|
|`GET`|`/projects/:projectId/progress`|👥 Get progress for ALL members across ALL subtopics in this project — the full matrix used to render the syllabus view|
|`GET`|`/projects/:projectId/progress/me`|👥 Get only the logged-in user's progress|
|`GET`|`/projects/:projectId/progress/:userId`|👥 Get a specific member's progress (any member can view any other member's progress)|

> **Progress matrix explained:** `GET /progress` returns a structure like:  
> `{ topics: [ { id, title, subtopics: [ { id, title, completions: { userId: { is_completed, completed_at } } } ] } ] }`  
> This single response powers the entire syllabus view — showing every subtopic with a column for each member's status side by side.

---

### 7.8 Topic Completion Routes

|Method|Endpoint|Description|
|---|---|---|
|`POST`|`/projects/:projectId/topics/:topicId/complete`|👥 Upload notes + lock topic as completed. Multipart form-data. Backend verifies all subtopics are done before accepting.|
|`GET`|`/projects/:projectId/topics/:topicId/completions`|👥 List all members who have completed this topic (with their notes signed URLs)|
|`GET`|`/projects/:projectId/topics/:topicId/completions/:userId/notes`|👥 Get a fresh signed URL for a specific member's uploaded notes|
|`GET`|`/projects/:projectId/completions/me`|👥 Get all topics the logged-in user has completed (with notes)|

> **The upload + complete is atomic:** The backend receives the file, streams it to Supabase Storage, and only if that succeeds does it insert the `topic_completions` row. If Storage upload fails, no completion is recorded.

---

### 7.9 Dashboard Routes

|Method|Endpoint|Description|
|---|---|---|
|`GET`|`/projects/:projectId/dashboard`|👥 Full comparative dashboard data for all members|
|`GET`|`/projects/:projectId/dashboard/summary`|👥 Lightweight summary — total topics, each member's completed count, who is leading|
|`GET`|`/projects/:projectId/dashboard/timeline`|👥 Time-series data — completions per day per user (used for progress-over-time chart)|

#### Dashboard Response Shape (`/dashboard`)

```json
{
  "project": { "id", "title", "total_topics", "total_subtopics" },
  "members": [
    {
      "user_id": "...",
      "full_name": "...",
      "subtopics_completed": 14,
      "subtopics_total": 32,
      "topics_completed": 3,
      "topics_total": 8,
      "completion_percentage": 43.75,
      "last_activity": "2024-01-15T10:30:00Z"
    }
  ],
  "leaderboard": [
    { "rank": 1, "user_id": "...", "full_name": "...", "completion_percentage": 68.75 }
  ],
  "timeline": {
    "userId1": [ { "date": "2024-01-10", "cumulative_subtopics": 4 } ],
    "userId2": [ { "date": "2024-01-11", "cumulative_subtopics": 2 } ]
  }
}
```

---

## 8. Access Control Logic

This is the most critical section of the backend. The access model is:

### Rule 1 — Project Invisibility

A project does not exist to a user unless they have a row in `project_members` for it. `GET /projects` only returns projects where the user is a member. Direct access via `GET /projects/:projectId` is gated by the `isMember` middleware — a 404 (not 403) is returned to avoid leaking that the project exists.

### Rule 2 — Member-Only Data

All of the following are completely invisible to non-members:

- Project details, title, description
- Topic and subtopic index (the syllabus)
- All members' progress data
- Uploaded study notes (signed URLs)
- Dashboard and analytics

### Rule 3 — Cross-Member Visibility

Once inside a project, all members can see **all other members' data**. This is intentional and core to the product — the progress of every member on every subtopic is visible to everyone. There is no private progress within a project.

### Rule 4 — Owner-Only Management

Only the `owner` role can:

- Edit or delete the project
- Add, edit, or delete topics and subtopics
- Invite or remove members
- Cancel invites

Members with role `'member'` can only track their own progress and view group data.

### Rule 5 — Self-Only Progress Writing

A user can only mark **their own** subtopics as complete. The backend uses `req.user.id` (from the verified JWT) — never a user ID passed in the request body — when writing to `subtopic_progress` or `topic_completions`. A user cannot complete a subtopic on behalf of someone else.

### Rule 6 — Upload Prerequisite Check

Before accepting a notes upload and creating a `topic_completions` row, the backend runs this check:

```
1. Fetch all subtopics under the topic
2. Fetch subtopic_progress rows WHERE user_id = req.user.id AND topic's subtopics
3. If count(completed) < count(total subtopics) → reject with 400
   "You must complete all subtopics before uploading notes"
4. If topic_completions row already exists for (topic_id, user_id) → reject with 409
   "Topic already completed"
5. All checks pass → accept upload → create topic_completions row
```

---

## 9. Key Business Logic Flows

### 9.1 Creating a Project and Syllabus

```
Owner POST /projects
  → project row created
  → project_members row created (role: owner)

Owner POST /projects/:id/topics  (repeat per topic)
  → topics row created with order_index

Owner POST /projects/:id/topics/:tid/subtopics  (repeat per subtopic)
  → subtopics row created with order_index
```

### 9.2 Inviting and Onboarding a Member

```
Owner POST /projects/:id/invites { email }
  → project_invites row created (status: pending)

Friend logs in → GET /users/me/invites
  → returns pending invites matching their email

Friend POST /invites/:inviteId/accept
  → backend verifies invite.invited_email === req.user.email
  → project_members row created (role: member)
  → invite status updated to 'accepted'
  → friend now has full access to the project
```

### 9.3 Marking a Subtopic Complete

```
Member POST /projects/:pid/subtopics/:sid/complete
  → isMember check passes
  → upsert subtopic_progress { is_completed: true, completed_at: now() }
  → response includes updated progress + whether all subtopics in parent topic are now done
     (frontend uses this hint to surface the "Upload Notes to complete topic" prompt)
```

### 9.4 Completing a Topic (Proof-Gated)

```
Member POST /projects/:pid/topics/:tid/complete  (multipart: file)
  → isMember check passes
  → validate MIME type + file size
  → check: are ALL subtopics under this topic completed by this user? → else 400
  → check: does topic_completions row already exist? → else 409
  → stream file to Supabase Storage at path: {project_id}/{topic_id}/{user_id}/{ts}_{name}
  → generate signed URL (7 days)
  → INSERT topic_completions { notes_url: storagePath, notes_type, uploaded_at }
  → return { success: true, signed_url }
```

### 9.5 Viewing the Syllabus with Group Progress

```
Member GET /projects/:pid/progress
  → fetch all topics + subtopics for project (ordered)
  → fetch all subtopic_progress rows for this project (all users)
  → fetch all topic_completions rows for this project (all users)
  → build progress matrix:
     for each subtopic → map { userId: { is_completed, completed_at } }
     for each topic     → map { userId: { is_completed, notes_url (signed) } }
  → return full nested structure
  
Frontend renders:
  - Subtopic row with a tick per member (green = done, grey = pending)
  - Topic row with a lock icon per member (unlocked when notes uploaded)
```

### 9.6 Populating the Dashboard

```
Member GET /projects/:pid/dashboard
  → fetch all project_members
  → fetch subtopic_progress WHERE project_id = pid
  → fetch topic_completions WHERE project_id = pid
  → compute per-member:
       subtopics_completed, topics_completed, completion_percentage, last_activity
  → sort members by completion_percentage → leaderboard
  → group subtopic completions by (user_id, date) → timeline series
  → return full dashboard payload
```

---

## 10. Error Handling

All errors follow a consistent shape:

```json
{
  "success": false,
  "error": {
    "code": "TOPIC_NOT_COMPLETE",
    "message": "You must complete all subtopics before uploading notes.",
    "status": 400
  }
}
```

|HTTP Status|When Used|
|---|---|
|`400`|Invalid input, business rule violation (e.g. subtopics not done)|
|`401`|Missing or expired JWT|
|`403`|Valid JWT but insufficient role (not a member / not an owner)|
|`404`|Resource not found — also returned for projects the user isn't a member of|
|`409`|Conflict — e.g. duplicate invite, topic already completed|
|`413`|File too large (over 10 MB)|
|`415`|Unsupported file type|
|`500`|Unexpected server error|

A global error handler in Express catches all thrown errors and formats them into this shape before responding.

---

## 11. Folder Structure

```
/src
  /config
    supabase.js          # Supabase client initialisation (service role)
    env.js               # Env var validation on startup

  /middleware
    authenticate.js      # JWT verification → req.user
    isMember.js          # project_members lookup → 403/404 guard
    isOwner.js           # role check → 403 guard
    uploadMiddleware.js  # Multer config, MIME + size validation
    errorHandler.js      # Global Express error handler

  /routes
    auth.routes.js
    user.routes.js
    project.routes.js
    invite.routes.js
    topic.routes.js
    subtopic.routes.js
    progress.routes.js
    completion.routes.js
    dashboard.routes.js

  /controllers
    auth.controller.js
    user.controller.js
    project.controller.js
    invite.controller.js
    topic.controller.js
    subtopic.controller.js
    progress.controller.js
    completion.controller.js
    dashboard.controller.js

  /services
    auth.service.js
    user.service.js
    project.service.js
    invite.service.js
    topic.service.js
    subtopic.service.js
    progress.service.js
    completion.service.js
    dashboard.service.js
    storage.service.js   # All Supabase Storage operations + signed URL generation

  /utils
    errors.js            # Custom error classes (AppError, NotFoundError, ForbiddenError…)
    validators.js        # Input validation helpers

  app.js                 # Express app setup, middleware registration
  server.js              # HTTP server, port binding
```

---

_End of Documentation — StudySync Backend v1.0_