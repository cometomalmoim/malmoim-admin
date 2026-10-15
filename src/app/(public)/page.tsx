import { PublicHome } from "@/components/public-home";
import { publicMetadata } from "@/lib/public-metadata";
export const metadata = publicMetadata("ko");
export default function Page() { return <PublicHome/>; }
