import { PublicHome } from "@/components/public-home";
import { publicMetadata } from "@/lib/public-metadata";
export const metadata=publicMetadata("en");
export default function Page(){return <PublicHome locale="en"/>;}
