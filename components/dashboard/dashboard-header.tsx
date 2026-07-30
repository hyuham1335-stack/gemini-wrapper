import Link from "next/link";

interface DashboardHeaderProps {
  userLabel: string;
  used: number;
  limit: number | null;
  onSignOut: () => void;
}

export function DashboardHeader({ userLabel, used, limit, onSignOut }: DashboardHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
      <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Gemini Wrapper
      </span>

      <div className="flex items-center gap-3">
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
        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300">
          {limit === null ? "무제한" : `${used.toLocaleString()} / ${limit.toLocaleString()} 사용`}
        </span>
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
