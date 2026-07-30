export const PLAN_ORDER = ["free", "pro", "unlimited"] as const;

export type Plan = (typeof PLAN_ORDER)[number];

export const PLAN_LIMITS: Record<Plan, number | null> = {
  free: 10,
  pro: 100,
  unlimited: null,
};

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  unlimited: "Unlimited",
};

export const PLAN_PRICE_LABELS: Record<Plan, string> = {
  free: "$0",
  pro: "$9.99/월",
  unlimited: "$29.99/월",
};

export const PLAN_REQUEST_LABELS: Record<Plan, string> = {
  free: "월 10회",
  pro: "월 100회",
  unlimited: "무제한",
};

export const PLAN_PRODUCT_IDS: Partial<Record<Plan, string | undefined>> = {
  pro: process.env.POLAR_PRODUCT_ID_PRO,
  unlimited: process.env.POLAR_PRODUCT_ID_UNLIMITED,
};

export function planFromProductId(productId: string | null | undefined): Plan | null {
  if (!productId) return null;
  if (productId === PLAN_PRODUCT_IDS.pro) return "pro";
  if (productId === PLAN_PRODUCT_IDS.unlimited) return "unlimited";
  return null;
}

export function planIndex(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}

export function isPaidPlan(plan: Plan): plan is "pro" | "unlimited" {
  return plan === "pro" || plan === "unlimited";
}
