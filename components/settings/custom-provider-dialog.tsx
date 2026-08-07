"use client";

import { ArrowRight, KeyRound, LoaderCircle, Plus, ServerCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AIProviderStatus } from "@/ai/providers/types";

function parseModelIds(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((modelId) => modelId.trim())
        .filter(Boolean),
    ),
  ];
}

export function CustomProviderDialog({
  onCreated,
}: {
  onCreated: (provider: AIProviderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setLabel("");
    setBaseUrl("");
    setApiKey("");
    setModels("");
  };

  const addProvider = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          baseUrl,
          apiKey: apiKey.trim() || undefined,
          modelIds: parseModelIds(models),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to add provider");
      }
      onCreated(result.provider);
      toast.success(`${result.provider.label} is ready for chat.`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add provider");
    } finally {
      setPending(false);
    }
  };

  const modelIds = parseModelIds(models);
  const canCreate =
    label.trim().length >= 2 && Boolean(baseUrl.trim()) && modelIds.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !pending) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="shrink-0 gap-2">
          <Plus size={15} />
          Add provider
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <div className="border-b px-5 py-6 pr-16 sm:px-7">
          <DialogHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ServerCog size={20} />
            </div>
            <DialogTitle>Add an AI provider</DialogTitle>
            <DialogDescription>
              Connect any service that exposes an OpenAI-compatible API. This
              includes hosted gateways and models running on your own server.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custom-provider-name">Provider name</Label>
              <Input
                id="custom-provider-name"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="OpenRouter or Local Ollama"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="custom-provider-key">API key</Label>
                <span className="text-[11px] text-muted-foreground">Optional for local models</span>
              </div>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <Input
                  id="custom-provider-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste API key"
                  autoComplete="off"
                  className="pl-9 font-mono"
                  maxLength={500}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-provider-url">OpenAI-compatible base URL</Label>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/35 p-1.5 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
              <span className="hidden pl-2 font-mono text-xs text-muted-foreground sm:block">APP</span>
              <ArrowRight className="hidden text-muted-foreground sm:block" size={13} />
              <Input
                id="custom-provider-url"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://provider.example/v1"
                className="border-0 bg-background font-mono shadow-sm focus-visible:ring-0"
                maxLength={500}
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              The server will call <span className="font-mono">/models</span> for discovery and use chat completions for responses. A localhost URL refers to the machine running this app.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="custom-provider-models">Chat model IDs</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {modelIds.length}/50
              </span>
            </div>
            <textarea
              id="custom-provider-models"
              value={models}
              onChange={(event) => setModels(event.target.value)}
              placeholder={"model-name\nanother-model-name"}
              rows={4}
              className="flex w-full resize-y rounded-xl border border-black/[0.07] bg-white/60 px-3 py-2 font-mono text-sm outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/30 focus:bg-white/80 focus:ring-2 focus:ring-primary/10 dark:border-white/[0.08] dark:bg-white/[0.045]"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Enter exact IDs separated by commas or new lines. The first model becomes the default.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/25 px-5 py-4 sm:px-7">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={addProvider}
            disabled={!canCreate || pending}
            className="gap-2"
          >
            {pending ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}
            Connect provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
