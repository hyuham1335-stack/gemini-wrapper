import Link from "next/link";

interface PaywallModalProps {
  onClose: () => void;
}

export function PaywallModal({ onClose }: PaywallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
        <h2 className="text-lg font-semibold text-white">이번 달 사용 한도에 도달했습니다</h2>
        <p className="text-sm text-neutral-400">
          더 많은 대화를 이용하려면 플랜을 업그레이드해주세요.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <Link
            href="/pricing"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            업그레이드
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
