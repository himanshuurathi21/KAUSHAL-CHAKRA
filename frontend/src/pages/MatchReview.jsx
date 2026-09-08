import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import CycleChain from '../components/CycleChain';
import { useAuth } from '../context/AuthContext';

export default function MatchReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatDead, setChatDead] = useState(false);
  const chatBoxRef = useRef(null);
  const sendingRef = useRef(false);
  const firstChatLoadRef = useRef(true);
  const chatFailuresRef = useRef(0);
  const lastSeenIdRef = useRef(0);

  const load = () =>
    api
      .get(`/match/cycle/${id}`)
      .then(({ data }) => {
        setCycle(data.cycle);
        setLoadError('');
      })
      .catch((err) => {
        setCycle(null);
        setLoadError(err.response?.data?.error || 'Failed to load this cycle');
      });

  useEffect(() => {
    load();
  }, [id]);

  // While the cycle is still proposed, poll its status so the page flips to
  // confirmed (chat + contact info unlock) without a manual reload.
  useEffect(() => {
    if (!cycle || cycle.status !== 'proposed') return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [id, cycle?.status]);

  // Poll the chat every 5s while on a confirmed/completed cycle.
  // Incremental: each follow-up asks only for messages newer than the last seen.
  useEffect(() => {
    if (!cycle || !['confirmed', 'completed'].includes(cycle.status)) return;
    firstChatLoadRef.current = true;
    chatFailuresRef.current = 0;
    lastSeenIdRef.current = 0;
    setChatDead(false);
    setChatLoading(true);
    setMessages([]);
    const onOk = (list, initial) => {
      chatFailuresRef.current = 0;
      setChatLoading(false);
      setMessages((prev) => {
        if (initial) return list;
        if (list.length === 0) return prev;
        const seen = new Set(prev.map((m) => m.id));
        const fresh = list.filter((m) => !seen.has(m.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    };
    const onFail = () => {
      setChatLoading(false);
      chatFailuresRef.current += 1;
      if (chatFailuresRef.current >= 3) setChatDead(true);
    };
    api
      .get(`/cycles/${id}/messages`, { params: { limit: 100 } })
      .then(({ data }) => onOk(data.messages, true))
      .catch(onFail);
    const timer = setInterval(() => {
      api
        .get(`/cycles/${id}/messages`, { params: { sinceId: lastSeenIdRef.current, limit: 100 } })
        .then(({ data }) => onOk(data.messages, false))
        .catch(onFail);
    }, 5000);
    return () => clearInterval(timer);
  }, [id, cycle?.status]);

  // Keep the incremental cursor + auto-scroll in sync with rendered messages.
  // First load jumps to the bottom; afterwards we only follow when the user
  // is already near the bottom.
  useEffect(() => {
    const box = chatBoxRef.current;
    if (!box) return;
    if (messages.length > 0) {
      lastSeenIdRef.current = messages[messages.length - 1].id;
    }
    if (firstChatLoadRef.current) {
      firstChatLoadRef.current = false;
      box.scrollTop = box.scrollHeight;
      return;
    }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }, [messages]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setChatBusy(true);
    setChatError('');
    setError('');
    try {
      const { data } = await api.post(`/cycles/${id}/messages`, { content });
      chatFailuresRef.current = 0;
      setChatDead(false);
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      setDraft('');
    } catch (err) {
      setChatError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setChatBusy(false);
      sendingRef.current = false;
    }
  };

  const act = async (action) => {
    setError('');
    setBusy(true);
    try {
      await api.post(`/match/cycle/${id}/${action}`);
      await load();
      if (action === 'reject') navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-rose-300">{loadError}</p>
        <Link to="/" className="inline-block text-indigo-300 underline text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!cycle) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-indigo-200">Loading cycle…</div>;
  }

  const my = cycle.participants.find((p) => p.userId === user?.id);
  const proposed = cycle.status === 'proposed';
  const confirmed = cycle.status === 'confirmed';
  const done = cycle.status === 'completed';
  const allAccepted = cycle.participants.every((p) => p.accepted === true);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exchange cycle #{cycle.id}</h1>
          <p className="text-indigo-200 text-sm mt-1">
            {done
              ? 'Everyone finished their side — this exchange is complete. Thanks for participating!'
              : confirmed
                ? 'Everyone accepted — this exchange is confirmed. Contact info is unlocked below.'
                : 'Each person teaches the next skill in the loop. Everyone must accept for the cycle to confirm.'}
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            done || confirmed || allAccepted
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/20 text-amber-300'
          }`}
        >
          {done ? '✓ Completed' : confirmed ? '✓ Confirmed' : allAccepted ? '✓ All accepted' : '⏳ Proposed'}
        </span>
      </div>

      <CycleChain participants={cycle.participants} myUserId={user?.id} />

      {/* Acceptance status per participant */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-3">Acceptance status</h2>
        <ul className="space-y-2">
          {cycle.participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-indigo-200">
                {p.userId === user?.id ? <b className="text-amber-300">You</b> : p.user.name}
                {p.userId !== user?.id && p.user.avgRating != null && (
                  <span className="ml-1.5 text-amber-300 text-xs" title={`${p.user.ratingCount} rating(s)`}>
                    ⭐ {p.user.avgRating.toFixed(1)}
                  </span>
                )}
                <span className="text-indigo-300/70"> — teaches {p.teachesSkill.name}</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  p.accepted === true
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : p.accepted === false
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-white/10 text-indigo-300'
                }`}
              >
                {p.accepted === true ? 'Accepted' : p.accepted === false ? 'Rejected' : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact info — only revealed after confirmation */}
      {(confirmed || done) && (
        <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-3">🔓 Contact details unlocked</h2>
          <ul className="space-y-2 text-sm">
            {cycle.participants
              .filter((p) => p.userId !== user?.id)
              .map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-white font-medium">{p.user.name}</span>
                  <span className="text-indigo-300">{p.user.email}</span>
                  <span className="text-indigo-300/70">({p.user.department ?? '—'})</span>
                  <span className="text-indigo-300/60">teaches {p.teachesSkill.name}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">{error}</p>
      )}

      {proposed && (
        <div className="flex gap-3">
          <button
            onClick={() => act('accept')}
            disabled={busy || my?.accepted === true}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {my?.accepted === true ? 'Accepted ✓ (awaiting others)' : 'Accept exchange'}
          </button>
          <button
            onClick={() => act('reject')}
            disabled={busy}
            className="flex-1 py-3 rounded-lg bg-rose-500/15 border border-rose-400/40 text-rose-300 font-semibold hover:bg-rose-500/25 disabled:opacity-50 cursor-pointer"
          >
            Reject
          </button>
        </div>
      )}

      {(confirmed || done) && (
        <div className="text-center">
          <Link
            to="/exchanges"
            className="inline-block px-8 py-3 rounded-lg bg-white/5 border border-white/10 text-indigo-200 hover:text-white"
          >
            Go to My Exchanges
          </Link>
        </div>
      )}

      {/* Exchange chat — available once confirmed */}
      {(cycle.status === 'confirmed' || cycle.status === 'completed') && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h2 className="text-white font-semibold">💬 Exchange chat</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1" ref={chatBoxRef}>
            {chatLoading && messages.length === 0 && (
              <p className="text-indigo-300/70 text-sm">Loading messages…</p>
            )}
            {!chatLoading && messages.length === 0 && (
              <p className="text-indigo-300/70 text-sm">No messages yet. Say hi to your partners!</p>
            )}
            {messages.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                      mine
                        ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white rounded-br-sm'
                        : 'bg-white/10 text-indigo-100 rounded-bl-sm'
                    }`}
                  >
                    {!mine && <span className="block text-[10px] text-indigo-300 mb-0.5">{m.sender.name}</span>}
                    <span>{m.content}</span>
                    <span className="block text-[9px] text-indigo-300/60 mt-0.5">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {chatDead && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
              Chat is unavailable right now — your messages are safe. Refresh the page to reconnect.
            </p>
          )}
          {chatError && (
            <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">{chatError}</p>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={1000}
              placeholder="Type a message…"
              className="flex-1 bg-indigo-900/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-indigo-400/50 outline-none focus:border-indigo-400/60"
            />
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={send}
                disabled={chatBusy || !draft.trim()}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                Send
              </button>
              <span className="text-[10px] text-indigo-400/50">{draft.length}/1000</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
