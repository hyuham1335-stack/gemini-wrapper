import Link from "next/link";

interface CornerBackLinkProps {
  href: string;
  label: string;
}

/** Small "go back" affordance pinned to the top-left corner of a full-page section. */
export function CornerBackLink({ href, label }: CornerBackLinkProps) {
  return (
    <Link
      href={href}
      className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-neutral-700 px-4 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100 sm:left-6 sm:top-6"
    >
      ← {label}
    </Link>
  );
}
