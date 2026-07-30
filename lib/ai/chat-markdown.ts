export function normalizeChatMarkdown(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u200B/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^\s*(?:assistant|answer)\s*:\s*/i, "")
    .replace(/^(\s*)[•●]\s+/gm, "$1- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
