import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const TYPE_LABELS = {
  match_found: 'New match proposed',
  match_accepted: 'Acceptance update',
  match_rejected: 'Proposal declined',
  session_completed: 'Exchange completed',
  new_message: 'New chat message',
  credit_session: 'Credit session',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Poll notifications every 20s while signed in
  useEffect(() => {
    if (!user) return;
    const fetchNotifs = () =>
      api
        .get('/notifications')
        .then(({ data }) => {
          setNotifications(data.notifications);
          setUnread(data.unreadCount);
        })
        .catch(() => {});
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 20000);
    return () => clearInterval(timer);
  }, [user]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (notif) => {
    if (notif.read) return;
    await api.post(`/notifications/${notif.id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const linkCls = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-500/20 text-indigo-100' : 'text-indigo-200 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <header className="bg-indigo-950/80 backdrop-blur border-b border-white/10 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center font-black text-white text-sm">
            KC
          </span>
          <span className="font-bold text-white tracking-tight">
            Kaushal<span className="text-indigo-300">Chakra</span>
          </span>
        </Link>

        {user && (
          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={linkCls}>
              Dashboard
            </NavLink>
            <NavLink to="/exchanges" className={linkCls}>
              My Exchanges
            </NavLink>
            <NavLink to="/credits" className={linkCls}>
              Credits
            </NavLink>
            <NavLink to="/skills" className={linkCls}>
              Edit Skills
            </NavLink>
            {user.isAdmin && (
              <NavLink to="/admin" className={linkCls}>
                Admin
              </NavLink>
            )}

            {/* Notifications bell */}
            <div className="relative ml-1" ref={menuRef}>
              <button
                onClick={() => setOpen((o) => !o)}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center text-indigo-200 hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Notifications"
              >
                <span className="text-lg leading-none">🔔</span>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-indigo-950 border border-white/10 rounded-xl shadow-2xl p-2 space-y-1 z-30">
                  {notifications.length > 0 && unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="w-full text-right text-xs font-medium text-indigo-300 hover:text-white px-3 py-1 cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                  {notifications.length === 0 ? (
                    <p className="text-sm text-indigo-300 px-3 py-4 text-center">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                          n.read ? 'opacity-60' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-indigo-200 font-semibold text-xs">
                            {TYPE_LABELS[n.type] || n.type}
                          </span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />}
                        </span>
                        <span className="block text-indigo-100 mt-0.5">{n.content}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="ml-3 pl-3 border-l border-white/10 flex items-center gap-3">
              <span className="text-sm text-indigo-200">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="text-xs font-medium text-indigo-300 hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
