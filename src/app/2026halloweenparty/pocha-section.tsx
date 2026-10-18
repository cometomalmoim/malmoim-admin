import Image from 'next/image';

const assets = '/events/halloween-2026';

export function HalloweenPoster({ english = false }: { english?: boolean }) {
  return <Image src={`${assets}/poster.png`} width={593} height={890}
    alt={english ? 'MALMOIM Halloween Party poster: October 31, 2026, 7 PM–midnight. Costume contest, food and drinks, DJ sets. Early bird KRW 25,000.' : '말모임 할로윈 파티 포스터: 2026년 10월 31일 오후 7시부터 자정까지. 코스튬 콘테스트, 음식과 음료, DJ 세트. 얼리버드 25,000원.'}
    sizes="(max-width: 760px) 90vw, 450px" preload className="hw-poster"/>;
}

export function PochaSection({ english = false }: { english?: boolean }) {
  const t = (ko: string, en: string) => english ? en : ko;
  return <section id="pocha" className="hw-pocha hw-section hw-wrap" aria-labelledby="pocha-title">
    <div className="hw-pocha-heading"><div><p className="hw-eyebrow">FOOD. DRINKS. SPOOKY VIBES.</p>
      <h2 id="pocha-title">{t('파티도, 포차도.', 'The party. The pocha.')}<br/><em>{t('행사 중 무제한으로.', 'Unlimited during the event.')}</em></h2></div>
      <div><p className="hw-lead">{t('할로윈을 즐기는 또 하나의 방법. 행사에 참여하면서 포차를 무제한으로 이용할 수 있어요.', 'One more way to enjoy Halloween: unlimited access to our Korean-style pocha food-and-drink bar during the event.')}</p><a className="hw-button" href="#apply">{t('함께 즐기러 가기 ↗', 'Join the night ↗')}</a></div>
    </div>
    <div className="hw-pocha-feature"><Image src={`${assets}/pocha.png`} width={1024} height={1536} sizes="(max-width: 760px) 90vw, 440px" alt={t('붉은 조명과 도깨비를 테마로 한 황도깨비 포차 홍보 이미지', 'Hwang Dokkaebi Pocha artwork with a goblin character and red lanterns')}/>
      <div><span className="hw-pocha-label">HWANG DOKKAEBI POCHA</span><h3>{t('황도깨비 포차', 'Hwang Dokkaebi Pocha')}</h3><p>{t('먹고, 이야기하고, 다시 파티로. 할로윈 테마의 음식과 음료를 만나보세요.', 'Eat, mingle, and get back to the party. Discover our Halloween-themed food and drinks.')}</p>
        <ul><li>{t('불닭 육회 · 두부김치 · 콘치즈', 'Buldak yukhoe · Tofu kimchi · Corn cheese')}</li><li>{t('소시지 야채볶음 · 치즈 김치볶음밥', 'Sausage stir-fry · Cheese kimchi fried rice')}</li><li>{t('위스키 콕 · 레몬 / 진저 / 피치 하이볼 · 소맥', 'Whiskey coke · Lemon / ginger / peach highballs · Somaek')}</li></ul>
        <p className="hw-small">{t('아래 메뉴 이미지를 누르면 원본 크기로 확인할 수 있어요.', 'Open the menu images below to view them at full size.')}</p>
      </div>
    </div>
    <div className="hw-pocha-menus">{[
      ['food-menu.png',1055,1491,t('포차 음식 메뉴', 'Pocha food menu'),t('불닭 육회, 두부김치, 콘치즈, 소시지 야채볶음, 치즈 김치볶음밥 메뉴 포스터', 'Menu poster: buldak yukhoe, tofu kimchi, corn cheese, sausage stir-fry, cheese kimchi fried rice')],
      ['drink-menu.png',1024,1536,t('포차 음료 메뉴', 'Pocha drinks menu'),t('위스키 콕, 레몬·진저·피치 하이볼과 소맥 메뉴 포스터', 'Menu poster: whiskey coke, lemon, ginger and peach highballs, somaek')],
    ].map(([file,width,height,title,alt])=><figure key={file}><figcaption>{title}<span>{t('원본 보기 ↗', 'View full size ↗')}</span></figcaption><a href={`${assets}/${file}`} target="_blank" rel="noopener noreferrer" aria-label={`${title} · ${t('원본 이미지, 새 창', 'full-size image, new tab')}`}><Image src={`${assets}/${file}`} width={Number(width)} height={Number(height)} sizes="(max-width: 760px) 90vw, 580px" alt={String(alt)}/></a></figure>)}</div>
  </section>;
}
