# StudySync — User Profile & Dashboard Plan

> **Goal:** A new `/profile` page that shows the user's **personal** learning activity across all projects. Distinct from project dashboards — no duplicate metrics in different formats.

---

## 1. Current State vs. Profile

| Current | Profile (New) |
|---------|---------------|
| `/projects` — grid of projects | `/profile` — **my** activity across all projects |
| Project Dashboard — heatmap per project, leaderboard, stats | Personal heatmap, calendar, history — **user-centric** |
| Per-project view | Cross-project aggregated view |

**Rule:** Every profile feature must answer a different question than project dashboards. No "completion % as pie chart" and "completion % as bar chart."

---

## 2. Core Profile Features

### 2.1 Personal Activity Heatmap

**What:** Single heatmap (GitHub-style) showing **your** study days across **all** projects.

**Logic:**
- Green cell = you completed at least one subtopic OR uploaded notes for a topic on that day
- Intensity = count of completions (1 = light, 5+ = dark)
- Data: `subtopic_progress.completed_at` + `topic_completions.uploaded_at` for `user_id = me`
- Span: Last 26 weeks (configurable)

**Why unique:** Project dashboard heatmap is per-project and shows all members. This is **my** global activity.

---

### 2.2 Topics I've Covered — Chronological List

**What:** Scrollable list of every topic/subtopic you've completed, with project name and date. Newest first.

**Format:**
```
[DATE]  Arrays — Two Pointers          (DSA Project)
[DATE]  Closures — Scope Chain         (JavaScript Project)
[DATE]  SQL Basics — SELECT            (SQL Project)
```

**Data:**
- From `subtopic_progress` (completed_at, subtopic_id) → join subtopics, topics, projects
- From `topic_completions` (uploaded_at, topic_id) → join topics, projects
- Merge and sort by date desc

**Why unique:** No other view shows "my learning history" as a simple chronological feed. Project dashboard shows current state, not history.

---

### 2.3 Calendar Grid — Google Calendar Style

**What:** Month view. Each day cell shows the tasks you completed that day. Click a day → expand to see full list.

**Layout:**
- Month header (e.g. "March 2025")
- Grid: 7 columns (Sun–Sat), rows = weeks
- Cell content: Count badge + truncated task names, or "3 tasks" link
- Hover/click: Tooltip or drawer with full list

**Data:** Same as heatmap — `subtopic_progress` + `topic_completions` grouped by date.

**Why unique:** Heatmap shows intensity; calendar shows **what** you did on each day. Different use case: "What did I study on March 15?"

---

### 2.4 Current Streak (Header Widget)

**What:** "🔥 12-day streak" or "⚠ Complete today to keep your 6-day streak!"

**Logic:** Longest contiguous run of days with ≥1 completion ending today (or yesterday if today is empty).

**Why unique:** Motivational, single number. Not shown anywhere else.

---

## 3. Additional Unique Features (No Duplication)

### 3.1 Study Time Distribution (New Dimension)

**What:** "When do you study?" — Bar chart of completions by hour of day (0–23).

**Data:** Extract hour from `completed_at` / `uploaded_at`. Requires timestamp.

**Why unique:** Project dashboard has no "time of day" insight. Different dimension.

---

### 3.2 Project Mix — Where Your Time Goes

**What:** Simple breakdown: "This month: 60% DSA, 30% JS, 10% SQL" — based on subtopic count per project.

**Display:** Horizontal bar or minimal list. No pie chart if we already have completion stats elsewhere — keep it to project labels only.

**Why unique:** Answers "Am I neglecting one project?" — not visible in project view.

---

### 3.3 Learning Velocity Trend

**What:** Line chart: subtopics completed per week, last 12 weeks.

**Display:** Single line, x = week, y = count.

**Why unique:** "Am I slowing down?" — trend over time. Project dashboard shows current %, not velocity trend.

---

### 3.4 Next-Up Nudge

**What:** "You're 2 subtopics away from completing Binary Search in DSA" — the next logical topic to tackle in each project.

**Logic:** For each project, find first topic where user has incomplete subtopics. Show topic name + remaining count.

**Why unique:** Actionable. Project dashboard doesn't tell you "what to do next."

---

### 3.5 Freeze Token (From ideas.md)

**What:** "❄️ 1 freeze left this week" — days you can skip without breaking streak.

**Logic:** 1 freeze per week, consumed when user explicitly "freezes" a day.

**Why unique:** Streak protection. Not in project dashboard.

---

### 3.6 Achievement Badges

**What:** Badges like "First Blood", "Week Warrior", "DSA Survivor" (from ideas.md). Display as icons on profile.

**Why unique:** Gamification. Project dashboard has no badges.

---

### 3.7 Recent Activity Feed

**What:** "2h ago: Completed Sliding Window in DSA" — last 10 actions, timeline style.

**Why unique:** Real-time feel. Different from "topics covered" which is full history. This is recent only.

---

## 4. What We Are NOT Adding (Avoid Duplication)

| Skip | Reason |
|------|--------|
| Another leaderboard | Already in project dashboard |
| Completion % ring/chart | Already in project dashboard |
| Heatmap with different colors | Same data, different style |
| Head-to-head comparison | Project-specific |
| Contribution graph clone | Project has it; profile has personal one |

---

## 5. Profile Page Structure (Suggested Layout)

```
┌─────────────────────────────────────────────────────────┐
│  Profile                                    [Streak 🔥] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Personal Activity Heatmap — 26 weeks]                 │
│                                                         │
│  [Calendar Grid — current month]                        │
│                                                         │
│  Topics I've Covered                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Mar 18  Arrays — Two Pointers      (DSA)         │   │
│  │ Mar 17  Closures — Scope           (JS)          │   │
│  │ ...                                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Project Mix this month]   [Velocity trend]             │
│                                                         │
│  Next Up: Binary Search (DSA) — 3 subtopics left        │
│                                                         │
│  [Achievement badges]                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Backend Requirements

### 6.1 New Endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/users/me/profile` | GET | Heatmap data, topics list, streak, velocity, etc. |
| `/users/me/activity` | GET | Calendar data for month (query: ?year=2025&month=3) |

**Or:** Single `/users/me/profile` with query params for calendar month. Keeps it simple.

### 6.2 Data Queries

- `subtopic_progress` where `user_id = me`, `is_completed = true` — select `completed_at`, join `subtopics`, `topics`, `projects`
- `topic_completions` where `user_id = me` — select `uploaded_at`, join `topics`, `projects`
- Aggregate by date for heatmap
- Group by date for calendar
- Sort by date desc for topics list

### 6.3 Streak Calculation

- Backend computes: iterate from today backward, count consecutive days with ≥1 completion, stop at first gap.

---

## 7. Frontend Requirements

- New route: `/profile`
- Add link in header (Projects, Profile, Invitations)
- Profile page: lazy load like others
- Reuse heatmap component logic from project dashboard (different data source)
- New calendar grid component
- Skeleton loaders for all sections

---

## 8. Implementation Order

| Phase | Feature | Effort |
|-------|---------|--------|
| 1 | `/profile` route + basic layout | Low |
| 2 | Personal heatmap (reuse ContributionGraph with new API) | Low |
| 3 | Topics covered list | Low |
| 4 | Calendar grid | Medium |
| 5 | Streak in header | Low |
| 6 | Project mix + velocity trend | Medium |
| 7 | Next-up nudge | Low |
| 8 | Achievements, freeze, study-time (optional) | Medium |

---

## 9. Summary

The profile is **user-centric, cross-project, and history-focused**. Each feature answers a distinct question. No metric is repeated in a different chart format.
