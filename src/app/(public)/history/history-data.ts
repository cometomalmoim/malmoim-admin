export type HistoryPhoto = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD: 실제 활동일
  description: string;
  src: string; // 공개 및 초상 사용 동의가 확인된 로컬 이미지 경로
  alt: string;
  slidePhotos?: { src: string; alt: string }[]; // Optional explicit order; legacy photos keep existing behavior.
  additionalPhotos?: { src: string; alt: string }[]; // 공개 동의가 확인된 동일 활동의 추가 사진
} & ({ category: "regular"; cohort: number } | { category: "special" });

// 확인된 실제 자료만 추가합니다. 시안의 예시 사진·기수·날짜·후기는 게시하지 않습니다.
export const historyPhotos: HistoryPhoto[] = [];

export function displayDate(date: string) {
  return date.replaceAll("-", ". ");
}
