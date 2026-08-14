# TRD — Gemini Wrapper

| 항목 | 값 |
| --- | --- |
| 문서 버전 | 0.2 |
| 최종 수정 | 2026-08-14 |
| 대상 | 이 저장소에서 작업하는 개발자 / 코딩 에이전트 |
| 관련 문서 | [PRD.md](./PRD.md), [../README.md](../README.md), [../CLAUDE.md](../CLAUDE.md) |

---

## 1. 시스템 구성

별도 백엔드 서버 없이 **단일 Next.js 16 App Router 앱**이 프론트엔드와 API를 모두 담당합니다.

```
Browser ──► Next.js (Vercel)
             ├─ proxy.ts            세션 갱신 + 보호 라우트 리다이렉트
             ├─ app/**/page.tsx     UI (React 19 / Tailwind 4)
             └─ app/api/**/route.ts 백엔드
                  ├─► Supabase  (Auth / Postgres + RLS)
                  ├─► Gemini    (@google/genai, 스트리밍)
                  └─► Polar     (체크아웃 / 구독 / 고객 포탈)
                        └─ webhook ─► /api/webhooks/polar
```

**중요**: 이 프로젝트의 Next.js 16은 학습 데이터와 API가 다릅니다. 라우팅/설정/App Router 관례를
건드리기 전에 `node_modules/next/dist/docs/`의 로컬 문서를 먼저 확인하세요
(예: `middleware.ts` → `proxy.ts` / `export function proxy()`).

## 2. 기술 스택

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16.2.12 (App Router), React 19.2.4, TypeScript 5 | Turbopack 개발 서버 |
| 스타일 | Tailwind CSS 4 (`@tailwindcss/postcss`) | |
| 인증 | Supabase Auth (Google OAuth), `@supabase/ssr` | 쿠키 기반 세션 |
| DB | Supabase Postgres + Row Level Security | ORM 없음, JS 클라이언트로 직접 쿼리 |
| AI | `@google/genai` (`gemini-3.6-flash`) | `lib/gemini/client.ts`의 `GEMINI_MODEL` 상수 |
| 결제 | `@polar-sh/sdk` | 체크아웃 / 구독 업데이트 / 고객 세션 / 웹훅 검증 |
| 암호화 | Node `crypto` — AES-256-GCM + HMAC-SHA256 | `lib/encryption.ts` |
| 린트 | ESLint 9 flat config + `eslint-config-next` | |

**의도적으로 채택하지 않은 것**: ORM/쿼리 빌더(마이그레이션은 순수 SQL), 상태 관리 라이브러리
(React state + `contexts/auth-context.tsx`로 충분), 테스트 러너(현재 미구성).

## 3. 디렉터리 구조

```
app/
  page.tsx                       랜딩
  login/page.tsx                 Google 로그인
  pricing/page.tsx, pricing/success/page.tsx
  billing/page.tsx               구독 관리
  dashboard/page.tsx             채팅 대시보드
  auth/callback/route.ts         OAuth 콜백 (세션 교환 + 프로필 동기화)
  api/
    chat/route.ts                Gemini 스트리밍 채팅
    conversations/route.ts       대화 목록/생성
    conversations/[id]/route.ts  대화 삭제
    conversations/[id]/messages/route.ts  메시지 목록
    search/route.ts              메시지 전문 검색
    usage/route.ts               이번 달 사용량
    checkout/route.ts            Polar 체크아웃 생성
    billing/portal/route.ts      Polar 고객 포탈 세션
    subscription/route.ts        구독 조회
    subscription/change/route.ts 플랜 변경
    subscription/cancel/route.ts 해지 예약/재개
    webhooks/polar/route.ts      Polar 웹훅
components/
  hero-section.tsx, back-to-dashboard-link.tsx
  dashboard/  chat-panel, conversation-sidebar, dashboard-header,
              search-modal, paywall-modal, usage-banner, cancellation-banner, types
  billing/billing-panel.tsx
  pricing/pricing-plans.tsx
contexts/auth-context.tsx        전역 Supabase 인증 상태
lib/
  supabase/{client,server,service,proxy,require-user}.ts, database.types.ts
  gemini/client.ts
  polar/{client,plans,subscription}.ts
  encryption.ts
  usage.ts                         사용량 월 버킷 / 조회 / 게이지 비율
  api/error-response.ts, format.ts
supabase/migrations/             타임스탬프 순 SQL 마이그레이션
scripts/                         키 생성 / 암호화 마이그레이션 / 백필
proxy.ts                         라우트 보호 (구 middleware.ts)
```

## 4. Supabase 클라이언트 4종

용도가 엄격히 구분되며, 잘못 고르면 RLS를 우회하거나 인증이 깨집니다.

| 파일 | 실행 위치 | RLS | 용도 |
| --- | --- | --- | --- |
| `lib/supabase/server.ts` | 서버 컴포넌트 / 라우트 핸들러 | 적용 | 쿠키 세션으로 사용자를 대신한 조회·쓰기 |
| `lib/supabase/client.ts` | 브라우저 컴포넌트 | 적용 | 클라이언트 측 조회, 인증 상태 |
| `lib/supabase/service.ts` | **서버 전용** | **우회** | 웹훅 처리, usage RPC, 프로필 동기화 |
| `lib/supabase/proxy.ts` | `proxy.ts` (Edge) | 적용 | 세션 쿠키 갱신 + 보호 라우트 리다이렉트 |

`lib/supabase/require-user.ts`의 `requireUser()`는 모든 보호된 API 라우트의 표준 진입점입니다
(`{ supabase, user }` 반환, `user`가 없으면 각 라우트가 401을 반환).

> **service-role 규칙**: `createServiceClient()`는 절대 클라이언트 번들에 들어가면 안 되고,
> 사용자 요청 경로의 일반 조회에 쓰면 안 됩니다. 현재 정당한 사용처는 3곳뿐입니다 —
> `app/api/webhooks/polar/route.ts`, `app/api/chat/route.ts`(usage RPC), `app/auth/callback/route.ts`.

## 5. 데이터 모델

모든 테이블에 RLS가 활성화되어 있습니다.

### `conversations`
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid → `auth.users` | on delete cascade |
| `title_encrypted` | text not null | AES-256-GCM |
| `created_at` | timestamptz | 인덱스: `(user_id, created_at desc)` |

RLS: 소유자에 대해 select/insert/update/delete 모두 허용.

### `messages`
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` | uuid PK | |
| `conversation_id` | uuid → `conversations` | on delete cascade |
| `role` | text | `user` \| `assistant` |
| `content_encrypted` | text not null | AES-256-GCM |
| `created_at` | timestamptz | 인덱스: `(conversation_id, created_at)` |

RLS: 상위 `conversations.user_id = auth.uid()`인 행만 select/insert/delete.

### `profiles`
`user_id` PK, `email_encrypted` / `email_hash` / `full_name_encrypted` / `full_name_hash`.
RLS는 **읽기 전용**(select만 허용) — 모든 쓰기는 service-role + `lib/encryption.ts`를 거쳐야
클라이언트가 평문이나 불일치 해시를 심을 수 없습니다. `*_hash`에는 부분 인덱스가 있습니다.

### `subscriptions`
`user_id` PK, `polar_customer_id`, `polar_subscription_id`(unique),
`plan`(`free|pro|unlimited`), `status`(`active|past_due|revoked`), `cancel_at_period_end`,
`current_period_end`, `created_at`, `updated_at`. RLS는 소유자 select만 허용(쓰기는 웹훅 전용).

`auth.users` insert 트리거 `on_auth_user_created_subscription`이 **가입 시점에 free 행을 자동 생성**
합니다. 애플리케이션 코드의 `DEFAULT_FREE_SUBSCRIPTION`(`lib/polar/subscription.ts`)은 트리거가
아직 돌지 않았거나 행이 유실된 경우를 위한 **폴백**입니다.

### `usage`
`(user_id, month)` 복합 PK, `count`, `updated_at`. `month`는 `'YYYY-MM'` 문자열이며 **항상 서버에서
`to_char(now(), 'YYYY-MM')`으로 계산** — 클라이언트 입력을 받지 않습니다. RLS는 소유자 select만 허용.

### `webhook_events`
`id`(Polar `webhook-id` 헤더) PK, `event_type`, `payload` jsonb, `received_at`.
RLS 활성 + **정책 0개** = anon/authenticated 완전 차단, service-role만 접근 가능.

## 6. API 명세

모든 라우트는 인증 실패 시 `401 { error: "로그인이 필요합니다." }`를 반환합니다.
에러 본문은 항상 `lib/api/error-response.ts`의 `errorResponse(message, status)`로 만든 `{ error }` 형태입니다.

| 메서드 | 경로 | 요청 | 성공 응답 | 주요 실패 |
| --- | --- | --- | --- | --- |
| POST | `/api/chat` | `{ conversationId, content }` | `text/plain` 스트림 | 400 잘못된 본문 / 404 대화 없음 / **429 `{ error: "limit_exceeded", upgrade_url: "/pricing" }`** / 429 Gemini 혼잡 / 502 Gemini 오류 / 500 |
| GET | `/api/conversations` | — | `{ conversations: [{ id, title, created_at }] }` | 500 |
| POST | `/api/conversations` | — | `201 { conversation }` | 500 |
| DELETE | `/api/conversations/[id]` | — | `204` | 404 / 500 |
| GET | `/api/conversations/[id]/messages` | — | `{ messages: [{ id, role, content }] }` | 500 |
| GET | `/api/search?q=` | 쿼리스트링 | `{ results: [...] }` (최대 50건) | 500 |
| GET | `/api/usage` | — | `{ plan, used, limit, remaining }` | 500 |
| GET | `/api/subscription` | — | `{ subscription }` | 500 |
| PATCH | `/api/subscription/change` | `{ plan: "pro"\|"unlimited" }` | `{ ok: true }` | 400 활성 구독 없음/동일 플랜 / 500 |
| POST | `/api/subscription/cancel` | `{ resume?: boolean }` | `{ ok: true }` | 400 / 500 |
| POST | `/api/checkout` | `{ plan }` | `{ url }` | 400 이미 활성 구독 / 500 |
| POST | `/api/billing/portal` | — | `{ url }` | 400 고객 정보 없음 / 500 |
| POST | `/api/webhooks/polar` | Polar 서명 페이로드 | `{ ok: true }` | 403 서명 불일치 / 400 payload·헤더 누락 / 500 처리 실패(재시도 유도) |

동적 라우트는 Next.js 16의 `RouteContext<"/api/...">` 타입을 사용하고 `params`는 **await**해야 합니다.

## 7. 사용량 제어 설계 (핵심)

`supabase/migrations/20260804165253_atomic_usage_limit.sql`

기존의 "읽고 → 비교하고 → 나중에 증가" 방식은 동시 요청이 모두 증가 전 카운트를 읽어 한도를 우회할 수
있었습니다. 현재는 **예약(reserve) / 해제(release)** 모델입니다.

- `try_increment_usage(p_user_id, p_limit)` — 한도 검사와 증가를 **단일 upsert**로 처리하고 새 카운트를
  반환합니다. 한도에 이미 도달했으면 `null`을 반환합니다. Postgres의 `(user_id, month)` 행 잠금으로
  동시 요청이 직렬화됩니다. **생성 시작 전에 호출**합니다.
- `release_usage(p_user_id)` — 예약한 슬롯이 과금 대상 출력을 만들지 못했을 때 되돌립니다
  (`greatest(count - 1, 0)`).
- 두 함수 모두 `security definer` + `search_path = ''`이며 EXECUTE 권한은 **service_role에만** 부여됩니다.

### 필수 규칙

> `try_increment_usage` 이후의 **모든 실패 분기는 반드시 `release_usage`를 호출**해야 합니다.
> 그렇지 않으면 실패한 요청이 사용자의 월 한도를 영구히 소모합니다.

`app/api/chat/route.ts`의 해제 지점: 대화 조회 실패, 대화 없음, 기록 조회 실패, 사용자 메시지 저장 실패,
Gemini 호출 실패, 스트림 중단, **클라이언트 연결 종료**(`ReadableStream.cancel`), **빈 응답**.
해제는 `usageReserved` 플래그로 1회만 실행됩니다.

예약 이후의 코드는 전체가 `try/catch`로 감싸여 있습니다. `encrypt()`/`decrypt()`는 키가 없거나
저장값이 손상되면 **throw**하는데, 이 예외가 밖으로 새면 Next.js가 500을 내보내는 동안 예약된 슬롯이
그대로 소모됩니다. 새 코드를 예약 이후에 추가할 때도 이 `try/catch` 안에 두세요.

새로운 과금 대상 동작을 추가할 때도 동일한 "작업 전 예약 → 실패 시 해제" 패턴을 따르세요.
작업 완료 후 증가시키는 방식은 금지입니다(동시 요청 레이스).

## 8. 채팅 스트리밍 흐름

`app/api/chat/route.ts`

1. `requireUser()` → 본문 검증 → `GOOGLE_API_KEY` 확인
2. `getUserSubscription()` → `PLAN_LIMITS[plan]`으로 한도 결정
3. `try_increment_usage`로 슬롯 예약 (실패 시 429 + `upgrade_url`)
4. 대화 소유 확인(RLS 스코프 클라이언트) → 메시지 기록 조회
5. 사용자 메시지 암호화 저장, 첫 메시지면 앞 24자를 제목으로 갱신
6. 기록을 복호화해 `Content[]` 구성 → `generateContentStream` 호출
7. `ReadableStream`으로 청크를 즉시 전달하면서 서버에서 `fullText` 버퍼링
8. 스트림 정상 완료 + `fullText`가 있을 때만 어시스턴트 메시지를 암호화 저장,
   그렇지 않으면 `release_usage`

응답 헤더는 `Content-Type: text/plain; charset=utf-8`이며, 클라이언트는 이를 읽어 점진 렌더링합니다.

## 9. 암호화 설계

`lib/encryption.ts`

- `encrypt(text)` → `iv:authTag:ciphertext` (모두 hex). AES-256-GCM, IV 16바이트(프로젝트 스펙상 의도된
  선택), 호출마다 새 랜덤 IV.
- `decrypt(payload)` → 형식 오류·변조·키 불일치 시 throw.
- `decryptOrFallback(payload, fallback)` → 목록/검색 경로 전용. 한 행이 복호화되지 않아도 요청 전체를
  실패시키지 않도록 로그를 남기고 `fallback`을 돌려줍니다 (대화 목록, 메시지 목록, 검색에서 사용).
  값이 반드시 정확해야 하는 경로(예: Gemini에 넘길 대화 문맥)에는 쓰지 말고 `decrypt`를 쓰세요.
- `hashForLookup(value)` → HMAC-SHA256(hex). 입력을 정규화하지 않으므로 저장·조회 시 동일하게
  정규화하는 것은 호출자 책임입니다.
- 키(`ENCRYPTION_KEY`, `HASH_KEY`)는 64자 hex여야 하며 형식 검증 후 프로세스 내 캐시됩니다.

### 조회 규칙

랜덤 IV 때문에 같은 값도 매번 다른 암호문이 되어 **암호화 컬럼은 SQL 등치 비교가 불가능**합니다.
조회가 필요한 값은 `*_hash` 컬럼(HMAC)을 따로 두고 그 컬럼에 필터를 겁니다(예: `email_hash`).
`/api/search`는 해시로 부분 일치를 만들 수 없어, RLS로 스코프된 행을 서버에서 복호화한 뒤
대소문자 무시 `includes`로 필터합니다. 복호화와 매칭을 한 루프에서 처리해 **50건을 채우면 즉시 중단**
하므로 최신순 상위 매치까지만 복호화하지만, 매치가 적은 질의는 여전히 전량 복호화합니다 — 데이터가
커지면 재설계가 필요합니다.

## 10. 결제 / 웹훅 설계

- `lib/polar/plans.ts` — `PLAN_LIMITS`, `PLAN_LABELS`, `PLAN_PRICE_LABELS`, `PLAN_PRODUCT_IDS`,
  `planFromProductId()`, `planIndex()`, `isPaidPlan()`. **플랜 정보의 단일 진실 공급원.**
- 체크아웃은 `metadata: { userId }`를 실어 보내고, 웹훅은 이를 사용해 사용자와 구독을 연결합니다
  (`resolveUserId()`는 기존 `polar_subscription_id` 매칭 → 없으면 metadata 순).
- 웹훅 처리 순서: `validateEvent()` 서명 검증 → `webhook-id` 헤더 확인 →
  `webhook_events`에 **먼저 insert**(unique violation `23505` = 이미 처리 → 즉시 `{ ok: true }`) →
  이벤트 타입별 처리.
- **처리 실패 시 원장 롤백**: 핸들러가 DB 쓰기에 실패하면 방금 넣은 `webhook_events` 행을 삭제하고
  500을 반환합니다. 원장 행을 남겨두면 Polar의 재전송이 "이미 처리됨"으로 걸러져 이벤트가 영구히
  유실됩니다. 재시도해도 절대 성공할 수 없는 경우(사용자 매칭 실패, 미등록 product id, 결제 미완료)는
  실패가 아니라 **skip**으로 간주해 200을 반환합니다.
- 이벤트 매핑: `subscription.created|active|updated|canceled|uncanceled` → 구독 upsert /
  `subscription.past_due` → `status = past_due` / `subscription.revoked` → `plan = free`, `status = revoked`.
- upsert의 `status`는 상수 `active`가 아니라 Polar 상태를 매핑해 씁니다(`past_due`/`unpaid` → `past_due`,
  그 외 → `active`). 상수로 쓰면 연체 구독에 `subscription.updated`가 도착했을 때 `past_due`가 조용히
  `active`로 되돌아가 유료 한도가 복구됩니다. Polar의 `canceled`는 기간 말까지 유효한 상태이므로
  `active`로 두고, 접근 종료는 `subscription.revoked`가 담당합니다.
- `incomplete`, `incomplete_expired` 상태는 결제가 완료되지 않은 것이므로 플랜을 부여하지 않고 건너뜁니다
  (이후 `active`/`updated` 이벤트에서 재동기화).
- 플랜 변경·해지는 자체 DB를 먼저 쓰지 않고 Polar SDK를 호출한 뒤, 결과를 웹훅으로 되받아 반영합니다
  (단일 진실 공급원은 Polar).

## 11. 인증 / 라우트 보호

- `proxy.ts`가 정적 자산을 제외한 모든 경로에 매칭되어 `updateSession()`을 실행합니다.
- 세션 쿠키 갱신은 여기서만 가능합니다(서버 컴포넌트는 쿠키를 쓸 수 없음).
- 보호 라우트: `/dashboard`, `/billing` → 비로그인 시 `/login?redirectedFrom=...`.
- 인증 라우트: `/login` → 로그인 상태면 `/dashboard`.
- `app/auth/callback/route.ts`가 `exchangeCodeForSession` 후 프로필을 암호화 동기화하고,
  `safeRedirectPath()`를 통과한 경로로만 되돌려 보냅니다: `/`로 시작해야 하며 `//`·`/\`로 시작하는
  값은 프로토콜 상대 URL로 해석될 수 있어 `/dashboard`로 대체합니다(open redirect 방지).
- 프로필 동기화는 best-effort입니다 — 암호화 키 오설정이나 쓰기 실패가 로그인 자체를 막지 않습니다.

## 12. 코딩 규약

- 컴포넌트 파일은 kebab-case, 컴포넌트 함수는 PascalCase, **named export만** (default export 없음).
- 유틸/훅 함수는 camelCase, 파일명은 kebab-case.
- API 에러 응답은 항상 `errorResponse(...)` 사용 — `Response.json({ error })` 직접 인라인 금지.
- 인증 실패는 `unauthorizedResponse()`, 요청 본문 파싱은 `readJsonBody<T>(request)`(실패 시 `null`)를
  사용합니다 — 둘 다 `lib/api/error-response.ts`.
- 날짜 포맷은 `lib/format.ts`의 `formatDate`(`ko-KR`) 재사용.
- 사용량 관련 계산(`currentUsageMonth` / `getUsedCount` / `usageRatio` / `USAGE_WARNING_RATIO`)은
  `lib/usage.ts`에 모여 있습니다 — 라우트나 컴포넌트에서 `usage` 테이블을 직접 조회하지 마세요.
- 사용자 노출 문자열·에러 메시지는 **한국어**, 코드 식별자·주석·커밋 메시지는 **영어**.
- 커밋은 영어 + `feat:` / `fix:` / `refactor:` / `docs:` 접두사 관례.

## 13. 환경 변수

| 변수 | 노출 | 용도 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | anon 키 (RLS 적용) |
| `SUPABASE_SECRET_KEY` | **secret** | service-role 키 |
| `GOOGLE_API_KEY` | **secret** | Gemini API 키 |
| `ENCRYPTION_KEY` | **secret** | AES-256-GCM 키 (64자 hex) |
| `HASH_KEY` | **secret** | 조회용 HMAC 키 (64자 hex) |
| `POLAR_ACCESS_TOKEN` | **secret** | Polar API 토큰 |
| `POLAR_ENVIRONMENT` | 설정값 | `production` 또는 미설정(sandbox) |
| `POLAR_PRODUCT_ID_PRO` / `_UNLIMITED` | 설정값 | 플랜 ↔ 상품 매핑 |
| `POLAR_WEBHOOK_SECRET` | **secret** | 웹훅 서명 검증 |

시크릿 값을 코드/커밋에 하드코딩하지 않습니다. `.env*`, `*.pem`은 `.gitignore` 대상입니다.

## 14. 빌드 · 검증 · 배포

```bash
npm install
npm run dev      # Turbopack 개발 서버
npm run build    # 프로덕션 빌드
npm run start
npm run lint     # ESLint flat config
npm run db:generate-keys              # ENCRYPTION_KEY / HASH_KEY 생성 → .env.local
npm run db:migrate-encrypt            # 1회성: 기존 평문 데이터 암호화
npm run db:backfill-chat-encryption   # 1회성: 대화/메시지 암호화 백필
```

- **자동화된 테스트 스위트가 없습니다.** 검증 게이트는 `npm run lint` + `npm run build`입니다.
- `scripts/`는 `tsx --env-file=.env.local`로 실행되며 실제 `.env.local` + Supabase 프로젝트가 필요합니다.
- DB 마이그레이션은 `supabase/migrations/`의 SQL을 파일명(타임스탬프) 순으로 Supabase MCP 또는 CLI로
  적용합니다. 마이그레이션 러너/ORM은 없습니다.
- 배포는 Vercel. 환경 변수 등록 후 **재배포**해야 반영되며, Supabase Site URL / Google OAuth 리다이렉트
  URI / Polar 웹훅 엔드포인트를 배포 주소에 맞춰야 합니다(자세한 절차는 README 8장).
- 개발 서버 종료 후 Node 프로세스가 남으면 `Get-Process node` → `taskkill /IM node.exe /F`.

## 15. 기술 부채 / 주의 사항

| 항목 | 내용 |
| --- | --- |
| 검색 확장성 | `/api/search`는 메시지를 메모리에서 복호화·필터 — 50건에서 조기 종료하지만 매치가 없는 질의는 여전히 O(n). |
| 테스트 부재 | 사용량 예약/해제, 웹훅 idempotency 등 회귀 위험이 큰 로직이 수동 검증에만 의존. |
| 키 로테이션 | `ENCRYPTION_KEY` 교체 절차가 없음(교체 시 기존 데이터 복호화 불가). |
| 모델 고정 | `GEMINI_MODEL`이 상수로 하드코딩되어 런타임 전환 불가. |
| 부분 응답 | 스트림 중단 시 이미 사용자에게 표시된 텍스트가 저장되지 않아 화면과 DB가 불일치(사용량은 반환됨). |
| RLS 디버깅 | 사용자 스코프 클라이언트 조회 결과가 비면 앱 버그보다 RLS 정책을 먼저 확인할 것. |
