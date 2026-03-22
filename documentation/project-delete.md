# StudySync — Delete Project Feature

> **Purpose:** Plan for implementing full project deletion: database records, storage files, and UI. Documentation only — no code edits.

---

## 1. Current State

### 1.1 Existing Backend

- **Route:** `DELETE /api/v1/projects/:projectId` (already defined in `project.routes.js`)
- **Middleware:** `authenticate` → `isMember` → `isOwner` — only the project owner can delete
- **Controller:** `project.controller.remove` → `project.service.remove`
- **Service:** `project.service.remove(projectId)` does a single DB call:
  ```javascript
  await supabase.from('projects').delete().eq('id', projectId);
  ```

### 1.2 What Is *Not* Deleted Today

| Resource | Status |
|----------|--------|
| **Supabase Storage** | ❌ Not touched. All files under `study-notes/{project_id}/...` remain forever |
| **Database** | ⚠️ Depends on FK CASCADE. If `project_members`, `project_invites`, `topic_completions`, `subtopic_progress` lack `ON DELETE CASCADE`, the delete may fail or leave orphans |

### 1.3 Data to Remove

| Table / Storage | Relationship | Notes |
|----------------|--------------|-------|
| `topic_completions` | `project_id`, `topic_id` | Proof-of-study records; `notes_url` points to storage |
| `subtopic_progress` | `project_id`, `subtopic_id` | Per-user subtopic completion |
| `project_invites` | `project_id` | Pending/accepted/declined invites |
| `project_members` | `project_id` | Membership records |
| `topics` | `project_id` | Syllabus topics (cascade to subtopics per schema) |
| `subtopics` | `topic_id` | Nested under topics |
| **Storage** | `study-notes/{project_id}/**` | All uploaded notes (PDFs, images) |

---

## 2. Storage Layout

```
study-notes/
  {project_id}/
    {topic_id}/
      {user_id}/
        1704067200000_scope_notes.pdf
        1704067300000_diagram.jpg
```

- **Prefix:** `{project_id}/` — all project files live under this path
- **RLS:** Current policy allows users to delete only their own notes (`(storage.foldername(name))[3]` = user_id). Backend uses **service role** key → bypasses RLS → can delete any path

---

## 3. Deletion Strategy

### 3.1 Order of Operations

To avoid FK violations and ensure consistency:

```
1. Storage  — Delete all files under study-notes/{project_id}/
2. Database — Delete in dependency order (children before parents):
   a. subtopic_progress  (references project_id, subtopic_id)
   b. topic_completions  (references project_id, topic_id)
   c. project_invites    (references project_id)
   d. project_members    (references project_id)
   e. topics            (references project_id; may CASCADE to subtopics)
   f. projects          (root row)
```

**Why storage first?**  
- Frees space immediately  
- If DB delete fails, we can retry; orphaned files are worse than orphaned DB rows (harder to find and clean)

**Why this DB order?**  
- `subtopic_progress` and `topic_completions` reference both project and topic/subtopic  
- `project_invites` and `project_members` reference project only  
- `topics` references project; `subtopics` references topics  
- If the schema has `ON DELETE CASCADE` on `topics` → `subtopics`, deleting topics will remove subtopics. `subtopic_progress` and `topic_completions` must be deleted first because they reference subtopics/topics.

### 3.2 Storage Deletion Algorithm

Supabase Storage has no native "delete folder" — we must list and remove objects.

**Option A — Recursive list + batch remove (recommended):**

```
1. paths = []
2. list(project_id)  → get items (topic folders)
3. For each topic_folder:
     list(project_id/topic_id)  → get user folders
     For each user_folder:
       list(project_id/topic_id/user_id)  → get files
       For each file: paths.push(project_id/topic_id/user_id/file.name)
4. For paths in batches of 1000: remove(batch)
```

- **Limit:** `remove()` accepts max 1000 paths per call  
- **Latency:** Each `list()` is one HTTP call. For 50 topics × 5 users × 2 files = 500 files → ~52 list calls + 1 remove. Can be parallelized for topic-level listing.

**Option B — Single list with prefix (if available):**

- Newer Supabase clients may support `listV2({ prefix: project_id + '/' })` to fetch all objects under a prefix in one (paginated) call  
- Reduces list calls; still need to batch `remove()` in chunks of 1000

### 3.3 Database Deletion

**Explicit order (safe regardless of CASCADE):**

```javascript
// 1. subtopic_progress
await supabase.from('subtopic_progress').delete().eq('project_id', projectId);

// 2. topic_completions
await supabase.from('topic_completions').delete().eq('project_id', projectId);

// 3. project_invites
await supabase.from('project_invites').delete().eq('project_id', projectId);

// 4. project_members
await supabase.from('project_members').delete().eq('project_id', projectId);

// 5. topics (cascades to subtopics if schema has it)
await supabase.from('topics').delete().eq('project_id', projectId);

// 6. projects
await supabase.from('projects').delete().eq('id', projectId);
```

**Alternative:** If all FKs have `ON DELETE CASCADE` from `projects`, a single `DELETE FROM projects WHERE id = ?` might suffice. **Verify schema first** — explicit deletes are safer and make the flow clear.

---

## 4. Speed Optimizations

### 4.1 Storage

| Technique | Impact |
|-----------|--------|
| **Parallel list calls** | List topic folders in parallel; within each topic, list user folders in parallel. Reduces wall-clock time. |
| **Batch remove** | Always pass up to 1000 paths per `remove()` call. |
| **Fire-and-forget storage** | Optionally: delete storage in background *after* responding 200. Risk: if backend crashes, files may remain. Prefer synchronous for consistency. |
| **Skip list if no completions** | If `topic_completions` count for project is 0, skip storage deletion entirely. |

### 4.2 Database

| Technique | Impact |
|-----------|--------|
| **Single transaction** | Wrap all DB deletes in a transaction. Rollback on any failure. |
| **Parallel deletes** | `subtopic_progress`, `topic_completions`, `project_invites`, `project_members` have no FK between them → can run in parallel with `Promise.all`. Then delete `topics` (and `subtopics` if not cascaded), then `projects`. |
| **Raw SQL** | One `DELETE FROM ... WHERE project_id = $1` per table can be faster than Supabase client round-trips. |

### 4.3 Target Latency

| Project Size | Target |
|--------------|--------|
| Small (5 topics, 20 subtopics, 2 members, 3 notes) | < 1 s |
| Medium (30 topics, 150 subtopics, 5 members, 25 notes) | < 3 s |
| Large (100 topics, 500 subtopics, 10 members, 80 notes) | < 8 s |

Bottleneck is usually storage: many `list()` calls. Parallelization and batching are key.

---

## 5. Frontend Integration

### 5.1 Where to Place the Delete Button

| Location | Pros | Cons |
|----------|------|------|
| **ProjectDetail** (Members tab or header) | User is in context of the project | Needs confirmation modal |
| **ProjectDetail** (new Settings/Danger zone) | Clear separation of destructive actions | Extra UI |
| **Projects** (project card, owner only) | Quick access from list | Easy to misclick; must prevent navigation during delete |

**Recommendation:** ProjectDetail page, in the **Members** tab (owner-only section) or a small **Settings** / **Danger zone** at the bottom. Avoid putting it on the project card to reduce accidental clicks.

### 5.2 UX Flow

1. Owner clicks "Delete Project"
2. **Confirmation modal:** "Delete [Project Title]? This will permanently remove the project, all topics, subtopics, members, invites, and uploaded notes. This cannot be undone."
3. User confirms → `api.delete(\`/projects/${projectId}\`)`
4. **Loading state:** Disable button, show "Deleting project…" or spinner
5. On success: `navigate('/projects')`, optionally show toast "Project deleted"
6. On error: Show error message, re-enable button

### 5.3 API Usage

```javascript
// Existing endpoint — no change needed if backend is updated
await api.delete(`/projects/${projectId}`);
// 200 → success
// 403 → not owner
// 404 → project not found or not a member
```

---

## 6. Implementation Checklist

### Backend

- [ ] Add `deleteProjectStorage(projectId)` in `storage.service.js` — recursive list + batch remove
- [ ] Update `project.service.remove(projectId)` to:
  1. Call `deleteProjectStorage(projectId)` (or run in parallel with DB — see consistency note)
  2. Delete DB rows in the order: `subtopic_progress` → `topic_completions` → `project_invites` → `project_members` → `topics` → `projects`
  3. Use transaction if Supabase client supports it
- [ ] Ensure `remove` returns only after both storage and DB are done (or document if fire-and-forget is chosen)
- [ ] Add error handling: if storage fails, optionally still proceed with DB delete (orphaned files) or abort entirely (recommended: abort for consistency)

### Frontend

- [ ] Add "Delete Project" button (owner-only) in ProjectDetail — e.g. Members tab or Danger zone
- [ ] Add confirmation modal with project title and warning text
- [ ] Call `api.delete(\`/projects/${projectId}\`)` on confirm
- [ ] Loading state during request
- [ ] On success: `navigate('/projects')`, toast
- [ ] On error: display message, re-enable

### Database

- [ ] Verify FK constraints and CASCADE behavior in Supabase (optional — explicit deletes work regardless)

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| **Project has no notes** | Skip storage deletion; only DB deletes. Fast. |
| **Storage list returns empty** | Proceed with DB delete. No-op for storage. |
| **Storage delete fails mid-way** | Options: (a) retry, (b) abort and return error, (c) continue DB delete and log orphaned paths for manual cleanup. Recommend (b). |
| **DB delete fails** | Rollback if in transaction. Return 500. Storage may have been deleted — consider reversing order (DB first, then storage) if that's preferred. |
| **User navigates away during delete** | Request continues. On success, project is gone. If user returns to project URL, 404. |
| **Concurrent delete + other operations** | Use DB transaction. Storage has no transaction — last write wins. |

---

## 8. Summary

| Step | Action | Speed Tip |
|------|--------|-----------|
| 1 | List all storage paths under `study-notes/{project_id}/` | Parallel list at topic level |
| 2 | Remove storage objects in batches of 1000 | Single `remove()` per batch |
| 3 | Delete `subtopic_progress`, `topic_completions`, `project_invites`, `project_members` | Run in parallel with `Promise.all` |
| 4 | Delete `topics` (cascades `subtopics`) | Sequential after step 3 |
| 5 | Delete `projects` | Final step |
| 6 | Return 200 | — |

**Root cause of current behavior:** `project.service.remove` only deletes the `projects` row. Storage is never touched, and DB CASCADE may or may not clean up child tables. This plan makes deletion explicit, complete, and fast.
