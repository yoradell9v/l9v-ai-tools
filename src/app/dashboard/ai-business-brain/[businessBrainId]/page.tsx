"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Modal from "@/components/ui/Modal";
import { useUser } from "@/context/UserContext";
import {
    Rocket,
    History,
    Brain,
    CheckCircle2,
    Upload,
    Sparkles,
    MessageSquare,
    Send,
    X,
    ChevronDown,
    ChevronUp,
    FileText,
    Target,
    Palette,
    Shield,
    Settings,
    RefreshCw,
    Bot,
    Users,
    TrendingUp,
    Zap,
    Mail,
    BarChart3,
    ClipboardCheck,
    Briefcase,
    AlertCircle,
    Clock,
    CheckCircle,
    ArrowLeft,
    Plus,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RSC_SUFFIX } from "next/dist/lib/constants";
import { businessBrainFormConfig } from "@/components/forms/configs/businessBrainFormConfig";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type BusinessCard = {
    id: string;
    type: string;
    title: string;
    description: string;
    metadata: any;
    orderIndex: number;
    priority?: number;
    confidence_score?: number;
};

type Status =
    | "idle"
    | "uploading"
    | "setup_complete"
    | "generating_cards"
    | "cards_ready"
    | "error";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    citations?: any[];
    confidence?: number;
};

export default function BusinessBrainDetail() {
    const params = useParams();
    const businessBrainId = params.businessBrainId as string;
    const { user } = useUser();
    const router = useRouter();
    const [isEnhanceModalOpen, setIsEnhanceModalOpen] = useState(false);
    const [enhancementAnalysis, setEnhancementAnalysis] = useState<any>(null);
    const [isLoadingEnhancement, setIsLoadingEnhancement] = useState(false);
    const [enhancementFormData, setEnhancementFormData] = useState<Record<string, string>>({});
    const [enhancementFiles, setEnhancementFiles] = useState<Record<string, File[]>>({});
    const [refinementAnswers, setRefinementAnswers] = useState<Record<string, string>>({});
    const [isSavingEnhancement, setIsSavingEnhancement] = useState(false);
    const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
    const [isRefreshingAnalysis, setIsRefreshingAnalysis] = useState(false);
    const [enhancementDragOver, setEnhancementDragOver] = useState<Record<string, boolean>>({});
    const [enhancementFileErrors, setEnhancementFileErrors] = useState<Record<string, string | null>>({});
    const [status, setStatus] = useState<Status>("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const [businessBrainData, setBusinessBrainData] = useState<{
        intakeData?: any;
        fileUploads?: any;
    } | null>(null);
    const [completionData, setCompletionData] = useState<any>(null);
    const [cards, setCards] = useState<BusinessCard[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showSlashCommands, setShowSlashCommands] = useState(false);
    const [slashCommandFilter, setSlashCommandFilter] = useState("");
    const slashCommandsRef = useRef<HTMLDivElement>(null);
    const [isConversationSidebarOpen, setIsConversationSidebarOpen] = useState(false);
    const [enhancementStep, setEnhancementStep] = useState<"analyzing" | "filling" | "regenerating">("analyzing");
    const [enhancementTab, setEnhancementTab] = useState<"missing" | "refinement" | "strategic">("missing");
    const [conversations, setConversations] = useState<Array<{
        id: string;
        title: string;
        lastMessageAt: string;
        messageCount: number;
        status: string;
    }>>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);

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

    const missingFieldData = useMemo(() => {
        type QuickWin = {
            id: string;
            label: string;
            field: string;
            action: "upload" | "fill_form";
            section?: string;
        };

        const quickWins: QuickWin[] = completionData?.quickWins || [];

        const filledCount = quickWins.filter((q) => {
            const ctx = enhancementAnalysis?.cardAnalysis
                ?.flatMap((c: any) => c.missingContexts || [])
                ?.find((c: any) => c.fieldId === q.field);
            const fieldType = ctx?.fieldType || "text";
            if (fieldType === "file" || q.action === "upload") {
                return enhancementFiles[q.field] && enhancementFiles[q.field].length > 0;
            }
            const value = enhancementFormData[q.field];
            return value && typeof value === "string" && value.trim().length > 0;
        }).length;

        const totalMissing = quickWins.length;
        const completion = totalMissing > 0 ? Math.round((filledCount / totalMissing) * 100) : 100;

        return {
            list: quickWins,
            totalMissing,
            filledCount,
            completion,
        };
    }, [completionData, enhancementAnalysis, enhancementFiles, enhancementFormData]);

    const refinementQuestionData = useMemo(() => {
        type RefinementQuestion = {
            id: string;
            question: string;
            cardTitle: string;
            category: string;
            fieldType: "text" | "textarea";
            placeholder?: string;
            helpText?: string;
            priority: "high" | "medium" | "low";
        };

        if (!enhancementAnalysis) {
            return {
                list: [] as RefinementQuestion[],
                answeredCount: 0,
                totalQuestions: 0,
                completion: 100,
            };
        }

        const allQuestions: RefinementQuestion[] = [];
        enhancementAnalysis.cardAnalysis.forEach((card: any) => {
            if (card.refinementQuestions && Array.isArray(card.refinementQuestions)) {
                card.refinementQuestions.forEach((q: RefinementQuestion) => {
                    allQuestions.push({
                        ...q,
                        cardTitle: card.cardTitle,
                    });
                });
            }
        });

        const answeredCount = allQuestions.filter((q) => refinementAnswers[q.id] && refinementAnswers[q.id].trim().length > 0).length;
        const completion = allQuestions.length > 0 ? Math.round((answeredCount / allQuestions.length) * 100) : 100;

        return {
            list: allQuestions,
            answeredCount,
            totalQuestions: allQuestions.length,
            completion,
        };
    }, [enhancementAnalysis, refinementAnswers]);

    const strategicRecommendationData = useMemo(() => {
        type StrategicRecommendation = {
            cardTitle: string;
            recommendation: string;
            targetField?: string;
            actionType?: string;
            why?: string;
        };

        if (!enhancementAnalysis) {
            return {
                list: [] as StrategicRecommendation[],
                total: 0,
            };
        }

        const recs: StrategicRecommendation[] = [];
        enhancementAnalysis.cardAnalysis.forEach((card: any) => {
            if (card.strategicRecommendations && Array.isArray(card.strategicRecommendations)) {
                card.strategicRecommendations.forEach((rec: any) => {
                    recs.push({
                        cardTitle: card.cardTitle,
                        recommendation: typeof rec === "string" ? rec : rec.recommendation,
                        targetField: rec?.targetField,
                        actionType: rec?.actionType,
                        why: rec?.why,
                    });
                });
            }
        });

        return {
            list: recs,
            total: recs.length,
        };
    }, [enhancementAnalysis]);

    const overallCompletion = useMemo(
        () => Math.round((missingFieldData.completion + refinementQuestionData.completion) / 2),
        [missingFieldData.completion, refinementQuestionData.completion]
    );

    const renderMissingFieldsSection = () => {
        if (missingFieldData.totalMissing === 0) {
            return (
                <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <Target size={20} className="text-[var(--primary)]" />
                            Missing Fields
                        </h3>
                        <span className="text-sm text-green-500 font-medium flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            Complete
                        </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        You have already provided all required fields.
                    </p>
                </div>
            );
        }

        const contextLookup =
            enhancementAnalysis?.cardAnalysis
                ?.flatMap((c: any) => c.missingContexts || [])
                ?.reduce((acc: Record<string, any>, ctx: any) => {
                    acc[ctx.fieldId] = ctx;
                    return acc;
                }, {}) || {};

        return (
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Target size={20} className="text-[var(--primary)]" />
                        Missing Fields ({missingFieldData.filledCount}/{missingFieldData.totalMissing})
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 w-32 rounded-full h-2 bg-[var(--border-color)]">
                            <div
                                className="h-2 rounded-full transition-all duration-300 bg-[var(--accent)] dark:bg-[var(--primary-light)]"
                                style={{ width: `${missingFieldData.completion}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium text-[var(--text-secondary)] min-w-[3rem] text-right">
                            {missingFieldData.completion}%
                        </span>
                    </div>
                </div>
                <div className="space-y-4">
                    {missingFieldData.list.map((win, idx) => {
                        const ctx = contextLookup[win.field];
                        const fieldType: "text" | "textarea" | "file" = ctx?.fieldType || (win.action === "upload" ? "file" : "textarea");
                        const label = ctx?.name || win.label || win.field;
                        const helpText = ctx?.helpText;
                        const placeholder = ctx?.placeholder;
                        const accept = ctx?.accept || "*/*";
                        const maxSize = ctx?.maxSize;
                        const isFilled =
                            fieldType === "file"
                                ? enhancementFiles[win.field] && enhancementFiles[win.field].length > 0
                                : enhancementFormData[win.field] && enhancementFormData[win.field].trim().length > 0;

                        return (
                            <div key={`${win.field}-${idx}`} className="space-y-2">
                                <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                    {label}
                                    {isFilled && <CheckCircle2 size={14} className="text-green-500" />}
                                </label>
                                {helpText && (
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        {helpText}
                                    </p>
                                )}
                                {fieldType === "textarea" && (
                                    <textarea
                                        value={enhancementFormData[win.field] || ""}
                                        onChange={(e) =>
                                            setEnhancementFormData((prev) => ({
                                                ...prev,
                                                [win.field]: e.target.value,
                                            }))
                                        }
                                        placeholder={placeholder || ""}
                                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--primary)] min-h-[100px]"
                                        rows={4}
                                    />
                                )}
                                {fieldType === "text" && (
                                    <input
                                        type="text"
                                        value={enhancementFormData[win.field] || ""}
                                        onChange={(e) =>
                                            setEnhancementFormData((prev) => ({
                                                ...prev,
                                                [win.field]: e.target.value,
                                            }))
                                        }
                                        placeholder={placeholder || ""}
                                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
                                    />
                                )}
                                {fieldType === "file" && (
                                    <div>
                                        <div
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEnhancementDragOver((prev) => ({ ...prev, [win.field]: true }));
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEnhancementDragOver((prev) => ({ ...prev, [win.field]: false }));
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEnhancementDragOver((prev) => ({ ...prev, [win.field]: false }));
                                                const droppedFiles = Array.from(e.dataTransfer.files);
                                                if (droppedFiles.length > 0) {
                                                    const currentFiles = enhancementFiles[win.field] || [];
                                                    setEnhancementFiles((prev) => ({
                                                        ...prev,
                                                        [win.field]: [...currentFiles, ...droppedFiles],
                                                    }));
                                                }
                                            }}
                                            className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${enhancementDragOver[win.field]
                                                ? "border-[var(--primary)] bg-[var(--primary)]/5 dark:border-[var(--accent)] dark:bg-[var(--accent)]/5"
                                                : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--primary)]/50 dark:hover:border-[var(--accent)]/50"
                                                }`}
                                        >
                                            <input
                                                type="file"
                                                accept={accept}
                                                onChange={(e) => {
                                                    const files = e.target.files;
                                                    if (files && files.length > 0) {
                                                        const currentFiles = enhancementFiles[win.field] || [];
                                                        setEnhancementFiles((prev) => ({
                                                            ...prev,
                                                            [win.field]: [...currentFiles, ...Array.from(files)],
                                                        }));
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <svg
                                                    className="w-10 h-10 mb-3 text-[var(--text-secondary)]"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                    />
                                                </svg>
                                                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                                    {enhancementDragOver[win.field] ? "Drop files here" : "Drag and drop files here"}
                                                </p>
                                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                                    or click to browse
                                                </p>
                                                {accept && accept !== "*/*" && (
                                                    <p className="text-xs text-[var(--text-secondary)]">
                                                        Accepted: {accept.toUpperCase()}
                                                    </p>
                                                )}
                                                {maxSize && (
                                                    <p className="text-xs text-[var(--text-secondary)]">
                                                        Max: {maxSize}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {enhancementFiles[win.field] && enhancementFiles[win.field].length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {enhancementFiles[win.field].map((file, fileIdx) => (
                                                    <div
                                                        key={`${file.name}-${fileIdx}`}
                                                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]"
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <svg
                                                                className="w-4 h-4 flex-shrink-0 text-[var(--text-secondary)]"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                                />
                                                            </svg>
                                                            <span className="truncate flex-1">
                                                                {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const currentFiles = enhancementFiles[win.field] || [];
                                                                const newFiles = currentFiles.filter((_, i) => i !== fileIdx);
                                                                if (newFiles.length === 0) {
                                                                    setEnhancementFiles((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated[win.field];
                                                                        return updated;
                                                                    });
                                                                } else {
                                                                    setEnhancementFiles((prev) => ({
                                                                        ...prev,
                                                                        [win.field]: newFiles,
                                                                    }));
                                                                }
                                                            }}
                                                            className="ml-4 text-xs font-medium hover:underline text-red-500 dark:text-red-400 flex-shrink-0"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {enhancementFileErrors[win.field] && (
                                            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                {enhancementFileErrors[win.field]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderContextInput = (context: {
        name?: string;
        fieldType?: "text" | "textarea" | "file";
        fieldId?: string;
        placeholder?: string;
        helpText?: string;
        accept?: string;
        maxSize?: string;
    }) => {
        const fieldKey = context.fieldId || context.name || "field";
        const fieldType = context.fieldType || "text";
        const label = context.name || fieldKey;
        const isFilled =
            fieldType === "file"
                ? enhancementFiles[fieldKey] && enhancementFiles[fieldKey].length > 0
                : enhancementFormData[fieldKey] && enhancementFormData[fieldKey].trim().length > 0;

        return (
            <div key={fieldKey} className="space-y-2">
                <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                    {label}
                    {isFilled && <CheckCircle2 size={14} className="text-green-500" />}
                </label>
                {context.helpText && (
                    <p className="text-xs text-[var(--text-secondary)]">
                        {context.helpText}
                    </p>
                )}
                {fieldType === "textarea" && (
                    <textarea
                        value={enhancementFormData[fieldKey] || ""}
                        onChange={(e) =>
                            setEnhancementFormData((prev) => ({
                                ...prev,
                                [fieldKey]: e.target.value,
                            }))
                        }
                        placeholder={context.placeholder || ""}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--primary)] min-h-[100px]"
                        rows={4}
                    />
                )}
                {fieldType === "text" && (
                    <input
                        type="text"
                        value={enhancementFormData[fieldKey] || ""}
                        onChange={(e) =>
                            setEnhancementFormData((prev) => ({
                                ...prev,
                                [fieldKey]: e.target.value,
                            }))
                        }
                        placeholder={context.placeholder || ""}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
                    />
                )}
                {fieldType === "file" && (
                    <div>
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEnhancementDragOver((prev) => ({ ...prev, [fieldKey]: true }));
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEnhancementDragOver((prev) => ({ ...prev, [fieldKey]: false }));
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEnhancementDragOver((prev) => ({ ...prev, [fieldKey]: false }));
                                const droppedFiles = Array.from(e.dataTransfer.files);
                                if (droppedFiles.length > 0) {
                                    const currentFiles = enhancementFiles[fieldKey] || [];
                                    setEnhancementFiles((prev) => ({
                                        ...prev,
                                        [fieldKey]: [...currentFiles, ...droppedFiles],
                                    }));
                                }
                            }}
                            className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${enhancementDragOver[fieldKey]
                                ? "border-[var(--primary)] bg-[var(--primary)]/5 dark:border-[var(--accent)] dark:bg-[var(--accent)]/5"
                                : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--primary)]/50 dark:hover:border-[var(--accent)]/50"
                                }`}
                        >
                            <input
                                type="file"
                                accept={context.accept || "*/*"}
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (files && files.length > 0) {
                                        const currentFiles = enhancementFiles[fieldKey] || [];
                                        setEnhancementFiles((prev) => ({
                                            ...prev,
                                            [fieldKey]: [...currentFiles, ...Array.from(files)],
                                        }));
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center text-center">
                                <svg
                                    className="w-10 h-10 mb-3 text-[var(--text-secondary)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                    />
                                </svg>
                                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                    {enhancementDragOver[fieldKey] ? "Drop files here" : "Drag and drop files here"}
                                </p>
                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                    or click to browse
                                </p>
                                {context.accept && context.accept !== "*/*" && (
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Accepted: {context.accept.toUpperCase()}
                                    </p>
                                )}
                                {context.maxSize && (
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Max: {context.maxSize}
                                    </p>
                                )}
                            </div>
                        </div>
                        {enhancementFiles[fieldKey] && enhancementFiles[fieldKey].length > 0 && (
                            <div className="mt-3 space-y-2">
                                {enhancementFiles[fieldKey].map((file, fileIdx) => (
                                    <div
                                        key={`${file.name}-${fileIdx}`}
                                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <svg
                                                className="w-4 h-4 flex-shrink-0 text-[var(--text-secondary)]"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                            <span className="truncate flex-1">
                                                {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentFiles = enhancementFiles[fieldKey] || [];
                                                const newFiles = currentFiles.filter((_, i) => i !== fileIdx);
                                                if (newFiles.length === 0) {
                                                    setEnhancementFiles((prev) => {
                                                        const updated = { ...prev };
                                                        delete updated[fieldKey];
                                                        return updated;
                                                    });
                                                } else {
                                                    setEnhancementFiles((prev) => ({
                                                        ...prev,
                                                        [fieldKey]: newFiles,
                                                    }));
                                                }
                                            }}
                                            className="ml-4 text-xs font-medium hover:underline text-red-500 dark:text-red-400 flex-shrink-0"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {enhancementFileErrors[fieldKey] && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                {enhancementFileErrors[fieldKey]}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderRefinementQuestionsSection = () => {
        if (refinementQuestionData.totalQuestions === 0) {
            return (
                <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <Sparkles size={20} className="text-[var(--primary)]" />
                            Refinement Questions
                        </h3>
                        <span className="text-sm text-green-500 font-medium flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            None required
                        </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        There are no refinement questions for this analysis.
                    </p>
                </div>
            );
        }

        return (
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Sparkles size={20} className="text-[var(--primary)]" />
                        Refinement Questions ({refinementQuestionData.answeredCount}/{refinementQuestionData.totalQuestions})
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 w-32 rounded-full h-2 bg-[var(--border-color)]">
                            <div
                                className="h-2 rounded-full transition-all duration-300 bg-[var(--primary)]"
                                style={{ width: `${refinementQuestionData.completion}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium text-[var(--text-secondary)] min-w-[3rem] text-right">
                            {refinementQuestionData.completion}%
                        </span>
                    </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Answer these questions to help the AI better understand your business nuances and improve card accuracy.
                </p>
                <div className="space-y-6">
                    {refinementQuestionData.list.map((q, idx) => (
                        <div
                            key={q.id}
                            className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)]"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--hover-bg)] px-2 py-0.5 rounded">
                                            {q.cardTitle}
                                        </span>
                                        <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded ${q.priority === "high"
                                                ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                                : q.priority === "medium"
                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                                }`}
                                        >
                                            {q.priority}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                        {q.question}
                                    </p>
                                    {q.helpText && (
                                        <p className="text-xs text-[var(--text-secondary)] mb-2">
                                            💡 {q.helpText}
                                        </p>
                                    )}
                                </div>
                                {refinementAnswers[q.id] && refinementAnswers[q.id].trim().length > 0 && (
                                    <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-1" />
                                )}
                            </div>
                            {q.fieldType === "textarea" ? (
                                <textarea
                                    value={refinementAnswers[q.id] || ""}
                                    onChange={(e) =>
                                        setRefinementAnswers((prev) => ({
                                            ...prev,
                                            [q.id]: e.target.value,
                                        }))
                                    }
                                    placeholder={q.placeholder || ""}
                                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--primary)] min-h-[100px]"
                                    rows={4}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={refinementAnswers[q.id] || ""}
                                    onChange={(e) =>
                                        setRefinementAnswers((prev) => ({
                                            ...prev,
                                            [q.id]: e.target.value,
                                        }))
                                    }
                                    placeholder={q.placeholder || ""}
                                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderStrategicRecommendationsSection = () => {
        if (strategicRecommendationData.total === 0) {
            return (
                <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <CheckCircle size={20} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                            Strategic Recommendations
                        </h3>
                        <span className="text-sm text-green-500 font-medium flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            None required
                        </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        No strategic recommendations for this analysis.
                    </p>
                </div>
            );
        }

        // Get field configs for lookup
        const getFieldConfig = (fieldId: string) => {
            for (const section of businessBrainFormConfig.sections) {
                const field = section.fields.find((f: any) => f.id === fieldId);
                if (field) return field;
            }
            return null;
        };

        const actionableRecs = strategicRecommendationData.list.filter(
            (rec) => rec.actionType === "fill_form" || rec.actionType === "upload"
        );
        const externalRecs = strategicRecommendationData.list.filter(
            (rec) => rec.actionType === "external"
        );

        return (
            <div className="space-y-4">
                {actionableRecs.length > 0 && (
                    <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                <CheckCircle size={20} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                Actionable Recommendations ({actionableRecs.length})
                            </h3>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Fill out these fields to improve your business brain:
                        </p>
                        <div className="space-y-4">
                            {actionableRecs.map((rec, idx) => {
                                if (!rec.targetField) return null;

                                const fieldConfig = getFieldConfig(rec.targetField);
                                const fieldType = fieldConfig?.type || (rec.actionType === "upload" ? "file" : "textarea");
                                const isFilled =
                                    fieldType === "file"
                                        ? enhancementFiles[rec.targetField] && enhancementFiles[rec.targetField].length > 0
                                        : enhancementFormData[rec.targetField] && enhancementFormData[rec.targetField].trim().length > 0;

                                return (
                                    <div
                                        key={`${rec.cardTitle}-${idx}`}
                                        className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)] space-y-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--hover-bg)] px-2 py-0.5 rounded">
                                                        {rec.cardTitle}
                                                    </span>
                                                    {isFilled && <CheckCircle2 size={14} className="text-green-500" />}
                                                </div>
                                                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                                    {rec.recommendation}
                                                </p>
                                                {rec.why && (
                                                    <p className="text-xs text-[var(--text-secondary)]">
                                                        💡 {rec.why}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {fieldType === "file" ? (
                                            <div>
                                                <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                                                    {fieldConfig?.label || rec.targetField}
                                                </label>
                                                <div
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setEnhancementDragOver((prev) => ({ ...prev, [rec.targetField!]: true }));
                                                    }}
                                                    onDragLeave={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setEnhancementDragOver((prev) => ({ ...prev, [rec.targetField!]: false }));
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setEnhancementDragOver((prev) => ({ ...prev, [rec.targetField!]: false }));
                                                        const droppedFiles = Array.from(e.dataTransfer.files);
                                                        if (droppedFiles.length > 0) {
                                                            const currentFiles = enhancementFiles[rec.targetField!] || [];
                                                            setEnhancementFiles((prev) => ({
                                                                ...prev,
                                                                [rec.targetField!]: [...currentFiles, ...droppedFiles],
                                                            }));
                                                        }
                                                    }}
                                                    className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${enhancementDragOver[rec.targetField!]
                                                        ? "border-[var(--primary)] bg-[var(--primary)]/5 dark:border-[var(--accent)] dark:bg-[var(--accent)]/5"
                                                        : "border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--primary)]/50 dark:hover:border-[var(--accent)]/50"
                                                        }`}
                                                >
                                                    <input
                                                        type="file"
                                                        accept={fieldConfig?.fileConfig?.allowedExtensions?.join(",") || "*/*"}
                                                        onChange={(e) => {
                                                            const files = e.target.files;
                                                            if (files && files.length > 0) {
                                                                const currentFiles = enhancementFiles[rec.targetField!] || [];
                                                                setEnhancementFiles((prev) => ({
                                                                    ...prev,
                                                                    [rec.targetField!]: [...currentFiles, ...Array.from(files)],
                                                                }));
                                                            }
                                                        }}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                    <div className="flex flex-col items-center justify-center text-center">
                                                        <Upload size={24} className="mb-2 text-[var(--text-secondary)]" />
                                                        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                                            {enhancementDragOver[rec.targetField!] ? "Drop files here" : "Drag and drop files here"}
                                                        </p>
                                                        <p className="text-xs text-[var(--text-secondary)]">
                                                            or click to browse
                                                        </p>
                                                    </div>
                                                </div>
                                                {enhancementFiles[rec.targetField!] && enhancementFiles[rec.targetField!].length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        {enhancementFiles[rec.targetField!].map((file, fileIdx) => (
                                                            <div
                                                                key={`${file.name}-${fileIdx}`}
                                                                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]"
                                                            >
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <FileText size={14} className="text-[var(--text-secondary)] flex-shrink-0" />
                                                                    <span className="truncate flex-1">
                                                                        {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const currentFiles = enhancementFiles[rec.targetField!] || [];
                                                                        const newFiles = currentFiles.filter((_, i) => i !== fileIdx);
                                                                        if (newFiles.length === 0) {
                                                                            setEnhancementFiles((prev) => {
                                                                                const updated = { ...prev };
                                                                                delete updated[rec.targetField!];
                                                                                return updated;
                                                                            });
                                                                        } else {
                                                                            setEnhancementFiles((prev) => ({
                                                                                ...prev,
                                                                                [rec.targetField!]: newFiles,
                                                                            }));
                                                                        }
                                                                    }}
                                                                    className="ml-4 text-xs font-medium hover:underline text-red-500 dark:text-red-400 flex-shrink-0"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                                                    {fieldConfig?.label || rec.targetField}
                                                </label>
                                                {fieldType === "textarea" ? (
                                                    <textarea
                                                        value={enhancementFormData[rec.targetField] || ""}
                                                        onChange={(e) =>
                                                            setEnhancementFormData((prev) => ({
                                                                ...prev,
                                                                [rec.targetField!]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={fieldConfig?.placeholder || rec.recommendation}
                                                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--primary)] min-h-[100px]"
                                                        rows={4}
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={enhancementFormData[rec.targetField] || ""}
                                                        onChange={(e) =>
                                                            setEnhancementFormData((prev) => ({
                                                                ...prev,
                                                                [rec.targetField!]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={fieldConfig?.placeholder || rec.recommendation}
                                                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {externalRecs.length > 0 && (
                    <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                <Zap size={20} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                External Actions ({externalRecs.length})
                            </h3>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">
                            These recommendations require actions outside of this form:
                        </p>
                        <div className="space-y-3">
                            {externalRecs.map((rec, idx) => (
                                <div
                                    key={`external-${idx}`}
                                    className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--hover-bg)] px-2 py-0.5 rounded">
                                                    {rec.cardTitle}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-[var(--text-primary)]">
                                                {rec.recommendation}
                                            </p>
                                            {rec.why && (
                                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                    💡 {rec.why}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const getCurrentGreeting = () => {
        if (!user) return "Welcome";
        const hour = new Date().getHours();
        if (hour < 12) return `Good morning, ${user.firstname}`;
        if (hour < 18) return `Good afternoon, ${user.firstname}`;
        return `Good evening, ${user.firstname}`;
    };

    const loadConversations = async () => {
        if (!businessBrainId) return;

        setIsLoadingConversations(true);
        try {
            const response = await fetch(
                `/api/business-brain/${businessBrainId}/conversation?list=true`
            );
            const result = await response.json();

            if (result.success && result.conversations) {
                setConversations(result.conversations);
            }
        } catch (error) {
            console.error("Error loading conversations:", error);
        } finally {
            setIsLoadingConversations(false);
        }
    };

    const loadConversation = async (conversationId: string) => {
        if (!businessBrainId) return;

        try {
            const response = await fetch(
                `/api/business-brain/${businessBrainId}/conversation?conversationId=${conversationId}`
            );
            const result = await response.json();

            if (result.success && result.conversation) {
                const conv = result.conversation;
                setCurrentConversationId(conv.id);

                // Convert database messages to ChatMessage format
                const messages: ChatMessage[] = conv.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                    timestamp: new Date(msg.createdAt),
                    citations: msg.citations || [],
                    confidence: msg.confidence || undefined,
                }));

                setChatMessages(messages);
            }
        } catch (error) {
            console.error("Error loading conversation:", error);
        }
    };

    const startNewConversation = () => {
        setCurrentConversationId(null);
        setChatMessages([]);
        setInputValue("");
    };

    useEffect(() => {
        const loadBusinessBrain = async () => {
            if (!user || !businessBrainId) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/business-brain/${businessBrainId}`);
                const result = await response.json();

                if (result.success) {
                    if (result.businessBrain && result.cards && result.cards.length > 0) {
                        setCards(result.cards);
                        setBusinessBrainData({
                            intakeData: result.businessBrain.intakeData,
                            fileUploads: result.businessBrain.fileUploads,
                        });
                        setStatus("cards_ready");
                        setCurrentConversationId(null);
                        setChatMessages([]);
                    } else if (result.businessBrain) {
                        setBusinessBrainData({
                            intakeData: result.businessBrain.intakeData,
                            fileUploads: result.businessBrain.fileUploads,
                        });
                        setStatus("idle");
                    } else {
                        setStatus("idle");
                    }
                } else {
                    console.error("Failed to load business brain:", result.error);
                    setError(result.error || "Failed to load business brain");
                    setStatus("error");
                }
            } catch (error) {
                console.error("Error loading business brain:", error);
                setError("Failed to load business brain");
                setStatus("error");
            } finally {
                setIsLoading(false);
            }
        };

        loadBusinessBrain();
    }, [user, businessBrainId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    useEffect(() => {
        if (!user || !businessBrainId) return;
        loadConversations();
    }, [user, businessBrainId]);

    useEffect(() => {
        if (!isConversationSidebarOpen || !user || !businessBrainId) return;
        loadConversations();
    }, [isConversationSidebarOpen, user, businessBrainId]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isSending || !businessBrainId) return;

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
                    `/api/business-brain/${businessBrainId}/conversation`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: userMessage.content.substring(0, 50) }),
                    }
                );

                if (!convResponse.ok) {
                    throw new Error("Failed to create conversation");
                }

                const convResult = await convResponse.json();
                conversationId = convResult.conversation.id;
                setCurrentConversationId(conversationId);
            }
            const messageResponse = await fetch(
                `/api/business-brain/${businessBrainId}/conversation/${conversationId}/message`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: userMessage.content }),
                }
            );

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

            // Refresh conversations list to update last message time
            loadConversations();

        } catch (error) {
            console.error("Error sending message:", error);
            let errorContent = "Sorry, I encountered an error while processing your message.";

            if (error instanceof Error) {
                // Check for connection pool timeout errors
                if (error.message.includes("connection pool") || error.message.includes("Timed out fetching")) {
                    errorContent = "The database is currently busy. Please try again in a moment.";
                } else {
                    errorContent = `Sorry, I encountered an error: ${error.message}`;
                }
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

    const toggleCard = (cardId: string) => {
        setExpandedCards((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(cardId)) {
                newSet.delete(cardId);
            } else {
                newSet.add(cardId);
            }
            return newSet;
        });
    };

    const getCardIcon = (type: string) => {
        switch (type) {
            case "BRAND_VOICE_CARD":
                return Palette;
            case "POSITIONING_CARD":
                return Target;
            case "STYLE_RULES":
                return FileText;
            case "COMPLIANCE_RULES":
                return Shield;
            case "GHL_IMPLEMENTATION_NOTES":
                return Settings;
            default:
                return Brain;
        }
    };

    const renderCardDetails = (card: BusinessCard) => {
        const isExpanded = expandedCards.has(card.id);
        const Icon = getCardIcon(card.type);

        return (
            <div
                key={card.id}
                className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] mb-3"
            >
                <button
                    onClick={() => toggleCard(card.id)}
                    className="w-full flex items-center justify-between text-left"
                >
                    <div className="flex items-center gap-3 flex-1">
                        <Icon size={20} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                {card.title}
                            </h4>
                            {card.confidence_score !== undefined && (
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    Confidence: {card.confidence_score}%
                                </p>
                            )}
                        </div>
                    </div>
                    {isExpanded ? (
                        <ChevronUp size={18} className="text-[var(--text-secondary)]" />
                    ) : (
                        <ChevronDown size={18} className="text-[var(--text-secondary)]" />
                    )}
                </button>
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <div
                                        className="text-sm text-[var(--text-secondary)]"
                                        dangerouslySetInnerHTML={{
                                            __html: card.description.replace(/\n/g, "<br />"),
                                        }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const filteredSlashCommands = slashCommands.filter((cmd) =>
        cmd.command.toLowerCase().includes(slashCommandFilter.toLowerCase()) ||
        cmd.description.toLowerCase().includes(slashCommandFilter.toLowerCase())
    );

    return (
        <>
            <Navbar />
            <div className="transition-all duration-300 ease-in-out h-screen flex flex-col overflow-hidden ml-[var(--sidebar-width,16rem)] bg-[var(--bg-color)]">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border-color)]">
                    <button
                        onClick={() => router.push("/dashboard/ai-business-brain")}
                        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Business Brains</span>
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold mb-1 text-[var(--primary)]">
                                AI Business Brain
                            </h1>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {businessBrainData?.intakeData?.businessName || "Chat with your AI business assistant"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                                className="p-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors"
                                title="View Cards"
                            >
                                <Brain size={20} className="text-[var(--text-primary)]" />
                            </button>
                            <button
                                onClick={async () => {
                                    setIsEnhanceModalOpen(true);
                                    setIsLoadingEnhancement(true);

                                    // Clear previous refinement answers
                                    setRefinementAnswers({});

                                    let latestIntakeData: any = null;
                                    try {
                                        // Always fetch the freshest business brain before analysis
                                        const latestBrainRes = await fetch(`/api/business-brain/${businessBrainId}`);
                                        if (latestBrainRes.ok) {
                                            const latest = await latestBrainRes.json();
                                            if (latest.success && latest.businessBrain) {
                                                setBusinessBrainData({
                                                    intakeData: latest.businessBrain.intakeData,
                                                    fileUploads: latest.businessBrain.fileUploads,
                                                });
                                                if (latest.cards) {
                                                    setCards(latest.cards);
                                                }
                                                latestIntakeData = latest.businessBrain.intakeData;
                                            }
                                        }

                                        const response = await fetch("/api/business-brain/calculate-completion", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ businessBrainId, forceRefresh: true }),
                                        });
                                        if (response.ok) {
                                            const result = await response.json();
                                            if (result.success && result.enhancementAnalysis) {
                                                setEnhancementAnalysis(result.enhancementAnalysis);
                                                setLastAnalyzedAt(result.lastAnalyzedAt || null);
                                                if (result.completionData) {
                                                    setCompletionData(result.completionData);
                                                }

                                                const intakeSource = latestIntakeData || businessBrainData?.intakeData || {};

                                                // Collect all strategic recommendation target fields to exclude from pre-population
                                                const strategicRecFields = new Set<string>();
                                                result.enhancementAnalysis.cardAnalysis.forEach((card: any) => {
                                                    if (card.strategicRecommendations && Array.isArray(card.strategicRecommendations)) {
                                                        card.strategicRecommendations.forEach((rec: any) => {
                                                            if (rec.targetField && (rec.actionType === "fill_form" || rec.actionType === "upload")) {
                                                                strategicRecFields.add(rec.targetField);
                                                            }
                                                        });
                                                    }
                                                });

                                                const existingData: Record<string, string> = {};
                                                Object.keys(intakeSource || {}).forEach((key) => {
                                                    const value = intakeSource[key];
                                                    // Exclude strategic recommendation fields from pre-population
                                                    if (value && typeof value === "string" && value.trim() && !strategicRecFields.has(key)) {
                                                        existingData[key] = value;
                                                    }
                                                });

                                                const initialFormData: Record<string, string> = { ...existingData };
                                                const initialRefinementAnswers: Record<string, string> = {};

                                                result.enhancementAnalysis.cardAnalysis.forEach((card: any) => {
                                                    if (card.missingContexts && Array.isArray(card.missingContexts)) {
                                                        card.missingContexts.forEach((context: any) => {
                                                            if (context.fieldType !== "file" && context.fieldId) {
                                                                // Don't pre-populate strategic recommendation fields
                                                                if (!strategicRecFields.has(context.fieldId)) {
                                                                    const existingValue = (intakeSource || {})[context.fieldId];
                                                                    if (existingValue && typeof existingValue === "string") {
                                                                        initialFormData[context.fieldId] = existingValue;
                                                                    } else if (!initialFormData[context.fieldId]) {
                                                                        initialFormData[context.fieldId] = "";
                                                                    }
                                                                } else if (!initialFormData[context.fieldId]) {
                                                                    // Strategic rec fields start empty
                                                                    initialFormData[context.fieldId] = "";
                                                                }
                                                            }
                                                        });
                                                    }
                                                    if (card.refinementQuestions && Array.isArray(card.refinementQuestions)) {
                                                        card.refinementQuestions.forEach((q: any) => {
                                                            if (q.id) {
                                                                // Check if this refinement question was already answered in intakeData
                                                                const existingAnswer = (intakeSource || {})[q.id];
                                                                if (existingAnswer && typeof existingAnswer === "string" && existingAnswer.trim().length > 0) {
                                                                    initialRefinementAnswers[q.id] = existingAnswer;
                                                                    console.log(`[Enhancement] Pre-populated refinement answer for ${q.id}`);
                                                                } else if (!initialRefinementAnswers[q.id]) {
                                                                    initialRefinementAnswers[q.id] = "";
                                                                }
                                                            }
                                                        });
                                                    }
                                                });
                                                setEnhancementFormData(initialFormData);
                                                setEnhancementFiles({});
                                                setRefinementAnswers(initialRefinementAnswers);
                                            }
                                        }
                                    } catch (error) {
                                        console.error("Error loading enhancement analysis:", error);
                                    } finally {
                                        setIsLoadingEnhancement(false);
                                    }
                                }}
                                className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors text-sm font-medium text-[var(--text-primary)] flex items-center gap-2"
                                title="Enhance Business Brain"
                            >
                                <Sparkles size={18} className="text-[var(--primary)]" />
                                <span>Enhance</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
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
                            <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                                Error
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
                            <button
                                onClick={() => router.push("/dashboard/ai-business-brain")}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white"
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Conversation History Sidebar */}
                        <AnimatePresence>
                            {isConversationSidebarOpen && (
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 300, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-color)] overflow-hidden"
                                >
                                    <div className="h-full flex flex-col">
                                        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                                            <h3 className="font-semibold text-[var(--text-primary)]">
                                                Conversations
                                            </h3>
                                            <button
                                                onClick={() => setIsConversationSidebarOpen(false)}
                                                className="p-1 rounded hover:bg-[var(--hover-bg)] transition-colors"
                                            >
                                                <X size={18} className="text-[var(--text-secondary)]" />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto">
                                            <button
                                                onClick={startNewConversation}
                                                className="w-full px-4 py-2 m-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors text-sm font-medium text-[var(--text-primary)] flex items-center gap-2"
                                            >
                                                <Plus size={16} />
                                                <span>New Conversation</span>
                                            </button>
                                            {isLoadingConversations ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <svg
                                                        className="animate-spin h-5 w-5 text-[var(--accent)]"
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
                                                </div>
                                            ) : conversations.length === 0 ? (
                                                <div className="px-4 py-8 text-center">
                                                    <p className="text-sm text-[var(--text-secondary)]">
                                                        No conversations yet
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="px-2 py-2">
                                                    {conversations.map((conv) => {
                                                        const isActive = currentConversationId === conv.id;
                                                        const lastMessageDate = new Date(conv.lastMessageAt);
                                                        const now = new Date();
                                                        const diffMs = now.getTime() - lastMessageDate.getTime();
                                                        const diffMins = Math.floor(diffMs / 60000);
                                                        const diffHours = Math.floor(diffMs / 3600000);
                                                        const diffDays = Math.floor(diffMs / 86400000);

                                                        let timeAgo = "";
                                                        if (diffMins < 1) timeAgo = "Just now";
                                                        else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
                                                        else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
                                                        else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
                                                        else timeAgo = lastMessageDate.toLocaleDateString();

                                                        return (
                                                            <button
                                                                key={conv.id}
                                                                onClick={() => loadConversation(conv.id)}
                                                                className={`w-full px-3 py-2 mb-1 rounded-lg text-left transition-colors ${isActive
                                                                    ? "bg-[var(--primary)]/10 border border-[var(--primary)]/20"
                                                                    : "hover:bg-[var(--hover-bg)]"
                                                                    }`}
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p
                                                                            className={`text-sm font-medium truncate ${isActive
                                                                                ? "text-[var(--primary)]"
                                                                                : "text-[var(--text-primary)]"
                                                                                }`}
                                                                        >
                                                                            {conv.title}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-xs text-[var(--text-secondary)]">
                                                                                {conv.messageCount} messages
                                                                            </span>
                                                                            <span className="text-xs text-[var(--text-secondary)]">
                                                                                •
                                                                            </span>
                                                                            <span className="text-xs text-[var(--text-secondary)]">
                                                                                {timeAgo}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 relative">
                                {!isConversationSidebarOpen && (
                                    <button
                                        onClick={() => setIsConversationSidebarOpen(true)}
                                        className="absolute left-2 top-4 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors z-10"
                                        title="Show Conversation History"
                                    >
                                        <ChevronRight size={18} className="text-[var(--text-secondary)]" />
                                    </button>
                                )}
                                {chatMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-4">
                                            <Bot size={48} className="text-[var(--accent)]" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                                            {getCurrentGreeting()}
                                        </h3>
                                        <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md">
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
                                                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                                                    }`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg p-4 ${message.role === "user"
                                                        ? "bg-[var(--primary)] text-white"
                                                        : "bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                                        }`}
                                                >
                                                    <div className={`prose prose-sm max-w-none ${message.role === "user" ? "prose-invert" : ""}`}>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                h1: ({ node, ...props }) => (
                                                                    <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0" {...props} />
                                                                ),
                                                                h2: ({ node, ...props }) => (
                                                                    <h2 className="text-lg font-semibold mb-2 mt-4 first:mt-0" {...props} />
                                                                ),
                                                                h3: ({ node, ...props }) => (
                                                                    <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0" {...props} />
                                                                ),
                                                                p: ({ node, ...props }) => (
                                                                    <p className="mb-3 leading-relaxed last:mb-0" {...props} />
                                                                ),
                                                                strong: ({ node, ...props }) => (
                                                                    <strong className="font-semibold" {...props} />
                                                                ),
                                                                ul: ({ node, ...props }) => (
                                                                    <ul className="mb-3 ml-4 list-disc space-y-1 last:mb-0" {...props} />
                                                                ),
                                                                ol: ({ node, ...props }) => (
                                                                    <ol className="mb-3 ml-4 list-decimal space-y-1 last:mb-0" {...props} />
                                                                ),
                                                                li: ({ node, ...props }) => (
                                                                    <li className="leading-relaxed" {...props} />
                                                                ),
                                                                hr: ({ node, ...props }) => (
                                                                    <hr className={`my-4 border-0 border-t ${message.role === "user"
                                                                        ? "border-white/20"
                                                                        : "border-[var(--border-color)]/30"}`} {...props} />
                                                                ),
                                                            }}
                                                        >
                                                            {message.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                    {message.citations && message.citations.length > 0 && (
                                                        <div className={`mt-4 pt-3 border-t ${message.role === "user"
                                                            ? "border-white/20"
                                                            : "border-[var(--border-color)]/50"}`}>
                                                            <p className={`text-xs ${message.role === "user" ? "opacity-80" : "text-[var(--text-secondary)]"}`}>Sources:</p>
                                                            <ul className={`text-xs mt-1 space-y-1 ${message.role === "user" ? "opacity-80" : "text-[var(--text-secondary)]"}`}>
                                                                {message.citations.map((cite: any, idx: number) => (
                                                                    <li key={idx}>
                                                                        • {typeof cite === "string"
                                                                            ? cite
                                                                            : cite.cardType
                                                                                ? `${cite.cardType.replace(/_/g, " ")} (${cite.confidence || "N/A"}% confidence)`
                                                                                : JSON.stringify(cite)}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {message.confidence !== undefined && (
                                                        <div className={`mt-4 pt-3 border-t ${message.role === "user"
                                                            ? "border-white/20"
                                                            : "border-[var(--border-color)]/50"}`}>
                                                            <p className={`text-xs ${message.role === "user" ? "opacity-80" : "text-[var(--text-secondary)]"}`}>
                                                                Confidence: {message.confidence}%
                                                            </p>
                                                        </div>
                                                    )}
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
                            <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]">
                                <div className="relative">
                                    {showSlashCommands && (
                                        <div
                                            ref={slashCommandsRef}
                                            className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg max-h-64 overflow-y-auto z-10"
                                        >
                                            <div className="p-2 border-b border-[var(--border-color)]">
                                                <input
                                                    type="text"
                                                    placeholder="Search commands..."
                                                    value={slashCommandFilter}
                                                    onChange={(e) => setSlashCommandFilter(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary)]"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="p-2">
                                                {filteredSlashCommands.map((cmd) => (
                                                    <button
                                                        key={cmd.command}
                                                        onClick={() => {
                                                            setInputValue(cmd.command);
                                                            setShowSlashCommands(false);
                                                            setSlashCommandFilter("");
                                                        }}
                                                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors text-left"
                                                    >
                                                        <cmd.icon
                                                            size={18}
                                                            className="text-[var(--primary)] flex-shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-[var(--text-primary)]">
                                                                {cmd.command}
                                                            </div>
                                                            <div className="text-xs text-[var(--text-secondary)]">
                                                                {cmd.description}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-end gap-2">
                                        <textarea
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
                                            className="flex-1 px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--primary)] min-h-[52px] max-h-32"
                                            rows={1}
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!inputValue.trim() || isSending}
                                            className="p-3 rounded-lg bg-[var(--primary)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cards Drawer */}
                        <AnimatePresence>
                            {isDrawerOpen && (
                                <motion.div
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 400, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-color)] overflow-hidden"
                                >
                                    <div className="h-full flex flex-col">
                                        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                                            <h3 className="font-semibold text-[var(--text-primary)]">
                                                Business Cards
                                            </h3>
                                            <button
                                                onClick={() => setIsDrawerOpen(false)}
                                                className="p-1 rounded hover:bg-[var(--hover-bg)] transition-colors"
                                            >
                                                <X size={18} className="text-[var(--text-secondary)]" />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto px-4 py-4">
                                            {cards.length === 0 ? (
                                                <p className="text-sm text-[var(--text-secondary)] text-center">
                                                    No cards available
                                                </p>
                                            ) : (
                                                cards.map((card) => renderCardDetails(card))
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isEnhanceModalOpen}
                onClose={() => {
                    if (!isSavingEnhancement) {
                        setIsEnhanceModalOpen(false);
                        setEnhancementFormData({});
                        setEnhancementFiles({});
                    }
                }}
                title={
                    <div className="flex items-center justify-between w-full pr-8">
                        <span>Enhance Business Brain</span>
                        <div className="flex items-center gap-3">
                            {lastAnalyzedAt && (
                                <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(lastAnalyzedAt).toLocaleString()}
                                </span>
                            )}
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (isRefreshingAnalysis) return;
                                    setIsRefreshingAnalysis(true);
                                    try {
                                        // First, fetch latest business brain data to ensure we have fresh cards
                                        const brainResponse = await fetch(`/api/business-brain/${businessBrainId}`);
                                        if (brainResponse.ok) {
                                            const brainResult = await brainResponse.json();
                                            if (brainResult.success && brainResult.businessBrain) {
                                                setBusinessBrainData({
                                                    intakeData: brainResult.businessBrain.intakeData,
                                                    fileUploads: brainResult.businessBrain.fileUploads,
                                                });
                                                if (brainResult.cards) {
                                                    setCards(brainResult.cards);
                                                }
                                            }
                                        }

                                        // Then refresh the analysis with latest data
                                        const response = await fetch("/api/business-brain/calculate-completion", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ businessBrainId, forceRefresh: true }),
                                        });
                                        if (response.ok) {
                                            const result = await response.json();
                                            console.log(`[Refresh] Analysis refreshed - Score: ${result.completionData?.score || 0}%, Avg Confidence: ${result.enhancementAnalysis?.overallAnalysis?.averageConfidence || 0}%`);
                                            if (result.success && result.enhancementAnalysis) {
                                                setEnhancementAnalysis(result.enhancementAnalysis);
                                                setLastAnalyzedAt(result.lastAnalyzedAt || new Date().toISOString());
                                                if (result.completionData) {
                                                    setCompletionData(result.completionData);
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        console.error("[Refresh] Error refreshing analysis:", error);
                                    } finally {
                                        setIsRefreshingAnalysis(false);
                                    }
                                }}
                                disabled={isRefreshingAnalysis}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Refresh Analysis"
                            >
                                <RefreshCw size={14} className={isRefreshingAnalysis ? "animate-spin" : ""} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>
                }
                message=""
                body={
                    <div className="space-y-6">
                        {isLoadingEnhancement ? (
                            <div className="flex items-center justify-center py-8">
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
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Analyzing your business brain...
                                    </p>
                                </div>
                            </div>
                        ) : enhancementAnalysis ? (
                            <>
                                {/* Overall Analysis */}
                                <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                                    <h3 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                        <BarChart3 size={20} className="text-[var(--primary)]" />
                                        Overall Analysis
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-[var(--text-secondary)] mb-1">
                                                Average Confidence
                                            </p>
                                            <p className="text-2xl font-bold text-[var(--text-primary)]">
                                                {enhancementAnalysis.overallAnalysis.averageConfidence}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-[var(--text-secondary)] mb-1">
                                                Cards Below 80%
                                            </p>
                                            <p className="text-2xl font-bold text-[var(--text-primary)]">
                                                {enhancementAnalysis.overallAnalysis.cardsBelow80}/
                                                {enhancementAnalysis.overallAnalysis.totalCards}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-[var(--text-secondary)] mb-1">
                                                Total Cards
                                            </p>
                                            <p className="text-2xl font-bold text-[var(--text-primary)]">
                                                {enhancementAnalysis.overallAnalysis.totalCards}
                                            </p>
                                        </div>
                                    </div>
                                    {enhancementAnalysis.overallAnalysis.criticalMissingFields.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                                            <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                                                Critical Missing Fields:
                                            </p>
                                            <ul className="space-y-1">
                                                {enhancementAnalysis.overallAnalysis.criticalMissingFields.map(
                                                    (field: string, idx: number) => (
                                                        <li
                                                            key={idx}
                                                            className="text-sm text-[var(--text-secondary)] flex items-center gap-2"
                                                        >
                                                            <AlertCircle
                                                                size={16}
                                                                className="text-amber-500 flex-shrink-0"
                                                            />
                                                            {field}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Overview */}
                                <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                            <ClipboardCheck size={20} className="text-[var(--primary)]" />
                                            Progress Overview
                                        </h3>
                                        <span className="text-xs px-2 py-1 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)]">
                                            Step: {enhancementStep === "filling" ? "Saving new data" : enhancementStep === "regenerating" ? "Regenerating cards" : "Analyzing"}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-[var(--text-secondary)]">Overall completion</span>
                                                <span className="font-semibold text-[var(--text-primary)]">{overallCompletion}%</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-[var(--border-color)]">
                                                <div
                                                    className="h-2 rounded-full bg-[var(--accent)] dark:bg-[var(--primary-light)] transition-all duration-300"
                                                    style={{ width: `${overallCompletion}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)]">
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-[var(--text-secondary)]">Fields completion</span>
                                                    <span className="font-semibold text-[var(--text-primary)]">{missingFieldData.completion}%</span>
                                                </div>
                                                <div className="w-full h-2 rounded-full bg-[var(--border-color)]">
                                                    <div
                                                        className="h-2 rounded-full bg-[var(--primary)] transition-all duration-300"
                                                        style={{ width: `${missingFieldData.completion}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)]">
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-[var(--text-secondary)]">Questions completion</span>
                                                    <span className="font-semibold text-[var(--text-primary)]">{refinementQuestionData.completion}%</span>
                                                </div>
                                                <div className="w-full h-2 rounded-full bg-[var(--border-color)]">
                                                    <div
                                                        className="h-2 rounded-full bg-[var(--primary)] transition-all duration-300"
                                                        style={{ width: `${refinementQuestionData.completion}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs for actions */}
                                <div>
                                    <div className="flex items-center gap-4 mb-4 border-b border-[var(--border-color)]">
                                        {[
                                            { key: "missing", label: "Missing Fields" },
                                            { key: "refinement", label: "Refinement Questions" },
                                            { key: "strategic", label: "Strategic Recommendations" },
                                        ].map((tab) => (
                                            <div
                                                key={tab.key}
                                                onClick={() => setEnhancementTab(tab.key as "missing" | "refinement" | "strategic")}
                                                className={`relative pb-2 text-sm font-medium cursor-pointer transition-colors ${enhancementTab === tab.key
                                                    ? "text-[var(--primary)] dark:text-[var(--accent)]"
                                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                    }`}
                                            >
                                                {tab.label}
                                                <span
                                                    className={`absolute left-0 right-0 -bottom-[1px] h-[2px] ${enhancementTab === tab.key
                                                        ? "bg-[var(--primary)] dark:bg-[var(--accent)]"
                                                        : "bg-transparent"
                                                        }`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        {enhancementTab === "missing"
                                            ? renderMissingFieldsSection()
                                            : enhancementTab === "refinement"
                                                ? renderRefinementQuestionsSection()
                                                : renderStrategicRecommendationsSection()}
                                    </div>
                                </div>

                                {/* Card-by-Card Analysis */}
                                {enhancementTab === "missing" && (
                                    <div>
                                        <h3 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <ClipboardCheck size={20} className="text-[var(--primary)]" />
                                            Card Analysis
                                        </h3>
                                        <div className="space-y-4">
                                            {enhancementAnalysis.cardAnalysis.map((analysis: any) => {
                                                const quickWinFields = new Set(
                                                    (completionData?.quickWins || []).map((q: any) => q.field)
                                                );
                                                const filteredMissing =
                                                    (analysis.missingContexts || []).filter(
                                                        (ctx: any) => !quickWinFields.has(ctx.fieldId)
                                                    );
                                                return (
                                                    <div
                                                        key={analysis.cardId}
                                                        className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]"
                                                    >
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                                                                    {analysis.cardTitle}
                                                                </h4>
                                                                <p className="text-xs text-[var(--text-secondary)]">
                                                                    {analysis.cardType.replace(/_/g, " ")}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm text-[var(--text-secondary)]">
                                                                        Current:
                                                                    </span>
                                                                    <span
                                                                        className={`text-lg font-bold ${analysis.currentConfidence >= 80
                                                                            ? "text-green-500"
                                                                            : analysis.currentConfidence >= 60
                                                                                ? "text-amber-500"
                                                                                : "text-red-500"
                                                                            }`}
                                                                    >
                                                                        {analysis.currentConfidence}%
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-sm text-[var(--text-secondary)]">
                                                                        Target:
                                                                    </span>
                                                                    <span className="text-lg font-bold text-[var(--text-primary)]">
                                                                        {analysis.targetConfidence}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {analysis.currentConfidence < 80 && (
                                                            <>
                                                                {filteredMissing && filteredMissing.length > 0 && (
                                                                    <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                                                        <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
                                                                            <FileText size={16} />
                                                                            Missing context (Please fill out/upload a document to boost analysis)
                                                                        </p>
                                                                        <div className="space-y-3">
                                                                            {filteredMissing.map((ctx: any, i: number) => (
                                                                                <div key={`${analysis.cardId}-ctx-${i}`} className="p-2 rounded border border-[var(--border-color)] bg-[var(--card-bg)]">
                                                                                    {renderContextInput(ctx)}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {analysis.refinementQuestions && analysis.refinementQuestions.length > 0 && (
                                                                    <div className="mb-3">
                                                                        <p className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                                                            <Sparkles size={16} className="text-[var(--primary)]" />
                                                                            Refinement Questions ({analysis.refinementQuestions.length}):
                                                                        </p>
                                                                        <ul className="space-y-2 ml-6">
                                                                            {analysis.refinementQuestions.map((q: any, idx: number) => (
                                                                                <li key={q.id || idx} className="text-sm text-[var(--text-secondary)] list-disc">
                                                                                    {q.question}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                        <p className="text-xs text-[var(--text-secondary)] mt-2 italic">
                                                                            Answer these in the Refinement Questions tab.
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {analysis.strategicRecommendations && analysis.strategicRecommendations.length > 0 && (
                                                                    <div>
                                                                        <p className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                                                            <CheckCircle
                                                                                size={16}
                                                                                className="text-green-500"
                                                                            />
                                                                            Strategic Recommendations:
                                                                        </p>
                                                                        <ul className="space-y-1 ml-6">
                                                                            {analysis.strategicRecommendations.map(
                                                                                (rec: any, idx: number) => (
                                                                                    <li
                                                                                        key={idx}
                                                                                        className="text-sm text-[var(--text-secondary)] list-disc"
                                                                                    >
                                                                                        {typeof rec === "string" ? rec : rec.recommendation}
                                                                                    </li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    </div>
                                                                )}

                                                                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                                                                    <span
                                                                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${analysis.priority === "high"
                                                                            ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                                                            : analysis.priority === "medium"
                                                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                                                                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                                                            }`}
                                                                    >
                                                                        {analysis.priority === "high"
                                                                            ? "High Priority"
                                                                            : analysis.priority === "medium"
                                                                                ? "Medium Priority"
                                                                                : "Low Priority"}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}

                                                        {analysis.currentConfidence >= 80 && (
                                                            <div className="flex items-center gap-2 text-green-500">
                                                                <CheckCircle2 size={16} />
                                                                <span className="text-sm font-medium">
                                                                    This card meets the target confidence level
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[var(--text-secondary)]" />
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Unable to load enhancement analysis. Please try again.
                                </p>
                            </div>
                        )}
                    </div>
                }
                confirmText={
                    isSavingEnhancement ? (
                        <div className="flex items-center gap-2">
                            <svg
                                className="animate-spin h-4 w-4"
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
                            <span>Saving...</span>
                        </div>
                    ) : (
                        "Save & Regenerate"
                    )
                }
                cancelText="Cancel"
                maxWidth="4xl"
                isSubmitting={isSavingEnhancement}
                onConfirm={async () => {
                    if (isSavingEnhancement) return;

                    setIsSavingEnhancement(true);
                    setEnhancementStep("filling");

                    console.log("[Enhancement] Starting save & regenerate flow");
                    console.log("[Enhancement] Form data fields:", Object.keys(enhancementFormData).length);
                    console.log("[Enhancement] Refinement answers:", Object.keys(refinementAnswers).length);
                    console.log("[Enhancement] Files to upload:", Object.keys(enhancementFiles).length);

                    try {
                        // Step 1: Save the data first
                        const payload = new FormData();
                        // Merge refinement answers into intake_json
                        const mergedData = {
                            ...enhancementFormData,
                            ...refinementAnswers,
                        };
                        payload.append("intake_json", JSON.stringify(mergedData));
                        Object.entries(enhancementFiles).forEach(([fieldId, files]) => {
                            if (files && files.length > 0) {
                                files.forEach((file) => {
                                    payload.append(fieldId, file);
                                });
                            }
                        });

                        console.log("[Enhancement] Step 1: Updating business brain data...");
                        const updateResponse = await fetch(`/api/business-brain/${businessBrainId}/update`, {
                            method: "POST",
                            body: payload,
                        });

                        if (!updateResponse.ok) {
                            const errorData = await updateResponse.json();
                            throw new Error(errorData.error || "Failed to update business brain");
                        }

                        const updateResult = await updateResponse.json();
                        console.log("[Enhancement] Step 1: Update complete", updateResult.success);

                        // Step 2: Regenerate cards with new data (THIS updates confidence scores)
                        setEnhancementStep("regenerating");
                        console.log("[Enhancement] Step 2: Regenerating cards...");

                        const cardsResponse = await fetch(
                            `/api/business-brain/generate-cards?profileId=${businessBrainId}`,
                            { method: "POST" }
                        );

                        if (!cardsResponse.ok) {
                            const errorData = await cardsResponse.json();
                            throw new Error(errorData.error || "Failed to regenerate cards");
                        }

                        const cardsResult = await cardsResponse.json();
                        if (cardsResult.success && cardsResult.cards) {
                            console.log(`[Enhancement] Step 2: Cards regenerated with ${cardsResult.cards.length} cards`);
                            console.log(`[Enhancement] New confidence scores:`, cardsResult.cards.map((c: any) => `${c.title}: ${c.confidence_score || 0}%`).join(", "));
                            setCards(cardsResult.cards);
                        } else {
                            console.warn("[Enhancement] Step 2: Cards regeneration returned no cards");
                        }

                        // Step 3: Synthesize knowledge with new data
                        console.log("[Enhancement] Step 3: Synthesizing knowledge...");
                        const synthesizeResponse = await fetch(
                            `/api/business-brain/${businessBrainId}/synthesize-knowledge`,
                            { method: "POST" }
                        );

                        if (synthesizeResponse.ok) {
                            console.log("[Enhancement] Step 3: Knowledge synthesis complete");
                        } else {
                            console.warn("[Enhancement] Step 3: Knowledge synthesis failed (non-critical)");
                        }

                        // Step 4: Calculate completion with fresh data (AFTER cards are regenerated)
                        setEnhancementStep("analyzing");
                        console.log("[Enhancement] Step 4: Calculating completion with fresh data...");

                        // Small delay to ensure database is updated
                        await new Promise(resolve => setTimeout(resolve, 500));

                        const completionResponse = await fetch(
                            "/api/business-brain/calculate-completion",
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ businessBrainId, forceRefresh: true }),
                            }
                        );

                        if (completionResponse.ok) {
                            const completionResult = await completionResponse.json();
                            console.log(`[Enhancement] Step 4: Completion calculated - Score: ${completionResult.completionData?.score || 0}%`);
                            console.log(`[Enhancement] Average confidence: ${completionResult.enhancementAnalysis?.overallAnalysis?.averageConfidence || 0}%`);

                            if (completionResult.success && completionResult.enhancementAnalysis) {
                                setEnhancementAnalysis(completionResult.enhancementAnalysis);
                                if (completionResult.completionData) {
                                    setCompletionData(completionResult.completionData);
                                }
                                if (completionResult.lastAnalyzedAt) {
                                    setLastAnalyzedAt(completionResult.lastAnalyzedAt);
                                }
                            }
                        } else {
                            console.error("[Enhancement] Step 4: Completion calculation failed");
                            const errorData = await completionResponse.json();
                            throw new Error(errorData.error || "Failed to calculate completion");
                        }

                        // Step 5: Reload business brain data to get latest state
                        console.log("[Enhancement] Step 5: Reloading business brain data...");
                        const response = await fetch(`/api/business-brain/${businessBrainId}`);
                        const result = await response.json();
                        if (result.success) {
                            setBusinessBrainData({
                                intakeData: result.businessBrain.intakeData,
                                fileUploads: result.businessBrain.fileUploads,
                            });
                            if (result.cards) {
                                setCards(result.cards);
                            }
                            console.log("[Enhancement] Step 5: Business brain data reloaded");
                        }

                        // Clear form data
                        setEnhancementFormData({});
                        setEnhancementFiles({});
                        setRefinementAnswers({});

                        console.log("[Enhancement] Save & regenerate flow complete");
                    } catch (error) {
                        console.error("[Enhancement] Error in save & regenerate flow:", error);
                        alert(error instanceof Error ? error.message : "Failed to save enhancement");
                    } finally {
                        setIsSavingEnhancement(false);
                        setEnhancementStep("analyzing");
                    }
                }}
            />
        </>
    );
}
