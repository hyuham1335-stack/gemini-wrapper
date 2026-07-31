# Gemini Wrapper SaaS

Google Gemini API를 감싼 구독형 SaaS입니다. Google 로그인 후 대시보드에서 Gemini와 실시간 스트리밍으로 대화할 수 있고, 대화 내용은 서버에서 암호화되어 저장됩니다. 플랜(Free / Pro / Unlimited)에 따라 월간 사용량이 제한되며, 유료 전환은 Polar 결제로 처리됩니다.

## ⚠️ 이 프로젝트의 Next.js는 학습 데이터와 다를 수 있습니다

`AGENTS.md`에 명시된 대로, 이 프로젝트는 Next.js `16.2.12`를 사용하며 이전 버전과 다른 breaking change가 포함되어 있습니다. 대표적으로 `middleware.ts` 대신 **`proxy.ts`** 컨벤션을 사용합니다(`lib/supabase/proxy.ts`의 `updateSession()`을 호출). 코드를 수정하기 전에 `node_modules/next/dist/docs/`의 최신 문서를 확인하세요.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16.2.12 (App Router), React 19.2.4, TypeScript |
| 스타일 | Tailwind CSS 4 |
| 인증 / DB | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — Google OAuth, Postgres, RLS |
| AI | Google Gemini API (`@google/genai`) |
| 결제 | Polar (`@polar-sh/sdk`) |
| 암호화 | Node.js `crypto` 내장 모듈 기반 AES-256-GCM + HMAC-SHA256 |

## 주요 기능

- **Google OAuth 로그인**: Supabase Auth로 로그인하고, `proxy.ts`가 `/dashboard`, `/billing` 라우트를 보호합니다.
- **Gemini 스트리밍 채팅**: `app/api/chat/route.ts`에서 `generateContentStream`으로 응답을 스트리밍합니다.
- **대화 저장 및 암호화**: 대화 제목과 메시지 내용은 AES-256-GCM으로 암호화되어 저장되고, API 응답 시점에만 복호화됩니다.
- **플랜별 사용량 제한**: Free(10회/월), Pro(100회/월), Unlimited(무제한)로 월간 호출 횟수를 제한하고, 초과 시 페이월(`PaywallModal`)이 표시됩니다.
- **Polar 구독 결제**: 체크아웃, 고객 포탈, 플랜 변경/취소, 웹훅(서명 검증 + idempotent 처리)까지 포함합니다.

## 디렉터리 구조

```
app/
  page.tsx                          # 랜딩 페이지
  login/page.tsx                    # Google 로그인 페이지
  auth/callback/route.ts            # OAuth 콜백 → 세션 교환 + 프로필 동기화
  dashboard/page.tsx                # 채팅 대시보드
  pricing/page.tsx, pricing/success/page.tsx
  billing/page.tsx                  # 구독 관리 페이지
  api/
    chat/route.ts                   # Gemini 스트리밍 채팅
    conversations/...                # 대화 목록/생성/삭제/메시지 조회
    usage/route.ts                  # 이번 달 사용량 조회
    checkout/route.ts               # Polar 체크아웃 세션 생성
    billing/portal/route.ts         # Polar 고객 포탈 세션 생성
    subscription/...                 # 구독 조회/변경/취소
    webhooks/polar/route.ts         # Polar 웹훅 처리
components/                         # 채팅/청구/가격 UI 컴포넌트
contexts/auth-context.tsx           # 전역 Supabase 인증 상태
lib/
  supabase/{client,server,service,proxy}.ts
  gemini/client.ts
  polar/{client,plans,subscription}.ts
  encryption.ts
supabase/migrations/                # DB 스키마 마이그레이션
scripts/                            # 키 생성 / 암호화 마이그레이션 / 백필 스크립트
proxy.ts                            # 라우트 보호 (구 middleware.ts)
```

## 로컬 개발 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. .env.local 작성 (아래 "환경 변수" 표 참고)

# 3. 암호화 키 생성 (ENCRYPTION_KEY, HASH_KEY)
npm run db:generate-keys

# 4. Supabase 마이그레이션 적용
#    supabase/migrations/ 의 SQL을 Supabase 프로젝트에 순서대로 적용 (Supabase MCP 또는 CLI 사용)

# 5. 개발 서버 실행
npm run dev
```

종료는 `Ctrl + C`, Node 프로세스가 남아있으면 `Get-Process node`로 확인 후 `taskkill /IM node.exe /F`로 종료합니다.

## 환경 변수

`.env.local`에 아래 값을 설정해야 합니다 (저장소에 `.env.example`은 없으므로 아래 표를 템플릿으로 사용하세요).

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(public) 키 |
| `SUPABASE_SECRET_KEY` | Supabase service-role 키 (웹훅/프로필 동기화/사용량 증가에 사용, 절대 클라이언트 노출 금지) |
| `GOOGLE_API_KEY` | Gemini API 키 |
| `ENCRYPTION_KEY` | AES-256-GCM 암호화 키 (64자리 hex, `npm run db:generate-keys`로 생성) |
| `HASH_KEY` | 조회용 HMAC-SHA256 키 (64자리 hex, `npm run db:generate-keys`로 생성) |
| `POLAR_ACCESS_TOKEN` | Polar API 액세스 토큰 |
| `POLAR_ENVIRONMENT` | `production` 또는 미설정 시 sandbox |
| `POLAR_PRODUCT_ID_PRO` | Pro 플랜 Polar Product ID |
| `POLAR_PRODUCT_ID_UNLIMITED` | Unlimited 플랜 Polar Product ID |
| `POLAR_WEBHOOK_SECRET` | Polar 웹훅 서명 검증 시크릿 (배포 후 발급) |

## 데이터베이스 스키마 개요

`supabase/migrations/`에 정의되어 있으며, 모든 테이블에 Row Level Security(RLS)가 적용되어 있습니다.

| 테이블 | 설명 |
| --- | --- |
| `profiles` | 사용자 프로필 (이메일/이름은 암호화 + 조회용 해시 컬럼 포함) |
| `conversations` | 대화방 (제목 암호화) |
| `messages` | 대화 메시지 (내용 암호화) |
| `subscriptions` | 구독 상태 (plan, status, Polar 고객/구독 ID) |
| `usage` | 사용자별 월간 사용 횟수 |
| `webhook_events` | Polar 웹훅 이벤트 로그 (idempotency 보장용, service-role 전용) |

## 사용 가능한 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 실행 |
| `npm run db:generate-keys` | `ENCRYPTION_KEY`/`HASH_KEY` 생성 |
| `npm run db:migrate-encrypt` | 기존 데이터 암호화 마이그레이션 |
| `npm run db:backfill-chat-encryption` | 대화/메시지 암호화 백필 |

## 배포 (Vercel)

1. GitHub에 Push
2. Vercel에서 프로젝트 배포
3. Vercel 환경 변수에 위 "환경 변수" 표의 값을 모두 등록
4. Supabase → Authentication → URL Configuration에서 **Site URL을 Vercel 프로덕션 주소로 변경** (localhost 사용 금지)
5. Google Cloud Console → OAuth Client → 승인된 Redirect URI에 Vercel 주소 추가, 게시 상태를 **Production**으로 설정
6. Polar에서 배포된 웹훅 엔드포인트(`/api/webhooks/polar`) 등록 후 발급된 `POLAR_WEBHOOK_SECRET`을 Vercel 환경 변수에 추가
7. 환경 변수 추가/변경 후 반드시 **재배포**

웹훅을 사용하는 경우 배포 후 실제 결제 흐름으로 반드시 테스트합니다.

### OAuth 오류(`redirect_uri_mismatch`) 발생 시 확인 순서

1. Supabase Site URL이 실제 배포 주소와 일치하는지
2. Google OAuth 승인된 Redirect URI가 정확한지, 게시 상태가 Production인지
3. Vercel에 등록된 환경 변수가 최신 값인지

## 참고 문서

- [Gemini API 공식 문서](https://ai.google.dev/gemini-api/docs?hl=ko)
- [Supabase 문서](https://supabase.com/docs)
- [Polar 문서](https://docs.polar.sh)
- Next.js 관련 사항은 `node_modules/next/dist/docs/`의 로컬 문서를 우선 참고 (버전 특이사항 있음)
