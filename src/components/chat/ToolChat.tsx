"use client";

import * as React from "react";
import { AlertCircle, Bot, Mic, Send, User, Square, ArrowUpRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Loader from "@/components/ui/Loader";
import { AnalysisDisplay } from "@/components/chat/AnalysisDisplay";
import { SOPDisplay } from "@/components/chat/SOPDisplay";
import { useSpeechRecognition } from "@/components/chat/useSpeechRecognition";

import type { ToolChatMode, ToolChatRequest, ToolChatResponse, ToolId } from "@/lib/tool-chat/types";
import { getToolChatConfig } from "@/lib/tool-chat/registry";

export type InitialChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolChatProps<TContext = unknown, TAction = unknown> = {
  toolId: ToolId;
  mode?: ToolChatMode;
  getContext?: () => TContext;
  parseAction?: (raw: unknown) => TAction;
  onApplyAction?: (action: TAction) => void | Promise<void>;
  enabled?: boolean;
  endpoint?: string;
  className?: string;
  /** Optional messages to show at the start of the chat (e.g. critical questions from the assistant). */
  initialMessages?: InitialChatMessage[];
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function seedMessagesFromInitial(
  initialMessages: InitialChatMessage[] | undefined,
): Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: number }> {
  if (!initialMessages?.length) return [];
  return initialMessages.map((m, i) => ({
    id: makeId(),
    role: m.role,
    content: m.content,
    createdAt: Date.now() - (initialMessages.length - i) * 1000,
  }));
}

export function ToolChat<TContext = unknown, TAction = unknown>({
  toolId,
  mode = "both",
  getContext,
  parseAction,
  onApplyAction,
  enabled,
  endpoint,
  className,
  initialMessages,
}: ToolChatProps<TContext, TAction>) {
  const ui = React.useMemo(() => getToolChatConfig(toolId), [toolId]);
  const isEnabled = enabled ?? ui.enabled;
  const apiEndpoint = endpoint ?? ui.endpoint;

  const [messages, setMessages] = React.useState<Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: number;
  }>>(() => seedMessagesFromInitial(initialMessages));

  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [progressMessage, setProgressMessage] = React.useState<string | null>(null);
  const [lastActionRaw, setLastActionRaw] = React.useState<unknown>(null);
  const [lastActionParsed, setLastActionParsed] = React.useState<TAction | null>(null);
  const [lastActionError, setLastActionError] = React.useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = React.useState<Record<string, any> | null>(null);
  const [currentSOP, setCurrentSOP] = React.useState<Record<string, any> | null>(null);
  const [isApplyingAction, setIsApplyingAction] = React.useState(false);

  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const analysisBlockRef = React.useRef<HTMLDivElement | null>(null);

  // Speech recognition
  const {
    transcript,
    isRecording,
    isSupported,
    error: speechError,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useSpeechRecognition({
    onError: (error) => {
      toast.error("Speech recognition error", { description: error });
    },
  });

  // Update input when transcript changes - single source of truth
  // This ensures the transcript is always reflected in the input field
  React.useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Handle speech recognition errors
  React.useEffect(() => {
    if (speechError) {
      toast.error("Speech recognition error", { description: speechError });
    }
  }, [speechError]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }, 0);
    return () => clearTimeout(t);
  }, [messages.length]);

  React.useEffect(() => {
    if (!currentAnalysis || lastActionError) return;
    const t = setTimeout(() => {
      analysisBlockRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
    return () => clearTimeout(t);
  }, [currentAnalysis, lastActionError]);

  const handleSamplePrompt = React.useCallback((prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      const textarea = document.querySelector('textarea[data-slot="textarea"]') as HTMLTextAreaElement;
      textarea?.focus();
    }, 0);
  }, []);

  const handleToggleRecording = React.useCallback(() => {
    console.log("[ToolChat] handleToggleRecording called", {
      isRecording,
      isSupported,
    });

    if (isRecording) {
      console.log("[ToolChat] Stopping recording");
      stopRecording();
    } else {
      if (!isSupported) {
        toast.error("Speech recognition not supported", {
          description: "Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.",
        });
        return;
      }
      console.log("[ToolChat] Starting recording");
      clearTranscript();
      // Don't clear input here - let it be cleared by the recognition hook
      startRecording();
    }
  }, [isRecording, isSupported, startRecording, stopRecording, clearTranscript]);

  const buildRequest = React.useCallback((): ToolChatRequest<TContext> => {
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    return {
      toolId,
      mode,
      conversation,
      context: (getContext ? getContext() : ({} as TContext)),
    };
  }, [getContext, messages, mode, toolId]);

  const handleSend = React.useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setLastActionError(null);
    setLastActionParsed(null);
    setLastActionRaw(null);

    const userMsg = {
      id: makeId(),
      role: "user" as const,
      content: trimmed,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      if (!isEnabled) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content:
              "Chat is not connected yet for this tool. The UI is ready; next we'll wire the backend endpoint to accept the ToolChat envelope.",
            createdAt: Date.now(),
          },
        ]);
        return;
      }

      const requestBody = buildRequest();
      requestBody.conversation = [
        ...requestBody.conversation,
        { role: "user", content: trimmed },
      ];

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      const isStreaming = contentType.includes("ndjson") || contentType.includes("x-ndjson");

      let data: ToolChatResponse<unknown> | null = null;

      if (isStreaming && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line) as { type?: string; stage?: string; data?: ToolChatResponse<unknown> };
              if (parsed.type === "progress" && parsed.stage) {
                setProgressMessage(parsed.stage);
              } else if (parsed.type === "result" && parsed.data) {
                data = parsed.data;
                break;
              } else if (parsed.type === "error" && parsed.data) {
                data = parsed.data;
                break;
              }
            } catch {
              // skip malformed lines
            }
          }
          if (data) break;
        }
        if (!data && buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer) as { type?: string; data?: ToolChatResponse<unknown> };
            if (parsed.type === "result" && parsed.data) data = parsed.data;
            else if (parsed.type === "error" && parsed.data) data = parsed.data;
          } catch {
            // ignore
          }
        }
        reader.releaseLock();
      } else {
        try {
          data = (await res.json()) as ToolChatResponse<unknown>;
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        const msg =
          data?.error ||
          (typeof (data as any)?.message === "string" ? (data as any).message : null) ||
          `Request failed (${res.status})`;
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: `I couldn't complete that request: ${msg}`,
            createdAt: Date.now(),
          },
        ]);
        toast.error("Chat request failed", { description: msg });
        return;
      }

      if (!data) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: "No response received. Please try again.",
            createdAt: Date.now(),
          },
        ]);
        return;
      }

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: (data as any).assistantMessage ?? `Error: ${data.error}`,
            createdAt: Date.now(),
          },
        ]);
        toast.error(data.error, { description: (data as any).details });
        return;
      }

      const assistantText =
        data?.assistantMessage ??
        (typeof (data as any)?.reply === "string" ? (data as any).reply : "") ??
        "";

      if (assistantText) {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "assistant", content: assistantText, createdAt: Date.now() },
        ]);
      }

      if (typeof data?.action !== "undefined") {
        setLastActionRaw(data.action);
        try {
          const parsed = (parseAction ? parseAction(data.action) : (data.action as TAction)) ?? null;
          setLastActionParsed(parsed);

          if (parsed && typeof parsed === "object" && parsed !== null) {
            const actionObj = parsed as any;
            if (actionObj.analysis) {
              setCurrentAnalysis(actionObj.analysis);
              setCurrentSOP(null);
            } else if (actionObj.sop) {
              setCurrentSOP(actionObj.sop);
              setCurrentAnalysis(null);
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Invalid action payload";
          setLastActionError(msg);
          toast.error("Invalid extracted payload", { description: msg });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: `Something went wrong: ${msg}`,
          createdAt: Date.now(),
        },
      ]);
      toast.error("Chat error", { description: msg });
    } finally {
      setIsSending(false);
      setProgressMessage(null);
    }
  }, [apiEndpoint, buildRequest, input, isEnabled, isSending, parseAction]);

  const canApply = !!onApplyAction && !!lastActionParsed && !lastActionError;
  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {hasMessages ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full rounded-md border">
              <div className="p-3 pb-6 space-y-3">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const isAssistant = m.role === "assistant";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
                    >
                      {!isUser && (
                        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                          {isAssistant ? <Bot className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                          isUser
                            ? "bg-[var(--primary-dark)] text-white"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {m.content}
                      </div>
                      {isUser && (
                        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex gap-2 justify-start">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-1 max-w-[85%] rounded-lg px-3 py-2 bg-muted min-h-[44px]">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {progressMessage ?? "Analyzing your requirements..."}
                        </span>
                      </div>
                      {progressMessage && (
                        <p className="text-xs text-muted-foreground/80">
                          This usually takes 1–2 minutes. We&apos;re analyzing your role and building recommendations.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {currentAnalysis && !lastActionError && (
                  <div ref={analysisBlockRef} className="flex gap-2 justify-start">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                      <Bot className="h-4 w-4" />
                    </div>
                    <AnalysisDisplay
                      analysis={currentAnalysis}
                      onApply={canApply ? async () => {
                        if (!lastActionParsed || !onApplyAction) return;
                        try {
                          await onApplyAction(lastActionParsed);
                          toast.success("Applied", { description: "The analysis has been applied to your form." });
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Failed to apply analysis";
                          toast.error("Apply failed", { description: msg });
                        }
                      } : undefined}
                    />
                  </div>
                )}

                {/* Display SOP if available - styled as assistant message */}
                {currentSOP && !lastActionError && (
                  <div className="flex gap-2 justify-start w-full min-w-0">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-background flex-shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <SOPDisplay
                        sop={currentSOP}
                        onApply={canApply && !isApplyingAction ? async () => {
                          if (!lastActionParsed || !onApplyAction || isApplyingAction) return;
                          setIsApplyingAction(true);
                          try {
                            await onApplyAction(lastActionParsed);
                            // Clear the SOP from display after applying to prevent duplicate clicks
                            setCurrentSOP(null);
                            setLastActionParsed(null);
                            toast.success("Applied", { description: "The SOP has been applied to your form." });
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Failed to apply SOP";
                            toast.error("Apply failed", { description: msg });
                          } finally {
                            setIsApplyingAction(false);
                          }
                        } : undefined}
                      />
                    </div>
                  </div>
                )}

                {lastActionError && (
                  <div className="mt-4 rounded-md border border-destructive bg-destructive/10">
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium text-destructive mb-1">Error</div>
                      <div className="text-sm text-destructive/80">{lastActionError}</div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </div>

          <div className="flex items-end gap-2 flex-shrink-0 pt-3 bg-background border-t">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ui.placeholder ?? "Type your message…"}
              className="min-h-[44px] max-h-40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={isSending || isRecording}
            />
            {isSupported && (
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                onClick={handleToggleRecording}
                disabled={isSending}
                className={cn(
                  "flex-shrink-0",
                  isRecording && "animate-pulse"
                )}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button onClick={() => void handleSend()} disabled={isSending || !input.trim() || isRecording}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <button
              type="button"
              onClick={isSupported ? handleToggleRecording : () => {
                const textarea = document.querySelector('textarea[data-slot="textarea"]') as HTMLTextAreaElement;
                textarea?.focus();
              }}
              className="flex flex-col items-center gap-3 group"
              disabled={isSending}
            >
              <div
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full text-white transition-all",
                  isRecording
                    ? "bg-destructive animate-pulse scale-110"
                    : "bg-[color:var(--accent-strong)] hover:scale-105 group-hover:bg-[color:var(--accent-light)]"
                )}
              >
                {isRecording ? (
                  <Square className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">
                  {isRecording ? "Recording... Tap to stop" : isSupported ? "Tap to speak" : "Tap to focus"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSupported ? "Or Start Typing Below" : "Speech recognition not available in this browser"}
                </p>
                {speechError && (
                  <p className="text-xs text-destructive mt-1">{speechError}</p>
                )}
                {isRecording && transcript && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                    Heard: {transcript}
                  </p>
                )}
              </div>
            </button>

            {ui.samplePrompts && ui.samplePrompts.length > 0 && (
              <div className="w-full max-w-md space-y-2">
                <p className="text-xs text-muted-foreground text-center">Try these prompts:</p>
                <div className="flex flex-col gap-2">
                  {ui.samplePrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSamplePrompt(prompt)}
                      className="text-left px-4 py-2 text-sm rounded-md border bg-background hover:bg-muted transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 pt-3 border-t flex-shrink-0 bg-background">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ui.placeholder ?? "Type your message…"}
              className="min-h-[44px] max-h-40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={isSending || isRecording}
            />
            {isSupported && (
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                onClick={handleToggleRecording}
                disabled={isSending}
                className={cn(
                  "flex-shrink-0",
                  isRecording && "animate-pulse"
                )}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button onClick={() => void handleSend()} disabled={isSending || !input.trim() || isRecording}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
