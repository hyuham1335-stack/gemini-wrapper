import Link from "next/link";

interface CancellationBannerProps {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CancellationBanner({
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: CancellationBannerProps) {
  if (!cancelAtPeriodEnd || !currentPeriodEnd) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-6 py-2">
      <span className="text-xs text-amber-400">
        구독이 해지 예정입니다. {formatDate(currentPeriodEnd)}부터 Free 요금제로 전환됩니다.
      </span>
      <Link
        href="/billing"
        className="shrink-0 text-xs font-medium text-white underline underline-offset-2"
      >
        구독 재개
      </Link>
    </div>
  );
}
