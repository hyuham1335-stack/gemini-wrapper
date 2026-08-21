import Link from "next/link";

interface PastDueBannerProps {
  status: "active" | "past_due" | "revoked";
}

/**
 * Payment failed but the subscription is still live - Polar is retrying. The
 * fix is updating the payment method, never a second checkout (that would bill
 * the user twice), so the banner points at the billing page.
 */
export function PastDueBanner({ status }: PastDueBannerProps) {
  if (status !== "past_due") return null;

  return (
    <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-500/10 px-6 py-2">
      <span className="text-xs text-red-400">
        결제에 실패했습니다. 결제 수단을 업데이트하지 않으면 구독이 해지될 수 있습니다.
      </span>
      <Link
        href="/billing"
        className="shrink-0 text-xs font-medium text-white underline underline-offset-2"
      >
        결제 수단 관리
      </Link>
    </div>
  );
}
