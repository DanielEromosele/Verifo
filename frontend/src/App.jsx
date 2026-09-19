import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Shell from "./components/Shell";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader label="Loading workspace…" />;
  if (!user) return <DemoUnavailable />;
  return children;
}

function DemoUnavailable() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 p-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-brand-300">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-ink-900">Demo session unavailable</h1>
      <p className="max-w-sm text-sm text-ink-600">
        The demo login is only enabled in development. Start the backend with the
        Development config and refresh.
      </p>
      <button onClick={() => navigate(0)} className="btn-secondary">
        Retry
      </button>
      <Link to="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
        Back to home
      </Link>
    </div>
  );
}

function FullPageLoader({ label }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ink-100 border-t-brand-600" />
      <p className="text-sm text-ink-600">{label}</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}