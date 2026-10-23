import "server-only";
import { getAdminAccess } from "@/lib/auth";
import { createDisabledActivityUploadHandler } from "@/lib/history-activities/upload-request";

export const runtime = "nodejs";
// getAdminAccess verifies getUser() and admin_users using the requesting session.
// No upload, journal, evidence reporter or privileged DB client is wired here.
export const POST = createDisabledActivityUploadHandler(getAdminAccess);
