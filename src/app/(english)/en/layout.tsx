import type { Metadata } from "next";
import { PublicFrame } from "@/components/public-frame";
import "@/app/(public)/public.css";
export const metadata:Metadata={metadataBase:new URL("https://malmoim.com"),title:{default:"MALMOIM",template:"%s | MALMOIM"},robots:{index:true,follow:true},openGraph:{type:"website",siteName:"MALMOIM",locale:"en_US"}};
export default function Layout({children}:{children:React.ReactNode}) { return <PublicFrame locale="en">{children}</PublicFrame>; }
