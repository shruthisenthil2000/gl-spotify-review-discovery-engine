"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  ["/", "Overview"],
  ["/reviews", "Reviews"],
  ["/themes", "Themes"],
  ["/segments", "Segments"],
  ["/priority", "PM Priority Radar"],
  ["/lens", "Discovery Lens"],
  ["/pulse", "Weekly Pulse"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      {/* AI engine name */}
      <div className="brand-block">
        <div className="brand-logo">🎧</div>
        <div>
          <div className="brand-name">Spotify Discovery <span className="dot">AI</span></div>
          <div className="brand-tag">Review Intelligence Engine</div>
        </div>
      </div>

      {/* main dashboard section */}
      <div className="nav-section-label">Discovery Insights Dashboard</div>
      <nav className="nav">
        {LINKS.map(([href, label]) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "active" : ""}>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="dataset-chip">Frozen v1 · 26,823 reviews analyzed</div>

      {/* profile / persona */}
      <div className="profile">
        <div className="avatar">GP</div>
        <div className="profile-meta">
          <div className="profile-name">Growth PM</div>
          <div className="profile-role">Product · Growth Team</div>
        </div>
      </div>
    </aside>
  );
}
