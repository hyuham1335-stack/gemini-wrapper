import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/polar/subscription";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { BackToDashboardLink } from "@/components/back-to-dashboard-link";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const subscription = user ? await getUserSubscription(supabase, user.id) : null;

  return (
    <section className="relative flex flex-1 flex-col items-center gap-12 px-4 py-24">
      {user && <BackToDashboardLink />}
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          요금제
        </span>
        <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          필요한 만큼, 딱 맞는 플랜
        </h1>
        <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
          언제든 업그레이드하고 더 많은 Gemini 대화를 이용하세요.
        </p>
      </div>

      <PricingPlans
        currentPlan={subscription?.plan ?? "free"}
        hasActiveSubscription={Boolean(
          subscription?.polarSubscriptionId && subscription.status === "active"
        )}
        isLoggedIn={Boolean(user)}
      />
    </section>
  );
}
