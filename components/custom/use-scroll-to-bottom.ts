import { useCallback, useEffect, useRef, useState, RefObject } from "react";

const BOTTOM_THRESHOLD_PX = 96;

export function isNearBottom(
  metrics: Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">,
  threshold = BOTTOM_THRESHOLD_PX,
) {
  return (
    metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold
  );
}

export function useScrollToBottom<T extends HTMLElement>(scrollInitially = true): [
  RefObject<T | null>,
  RefObject<T | null>,
  boolean,
  () => void,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const shouldFollowRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    shouldFollowRef.current = true;
    setIsAtBottom(true);
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateFollowState = () => {
      const nearBottom = isNearBottom(container);
      shouldFollowRef.current = nearBottom;
      setIsAtBottom(nearBottom);
    };
    const pauseForDisclosure = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("summary")) return;
      if (
        event instanceof KeyboardEvent &&
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }
      shouldFollowRef.current = false;
      setIsAtBottom(false);
    };
    const observer = new MutationObserver(() => {
      if (shouldFollowRef.current) scrollToBottom("auto");
    });

    container.addEventListener("scroll", updateFollowState, { passive: true });
    container.addEventListener("click", pauseForDisclosure, true);
    container.addEventListener("keydown", pauseForDisclosure, true);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    if (scrollInitially) {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", updateFollowState);
      container.removeEventListener("click", pauseForDisclosure, true);
      container.removeEventListener("keydown", pauseForDisclosure, true);
    };
  }, [scrollInitially, scrollToBottom]);

  return [containerRef, endRef, isAtBottom, () => scrollToBottom("smooth")];
}
