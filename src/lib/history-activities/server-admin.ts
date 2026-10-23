import "server-only";
import { createClient } from "../supabase/server";
/** Separate from existing login/auth helpers. Returns no email/session to callers.
 * Request context cannot nominate actor IDs or administrative privilege. */
export async function verifyPhotoAdministrator(): Promise<{ actorId: string } | null> {
  try {
    const client=await createClient();
    const {data,error}=await client.auth.getUser();if(error||!data.user)return null;
    const member=await client.from("admin_users").select("user_id").eq("user_id",data.user.id).maybeSingle();
    return member.error||!member.data?null:{actorId:data.user.id};
  } catch { return null; }
}
