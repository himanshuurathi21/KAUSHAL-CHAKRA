# Feature Add Prompt: KaushalChakra — Ratings, Chat, Completion, Notifications, Proficiency, Admin Analytics

Copy everything below this line and paste it into OpenCode.

---

## Context

Existing codebase: Express + Prisma + PostgreSQL backend (`backend/`), React frontend (`frontend/`). Existing models: `User`, `Skill`, `UserOfferedSkill`, `UserWantedSkill`, `MatchCycle`, `MatchCycleParticipant`, `BlockedEdge` (see `backend/prisma/schema.prisma`). Matching logic lives in `backend/src/services/matchingEngine.js` (pure cycle-detection algorithm — do not change its core logic in this task) and `backend/src/services/matchingService.js` (DB-facing wrapper). Follow the existing route → controller → service → Prisma pattern for everything below.

Build the phases below **in order**. After each phase, run `npm test` in `backend/`, add tests for what you built, and confirm it works manually before starting the next phase.

## Phase 1 (do first — these four are the priority)

### 1a. Session-completion confirmation
- Add a nullable `completedAt` (DateTime) field on `MatchCycleParticipant`, set when that specific user confirms their side of the exchange is done.
- Add `'completed'` to the `MatchCycle.status` enum (alongside the existing `proposed` / `confirmed` / `rejected`).
- When every participant in a cycle has a non-null `completedAt`, update the parent `MatchCycle.status` to `'completed'`.
- New endpoint: `POST /api/cycles/:id/complete` (auth required) — marks the calling user's participant row complete, flips the cycle status once everyone is done.
- Frontend: on "My Exchanges", show a "Mark session complete" button for confirmed cycles; reflect "Completed" once both sides confirm.

### 1b. Rating/review system
- New Prisma model `Rating`: `id`, `cycleId` (→ MatchCycle), `raterId` (→ User), `rateeId` (→ User), `score` (Int, 1–5), `comment` (String, optional), `createdAt`.
- Only allow creating a rating if `MatchCycle.status === 'completed'` and both users were participants in that cycle.
- New endpoints: `POST /api/ratings` (body: `cycleId`, `rateeId`, `score`, `comment`), `GET /api/users/:id/ratings` (returns average score + recent ratings).
- Frontend: once a cycle shows "Completed", prompt the user to rate the person(s) they exchanged with. Show a small average-rating badge next to a user's name wherever it appears.

### 1c. In-app chat (scoped to a confirmed cycle)
- New Prisma model `Message`: `id`, `cycleId` (→ MatchCycle), `senderId` (→ User), `content` (String), `createdAt`.
- Only allow sending/reading if the calling user is a participant in that cycle and its status is `'confirmed'` or `'completed'`.
- New endpoints: `POST /api/cycles/:id/messages` (send), `GET /api/cycles/:id/messages` (list, oldest to newest).
- Frontend: a simple chat panel on the Match Review page. Poll every 5 seconds — do not build WebSockets for this, it's out of scope for the MVP.

### 1d. Notifications
- New Prisma model `Notification`: `id`, `userId` (→ User), `type` (String: `match_found` | `match_accepted` | `match_rejected` | `session_completed` | `new_message`), `content` (String), `read` (Boolean, default false), `createdAt`.
- Create a notification row at each of these existing points: when a cycle is proposed (`matchingService.js`), when a participant accepts/rejects (`matchController.js`), when a cycle completes (1a), when a message arrives (1c).
- New endpoints: `GET /api/notifications` (mine, newest first), `POST /api/notifications/:id/read`.
- Frontend: a bell icon in the nav with an unread-count badge and a dropdown list. Poll every 15–30 seconds — no push notifications needed.

## Phase 2 (only after Phase 1 is fully working)

### 2a. Skill proficiency levels
- Add a `level` enum (`BEGINNER` | `INTERMEDIATE` | `EXPERT`) to both `UserOfferedSkill` and `UserWantedSkill`.
- Do **not** turn this into a hard filter in `matchingEngine.js` — that would reduce how many matches are found. Instead, use it as a **tie-breaker** inside `matchUsers()` in `matchingService.js`: when choosing between multiple valid, non-overlapping cycles, prefer ones where each offered level is >= the corresponding wanted level.
- Frontend: a level dropdown next to each skill in profile setup; show levels in the match-review cycle chain (e.g. "Learn Python (Intermediate) from Simran").

### 2b. Admin analytics dashboard
- Add `isAdmin` (Boolean, default false) to `User`; manually flip one seed user to `true`.
- Add a `requireAdmin` middleware next to the existing `requireAuth` in `backend/src/middleware/auth.js`.
- New endpoint: `GET /api/admin/stats` (admin only) — return total users, total confirmed cycles, a breakdown of confirmed cycles by size (2-way / 3-way / 4-way / 5-way), and this comparison: re-run the matching engine on the current graph with `maxLength` forced to `2`, and report what percentage of currently-matched users would NOT have matched under a direct-swap-only system. This comparison number is the most important thing on this dashboard — it's the core proof that the cyclic algorithm adds value.
- Frontend: an `/admin` page (only rendered if `user.isAdmin`) with a bar chart (add the `recharts` package) showing the cycle-size breakdown, and the 1-to-1-vs-cyclic comparison number shown prominently.

## Phase 3 (optional — only if Phases 1 and 2 are done and time remains)
- Credit/token fallback: if a user stays unmatched past N days, let them teach now and redeem a credit later instead of waiting for a cycle. This needs a new `Credit` ledger model and a redemption flow — bigger scope, attempt only if everything above is solid.

## After every phase
Run `npm test` in `backend/`, make sure it passes, and give me a short summary of every file you changed and why.
