import Link from "next/link";

interface HeroAction {
  text: string;
  href: string;
}

interface HeroSectionProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction: HeroAction;
  secondaryAction?: HeroAction;
}

export function HeroSection({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
}: HeroSectionProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      {eyebrow && (
        <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          {eyebrow}
        </span>
      )}
      <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-6xl">
        {title}
      </h1>
      <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        <Link
          href={primaryAction.href}
          className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200"
        >
          {primaryAction.text}
        </Link>
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
          >
            {secondaryAction.text}
          </Link>
        )}
      </div>
    </section>
  );
}
