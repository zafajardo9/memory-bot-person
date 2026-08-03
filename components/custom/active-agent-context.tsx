"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface ActiveAgentContextValue {
  registeredAgentId: string | null;
  registerAgent: (agentId: string | null) => void;
}

const ActiveAgentContext = createContext<ActiveAgentContextValue | null>(null);

export function resolveActiveAgentId({
  defaultAgentId,
  pathname,
  registeredAgentId,
}: {
  defaultAgentId?: string;
  pathname: string;
  registeredAgentId: string | null;
}) {
  const routeAgentId = pathname.match(/^\/agents\/([^/]+)/)?.[1];
  if (routeAgentId) return routeAgentId;
  if (registeredAgentId) return registeredAgentId;
  if (pathname.startsWith("/chat/")) return undefined;
  return defaultAgentId;
}

export function ActiveAgentProvider({ children }: { children: React.ReactNode }) {
  const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null);
  const registerAgent = useCallback((agentId: string | null) => {
    setRegisteredAgentId(agentId);
  }, []);
  const value = useMemo(
    () => ({ registeredAgentId, registerAgent }),
    [registerAgent, registeredAgentId],
  );

  return (
    <ActiveAgentContext.Provider value={value}>
      {children}
    </ActiveAgentContext.Provider>
  );
}

export function useResolvedActiveAgentId(defaultAgentId?: string) {
  const context = useContext(ActiveAgentContext);
  const pathname = usePathname();
  return resolveActiveAgentId({
    defaultAgentId,
    pathname,
    registeredAgentId: context?.registeredAgentId ?? null,
  });
}

export function useRegisterActiveAgent(agentId: string) {
  const context = useContext(ActiveAgentContext);
  const registerAgent = context?.registerAgent;

  useEffect(() => {
    registerAgent?.(agentId);
    return () => registerAgent?.(null);
  }, [agentId, registerAgent]);
}
