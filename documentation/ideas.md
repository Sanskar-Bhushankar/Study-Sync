# StudySync — Feature Ideas

> **Context:** Two friends primarily studying **DSA, JavaScript, and SQL**. Recurring problem: DSA gets abandoned after arrays every time. JS and SQL were done before but forgotten. Goal: make daily study a habit, maintain streaks, and retain knowledge long-term.

---

## 1. The Core Problem to Solve

| Problem | Root Cause |
|---------|------------|
| DSA gets dropped after arrays | No accountability, no milestone rewards, no "what's next" nudge |
| JS & SQL forgotten | No spaced repetition, no practice problems tied to what was studied |
| No daily habit | No streak system with real consequence for breaking it |
| Studying alone feels optional | No competitive or cooperative pressure |

Every idea below targets one or more of these root causes.

---

## 2. Streak & Habit System

### 2.1 Daily Study Streak (Current + Enhanced)
- **Current state:** Activity heatmap exists in the dashboard tab.
- **Enhancement:** Show a prominent streak counter on the Projects page header ("🔥 14-day streak!"). If today has no subtopic completion, show a warning banner: "⚠ Complete at least one subtopic today to keep your streak."
- **Freeze token:** Give each user 1 "freeze" per week — a day they can skip without breaking their streak. Shown as a ❄️ badge.

### 2.2 Streak Leaderboard
- Already have a leaderboard for completion %. Add a second leaderboard column: "Current streak (days)".
- Show head-to-head streak comparison between you and your friend.

### 2.3 Weekly Goal Setting
- Every Monday, each member sets a goal: "I will complete X subtopics this week."
- End-of-week summary email/notification: "You hit 8/10. Your friend hit 10/10 — they win this week."

---

## 3. LeetCode Integration

### 3.1 LeetCode Daily Problem Widget
- **What:** Show today's LeetCode daily challenge on the Projects page or a dedicated "Practice" tab.
- **How:** LeetCode has an unofficial GraphQL API (`https://leetcode.com/graphql`) — fetch the daily challenge query. No auth needed for the daily problem.
- **Display:** Problem title, difficulty badge (Easy/Medium/Hard), tags, link to LeetCode. Refresh every 24h.
- **Backend endpoint:** `GET /practice/leetcode/daily` — proxied through your backend to avoid CORS and cache the response for 24h.

### 3.2 LeetCode Profile Stats
- **What:** Show each member's LeetCode stats on their profile — total solved, easy/medium/hard breakdown, acceptance rate, current streak.
- **How:** LeetCode GraphQL `userPublicProfile` query — takes a username, returns public stats. No auth needed.
- **Where to store:** Add `leetcode_username` field to `profiles` table. User sets it once in their profile settings.
- **Display:** Stats card in the Members tab of each project — shows who's been grinding.

### 3.3 Topic-Linked LeetCode Problems
- **What:** When a topic is marked complete (e.g. "Binary Search"), automatically surface 3–5 relevant LeetCode problems tagged with that concept.
- **How:** Use LeetCode's `problemsetQuestionList` GraphQL query filtered by tags. Map topic titles to LeetCode tags (e.g. "Binary Search" → `binary-search`, "Arrays" → `array`).
- **Display:** After completing a topic, a "Practice Now" panel appears with linked problems.

---

## 4. AI-Generated Practice Problems

### 4.1 Topic Completion → Auto-Generated Problems
- **Trigger:** User completes a topic (all subtopics done + notes uploaded).
- **What happens:** Backend calls an AI (e.g. OpenAI `gpt-4o-mini`, cheap) with a prompt like:
  ```
  The student just completed the topic "Sliding Window" in DSA.
  Generate 3 practice problems (1 easy, 1 medium, 1 hard) with:
  - A clear problem statement
  - Example input/output
  - A hint (no solution)
  Format as JSON.
  ```
- **Storage:** Save generated problems to a `generated_problems` table linked to `topic_id + user_id`.
- **Display:** "Practice Problems" section appears at the bottom of a completed topic in the Syllabus tab.

### 4.2 AI Flashcard Generator
- **What:** For any completed topic, generate 5 Q&A flashcards for spaced repetition.
- **Example for "Closures" in JS:**
  - Q: "What is a closure in JavaScript?"
  - A: "A closure is a function that retains access to variables from its outer (enclosing) scope even after that scope has finished executing."
- **UI:** Flip-card UI. User taps to reveal answer, marks "Got it" or "Review again". Schedule reviews using a simple SM-2-like interval (1 day → 3 days → 7 days → 21 days).

### 4.3 Forgetting Curve Alerts
- **What:** If a topic was completed more than N days ago with no review activity, show a "You might be forgetting this 🧠" alert.
- **Thresholds:** 7 days → yellow, 21 days → orange, 60 days → red.
- **Action:** One click to open the AI flashcards for that topic.

---

## 5. Scraped / Aggregated Problems

### 5.1 HackerRank Problem Feed
- **What:** HackerRank has public problem listings by domain (Data Structures, Algorithms, SQL, JavaScript). Scrape or use their public API to pull problems tagged to the current topic.
- **How:** HackerRank's problem list is publicly accessible. Filter by domain and difficulty.
- **Display:** "Similar problems on HackerRank" links in the topic detail view.

### 5.2 SQL Practice Integration
- **Since you study SQL:** Integrate [SQLZoo](https://sqlzoo.net) or [Mode SQL Tutorial](https://mode.com/sql-tutorial/) links, or pull problems from the [PgExercises API](https://pgexercises.com/questions/basic/).
- **Simpler option:** Curate a static JSON of hand-picked SQL problems by topic (SELECT basics, JOINs, Aggregates, Window Functions) — no scraping needed, no breakage risk.

### 5.3 JavaScript Problem Feed
- **Source:** [Exercism.io](https://exercism.org/tracks/javascript) has a public API for JS exercises. Pull exercises tagged with the current subtopic.
- **Source 2:** [JavaScript30](https://javascript30.com/) — 30 curated JS projects. Map each StudySync topic to a relevant JavaScript30 project.

---

## 6. "Don't Drop DSA Again" Features

### 6.1 DSA Roadmap Mode
- A **preset syllabus template** for DSA — pre-built list of topics in the correct order:
  ```
  Arrays → Strings → Hashing → Two Pointers → Sliding Window →
  Stack → Queue → Linked List → Binary Search → Recursion →
  Backtracking → Trees → BST → Heaps → Graphs → DP → ...
  ```
- One click to import this roadmap as a project syllabus.
- Each topic has a suggested LeetCode problem list attached automatically.

### 6.2 Milestone Locks
- **Concept:** You cannot mark "Linked List" topics as complete until "Arrays" and "Strings" are done. Enforces the learning order.
- **UI:** Locked topics show a 🔒 badge. Unlocked automatically when prerequisites are complete.

### 6.3 "Abandon Guard"
- If neither user has completed a subtopic in the last 5 days, send a push notification or in-app alert: "You haven't touched DSA in 5 days. Don't drop it again — do one subtopic today."
- Backend: a daily cron job checks `subtopic_progress.completed_at` timestamps.

### 6.4 Weekly DSA Boss Challenge
- Every Sunday, an auto-generated "boss" problem appears based on the last week's topics — a harder combined problem.
- Both users attempt it and submit their solutions (link to their GitHub Gist or paste code in-app).
- The other person reviews it.

---

## 7. Knowledge Retention (Spaced Repetition)

### 7.1 Review Queue
- A dedicated "Review" page shows topics that are due for review based on when they were completed:
  - Completed today → review in 1 day
  - Reviewed once → review in 3 days
  - Reviewed twice → review in 7 days
  - And so on (SM-2 algorithm)
- Each review = answer 3 AI flashcards for that topic.

### 7.2 Weekly Knowledge Test
- Every week, pick 5 random completed subtopics and generate a 5-question quiz (MCQ or fill-in-the-blank, AI-generated).
- Score out of 5. If < 3, those subtopics go back on the "needs review" list.

---

## 8. Collaboration & Gamification

### 8.1 Study Rooms (Real-time)
- A "study room" is a shared timer (Pomodoro 25/5) where both users are online at the same time.
- While the timer runs, you each pick a subtopic to focus on.
- When the timer ends, both mark their subtopic — you get bonus streak credit for pair sessions.
- **Tech:** WebSockets (Socket.io) or Supabase Realtime.

### 8.2 Achievement Badges
| Badge | Condition |
|-------|-----------|
| 🎯 First Blood | Complete your first subtopic |
| 🔥 Week Warrior | 7-day streak |
| 📚 DSA Survivor | Complete Arrays through Recursion without dropping |
| 🧠 Never Forgot | Complete a 30-day spaced review cycle |
| ⚔️ Boss Slayer | Complete a weekly boss challenge |
| 🏆 Top of the Leaderboard | #1 completion % for 2 weeks straight |

### 8.3 Challenge Mode
- Either user can "challenge" the other on a specific topic: "I bet you can't finish Graphs before me."
- Whoever completes the topic's subtopics first wins the challenge. Shows on the dashboard with a countdown.

---

## 9. Notification System

### 9.1 Daily Reminder
- A simple daily notification (browser push or email) at a chosen time: "📖 Time to study. You're on a 6-day streak — don't break it!"
- **Backend:** Use a cron job + web push (via `web-push` npm package) or a transactional email service (Resend, SendGrid free tier).

### 9.2 Streak Break Warning
- 30 minutes before midnight if no activity today: "⚠ Your 14-day streak ends in 30 minutes."

### 9.3 Friend Activity Notifications
- "Your friend just completed Binary Search Trees 🎉 — you're falling behind!"

---

## 10. Quick Wins (Low Effort, High Value)

| Feature | Effort | Value |
|---------|--------|-------|
| **DSA preset syllabus template** | Low (JSON import) | High — solves the "where to start" problem |
| **LeetCode daily problem on Projects page** | Medium (proxy API) | High — daily touchpoint |
| **Forgetting curve alerts on completed topics** | Low (timestamp math) | High — solves forgetting JS/SQL |
| **Streak counter in header** | Low (UI only) | Medium — constant visibility |
| **Review queue page** | Medium | High — core retention tool |
| **AI flashcard generator on topic complete** | Medium (OpenAI API) | High — instant practice |
| **HackerRank / Exercism links per topic** | Low (static map) | Medium — easy practice bridge |

---

## 11. Implementation Priority

### Phase 1 — Habit & Retention (Do first)
1. Prominent streak counter + "complete today" warning on Projects page
2. LeetCode daily problem widget (proxy endpoint + frontend card)
3. Forgetting curve alerts (7/21/60 days since last completion)
4. DSA preset roadmap template as one-click import

### Phase 2 — Practice Integration (Do second)
5. LeetCode profile stats in Members tab
6. Topic-linked LeetCode problems (after topic completion)
7. AI flashcard generator (OpenAI gpt-4o-mini, very cheap ~$0.001/set)
8. Review queue page with SM-2 scheduling

### Phase 3 — Gamification (Do third)
9. Milestone locks for DSA topics
10. Achievement badges
11. Weekly boss challenge
12. Study rooms (Pomodoro + real-time)

---

*Document version: 1.0*
