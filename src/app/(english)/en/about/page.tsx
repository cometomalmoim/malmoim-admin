import type {Metadata} from "next";
import AboutPage from "@/app/(public)/about/page";
import {translatePublicTree} from "@/lib/i18n/public-tree";
// Translate before development RSC serialization wraps server JSX in lazy nodes.
export default function Page() { return translatePublicTree(AboutPage()); }
export const metadata:Metadata={"title": "About MALMOIM", "description": "New to Korean or English? Explore MALMOIM's language exchange programs and find out how to join.", "alternates": {"canonical": "/en/about", "languages": {"ko": "/about", "en": "/en/about"}}, "openGraph": {"title": "About MALMOIM | MALMOIM", "description": "New to Korean or English? Explore MALMOIM's language exchange programs and find out how to join.", "url": "/en/about", "locale": "en_US"}};
