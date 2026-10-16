import 'server-only';
import { getAdminAccess } from './auth';
import { createClient } from './supabase/server';
import type { PeopleData, Person } from './people-types';
export async function getPeople(): Promise<PeopleData | null> {
  if ((await getAdminAccess()).status !== 'admin') return null;
  try {
    const client = await createClient();
    const [people, events, resources] = await Promise.all([
      client.from('people').select('*,people_events(event_id),people_resources(resource_id)').order('name'),
      client.from('recruitment_events').select('id,title,slug').order('created_at', { ascending: false }),
      client.from('resources').select('id,title').order('created_at', { ascending: false }),
    ]);
    if (people.error || events.error || resources.error) return null;
    return { people: people.data.map(({ people_events, people_resources, ...row }) => ({ ...row, event_ids: people_events.map((e: {event_id: string}) => e.event_id), resource_ids: people_resources.map((r: {resource_id: string}) => r.resource_id) })) as Person[], events: events.data, resources: resources.data };
  } catch { return null; }
}
