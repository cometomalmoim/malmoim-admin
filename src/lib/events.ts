import 'server-only';
import { getAdminAccess } from './auth';
import { createClient } from './supabase/server';
import type { EventInput } from './event-validation';
export type EventRow = Omit<EventInput, 'starts_at' | 'ends_at' | 'opens_at'> & {
  id: string; slug: string; status: string; applications_open: boolean;
  starts_at: string | null; ends_at: string | null; opens_at: string | null;
};
export async function getEvent(slug: string): Promise<{kind:'ready';row:EventRow}|{kind:'missing'|'error'}> {
  if ((await getAdminAccess()).status !== 'admin') return {kind:'error'};
  try {
    const client = await createClient();
    const result = await client.from('recruitment_events').select('id,slug,title,status,applications_open,description,image_url,starts_at,ends_at,location,capacity,fee_notice,opens_at,closes_at,visual_theme').eq('slug', slug).maybeSingle();
    if (result.error) return {kind:'error'};
    return result.data ? {kind:'ready',row:result.data as EventRow} : {kind:'missing'};
  } catch { return {kind:'error'}; }
}
