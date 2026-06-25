"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

// Horizontal workspace tabs shown on every page (mirrors the left sidebar).
const TABS: [string, string, string][] = [
  ["/", "🗂️", "Overview"],
  ["/lens", "🔍", "Discovery Lens"],
  ["/priority", "🎯", "PM Priority Radar"],
  ["/pilot", "🤖", "Discovery Copilot"],
];

export default function TopTabs() {
  const path = usePathname();
  return (
    <div className="top-tabs-row">
      <nav className="top-tabs">
        {TABS.map(([href, emoji, label]) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={`top-tab ${active ? "active" : ""}`}>
              <span className="tt-emoji">{emoji}</span>{label}
            </Link>
          );
        })}
      </nav>
      {path === "/" && (
        <button className="fetch-live-big" onClick={() => window.dispatchEvent(new CustomEvent("fetch-live-reviews"))}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Fetch Live Reviews
        </button>
      )}
    </div>
  );
}
