"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (isLoading) {
    return (
      <section className="flex flex-1 items-center justify-center px-4 py-24">
        <p className="text-neutral-500">불러오는 중...</p>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <span className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Dashboard
      </span>
      <h1 className="max-w-2xl bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
        환영합니다{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
      </h1>
      <p className="max-w-xl text-base text-neutral-400 sm:text-lg">
        {user?.email}
      </p>
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-4 rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
      >
        로그아웃
      </button>
    </section>
  );
}
