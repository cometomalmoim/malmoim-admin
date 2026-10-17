// Fixed KST representation; independent of Intl/ICU and host timezone.
export function previewKstDate(iso: string|null): string {
 if(!iso)return '—';
 const time=Date.parse(iso);if(!Number.isFinite(time))return '—';
 const d=new Date(time+9*3600000),pad=(n:number)=>String(n).padStart(2,'0');
 return `${d.getUTCFullYear()}. ${pad(d.getUTCMonth()+1)}. ${pad(d.getUTCDate())}. ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} (한국 시간)`;
}
