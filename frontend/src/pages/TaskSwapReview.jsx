import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TaskSwapReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const [swap, setSwap] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [link, setLink] = useState('');

  const load = () => api.get(`/task-swaps/${id}`).then(({ data }) => { setSwap(data.swap); setMessages(data.messages||[]); setLoadError(''); }).catch(err => setLoadError(err.response?.data?.error||'Failed'));

  useEffect(()=>{ load(); const t=setInterval(load,5000); return()=>clearInterval(t); },[id]);

  const act = async (path, body) => {
    setError('');
    try { const { data } = await api.post(`/task-swaps/${id}/${path}`, body||{}); setSwap(data.swap); } catch(err){ setError(err.response?.data?.error||'Failed'); }
  };

  const send = async () => {
    if(!draft.trim()) return;
    try{ const { data } = await api.post(`/task-swaps/${id}/messages`, { content: draft }); setMessages(m=>[...m, data.message]); setDraft(''); } catch(err){ setError(err.response?.data?.error||'Failed'); }
  };

  if(loadError) return <div className="max-w-3xl mx-auto px-4 py-20 text-center"><p className="kc-alert-error inline-block">{loadError}</p><div><Link to="/tasks" className="kc-link">Back</Link></div></div>;
  if(!swap) return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted">Loading…</div>;

  const isRequester = swap.requesterId===user?.id;
  const isHelper = swap.helperId===user?.id;
  const statusBadge = swap.status==='completed' ? 'kc-badge-leaf' : swap.status==='in_progress' ? 'kc-badge-sky' : swap.status==='requested' ? 'kc-badge-amber' : swap.status==='rejected' ? 'kc-badge-clay' : 'kc-badge-neutral';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="kc-display text-3xl font-bold text-ink">Task Swap #{swap.id}</h1>
        <span className={`kc-badge ${statusBadge}`}>{swap.status}</span>
      </div>

      <div className="kc-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white border border-line rounded-xl p-4">
            <p className="text-xs font-bold uppercase text-maroon">Requested</p>
            <p className="font-bold text-ink">{swap.requestedTask.title} <span className="text-muted text-xs">({swap.requestedTask.category} · {swap.requestedTask.creditValue}c)</span></p>
            <p className="text-sm text-muted">{swap.requestedTask.description}</p>
            <p className="text-xs text-muted">by {swap.requestedTask.poster.name}</p>
            {swap.requestedTask.deliverable && <p className="text-xs mt-1"><span className="font-semibold">Deliverable:</span> {swap.requestedTask.deliverable}</p>}
          </div>
          <div className="bg-white border border-line rounded-xl p-4">
            <p className="text-xs font-bold uppercase text-leaf">Offered</p>
            {swap.offeredTask ? (
              <>
                <p className="font-bold text-ink">{swap.offeredTask.title} <span className="text-muted text-xs">({swap.offeredTask.category})</span></p>
                <p className="text-sm text-muted">{swap.offeredTask.description}</p>
                <p className="text-xs text-muted">by {swap.offeredTask.poster.name}</p>
              </>
            ) : <p className="text-sm text-muted">One-way help (no offered task)</p>}
          </div>
        </div>
        <p className="text-xs text-muted">Requester: <b className="text-ink">{swap.requester.name}</b> → Helper: <b className="text-ink">{swap.helper?.name||'—'}</b></p>
        {swap.offeredDeliverableLink && <p className="text-xs">Offered link: <a href={swap.offeredDeliverableLink} target="_blank" rel="noreferrer" className="kc-link break-all">{swap.offeredDeliverableLink}</a> {swap.offeredSubmittedAt && '(submitted)'} {swap.offeredApprovedAt && '✓ approved'}</p>}
        {swap.requestedDeliverableLink && <p className="text-xs">Requested link: <a href={swap.requestedDeliverableLink} target="_blank" rel="noreferrer" className="kc-link break-all">{swap.requestedDeliverableLink}</a> {swap.requestedSubmittedAt && '(submitted)'} {swap.requestedApprovedAt && '✓ approved'}</p>}
      </div>

      {error && <p className="kc-alert-error">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {swap.status==='requested' && isHelper && <><button onClick={()=>act('accept')} className="kc-btn kc-btn-leaf">Accept</button><button onClick={()=>act('reject')} className="kc-btn bg-clay border-[#7c2424]">Reject</button></>}
        {['accepted','in_progress','submitted'].includes(swap.status) && <button onClick={()=>act('cancel')} className="kc-btn kc-btn-ghost">Cancel</button>}
      </div>

      {['accepted','in_progress','submitted'].includes(swap.status) && (
        <div className="kc-card p-5 space-y-3">
          <h3 className="font-bold text-ink">Submit deliverable</h3>
          <input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://... or note" className="kc-input" />
          <button onClick={()=>{act('submit',{link}); setLink('');}} className="kc-btn kc-btn-sm">Submit</button>
          <p className="text-xs text-muted">Submit your side's work link/note. Other party will approve.</p>
        </div>
      )}

      {(swap.status==='submitted' || swap.status==='in_progress') && (
        <div className="kc-card p-5">
          <h3 className="font-bold text-ink mb-2">Approve</h3>
          <p className="text-xs text-muted mb-2">Approve the other party's deliverable when satisfied. Both must approve to complete.</p>
          <button onClick={()=>act('approve')} className="kc-btn kc-btn-leaf">Approve</button>
        </div>
      )}

      <div className="kc-card p-5 space-y-3">
        <h2 className="kc-display text-lg font-bold text-ink">Chat</h2>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {messages.length===0 ? <p className="text-muted text-sm">No messages yet.</p> : messages.map(m=>(
            <div key={m.id} className={`flex ${m.senderId===user?.id?'justify-end':'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${m.senderId===user?.id?'bg-maroon text-[#fff8ee]':'bg-parchment border border-line'}`}>
                <span className="block text-[10px]">{m.sender.name}</span>
                <span>{m.content}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Message..." className="kc-input flex-1" />
          <button onClick={send} className="kc-btn kc-btn-sm">Send</button>
        </div>
      </div>
    </div>
  );
}
