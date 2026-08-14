# KaushalChakra — Skill Bartering Platform

Trade skills, not money. KaushalChakra matches people into **fair multi-person
exchange cycles** — you teach Python to Simran, Simran teaches Photography to
Rohan, Rohan teaches Guitar to you. A closed loop where everyone wins.

Built with **Express + Prisma + PostgreSQL** (backend) and **React + Vite +
Tailwind** (frontend).

## Features

| Phase | Feature | Where |
|---|---|---|
| 1a | Session completion — mark your side done, cycle flips to `completed` when everyone has | My Exchanges |
| 1b | Ratings & reviews (1–5 ⭐, completed cycles only) + average-rating badges | My Exchanges, cycle chains |
| 1c | In-app chat scoped to confirmed exchanges (5s polling, no WebSockets) | Match Review page |
| 1d | Notifications (match found/accepted/rejected, session completed, new message) with unread bell | Navbar |
| 2a | Skill proficiency levels (`BEGINNER`/`INTERMEDIATE`/`EXPERT`) used as a matching tie-breaker | Profile setup, cycle chains |
| 2b | Admin analytics — cycle-size breakdown + cyclic-vs-direct-swap proof number | `/admin` |
| 3 | Credit fallback — teach now and earn a credit, or redeem one to learn now | `/credits` |

The core is a **bounded-depth DFS cyclic matching engine**
(`backend/src/services/matchingEngine.js`) — a pure, unit-tested module that
finds 2–5 person cycles where every user teaches the next user's wanted skill.

## Requirements

- Node.js 18+
- PostgreSQL 14+ running on `localhost:5432`

## Setup

```bash
# 1. Create the database
psql -U postgres -c "CREATE DATABASE kaushalchakra;"

# 2. Backend
cd backend
cp .env.example .env          # adjust credentials if needed
npm install
npx prisma migrate dev        # applies migrations
npm run seed                  # 14 demo users + skill taxonomy
npm test                      # 19 unit tests (pure matching engine + credits)
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000)
```

### Demo accounts (all password: `password123`)| Email | Role |
|---|---|
| `aarav@demo.com` | In the 3-person cycle (Aarav → Simran → Rohan) |
| `priya@demo.com` | **Admin** — has access to `/admin` analytics |
| `kunal@demo.com` / `meera@demo.com` | Direct 2-person swap pair |
| `ishaan@demo.com` | Waiting pool — try the credit fallback (`/credits`) |
| `vihaan@demo.com` / `riya@demo.com` | Credit-session partners for Ishaan |

Suggested demo flow:

1. Log in as **Aarav** → accept the proposed 3-way cycle → it confirms.
2. As **Simran** and **Rohan**, accept too → cycle confirms → chat + contact info unlock.
3. Everyone marks "session complete" → cycle becomes **Completed** → rate partners.
4. Log in as **Priya** → **Admin** page shows the cycle-size bar chart and the
   headline number: what % of matched users would NOT match with 1-to-1 swaps only.
5. Log in as **Ishaan** → **Credits** → teach now (Vihaan wants Physics Tutoring) →
   complete → earn 1 credit → redeem it to learn Piano from Riya.

## API overview

```
POST /api/auth/signup | /login           GET /api/auth/me
GET  /api/skills                          PUT /api/profile/skills
POST /api/match/run                       GET /api/match/status
GET  /api/match/cycle/:id                 POST /api/match/cycle/:id/accept | /reject
GET  /api/match/exchanges?limit=&offset=     POST /api/cycles/:id/complete
POST /api/cycles/:id/messages             GET  /api/cycles/:id/messages
POST /api/ratings                         GET  /api/users/:id/ratings
GET  /api/notifications                   POST /api/notifications/read-all
POST /api/notifications/:id/read
GET  /api/admin/stats                     (admin only)
GET  /api/credits                         POST /api/credits/teach
POST /api/credits/redeem                  POST /api/credits/sessions/:id/complete
```

All endpoints except signup/login require `Authorization: Bearer <jwt>`.

## Running with Docker (optional)

Requires Docker Desktop. Starts PostgreSQL + API + web UI:

```bash
docker compose up --build     # web UI at http://localhost:8080, API at :4000
```

The backend runs migrations and seeds the demo data automatically on startup;
existing progress is preserved across restarts (set `SEED_FRESH=1` to wipe).

## CI (free)

Every push to `master` runs the backend unit tests and a production frontend
build via GitHub Actions — see `.github/workflows/ci.yml`.

## Free deployment (Render)

The repo ships a `render.yaml` blueprint. One web service builds the backend
**and** the frontend (Express serves the built React app itself), plus a free
PostgreSQL database:

1. Create a free account at [render.com](https://render.com) with **"Sign up with GitHub"**.
2. Click **New → Blueprint → pick the `KAUSHAL-CHAKRA` repo**.
3. Render reads `render.yaml` and provisions the web service + database.
   Free services sleep after 15 min idle and wake on the first request.

Resulting URL:
- App (web UI + API): `https://kaushalchakra-app.onrender.com`

> Note: Render's free PostgreSQL expires after 30 days — fine for demos/viva.
> For a permanent free database use **Neon** (free tier) and swap the
> `DATABASE_URL` in the service's environment variables.

## Project structure

```
backend/
  prisma/schema.prisma        # User, Skill, MatchCycle, Rating, Message, Notification, Credit...
  scripts/seed.js             # taxonomy + 14 demo users (Priya is admin)
  scripts/smoke.js            # automated end-to-end demo over HTTP
  src/controllers/            # route handlers
  src/services/               # matchingEngine (pure), matchingService, notificationService, creditService
  src/middleware/auth.js      # requireAuth + requireAdmin
  tests/                      # vitest unit tests
frontend/
  src/pages/                  # Auth, Dashboard, SetupSkills, MatchReview, Exchanges, Admin, Credits
  src/components/             # Navbar, CycleChain, SkillPicker
```

## Notes

- Matching runs automatically when skills change, when a cycle is rejected,
  and when a cycle completes; the Dashboard also has a manual "Run matching now"
  button. A cycle whose exact user set completed in the last 24h is never
  re-proposed (no instant duplicates).
- A user can be in at most one active cycle at a time; rejected edges are
  blocked so the same swap is never proposed twice.
- Chat messages are limited to 1000 characters; "mark all read" is available
  in the notification bell.
- Credits: `+1` for a completed one-off lesson, `-1` to redeem one. The
  `CREDIT_MIN_WAIT_DAYS` env var (default 0) can gate credit teaching until a
  user has been unmatched for N days.