# Kaushal Chakra — Features List

> **Trade skills, not money.** Skill bartering + Task bartering + Credits.  
> Stack: **Express + Prisma + PostgreSQL** (Neon) + **React + Vite + Tailwind** + JWT httpOnly `kc_session`.

---

## 1. Authentication & Onboarding
- **Signup/Login/Logout** — `POST /api/auth/signup` (strict `consent===true` DPDP Act), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Password 6–72, bcrypt 10, JWT 7d `httpOnly Lax`.
- **Login UI** — 60% branding (`Learn what you want. Teach what you know.`) + 40% card (`Welcome back / Create account`), toggle, CAPTCHA (login only, `a+b`), password show/hide eye, consent checkbox → Privacy.
- **Welcome Credits** — `+20` on first signup (`creditRewardService.rewardWelcome` idempotent).
- **Demo accounts** (pwd `password123`): `aarav@demo.com` (3-cycle), `priya@demo.com` (admin), `kunal/meera` (2-cycle), `ishaan` (waiting), `vihaan/riya` (credit partners).

## 2. Profile & Skills
- **Fixed taxonomy** — 36 skills (`GET /api/skills`), no free-text. `PUT /api/profile/skills` replaces `offered[]` + `wanted[]` + `availabilitySlots[6]` (`WEEKDAY_MORNING…WEEKEND_EVENING`) atomically + triggers `runMatching`.
- **Levels** — `BEGINNER | INTERMEDIATE | EXPERT` per skill, tie-breaker in matching (`LEVEL_RANK`). UI: `SkillPicker` chips + `LevelEditor` with `✓` verified badge.
- **Availability** — tie-breaker only (never excludes cycle), badge `✓ Compatible availability` in `CycleChain` when neighbours share slot.
- **SetupSkills page** — `SetupSkills.jsx` + verification hint, prefill from profile.

## 3. Skill Swap — Cyclic Matching Engine (core)
- **Pure engine** `backend/src/services/matchingEngine.js` — `buildGraph` → `findCycles` bounded DFS `min2 max5` → `matchUsers` greedy shortest → levelScore → availabilityScore → id.
- **DB wrapper** `matchingService.js` — `pg_advisory_xact_lock(727271)` serialized, `skipUserIds` (proposed/confirmed), `recentlyCompleted 24h` dedup, `participantsFromCycle` (teaches/learns), `createCycleFromEngine` → `match_found` notify.
- **Lifecycle** `MatchCycle.status` `proposed → confirmed → completed | rejected`:
  - `POST /api/match/run` (10/min) manual
  - `GET /api/match/status` → `no-profile | waiting | proposed | confirmed | completed` + `myParticipant`
  - `GET /api/match/cycle/:id` (participant only, `enrichCycle` hides email while `proposed`)
  - `POST /api/match/cycle/:id/accept` idempotent → all true → `confirmed` (emails revealed) + `match_accepted`
  - `POST /api/match/cycle/:id/reject` → `BlockedEdge` upsert → `rejected` + `match_rejected` + `runMatching`
  - `POST /api/cycles/:id/complete` per-user `completedAt` → all → atomic `updateMany confirmed→completed` + `session_completed` + `runMatching`
- **Constraints** — 1 active cycle/user, blocked edges never re-proposed, no instant duplicate (24h), deterministic sort.

## 4. Task Board (one-way help)
- **Model** `Task{posterId, title, description, category[Design…Other], creditValue>0, requiredSkillId?, deliverable?, complexity S/M/L, deadline?, status OPEN|IN_PROGRESS|COMPLETED|CANCELLED}`.
- **API** `POST /api/tasks` (frozen/active guard), `GET /api/tasks?category` (OPEN 50), `POST /api/tasks/:id/claim` atomic `OPEN→IN_PROGRESS` + `CreditSession type=TASK` (helper=teacher, poster=learner) after checks `!own, !busy (cycle/open session), poster balance≥creditValue` → notify poster.
- **Credit move** on `POST /credits/sessions/:id/complete` two-sided `teacherDoneAt|learnerDoneAt` → `task.creditValue` moves `poster -amount → helper +amount` + `task COMPLETED` (insufficient → revert `active` + 400).
- **UI** `Tasks.jsx` — tabs `Browse | My Swaps | Post`, post form, filter, `Claim` + `Request Swap` per row, `ReportButton`.

## 5. Task Swap — Pairwise Deliverable Barter (Phase 1)
- **Model** `TaskSwap{requesterId, helperId?, requestedTaskId, offeredTaskId?, status requested→accepted→in_progress→submitted→completed|rejected|cancelled, deliverableLinks, submittedAt/approvedAt, completedAt}` + `Message.taskSwapId`.
- **Flow** `POST /api/task-swaps {requestedTaskId, offeredTaskId}` → `requested` (duplicate pending block) → `POST /:id/accept|reject` (helper only) → `in_progress` (tasks `IN_PROGRESS`) → `POST /:id/submit {link|note}` (each side) → `submitted` → `POST /:id/approve` (each approves other’s deliverable) → both approved → `completed` (tasks `COMPLETED`) + `+15` credits each (`task_swap_complete` idempotent via `Credit.taskSwapId`) + notify both. `POST /:id/cancel` reopens tasks.
- **Chat** `GET|POST /api/task-swaps/:id/messages` (100 limit, scoped).
- **UI** `TaskSwapReview.jsx` `/task-swaps/:id` — two task cards, status badge, Accept/Reject/Cancel, Submit/Approve, chat. `Tasks` swaps list `View` → review.

## 6. Credit System (ledger-only, no money)
- **Ledger** `Credit{delta, reason, sessionId?, taskSwapId?}` sum = balance. Reasons: `teach_now +1`, `redeem -1`, `refund +1`, `task_post -n`, `task_complete +n`, `welcome +20`, `first_task +5`, `task_swap_complete +15`.
- **One-off sessions** `CreditSession` `proposed→active→completed|declined` two-sided mint, `findAvailablePartner` excludes `isActive&!frozen` + busy sets + self, `withCreditLock(727272+userId)`.
- **API** `GET /api/credits {balance, ledger 50, sessions}`, `POST /api/credits/teach {skillId}`, `POST /api/credits/redeem {skillId}` (reserve `-1`), `POST /api/credits/sessions/:id/accept|decline|complete`, `GET /api/credits/progress {balance, tiers, nextAction, target100}`.
- **Wallet** `Navbar` `💰 {balance}` badge → `/credits`.
- **Progress → 100** `Dashboard` card: `Welcome 20 ✓ + First Task 5 + Task Swap 15` tiers + bar `balance/100` + `nextAction`. Retrofill script gave 14 demo users `welcome 20`.

## 7. Trust & Communication
- **Chat** `chatController.js` — `POST /cycles/:id/messages` (1000 chars, `new_message` notify), `GET /cycles/:id/messages?sinceId&limit 1..200` polling 5s, auto-scroll, `taskSwap` chat variant.
- **Ratings** `ratingService.canRateEachOther` edge-adjacent only (direct teacher/learner), `POST /api/ratings {cycleId,rateeId,score 1-5}` 409 duplicate (P2002), `GET /api/users/:id/ratings` avg + last 10. UI `Exchanges.jsx` stars.
- **Notifications** `notificationService.notify/notifyMany` types `match_found|match_accepted|match_rejected|session_completed|new_message|credit_session|verification` (now also `task_swap_*`), `GET /api/notifications` 30 + `unreadCount`, `POST /:id/read` + `read-all`, bell poll 20s `Navbar` + deep-link.

## 8. Verification
- **Old** `SkillVerification{method QUIZ|CERTIFICATE, claimedLevel, score/total, evidenceUrl, status pending|approved|rejected}` via `verifyController` (`/verify/quiz/:skillId`, `/verify/certificate`, `/verify/mine`, `/verify/pending`, `/verify/:id/review` admin).
- **New** `QuizQuestion{options[], correctIndex}`, `QuizAttempt{passed}`, `Certificate{issuer, verificationId, PENDING|VERIFIED|REJECTED}` via `quizController` (`GET /skills/:id/quiz`, `POST /skills/:id/quiz/submit` threshold 0.6) + `certificateController`.
- **Enforcement** `PUT /profile/skills` requires `INTERMEDIATE→QuizAttempt passed OR legacy approved`, `EXPERT→Certificate VERIFIED OR legacy approved EXPERT`; `CycleChain` + `SetupSkills` show `✓` via merged `SkillVerification+QuizAttempt+Certificate`.

## 9. Admin & Analytics
- **Admin** `GET /api/admin/stats` → `totalUsers, totalConfirmedCycles, waitingUsers, cycleSizeBreakdown{2-5}, comparison{matchedByCyclicEngine, matchedByDirectSwapOnly, matchedOnlyViaCycles, pctWouldNotMatch}` (live graph recompute). `GET /api/admin/skill-gaps` → `demand/supply/gap` sorted.
- **UI** `Admin.jsx` — 4 stat cards, `cycle-size` bar chart + `cyclic vs direct` bar + `Skills in high demand, low supply` table top10 (recharts).
- **Reports** `Report{reason, status PENDING→WARNED|REMOVED|CREDIT_HOLD, taskSwapId?}` `POST /api/reports`, `GET /api/admin/reports` (pending), `POST /api/admin/reports/:id/resolve {action}` → `isActive false` or `creditsFrozen true`, UI `Reports.jsx` `Warning/Removal/Credit Hold`.

## 10. Legal
- **Privacy** `/privacy` (public) — 7 sections DPDP Act 2023, sharing rules (email hidden while `proposed`), rights, retention, security.
- **Terms** `/terms` (public) — 11 sections acceptance, accounts, exchange, credits/tasks, verification, conduct, termination.
- **Storage** `PRIVACY_POLICY.md` in `frontend/public` + copy in `dist`, consent checkbox on signup.

## 11. Routes
```
POST /api/auth/signup|/login  GET /api/auth/me
GET  /api/skills  PUT /api/profile/skills
POST /api/match/run  GET /api/match/status  GET /api/match/cycle/:id  POST /api/match/cycle/:id/accept|/reject  GET /api/match/exchanges  POST /api/cycles/:id/complete
POST /api/cycles/:id/messages  GET /api/cycles/:id/messages
POST /api/ratings  GET /api/users/:id/ratings
GET  /api/notifications  POST /api/notifications/read-all  POST /api/notifications/:id/read
GET  /api/admin/stats  GET /api/admin/skill-gaps  GET /api/admin/reports  POST /api/admin/reports/:id/resolve  POST /api/admin/certificates/:id/review
GET  /api/credits  POST /api/credits/teach|/redeem  POST /api/credits/sessions/:id/accept|/decline|/complete  GET /api/credits/progress
GET  /api/verify/quiz/:skillId  POST /api/verify/quiz/:skillId/submit  POST /api/verify/certificate  GET /api/verify/mine  GET /api/verify/pending  POST /api/verify/:id/review
GET  /api/skills/:id/quiz  POST /api/skills/:id/quiz/submit  POST /api/certificates
POST /api/reports  POST /api/tasks  GET /api/tasks  POST /api/tasks/:id/claim
POST /api/task-swaps  GET /api/task-swaps  GET /api/task-swaps/:id  POST /api/task-swaps/:id/accept|/reject|/submit|/approve|/cancel  GET|POST /api/task-swaps/:id/messages
GET  /privacy  GET /terms  GET /auth
```

## 12. Frontend Structure
```
frontend/src/pages: Auth (60/40 branding+form, CAPTCHA login-only, show/hide eye), Dashboard (toggle SKILL/TASK + credit progress), SetupSkills, MatchReview, Exchanges, Credits, Verify, Tasks, TaskSwapReview, Admin, Reports, Privacy, Terms
frontend/src/components: Navbar (wallet, bell, hamburger), CycleChain (loop + level + verified + availability), SkillPicker, ReportButton
frontend/src/context: AuthContext (cookie→user, refresh)
frontend/src/api: client axios withCredentials + 401→/auth
```

## 13. How to Reach 100 Credits (Phase 1)
| Step | Action | Credit | Total |
|------|--------|--------|-------|
| 1 | Signup | +20 Welcome | 20 |
| 2 | Post first task | +5 First Task | 25 |
| 3 | Complete Task Swap (both submit+approve) | +15 each | 40 |
| 4+ | More swaps/cycles | +15 each | →100 after ~4 swaps |

Tiers visible in `Dashboard` → `Credits → 100` bar.

---

*Last updated: 2026-09-12 — Phase 1 Task Swap + minimal credit economy live, `prisma db push` in sync, 45 tests pass, build 690 modules.*
