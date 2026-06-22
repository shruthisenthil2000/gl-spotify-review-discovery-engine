"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  ["/", "Overview"],
  ["/reviews", "Reviews"],
  ["/themes", "Themes"],
  ["/segments", "Segments"],
  ["/priority", "PM Priority Radar"],
  ["/pulse", "Weekly Pulse"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">🎧 Discovery <span className="dot">Engine</span></div>
      <div className="sub">Frozen v1 · 26,823 reviews</div>
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
      <div className="footer-note">
        Source of truth: discovery_insights_dataset.csv (frozen). Static export —
        no backend, no external APIs.
      </div>
    </aside>
  );
}
