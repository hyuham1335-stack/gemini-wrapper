import Link from "next/link";
import { USAGE_WARNING_RATIO, usageRatio } from "@/lib/usage";

interface DashboardHeaderProps {
  userLabel: string;
  used: number;
  limit: number | null;
  onSignOut: () => void;
  onOpenSearch: () => void;
}

export function DashboardHeader({
  userLabel,
  used,
  limit,
  onSignOut,
  onOpenSearch,
}: DashboardHeaderProps) {
  const isWarning = limit !== null && usageRatio(used, limit) >= USAGE_WARNING_RATIO;

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
      <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Gemini Wrapper
      </span>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="메시지 검색"
          className="flex items-center gap-2 rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">검색</span>
        </button>
        <Link
          href="/pricing"
          className="hidden text-sm text-neutral-400 transition hover:text-neutral-200 sm:inline"
        >
          요금제
        </Link>
        <Link
          href="/billing"
          className="hidden text-sm text-neutral-400 transition hover:text-neutral-200 sm:inline"
        >
          청구 설정
        </Link>
        {/* Doubles as the billing entry point on small screens, where the
            text links above are hidden. */}
        <Link
          href="/billing"
          aria-label="이번 달 사용량 · 청구 설정"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            isWarning
              ? "border-amber-500/50 text-amber-400 hover:border-amber-400"
              : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
          }`}
        >
          {limit === null ? "무제한" : `${used.toLocaleString()} / ${limit.toLocaleString()} 사용`}
        </Link>
        <span className="hidden text-sm text-neutral-400 sm:inline">{userLabel}</span>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-neutral-700 px-4 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
