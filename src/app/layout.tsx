import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "말모임 Admin", description: "말모임 운영 관리", robots: { index: false, follow: false } };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="ko"><body>{children}</body></html>; }
