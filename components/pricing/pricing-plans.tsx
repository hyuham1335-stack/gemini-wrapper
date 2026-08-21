"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PLAN_LABELS,
  PLAN_ORDER,
  PLAN_PRICE_LABELS,
  PLAN_REQUEST_LABELS,
  planIndex,
  type Plan,
} from "@/lib/polar/plans";
import { hasLiveSubscription, type UserSubscription } from "@/lib/polar/subscription";

interface PricingPlansProps {
  /** `null` means a signed-out visitor: no plan is "current" for them yet. */
  subscription: UserSubscription | null;
}

/**
 * Copy shown under the price. The quota line is derived from
 * `PLAN_REQUEST_LABELS` so it can never drift from `PLAN_LIMITS`.
 */
const PLAN_BENEFITS: Record<Plan, string[]> = {
  free: ["대화 기록 암호화 저장", "전체 메시지 검색"],
  pro: ["대화 기록 암호화 저장", "전체 메시지 검색", "언제든 해지 · 플랜 변경"],
  unlimited: ["대화 기록 암호화 저장", "전체 메시지 검색", "언제든 해지 · 플랜 변경"],
};

function planFeatures(plan: Plan): string[] {
  return [`${PLAN_REQUEST_LABELS[plan]} Gemini 대화`, ...PLAN_BENEFITS[plan]];
}

export function PricingPlans({ subscription }: PricingPlansProps) {
  const router = useRouter();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isLoggedIn = subscription !== null;
  const currentPlan = subscription?.plan ?? "free";
  const hasActiveSubscription = subscription ? hasLiveSubscription(subscription) : false;
  const isPastDue = subscription?.status === "past_due";
  const cancelScheduled = subscription?.cancelAtPeriodEnd ?? false;
  const currentIdx = planIndex(currentPlan);

  function goToLogin() {
    router.push("/login?redirectedFrom=/pricing");
  }

  async function handleUpgrade(plan: Plan) {
    if (!isLoggedIn) {
      goToLogin();
      return;
    }

    setPendingPlan(plan);
    setError(null);
    setNotice(null);

    try {
      if (!hasActiveSubscription) {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data?.error ?? "결제 세션을 생성하지 못했습니다.");
          return;
        }
        window.location.assign(data.url);
        return;
      }

      const response = await fetch("/api/subscription/change", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "플랜을 변경하지 못했습니다.");
        return;
      }
      setNotice("플랜 변경 요청이 접수되었습니다. 잠시 후 반영됩니다.");
      setTimeout(() => router.refresh(), 2000);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPendingPlan(null);
    }
  }

  async function handleCancel() {
    // Cancelling drops the user to Free at period end - make it deliberate.
    if (!window.confirm("구독을 해지할까요? 현재 결제 기간이 끝나면 Free로 전환됩니다.")) return;

    setPendingPlan("free");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/subscription/cancel", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "해지 요청에 실패했습니다.");
        return;
      }
      setNotice("해지 요청이 접수되었습니다. 현재 결제 기간이 끝나면 Free로 전환됩니다.");
      setTimeout(() => router.refresh(), 2000);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6">
      {isPastDue && (
        <div className="flex w-full flex-wrap items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
          <span className="text-sm text-red-400">
            결제에 실패한 구독이 있습니다. 새로 결제하는 대신 결제 수단을 업데이트해주세요.
          </span>
          <Link
            href="/billing"
            className="shrink-0 text-sm font-medium text-white underline underline-offset-2"
          >
            결제 수단 관리
          </Link>
        </div>
      )}

      <div className="grid w-full gap-6 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const cardIdx = planIndex(plan);
          // A signed-out visitor has no current plan - every card invites them in.
          const isCurrent = isLoggedIn && plan === currentPlan;
          const isFeatured = plan === "pro";
          const isPending = pendingPlan === plan;

          let action: { label: string; onClick: () => void } | null = null;
          let staticLabel: string | null = null;

          if (isCurrent) {
            staticLabel = cancelScheduled ? "현재 플랜 (해지 예정)" : "현재 플랜";
          } else if (!isLoggedIn) {
            action = {
              label: plan === "free" ? "무료로 시작하기" : "시작하기",
              onClick: goToLogin,
            };
          } else if (cardIdx > currentIdx) {
            action = { label: "업그레이드", onClick: () => handleUpgrade(plan) };
          } else if (plan === "free") {
            // Already ending at period end - a second cancel request is a no-op.
            if (cancelScheduled) {
              staticLabel = "해지 예정";
            } else {
              action = { label: "해지", onClick: handleCancel };
            }
          } else {
            action = { label: "변경", onClick: () => handleUpgrade(plan) };
          }

          return (
            <div
              key={plan}
              className={`relative flex flex-col gap-6 rounded-xl border p-8 ${
                isFeatured
                  ? "border-white bg-neutral-900 sm:-translate-y-2 sm:scale-105"
                  : "border-neutral-800 bg-neutral-950"
              }`}
            >
              {isFeatured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-black">
                  추천
                </span>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
                  {PLAN_LABELS[plan]}
                </span>
                <span className="text-3xl font-semibold text-white">{PLAN_PRICE_LABELS[plan]}</span>
                <span className="text-sm text-neutral-400">{PLAN_REQUEST_LABELS[plan]}</span>
              </div>

              <ul className="flex flex-1 flex-col gap-2 text-sm text-neutral-300">
                {planFeatures(plan).map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-neutral-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {staticLabel ? (
                <span className="rounded-full border border-neutral-700 px-4 py-2 text-center text-sm font-medium text-neutral-300">
                  {staticLabel}
                </span>
              ) : (
                action && (
                  <button
                    type="button"
                    onClick={action.onClick}
                    disabled={isPending}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "처리 중..." : action.label}
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-neutral-400">{notice}</p>}
    </div>
  );
}
