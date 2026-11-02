// CHAT-AGENT-P1-02: also exports the tool-loop types (ChatTool, ChatAction, ChatReply, ToolContext).
export { ClaudeClient } from "./ClaudeClient";
export type {
  IChatModelClient,
  ChatTurn,
  ChatTool,
  ChatAction,
  ChatReply,
  ChatOptions,
  ToolContext,
} from "./IChatModelClient";
