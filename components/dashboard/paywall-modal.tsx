"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PLAN_LABELS, type Plan } from "@/lib/polar/plans";

interface PaywallModalProps {
  plan: Plan;
  limit: number | null;
  onClose: () => void;
}

export function PaywallModal({ plan, limit, onClose }: PaywallModalProps) {
  // Escape closes the modal wherever focus happens to be, matching the search modal.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paywall-title" className="text-lg font-semibold text-white">
          이번 달 사용 한도에 도달했습니다
        </h2>
        <p className="text-sm text-neutral-400">
          {limit === null
            ? "더 많은 대화를 이용하려면 플랜을 업그레이드해주세요."
            : `${PLAN_LABELS[plan]} 플랜은 월 ${limit.toLocaleString()}회까지 이용할 수 있습니다. 다음 달에 한도가 초기화되며, 지금 더 쓰려면 플랜을 업그레이드해주세요.`}
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <Link
            href="/pricing"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            업그레이드
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
