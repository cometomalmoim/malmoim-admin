// Pure limits/validation shared by the API and tests. No environment or secrets.
export const certificateLimits = { people: 20, bytes: 64 * 1024 * 1024, milliseconds: 45000, urlSeconds: 300 } as const;
export function jobId(value: unknown): string {
 if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('유효한 발급 작업 ID가 필요합니다.');
 return value;
}
export function generationBudget(count: number, bytes: number, elapsed: number) {
 if (count < 1 || count > certificateLimits.people) throw new Error('한 번에 최대 20명까지 발급할 수 있습니다.');
 if (bytes > certificateLimits.bytes) throw new Error('생성 파일은 합계 64MiB까지 지원합니다. 인원을 나눠주세요.');
 if (elapsed > certificateLimits.milliseconds) throw new Error('파일 생성 시간이 초과되었습니다. 인원을 나눠주세요.');
}
export function templateMime(bytes: Uint8Array): string {
 if (!bytes.length || bytes.length > 5242880) throw new Error('템플릿은 5MiB 이하 파일만 가능합니다.');
 if (Buffer.from(bytes.slice(0,5)).toString()==='%PDF-') return 'application/pdf';
 if (bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10') return 'image/png';
 if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
 throw new Error('PDF, PNG, JPG 형식을 확인해주세요.');
}
