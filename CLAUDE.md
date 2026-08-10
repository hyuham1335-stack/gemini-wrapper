# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Gemini Wrapper is a subscription SaaS wrapper around the Google Gemini API: Google OAuth login
(Supabase Auth), a chat dashboard that streams Gemini responses, server-side encrypted conversation
storage, and plan-based (Free/Pro/Unlimited) monthly usage limits with Polar for paid upgrades.
`README.md` has the full env var table, DB schema table, and deployment steps — read it before
structural changes.

## 절대 규칙 (Critical Rules)

- **Next.js 16 API가 학습 데이터와 다릅니다.** 라우팅/설정/App Router 관례를 건드리기 전에
  `node_modules/next/dist/docs/`에서 현재 버전 문서를 먼저 확인하세요 (예: `middleware.ts`가 아니라
  `proxy.ts` / `export function proxy()`).
- **시크릿 파일 커밋 금지.** `.env*`, `*.pem` 등은 `.gitignore`에 이미 포함되어 있습니다.
  `ENCRYPTION_KEY`/`HASH_KEY`/`SUPABASE_SECRET_KEY`/`POLAR_*` 값을 코드나 커밋에 절대 하드코딩하지 마세요.
- **`lib/supabase/service.ts`(service-role 클라이언트)는 RLS를 우회합니다.** 웹훅, usage 예약 RPC,
  프로필 동기화 등 서버 전용 코드에서만 사용하고, 절대 클라이언트(브라우저)로 노출하거나 사용자
  요청 경로의 일반 조회에 쓰지 마세요. 사용자를 대신하는 조회/쓰기는 `lib/supabase/server.ts` /
  `client.ts`(쿠키 스코프, RLS 적용)를 사용합니다.
- **usage 예약(`try_increment_usage`) 이후의 모든 실패 분기는 반드시 `release_usage`를 호출해야
  합니다.** 그렇지 않으면 실패한 요청이 사용자의 월간 한도를 영구적으로 소모합니다
  (`app/api/chat/route.ts`, `supabase/migrations/20260804165253_atomic_usage_limit.sql` 참고).
- 새로운 과금 대상 동작을 추가할 때도 "작업 시작 전 예약 → 실패 시 해제" 패턴을 따르세요
  (증분을 작업 끝난 뒤에 하지 마세요 — 동시 요청 시 한도를 우회할 수 있습니다).

## 아키텍처 (Architecture)

단일 Next.js 16 앱 (App Router), 별도 백엔드 서버 없음 — API 라우트가 백엔드 역할을 겸함.

```
app/
  page.tsx, login/, pricing/, billing/, dashboard/     # 페이지
  auth/callback/route.ts                               # OAuth 콜백 (세션 교환 + 프로필 동기화)
  api/
    chat/route.ts                                      # Gemini 스트리밍 채팅
    conversations/...                                  # 대화 목록/생성/삭제/메시지
    usage/route.ts                                      # 이번 달 사용량
    checkout/route.ts, billing/portal/route.ts          # Polar 체크아웃/포탈
    subscription/...                                    # 구독 조회/변경/취소
    webhooks/polar/route.ts                              # Polar 웹훅 (서명 검증 + idempotent)
components/                                              # 채팅/청구/가격 UI
contexts/auth-context.tsx                                # 전역 Supabase 인증 상태
lib/
  supabase/{client,server,service,proxy,require-user}.ts # Supabase 클라이언트 4종
  gemini/client.ts                                        # Gemini SDK 인스턴스
  polar/{client,plans,subscription}.ts                    # 결제/플랜 로직
  encryption.ts                                            # AES-256-GCM + HMAC 조회 해시
  api/error-response.ts, format.ts                          # 라우트 공통 헬퍼
supabase/migrations/                                       # SQL 마이그레이션 (타임스탬프 순 적용)
scripts/                                                     # 키 생성 / 암호화 마이그레이션 / 백필
proxy.ts                                                     # 라우트 보호 (구 middleware.ts)
```

**기술 스택**: Next.js 16.2.12 (App Router) · React 19.2.4 · TypeScript · Tailwind CSS 4 ·
Supabase (`@supabase/ssr`, `@supabase/supabase-js` — Auth/Postgres/RLS) · Google Gemini
(`@google/genai`) · Polar (`@polar-sh/sdk`) · Node `crypto` 기반 AES-256-GCM + HMAC-SHA256 암호화.
데이터베이스/ORM 레이어 없음 — Supabase JS 클라이언트로 직접 쿼리, 스키마는 순수 SQL 마이그레이션.

**Supabase 클라이언트 4종, 용도가 다름**:
| 파일 | 용도 |
| --- | --- |
| `lib/supabase/server.ts` | 서버 컴포넌트/라우트에서 쿠키 스코프로 사용자 대신 조회 (RLS 적용) |
| `lib/supabase/client.ts` | 브라우저 컴포넌트용 (RLS 적용) |
| `lib/supabase/service.ts` | service-role, RLS 우회 — 웹훅/usage RPC/프로필 동기화 전용 |
| `lib/supabase/proxy.ts` | `proxy.ts`에서 세션 갱신 + 보호 라우트 리다이렉트 |

## 빌드/테스트 (Build & Test)

```bash
npm install                              # 의존성 설치
npm run dev                              # 개발 서버 (Turbopack)
npm run build                            # 프로덕션 빌드
npm run start                            # 프로덕션 서버 실행
npm run lint                             # ESLint (flat config, eslint-config-next)
npm run db:generate-keys                 # ENCRYPTION_KEY/HASH_KEY 생성 → .env.local
npm run db:migrate-encrypt               # 기존 평문 데이터 암호화 (1회성)
npm run db:backfill-chat-encryption      # 대화/메시지 암호화 백필 (1회성)
```

- 자동화된 테스트 스위트는 구성되어 있지 않습니다 (`test`/`test:e2e` 스크립트 없음).
- `scripts/`의 스크립트는 `tsx --env-file=.env.local`로 실행되며 실제 `.env.local` + Supabase
  프로젝트가 필요합니다.
- DB 마이그레이션은 `supabase/migrations/`의 SQL 파일을 파일명(타임스탬프) 순서로 Supabase
  MCP 도구 또는 CLI를 통해 적용합니다 — 별도 마이그레이션 러너/ORM 없음.
- 종료 후 Node 프로세스가 남으면 `Get-Process node` 확인 → `taskkill /IM node.exe /F`.

## 도메인 컨텍스트 (Domain Context)

- **Plan**: `free`(월 10회) / `pro`(월 100회) / `unlimited`(무제한) — `lib/polar/plans.ts`의
  `PLAN_LIMITS`가 단일 진실 공급원(source of truth). `planFromProductId()`가 Polar product ID를
  플랜으로 매핑.
- **Subscription**: `subscriptions` 테이블에 행이 없으면 신규 유저는 암묵적으로 free 플랜
  (`lib/polar/subscription.ts`의 `DEFAULT_FREE_SUBSCRIPTION`) — 결제 전에는 행이 생성되지 않음.
- **Usage**: 사용자별 월간 호출 횟수. 체크-후-증가(check-then-increment) 방식이 아니라
  reserve/release RPC(`try_increment_usage` / `release_usage`)로 원자적 처리 — 동시 요청 레이스로
  한도를 우회하는 것을 방지 (절대 규칙 참고).
- **Conversation → Message**: 대화방(`conversations`)과 메시지(`messages`)는 1:N. 제목/본문은
  암호화 저장, 첫 메시지 전송 시 앞 24자를 잘라 대화 제목으로 사용.
- **Chat 스트리밍 흐름** (`app/api/chat/route.ts`): usage 예약 → 대화/기록 조회 → 사용자 메시지
  저장 → 복호화한 기록 + 신규 메시지로 `generateContentStream` 호출 → 청크를 `ReadableStream`으로
  즉시 전달하면서 서버에서 전체 텍스트 버퍼링 → 스트림 완료 시에만 어시스턴트 메시지를 암호화하여
  저장 (빈 응답/에러 시 메시지 저장 없이 usage 해제).
- **암호화 조회**: 암호화된 컬럼은 매 호출 랜덤 IV로 값이 달라져 등치 비교가 불가능 — 조회가
  필요한 값(예: 이메일)은 `hashForLookup()`으로 만든 `*_hash` 컬럼을 별도로 두고 그 컬럼에 필터.
- **Webhook idempotency**: `webhook_events` 테이블로 Polar 웹훅 이벤트 중복 처리를 방지
  (service-role 전용).

## 코딩 컨벤션 (Coding Conventions)

- 컴포넌트 파일: kebab-case (`chat-panel.tsx`, `dashboard-header.tsx`), 컴포넌트 함수명은
  PascalCase (`ChatPanel`, `DashboardHeader`) — **named export만 사용**, default export 없음.
- 훅/유틸 파일: camelCase 함수명 (`requireUser`, `formatDate`, `hashForLookup`), 파일명은 kebab-case.
- API 라우트 에러 응답은 항상 `lib/api/error-response.ts`의 `errorResponse(message, status)`를
  통해 `{ error }` 형태로 통일 — `Response.json({ error })`을 직접 인라인하지 않음.
- 날짜 포맷은 `lib/format.ts`의 `formatDate` 재사용 (`ko-KR` 로케일).
- **UI 문자열/사용자向 에러 메시지는 한국어**, 코드 식별자·주석·커밋 메시지는 영어
  (`app/api/**/route.ts`의 기존 `errorResponse(...)` 톤 참고).
- 커밋 메시지는 영어, Conventional Commits 스타일은 강제되지 않으나 최근 커밋은
  `feat:`/`fix:`/`refactor:` 접두사를 사용하는 경향이 있음 (`git log`로 확인).
- Row Level Security가 모든 테이블에 적용되어 있음 — 사용자 스코프 클라이언트로 쿼리했는데
  결과가 비어있다면 앱 버그를 의심하기 전에 RLS 정책을 먼저 확인.
