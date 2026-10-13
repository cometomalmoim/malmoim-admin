import Image from "next/image";
export function BrandLogo({ compact = false }: { compact?: boolean }) {
return <div className={`brand-logo ${compact ? "compact" : ""}`}><Image src="/brand/malmoim-logo.png" alt="말모임 MALMOIM" width={1522} height={1518} priority sizes={compact ? "220px" : "(max-width: 640px) 85vw, 460px"} /></div>;
}
