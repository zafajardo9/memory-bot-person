"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Composer draft persistence, keyed by a stable scope (chat id for existing
 * conversations, agent id for the new-chat screen) so an accidental reload or
 * navigation does not lose an unsent message. Text only — attachment parts
 * reference short-lived upload URLs and are intentionally not restored.
 *
 * Modeled as an external store: the textarea reads the stored value, writes
 * go straight to storage, and subscribers re-render from it. This keeps the
 * first client render consistent with the server (empty draft) without a
 * hydration mismatch.
 */

const DRAFT_PREFIX = "kairo:chat-draft:";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

function draftKey(chatId: string) {
  return `${DRAFT_PREFIX}${chatId}`;
}

function readDraft(chatId: string) {
  try {
    return window.localStorage.getItem(draftKey(chatId)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(chatId: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(draftKey(chatId), value);
    } else {
      window.localStorage.removeItem(draftKey(chatId));
    }
  } catch {
    // Storage may be unavailable (private mode, quota); drafts are best-effort.
  }
}

export function useChatDraft(chatId: string) {
  const draft = useSyncExternalStore(
    subscribe,
    () => readDraft(chatId),
    () => "",
  );

  // Storage can be mutated in another tab; keep this one in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(DRAFT_PREFIX)) notify();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDraft = useCallback(
    (value: string) => {
      writeDraft(chatId, value);
      notify();
    },
    [chatId],
  );

  return [draft, setDraft] as const;
}
