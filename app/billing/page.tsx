import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/polar/subscription";
import { getUsedCount } from "@/lib/usage";
import { PLAN_LIMITS } from "@/lib/polar/plans";
import { BillingPanel } from "@/components/billing/billing-panel";
import { CornerBackLink } from "@/components/corner-back-link";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/billing");

  const subscription = await getUserSubscription(supabase, user.id);

  // The page still renders with a zeroed meter if the usage read fails —
  // subscription management stays reachable either way.
  const used = await getUsedCount(supabase, user.id).catch((error) => {
    console.error("Failed to load usage for billing page", error);
    return 0;
  });

  const usage = { used, limit: PLAN_LIMITS[subscription.plan] };

  return (
    <section className="relative flex flex-1 flex-col items-center gap-8 px-4 py-24">
      <CornerBackLink href="/dashboard" label="대시보드" />
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          청구 설정
        </span>
        <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          구독 관리
        </h1>
      </div>

      <BillingPanel subscription={subscription} usage={usage} />
    </section>
  );
}
