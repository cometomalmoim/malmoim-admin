import type { Metadata } from "next";
import "./season9.css";
export const metadata: Metadata = { metadataBase: new URL("https://malmoim.com"), robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
