"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthForm } from "@/components/custom/auth-form";
import { SubmitButton } from "@/components/custom/submit-button";

import { register, RegisterActionState } from "../actions";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: "idle",
    },
  );

  useEffect(() => {
    if (state.status === "user_exists") {
      toast.error("Account already exists");
    } else if (state.status === "failed") {
      toast.error("Failed to create account");
    } else if (state.status === "invalid_data") {
      toast.error("Failed validating your submission!");
    } else if (state.status === "success") {
      toast.success("Account created successfully");
      router.refresh();
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <main className="page-shell flex items-center justify-center">
      <section className="grid w-full max-w-4xl overflow-hidden border bg-card md:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-r bg-muted/40 p-10 md:flex md:flex-col md:justify-between">
          <p className="eyebrow">Memory / New workspace member</p>
          <div>
            <h1 className="max-w-sm text-4xl font-semibold tracking-[-0.045em]">Start with shared context, not scattered answers.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Capture what matters, approve trusted sources, and help the team find the same answer.</p>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="mb-8">
            <p className="eyebrow">Get started</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use your work email and a secure password.</p>
          </div>
          <AuthForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton>Create account</SubmitButton>
            <p className="mt-4 text-center text-sm text-muted-foreground">
            {"Already have an account? "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
            {"."}
            </p>
          </AuthForm>
        </div>
      </section>
    </main>
  );
}
