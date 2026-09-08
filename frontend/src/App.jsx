import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SetupSkills from './pages/SetupSkills';
import MatchReview from './pages/MatchReview';
import Exchanges from './pages/Exchanges';
import Admin from './pages/Admin';
import Credits from './pages/Credits';
import Verify from './pages/Verify';

function LoadingGate() {
  return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-indigo-200">Loading…</div>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingGate />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingGate />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-paper text-ink">
          <Navbar />
          <main className="min-h-[calc(100vh-60px)]">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Protected><Dashboard /></Protected>} />
              <Route path="/skills" element={<Protected><SetupSkills /></Protected>} />
              <Route path="/match/:id" element={<Protected><MatchReview /></Protected>} />
              <Route path="/exchanges" element={<Protected><Exchanges /></Protected>} />
              <Route path="/credits" element={<Protected><Credits /></Protected>} />
              <Route path="/verify" element={<Protected><Verify /></Protected>} />
              <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
