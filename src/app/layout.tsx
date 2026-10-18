import type { Metadata } from "next";
import {Suspense} from "react";
import {LandingMetaPixel} from "@/components/landing-meta-pixel";
import "./globals.css";
export const metadata: Metadata = { title: "말모임 Admin", description: "말모임 운영 관리", robots: { index: false, follow: false } };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="ko"><body>{children}<Suspense fallback={null}><LandingMetaPixel/></Suspense></body></html>; }
