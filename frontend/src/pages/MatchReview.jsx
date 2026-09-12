import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import CycleChain from '../components/CycleChain';
import ReportButton from '../components/ReportButton';
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
        <p className="kc-alert-error inline-block">{loadError}</p>
        <div>
          <Link to="/" className="kc-link text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!cycle) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted">Loading cycle…</div>;
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
          <h1 className="kc-display text-3xl font-bold text-ink">Exchange cycle #{cycle.id}</h1>
          <p className="text-muted text-sm mt-1">
            {done
              ? 'Everyone finished their side — this exchange is complete. Thanks for participating!'
              : confirmed
                ? 'Everyone accepted — this exchange is confirmed. Contact info is unlocked below.'
                : 'Each person teaches the next skill in the loop. Everyone must accept for the cycle to confirm.'}
          </p>
        </div>
        <span
          className={`kc-badge ${
            done || confirmed || allAccepted ? 'kc-badge-leaf' : 'kc-badge-amber'
          }`}
        >
          {done ? '✓ Completed' : confirmed ? '✓ Confirmed' : allAccepted ? '✓ All accepted' : '⏳ Proposed'}
        </span>
      </div>

      <CycleChain participants={cycle.participants} myUserId={user?.id} />

      {/* Acceptance status per participant */}
      <div className="kc-card p-5">
        <h2 className="kc-display text-lg text-ink font-bold mb-3">Acceptance status</h2>
        <ul className="space-y-2">
          {cycle.participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {p.userId === user?.id ? <b className="text-maroon">You</b> : <span className="text-ink font-medium">{p.user.name}</span>}
                {p.userId !== user?.id && p.user.avgRating != null && (
                  <span className="ml-1.5 text-[#8a5c0e] text-xs" title={`${p.user.ratingCount} rating(s)`}>
                    ★ {p.user.avgRating.toFixed(1)}
                  </span>
                )}
                <span className="text-muted"> — teaches {p.teachesSkill.name}</span>
              </span>
              <span
                className={`kc-badge ${
                  p.accepted === true
                    ? 'kc-badge-leaf'
                    : p.accepted === false
                      ? 'kc-badge-clay'
                      : 'kc-badge-neutral'
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
        <div className="kc-card p-5 border-leaf/40 bg-leaf/[0.05]">
          <h2 className="kc-display text-lg text-ink font-bold mb-3">Contact details unlocked</h2>
          <ul className="space-y-2 text-sm">
            {cycle.participants
              .filter((p) => p.userId !== user?.id)
              .map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-ink font-medium">{p.user.name}</span>
                  <span className="text-muted">{p.user.email}</span>
                  <span className="text-muted/70">({p.user.department ?? '—'})</span>
                  <span className="text-muted">teaches {p.teachesSkill.name}</span>
                  <ReportButton reportedUserId={p.userId} cycleId={cycle.id} />
                </li>
              ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="kc-alert-error">{error}</p>
      )}

      {proposed && (
        <div className="flex gap-3">
          <button
            onClick={() => act('accept')}
            disabled={busy || my?.accepted === true}
            className="kc-btn kc-btn-leaf flex-1"
          >
            {my?.accepted === true ? 'Accepted ✓ (awaiting others)' : 'Accept exchange'}
          </button>
          <button
            onClick={() => act('reject')}
            disabled={busy}
            className="kc-btn flex-1 bg-clay border-[#7c2424] hover:bg-[#8a2a2a]"
          >
            Reject
          </button>
        </div>
      )}

      {(confirmed || done) && (
        <div className="text-center">
          <Link to="/exchanges" className="kc-btn kc-btn-ghost">
            Go to My Exchanges
          </Link>
        </div>
      )}

      {/* Exchange chat — available once confirmed */}
      {(cycle.status === 'confirmed' || cycle.status === 'completed') && (
        <div className="kc-card p-5 space-y-3">
          <h2 className="kc-display text-lg text-ink font-bold">Exchange chat</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1" ref={chatBoxRef}>
            {chatLoading && messages.length === 0 && (
              <p className="text-muted text-sm">Loading messages…</p>
            )}
            {!chatLoading && messages.length === 0 && (
              <p className="text-muted text-sm">No messages yet. Say hi to your partners!</p>
            )}
            {messages.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                      mine
                        ? 'bg-maroon text-[#fff8ee] rounded-br-sm'
                        : 'bg-parchment text-ink rounded-bl-sm border border-line'
                    }`}
                  >
                    {!mine && <span className="block text-[10px] text-muted mb-0.5">{m.sender.name}</span>}
                    <span>{m.content}</span>
                    <span className={`block text-[9px mt-0.5 ${mine ? 'text-[#fff8ee]/70' : 'text-muted/70'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {chatDead && (
            <p className="kc-alert-warn">
              Chat is unavailable right now — your messages are safe. Refresh the page to reconnect.
            </p>
          )}
          {chatError && (
            <p className="kc-alert-error">{chatError}</p>
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
              className="kc-input flex-1"
            />
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={send}
                disabled={chatBusy || !draft.trim()}
                className="kc-btn kc-btn-sm"
              >
                Send
              </button>
              <span className="text-[10px] text-muted">{draft.length}/1000</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
