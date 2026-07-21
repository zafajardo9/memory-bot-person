"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import cx from "classnames";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { User } from "next-auth";
import { useEffect, useState } from "react";
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

export const History = ({ user }: { user: User | undefined }) => {
  const { id } = useParams();
  const pathname = usePathname();

  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const {
    data: history,
    error,
    isLoading,
    mutate,
  } = useSWR<Array<ChatSummary>>(user ? "/api/history" : null, fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
    revalidateOnMount: false,
    shouldRetryOnError: false,
  });

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
      if (!response.ok) throw new Error("Unable to delete conversation");
      return response;
    });

    toast.promise(deletePromise, {
      loading: "Deleting chat...",
      success: () => {
        mutate((history) => {
          if (history) {
            return history.filter((chat) => chat.id !== targetId);
          }
        });
        return "Chat deleted successfully";
      },
      error: "Failed to delete chat",
    });

    setShowDeleteDialog(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open chat history"
        title="Chat history"
        className="size-9 shrink-0 rounded-lg border bg-card p-0 text-muted-foreground shadow-sm hover:text-foreground"
        onClick={() => {
          setIsHistoryVisible(true);
        }}
      >
        <MenuIcon />
      </Button>

      <Sheet
        open={isHistoryVisible}
        onOpenChange={(state) => {
          setIsHistoryVisible(state);
        }}
      >
        <SheetContent side="left" className="flex w-[min(22rem,calc(100vw-1rem))] flex-col gap-0 bg-background p-0">
          <SheetHeader>
            <VisuallyHidden.Root>
              <SheetTitle className="text-left">History</SheetTitle>
              <SheetDescription className="text-left">
                {history === undefined ? "loading" : history.length} chats
              </SheetDescription>
            </VisuallyHidden.Root>
          </SheetHeader>

          <div className="border-b px-5 pb-4 pt-5">
            <div className="pr-8 text-base font-semibold">Chat history</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {history === undefined
                ? "Loading conversations…"
                : `${history.length} ${history.length === 1 ? "conversation" : "conversations"}`}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-3">
            {user && (
              <Button
                className="mb-3 flex shrink-0 flex-row justify-between rounded-lg text-sm font-medium"
                asChild
              >
                <Link href="/">
                  <div>New conversation</div>
                  <PencilEditIcon size={14} />
                </Link>
              </Button>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {!user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <InfoIcon />
                  </span>
                  <div>Sign in to save and revisit conversations.</div>
                </div>
              ) : null}

              {!isLoading && !error && history?.length === 0 && user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <InfoIcon />
                  </span>
                  <div>Your conversations will appear here.</div>
                </div>
              ) : null}

              {!isLoading && error && user ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
                  <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <InfoIcon />
                  </span>
                  <div>
                    <p className="font-medium">History is temporarily unavailable</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Your conversations are safe. Try loading the list again.
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

              {!error && history &&
                history.map((chat) => (
                  <div
                    key={chat.id}
                    className={cx(
                      "group flex flex-row items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted/80",
                      { "bg-muted": chat.id === id },
                    )}
                  >
                    <Button
                      variant="ghost"
                      className={cx(
                        "min-w-0 flex-1 justify-start p-0 text-sm font-normal hover:bg-transparent",
                      )}
                      asChild
                    >
                      <Link
                        href={`/chat/${chat.id}`}
                        className="block truncate rounded-lg p-2.5 text-left"
                      >
                        {chat.title}
                      </Link>
                    </Button>

                    <DropdownMenu modal={true}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="size-8 shrink-0 p-0 font-normal text-muted-foreground hover:bg-muted"
                          variant="ghost"
                          aria-label={`More options for ${chat.title}`}
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
                              setDeleteId(chat.id);
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
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
