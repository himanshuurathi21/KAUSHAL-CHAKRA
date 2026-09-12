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
  verification: 'Skill verification',
};

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/exchanges', label: 'My Exchanges' },
  { to: '/credits', label: 'Credits' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/verify', label: 'Verify Skills' },
  { to: '/skills', label: 'Edit Skills' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [credits, setCredits] = useState(null);
  const bellDesktopRef = useRef(null);
  const bellMobileRef = useRef(null);

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
  }, [user?.id]);

  // Credit wallet (Phase 1)
  useEffect(() => {
    if (!user) { setCredits(null); return; }
    api.get('/credits/progress').then(({ data }) => setCredits(data.balance)).catch(() => {
      api.get('/credits').then(({ data }) => setCredits(data.balance)).catch(() => {});
    });
  }, [user?.id]);

  // Close the dropdown when clicking outside (either bell instance)
  useEffect(() => {
    const onClick = (e) => {
      const inDesktop = bellDesktopRef.current?.contains(e.target);
      const inMobile = bellMobileRef.current?.contains(e.target);
      if (!inDesktop && !inMobile) setOpen(false);
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
      isActive ? 'bg-maroon/10 text-maroon' : 'text-muted hover:bg-parchment hover:text-ink'
    }`;

  return (
    <header className="bg-card/95 backdrop-blur border-b border-line sticky top-0 z-20">
      <div className={`w-full px-4 sm:px-6 py-3 flex items-center ${user ? 'justify-between' : 'justify-center'}`}>
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/k-logo.png" alt="KaushalChakra" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white p-1 shadow-sm border border-line" />
          <span className="kc-display font-bold text-ink text-lg sm:text-xl tracking-tight whitespace-nowrap">Kaushal Chakra</span>
        </Link>

        {user && (
          <>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-2">
              {NAV_LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
                  {l.label}
                </NavLink>
              ))}
              {user.isAdmin && (
                <>
                  <NavLink to="/admin" className={linkCls}>
                    Admin
                  </NavLink>
                  <NavLink to="/reports" className={linkCls}>
                    Reports
                  </NavLink>
                </>
              )}

              {/* Credit wallet */}
              <Link to="/credits" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-maroon/10 border border-maroon/15 text-maroon text-xs font-bold">
                <span>💰</span> {credits !== null ? credits : '…'}
              </Link>

              {/* Notifications bell */}
              <div className="relative ml-1" ref={bellDesktopRef}>
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-parchment hover:text-ink cursor-pointer"
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-line rounded-xl shadow-xl p-2 space-y-1 z-30">
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="w-full text-right text-xs font-medium text-maroon hover:text-maroon-deep px-3 py-1 cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted px-3 py-4 text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <NotificationItem key={n.id} notif={n} onRead={markRead} onNavigate={() => setOpen(false)} />
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="ml-3 pl-3 border-l border-line hidden md:flex items-center gap-3">
                <span className="text-sm text-ink">
                  {user.name}
                </span>
                <button
                  onClick={logout}
                  className="text-xs font-medium text-muted hover:text-maroon transition-colors"
                >
                  Logout
                </button>
              </div>
            </nav>

            {/* Mobile: bell + hamburger */}
            <div className="flex md:hidden items-center gap-1">
              <div className="relative" ref={bellMobileRef}>
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-parchment hover:text-ink cursor-pointer"
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {open && (
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto bg-card border border-line rounded-xl shadow-xl p-2 space-y-1 z-30">
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="w-full text-right text-xs font-medium text-maroon hover:text-maroon-deep px-3 py-1 cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted px-3 py-4 text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <NotificationItem key={n.id} notif={n} onRead={markRead} onNavigate={() => setOpen(false)} />
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-parchment hover:text-ink cursor-pointer"
                aria-label="Menu"
              >
                <span className="text-xl leading-none">{menuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {user && menuOpen && (
        <nav className="md:hidden border-t border-line px-4 py-2 space-y-1 bg-card">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-maroon/10 text-maroon' : 'text-ink hover:bg-parchment'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {user.isAdmin && (
            <>
              <NavLink
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-maroon/10 text-maroon' : 'text-ink hover:bg-parchment'
                  }`
                }
              >
                Admin
              </NavLink>
              <NavLink
                to="/reports"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-maroon/10 text-maroon' : 'text-ink hover:bg-parchment'
                  }`
                }
              >
                Reports
              </NavLink>
            </>
          )}
          <div className="flex items-center justify-between px-3 py-2 border-t border-line">
            <span className="text-sm text-ink truncate">{user.name}</span>
            <button onClick={logout} className="text-xs font-medium text-muted hover:text-maroon">
              Logout
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

function NotificationItem({ notif: n, onRead, onNavigate }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-ink font-semibold text-xs">
          {TYPE_LABELS[n.type] || n.type}
        </span>
        {!n.read && <span className="w-2 h-2 rounded-full bg-maroon shrink-0" />}
      </span>
      <span className="block text-muted mt-0.5">{n.content}</span>
    </>
  );
  const cls = `block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
    n.read ? 'opacity-60' : 'bg-parchment/60 hover:bg-parchment'
  }`;
  const handle = () => {
    onRead(n);
    onNavigate();
  };
  if (n.link) {
    return (
      <Link to={n.link} onClick={handle} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button onClick={() => onRead(n)} className={cls}>
      {body}
    </button>
  );
}
