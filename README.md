This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

외부 서비스 계정의 로컬 암호화 키는 `npm run setup:external-accounts`로 설정합니다. 기존 `.env.local`의 Supabase 설정과 유효한 키는 보존하고, 키 값을 출력하지 않습니다. 설정 후 개발 서버를 재시작하세요. 자세한 적용 순서와 운영 환경 키 설정은 [외부 계정 설정 가이드](docs/external-accounts.md)를 확인하세요. 이 기능은 Next.js 서버에서 암호화하므로 Supabase Vault, Edge Functions Secret 또는 `ALTER DATABASE ... encryption_key` SQL은 필요하지 않습니다.

### 외부 계정 기능의 프로덕션 환경 변수

로컬에서만 정상 동작하고 배포에서 암호화 키 오류가 발생하면, **Next.js 배포 서버**에 `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`가 설정되어 있는지 확인하세요. 이름은 `ACCOUNTS` 복수형이며 `EXTERNAL_ACCOUNT_ENCRYPTION_KEY`나 `ACCOUNT_SECRET_KEY`는 사용하지 않습니다.

| 필수 변수 | 설정 값 | 용도 |
| --- | --- | --- |
| `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY` | 기존 암호화에 사용한 동일한 32바이트 키의 64자리 hex 값 | 서버 전용 AES-256-GCM 암호화·복호화 |
| `NEXT_PUBLIC_SUPABASE_URL` | 대상 Supabase 프로젝트 URL | DB 및 인증 연결 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 위 프로젝트의 publishable key | RLS가 적용된 DB 및 인증 요청 |

Vercel이라면 해당 프로젝트의 **Settings → Environment Variables**에 암호화 키를 추가하고 **Production**을 선택합니다. 가능한 경우 **Sensitive**로 저장한 뒤 **재배포(Redeploy)**해야 실행 중인 서버에 반영됩니다. Preview도 같은 DB를 사용한다면 동일한 키를 Preview 환경에 등록하세요. [Vercel 공식 설정 안내](https://vercel.com/docs/environment-variables/managing-environment-variables)

키 값은 현재 로컬에서 사용하는 `.env.local`의 해당 항목에서 직접 확인해 비밀 환경 변수에 입력하세요. 환경 변수 없이 개발용 fallback으로 저장했던 경우에는 `.env.external-accounts.key`가 원본입니다. **기존 데이터가 있으면 새 키를 생성하지 마세요.** 두 파일은 Git에 포함되지 않으므로 merge만으로 배포 서버에 전달되지 않습니다. 키를 채팅·로그·저장소에 남기거나 `NEXT_PUBLIC_` 접두사로 노출하지 마세요.

Supabase Vault/Edge Functions Secret에만 키를 등록해도 현재 앱에서는 읽지 않습니다. 자세한 배포·오류 진단 절차는 [외부 계정 설정 가이드](docs/external-accounts.md#프로덕션-배포-설정과-오류-진단)를 참고하세요.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
