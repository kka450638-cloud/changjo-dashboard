# 창조통닭 가맹점 지도 대시보드

Next.js(App Router) + Supabase + react-leaflet 기반 관리자 대시보드입니다.

## 환경 설정

### 1. 패키지 설치

이미 설치된 경우 생략 가능합니다.

```bash
npm install @supabase/supabase-js react-leaflet leaflet lucide-react sonner
npm install -D @types/leaflet
```

### 2. Supabase 연동 (.env.local)

프로젝트 루트에 `.env.local` 파일을 만들고 Supabase 프로젝트 정보를 넣습니다.

```bash
cp .env.local.example .env.local
```

`.env.local` 내용 예시:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택 → **Settings** → **API** 에서 URL과 anon public key를 복사합니다.

### 3. Supabase `stores` 테이블 생성

Supabase 대시보드 → **SQL Editor**에서 아래 SQL을 실행합니다.

```sql
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text,
  address text,
  revenue numeric,
  category text,
  lat numeric,
  lng numeric,
  created_at timestamptz default now()
);

-- (선택) RLS 정책: anon 키로 읽기/쓰기 허용
alter table stores enable row level security;

create policy "Allow all for anon" on stores
  for all using (true) with check (true);
```

## Getting Started

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
