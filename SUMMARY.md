# KaushalChakra — Audit + Build Summary

Full session log: production audit → 5-phase hardening build → skill
verification → security + reskin → browser QA → GitHub push → Render
deploy + live debugging. Current state: everything below is committed,
pushed to `master`, and deployed at
`https://kaushalchakra-app.onrender.com`.

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
   double-minted → atomic flip, then two-sided completion (Round 2).
6. Self-rating bypass: `rateeId:"1"` (string) slipped past the `===` check
   → ids normalized before comparison (`ratingController.js`).
7. Second reject on the same user-pair threw P2002 → cycle stuck
   `proposed` forever → `upsert` (`matchController.js`).
8. Dashboard white-screened when the counterpart heuristic missed
   (`?.user.name` doesn't guard `.user`) (`Dashboard.jsx`).

### High-value fixes (all fixed)

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
- Rating adjacency was skill-equality based → edge-based (Round 2).
- Credit farm gap (free `+1`) → two-sided completion (Round 2).

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
  who teaches what you learn (or learns what you teach). Changed in
  `ratingService.js`, mirrored in `Exchanges.jsx`, +2 unit tests.
- Two-sided credit completion: `CreditSession` gained `teacherDoneAt` /
  `learnerDoneAt` (migration `credit_two_sided_complete`); the teacher's
  `+1` mints only after BOTH sides mark done, via one atomic flip.
  UI shows "waiting for partner" states; smoke covers both sides.

### Round 3 — auth security + Warm Indian craft reskin
- Cookie auth: httpOnly `kc_session` (SameSite=Lax, Secure in prod) for
  browsers, Bearer kept for scripts/smoke (dual-auth via `resolveToken`,
  unit-tested). `POST /auth/logout` clears the cookie. Frontend drops
  localStorage tokens; AuthContext restores via `/auth/me` with a loading
  gate (no more reload bounce). CSRF story: Lax cookies + no
  cookie-authenticated side-effect GETs + strict CORS.
- Helmet headers (incl. CSP), cookie-parser, global 600/15min API limiter.
  Brute-force limiter scoped to POST login/signup only — session calls
  (`/me`) no longer burn the budget (found via a self-inflicted 429
  during QA).
- Reskin: cream paper, maroon + marigold, ink serif display
  (`kc-display`), chakra seal/divider motifs, कौशलचक्र wordmark. Shared
  `kc-*` component classes; 13 files skinned, zero logic changes. Inline
  SVG favicon + SVG bell (no emoji icons left).

### Round 4 — deploy debugging (Render)
- Symptom: CSS served as `application/json` + JS 500 on the live URL.
  Diagnosis from code: the only JSON source for non-API paths was the
  central error handler, which masked every failure as 500 — so a
  runtime file/rules problem presented as MIME errors.
- Fix 1: error handler honors `err.status` (sendFile misses → 404);
  missing `dist/` logs a loud boot WARNING instead of failing silently.
- Fix 2 (the live bug, from deploy logs): CORS allowlist rejected the
  Render origin. Replaced with same-origin-aware CORS (Origin matching
  request Host needs no env var) + quiet deny (no ACAO header, no 500)
  + `trust proxy` for correct client IPs. Verified locally:
  same-origin → 401 JSON with ACAO headers; foreign → denied, no crash.
- Deploy config verified beforehand: `migrate deploy` clean (5
  migrations), `npm ci` both sides in sync, seed idempotent, no new env
  vars or dependencies, `/api/health` present.

---

## 3. Verification evidence

- **Unit tests: 45/45 pass** (`npm test` in `backend/`) — 29 original +
  10 verification + 2 rating + 4 auth (`resolveToken`).
- **Smoke: ALL CHECKS PASSED** on fresh seeds, repeatedly — incl.
  two-sided credit flow, 7 verification checks, partner-accept flow.
- **Race proof** (throwaway script): concurrent double-complete →
  exactly one wins, balance +1 only; concurrent double-redeem on
  balance 1 → exactly one wins, balance 0 (never negative).
- **Browser QA 15/15** (Playwright + real Chrome, script in temp dir):
  login, match accept, live confirm, chat send, quiz 6/6, certificate +
  admin approval, admin charts, credits teach, mobile menu, zero
  horizontal overflow. Screenshots in `Temp\kc-qa\shots\`.
- **Production shape**: Express-served `dist/` returns 200 for `/` and
  SPA routes; `/api/health` healthy; unauthenticated API → 401.
- Deploy logs confirm: 5 migrations applied, 37 skills + 14 users
  seeded, `Serving built frontend from frontend/dist`, service live.

---

## 4. Run it locally

```powershell
# terminal 1 — database (portable Postgres, no admin needed)
& "$env:LOCALAPPDATA\PostgreSQL\17\pgsql\bin\pg_ctl.exe" -D "$env:LOCALAPPDATA\PostgreSQL\17\data" -l "$env:LOCALAPPDATA\PostgreSQL\17\logfile.txt" start
# terminal 2 — backend
cd D:\Projects\Minor\backend; npm run dev        # :4000
# terminal 3 — frontend
cd D:\Projects\Minor\frontend; npm run dev       # :5173
```

- Fresh demo data: `SEED_FRESH=1 npm run seed` (from `backend/`).
- Live deployment: `https://kaushalchakra-app.onrender.com`
  (free tier sleeps after 15 min idle — first load takes ~1 min to wake;
  free PostgreSQL expires after 30 days → move to Neon for permanent).
- Redeploy on Render: service → Manual Deploy → Deploy latest commit
  (use "Clear build cache & deploy" if assets ever look stale).
- Demo logins (password `password123`): `aarav@demo.com` (3-way cycle),
  `priya@demo.com` (admin), `ishaan@demo.com` (credits), `vihaan@demo.com`.
- Suggested viva flow: Aarav accepts 3-way cycle → Simran/Rohan accept →
  chat unlocks → everyone completes → rate partners → Priya checks
  `/admin` → Ishaan does `/credits` → Verify page: pass a Python quiz,
  submit a certificate, approve it as Priya.

### Demo accounts (all password `password123`)

- 3-way cycle: `aarav@demo.com` (Python→Photography), `simran@demo.com`
  (Photography→Guitar), `rohan@demo.com` (Guitar→Python)
- 4-way cycle: `priya@demo.com` (**admin**, Excel→Spanish),
  `neha@demo.com`, `vikram@demo.com`, `ananya@demo.com`
- Direct swap: `kunal@demo.com` ↔ `meera@demo.com`
- Credits/waiting: `ishaan@demo.com`, `vihaan@demo.com`, `riya@demo.com`,
  `sara@demo.com`, `dev@demo.com`

---

## 5. Commits (all on `master`, pushed)

- `eb61150` Audit + hardening: fix 8 blockers, live chat, skill
  verification, atomic credits
- `49d9e99` Add favicon, quiz test ids
- `d8940d2` Cookie auth + Warm Indian craft reskin
- `b5ee9e3` Serve frontend honestly (truthful errors, dist warning)
- `7bc9a82` CORS: allow same-origin production traffic, deny quietly
- `viva-fallback` branch + tag frozen pre-redesign as rollback

Repo: `https://github.com/himanshuurathi21/KAUSHAL-CHAKRA`
