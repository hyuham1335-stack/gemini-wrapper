import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/polar/subscription";
import { BillingPanel } from "@/components/billing/billing-panel";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/billing");

  const subscription = await getUserSubscription(supabase, user.id);

  return (
    <section className="flex flex-1 flex-col items-center gap-8 px-4 py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          청구 설정
        </span>
        <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
          구독 관리
        </h1>
      </div>

      <BillingPanel subscription={subscription} />
    </section>
  );
}
