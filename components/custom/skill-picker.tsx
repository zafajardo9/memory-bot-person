"use client";

import { Command, Plus, Search } from "lucide-react";
import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

interface UserSkillSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface SkillsResponse {
  enabled: boolean;
  skills: UserSkillSummary[];
}

export interface SkillPickerHandle {
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

function slashQuery(input: string) {
  const match = input.match(/^\/([^\s/]*)$/);
  return match ? match[1].toLowerCase() : null;
}

export const SkillPicker = forwardRef<
  SkillPickerHandle,
  {
    agentId: string;
    input: string;
    setInput: (value: string) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  }
>(function SkillPicker({ agentId, input, setInput, textareaRef }, ref) {
  const { data } = useSWR<SkillsResponse>("/api/ai/skills", fetcher, {
    revalidateOnFocus: false,
  });
  const query = slashQuery(input);
  const [dismissedInput, setDismissedInput] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{
    bottom?: number;
    left: number;
    maxHeight: number;
    top?: number;
    width: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const skills = useMemo(
    () =>
      (data?.skills ?? []).filter((skill) => {
        if (!skill.enabled) return false;
        if (!query) return true;
        const search = `${skill.slug} ${skill.name} ${skill.description}`.toLowerCase();
        return search.includes(query);
      }),
    [data?.skills, query],
  );
  const open =
    data?.enabled === true && query !== null && dismissedInput !== input;
  const commandMatch = input.match(
    /^\/([a-z0-9][a-z0-9-]{0,39})(?:\s|$)/i,
  );
  const activeSkill =
    data?.enabled && commandMatch
      ? data.skills.find(
          (skill) =>
            skill.enabled &&
            skill.slug === commandMatch[1].toLowerCase(),
        )
      : undefined;

  useEffect(() => setActiveIndex(0), [query]);

  const selectSkill = useCallback(
    (skill: UserSkillSummary) => {
      setInput(`/${skill.slug} `);
      setDismissedInput(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [setInput, textareaRef],
  );

  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown(event) {
        if (!open) return false;
        if (event.key === "Escape") {
          event.preventDefault();
          setDismissedInput(input);
          return true;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (skills.length > 0) {
            setActiveIndex((current) =>
              event.key === "ArrowDown"
                ? (current + 1) % skills.length
                : (current - 1 + skills.length) % skills.length,
            );
          }
          return true;
        }
        if ((event.key === "Enter" || event.key === "Tab") && skills.length) {
          event.preventDefault();
          selectSkill(skills[activeIndex] ?? skills[0]);
          return true;
        }
        return false;
      },
    }),
    [activeIndex, input, open, selectSkill, skills],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const rect = textarea.getBoundingClientRect();
      const padding = 12;
      const gap = 8;
      const width = Math.min(420, window.innerWidth - padding * 2);
      const left = Math.min(
        Math.max(padding, rect.left),
        window.innerWidth - width - padding,
      );
      const roomAbove = rect.top - padding - gap;
      const roomBelow = window.innerHeight - rect.bottom - padding - gap;
      const above = roomAbove >= Math.min(240, roomBelow);
      setPosition({
        left,
        width,
        maxHeight: Math.max(140, Math.min(320, above ? roomAbove : roomBelow)),
        ...(above
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, textareaRef]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !textareaRef.current?.contains(target)
      ) {
        setDismissedInput(input);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [input, open, textareaRef]);

  return (
    <>
      {activeSkill ? (
        <div
          className="mx-3 mt-3 flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.09] px-3 py-1.5 text-xs text-primary"
          role="status"
          aria-label={`Active skill ${activeSkill.name}`}
        >
          <Command size={13} className="shrink-0" aria-hidden />
          <span className="text-primary/70">Skill</span>
          <strong className="truncate font-mono font-bold text-primary">
            /{activeSkill.slug}
          </strong>
          <span className="hidden truncate text-foreground/65 sm:inline">
            {activeSkill.name}
          </span>
        </div>
      ) : null}
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label="Chat skills"
              style={position}
              className="glass fixed z-[100] flex flex-col overflow-hidden rounded-2xl shadow-[0_16px_44px_hsl(var(--foreground)/0.12)]"
            >
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
                <Search
                  size={13}
                  className="text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {query ? `Skills matching “${query}”` : "Choose a skill"}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground/70">
                  ↑↓ · Enter
                </kbd>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {skills.length ? (
                  skills.map((skill, index) => (
                    <button
                      key={skill.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectSkill(skill)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        index === activeIndex
                          ? "bg-primary/[0.09] text-foreground"
                          : "hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                        <Command size={14} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium">
                            {skill.name}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-primary/80">
                            /{skill.slug}
                          </span>
                        </span>
                        {skill.description ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {skill.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm font-medium">No matching skills</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Create a reusable instruction, then call it with /command.
                    </p>
                  </div>
                )}
              </div>
              <Link
                href={`/agents/${agentId}/settings?tab=skills`}
                className="flex items-center gap-2 border-t border-border/60 px-4 py-3 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Plus size={13} aria-hidden />
                Create or manage skills
              </Link>
            </div>,
            document.body,
          )
        : null}
    </>
  );
});
