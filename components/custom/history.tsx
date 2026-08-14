"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import cx from "classnames";
import { ChevronRight, Folder, MessageSquareText } from "lucide-react";
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

const folderColorStyles: Record<string, string> = {
  violet: "text-violet-600 dark:text-violet-300",
  blue: "text-blue-600 dark:text-blue-300",
  emerald: "text-emerald-600 dark:text-emerald-300",
  amber: "text-amber-600 dark:text-amber-300",
  rose: "text-rose-600 dark:text-rose-300",
  slate: "text-slate-600 dark:text-slate-300",
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
  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleAgent = (agentId: string) => {
    setCollapsedAgents((current) => {
      const next = new Set(current);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

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
          className="flex w-[min(24rem,calc(100vw-1rem))] flex-col gap-0 p-0"
        >
          <SheetHeader>
            <VisuallyHidden.Root>
              <SheetTitle className="text-left">Sessions</SheetTitle>
              <SheetDescription className="text-left">
                {sessions === undefined ? "loading" : sessions.length} sessions
              </SheetDescription>
            </VisuallyHidden.Root>
          </SheetHeader>

          <div className="border-b border-border/70 px-5 pb-4 pt-5">
            <div className="pr-8 text-2xl font-semibold tracking-[-0.035em] text-foreground">
              Sessions
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {sessions === undefined
                ? "Loading saved sessions…"
                : `${sessions.length} saved ${sessions.length === 1 ? "session" : "sessions"} across ${groups.length} ${groups.length === 1 ? "agent" : "agents"}`}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-muted/30 p-3">
            {user && (
              <Button
                className="mb-3 flex shrink-0 flex-row justify-between rounded-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
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
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <div>Sign in to save and revisit sessions.</div>
                </div>
              ) : null}

              {!isLoading && !error && sessions?.length === 0 && user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <div>Your saved sessions will appear under each agent.</div>
                </div>
              ) : null}

              {!isLoading && error && user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
                  <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <InfoIcon />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">Sessions are temporarily unavailable</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
                  {["w-3/4", "w-1/2", "w-2/3", "w-5/6"].map((item) => (
                    <div key={item} className="p-2 my-[2px]">
                      <div
                        className={`${item} h-5 animate-pulse rounded-md bg-foreground/10`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {!error &&
                groups.map(({ agent, sessions: agentSessions }) => {
                  const agentId = agent?.id ?? agentSessions[0]?.agentId;
                  const isCollapsed = collapsedAgents.has(agentId);
                  return (
                    <div key={agentId} className="mb-1">
                      <button
                        type="button"
                        onClick={() => toggleAgent(agentId)}
                        className="group/folder flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/70"
                      >
                        <ChevronRight
                          size={13}
                          className={cx(
                            "shrink-0 text-muted-foreground transition-transform duration-150",
                            { "rotate-90": !isCollapsed },
                          )}
                        />
                        <Folder
                          size={14}
                          className={cx(
                            "shrink-0",
                            folderColorStyles[agent?.color ?? "violet"] ??
                              folderColorStyles.violet,
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {agent?.name ?? "Agent"}
                        </span>
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                          {agentSessions.length}
                        </span>
                      </button>

                      {!isCollapsed ? (
                        <div className="flex flex-col">
                          {agentSessions.length === 0 ? (
                            <p className="px-2 py-1 pl-12 text-xs text-muted-foreground">
                              No saved sessions yet.
                            </p>
                          ) : null}
                          {agentSessions.map((session) => (
                            <div
                              key={session.id}
                              className={cx(
                                "group flex flex-row items-center gap-1 rounded-lg py-1 pl-8 pr-1 transition-colors hover:bg-muted/70",
                                {
                                  "bg-primary/10": session.id === id,
                                },
                              )}
                            >
                              <MessageSquareText
                                size={12}
                                className={cx(
                                  "shrink-0 text-muted-foreground",
                                  { "text-primary": session.id === id },
                                )}
                              />
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
                                    "block truncate rounded-lg px-1.5 py-1 text-left text-muted-foreground transition-colors hover:text-foreground",
                                    {
                                      "font-medium text-primary hover:text-primary":
                                        session.id === id,
                                    },
                                  )}
                                >
                                  {session.title}
                                </Link>
                              </Button>

                              <DropdownMenu modal={true}>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    className="size-7 shrink-0 p-0 font-normal text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
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
                      ) : null}
                    </div>
                  );
                })}
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
