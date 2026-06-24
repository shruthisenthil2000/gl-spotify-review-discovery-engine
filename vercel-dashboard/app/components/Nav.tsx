"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

// 5-item primary nav (Discovery IQ). PM Priority Radar is a first-class nav
// item — prioritisation is core to this PM project.
const LINKS = [
  ["/", "Overview"],
  ["/lens", "Analytics"],
  ["/themes", "Theme Intelligence"],
  ["/priority", "PM Priority Radar"],
  ["/pilot", "Discovery Copilot"],
];

function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-label="Spotify">
      <circle cx="12" cy="12" r="12" fill="#000" />
      <g fill="none" stroke="#1ed760" strokeWidth="1.8" strokeLinecap="round">
        <path d="M6 9.2c4-1.1 8.2-.7 11.6 1.2" /><path d="M6.8 12.4c3.3-.9 6.8-.5 9.6 1.1" />
        <path d="M7.6 15.3c2.6-.7 5.4-.4 7.6.9" />
      </g>
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-logo"><SpotifyMark /></div>
        <div>
          <div className="brand-name">Discovery <span className="dot">IQ</span></div>
          <div className="brand-tag">Spotify Intelligence</div>
        </div>
      </div>

      <div className="nav-section-label">Workspace</div>
      <nav className="nav">
        {LINKS.map(([href, label]) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "active" : ""}>{label}</Link>
          );
        })}
      </nav>

      <div className="info-card">
        <div className="info-title">AI Voice-of-Customer</div>
        <div className="info-body">Real reviews from Google Play, App Store, Reddit &amp; Community — analyzed with RAG.</div>
      </div>

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
