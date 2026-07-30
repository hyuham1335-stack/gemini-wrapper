"use client";

import { useEffect, useRef, useState } from "react";
import type { Conversation } from "./types";

interface ChatPanelProps {
  conversation: Conversation | null;
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

function MessageList({ conversation }: { conversation: Conversation | null }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  if (!conversation || conversation.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-neutral-500">무엇을 도와드릴까요?</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-white text-black"
                  : "bg-neutral-800 text-neutral-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function ChatInput({
  onSendMessage,
  disabled,
}: {
  onSendMessage: (content: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const lineHeight = 22;
      const maxHeight = lineHeight * 4 + 16;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [value]);

  const isSubmitDisabled = disabled || !value.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSendMessage(value.trim());
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-6 sm:px-8">
      <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-3xl border border-neutral-700 bg-neutral-900 p-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요"
          aria-label="메시지 입력"
          rows={1}
          disabled={disabled}
          className="max-h-24 min-h-8 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none"
          style={{ lineHeight: "22px" }}
        />
        <button
          type="submit"
          aria-label="전송"
          disabled={isSubmitDisabled}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
            isSubmitDisabled
              ? "cursor-not-allowed bg-neutral-700 text-neutral-500"
              : "cursor-pointer bg-white text-black hover:bg-neutral-200"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16 22L16 10M16 10L11 15M16 10L21 15"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}

export function ChatPanel({ conversation, onSendMessage, disabled = false }: ChatPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <MessageList conversation={conversation} />
      <ChatInput onSendMessage={onSendMessage} disabled={disabled} />
    </div>
  );
}
