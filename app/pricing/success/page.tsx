"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PLAN_LABELS, type Plan } from "@/lib/polar/plans";

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 7;

export default function PricingSuccessPage() {
  const [status, setStatus] = useState<"checking" | "confirmed" | "timeout">("checking");
  const [plan, setPlan] = useState<Plan | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/subscription");
        if (response.ok) {
          const data = await response.json();
          if (data.subscription?.plan && data.subscription.plan !== "free") {
            if (!cancelled) {
              setPlan(data.subscription.plan);
              setStatus("confirmed");
            }
            return;
          }
        }
      } catch {
        // 다음 시도에서 재확인
      }

      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        if (!cancelled) setStatus("timeout");
        return;
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Gemini Wrapper
      </span>

      {status === "checking" && (
        <>
          <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            결제 확인 중입니다...
          </h1>
          <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
            잠시만 기다려주세요. 결제 결과를 반영하고 있습니다.
          </p>
        </>
      )}

      {status === "confirmed" && (
        <>
          <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            {plan ? PLAN_LABELS[plan] : ""} 플랜 결제가 완료되었습니다
          </h1>
          <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
            이제 업그레이드된 플랜으로 이용하실 수 있습니다.
          </p>
        </>
      )}

      {status === "timeout" && (
        <>
          <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            결제 확인이 지연되고 있습니다
          </h1>
          <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
            결제는 정상적으로 처리되었을 수 있습니다. 잠시 후 청구 설정 페이지에서 다시 확인해주세요.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200"
        >
          대시보드로 이동
        </Link>
        <Link
          href="/billing"
          className="rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
        >
          청구 설정 보기
        </Link>
      </div>
    </section>
  );
}
