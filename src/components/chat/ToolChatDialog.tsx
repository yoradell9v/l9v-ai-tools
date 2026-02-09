"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToolChat, type InitialChatMessage } from "@/components/chat/ToolChat";
import { ArrowUpRight } from "lucide-react";
import type { ToolId, ToolChatMode } from "@/lib/tool-chat/types";
import { getToolChatConfig } from "@/lib/tool-chat/registry";

type ToolChatDialogProps = {
  toolId: ToolId;
  buttonLabel?: string;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  buttonSize?: React.ComponentProps<typeof Button>["size"];
  mode?: ToolChatMode;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialContext?: unknown;
  /** Optional initial messages (e.g. assistant message with critical questions). When provided, chat seeds with these so user sees them first. */
  initialMessages?: InitialChatMessage[];
  showAnalysisBadge?: boolean;
  analysisBadgeData?: {
    analysis: any;
    businessName?: string;
  };
  onViewAnalysis?: () => void;
  showSOPBadge?: boolean;
  sopBadgeData?: {
    sop: any;
  };
  onViewSOP?: () => void;

  onApplyAction?: (action: unknown) => void | Promise<void>;
  parseAction?: (raw: unknown) => unknown;
  getContext?: () => unknown;
};

export function ToolChatDialog({
  toolId,
  buttonLabel = "Chat",
  buttonVariant = "outline",
  buttonSize = "default",
  mode = "both",
  className,
  icon: Icon = MessageSquareText,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialContext,
  initialMessages,
  showAnalysisBadge = false,
  analysisBadgeData,
  onViewAnalysis,
  showSOPBadge = false,
  sopBadgeData,
  onViewSOP,
  onApplyAction,
  parseAction,
  getContext,
}: ToolChatDialogProps) {
  const ui = React.useMemo(() => getToolChatConfig(toolId), [toolId]);
  const [internalOpen, setInternalOpen] = React.useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleApplyAction = React.useCallback(async (action: unknown) => {
    if (onApplyAction) {
      await onApplyAction(action);
      setOpen(false);
    }
  }, [onApplyAction, setOpen]);

  // Create getContext function that includes initialContext
  const contextGetter = React.useCallback(() => {
    if (getContext) {
      const dynamicContext = getContext();
      return {
        ...(typeof dynamicContext === 'object' && dynamicContext !== null ? dynamicContext : {}),
        ...(typeof initialContext === 'object' && initialContext !== null ? initialContext : {}),
      };
    }
    return initialContext || {};
  }, [getContext, initialContext]);

  // Only render trigger button if not in controlled mode (when open/onOpenChange are provided)
  const showTriggerButton = controlledOpen === undefined && controlledOnOpenChange === undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTriggerButton && (
        <Button
          variant={buttonVariant}
          size={buttonSize}
          onClick={() => setOpen(true)}
          className={className}
          type="button"
        >
          <Icon className="h-4 w-4" />
          {buttonLabel}
        </Button>
      )}

      <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 sm:p-2 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle>{ui.title}</DialogTitle>
          <DialogDescription>
            {ui.description ?? "Use chat to describe what you want to build."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4 flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Minimal refinement badge */}
          {showAnalysisBadge && analysisBadgeData && onViewAnalysis && (
            <button
              type="button"
              onClick={onViewAnalysis}
              className="mb-3 w-full px-3 py-2 text-sm border border-[var(--primary-dark)] bg-[var(--primary-dark)]/10 text-[var(--primary-dark)] rounded-md hover:bg-[var(--primary-dark)]/20 transition-colors flex items-center justify-between flex-shrink-0"
            >
              <span>
                Refining {analysisBadgeData.analysis?.preview?.service_type ||
                  analysisBadgeData.analysis?.full_package?.service_structure?.service_type ||
                  "Analysis"}
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
          {showSOPBadge && sopBadgeData && onViewSOP && (
            <button
              type="button"
              onClick={onViewSOP}
              className="mb-3 w-full px-3 py-2 text-sm border border-[var(--primary-dark)] bg-[var(--primary-dark)]/10 text-[var(--primary-dark)] rounded-md hover:bg-[var(--primary-dark)]/20 transition-colors flex items-center justify-between flex-shrink-0"
            >
              <span>
                Refining {sopBadgeData.sop?.metadata?.title || "SOP"}
              </span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ToolChat
              key={initialMessages?.length ? "with-initial" : "no-initial"}
              toolId={toolId}
              mode={mode}
              className="h-full"
              initialMessages={initialMessages}
              onApplyAction={handleApplyAction}
              parseAction={parseAction}
              getContext={contextGetter}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

