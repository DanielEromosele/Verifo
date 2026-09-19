import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../utils/cn";

const NAV = [
  { to: "/dashboard", label: "Dashboard", roles: ["ADMIN", "OPERATOR", "SUBMITTER"] },
  { to: "/verify", label: "Verify", roles: ["ADMIN", "OPERATOR"] },
  { to: "/screening", label: "Screening", roles: ["ADMIN", "OPERATOR"] },
  { to: "/references", label: "References", roles: ["ADMIN", "OPERATOR"] },
  { to: "/settings", label: "Settings", roles: ["ADMIN"] },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "SUBMITTER";
  const items = NAV.filter((n) => n.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#0056d2] text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 3h9l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M9.5 12h6M9.5 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-ink-900">Verifo</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    isActive ? "text-[#0056d2]" : "text-ink-600 hover:text-ink-900"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-ink-800">{user?.full_name || user?.email}</p>
              <p className="text-[11px] text-ink-500">
                {user?.organization?.name || "Organization"} · {role}
              </p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#0056d2] text-sm font-bold text-white">
              {(user?.full_name || user?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <button onClick={handleLogout} className="btn-ghost text-sm" title="Sign out">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}