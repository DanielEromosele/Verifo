import { Navigate, Route, Routes } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Verify from "./pages/Verify";
import Screening from "./pages/Screening";
import References from "./pages/References";
import Settings from "./pages/Settings";
import Shell from "./components/Shell";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ink-100 border-brand-600" />
        <p className="text-sm text-ink-600">Loading workspace…</p>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/screening" element={<Screening />} />
        <Route path="/references" element={<References />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}