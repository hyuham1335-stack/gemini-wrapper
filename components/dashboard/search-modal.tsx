"use client";

import { useEffect, useRef, useState } from "react";

interface SearchResult {
  id: string;
  conversationId: string;
  conversationTitle: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SearchModalProps {
  onClose: () => void;
  onSelectConversation: (id: string) => void;
}

function highlight(text: string, query: string) {
  if (!query) return text;

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 40);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return (
    <>
      {prefix}
      {text.slice(start, index)}
      <mark className="rounded bg-yellow-500/30 text-yellow-200">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length, end)}
      {suffix}
    </>
  );
}

export function SearchModal({ onClose, onSelectConversation }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
        if (!response.ok || cancelled) return;

        const data = await response.json();
        if (cancelled) return;

        setResults(data.results ?? []);
        setHasSearched(true);
      } catch (error) {
        console.error("Failed to search messages", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  function handleSelect(conversationId: string) {
    onSelectConversation(conversationId);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-24"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="shrink-0 text-neutral-500"
          >
            <path
              d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="메시지 검색..."
            className="flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="검색 닫기"
            className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
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
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!trimmedQuery ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              검색할 단어를 입력하세요.
            </p>
          ) : isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">검색 중...</p>
          ) : hasSearched && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              &ldquo;{trimmedQuery}&rdquo;에 대한 검색 결과가 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result.conversationId)}
                    className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-neutral-300">
                        {result.conversationTitle}
                      </span>
                      <span className="shrink-0 text-[11px] text-neutral-600">
                        {new Date(result.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-neutral-400">
                      <span className="mr-1 text-neutral-600">
                        {result.role === "user" ? "나:" : "AI:"}
                      </span>
                      {highlight(result.content, trimmedQuery)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
