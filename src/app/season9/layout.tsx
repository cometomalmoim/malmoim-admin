import type { Metadata } from "next";
import "./season9.css";
import "@/components/landing-design.css";
import "@/components/season9/recruitment-poster.css";
import "@/components/season9/autumn-theme.css";
export const metadata: Metadata = { metadataBase: new URL("https://malmoim.com"), robots: { index: true, follow: true } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
