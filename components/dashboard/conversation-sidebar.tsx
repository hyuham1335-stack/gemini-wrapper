"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import type { Conversation } from "./types";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNewConversation,
  onDelete,
}: ConversationSidebarProps) {
  function handleDelete(e: MouseEvent, id: string) {
    e.stopPropagation();
    if (window.confirm("이 대화를 삭제할까요?")) {
      onDelete(id);
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="p-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex w-full items-center gap-2 rounded-xl border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          새 대화
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-neutral-500">
            아직 대화가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className={`w-full truncate rounded-lg py-2 pr-8 pl-3 text-left text-sm transition ${
                      isActive
                        ? "bg-neutral-800 text-neutral-100"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    aria-label="대화 삭제"
                    onClick={(e) => handleDelete(e, conversation.id)}
                    className="absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 opacity-0 transition hover:bg-neutral-700 hover:text-neutral-200 group-hover:opacity-100"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7h14Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Also the only way to reach these pages on small screens, where the
          header links are hidden. */}
      <div className="flex flex-col border-t border-neutral-800 p-2">
        <Link
          href="/pricing"
          className="block rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-200"
        >
          요금제
        </Link>
        <Link
          href="/billing"
          className="block rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-200"
        >
          청구 설정
        </Link>
      </div>
    </aside>
  );
}
