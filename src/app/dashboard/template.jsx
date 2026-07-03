'use client'

// Next.js remounts template.jsx on every navigation within this segment
// (unlike layout.jsx, which persists) — giving each page a subtle, cheap
// entrance without animating the sidebar/topbar chrome around it.
export default function DashboardTemplate({ children }) {
  return <div className="route-fade">{children}</div>
}
