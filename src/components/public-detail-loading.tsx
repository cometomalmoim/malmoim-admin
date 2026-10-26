import type { PublicLocale } from "@/lib/public-content";
import styles from "./public-detail-loading.module.css";

function Bar({ className = "" }: { className?: string }) {
  return <span className={styles.bar + " " + className} />;
}

// No URL data is read here: this fallback must be available in the App Shell.
export function PublicDetailLoading({ locale = "ko" }: { locale?: PublicLocale }) {
  const en = locale === "en";
  return (
    <main id="public-main" className={"public-detail " + styles.loading} lang={locale} tabIndex={-1} aria-busy="true">
      <div aria-hidden="true" className={styles.breadcrumb}><Bar /><span>/</span><Bar /></div>
      <div className={styles.heading}>
        <div aria-hidden="true" className={styles.headingLines}><Bar className={styles.badge} /><Bar className={styles.title} /><Bar className={styles.subtitle} /></div>
        <div className={styles.status} role="status">
          <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
          <div><strong>{en ? "Preparing your page" : "안내 페이지를 준비하고 있어요"}</strong><p>{en ? "The details will be ready in a moment." : "잠시만 기다려주세요. 곧 내용을 보여드릴게요."}</p></div>
        </div>
      </div>
      <div aria-hidden="true">
        <div className={styles.filters}><Bar /><Bar /><Bar /></div>
        <div className={styles.cards}>{[0, 1].map(index => <div className={styles.card} key={index}>
          <Bar className={styles.image} />
          <div className={styles.body}><Bar className={styles.badge} /><Bar className={styles.cardTitle} /><Bar /><Bar className={styles.short} /><div className={styles.details}><Bar /><Bar /><Bar className={styles.short} /></div><div className={styles.cta}><Bar /></div></div>
        </div>)}</div>
      </div>
    </main>
  );
}
