import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Shell from "./components/Shell";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader label="Loading workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}