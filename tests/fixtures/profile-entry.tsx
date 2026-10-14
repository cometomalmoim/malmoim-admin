// Isolated UI fixture: no Supabase client, session, or application authentication.
import { createRoot } from "react-dom/client";
import { ProfileMenu } from "../../src/components/profile-menu";
import "../../src/app/(public)/public.css";
import "./profile-fixture.css";

createRoot(document.getElementById("root")!).render(
  <div className="public-site">
    <p className="fixture-note">독립 프로필 컴포넌트 테스트 — 실제 인증·로그아웃 없음</p>
    <header className="public-header"><strong>말모임 UI 테스트</strong>
      <div className="public-account"><ProfileMenu email={"long-test-address-".repeat(8) + "@example.test"} /></div>
    </header>
    <main><button type="button" id="outside">메뉴 바깥 영역</button></main>
  </div>,
);
