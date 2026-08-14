import Link from "next/link";
import { USAGE_WARNING_RATIO, usageRatio } from "@/lib/usage";

interface UsageBannerProps {
  used: number;
  limit: number | null;
}

export function UsageBanner({ used, limit }: UsageBannerProps) {
  if (limit === null) return null;

  const ratio = usageRatio(used, limit);
  const isWarning = ratio >= USAGE_WARNING_RATIO;

  return (
    <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-6 py-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full ${isWarning ? "bg-amber-400" : "bg-white"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className={`shrink-0 text-xs ${isWarning ? "text-amber-400" : "text-neutral-400"}`}>
        이번 달 {used.toLocaleString()} / {limit.toLocaleString()}회 사용
      </span>
      {isWarning && (
        <Link
          href="/pricing"
          className="shrink-0 text-xs font-medium text-white underline underline-offset-2"
        >
          업그레이드
        </Link>
      )}
    </div>
  );
}
