function enabled(name: string) {
  return process.env[name]?.toLowerCase() !== "false";
}

export const isKnowledgeManagementEnabled = () => enabled("KNOWLEDGE_MANAGEMENT_ENABLED");
export const isKnowledgeIndexingEnabled = () => enabled("KNOWLEDGE_INDEXING_ENABLED");
export const isKnowledgeChatEnabled = () => enabled("KNOWLEDGE_CHAT_ENABLED");
