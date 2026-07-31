import Link from "next/link";

export function BackToDashboardLink() {
  return (
    <Link
      href="/dashboard"
      className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-neutral-700 px-4 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100 sm:left-6 sm:top-6"
    >
      ← 대시보드
    </Link>
  );
}
