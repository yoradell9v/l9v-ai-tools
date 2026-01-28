import type { ToolChatUiConfig, ToolId } from "@/lib/tool-chat/types";

export const TOOL_CHAT_CONFIGS: Record<ToolId, ToolChatUiConfig> = {
  "role-builder": {
    toolId: "role-builder",
    title: "Role Builder Chat",
    description:
      "Describe the role you want. The assistant will turn it into a structured role spec you can apply.",
    placeholder:
      "e.g. I need a VA to manage inbound leads, follow up, update HubSpot, and schedule calls…",
    samplePrompts: [
      "I need a social media manager",
      "Looking for someone to handle customer support",
      "Need help with bookkeeping and invoicing",
    ],
    enabled: true, // Enabled now that unified endpoint exists
    endpoint: "/api/tool-chat",
  },
  "organization-profile": {
    toolId: "organization-profile",
    title: "Knowledge Base Setup Chat",
    description:
      "Tell us about your business. The assistant will propose knowledge base fields and sources to apply.",
    placeholder:
      "e.g. We sell done-for-you ads to coaches. Our CRM is HubSpot. Our biggest bottleneck is fulfillment…",
    samplePrompts: [
      "Let me tell you about our brand voice",
      "Here's how we handle client onboarding",
      "Our main product offerings are...",
    ],
    enabled: true, // Enabled now that unified endpoint exists
    endpoint: "/api/tool-chat",
  },
  "process-builder": {
    toolId: "process-builder",
    title: "Process Builder Chat",
    description:
      "Describe a process. The assistant will propose a draft SOP outline you can apply.",
    placeholder:
      "e.g. Write an SOP for publishing a weekly newsletter from draft to send…",
    samplePrompts: [
      "Create an SOP for onboarding new clients",
      "Document our social media posting process",
      "I need a checklist for invoice processing",
    ],
    enabled: true, // Enabled now that unified endpoint exists
    endpoint: "/api/tool-chat",
  },
};

export function getToolChatConfig(toolId: ToolId): ToolChatUiConfig {
  return TOOL_CHAT_CONFIGS[toolId];
}

