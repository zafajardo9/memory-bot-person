"use client";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { IntegrationCredentialStatus } from "@/lib/integrations/types";

async function credentialRequest(
  integrationId: string,
  method: "PUT" | "DELETE",
  body?: object,
) {
  const response = await fetch(`/api/integrations/${integrationId}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "Credential request failed");
  }
  return result.integration as IntegrationCredentialStatus;
}

export function IntegrationCredentialCard({
  initialStatus,
  canConfigure,
}: {
  initialStatus: IntegrationCredentialStatus;
  canConfigure: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [pending, setPending] = useState(false);
  const credentialDescription = !status.configured
    ? "Add a key here to enable live web search without editing an environment file."
    : !canConfigure
      ? "Configured securely for this workspace."
      : `${status.maskedKey} · ${
          status.source === "SITE"
            ? "Saved securely for this workspace"
            : "Currently loaded from the environment"
        }`;

  const save = async () => {
    setPending(true);
    try {
      const nextStatus = await credentialRequest(status.id, "PUT", {
        apiKey,
      });
      setStatus(nextStatus);
      setApiKey("");
      setShowKey(false);
      router.refresh();
      toast.success(`${status.label} API key saved and verified.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save API key",
      );
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the site-managed ${status.label} API key?`)) {
      return;
    }
    setPending(true);
    try {
      const nextStatus = await credentialRequest(status.id, "DELETE");
      setStatus(nextStatus);
      router.refresh();
      toast.success(
        nextStatus.configured
          ? "Site key removed. The environment key is now being used."
          : `${status.label} API key removed.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove API key",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-primary/20 bg-primary/[0.025]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <KeyRound size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{status.label} credentials</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                status.configured
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  status.configured ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}
              />
              {status.configured ? "Connected" : "Not configured"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {credentialDescription}
          </p>

          {canConfigure ? (
            <div className="mt-4 max-w-xl">
              <Label htmlFor={`${status.id}-api-key`}>
                {status.source === "SITE" ? "Replace API key" : "API key"}
              </Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Input
                    id={`${status.id}-api-key`}
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      status.maskedKey ?? `Paste your ${status.label} API key`
                    }
                    autoComplete="new-password"
                    spellCheck={false}
                    className="bg-background pr-11 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={save}
                  disabled={pending || !apiKey.trim()}
                  className="gap-2"
                >
                  {pending ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Save API key
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <LockKeyhole size={12} />
                  Encrypted at rest. The saved key is never sent back to your browser.
                </p>
                {status.source === "SITE" ? (
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    Remove saved key
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              An administrator can manage workspace credentials here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
