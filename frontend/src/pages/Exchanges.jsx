import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CycleChain from '../components/CycleChain';
import { useAuth } from '../context/AuthContext';

const STARS = [1, 2, 3, 4, 5];
const RATED_KEY = 'kc_rated';

// Matches the backend rule (ratingService.canRateEachOther): you may only
// rate someone you directly taught or learned from in this exchange.
const canRate = (a, b) =>
  a.learnsSkillId === b.teachesSkillId || a.teachesSkillId === b.learnsSkillId;

function loadRated() {
  try {
    return new Set(JSON.parse(localStorage.getItem(RATED_KEY)) || []);
  } catch {
    return new Set();
  }
}

const PAGE_SIZE = 10;

export default function Exchanges() {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [rated, setRated] = useState(loadRated);
  const [ratings, setRatings] = useState({}); // `${cycleId}:${rateeId}` -> { score, comment }

  const persistRated = (next) => {
    setRated(next);
    localStorage.setItem(RATED_KEY, JSON.stringify([...next]));
  };

  const load = (offset = 0, append = false) =>
    api
      .get(`/match/exchanges?limit=${PAGE_SIZE}&offset=${offset}`)
      .then(({ data }) => {
        setExchanges((prev) => {
          const next = append ? [...prev, ...data.exchanges] : data.exchanges;
          return [...new Map(next.map((e) => [e.id, e])).values()];
        });
        setHasMore(data.exchanges.length === PAGE_SIZE);
      })
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
  }, []);

  const loadMore = () => load(exchanges.length, true);

  const complete = async (cycleId) => {
    await api.post(`/cycles/${cycleId}/complete`);
    load();
  };

  const submitRating = async (cycleId, rateeId) => {
    const key = `${cycleId}:${rateeId}`;
    const { score, comment } = ratings[key] || {};
    if (!score) return;
    try {
      await api.post('/ratings', { cycleId, rateeId, score, comment });
      persistRated(new Set(rated).add(key));
    } catch (err) {
      // already rated this cycle → treat as done
      if (err.response?.status === 409) persistRated(new Set(rated).add(key));
    }
  };

  const setRating = (cycleId, rateeId, patch) =>
    setRatings((prev) => ({ ...prev, [`${cycleId}:${rateeId}`]: { ...prev[`${cycleId}:${rateeId}`], ...patch } }));

  if (!loaded) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-indigo-200">Loading…</div>;
  }

  if (exchanges.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">My Exchanges</h1>
        <p className="text-indigo-200">No confirmed exchanges yet.</p>
        <Link to="/" className="text-indigo-300 underline text-sm">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-white">My Exchanges</h1>

      {exchanges.map((exchange) => {
        const done = exchange.status === 'completed';
        const me = exchange.participants.find((p) => p.userId === user.id);
        const others = exchange.participants.filter((p) => p.userId !== user.id);
        const rateable = others.filter((p) => canRate(me, p));
        const awaiting = exchange.participants.filter((p) => !p.completedAt);
        const awaitingNames = awaiting.map((a) => (a.userId === user.id ? 'You' : a.user.name));

        return (
          <div key={exchange.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Cycle #{exchange.id}</h2>
              <div className="flex items-center gap-2">
                {done ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                    ✓ Completed
                  </span>
                ) : me?.completedAt ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300">
                    ⏳ Waiting for others
                  </span>
                ) : (
                  <button
                    onClick={() => complete(exchange.id)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
                  >
                    Mark session complete
                  </button>
                )}
                <Link
                  to={`/match/${exchange.id}`}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-indigo-200 text-xs hover:text-white"
                >
                  View
                </Link>
              </div>
            </div>

            <CycleChain participants={exchange.participants} myUserId={user.id} />

            {/* Completion status per participant */}
            <div className="flex flex-wrap gap-2 text-xs">
              {exchange.participants.map((p) => (
                <span
                  key={p.id}
                  className={`px-2.5 py-1 rounded-full border font-medium ${
                    p.completedAt
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-indigo-300'
                  }`}
                >
                  {p.userId === user.id ? 'You' : p.user.name}: {p.completedAt ? '✓ done' : 'pending'}
                </span>
              ))}
            </div>

            {/* Contact details stay visible in history */}
            <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4 text-sm">
              <p className="text-emerald-300 font-semibold mb-2">🔓 Contact details</p>
              <ul className="space-y-1">
                {others.map((p) => (
                  <li key={p.id} className="text-indigo-200">
                    <span className="text-white font-medium">{p.user.name}</span>
                    {p.user.avgRating != null && (
                      <span className="ml-1.5 text-amber-300" title={`${p.user.ratingCount} rating(s)`}>
                        ⭐ {p.user.avgRating.toFixed(1)}
                      </span>
                    )}{' '}
                    — {p.user.email}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ratings — unlocked once the whole cycle is completed */}
            {done && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                <p className="text-white font-semibold text-sm">Rate your exchange partners</p>
                {rateable.length === 0 && (
                  <p className="text-indigo-300/70 text-xs">
                    No one to rate here — you can only rate partners you directly exchanged with.
                  </p>
                )}
                {rateable.map((p) => {
                  const key = `${exchange.id}:${p.userId}`;
                  const isRated = rated.has(key);
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-3">
                      <span className="text-indigo-200 text-sm w-32">
                        {p.user.name}
                        {p.user.avgRating != null && (
                          <span className="ml-1 text-amber-300 text-xs">⭐ {p.user.avgRating.toFixed(1)}</span>
                        )}
                      </span>
                      {isRated ? (
                        <span className="text-emerald-300 text-sm">Rated ✓</span>
                      ) : (
                        <>
                          <div className="flex gap-1">
                            {STARS.map((s) => (
                              <button
                                key={s}
                                onClick={() => setRating(exchange.id, p.userId, { score: s })}
                                className={`text-lg cursor-pointer ${(ratings[key]?.score ?? 0) >= s ? 'text-amber-300' : 'text-indigo-400/40'}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <input
                            value={ratings[key]?.comment ?? ''}
                            onChange={(e) => setRating(exchange.id, p.userId, { comment: e.target.value })}
                            placeholder="Optional comment"
                            className="flex-1 min-w-40 bg-indigo-900/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-indigo-400/50 outline-none focus:border-indigo-400/60"
                          />
                          <button
                            onClick={() => submitRating(exchange.id, p.userId)}
                            disabled={!ratings[key]?.score}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                          >
                            Submit
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {awaiting.length > 0 && (
                  <p className="text-indigo-300/70 text-xs">
                    {awaitingNames.length === 1 && awaitingNames[0] === 'You'
                      ? 'You have not finished yet.'
                      : `${awaitingNames.join(', ')} ${awaitingNames.length === 1 ? 'has' : 'have'} not finished yet.`}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-indigo-200 hover:text-white text-sm cursor-pointer"
          >
            Load older exchanges
          </button>
        </div>
      )}
    </div>
  );
}
