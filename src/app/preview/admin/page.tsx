import { notFound } from "next/navigation";
import { AdminView } from "@/components/admin/admin-view";
export default function Page() { if (process.env.NODE_ENV !== "development") notFound(); return <AdminView preview />; }
