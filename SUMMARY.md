# KaushalChakra — Audit + Build Summary

Everything below was produced in one session: a full production audit of the
repo, followed by a 5-phase build (bug fixes, chat, skill verification,
credit hardening, UI/UX pass). Verified with 39 unit tests, an extended
smoke suite, and a race-condition proof script — all green.

---

## 1. Production audit: 62/100, risky

Ships for a viva demo, not for real users. Evidence: full read of all
backend routes/controllers/services, all frontend pages/components, the
Prisma schema, seed/smoke scripts, plus live runs (tests, smoke, build).

### Already existed (asked to "add", but present — needed fixing, not rebuilding)

- **Level select (Beginner/Intermediate/Expert)** — works end-to-end
  (SetupSkills editors → `PUT /profile/skills` → badges in CycleChain).
  Missing: proof that a claimed level is real → solved with verification.
- **Credit system (Phase 3)** — teach/redeem/ledger/balance all work.
  Missing: hardening — it was exploitable (see blockers 4–5).
- **Chat** — works but felt broken (see chat fixes).

### Blockers (all fixed)

1. `GET /api/debug/graph` leaked all users' names + skills to ANY logged-in
   user → now `requireAdmin` (`backend/src/routes/matchRoutes.js`).
2. `POST /api/match/run` spammable by any user → notification spam +
   double proposals → now rate-limited 10/min (`matchRoutes.js`).
3. `requireAdmin` had no try/catch — a DB blip hung the request
   (`backend/src/middleware/auth.js`).
4. Credit double-spend: balance check outside the transaction, two
   concurrent redeems drove balance negative
   (`creditController.js` → balance check moved inside a locked txn).
5. Credit `+1` minted on single-sided complete; concurrent completes
   double-minted → now atomic `updateMany({status:'active'})`, only the
   winner mints (`creditController.js`).
6. Self-rating bypass: `rateeId:"1"` (string) slipped past the `===` check
   → ids normalized before comparison (`ratingController.js`).
7. Second reject on the same user-pair threw P2002 → cycle stuck
   `proposed` forever → `upsert` (`matchController.js`).
8. Dashboard white-screened when the counterpart heuristic missed
   (`?.user.name` doesn't guard `.user`) (`Dashboard.jsx`).

### High-value fixes (all fixed unless noted)

- Chat: proposed page never learned the cycle got confirmed until reload;
  first load landed on oldest messages; double-Enter double-posted; no
  server pagination.
- Validation 500s that should be 400s: NaN/float skill ids, numeric
  email/password.
- Credits page: dropdowns listed all 37 skills though the backend rejects
  most; redeem clickable with 0 balance; infinite "Loading credits…" on
  error; "open" count ignored active sessions; no waiting hint.
- Mobile: navbar overflowed at 360px, no hamburger.
- Notifications weren't deep-linked (backend sent text only).
- `me`/`getProfile`/`getMyStatus` crashed (500) on deleted users;
  duplicate-rating race returned 500 instead of 409.
- Rating adjacency was skill-equality based, not chain position — FIXED
  (see "Round 2" below).
- Credit farm design gap: teach-side `+1` costs the learner nothing, so
  colluding users can print credits — FIXED with two-sided completion
  (see "Round 2" below).

---

## 2. What was built

### Phase 1 — Bug-fix batch
- `auth.js`: `requireAdmin` try/catch + `req.userId` guard; `requireAuth`
  separates JWT errors (401) from DB errors (500).
- `authController.js`: email trim/format check, password 6–72 chars,
  `me` returns 401 for deleted users.
- `profileController.js`: 401 for deleted users; non-integer skill ids
  rejected with 400.
- `matchController.js`: BlockedEdge `upsert`; idempotent accept/complete
  (no re-notify, no double transition); atomic completed transition via
  `updateMany`; null-cycle guards in enrich helpers.
- `ratingController.js`: id coercion before self-check; P2002 race → 409.
- `creditController.js`: integer `skillId` validation.
- `matchingService.js`: `runMatching` serialized with a Postgres advisory
  lock (concurrent runs can't double-propose a user); helpers accept a txn
  client.
- Frontend crash guards: Dashboard (`?.user?.name`, load error + retry,
  no full-page reload), Admin (shape guards, 4-col grid), Exchanges
  (action errors, load error, `me` guards, per-user rated flags, live
  awaiting hints), MatchReview (actions only when `proposed`, Accept
  disabled once accepted, `user?.id` everywhere).

### Phase 2 — Chat, properly functional
- Backend: `GET /cycles/:id/messages` supports `?sinceId=&limit=` —
  polls fetch only new messages.
- `MatchReview.jsx`: status polling while `proposed` (page flips to
  confirmed live, chat unlocks without reload); first load jumps to the
  bottom, then follows only when near bottom; double-post ref guard;
  per-chat error banner + "unavailable, refresh" state after 3 failures;
  loading state instead of false "No messages yet".

### Phase 3 — Skill verification (`/verify`, new)
- `SkillVerification` table + migration `20260908183017_skill_verification`
  (quiz score/total, certificate URL/issuer, pending/approved/rejected,
  reviewer). `Notification.link` column added in the same migration.
- `quizBank.js`: 8 skills × 6 questions (Python, JavaScript, Guitar,
  Photography, Piano, Spanish, Cooking, Excel), 2 per level.
- `verificationService.js`: grading + thresholds (Beginner 40%,
  Intermediate 60%, Expert 80%). Answers never leave the server.
- `verifyController.js` + routes: get quiz, submit quiz (instant
  approve/reject + notification), submit certificate (URL validation,
  admins pinged), my verifications, admin pending queue, admin
  approve/reject with user notification.
- UI: `Verify.jsx` page (quiz runner, certificate form, attempt history,
  admin queue), ✓ badges on SetupSkills + CycleChain (approved levels
  attached in `enrichCycle`), nav link, protected route.

### Phase 4 — Credit hardening + Credits UX
- `redeem`/`teachNow`: checks + writes inside one advisory-locked
  transaction (no double-spend, no double-booking); partner lookup
  filtered/ordered in the DB.
- `completeSession`: atomic flip, single mint.
- Credits page: dropdowns filtered to offered/wanted skills, redeem
  disabled at 0 balance with explanation, open-session banner, waiting
  hints, per-row busy states, load error + retry, null-safe data.

### Phase 5 — UI/UX pass
- Mobile hamburger menu; deep-linked notifications (tap → match/credits/
  verify page, marks read); notification bell effect keyed on `user?.id`;
  separate desktop/mobile bell refs (no instant-close bug).
- SetupSkills: hoisted `LevelEditor` (no remount/focus loss), correct
  fallbacks, taxonomy loading/error states, min-one-skill validation,
  timer cleanup, verified ✓ marks.
- Auth: redirect when already signed in, `minLength=6` hint.
- API client: `VITE_API_URL` support + 15s timeout.
- README documents the new `/verify` endpoints.

### Round 2 — remaining gaps closed
- Rating adjacency is now edge-based: the ratee must be the participant
  who teaches what you learn (or learns what you teach), so coincidental
  skill sharing no longer grants rating rights. Changed in
  `ratingService.js`, mirrored in `Exchanges.jsx`, +2 unit tests.
- Two-sided credit completion: `CreditSession` gained `teacherDoneAt` /
  `learnerDoneAt` (migration `credit_two_sided_complete`); the teacher's
  `+1` mints only after BOTH sides mark done, via one atomic flip — kills
  single-sided self-minting while keeping the demo flow (each side clicks
  once). UI shows "waiting for partner" states; smoke covers both sides.

---

## 3. Verification evidence

- **Unit tests: 41/41 pass** (`npm test` in `backend/`).
- **Smoke: ALL CHECKS PASSED** (`npm run smoke` on a fresh seed) —
  includes 7 new verification checks (quiz load/grading, certificate
  submit, admin queue, approval, 403 for non-admin) and the previously
  fixed partner-accept credit flow.
- **Race proof** (`race-check.mjs`, throwaway script): concurrent
  double-complete → exactly one wins, balance +1 only; concurrent
  double-redeem on balance 1 → exactly one wins, balance 0 (never
  negative).
- **Frontend:** `npm run build` succeeds; dev server returns HTTP 200.
- **Quiz-pass path** verified live against the API (6/6 → approved).

---

## 4. Run it

```powershell
# terminal 1 — database (portable Postgres, no admin needed)
& "$env:LOCALAPPDATA\PostgreSQL\17\pgsql\bin\pg_ctl.exe" -D "$env:LOCALAPPDATA\PostgreSQL\17\data" -l "$env:LOCALAPPDATA\PostgreSQL\17\logfile.txt" start
# terminal 2 — backend
cd D:\Projects\Minor\backend; npm run dev        # :4000
# terminal 3 — frontend
cd D:\Projects\Minor\frontend; npm run dev       # :5173
```

- Fresh demo data: `SEED_FRESH=1 npm run seed` (from `backend/`).
- Demo logins (password `password123`): `aarav@demo.com` (3-way cycle),
  `priya@demo.com` (admin), `ishaan@demo.com` (credits), `vihaan@demo.com`.
- Suggested viva flow: Aarav accepts 3-way cycle → Simran/Rohan accept →
  chat unlocks → everyone completes → rate partners → Priya checks
  `/admin` → Ishaan does `/credits` → Verify page: pass a Python quiz,
  submit a certificate, approve it as Priya.

---

## 5. Changed files (26 modified, 5 new)

New: `verifyController.js`, `quizBank.js`, `verificationService.js`,
`tests/verification.test.mjs`, `frontend/src/pages/Verify.jsx`, plus
migration `20260908183017_skill_verification`.
Modified — backend: `auth.js`, `authController.js`, `profileController.js`,
`matchController.js`, `ratingController.js`, `creditController.js`,
`chatController.js`, `verifyController.js`, `matchRoutes.js`,
`featureRoutes.js`, `matchingService.js`, `creditService.js`,
`notificationService.js`, `schema.prisma`, `seed.js`, `smoke.js`.
Modified — frontend: `App.jsx`, `client.js`, `Navbar.jsx`,
`CycleChain.jsx`, `Dashboard.jsx`, `SetupSkills.jsx`, `MatchReview.jsx`,
`Exchanges.jsx`, `Credits.jsx`, `Admin.jsx`, `Auth.jsx`. Plus `README.md`.

Nothing is committed — commit when ready.
