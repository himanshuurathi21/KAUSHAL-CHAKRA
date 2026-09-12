import { useEffect, useState } from "react";
import api from "../api/client";
import ReportButton from "../components/ReportButton";

const CATEGORIES = ["Design", "Writing", "Tech Setup", "Development", "Marketing", "Tutoring", "Other"];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "Design", creditValue: 1 });
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    const q = filter ? `?category=${encodeURIComponent(filter)}` : "";
    api.get(`/tasks${q}`).then(({ data }) => setTasks(data.tasks)).catch(() => {});
  };
  useEffect(() => { load(); }, [filter]);

  const create = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api.post("/tasks", form);
      setMsg("Task posted");
      setForm({ title: "", description: "", category: "Design", creditValue: 1 });
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
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="kc-display text-3xl font-bold text-ink">Task Board</h1>
      <p className="text-muted text-sm">Post a task or claim one. Credits move on completion.</p>
      {msg && <p className="kc-alert-ok">{msg}</p>}
      {err && <p className="kc-alert-error">{err}</p>}
      <form onSubmit={create} className="kc-card p-5 space-y-3">
        <h2 className="font-bold text-ink">Post a Task</h2>
        <input className="kc-input" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
        <textarea className="kc-input" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required />
        <select className="kc-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
          {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <input className="kc-input" type="number" min="1" value={form.creditValue} onChange={e=>setForm({...form,creditValue:Number(e.target.value)})} required />
        <button className="kc-btn">Post Task</button>
      </form>
      <div className="kc-card p-5">
        <div className="flex gap-2 mb-3">
          <select className="kc-input" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {tasks.length===0 ? <p className="text-muted text-sm">No open tasks.</p> : (
          <ul className="space-y-2">
            {tasks.map(t=>(
              <li key={t.id} className="border border-line rounded-lg p-3 flex justify-between items-center gap-2">
                <div>
                  <p className="font-bold text-ink">{t.title} <span className="text-muted text-xs">({t.category} - {t.creditValue} credits)</span></p>
                  <p className="text-sm text-muted">{t.description}</p>
                  <p className="text-xs text-muted">by {t.poster.name}</p>
                  <ReportButton reportedUserId={t.poster.id} taskId={t.id} />
                </div>
                <button onClick={()=>claim(t.id)} className="kc-btn kc-btn-sm">Claim</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
