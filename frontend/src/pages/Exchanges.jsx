import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CycleChain from '../components/CycleChain';
import { useAuth } from '../context/AuthContext';

const STARS = [1, 2, 3, 4, 5];

// Rated flags are per-user: two accounts sharing a browser must not see
// each other's "Rated ✓" state.
const ratedKeyFor = (userId) => `kc_rated:${userId ?? 'anon'}`;

// Matches the backend rule (ratingService.canRateEachOther): you may only
// rate the participant who teaches what you learn, or learns what you teach.
const canRate = (me, other, participants) => {
  if (!me || !other || me.userId === other.userId) return false;
  const myTeacher = participants.find((p) => p.teachesSkillId === me.learnsSkillId);
  const myLearner = participants.find((p) => p.learnsSkillId === me.teachesSkillId);
  return myTeacher?.userId === other.userId || myLearner?.userId === other.userId;
};

function loadRated(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(ratedKeyFor(userId))) || []);
  } catch {
    return new Set();
  }
}

const PAGE_SIZE = 10;

export default function Exchanges() {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [actionError, setActionError] = useState('');
  const [completingId, setCompletingId] = useState(null);
  const [rated, setRated] = useState(() => loadRated(user?.id));
  const [ratings, setRatings] = useState({}); // `${cycleId}:${rateeId}` -> { score, comment }

  // Reload per-user rated flags when the account changes.
  useEffect(() => {
    setRated(loadRated(user?.id));
  }, [user?.id]);

  const persistRated = (next) => {
    setRated(next);
    localStorage.setItem(ratedKeyFor(user?.id), JSON.stringify([...next]));
  };

  const load = (offset = 0, append = false) => {
    setLoadError('');
    return api
      .get(`/match/exchanges?limit=${PAGE_SIZE}&offset=${offset}`)
      .then(({ data }) => {
        setExchanges((prev) => {
          const next = append ? [...prev, ...data.exchanges] : data.exchanges;
          return [...new Map(next.map((e) => [e.id, e])).values()];
        });
        setHasMore(data.exchanges.length === PAGE_SIZE);
      })
      .catch(() => setLoadError('Could not load exchanges. Check your connection and retry.'))
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    load();
  }, []);

  const loadMore = () => load(exchanges.length, true);

  const complete = async (cycleId) => {
    setActionError('');
    setCompletingId(cycleId);
    try {
      await api.post(`/cycles/${cycleId}/complete`);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Could not mark the session complete.');
    } finally {
      setCompletingId(null);
    }
  };

  const submitRating = async (cycleId, rateeId) => {
    const key = `${cycleId}:${rateeId}`;
    const { score, comment } = ratings[key] || {};
    if (!score) return;
    setActionError('');
    try {
      await api.post('/ratings', { cycleId, rateeId, score, comment });
      persistRated(new Set(rated).add(key));
    } catch (err) {
      // already rated this cycle → treat as done
      if (err.response?.status === 409) persistRated(new Set(rated).add(key));
      else setActionError(err.response?.data?.error || 'Could not submit the rating.');
    }
  };

  const setRating = (cycleId, rateeId, patch) =>
    setRatings((prev) => ({ ...prev, [`${cycleId}:${rateeId}`]: { ...prev[`${cycleId}:${rateeId}`], ...patch } }));

  if (!loaded) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted">Loading…</div>;
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="kc-display text-3xl font-bold text-ink">My Exchanges</h1>
        <p className="kc-alert-error">{loadError}</p>
        <button
          onClick={() => { setLoaded(false); load(); }}
          className="kc-btn"
        >
          Retry
        </button>
      </div>
    );
  }

  if (exchanges.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="kc-display text-3xl font-bold text-ink">My Exchanges</h1>
        <p className="text-muted">No confirmed exchanges yet.</p>
        <Link to="/" className="kc-link text-sm">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="kc-display text-3xl font-bold text-ink">My Exchanges</h1>

      {actionError && (
        <p className="kc-alert-error">{actionError}</p>
      )}

      {exchanges.map((exchange) => {
        const done = exchange.status === 'completed';
        const me = exchange.participants.find((p) => p.userId === user?.id);
        const others = exchange.participants.filter((p) => p.userId !== user?.id);
        const rateable = me ? others.filter((p) => canRate(me, p, exchange.participants)) : [];
        const awaiting = exchange.participants.filter((p) => !p.completedAt);
        const awaitingNames = awaiting.map((a) => (a.userId === user?.id ? 'You' : a.user.name));

        return (
          <div key={exchange.id} className="kc-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="kc-display text-xl text-ink font-bold">Cycle #{exchange.id}</h2>
              <div className="flex items-center gap-2">
                {done ? (
                  <span className="kc-badge kc-badge-leaf">
                    ✓ Completed
                  </span>
                ) : me?.completedAt ? (
                  <span className="kc-badge kc-badge-amber">
                    ⏳ Waiting for others
                  </span>
                ) : (
                  <button
                    onClick={() => complete(exchange.id)}
                    disabled={completingId === exchange.id}
                    className="kc-btn kc-btn-sm"
                  >
                    {completingId === exchange.id ? 'Saving…' : 'Mark session complete'}
                  </button>
                )}
                <Link
                  to={`/match/${exchange.id}`}
                  className="kc-btn kc-btn-ghost kc-btn-sm"
                >
                  View
                </Link>
              </div>
            </div>

            <CycleChain participants={exchange.participants} myUserId={user?.id} />

            {/* Who is still pending — shown for confirmed cycles too */}
            {!done && awaiting.length > 0 && (
              <p className="text-muted text-xs">
                {awaitingNames.length === 1 && awaitingNames[0] === 'You'
                  ? 'You have not marked your session complete yet.'
                  : `${awaitingNames.join(', ')} ${awaitingNames.length === 1 ? 'has' : 'have'} not finished yet.`}
              </p>
            )}

            {/* Completion status per participant */}
            <div className="flex flex-wrap gap-2 text-xs">
              {exchange.participants.map((p) => (
                <span
                  key={p.id}
                  className={`kc-chip ${p.completedAt ? 'kc-chip-done' : ''}`}
                >
                  {p.userId === user?.id ? 'You' : p.user.name}: {p.completedAt ? '✓ done' : 'pending'}
                </span>
              ))}
            </div>

            {/* Contact details stay visible in history */}
            <div className="rounded-xl p-4 text-sm border border-leaf/30 bg-leaf/[0.05]">
              <p className="text-leaf font-semibold mb-2">Contact details</p>
              <ul className="space-y-1">
                {others.map((p) => (
                  <li key={p.id} className="text-muted">
                    <span className="text-ink font-medium">{p.user.name}</span>
                    {p.user.avgRating != null && (
                      <span className="ml-1.5 text-[#8a5c0e]" title={`${p.user.ratingCount} rating(s)`}>
                        ★ {p.user.avgRating.toFixed(1)}
                      </span>
                    )}{' '}
                    — {p.user.email}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ratings — unlocked once the whole cycle is completed */}
            {done && (
              <div className="kc-card p-4 space-y-4">
                <p className="text-ink font-semibold text-sm">Rate your exchange partners</p>
                {rateable.length === 0 && (
                  <p className="text-muted text-xs">
                    No one to rate here — you can only rate partners you directly exchanged with.
                  </p>
                )}
                {rateable.map((p) => {
                  const key = `${exchange.id}:${p.userId}`;
                  const isRated = rated.has(key);
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-3">
                      <span className="text-muted text-sm w-32">
                        {p.user.name}
                        {p.user.avgRating != null && (
                          <span className="ml-1 text-[#8a5c0e] text-xs">★ {p.user.avgRating.toFixed(1)}</span>
                        )}
                      </span>
                      {isRated ? (
                        <span className="text-leaf text-sm">Rated ✓</span>
                      ) : (
                        <>
                          <div className="flex gap-1">
                            {STARS.map((s) => (
                              <button
                                key={s}
                                onClick={() => setRating(exchange.id, p.userId, { score: s })}
                                className={`text-lg cursor-pointer ${(ratings[key]?.score ?? 0) >= s ? 'text-[#8a5c0e]' : 'text-line'}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <input
                            value={ratings[key]?.comment ?? ''}
                            onChange={(e) => setRating(exchange.id, p.userId, { comment: e.target.value })}
                            placeholder="Optional comment"
                            className="kc-input flex-1 min-w-40"
                          />
                          <button
                            onClick={() => submitRating(exchange.id, p.userId)}
                            disabled={!ratings[key]?.score}
                            className="kc-btn kc-btn-sm"
                          >
                            Submit
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="kc-btn kc-btn-ghost text-sm"
          >
            Load older exchanges
          </button>
        </div>
      )}
    </div>
  );
}
