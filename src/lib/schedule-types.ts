export type ScheduleTag = { id: string; name: string; color: string; system_key: string | null; version: number };
export type Schedule = { id: string; title: string; start_date: string; end_date: string; tag_id: string; assignee_id: string | null; notes: string; source_kind: 'manual' | 'event' | 'recruitment'; event_id: string | null; version: number; hidden_at: string | null };
export type ScheduleData = { schedules: Schedule[]; tags: ScheduleTag[]; people: {user_id: string; display_name: string}[]; events: {id: string; slug: string}[] };
