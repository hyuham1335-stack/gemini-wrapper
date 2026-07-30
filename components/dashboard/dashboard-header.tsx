interface DashboardHeaderProps {
  userLabel: string;
  creditsUsed: number;
  creditsTotal: number;
  onSignOut: () => void;
}

export function DashboardHeader({
  userLabel,
  creditsUsed,
  creditsTotal,
  onSignOut,
}: DashboardHeaderProps) {
  const creditsRemaining = Math.max(creditsTotal - creditsUsed, 0);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
      <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Gemini Wrapper
      </span>

      <div className="flex items-center gap-3">
        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300">
          {creditsRemaining.toLocaleString()} / {creditsTotal.toLocaleString()} 크레딧
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
