"use client";

import { MessageSquarePlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import SidebarNav from "@/components/primitives/SidebarNav";
import { activeChatTitle, sessionsToRecents } from "@/lib/chat/sidebar";
import { fetcher } from "@/lib/utils";

import type { ChatSummary } from "@/db/types";

interface AgentIdentity {
  id: string;
  name: string;
  color: string;
}

export function ChatSidebar({
  workspace,
}: {
  workspace: { name: string; monogram: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: sessions, mutate } = useSWR<Array<ChatSummary>>(
    "/api/history",
    fetcher,
    {
      fallbackData: [],
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );
  const { data: agentsData } = useSWR<{ agents: AgentIdentity[] }>(
    "/api/agents",
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  // Refresh the list whenever the route changes so titles and deletions stay current.
  useEffect(() => {
    void mutate();
  }, [pathname, mutate]);

  const recents = useMemo(
    () => sessionsToRecents(sessions, agentsData?.agents),
    [agentsData, sessions],
  );
  const activeTitle = useMemo(
    () => activeChatTitle(pathname, sessions),
    [pathname, sessions],
  );

  const handleDelete = (id: string) => {
    const session = (sessions ?? []).find((item) => item.id === id);
    const label = session?.title.trim() || "Untitled chat";
    if (!window.confirm(`Delete “${label}”? This permanently removes the session and its messages.`)) {
      return;
    }
    toast.promise(
      fetch(`/api/chat?id=${id}`, { method: "DELETE" }).then((response) => {
        if (!response.ok) throw new Error("Unable to delete session");
      }),
      {
        loading: "Deleting session…",
        success: () => {
          void mutate();
          if (pathname === `/chat/${id}`) router.push("/");
          return "Session deleted";
        },
        error: "Failed to delete session",
      },
    );
  };

  return (
    <SidebarNav
      fill
      workspace={workspace}
      navItems={[]}
      recents={recents}
      activeTitle={activeTitle}
      onNewChat={() => router.push("/")}
      onPick={(id) => router.push(`/chat/${id}`)}
      onDelete={handleDelete}
      onNavigate={(key) => {
        if (key === "home") router.push("/");
      }}
      footerLabel="New chat"
      footerIcon={<MessageSquarePlus size={15} />}
      onFooterClick={() => router.push("/")}
    />
  );
}
