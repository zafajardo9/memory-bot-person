"use client";

import { Lock, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetcher } from "@/lib/utils";

interface AccountData {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

type Tab = "profile" | "security";

export default function AccountPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<AccountData>(
    "/api/account",
    fetcher,
  );
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (data?.user.name) setName(data.user.name);
  }, [data?.user.name]);

  const user = data?.user;
  const emailName = user?.email?.split("@")[0] ?? "Account";
  const displayName = user?.name || emailName;
  const initial = displayName.charAt(0).toUpperCase();

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Update failed");
      await mutate();
      toast.success("Account updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setChangingPassword(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Password change failed");
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 pb-16 pt-24 sm:px-6">
        <p className="text-muted-foreground">Unable to load account.</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Go home
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 pb-20 pt-24 sm:px-6">
      <header className="border-b pb-6">
        <p className="eyebrow">Account settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Your profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Manage your account details. Your email and role are managed by your
          workspace admin.
        </p>
      </header>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-semibold text-primary-foreground">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold">{displayName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
            <User size={11} /> {user.role.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-grid w-full grid-cols-2 rounded-lg border bg-muted/40 p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setTab("profile")}
          className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "profile"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User size={14} /> Profile
        </button>
        <button
          type="button"
          onClick={() => setTab("security")}
          className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "security"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield size={14} /> Security
        </button>
      </div>

      {tab === "profile" ? (
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-5 rounded-xl border bg-card p-5"
        >
          <div>
            <h2 className="font-medium">Display name</h2>
            <p className="text-xs text-muted-foreground">
              This name appears across the workspace. Leave empty to use your
              email handle.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={emailName}
              maxLength={100}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handlePasswordChange}
          className="flex flex-col gap-5 rounded-xl border bg-card p-5"
        >
          <div>
            <h2 className="font-medium">Change password</h2>
            <p className="text-xs text-muted-foreground">
              Use at least 6 characters. You&apos;ll stay signed in after changing.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button
              type="submit"
              disabled={changingPassword}
              variant="outline"
              className="gap-2"
            >
              <Lock size={14} />
              {changingPassword ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
