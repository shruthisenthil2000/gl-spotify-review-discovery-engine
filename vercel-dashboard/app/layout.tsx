import "./globals.css";
import type { Metadata } from "next";
import Nav from "./components/Nav";
import TopTabs from "./components/TopTabs";
import TopHeader from "./components/TopHeader";

export const metadata: Metadata = {
  title: "Spotify Discovery AI · Discovery Insights Dashboard",
  description: "Spotify Discovery AI — AI-powered review intelligence for music discovery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <Nav />
          <main className="main"><TopHeader /><TopTabs />{children}</main>
        </div>
      </body>
    </html>
  );
}
