import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import ReportButton from "../components/ReportButton";

const CATEGORIES = ["Design", "Writing", "Tech Setup", "Development", "Marketing", "Tutoring", "Other"];

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [tab, setTab] = useState("browse");
  const [form, setForm] = useState({ title: "", description: "", category: "Design", creditValue: 1, deliverable: "", complexity: "M", requiredSkillId: null, deadline: "" });
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [skills, setSkills] = useState([]);
  const [swapOffer, setSwapOffer] = useState({});

  const load = () => {
    const q = filter ? `?category=${encodeURIComponent(filter)}` : "";
    api.get(`/tasks${q}`).then(({ data }) => setTasks(data.tasks)).catch(() => {});
    api.get("/task-swaps").then(({ data }) => setSwaps(data.swaps||[])).catch(()=>{});
    api.get("/skills").then(({ data }) => setSkills(data.skills||[])).catch(()=>{});
    if (user?.id) {
      api.get("/tasks").then(({ data }) => {
        const mine = data.tasks.filter(t => t.poster.id === user.id);
        setMyTasks(mine);
      }).catch(()=>{});
    }
  };
  useEffect(() => { load(); }, [filter, user?.id]);

  const create = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api.post("/tasks", form);
      setMsg("Task posted");
      setForm({ title: "", description: "", category: "Design", creditValue: 1, deliverable: "", complexity: "M" });
      load();
    } catch (e) { setErr(e.response?.data?.error || "Failed"); }
  };
  const claim = async (id) => {
    setErr(""); setMsg("");
    try {
      await api.post(`/tasks/${id}/claim`);
      setMsg("Task claimed, waiting for poster to accept");
      load();
    } catch (e) { setErr(e.response?.data?.error || "Failed"); }
  };
  const requestSwap = async (requestedTaskId) => {
    setErr(""); setMsg("");
    const offeredTaskId = swapOffer[requestedTaskId];
    if (!offeredTaskId) { setErr("Select a task you offer in return"); return; }
    try {
      const { data } = await api.post("/task-swaps", { requestedTaskId, offeredTaskId: Number(offeredTaskId) });
      setMsg(`Swap requested #${data.swap.id} — waiting for owner to accept`);
      load();
    } catch (e) { setErr(e.response?.data?.error || "Failed"); }
  };
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="kc-display text-3xl font-bold text-ink">Task Board</h1>
      <p className="text-muted text-sm">Post a task or swap: I will do your task, you do mine. Credits as fallback.</p>
      {msg && <p className="kc-alert-ok">{msg}</p>}
      {err && <p className="kc-alert-error">{err}</p>}

      <div className="flex gap-2">
        <button onClick={()=>setTab("browse")} className={`kc-btn kc-btn-sm ${tab==="browse"?"":"kc-btn-ghost"}`}>Browse</button>
        <button onClick={()=>setTab("swaps")} className={`kc-btn kc-btn-sm ${tab==="swaps"?"":"kc-btn-ghost"}`}>My Swaps ({swaps.length})</button>
        <button onClick={()=>setTab("post")} className={`kc-btn kc-btn-sm ${tab==="post"?"":"kc-btn-ghost"}`}>Post</button>
      </div>

      {tab==="post" && (
        <form onSubmit={create} className="kc-card p-5 space-y-3">
          <h2 className="font-bold text-ink">Post a Task</h2>
          <input className="kc-input" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
          <textarea className="kc-input" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required />
          <input className="kc-input" placeholder="Deliverable (e.g. 3 photos, 300dpi)" value={form.deliverable} onChange={e=>setForm({...form,deliverable:e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <select className="kc-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select className="kc-input" value={form.complexity} onChange={e=>setForm({...form,complexity:e.target.value})}>
              <option value="S">S - Simple (1c)</option>
              <option value="M">M - Medium (2c)</option>
              <option value="L">L - Large (3c)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="kc-input" value={form.requiredSkillId||""} onChange={e=>setForm({...form, requiredSkillId: e.target.value ? Number(e.target.value) : null})}>
              <option value="">Required skill (optional)</option>
              {skills.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="kc-input" type="date" value={form.deadline||""} onChange={e=>setForm({...form, deadline:e.target.value})} />
          </div>
          <div className="flex items-center gap-2">
            <input className="kc-input w-32" type="number" min="1" value={form.creditValue} onChange={e=>setForm({...form,creditValue:Number(e.target.value)})} required />
            <span className="text-xs text-muted">credits</span>
          </div>
          <button className="kc-btn">Post Task</button>
        </form>
      )}

      {tab==="swaps" ? (
        <div className="kc-card p-5">
          {swaps.length===0 ? <p className="text-muted text-sm">No swaps yet. Request a swap from Browse.</p> : (
            <ul className="space-y-2">
              {swaps.map(s=>(
                <li key={s.id} className="border border-line rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-ink">Swap #{s.id} <span className={`kc-badge ${s.status==='completed'?'kc-badge-leaf':s.status==='requested'?'kc-badge-amber':'kc-badge-neutral'}`}>{s.status}</span></p>
                    <p className="text-sm text-muted">{s.requestedTask.title} ↔ {s.offeredTask? s.offeredTask.title : 'one-way'}</p>
                    <p className="text-xs text-muted">{s.requester.name} → {s.helper?.name||'?'}</p>
                  </div>
                  <Link to={`/task-swaps/${s.id}`} className="kc-btn kc-btn-sm">View</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab==="browse" && (
        <div className="kc-card p-5">
          <div className="flex gap-2 mb-3">
            <select className="kc-input" value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {tasks.length===0 ? <p className="text-muted text-sm">No open tasks.</p> : (
            <ul className="space-y-3">
              {tasks.map(t=>(
                <li key={t.id} className="border border-line rounded-lg p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-ink">{t.title} <span className="text-muted text-xs">({t.category} - {t.creditValue}c)</span></p>
                      <p className="text-sm text-muted">{t.description}</p>
                      {t.deliverable && <p className="text-xs text-muted">Deliverable: {t.deliverable}</p>}
                      <p className="text-xs text-muted">by {t.poster.name}</p>
                      <ReportButton reportedUserId={t.poster.id} taskId={t.id} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={()=>claim(t.id)} className="kc-btn kc-btn-sm">Claim</button>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 items-center bg-parchment/50 p-2 rounded-lg">
                    <select className="kc-input text-xs py-1" value={swapOffer[t.id]||""} onChange={e=>setSwapOffer({...swapOffer, [t.id]: e.target.value})}>
                      <option value="">Offer in return — select your task</option>
                      {myTasks.map(mt=><option key={mt.id} value={mt.id}>{mt.title} ({mt.category})</option>)}
                    </select>
                    <button onClick={()=>requestSwap(t.id)} className="kc-btn kc-btn-sm kc-btn-leaf">Request Swap</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
