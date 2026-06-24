"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

// Horizontal workspace tabs shown on every page (mirrors the left sidebar).
const TABS: [string, string, string][] = [
  ["/", "🗂️", "Overview"],
  ["/lens", "📊", "Analytics"],
  ["/themes", "🏷️", "Theme Intelligence"],
  ["/priority", "🎯", "PM Priority Radar"],
  ["/pilot", "🤖", "Discovery Copilot"],
];

export default function TopTabs() {
  const path = usePathname();
  return (
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
  );
}
