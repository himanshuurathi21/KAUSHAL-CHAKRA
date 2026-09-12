import { useEffect, useState } from "react";
import api from "../api/client";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = () => api.get("/admin/reports").then(({ data }) => setReports(data.reports)).catch(() => {});
  useEffect(() => { load(); }, []);
  const resolve = async (id, action) => {
    setErr(""); setMsg("");
    try {
      await api.post(`/admin/reports/${id}/resolve`, { action });
      setMsg(`Report ${action} done`);
      load();
    } catch (e) { setErr(e.response?.data?.error || "Failed"); }
  };
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
      <h1 className="kc-display text-2xl font-bold text-ink">Report Queue</h1>
      {msg && <p className="kc-alert-ok">{msg}</p>}
      {err && <p className="kc-alert-error">{err}</p>}
      {reports.length===0 ? <p className="text-muted text-sm">No pending reports.</p> : (
        <ul className="space-y-2">
          {reports.map(r=>(
            <li key={r.id} className="kc-card p-4">
              <p className="text-sm text-ink"><b>{r.reporter.name}</b> reported <b>{r.reportedUser.name}</b></p>
              <p className="text-sm text-muted">Reason: {r.reason}</p>
              <p className="text-xs text-muted">Task: {r.task?.title || "N/A"} Cycle: {r.cycle?.id || "N/A"}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={()=>resolve(r.id,"warning")} className="kc-btn kc-btn-sm">Warning</button>
                <button onClick={()=>resolve(r.id,"removal")} className="kc-btn kc-btn-sm bg-amber-600">Removal</button>
                <button onClick={()=>resolve(r.id,"credit_hold")} className="kc-btn kc-btn-sm bg-red-600">Credit Hold</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
