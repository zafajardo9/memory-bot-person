"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/custom/icons";

import { Button } from "../ui/button";

export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="relative h-11 w-full"
    >
      <span>{pending ? pendingLabel : children}</span>
      {pending && (
        <span className="absolute right-4 animate-spin" aria-hidden="true">
          <LoaderIcon />
        </span>
      )}
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? pendingLabel : "Ready to submit"}
      </span>
    </Button>
  );
}
