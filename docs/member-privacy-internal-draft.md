# 회원 개인정보 처리방침 내부 초안 / Internal privacy draft

검토용이며 공개 처리방침이 아닙니다. 시행일·문서 버전은 미정입니다. 아래 미확정 항목을 확정하고 한국어·영어의 의미를 함께 검토하기 전에는 `publishedMemberLegal` 및 가입 정책을 활성화하지 않습니다. 빈칸을 채운 문서를 자동 공개하는 기능은 없습니다. 이용약관도 별도로 승인해야 합니다.

## 1. 처리자 / Controller

KO: 말모임(MALMOIM)은 운영진이 자발적으로 운영하는 비영리 언어교환 커뮤니티입니다. 공식 웹사이트는 https://malmoim.com 이며 공식 인스타그램은 @cometomalmoim입니다.

EN: MALMOIM is a nonprofit language exchange community run by volunteer organizers. Its official website is https://malmoim.com and its official Instagram account is @cometomalmoim.

내부 결정: 실제 개인정보 처리에 책임지는 운영 주체, 법적 명칭, 연락 가능한 공식 창구를 확정해야 합니다. 인스타그램을 개인정보 요청 접수처로 임의 지정하지 않습니다. 비영리 또는 친목 목적이라는 이유만으로 적용 법령의 범위나 면제를 단정하지 않습니다.

## 2. 목적 및 법적 근거 / Purposes and legal bases

KO: 회원가입·인증, 회원 프로필 관리, 게시글·댓글의 작성 및 운영, 신고 처리에 필요한 정보를 처리합니다.

EN: Information is processed for registration and authentication, member profiles, community posts and comments, and handling reports.

내부 결정: 각 목적별 계약 이행·동의 등 법적 근거와 필수성을 검토합니다. 회원가입 화면의 계약 이행 모드와 동의 모드는 대안이며 동시에 근거로 삼지 않습니다. 이용약관 동의, 개인정보 안내, 수집·이용 동의는 별개입니다. 행사 신청·메시지 발송 등 기존 별도 흐름은 담당자와 함께 범위를 조사한 뒤 문서에 반영해야 합니다.

## 3. 수집 항목 / Information collected

KO: 가입·인증에는 이메일과 비밀번호를 사용하고, 회원가입에는 닉네임과 만 19세 이상 확인을 위한 생년월일을 입력합니다. 비밀번호는 Supabase Auth 인증 흐름으로 전달하며 공개 프로필에 저장하지 않습니다. 게시판에는 닉네임이 표시됩니다.

EN: Registration and authentication use an email address and password. Registration also requires a nickname and a date of birth to check the minimum age of 19. Passwords are handled through Supabase Auth and are not stored in public profiles. The board displays nicknames.

내부 결정: 기존 화면에 있는 이름·전화번호·국적·성별·언어 수준 및 외국어 목록은 실제 필요성과 필수/선택 여부를 승인해야 합니다. 현재 기존 프로필 SQL은 한국어·영어 수준을 요구하므로 공지 항목과 DB 요건도 일치시켜야 합니다. 전체 생년월일 저장의 최소 수집 대안(연령 확인 결과만 저장 등)도 검토해야 합니다. 인증·접속 로그의 실제 항목은 서비스 설정으로 확인합니다.

## 4. 수집 방법 / Collection methods

KO: 이용자가 가입·프로필·게시판·신고 화면에 직접 입력하는 정보와 인증 세션을 처리합니다.

EN: Information is provided directly through registration, profile, board and report forms, and through authentication sessions.

내부 결정: SDK 및 공급업체가 처리하는 기술 로그, IP·기기 정보의 실제 범위와 처리 주체를 확인합니다. 생년월일 입력은 본인인증 또는 성인 신원 확인이 아닙니다.

## 5. 보유기간 / Retention

KO: 회원 탈퇴 시 계정과 개인 식별정보를 삭제하는 정책을 적용할 예정이며 게시글·댓글은 작성자를 익명화하여 유지합니다.

EN: The intended withdrawal policy deletes the account and identifying information while retaining posts and comments with an anonymized author label.

내부 결정: 회원·행사·신고·운영 로그·동의 증빙·백업별 구체적 기간 및 예외의 근거를 확정해야 합니다. 임의의 법정 기간을 삽입하지 않습니다. 현재 탈퇴 자동 처리는 구현·활성화하지 않았습니다. 게시글 본문에 포함된 식별정보의 요청 처리 절차도 필요합니다.

## 6. 제3자 제공 / Disclosure to third parties

KO: 제3자 제공 여부와 해당 목적·항목·수령자·보유기간은 실제 운영 내역에 따라 안내합니다.

EN: Any disclosure to third parties must be described according to actual operations, including the recipient, purpose, information and retention period.

내부 결정: 제공이 없다는 문구도 사실 확인 후 승인합니다. 공개 게시판의 정보 공개와 업무 위탁, 광고 도구 제공은 각각 검토합니다.

## 7. 처리 위탁 / Processors

KO: 회원가입·인증에는 Supabase Auth, 데이터베이스에는 Supabase PostgreSQL을 사용합니다.

EN: Supabase Auth is used for authentication and Supabase PostgreSQL for the database.

내부 결정: 계약상 사업자 명칭, 업무, 재위탁, 인증 메일 발송업체와 호스팅 업체를 확인해야 합니다. 제품 이름만으로 수탁자 법인명을 추정하지 않습니다. 코드의 SOLAPI 관련 별도 메시지 흐름도 담당자 검토가 필요합니다.

## 8. 국외 이전 / International transfers

KO: 서비스 제공업체의 저장·접근 위치 및 이전 여부를 확인하여 해당하는 경우 필요한 사항을 안내합니다.

EN: Storage and access locations and any international transfers must be verified, and the required information disclosed where applicable.

내부 결정: 국가, 시기·방법, 항목, 수령자·연락처, 목적·기간, 거부 방법·효과 및 법적 근거를 확정해야 합니다. Supabase 사용 사실만으로 특정 국가 또는 동의 필요성을 단정하지 않습니다. 프로젝트 DB 리전 외에 이메일·지원·재위탁·백업 경로도 확인합니다.

## 9. 파기 / Deletion

KO: 삭제 대상 정보는 승인된 보유 정책과 파기 절차에 따라 처리합니다.

EN: Information due for deletion is handled under the approved retention and deletion procedures.

내부 결정: DB, Auth, 파일 저장소, 로그, 공급업체, 백업별 실제 파기 방법 및 주기를 확인합니다. 논리 삭제나 작성자 표시 변경만으로 계정 삭제가 완료되었다고 안내하지 않습니다.

## 10. 정보주체 권리 / Individual rights

KO: 개인정보 열람·정정·삭제·처리정지 및 동의 철회 요청을 위한 절차를 마련합니다.

EN: Procedures will be provided for access, correction, deletion, restriction and withdrawal of consent.

내부 결정: 공식 접수처, 필요한 본인 확인, 대리인 요청, 처리 절차 및 적용 가능한 예외를 확정합니다. 아직 없는 셀프서비스 삭제 버튼이나 처리 기한을 있다고 표기하지 않습니다.

## 11. 공개 게시물 / Public content

KO: 게시글·댓글의 작성자 이름에는 닉네임을 표시합니다. 탈퇴 이후에는 게시글·댓글을 유지하고 작성자는 ‘탈퇴한 회원’으로 표시하는 정책입니다.

EN: Posts and comments display nicknames. Under the intended withdrawal policy, posts and comments remain with the author shown as ‘Former Member’ after withdrawal.

내부 결정: 기존 랜덤 별명과 작성 당시 스냅샷은 보존합니다. 새 닉네임 일괄 반영은 별도 검토가 필요합니다. 닉네임 자체가 식별정보가 될 수 있으므로 완전한 익명이라고 보장하지 않습니다. 탈퇴 시 본문에 적힌 식별정보도 별도로 검토해야 합니다.

## 12. 연령 / Age

KO: 회원가입 대상은 만 19세 이상입니다. 가입일의 한국 날짜와 생년월일을 비교해 가입 가능 여부를 확인합니다.

EN: Registration is limited to people aged 19 or older. Eligibility is checked using the date of birth and the registration date in Korea.

내부 결정: 허위 입력, 연령 이의 제기 및 미성년 가입 발견 시 절차를 승인합니다. 입력값 검증을 신원 또는 성인 인증으로 표현하지 않습니다.

## 13. 쿠키·세션·광고 / Cookies, sessions and advertising

KO: 로그인에는 인증 쿠키를 사용합니다. 일부 행사 랜딩에는 광고 측정 도구와 별도 동의 UI 코드가 있습니다.

EN: Authentication cookies are used for login. Some event landing pages contain advertising measurement code and a separate consent interface.

내부 확인: SSR 쿠키는 HttpOnly, SameSite=Lax, 운영환경 Secure 설정입니다. Meta Pixel 코드는 지정된 운영 호스트의 시즌9·할로윈 행사 경로에서 명시적 선택 후 PageView만 전송하도록 되어 있습니다. 선택은 브라우저 localStorage의 `malmoim-meta-consent-v1`에 저장됩니다. 실제 배포·광고 계정·수신 정보·보유기간·철회 UI 동작을 확인해야 합니다. 소스에서 GA/Vercel Analytics SDK가 발견되지 않은 사실은 실제 분석 도구 부재의 증명이 아닙니다.

## 14. 보호조치 / Security measures

KO: 인증, 접근 권한 제한 및 공개/비공개 데이터 분리를 위한 기술적 조치를 적용합니다.

EN: Technical measures include authentication, access restrictions, and separation of public and private information.

내부 결정: 실제 운영의 권한 검토·로그·키 관리·교육·백업·사고 대응 체계를 조사합니다. 구현하지 않은 암호화·인증·관리 체계를 보장하는 문구를 쓰지 않습니다.

## 15. 담당자·구제 / Contact and redress

KO: 개인정보 문의 및 권리 요청은 확정된 개인정보 담당 창구를 통해 접수할 수 있도록 안내합니다.

EN: A confirmed privacy contact will be provided for inquiries and rights requests.

내부 결정: 책임자/담당자 이름 또는 직책, 공식 이메일·전화, 외부 구제 기관의 최신 안내를 확인합니다. 기존 관리자 계정 이메일이나 이미지 속 연락처를 공식 창구로 복사하지 않습니다.

## 16. 변경·시행 / Updates and effective date

KO: 승인된 처리방침은 시행일과 버전을 함께 공개하며 변경 이력을 관리합니다.

EN: The approved policy will be published with an effective date and version, with changes recorded.

내부 결정: 최초 시행일, 사전 고지 방법, 과거 버전 공개·보존 및 재동의 조건을 승인해야 합니다. 한국어와 영어를 동시에 게시하고 약관·수집 고지·저장 증빙 버전을 일치시킵니다.

## 검토 근거

- [개인정보 보호법 현행 본문](https://law.go.kr/LSW/LsiJoLinkP.do?languageType=KO&lsNm=%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4+%EB%B3%B4%ED%98%B8%EB%B2%95&paras=1): 법률 제21445호, 시행 2026-09-11 확인. 적용 범위와 각 처리 근거는 운영 실태에 따라 추가 검토합니다.
- [제30조 처리방침](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1032645945), [제28조의8 국외 이전](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029331957): 처리방침과 국외 이전의 검토 기준. 위 16개 항목은 내부 검토 구조이며 법 조문을 그대로 전재한 것이 아닙니다.
- [개인정보보호위원회 개인정보 처리방침 작성지침(2026.4) 게시물](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010000000&nttId=12018): 2026-04-23 게시 확인. 게시물 정보를 확인했으며 첨부 PDF 전문 검토가 완료되었다고 주장하지 않습니다. 공개 전 운영진의 지침 전문 검토가 필요합니다.
- [사용자 제공 참고 가이드](https://twinh.co.kr/guide/website-legal-requirements): 보조 참고자료이며 법령·공식 지침을 대체하지 않습니다.
