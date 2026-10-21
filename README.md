This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

외부 서비스 계정의 로컬 암호화 키는 `npm run setup:external-accounts`로 설정합니다. 기존 `.env.local`의 Supabase 설정과 유효한 키는 보존하고, 키 값을 출력하지 않습니다. 설정 후 개발 서버를 재시작하세요. 자세한 적용 순서와 운영 환경 키 설정은 [외부 계정 설정 가이드](docs/external-accounts.md)를 확인하세요. 이 기능은 Next.js 서버에서 암호화하므로 Supabase Vault, Edge Functions Secret 또는 `ALTER DATABASE ... encryption_key` SQL은 필요하지 않습니다.

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
