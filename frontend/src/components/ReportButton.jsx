import { useState } from "react";
import api from "../api/client";

export default function ReportButton({ reportedUserId, taskId, cycleId }) {
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!reason.trim()) { setErr("Reason required"); return; }
    try {
      await api.post("/reports", { reportedUserId, reason, taskId, cycleId });
      setDone(true);
      setErr("");
    } catch (e) { setErr(e.response?.data?.error || "Failed"); }
  };
  if (done) return <span className="text-leaf text-xs">Reported</span>;
  return (
    <div className="flex gap-1 items-center">
      <input className="kc-input text-xs py-1" placeholder="Reason" value={reason} onChange={e=>setReason(e.target.value)} />
      <button onClick={submit} className="kc-btn kc-btn-sm text-xs">Report</button>
      {err && <span className="text-red-500 text-xs">{err}</span>}
    </div>
  );
}
