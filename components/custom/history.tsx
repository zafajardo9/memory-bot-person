"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import cx from "classnames";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { User } from "next-auth";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import {
  InfoIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PencilEditIcon,
  TrashIcon,
} from "./icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

import type { ChatSummary } from "@/db/types";

interface AgentSummary {
  id: string;
  name: string;
  color: string;
  description: string;
  avatar: string;
  isDefault: boolean;
}

const colorStyles: Record<string, string> = {
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export const Sessions = ({ user }: { user: User | undefined }) => {
  const { id } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const agentId = pathname.match(/^\/agents\/([^/]+)\/chat/)?.[1];

  const [areSessionsVisible, setAreSessionsVisible] = useState(false);
  const {
    data: sessions,
    error,
    isLoading,
    mutate,
  } = useSWR<Array<ChatSummary>>(user ? "/api/history" : null, fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
    revalidateOnMount: false,
    shouldRetryOnError: false,
  });

  const { data: agentsData } = useSWR<{ agents: AgentSummary[] }>(
    user ? "/api/agents" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  // Agents are the parent level; their saved sessions remain newest-first.
  const groups = useMemo(() => {
    const agentsById = new Map<string, AgentSummary>(
      (agentsData?.agents ?? []).map((agent) => [agent.id, agent]),
    );
    const sessionsByAgent = new Map<string, ChatSummary[]>();
    for (const session of sessions ?? []) {
      const list = sessionsByAgent.get(session.agentId) ?? [];
      list.push(session);
      sessionsByAgent.set(session.agentId, list);
    }
    const result: Array<{
      agent: AgentSummary | undefined;
      sessions: ChatSummary[];
    }> = (agentsData?.agents ?? []).map((agent) => ({
      agent,
      sessions: sessionsByAgent.get(agent.id) ?? [],
    }));
    for (const [orphanAgentId, orphanSessions] of sessionsByAgent) {
      if (!agentsById.has(orphanAgentId)) {
        result.push({ agent: undefined, sessions: orphanSessions });
      }
    }
    return result;
  }, [agentsData, sessions]);

  const activeAgentId =
    agentId ?? sessions?.find((session) => session.id === id)?.agentId;

  useEffect(() => {
    mutate();
  }, [pathname, mutate]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    const targetId = deleteId;
    if (!targetId) return;
    const deletePromise = fetch(`/api/chat?id=${targetId}`, {
      method: "DELETE",
    }).then((response) => {
      if (!response.ok) throw new Error("Unable to delete session");
      return response;
    });

    toast.promise(deletePromise, {
      loading: "Deleting session…",
      success: () => {
        mutate((sessions) => {
          if (sessions) {
            return sessions.filter((session) => session.id !== targetId);
          }
        });
        if (targetId === id) {
          router.push("/");
        }
        return "Session deleted";
      },
      error: "Failed to delete session",
    });

    setShowDeleteDialog(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open sessions"
        title="Sessions"
        className="size-9 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setAreSessionsVisible(true);
        }}
      >
        <MenuIcon />
      </Button>

      <Sheet
        open={areSessionsVisible}
        onOpenChange={(state) => {
          setAreSessionsVisible(state);
        }}
      >
        <SheetContent
          side="left"
          className="flex w-[min(24rem,calc(100vw-1rem))] flex-col gap-0 border-slate-200! bg-white! p-0 text-slate-950! shadow-[18px_0_60px_rgb(15_23_42/0.16)] backdrop-blur-none"
        >
          <SheetHeader>
            <VisuallyHidden.Root>
              <SheetTitle className="text-left">Sessions</SheetTitle>
              <SheetDescription className="text-left">
                {sessions === undefined ? "loading" : sessions.length} sessions
              </SheetDescription>
            </VisuallyHidden.Root>
          </SheetHeader>

          <div className="border-b border-slate-200 bg-white px-5 pb-4 pt-5">
            <div className="pr-8 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
              Sessions
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {sessions === undefined
                ? "Loading saved sessions…"
                : `${sessions.length} saved ${sessions.length === 1 ? "session" : "sessions"} across ${groups.length} ${groups.length === 1 ? "agent" : "agents"}`}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-slate-50/80 p-3">
            {user && (
              <Button
                className="mb-3 flex shrink-0 flex-row justify-between rounded-full bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
                asChild
              >
                <Link href={activeAgentId ? `/agents/${activeAgentId}/chat` : "/"}>
                  <div>New session</div>
                  <PencilEditIcon size={14} />
                </Link>
              </Button>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {!user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
                  <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <InfoIcon />
                  </span>
                  <div>Sign in to save and revisit sessions.</div>
                </div>
              ) : null}

              {!isLoading && !error && sessions?.length === 0 && user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
                  <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <InfoIcon />
                  </span>
                  <div>Your saved sessions will appear under each agent.</div>
                </div>
              ) : null}

              {!isLoading && error && user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
                  <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <InfoIcon />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Sessions are temporarily unavailable</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Your sessions are safe. Try loading the list again.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void mutate()}>
                    Try again
                  </Button>
                </div>
              ) : null}

              {isLoading && user ? (
                <div className="flex flex-col">
                  {[44, 32, 28, 52].map((item) => (
                    <div key={item} className="p-2 my-[2px]">
                      <div
                        className={`w-${item} h-[20px] animate-pulse rounded-md bg-muted`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {!error &&
                groups.map(({ agent, sessions: agentSessions }) => (
                  <section
                    key={agent?.id ?? agentSessions[0]?.agentId}
                    className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white last:mb-0"
                  >
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 p-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase ${
                          colorStyles[agent?.color ?? "violet"] ?? colorStyles.violet
                        }`}
                      >
                        {agent?.name?.charAt(0) ?? "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {agent?.name ?? "Agent"}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                          {agent?.description || "Focused assistant"}
                        </span>
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                        {agentSessions.length} {agentSessions.length === 1 ? "session" : "sessions"}
                      </span>
                    </div>
                    <div className="p-1.5">
                      {agentSessions.length === 0 ? (
                        <p className="p-3 text-xs text-slate-400">
                          No saved sessions yet.
                        </p>
                      ) : null}
                      {agentSessions.map((session) => (
                        <div
                          key={session.id}
                          className={cx(
                            "group flex flex-row items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-slate-100",
                            {
                              "bg-blue-50 ring-1 ring-inset ring-blue-100":
                                session.id === id,
                            },
                          )}
                        >
                          <span
                            className={cx(
                              "ml-2 flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400",
                              { "bg-blue-100 text-blue-700": session.id === id },
                            )}
                          >
                            <MessageSquareText size={12} />
                          </span>
                          <Button
                            variant="ghost"
                            className={cx(
                              "min-w-0 flex-1 justify-start p-0 text-sm font-normal hover:bg-transparent",
                            )}
                            asChild
                          >
                            <Link
                              href={`/chat/${session.id}`}
                              className={cx(
                                "block truncate rounded-xl px-2 py-2.5 text-left text-slate-700",
                                { "font-medium text-blue-950": session.id === id },
                              )}
                            >
                              {session.title}
                            </Link>
                          </Button>

                          <DropdownMenu modal={true}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                className="size-8 shrink-0 p-0 font-normal text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                variant="ghost"
                                aria-label={`More options for ${session.title}`}
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="left" className="z-[60] w-36 rounded-lg p-1.5">
                              <DropdownMenuItem asChild className="rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive">
                                <button
                                  type="button"
                                  className="flex w-full flex-row items-center justify-start gap-2"
                                  onClick={() => {
                                    setDeleteId(session.id);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <TrashIcon />
                                  <div>Delete</div>
                                </button>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the session and its messages. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
