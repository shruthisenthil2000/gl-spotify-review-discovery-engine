"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { PROJECT, getSummary, getExtra } from "@/lib/data";

export default function TopHeader() {
  const path = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const sync = async () => {
    setSyncing(true);
    try { await Promise.all([getSummary(), getExtra()]); setSyncedAt(new Date().toLocaleTimeString()); }
    finally { setSyncing(false); }
  };
  const fetchLive = () => {
    window.dispatchEvent(new CustomEvent("fetch-live-reviews"));
    setFetched(true);
  };
  return (
    <div className="apphdr">
      <div>
        <div className="apphdr-title">🎧 <span className="apphdr-name">{PROJECT.title}</span> <span className="ai-badge">⚡ AI-POWERED</span></div>
        <div className="apphdr-sub">{PROJECT.subtitle}</div>
        <div className="apphdr-sub2">26,823 reviews from Play Store, App Store, Reddit &amp; Spotify Community Forum — analyzed for discovery friction, recommendation quality, and repeat listening.</div>
      </div>
      <div className="apphdr-actions">
        <button className="ghost-btn" onClick={sync} disabled={syncing}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "spin" : ""}>
            <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
          </svg>
          {syncing ? "Syncing…" : "Sync Reviews"}
        </button>
        {syncedAt && <span className="sync-note">Synced ✓ {syncedAt}</span>}
        {path === "/" && (
          <button className="ghost-btn fetch-live" onClick={fetchLive}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Fetch Live Reviews
          </button>
        )}
        {path === "/" && fetched && <span className="sync-note">Loaded ✓ below</span>}
      </div>
    </div>
  );
}
