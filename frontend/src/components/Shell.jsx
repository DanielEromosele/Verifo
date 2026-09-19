import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../utils/cn";

const NAV = [
  { to: "/dashboard", label: "Dashboard", end: true },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-6 py-5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-brand-300">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 3h9l4 4v14H6V3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 12h6M9.5 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-white">Verifo</p>
        <p className="text-[11px] text-ink-300">Document Verification</p>
      </div>
    </div>
  );
}

export default function Shell() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink-900 text-white lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "block rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-ink-800 text-white" : "text-ink-300 hover:bg-ink-800/60 hover:text-white"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-800 p-4">
          <p className="truncate text-xs font-semibold text-white">{user?.full_name || user?.email}</p>
          <p className="truncate text-[11px] text-ink-300">
            {user?.organization?.name || "Organization"} · {user?.role || "Member"}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}