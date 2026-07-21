"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthForm } from "@/components/custom/auth-form";
import { SubmitButton } from "@/components/custom/submit-button";

import { login, LoginActionState } from "../actions";

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
      toast.error("Invalid credentials!");
    } else if (state.status === "invalid_data") {
      toast.error("Failed validating your submission!");
    } else if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

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
            <SubmitButton>Sign in</SubmitButton>
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
