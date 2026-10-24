import type {Metadata} from "next";
import HistoryPage from "@/app/(public)/history/page";
import {translatePublicTree} from "@/lib/i18n/public-tree";
// Translate before development RSC serialization wraps server JSX in lazy nodes.
export default function Page() { return translatePublicTree(HistoryPage()); }
export const metadata:Metadata={"title": "Our History", "description": "Explore the conversations, laughter, and shared experiences that make MALMOIM.", "alternates": {"canonical": "/en/history", "languages": {"ko": "/history", "en": "/en/history"}}, "openGraph": {"title": "Our History | MALMOIM", "description": "Explore the conversations, laughter, and shared experiences that make MALMOIM.", "url": "/en/history", "locale": "en_US"}};
