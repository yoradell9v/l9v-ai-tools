"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/context/UserContext";
import {
    Brain,
    Send,
    History,
    Plus,
    Bot,
    FileText,
    Target,
    Palette,
    Mail,
    Sparkles,
    Briefcase,
    ArrowRight,
    Lightbulb,
    ChevronRight,
    ChevronLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isRateLimitError, parseRateLimitError, getRateLimitErrorMessage } from "@/lib/rate-limit-client";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    citations?: any[];
    confidence?: number;
};

type OrganizationKnowledgeBase = {
    id: string;
    organizationId: string;
    businessName: string | null;
    [key: string]: any;
};

type ConversationSummary = {
    id: string;
    title: string | null;
    lastMessageAt: string;
    messageCount: number;
    status: string;
};

const slashCommands = [
    {
        command: "/calibrate-voice",
        description: "Generates brand voice guidelines",
        icon: Palette,
    },
    {
        command: "/ad-kit",
        description: "Creates 10 hooks, 6 angles, 5 ad scripts",
        icon: Target,
    },
    {
        command: "/email-kit",
        description: "Generates 5 email templates with subject lines",
        icon: Mail,
    },
    {
        command: "/offers-map",
        description: "Lists all offers with objections/rebuttals",
        icon: Briefcase,
    },
    {
        command: "/summarize-sops",
        description: "Creates 1-page SOP summary",
        icon: FileText,
    },
    {
        command: "/content-brief",
        description: "Generates creative brief for content",
        icon: Sparkles,
    },
];

export default function AIBusinessBrainPage() {
    const { user } = useUser();
    const router = useRouter();
    const [knowledgeBase, setKnowledgeBase] = useState<OrganizationKnowledgeBase | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationsError, setConversationsError] = useState<string | null>(null);
    const [isConversationLoading, setIsConversationLoading] = useState(false);
    const [isCreatingConversation, setIsCreatingConversation] = useState(false);
    const [showSlashCommands, setShowSlashCommands] = useState(false);
    const [slashCommandFilter, setSlashCommandFilter] = useState("");
    const [isConversationSidebarOpen, setIsConversationSidebarOpen] = useState(false);
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);

    const handleCompleteKnowledgeBase = () => {
        router.push("/dashboard/organization-profile");
    };

    useEffect(() => {
        const fetchKnowledgeBase = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch("/api/organization-knowledge-base");
                const result = await response.json();

                if (result.success) {
                    if (result.organizationProfile) {
                        setKnowledgeBase(result.organizationProfile);
                    } else {
                        setKnowledgeBase(null);
                    }
                }
            } catch (error) {
                console.error("Error fetching knowledge base:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchKnowledgeBase();
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const filteredSlashCommands = slashCommands.filter((cmd) =>
        cmd.command.toLowerCase().includes(slashCommandFilter.toLowerCase()) ||
        cmd.description.toLowerCase().includes(slashCommandFilter.toLowerCase())
    );

    const getCurrentGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning!";
        if (hour < 18) return "Good afternoon!";
        return "Good evening!";
    };

    const formatShortDate = (dateString: string) => {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const fetchConversations = async () => {
        if (!knowledgeBase) return;
        setConversationsLoading(true);
        setConversationsError(null);
        try {
            const res = await fetch("/api/organization-knowledge-base/conversation?list=true");
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to load conversations");
            }

            setConversations(data.conversations || []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load conversations";
            setConversationsError(message);
        } finally {
            setConversationsLoading(false);
        }
    };

    useEffect(() => {
        if (isConversationSidebarOpen) {
            fetchConversations();
        }
    }, [isConversationSidebarOpen, knowledgeBase]);

    const loadConversation = async (conversationId: string) => {
        setIsConversationLoading(true);
        setConversationsError(null);
        setSelectedConversationId(conversationId);
        setCurrentConversationId(conversationId);

        try {
            const res = await fetch(
                `/api/organization-knowledge-base/conversation?conversationId=${conversationId}`
            );
            const data = await res.json();
            if (!res.ok || !data.success || !data.conversation) {
                throw new Error(data.error || "Failed to load conversation");
            }

            const mappedMessages: ChatMessage[] = (data.conversation.messages || []).map(
                (msg: any) => ({
                    id: msg.id,
                    role: msg.role === "assistant" ? "assistant" : "user",
                    content: msg.content,
                    timestamp: new Date(msg.createdAt || msg.updatedAt || Date.now()),
                    citations: msg.metadata?.citations || msg.citations,
                    confidence: msg.metadata?.confidence,
                })
            );

            setChatMessages(mappedMessages);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load conversation";
            setConversationsError(message);
        } finally {
            setIsConversationLoading(false);
        }
    };

    const handleStartNewConversation = () => {
        setSelectedConversationId(null);
        setCurrentConversationId(null);
        setChatMessages([]);
        setInputValue("");
    };

    const handleCreateConversation = async () => {
        if (isCreatingConversation) return;
        setIsCreatingConversation(true);
        // Do not create on server until first message; just reset UI state
        handleStartNewConversation();
        setIsCreatingConversation(false);
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isSending || !knowledgeBase) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: inputValue,
            timestamp: new Date(),
        };

        setChatMessages((prev) => [...prev, userMessage]);
        setInputValue("");
        setIsSending(true);
        setShowSlashCommands(false);

        try {
            let conversationId = currentConversationId;
            if (!conversationId) {
                const convResponse = await fetch(
                    `/api/organization-knowledge-base/conversation`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: userMessage.content.substring(0, 50),
                        }),
                    }
                );

                if (!convResponse.ok) {
                    throw new Error("Failed to create conversation");
                }

                const convResult = await convResponse.json();
                conversationId = convResult.conversation.id;
                setCurrentConversationId(conversationId);
                setSelectedConversationId(conversationId);
                setConversations((prev) => [
                    {
                        id: convResult.conversation.id,
                        title: convResult.conversation.title,
                        lastMessageAt: convResult.conversation.lastMessageAt,
                        messageCount: convResult.conversation.messageCount || 0,
                        status: convResult.conversation.status || "ACTIVE",
                    },
                    ...prev.filter((c) => c.id !== convResult.conversation.id),
                ]);
            }

            const messageResponse = await fetch(
                `/api/organization-knowledge-base/conversation/${conversationId}/message`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: userMessage.content,
                    }),
                }
            );

            // Check for rate limit error
            if (isRateLimitError(messageResponse)) {
                const rateLimitError = await parseRateLimitError(messageResponse);
                const errorMessage = getRateLimitErrorMessage(rateLimitError);
                toast.error("Rate limit exceeded", {
                    description: errorMessage,
                    duration: 10000,
                });
                throw new Error(errorMessage);
            }

            if (!messageResponse.ok) {
                const errorData = await messageResponse.json();
                throw new Error(errorData.error || "Failed to send message");
            }

            const messageResult = await messageResponse.json();

            const assistantMessage: ChatMessage = {
                id: messageResult.assistantMessage.id,
                role: "assistant",
                content: messageResult.assistantMessage.content,
                timestamp: new Date(),
                citations: messageResult.assistantMessage.citations,
                confidence: messageResult.assistantMessage.confidence,
            };

            setChatMessages((prev) => [...prev, assistantMessage]);
            if (isConversationSidebarOpen) {
                fetchConversations();
            }
        } catch (error) {
            console.error("Error sending message:", error);
            let errorContent = "Sorry, I encountered an error while processing your message.";

            if (error instanceof Error) {
                errorContent = `Sorry, I encountered an error: ${error.message}`;
            }

            const errorMessage: ChatMessage = {
                id: `error-${Date.now()}`,
                role: "assistant",
                content: errorContent,
                timestamp: new Date(),
            };
            setChatMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center">
                    <svg
                        className="animate-spin h-8 w-8 mb-3 text-[var(--accent)]"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <p className="text-base text-[var(--text-secondary)]">Loading...</p>
                </div>
            </div>
        );
    }

    if (!knowledgeBase) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <div className="max-w-2xl w-full space-y-6">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mx-auto">
                                <Brain size={48} className="text-[var(--accent)]" />
                            </div>
                            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                                Setup Your AI Business Brain
                            </h1>
                            <p className="text-base text-[var(--text-secondary)] max-w-md mx-auto">
                                Complete your organization knowledge base to unlock the AI Business Brain.
                                This will power all your AI tools and conversations.
                            </p>
                        </div>

                        <Dialog open={isOnboardingModalOpen} onOpenChange={setIsOnboardingModalOpen}>
                            <DialogContent className="sm:max-w-[550px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-lg">
                                        <Brain className="h-5 w-5 text-[color:var(--accent-strong)]" />
                                        Complete Your Organization Knowledge Base
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-5">
                                    <div className="bg-gradient-to-r from-[color:var(--accent-strong)]/10 to-[color:var(--accent-strong)]/5 border border-[color:var(--accent-strong)]/20 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <Lightbulb className="h-5 w-5 text-[color:var(--accent-strong)] mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-base font-semibold text-[color:var(--text-primary)] mb-1">
                                                    Your Knowledge Base powers everything
                                                </p>
                                                <p className="text-xs text-[color:var(--text-secondary)] leading-relaxed">
                                                    This single source of truth feeds all your tools—Job Descriptions, SOPs, Business Brain conversations, and more. The more complete it is, the smarter your results become.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/50 p-4 rounded-lg space-y-3 border border-[color:var(--border-color)]">
                                        <p className="text-base font-semibold text-[color:var(--text-primary)]">Why complete your Knowledge Base?</p>
                                        <ul className="text-base text-[color:var(--text-secondary)] space-y-2 list-none">
                                            <li className="flex items-start gap-2">
                                                <span className="text-[color:var(--accent-strong)] mt-0.5">✓</span>
                                                <span><strong>Auto-fill forms</strong> across all tools—save hours of repetitive data entry</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-[color:var(--accent-strong)] mt-0.5">✓</span>
                                                <span><strong>Smarter AI responses</strong> in Business Brain conversations with full context</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-[color:var(--accent-strong)] mt-0.5">✓</span>
                                                <span><strong>Personalized outputs</strong> for Job Descriptions and SOPs that match your brand</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-[color:var(--accent-strong)] mt-0.5">✓</span>
                                                <span><strong>Consistent messaging</strong> across your entire organization</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-[color:var(--accent-strong)] mt-0.5">✓</span>
                                                <span><strong>Continuous learning</strong>—the system gets smarter as you use it</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            onClick={handleCompleteKnowledgeBase}
                                            className="flex-1 bg-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/90"
                                        >
                                            <Brain className="h-4 w-4 mr-2" />
                                            Complete Knowledge Base
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                        <Button variant="outline" onClick={() => setIsOnboardingModalOpen(false)}>
                                            Maybe Later
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="flex justify-center">
                            <Button onClick={() => setIsOnboardingModalOpen(true)} size="lg" className="gap-2">
                                <Plus size={20} />
                                <span>Get Started</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="flex flex-col h-screen">
                <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                    <SidebarTrigger />
                    <div className="flex-1 flex items-center justify-between">
                        <div>
                            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                                AI Business Brain
                            </h1>
                            {knowledgeBase.businessName && (
                                <p className="text-base text-[var(--text-secondary)]">
                                    {knowledgeBase.businessName}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                onClick={handleCreateConversation}
                                disabled={isCreatingConversation}
                                className="gap-2"
                            >
                                <Plus size={16} />
                                {isCreatingConversation ? "Creating..." : "New Chat"}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsConversationSidebarOpen((prev) => !prev)}
                                title="Conversation History"
                            >
                                <History size={18} className="text-[var(--accent-strong)]" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 min-h-0">
                            {chatMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-4">
                                        <Bot size={48} className="text-[var(--accent)]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                                        {getCurrentGreeting()}
                                    </h3>
                                    <p className="text-base text-[var(--text-secondary)] mb-6 max-w-md">
                                        Ask me anything about your business, or use a slash command to get started.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 max-w-md">
                                        {slashCommands.slice(0, 4).map((cmd) => (
                                            <button
                                                key={cmd.command}
                                                onClick={() => {
                                                    setInputValue(cmd.command);
                                                    setShowSlashCommands(false);
                                                }}
                                                className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-left transition-colors"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <cmd.icon size={16} className="text-[var(--primary)]" />
                                                    <span className="text-xs font-medium text-[var(--text-primary)]">
                                                        {cmd.command}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary)]">
                                                    {cmd.description}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {chatMessages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-lg ${message.role === "user"
                                                    ? "bg-[var(--primary)] text-white px-4 py-2"
                                                    : "bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)] p-4"
                                                    }`}
                                                style={{
                                                    wordWrap: 'break-word',
                                                    overflowWrap: 'break-word',
                                                    overflowX: 'hidden',
                                                }}
                                            >
                                                <div
                                                    className={`prose prose-xs max-w-none break-words text-base ${message.role === "user" ? "prose-invert" : ""}`}
                                                    style={{
                                                        wordWrap: 'break-word',
                                                        overflowWrap: 'break-word',
                                                        overflowX: 'hidden',
                                                    }}
                                                >
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ node, ...props }) => (
                                                                <p
                                                                    className="mb-2 leading-relaxed last:mb-0 text-base"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            h1: ({ node, ...props }: any) => (
                                                                <h1
                                                                    className="text-lg font-bold mb-2 mt-4 first:mt-0"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            h2: ({ node, ...props }: any) => (
                                                                <h2
                                                                    className="text-base font-bold mb-2 mt-4 first:mt-0"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            h3: ({ node, ...props }: any) => (
                                                                <h3
                                                                    className="text-base font-semibold mb-2 mt-3 first:mt-0"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            strong: ({ node, ...props }) => (
                                                                <strong
                                                                    className="font-semibold text-base"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            ul: ({ node, ...props }: any) => (
                                                                <ul
                                                                    className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0 text-base"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            ol: ({ node, ...props }: any) => (
                                                                <ol
                                                                    className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0 text-base"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            li: ({ node, ...props }) => (
                                                                <li
                                                                    className="leading-relaxed text-base"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            blockquote: ({ node, ...props }: any) => (
                                                                <blockquote
                                                                    className="border-l-4 border-muted pl-4 italic my-2 text-base"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                            code: (props: any) => {
                                                                const { inline, children, ...rest } = props;
                                                                if (inline) {
                                                                    return (
                                                                        <code
                                                                            className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono break-words"
                                                                            style={{
                                                                                wordWrap: 'break-word',
                                                                                overflowWrap: 'break-word',
                                                                            }}
                                                                            {...rest}
                                                                        >
                                                                            {children}
                                                                        </code>
                                                                    );
                                                                }
                                                                return (
                                                                    <code
                                                                        className="block rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto"
                                                                        style={{
                                                                            wordWrap: 'break-word',
                                                                            overflowWrap: 'break-word',
                                                                            maxWidth: '100%',
                                                                        }}
                                                                        {...rest}
                                                                    >
                                                                        {children}
                                                                    </code>
                                                                );
                                                            },
                                                            pre: ({ node, ...props }: any) => (
                                                                <pre
                                                                    className="block rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto"
                                                                    style={{
                                                                        wordWrap: 'break-word',
                                                                        overflowWrap: 'break-word',
                                                                        maxWidth: '100%',
                                                                    }}
                                                                    {...props}
                                                                />
                                                            ),
                                                        }}
                                                    >
                                                        {message.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isSending && (
                                        <div className="flex justify-start">
                                            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" />
                                                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce delay-75" />
                                                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce delay-150" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]">
                            <div className="relative">
                                {showSlashCommands && (
                                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                                        <div className="p-2 border-b border-[var(--border-color)]">
                                            <Input
                                                type="text"
                                                placeholder="Search commands..."
                                                value={slashCommandFilter}
                                                onChange={(e) => setSlashCommandFilter(e.target.value)}
                                                className="text-base"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="p-2">
                                            {filteredSlashCommands.map((cmd) => (
                                                <Button
                                                    variant="ghost"
                                                    key={cmd.command}
                                                    onClick={() => {
                                                        setInputValue(cmd.command);
                                                        setShowSlashCommands(false);
                                                        setSlashCommandFilter("");
                                                    }}
                                                    className="w-full justify-start gap-3 px-2 py-2"
                                                >
                                                    <cmd.icon
                                                        size={18}
                                                        className="text-[var(--primary)] flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <div className="text-base font-medium text-[var(--text-primary)]">
                                                            {cmd.command}
                                                        </div>
                                                        <div className="text-xs text-[var(--text-secondary)]">
                                                            {cmd.description}
                                                        </div>
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <Textarea
                                        ref={chatInputRef}
                                        value={inputValue}
                                        onChange={(e) => {
                                            setInputValue(e.target.value);
                                            if (e.target.value.startsWith("/")) {
                                                setShowSlashCommands(true);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                            if (e.key === "Escape") {
                                                setShowSlashCommands(false);
                                            }
                                        }}
                                        placeholder="Type a message or use / for commands..."
                                        className="flex-1 min-h-[52px] max-h-32"
                                        rows={1}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim() || isSending}
                                        className="p-3"
                                        size="icon"
                                    >
                                        <Send size={20} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={`fixed top-0 right-0 h-full w-80 bg-[var(--card-bg)] border-l border-[var(--border-color)] shadow-lg transform transition-transform duration-300 ${isConversationSidebarOpen ? "translate-x-0" : "translate-x-full"
                    }`}
                style={{ zIndex: 30 }}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                    <div className="space-y-0.5">
                        <p className="text-base font-semibold text-[var(--text-primary)]">Conversation History</p>

                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="bg-gray-100 hover:bg-gray-200 text-[var(--text-primary)]"
                        onClick={() => setIsConversationSidebarOpen((prev) => !prev)}
                        title={isConversationSidebarOpen ? "Collapse" : "Expand"}
                    >
                        {isConversationSidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversationsLoading && (
                        <div className="px-4 py-3 text-base text-[var(--text-secondary)]">Loading...</div>
                    )}
                    {conversationsError && (
                        <div className="px-4 py-3 text-base text-red-500">{conversationsError}</div>
                    )}
                    {!conversationsLoading && !conversationsError && conversations.length === 0 && (
                        <div className="px-4 py-6 text-base text-[var(--text-secondary)]">
                            No conversations yet. Start a new one to see it here.
                        </div>
                    )}

                    <div>
                        {conversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => loadConversation(conv.id)}
                                className={`w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors ${selectedConversationId === conv.id ? "bg-[var(--hover-bg)]" : ""
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-medium text-[var(--text-primary)] truncate">
                                            {conv.title || "Untitled conversation"}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            {formatShortDate(conv.lastMessageAt)}
                                        </p>
                                    </div>
                                    <div className="ml-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                        <History size={14} />
                                        <span>{conv.messageCount}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {isConversationLoading && (
                    <div className="absolute inset-x-0 bottom-0 p-2 text-center text-xs text-[var(--text-secondary)] bg-[var(--card-bg)] border-t border-[var(--border-color)]">
                        Loading conversation...
                    </div>
                )}
            </div>
        </>
    );
}
