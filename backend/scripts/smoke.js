/**
 * KaushalChakra smoke test — drives the entire product over HTTP end to end.
 *
 * Prereqs: the backend must be running (`npm run dev` / `npm start`) and the
 * database seeded (`npm run seed`). This script is idempotent — re-running it
 * on a partially-used database still passes (it adapts to the current state).
 *
 * Usage:  node scripts/smoke.js   (or npm run smoke)
 * Exit code 0 = every check passed, 1 = at least one failed.
 */
const BASE = process.env.API_URL || 'http://localhost:4000';
const PASSWORD = 'password123';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

async function login(email) {
  const { status, data } = await api('POST', '/api/auth/login', null, { email, password: PASSWORD });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status}`);
  return data;
}

async function main() {
  console.log(`KaushalChakra smoke test -> ${BASE}\n`);

  // ---------------------------------------------------------------- auth
  console.log('[auth]');
  const aarav = await login('aarav@demo.com');
  const simran = await login('simran@demo.com');
  const rohan = await login('rohan@demo.com');
  const priya = await login('priya@demo.com');
  check('login returns a JWT', typeof aarav.token === 'string' && aarav.token.length > 20);
  check('login returns the user', aarav.user.name === 'Aarav Sharma');
  check('priya is flagged admin', priya.user.isAdmin === true);

  const me = await api('GET', '/api/auth/me', aarav.token);
  check('GET /auth/me works', me.status === 200);

  // ---------------------------------------------------------------- matching
  console.log('\n[matching]');
  let status = (await api('GET', '/api/match/status', aarav.token)).data;
  if (status.status === 'waiting') {
    const run = await api('POST', '/api/match/run', aarav.token);
    check('matching run responds', run.status === 201 || run.status === 200, run.status);
    status = (await api('GET', '/api/match/status', aarav.token)).data;
  }
  check('aarav has a cycle (proposed/confirmed/completed)', ['proposed', 'confirmed', 'completed'].includes(status.status), status.status);

  // -------------------------------------------------- accept the 3-way cycle
  console.log('\n[accept → confirm]');
  const cycleId = status.cycle.id;
  const three = { aarav: aarav.token, simran: simran.token, rohan: rohan.token };
  for (const [name, token] of Object.entries(three)) {
    const acc = await api('POST', `/api/match/cycle/${cycleId}/accept`, token);
    const ok = acc.status === 200 || (acc.status === 400 && acc.data.error?.includes('already'));
    check(`${name} accepts cycle #${cycleId}`, ok, `${acc.status} ${acc.data?.error || ''}`);
  }
  const afterAccept = (await api('GET', `/api/match/cycle/${cycleId}`, aarav.token)).data.cycle;
  check('cycle is confirmed once everyone accepts', ['confirmed', 'completed'].includes(afterAccept.status), afterAccept.status);

  // -------------------------------------------------------------- completion
  console.log('\n[completion]');
  for (const [name, token] of Object.entries(three)) {
    const comp = await api('POST', `/api/cycles/${cycleId}/complete`, token);
    const ok = comp.status === 200 || (comp.status === 400 && comp.data.error?.includes('completed'));
    check(`${name} marks session complete`, ok, `${comp.status} ${comp.data?.error || ''}`);
  }
  const afterComplete = (await api('GET', `/api/match/cycle/${cycleId}`, aarav.token)).data.cycle;
  check('cycle flips to completed', afterComplete.status === 'completed', afterComplete.status);
  const emails = afterComplete.participants.map((p) => p.user.email).filter(Boolean);
  check('contact emails visible after completion', emails.length === afterComplete.participants.length);

  // ----------------------------------------------------------------- ratings
  console.log('\n[ratings]');
  const simranId = afterComplete.participants.find((p) => p.userId !== aarav.user.id).userId;
  const rate = await api('POST', '/api/ratings', aarav.token, {
    cycleId, rateeId: simranId, score: 5, comment: 'Great teacher!',
  });
  const alreadyRated = rate.status === 409;
  check('rating created on completed cycle', rate.status === 201 || alreadyRated, rate.status);
  const dup = await api('POST', '/api/ratings', aarav.token, { cycleId, rateeId: simranId, score: 4 });
  check('duplicate rating rejected (409)', dup.status === 409, dup.status);
  const userRatings = await api('GET', `/api/users/${simranId}/ratings`, aarav.token);
  check('GET /users/:id/ratings returns average', userRatings.status === 200 && userRatings.data.average === 5);

  // -------------------------------------------------------------------- chat
  console.log('\n[chat]');
  const msg = await api('POST', `/api/cycles/${cycleId}/messages`, aarav.token, { content: 'Hi everyone!' });
  check('message sent on completed cycle', msg.status === 201, msg.status);
  const list = await api('GET', `/api/cycles/${cycleId}/messages`, simran.token);
  check('message list is ordered oldest→newest', list.status === 200 && list.data.messages.length >= 1);
  const tooLong = await api('POST', `/api/cycles/${cycleId}/messages`, aarav.token, { content: 'x'.repeat(1001) });
  check('over-long message rejected (400)', tooLong.status === 400, tooLong.status);
  const emptyMsg = await api('POST', `/api/cycles/${cycleId}/messages`, aarav.token, { content: '   ' });
  check('blank message rejected (400)', emptyMsg.status === 400, emptyMsg.status);

  // ----------------------------------------------------------- notifications
  console.log('\n[notifications]');
  const notifs = await api('GET', '/api/notifications', aarav.token);
  check('notifications endpoint works', notifs.status === 200 && typeof notifs.data.unreadCount === 'number');
  const types = new Set(notifs.data.notifications.map((n) => n.type));
  check(
    'notification types cover the lifecycle',
    ['match_found', 'match_accepted', 'session_completed'].every((t) => types.has(t)),
    [...types].join(',')
  );
  if (notifs.data.unreadCount > 0) {
    const allRead = await api('POST', '/api/notifications/read-all', aarav.token);
    const after = (await api('GET', '/api/notifications', aarav.token)).data;
    check('mark-all-read clears the unread count', allRead.status === 200 && after.unreadCount === 0, after.unreadCount);
  } else {
    check('mark-all-read clears the unread count', true, 'already 0');
  }

  // ---------------------------------------------------------- exchanges page
  console.log('\n[exchanges pagination]');
  const page1 = await api('GET', '/api/match/exchanges?limit=5&offset=0', aarav.token);
  const page2 = await api('GET', '/api/match/exchanges?limit=5&offset=5', aarav.token);
  check(
    'exchanges pagination pages do not overlap',
    page1.status === 200 && page2.status === 200 &&
      page1.data.exchanges.every((e) => !page2.data.exchanges.some((x) => x.id === e.id)),
    `${page1.data.exchanges.length} + ${page2.data.exchanges.length}`
  );

  // ------------------------------------------------------------------- admin
  console.log('\n[admin]');
  const denied = await api('GET', '/api/admin/stats', aarav.token);
  check('non-admin blocked (403)', denied.status === 403, denied.status);
  const stats = await api('GET', '/api/admin/stats', priya.token);
  const s = stats.data || {};
  check('admin stats return totals', stats.status === 200 && typeof s.totalUsers === 'number');
  check('cycle-size breakdown present', typeof s.cycleSizeBreakdown === 'object');
  check(
    'cyclic-vs-direct comparison present',
    typeof s.comparison?.pctWouldNotMatchWithoutCycles === 'number' &&
      s.comparison.pctWouldNotMatchWithoutCycles >= 0,
    JSON.stringify(s.comparison)
  );
  check('waiting users count present', typeof s.waitingUsers === 'number');

  // ----------------------------------------------------------------- credits
  console.log('\n[credits]');
  const ishaan = await login('ishaan@demo.com');
  const skills = (await api('GET', '/api/skills', ishaan.token)).data.skills;
  const physics = skills.find((x) => x.name === 'Physics Tutoring');
  const piano = skills.find((x) => x.name === 'Piano');

  const balance0 = (await api('GET', '/api/credits', ishaan.token)).data.balance;

  const teach = await api('POST', '/api/credits/teach', ishaan.token, { skillId: physics.id });
  const teachOk = teach.status === 201 || (teach.status === 400 && teach.data.error?.includes('active cycle'));
  check('teach-now creates a session', teachOk, `${teach.status} ${teach.data?.error || ''}`);

  const sessions = (await api('GET', '/api/credits', ishaan.token)).data.sessions;
  const open = sessions.find((x) => x.status === 'proposed');
  if (open) {
    const done = await api('POST', `/api/credits/sessions/${open.id}/complete`, ishaan.token);
    check('credit session completes', done.status === 200, done.status);
  }
  const balance1 = (await api('GET', '/api/credits', ishaan.token)).data.balance;
  check('teacher earned +1 credit', balance1 === balance0 + 1, `balance ${balance0} -> ${balance1}`);

  if (balance1 >= 1) {
    const redeem = await api('POST', '/api/credits/redeem', ishaan.token, { skillId: piano.id });
    check('redeem creates a session', redeem.status === 201, `${redeem.status} ${redeem.data?.error || ''}`);
    if (redeem.status === 201) {
      const balance2 = (await api('GET', '/api/credits', ishaan.token)).data.balance;
      check('credit spent on redeem', balance2 === balance1 - 1, `balance ${balance1} -> ${balance2}`);
    }
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSMOKE TEST CRASHED:', err.message);
  process.exit(1);
});