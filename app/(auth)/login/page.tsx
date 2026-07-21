"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { AuthForm } from "@/components/custom/auth-form";
import { SubmitButton } from "@/components/custom/submit-button";

import { login, LoginActionState } from "../actions";

type LoginFeedbackContent = {
  title: string;
  detail: string;
} | null;

function LoginFeedback({ feedback }: { feedback: LoginFeedbackContent }) {
  const { pending } = useFormStatus();

  if (pending || !feedback) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium">{feedback.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-destructive/80">
          {feedback.detail}
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: "idle",
    },
  );

  useEffect(() => {
    if (state.status === "failed") {
      toast.error("We couldn't sign you in", {
        description: "Check your email and password, then try again.",
      });
    } else if (state.status === "invalid_data") {
      toast.error("Check your sign-in details", {
        description: "Enter a valid email and a password with at least 6 characters.",
      });
    } else if (state.status === "unavailable") {
      toast.error("Sign-in is temporarily unavailable", {
        description: "The authentication service is not configured correctly. Try again later.",
      });
    } else if (state.status === "success") {
      const callbackUrl = new URLSearchParams(window.location.search).get(
        "callbackUrl",
      );
      let destination = "/";

      if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
        destination = callbackUrl;
      } else if (callbackUrl) {
        try {
          const parsed = new URL(callbackUrl);
          if (parsed.origin === window.location.origin) {
            destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
          }
        } catch {
          // Ignore malformed or cross-origin callback URLs.
        }
      }

      router.replace(destination);
      router.refresh();
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  const feedback =
    state.status === "invalid_data"
      ? {
          title: "Check your sign-in details",
          detail: "Use a valid email and a password with at least 6 characters.",
        }
      : state.status === "failed"
        ? {
            title: "We couldn't sign you in",
            detail: "Check your email and password, then try again.",
          }
        : state.status === "unavailable"
          ? {
              title: "Sign-in is temporarily unavailable",
              detail: "The authentication service needs attention. Please try again later.",
            }
        : null;

  return (
    <main className="page-shell flex items-center justify-center">
      <section className="grid w-full max-w-4xl overflow-hidden border bg-card md:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-r bg-muted/40 p-10 md:flex md:flex-col md:justify-between">
          <p className="eyebrow">Memory / Workspace access</p>
          <div>
            <h1 className="max-w-sm text-4xl font-semibold tracking-[-0.045em]">One place for what your company knows.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Return to grounded answers, shared notes, and the sources behind every decision.</p>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="mb-8">
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to Memory</h2>
            <p className="mt-2 text-sm text-muted-foreground">Enter your work email and password.</p>
          </div>
          <AuthForm action={handleSubmit} defaultEmail={email}>
            <LoginFeedback feedback={feedback} />
            <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
            <p className="mt-4 text-center text-sm text-muted-foreground">
            {"Don't have an account? "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Create one
            </Link>
            {"."}
            </p>
          </AuthForm>
        </div>
      </section>
    </main>
  );
}
