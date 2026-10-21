export const accountCategories = { marketing: '마케팅', design: '디자인', infrastructure: '호스팅/인프라', finance: '금융/결제', other: '기타' } as const;
export type ExternalAccount = {
  id: string; manager_person_id?: string | null; created_by: string | null; service_name: string; service_url: string; login_id: string;
  category: keyof typeof accountCategories; department: string; primary_manager: string | null; sub_manager: string | null;
  billing_cycle: string; payment_method: string; amount: number; currency: string; next_billing_date: string | null;
  renewal_notice_days: number; notes: string; updated_at: string;
};
export type AccountMember = { legacy?: boolean; user_id: string; role: string; department: string; display_name: string };
export type AccountLog = { id: number; account_id: string; actor_name: string; action: string; created_at: string; changes: Record<string, unknown> };
export function renewalDays(date: string | null, today: string) {
  return date ? Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
}
