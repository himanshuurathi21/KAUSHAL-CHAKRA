import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Account() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivatePw, setDeactivatePw] = useState('');

  const changePw = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setMsg('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      refresh().catch(() => {});
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.post('/auth/deactivate', { password: deactivatePw });
      await logout();
      navigate('/auth');
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Could not deactivate account');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="kc-display text-3xl font-bold text-ink">Account</h1>
        <p className="text-muted text-sm mt-1">{user?.name} · {user?.email}</p>
      </div>

      <form onSubmit={changePw} className="kc-card p-6 space-y-3">
        <h2 className="font-bold text-ink">Change password</h2>
        <input
          type="password"
          className="kc-input w-full"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="kc-input w-full"
          placeholder="New password (min 6 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {msg && <p className="kc-alert-ok">{msg}</p>}
        {err && !confirmDeactivate && <p className="kc-alert-error">{err}</p>}
        <button disabled={busy} className="kc-btn">
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>

      <div className="kc-card p-6 space-y-3 border-clay/30">
        <h2 className="font-bold text-clay">Deactivate account</h2>
        <p className="text-sm text-muted">
          Soft-deletes your login (history like cycles and ratings is kept for consistency).
          This signs you out immediately.
        </p>
        {!confirmDeactivate ? (
          <button onClick={() => setConfirmDeactivate(true)} className="kc-btn">
            Deactivate…
          </button>
        ) : (
          <form onSubmit={deactivate} className="space-y-3">
            <input
              type="password"
              className="kc-input w-full"
              placeholder="Confirm with your password"
              value={deactivatePw}
              onChange={(e) => setDeactivatePw(e.target.value)}
              required
            />
            {err && <p className="kc-alert-error">{err}</p>}
            <div className="flex gap-2">
              <button disabled={busy} className="kc-btn">
                {busy ? 'Deactivating…' : 'Yes, deactivate'}
              </button>
              <button type="button" onClick={() => setConfirmDeactivate(false)} className="kc-btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
