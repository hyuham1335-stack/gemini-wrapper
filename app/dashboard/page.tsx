"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ConversationSidebar } from "@/components/dashboard/conversation-sidebar";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { UsageBanner } from "@/components/dashboard/usage-banner";
import { CancellationBanner } from "@/components/dashboard/cancellation-banner";
import { PastDueBanner } from "@/components/dashboard/past-due-banner";
import { PaywallModal } from "@/components/dashboard/paywall-modal";
import { SearchModal } from "@/components/dashboard/search-modal";
import type { ChatMessage, Conversation } from "@/components/dashboard/types";
import type { Plan } from "@/lib/polar/plans";
import type { UserSubscription } from "@/lib/polar/subscription";

export default function DashboardPage() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [usageUsed, setUsageUsed] = useState(0);
  const [usageLimit, setUsageLimit] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<UserSubscription["status"]>("active");

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null;

  useEffect(() => {
    if (!isLoading && !user) {
      // Keep the destination so the user lands back here after signing in,
      // matching what proxy.ts does for a server-side visit.
      router.replace("/login?redirectedFrom=/dashboard");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoading || !user) return;

    let cancelled = false;

    async function loadConversations() {
      try {
        const response = await fetch("/api/conversations");
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled) return;

        const loaded: Conversation[] = data.conversations.map(
          (row: { id: string; title: string }) => ({
            id: row.id,
            title: row.title,
            messages: [],
            messagesLoaded: false,
          })
        );

        setConversations(loaded);
        if (loaded.length > 0) {
          setActiveConversationId(loaded[0].id);
          loadMessages(loaded[0].id);
        }
      } catch (error) {
        console.error("Failed to load conversations", error);
      }
    }

    loadConversations();
    loadUsage();
    loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [isLoading, user]);

  async function loadUsage() {
    try {
      const response = await fetch("/api/usage");
      if (!response.ok) return;

      const data = await response.json();
      setUsageUsed(data.used ?? 0);
      setUsageLimit(data.limit ?? null);
      setPlan(data.plan ?? "free");
    } catch (error) {
      console.error("Failed to load usage", error);
    }
  }

  async function loadSubscription() {
    try {
      const response = await fetch("/api/subscription");
      if (!response.ok) return;

      const data = await response.json();
      setCancelAtPeriodEnd(data.subscription?.cancelAtPeriodEnd ?? false);
      setCurrentPeriodEnd(data.subscription?.currentPeriodEnd ?? null);
      setSubscriptionStatus(data.subscription?.status ?? "active");
    } catch (error) {
      console.error("Failed to load subscription", error);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!response.ok) return;

      const data = await response.json();
      const messages: ChatMessage[] = data.messages.map(
        (row: { id: string; role: "user" | "assistant"; content: string }) => ({
          id: row.id,
          role: row.role,
          content: row.content,
        })
      );

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages, messagesLoaded: true }
            : conversation
        )
      );
    } catch (error) {
      console.error("Failed to load messages", error);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    const conversation = conversations.find((c) => c.id === id);
    if (conversation && !conversation.messagesLoaded) {
      loadMessages(id);
    }
  }

  async function createConversation(): Promise<Conversation | null> {
    try {
      const response = await fetch("/api/conversations", { method: "POST" });
      if (!response.ok) return null;

      const data = await response.json();
      const newConversation: Conversation = {
        id: data.conversation.id,
        title: data.conversation.title,
        messages: [],
        messagesLoaded: true,
      };
      setConversations((prev) => [newConversation, ...prev]);
      setActiveConversationId(newConversation.id);
      return newConversation;
    } catch (error) {
      console.error("Failed to create conversation", error);
      return null;
    }
  }

  async function handleNewConversation() {
    await createConversation();
  }

  async function handleDeleteConversation(id: string) {
    try {
      const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) return;

      setConversations((prev) => prev.filter((conversation) => conversation.id !== id));

      if (id === activeConversationId) {
        const remaining = conversations.filter((conversation) => conversation.id !== id);
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          setActiveConversationId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation", error);
    }
  }

  async function handleSendMessage(content: string) {
    // A freshly signed-up user lands here with no conversations at all; without
    // this the first message they type is silently dropped.
    const conversationId = activeConversationId ?? (await createConversation())?.id;
    if (!conversationId) return;

    const userMessage: ChatMessage = { id: `m-${Date.now()}`, role: "user", content };
    const assistantMessageId = `${userMessage.id}-reply`;

    function updateMessages(updater: (messages: ChatMessage[]) => ChatMessage[]) {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages: updater(conversation.messages) }
            : conversation
        )
      );
    }

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title:
                conversation.messages.length === 0
                  ? content.slice(0, 24)
                  : conversation.title,
              messages: [
                ...conversation.messages,
                userMessage,
                { id: assistantMessageId, role: "assistant", content: "" },
              ],
            }
          : conversation
      )
    );

    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);

        if (response.status === 429 && data?.error === "limit_exceeded") {
          setShowPaywall(true);
          updateMessages((messages) =>
            messages.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: "⚠️ 이번 달 사용 한도에 도달했습니다." }
                : message
            )
          );
          return;
        }

        const errorText = data?.error ?? "응답을 가져오지 못했습니다.";
        updateMessages((messages) =>
          messages.map((message) =>
            message.id === assistantMessageId ? { ...message, content: `⚠️ ${errorText}` } : message
          )
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        updateMessages((messages) =>
          messages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + chunkText }
              : message
          )
        );
      }
    } catch (error) {
      console.error("Failed to stream chat response", error);
      const notice = "⚠️ 네트워크 오류로 응답을 가져오지 못했습니다.";
      updateMessages((messages) =>
        messages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                // Keep whatever already streamed in; overwriting it would make
                // a partial answer vanish from the screen.
                content: message.content ? `${message.content}\n\n${notice}` : notice,
              }
            : message
        )
      );
    } finally {
      setIsStreaming(false);
      loadUsage();
    }
  }

  if (isLoading || !user) {
    return (
      <section className="flex flex-1 items-center justify-center px-4 py-24">
        <p className="text-neutral-500">불러오는 중...</p>
      </section>
    );
  }

  const userLabel = user?.user_metadata?.full_name ?? user?.email ?? "";

  return (
    <div className="flex h-dvh min-h-0 flex-1 flex-col">
      <DashboardHeader
        userLabel={userLabel}
        used={usageUsed}
        limit={usageLimit}
        onSignOut={handleSignOut}
        onOpenSearch={() => setShowSearch(true)}
      />
      <PastDueBanner status={subscriptionStatus} />
      <CancellationBanner
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        currentPeriodEnd={currentPeriodEnd}
      />
      <UsageBanner used={usageUsed} limit={usageLimit} />
      <div className="flex min-h-0 flex-1">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDelete={handleDeleteConversation}
        />
        <ChatPanel
          conversation={activeConversation}
          onSendMessage={handleSendMessage}
          disabled={isStreaming}
        />
      </div>
      {showPaywall && (
        <PaywallModal plan={plan} limit={usageLimit} onClose={() => setShowPaywall(false)} />
      )}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onSelectConversation={handleSelectConversation}
        />
      )}
    </div>
  );
}
