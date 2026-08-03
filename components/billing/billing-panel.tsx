"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_LABELS, isPaidPlan } from "@/lib/polar/plans";
import type { UserSubscription } from "@/lib/polar/subscription";

interface BillingPanelProps {
  subscription: UserSubscription;
  usage: {
    used: number;
    limit: number | null;
  };
}

function UsageMeter({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">이번 달 사용량</span>
        <span className="text-sm text-neutral-200">무제한</span>
      </div>
    );
  }

  const ratio = limit === 0 ? 1 : Math.min(used / limit, 1);
  const isWarning = ratio >= 0.8;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">이번 달 사용량</span>
        <span className={`text-sm ${isWarning ? "text-amber-400" : "text-neutral-200"}`}>
          {used.toLocaleString()} / {limit.toLocaleString()}회
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full ${isWarning ? "bg-amber-400" : "bg-white"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BillingPanel({ subscription: initial, usage }: BillingPanelProps) {
  const [subscription, setSubscription] = useState(initial);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const paid = isPaidPlan(subscription.plan);

  async function handleCancelToggle(resume: boolean) {
    setIsPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "요청에 실패했습니다.");
        return;
      }
      setSubscription((prev) => ({ ...prev, cancelAtPeriodEnd: !resume }));
      setNotice(
        resume
          ? "구독이 재개되었습니다."
          : "해지 요청이 접수되었습니다. 결제 기간이 끝나면 Free로 전환됩니다."
      );
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  async function handlePortal() {
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "결제 관리 페이지를 열지 못했습니다.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-neutral-800 bg-neutral-950 p-8">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">현재 플랜</span>
        <span className="text-lg font-semibold text-white">{PLAN_LABELS[subscription.plan]}</span>
      </div>

      <UsageMeter used={usage.used} limit={usage.limit} />

      {paid && subscription.currentPeriodEnd && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-400">
            {subscription.cancelAtPeriodEnd ? "해지 예정일" : "다음 결제일"}
          </span>
          <span className="text-sm text-neutral-200">{formatDate(subscription.currentPeriodEnd)}</span>
        </div>
      )}

      {subscription.status === "past_due" && (
        <p className="rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">
          결제에 실패했습니다. 결제 수단을 확인해주세요.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {paid && (
          <button
            type="button"
            onClick={handlePortal}
            disabled={isPending}
            className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            결제 수단 관리
          </button>
        )}

        {paid && (
          <Link
            href="/pricing"
            className="rounded-full border border-neutral-700 px-4 py-2 text-center text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
          >
            플랜 변경
          </Link>
        )}

        {paid && !subscription.cancelAtPeriodEnd && (
          <button
            type="button"
            onClick={() => handleCancelToggle(false)}
            disabled={isPending}
            className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            구독 해지
          </button>
        )}

        {paid && subscription.cancelAtPeriodEnd && (
          <button
            type="button"
            onClick={() => handleCancelToggle(true)}
            disabled={isPending}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            구독 재개
          </button>
        )}

        {!paid && (
          <Link
            href="/pricing"
            className="rounded-full bg-white px-4 py-2 text-center text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            요금제 보기
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-neutral-400">{notice}</p>}
    </div>
  );
}
