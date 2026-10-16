export const personFields = [
  ['name', '이름', 100], ['generation', '기수', 40], ['role', '직책 / 역할', 100],
  ['education', '학력', 300], ['phone', '전화번호', 50], ['email', '이메일', 254],
  ['instagram', 'Instagram 계정 ID', 500], ['photo_url', '프로필 사진', 2000],
  ['bio', '자기소개', 5000], ['tmi', 'TMI', 5000],
] as const;
export type PersonInput = Record<typeof personFields[number][0], string>;
export type Person = PersonInput & { id: string; status: 'active' | 'inactive'; updated_at: string; event_ids: string[]; resource_ids: string[] };
export type PeopleData = { people: Person[]; events: { id: string; title: string; slug: string }[]; resources: { id: string; title: string }[] };
