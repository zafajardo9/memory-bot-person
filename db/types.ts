import type {
  Chat as PrismaChat,
  KnowledgeSource,
  Reservation,
  User,
  UserRole,
} from "@/lib/generated/prisma/client";
import type { UIMessage } from "ai";


export type { KnowledgeSource, Reservation, User, UserRole };

export type Chat = Omit<PrismaChat, "messages"> & {
  messages: UIMessage[];
};

export interface ChatSummary {
  id: string;
  agentId: string;
  createdAt: Date;
  title: string;
}
