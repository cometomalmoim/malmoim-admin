
import {Localized} from "@/components/public-translation";
import type { Metadata } from "next";
import Link from "next/link";
import {connection} from "next/server";
import { Suspense } from "react";
import Image from "next/image";
import heroPhoto01 from "../../../../public/history/history-hero-01.jpeg";
import heroPhoto02 from "../../../../public/history/history-hero-02.jpeg";
import heroPhoto03 from "../../../../public/history/history-hero-03.jpeg";
import { PublishedGallery } from "./published-gallery";
import { HistoryReviews } from "./history-reviews";
import { readReviews } from "./review-store";
import { getReviewAccess } from "./review-permission";
import { historyPhotos } from "./history-data";
import "./history.css";
import "./history-brand.css";

const description = "함께 이야기하고 웃으며 만들어 온 말모임의 다양한 활동을 만나보세요.";
export const metadata: Metadata = {
  title: "말모임 히스토리", description,
  alternates: { canonical: "/history" },
  openGraph: { title: "말모임 히스토리 | 말모임 MALMOIM", description, url: "/history" },
};

const heroPhotos = [
  { image: heroPhoto01, alt: "야외에서 말모임 현수막을 함께 들고 단체사진을 촬영한 참가자들" },
  { image: heroPhoto02, alt: "식당 테이블에 둘러앉아 함께 식사하는 말모임 참가자들" },
  { image: heroPhoto03, alt: "야외에서 스파클러를 들고 함께 즐기는 말모임 참가자들" },
];

async function ReviewBoard() {
  await connection(); // Auth/Storage SDK clocks run only after a request, inside Suspense.
  const [reviews, access] = await Promise.all([readReviews(), getReviewAccess()]);
  return <Localized>{<HistoryReviews initial={reviews} userId={access.userId} permission={access.permission} />}</Localized>;
}

export default function HistoryPage() {
  return <Localized>{<main id="public-main" className="history-page" tabIndex={-1}>
    <section className="history-hero" aria-labelledby="history-title">
      <div className="history-heading"><p className="history-label">OUR HISTORY</p><h1 id="history-title">말모임의 <span>순간들</span></h1><p>{description}</p></div>
      <div className="history-collage" role="group" aria-label="활동 사진 콜라주">
        {heroPhotos.map((photo, index) => <figure className={`history-collage-frame history-collage-${index + 1}`} key={index}>
          <Image src={photo.image} alt={photo.alt} sizes="(max-width: 540px) calc((100vw - 72px) * 0.86), (max-width: 1100px) calc((100vw - 92px) / 3), 382px" />
        </figure>)}
      </div>
    </section>
    <PublishedGallery photos={historyPhotos} />
    <section className="history-reviews" aria-labelledby="history-reviews-title">
      <div className="history-review-heading">
        <div className="history-heading"><p className="history-label">REVIEWS</p><h2 id="history-reviews-title">말모임 <span>참여 후기</span></h2><p>말모임에 참여한 멤버들의 이야기를 만나보세요.<br />언어를 통해 넓어진 세상과 교류의 경험을 나눕니다.</p></div>
        <div className="history-review-art" aria-hidden="true"><span className="history-bubble history-bubble-blue" /><span className="history-bubble history-bubble-yellow" /></div>
      </div>
      <Suspense fallback={<p role="status">참여 후기를 불러오는 중…</p>}><ReviewBoard /></Suspense>
    </section>
    <aside className="history-closing" aria-labelledby="history-closing-title">
      <div><p lang="en">YOUR NEXT CHAPTER</p><h2 id="history-closing-title">다음 순간은,<br />우리 함께 만들어요.</h2></div>
      <Link href="/about#about-recruitment">말모임 참여 안내 <span aria-hidden="true">↗</span></Link>
    </aside>
  </main>}</Localized>;
}
