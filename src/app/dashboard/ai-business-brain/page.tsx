"use client";

import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import Modal from "@/components/ui/Modal";
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { businessBrainFormConfig } from "@/components/forms/configs/businessBrainFormConfig";
import { useUser } from "@/context/UserContext";
import {
    Rocket, History, Brain, CheckCircle2, Upload, Sparkles,
    MessageSquare, Send, X, ChevronDown, ChevronUp, FileText,
    Target, Palette, Shield, Settings, RefreshCw, PencilLine, Bot
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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
};

export default function BusinessBrain() {
    const { user } = useUser();
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [status, setStatus] = useState<Status>("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const [businessBrainId, setBusinessBrainId] = useState<string | null>(null);
    const [businessBrainData, setBusinessBrainData] = useState<{ intakeData?: any; fileUploads?: any } | null>(null);
    const [cards, setCards] = useState<BusinessCard[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isprocessing, setIsProcessing] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Greeting based on time of day
    const getCurrentGreeting = () => {
        if (!user) return "Welcome";
        const hour = new Date().getHours();
        if (hour < 12) return `Good morning, ${user.firstname}`;
        if (hour < 18) return `Good afternoon, ${user.firstname}`;
        return `Good evening, ${user.firstname}`;
    };

    // Load most recent business brain and cards on mount
    useEffect(() => {
        const loadLatestBusinessBrain = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/business-brain/latest');
                const result = await response.json();

                if (result.success) {
                    if (result.businessBrain && result.cards && result.cards.length > 0) {
                        // Business brain exists with cards - show chat interface
                        setBusinessBrainId(result.businessBrain.id);
                        setCards(result.cards);
                        setBusinessBrainData({
                            intakeData: result.businessBrain.intakeData,
                            fileUploads: result.businessBrain.fileUploads,
                        });
                        setStatus("cards_ready");
                    } else {
                        // No business brain exists - show idle state
                        setStatus("idle");
                    }
                } else {
                    console.error('Failed to load business brain:', result.error);
                    setStatus("idle");
                }
            } catch (error) {
                console.error('Error loading business brain:', error);
                setStatus("idle");
            } finally {
                setIsLoading(false);
            }
        };

        loadLatestBusinessBrain();
    }, [user]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Toggle card expansion
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

    // Handle send message (UI only for now)
    const handleSendMessage = () => {
        if (!inputValue.trim() || isSending) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        setChatMessages((prev) => [...prev, newMessage]);
        setInputValue("");
        setIsSending(true);

        // Simulate AI response (will be replaced with actual API call later)
        setTimeout(() => {
            const aiResponse: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "I understand your question. The backend integration will be implemented next.",
                timestamp: new Date(),
            };
            setChatMessages((prev) => [...prev, aiResponse]);
            setIsSending(false);
        }, 1000);
    };

    // Handle regenerate cards
    const handleRegenerateCards = async () => {
        if (!businessBrainId) return;

        setStatus("generating_cards");
        setStatusMessage("Regenerating your business intelligence cards...");
        setIsDrawerOpen(false);

        try {
            const cardsResponse = await fetch(
                `/api/business-brain/generate-cards?profileId=${businessBrainId}`,
                {
                    method: 'POST',
                }
            );

            if (!cardsResponse.ok) {
                const errorData = await cardsResponse.json();
                throw new Error(errorData.error || 'Failed to regenerate cards');
            }

            const cardsResult = await cardsResponse.json();

            if (cardsResult.success && cardsResult.cards) {
                setCards(cardsResult.cards);

                // Synthesize knowledge base after regenerating cards
                if (businessBrainId) {
                    setStatusMessage("Synthesizing knowledge base...");

                    try {
                        const synthesizeResponse = await fetch(
                            `/api/business-brain/${businessBrainId}/synthesize-knowledge`,
                            {
                                method: 'POST',
                            }
                        );

                        if (!synthesizeResponse.ok) {
                            const errorData = await synthesizeResponse.json();
                            console.warn('Failed to synthesize knowledge base:', errorData.error);
                        } else {
                            const synthesizeResult = await synthesizeResponse.json();
                            console.log('Knowledge base synthesized:', synthesizeResult.success);
                        }
                    } catch (synthesizeError) {
                        console.warn('Error synthesizing knowledge base:', synthesizeError);
                    }
                }

                setStatus("cards_ready");
                setStatusMessage("");
            } else {
                throw new Error('No cards returned');
            }
        } catch (cardError) {
            console.error('Error regenerating cards:', cardError);
            setError(cardError instanceof Error ? cardError.message : 'Failed to regenerate cards');
            setStatus("error");
        }
    };

    // Get card icon
    const getCardIcon = (cardType: string) => {
        switch (cardType) {
            case "BRAND_VOICE_CARD":
                return <Palette className="w-5 h-5 text-amber-500 dark:text-[var(--accent)]" />;
            case "POSITIONING_CARD":
                return <Target className="w-5 h-5 text-amber-500 dark:text-[var(--accent)]" />;
            case "STYLE_RULES":
                return <FileText className="w-5 h-5 text-amber-500 dark:text-[var(--accent)]" />;
            case "COMPLIANCE_RULES":
                return <Shield className="w-5 h-5 text-amber-500 dark:text-[var(--accent)]" />;
            case "GHL_IMPLEMENTATION_NOTES":
                return <Settings className="w-5 h-5 text-amber-500 dark:text-[var(--accent)]" />;
            default:
                return <FileText className="w-5 h-5 text-amber-500 dark:text-[var(--accent)]" />;
        }
    };

    // Render card metadata details based on card type
    const renderCardDetails = (card: BusinessCard) => {
        if (!card.metadata) return null;

        const metadata = card.metadata;

        switch (card.type) {
            case "BRAND_VOICE_CARD":
                if (metadata.rules && Array.isArray(metadata.rules)) {
                    return (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Voice Rules</h4>
                                <div className="space-y-3">
                                    {metadata.rules.map((rule: any, index: number) => (
                                        <div key={index} className="p-3 rounded-lg bg-[var(--hover-bg)] border border-[var(--border-color)]">
                                            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">{rule.rule}</p>
                                            {rule.example && (
                                                <p className="text-xs text-[var(--text-secondary)] italic mb-1">
                                                    Example: "{rule.example}"
                                                </p>
                                            )}
                                            {rule.justification && (
                                                <p className="text-xs text-[var(--text-secondary)]">
                                                    {rule.justification}
                                                </p>
                                            )}
                                            {rule.source && (
                                                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                                                    Source: {rule.source}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                }
                break;

            case "POSITIONING_CARD":
                if (metadata.framework_details) {
                    const details = metadata.framework_details;
                    return (
                        <div className="space-y-4">
                            {details.value_proposition && (
                                <div>
                                    <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Value Proposition</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">{details.value_proposition}</p>
                                </div>
                            )}
                            {details.target_audience && (
                                <div>
                                    <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Target Audience</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">{details.target_audience}</p>
                                </div>
                            )}
                            {details.market_position && (
                                <div>
                                    <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Market Position</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">{details.market_position}</p>
                                </div>
                            )}
                            {details.differentiation && (
                                <div>
                                    <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Differentiation</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">{details.differentiation}</p>
                                </div>
                            )}
                        </div>
                    );
                }
                break;

            case "STYLE_RULES":
                return (
                    <div className="space-y-4">
                        {metadata.rules && Array.isArray(metadata.rules) && metadata.rules.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Style Rules</h4>
                                <ul className="space-y-1">
                                    {metadata.rules.map((rule: string, index: number) => (
                                        <li key={index} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                            <span className="text-[var(--primary)] mt-0.5">•</span>
                                            <span>{rule}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {metadata.forbidden && Array.isArray(metadata.forbidden) && metadata.forbidden.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Forbidden Phrases</h4>
                                <div className="flex flex-wrap gap-2">
                                    {metadata.forbidden.map((phrase: string, index: number) => (
                                        <span key={index} className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                            {phrase}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {metadata.preferred && Array.isArray(metadata.preferred) && metadata.preferred.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Preferred Alternatives</h4>
                                <div className="flex flex-wrap gap-2">
                                    {metadata.preferred.map((phrase: string, index: number) => (
                                        <span key={index} className="px-2 py-1 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/20">
                                            {phrase}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {metadata.examples && Array.isArray(metadata.examples) && metadata.examples.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Examples</h4>
                                <div className="space-y-2">
                                    {metadata.examples.map((example: string, index: number) => (
                                        <p key={index} className="text-xs text-[var(--text-secondary)] p-2 rounded bg-[var(--hover-bg)]">
                                            {example}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case "COMPLIANCE_RULES":
                return (
                    <div className="space-y-4">
                        {metadata.risk_areas && Array.isArray(metadata.risk_areas) && metadata.risk_areas.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Risk Areas</h4>
                                <ul className="space-y-1">
                                    {metadata.risk_areas.map((risk: string, index: number) => (
                                        <li key={index} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                            <span className="text-red-400 mt-0.5">⚠</span>
                                            <span>{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {metadata.forbidden_claims && Array.isArray(metadata.forbidden_claims) && metadata.forbidden_claims.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Forbidden Claims</h4>
                                <div className="flex flex-wrap gap-2">
                                    {metadata.forbidden_claims.map((claim: string, index: number) => (
                                        <span key={index} className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                            {claim}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {metadata.required_disclaimers && Array.isArray(metadata.required_disclaimers) && metadata.required_disclaimers.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Required Disclaimers</h4>
                                <div className="space-y-2">
                                    {metadata.required_disclaimers.map((disclaimer: string, index: number) => (
                                        <p key={index} className="text-xs text-[var(--text-secondary)] p-2 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                                            {disclaimer}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                        {metadata.legal_terms && typeof metadata.legal_terms === 'object' && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Legal Terms</h4>
                                <div className="space-y-2">
                                    {Object.entries(metadata.legal_terms).map(([term, definition]: [string, any]) => (
                                        <div key={term} className="p-2 rounded bg-[var(--hover-bg)]">
                                            <span className="text-xs font-medium text-[var(--text-primary)]">{term}:</span>
                                            <span className="text-xs text-[var(--text-secondary)] ml-2">{definition}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case "GHL_IMPLEMENTATION_NOTES":
                return (
                    <div className="space-y-4">
                        {metadata.pipelines && Array.isArray(metadata.pipelines) && metadata.pipelines.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Pipeline Configuration</h4>
                                <ul className="space-y-2">
                                    {metadata.pipelines.map((pipeline: any, index: number) => (
                                        <li key={index} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                            <span className="text-[var(--primary)] mt-0.5">→</span>
                                            <div className="flex-1">
                                                {typeof pipeline === 'string' ? (
                                                    <span>{pipeline}</span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {pipeline.name && (
                                                            <p className="font-medium text-[var(--text-primary)]">{pipeline.name}</p>
                                                        )}
                                                        {pipeline.description && (
                                                            <p>{pipeline.description}</p>
                                                        )}
                                                        {pipeline.stages && (
                                                            <p className="text-[var(--text-secondary)] italic">
                                                                Stages: {Array.isArray(pipeline.stages) ? pipeline.stages.join(', ') : pipeline.stages}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {metadata.templates && Array.isArray(metadata.templates) && metadata.templates.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Email Templates</h4>
                                <div className="space-y-3">
                                    {metadata.templates.map((template: any, index: number) => (
                                        <div key={index} className="p-3 rounded-lg bg-[var(--hover-bg)] border border-[var(--border-color)]">
                                            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">{template.name}</p>
                                            {template.subject && (
                                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                                    <span className="font-medium">Subject:</span> {template.subject}
                                                </p>
                                            )}
                                            {template.body && (
                                                <div className="mt-2 p-2 rounded bg-[var(--bg-color)]">
                                                    <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{template.body}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {metadata.workflows && Array.isArray(metadata.workflows) && metadata.workflows.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Workflows</h4>
                                <ul className="space-y-2">
                                    {metadata.workflows.map((workflow: any, index: number) => (
                                        <li key={index} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                            <span className="text-[var(--primary)] mt-0.5">⚙</span>
                                            <div className="flex-1">
                                                {typeof workflow === 'string' ? (
                                                    <span>{workflow}</span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {workflow.name && (
                                                            <p className="font-medium text-[var(--text-primary)]">{workflow.name}</p>
                                                        )}
                                                        {workflow.description && (
                                                            <p>{workflow.description}</p>
                                                        )}
                                                        {workflow.stages && (
                                                            <p className="text-[var(--text-secondary)] italic">
                                                                Stages: {Array.isArray(workflow.stages) ? workflow.stages.join(', ') : workflow.stages}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {metadata.automations && Array.isArray(metadata.automations) && metadata.automations.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Automations</h4>
                                <ul className="space-y-2">
                                    {metadata.automations.map((automation: any, index: number) => (
                                        <li key={index} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                            <div className="w-5 h-5 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Bot className="w-4 h-4 text-[var(--primary)] dark:text-[var(--accent)]" />
                                            </div>
                                            <div className="flex-1">
                                                {typeof automation === 'string' ? (
                                                    <span>{automation}</span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {automation.name && (
                                                            <p className="font-medium text-[var(--text-primary)]">{automation.name}</p>
                                                        )}
                                                        {automation.description && (
                                                            <p>{automation.description}</p>
                                                        )}
                                                        {automation.stages && (
                                                            <p className="text-[var(--text-secondary)] italic">
                                                                Stages: {Array.isArray(automation.stages) ? automation.stages.join(', ') : automation.stages}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                );

            default:

                return (
                    <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-sans">
                        {JSON.stringify(metadata, null, 2)}
                    </pre>
                );
        }

        return null;
    };

    // Suggested commands
    const suggestedCommands = [
        "What's my brand voice?",
        "Tell me about my target audience",
        "What are my compliance rules?",
        "How should I structure my content?",
    ];

    return (
        <>
            <Navbar />
            <div
                className="transition-all duration-300 ease-in-out h-screen flex flex-col overflow-hidden ml-[var(--sidebar-width,16rem)] bg-[var(--bg-color)]"
            >
                {/* Drawer Backdrop */}
                <AnimatePresence>
                    {isDrawerOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                            onClick={() => setIsDrawerOpen(false)}
                        />
                    )}
                </AnimatePresence>

                {/* Drawer */}
                <AnimatePresence>
                    {isDrawerOpen && (
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed right-0 top-0 h-screen w-[400px] z-50 shadow-2xl"
                            style={{
                                backgroundColor: "var(--card-bg)",
                                borderLeft: "1px solid var(--border-color)",
                            }}
                        >
                            <div className="flex flex-col h-full">
                                {/* Drawer Header */}
                                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                        Business Profile
                                    </h2>
                                    <button
                                        onClick={() => setIsDrawerOpen(false)}
                                        className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                                    >
                                        <X size={20} className="text-[var(--text-secondary)]" />
                                    </button>
                                </div>

                                {/* Drawer Content - Cards */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {cards
                                        .sort((a, b) => a.orderIndex - b.orderIndex)
                                        .map((card) => {
                                            const isExpanded = expandedCards.has(card.id);
                                            return (
                                                <div
                                                    key={card.id}
                                                    className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-color)] overflow-hidden"
                                                >
                                                    {/* Card Header */}
                                                    <button
                                                        onClick={() => toggleCard(card.id)}
                                                        className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                                                                {getCardIcon(card.type)}
                                                            </div>
                                                            <div className="flex-1 min-w-0 text-left">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                                                        {card.title}
                                                                    </h3>
                                                                    {(() => {
                                                                        const confidenceScore = card.confidence_score ?? (card.metadata as any)?.confidence_score;
                                                                        return confidenceScore !== undefined && (
                                                                            <span
                                                                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceScore >= 80
                                                                                    ? "bg-green-500/20 text-green-400"
                                                                                    : confidenceScore >= 60
                                                                                        ? "bg-yellow-500/20 text-yellow-400"
                                                                                        : "bg-red-500/20 text-red-400"
                                                                                    }`}
                                                                                title={`Confidence: ${confidenceScore}%`}
                                                                            >
                                                                                {confidenceScore}%
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0 ml-2">
                                                            {isExpanded ? (
                                                                <ChevronUp size={18} className="text-[var(--text-secondary)]" />
                                                            ) : (
                                                                <ChevronDown size={18} className="text-[var(--text-secondary)]" />
                                                            )}
                                                        </div>
                                                    </button>

                                                    {/* Card Preview (Collapsed) */}
                                                    {!isExpanded && (
                                                        <div className="px-4 pb-4">
                                                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                                                                {card.description}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Card Details (Expanded) */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.2 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="px-4 pb-4 space-y-3">
                                                                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                                                                        {card.description}
                                                                    </p>
                                                                    {card.metadata && (
                                                                        <div className="pt-3 border-t border-[var(--border-color)]">
                                                                            {renderCardDetails(card)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                </div>

                                {/* Drawer Footer - Regenerate Button */}
                                <div className="p-4 border-t border-[var(--border-color)]">
                                    <button
                                        onClick={handleRegenerateCards}
                                        disabled={!businessBrainId || status === "generating_cards"}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--primary)] text-white"
                                    >
                                        <RefreshCw
                                            size={16}
                                            className={status === "generating_cards" ? "animate-spin" : ""}
                                        />
                                        <span>Regenerate Business Profile</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsDrawerOpen(false);
                                            setIsEditModalOpen(true);
                                        }}
                                        disabled={!businessBrainId || status === "generating_cards"}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-[var(--primary)] text-[var(--primary)] mt-2 bg-[var(--bg-color)] border border-[var(--primary)]"
                                    >
                                        <PencilLine
                                            size={16}
                                            className={status === "generating_cards" ? "animate-spin" : ""}
                                        />
                                        <span>Edit Brand Info</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header - Always Visible */}
                    <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border-color)]">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold mb-1 text-[var(--primary)]">
                                    AI Business Brain
                                </h1>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Chat with your AI business assistant
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {status === "cards_ready" && (
                                    <button
                                        onClick={() => setIsDrawerOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)] text-white"
                                    >
                                        <FileText size={18} />
                                        <span>View Business Profile</span>
                                    </button>
                                )}
                                {status === "idle" && (
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)] text-white "
                                    >
                                        <Rocket size={18} />
                                        <span>Launch AI Brain</span>
                                    </button>
                                )}
                                {/* <button
                                    className="flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-2 text-sm font-medium border-[var(--primary)] text-[var(--primary)]"
                                    onClick={() => router.push("/dashboard/ai-business-brain/history")}
                                >
                                    <History size={18} />
                                    History
                                </button> */}
                            </div>
                        </div>
                    </div>

                    {/* Loading State */}
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <svg className="animate-spin h-8 w-8 mb-3 text-[var(--accent)]" viewBox="0 0 24 24">
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
                    ) : status === "cards_ready" ? (
                        /* Chat Interface */
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Chat Messages Area */}
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {chatMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-6">
                                            <MessageSquare size={48} className="text-[var(--accent)] " />
                                        </div>
                                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                                            {getCurrentGreeting()}
                                        </h3>
                                        <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md text-center">
                                            Ask me anything about your business. I have access to your brand voice, positioning, style rules, and more.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                                            {suggestedCommands.map((command, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setInputValue(command)}
                                                    className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors text-left text-sm text-[var(--text-primary)]"
                                                >
                                                    {command}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 max-w-4xl mx-auto">
                                        {chatMessages.map((message) => (
                                            <div
                                                key={message.id}
                                                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === "user"
                                                        ? "bg-[var(--primary)] text-white"
                                                        : "bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)]"
                                                        }`}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                    <p className="text-xs mt-2 opacity-70">
                                                        {message.timestamp.toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {isSending && (
                                            <div className="flex justify-start">
                                                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" />
                                                        <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                                                        <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Chat Input Area */}
                            <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-color)]">
                                <div className="max-w-4xl mx-auto flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <textarea
                                            ref={chatInputRef}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="/calibrate-voice"
                                            rows={1}
                                            className="w-full px-4 py-3 pr-12 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:border-[var(--primary)] dark:focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--primary)]/10 dark:focus:ring-[var(--accent)]/10 leading-tight overflow-hidden"
                                            style={{ maxHeight: "120px", lineHeight: "1.5" }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim() || isSending}
                                        className="flex-shrink-0 p-3 rounded-lg bg-[var(--primary)] text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed h-[42px] flex items-center justify-center"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Status Views */
                        <div className="flex-1 overflow-y-auto flex items-center justify-center">
                            {/* Status: Uploading files */}
                            {status === "uploading" && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center mb-3">
                                        <Upload className="animate-pulse h-8 w-8 text-[var(--primary)] dark:text-[var(--accent)]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                                        Uploading files...
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        {statusMessage || "Please wait while we process your files"}
                                    </p>
                                </div>
                            )}

                            {/* Status: Setup Complete */}
                            {status === "setup_complete" && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center mb-3">
                                        <CheckCircle2 className="h-8 w-8 text-[var(--primary)] dark:text-[var(--accent)]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                                        Setup Complete!
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        Your business brain has been created successfully.
                                    </p>
                                </div>
                            )}

                            {/* Status: Generating AI Cards */}
                            {status === "generating_cards" && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center mb-3">
                                        <Sparkles className="animate-pulse h-8 w-8 text-[var(--primary)] dark:text-[var(--accent)]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                                        Generating AI cards...
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        {statusMessage || "Creating your business intelligence cards"}
                                    </p>
                                </div>
                            )}

                            {/* Status: Error */}
                            {status === "error" && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-16 h-16 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center mb-4">
                                        <Brain size={40} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                                        Something went wrong
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                                        {error || "An error occurred while processing your request"}
                                    </p>
                                    <button
                                        onClick={() => {
                                            setStatus("idle");
                                            setError(null);
                                            setCards([]);
                                            setBusinessBrainId(null);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--accent)] text-black"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {/* Empty State */}
                            {status === "idle" && (
                                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                    <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center mb-4">
                                        <Brain
                                            size={48}
                                            className="text-[var(--accent)] "
                                        />
                                    </div>
                                    <h3 className="text-base font-medium mb-1 text-[var(--text-primary)]">
                                        {getCurrentGreeting()}
                                    </h3>
                                    <p className="text-sm mb-6 max-w-sm text-[var(--text-secondary)]">
                                        Enter the business details so the AI can follow the correct voice, rules, and offers.
                                    </p>
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)] text-white"
                                    >
                                        <Rocket size={16} />
                                        <span>Launch AI Brain</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {user && (
                <>
                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => {
                            if (status === "idle" || status === "error") {
                                setIsModalOpen(false);
                            }
                        }}
                        onConfirm={() => { }}
                        title=""
                        message=""
                        body={
                            <BaseIntakeForm
                                userId={user.id}
                                config={businessBrainFormConfig}
                                onClose={() => {
                                    if (status === "idle" || status === "error") {
                                        setIsModalOpen(false);
                                    }
                                }}
                                onSuccess={async (data) => {
                                    setIsModalOpen(false);

                                    // Step 1: Setup complete, now generate cards
                                    if (data.apiResult?.businessBrainId) {
                                        setBusinessBrainId(data.apiResult.businessBrainId);
                                        setStatus("setup_complete");

                                        // Wait a moment to show "Setup Complete" status
                                        await new Promise(resolve => setTimeout(resolve, 1500));

                                        // Step 2: Generate cards in the background
                                        setStatus("generating_cards");
                                        setStatusMessage("Creating your business intelligence cards...");

                                        try {
                                            const cardsResponse = await fetch(
                                                `/api/business-brain/generate-cards?profileId=${data.apiResult.businessBrainId}`,
                                                {
                                                    method: 'POST',
                                                }
                                            );

                                            if (!cardsResponse.ok) {
                                                const errorData = await cardsResponse.json();
                                                throw new Error(errorData.error || 'Failed to generate cards');
                                            }

                                            const cardsResult = await cardsResponse.json();

                                            if (cardsResult.success && cardsResult.cards) {
                                                setCards(cardsResult.cards);

                                                // Step 3: Synthesize knowledge base
                                                setStatusMessage("Synthesizing knowledge base...");

                                                try {
                                                    const synthesizeResponse = await fetch(
                                                        `/api/business-brain/${data.apiResult.businessBrainId}/synthesize-knowledge`,
                                                        {
                                                            method: 'POST',
                                                        }
                                                    );

                                                    if (!synthesizeResponse.ok) {
                                                        const errorData = await synthesizeResponse.json();
                                                        console.warn('Failed to synthesize knowledge base:', errorData.error);
                                                        // Don't fail the whole process if synthesis fails
                                                    } else {
                                                        const synthesizeResult = await synthesizeResponse.json();
                                                        console.log('Knowledge base synthesized:', synthesizeResult.success);
                                                    }
                                                } catch (synthesizeError) {
                                                    console.warn('Error synthesizing knowledge base:', synthesizeError);
                                                    // Don't fail the whole process if synthesis fails
                                                }

                                                setStatus("cards_ready");
                                                setStatusMessage("");
                                            } else {
                                                throw new Error('No cards returned');
                                            }
                                        } catch (cardError) {
                                            console.error('Error generating cards:', cardError);
                                            setError(cardError instanceof Error ? cardError.message : 'Failed to generate cards');
                                            setStatus("error");
                                        }
                                    } else {
                                        setError('Business brain ID not found in response');
                                        setStatus("error");
                                    }
                                }}
                                onProgress={(stage) => {
                                    setStatus("uploading");
                                    setStatusMessage(stage || "Uploading files...");
                                    setIsModalOpen(false);
                                }}
                                onSubmit={async (formData, files) => {

                                    setStatus("uploading");
                                    setStatusMessage("Uploading files and setting up your business brain...");

                                    const payload = new FormData();
                                    payload.append("intake_json", JSON.stringify(formData));

                                    // Append files
                                    Object.entries(files).forEach(([key, file]) => {
                                        if (file) {
                                            payload.append(key, file);
                                        }
                                    });

                                    const response = await fetch('/api/business-brain/setup', {
                                        method: 'POST',
                                        body: payload,
                                    });

                                    if (!response.ok) {
                                        let message = 'Unable to save your business profile. Please try again.';
                                        let userFriendlyMessage = message;
                                        try {
                                            const errorPayload = await response.json();
                                            if (errorPayload?.error) {
                                                message = errorPayload.error;
                                                // Provide user-friendly messages for technical errors
                                                if (message.includes("must not be null") || message.includes("undefined")) {
                                                    userFriendlyMessage = "There was an issue saving your profile. Please try again. If the problem persists, contact support.";
                                                } else {
                                                    userFriendlyMessage = message;
                                                }
                                            }
                                        } catch {
                                            // Ignore JSON parse errors
                                        }
                                        const error = new Error(message);
                                        (error as any).userFriendlyMessage = userFriendlyMessage;
                                        throw error;
                                    }

                                    const result = await response.json();

                                    if (!result.success) {
                                        throw new Error(result.error || 'Failed to setup business brain');
                                    }

                                    return {
                                        businessBrainId: result.businessBrainId,
                                        businessBrain: result.businessBrain,
                                    };
                                }}
                            />
                        }
                        confirmText=""
                        cancelText=""
                        maxWidth="4xl"
                    />
                    <Modal
                        isOpen={isEditModalOpen}
                        onClose={() => {
                            setIsEditModalOpen(false);
                        }}
                        onConfirm={() => { }}
                        title=""
                        message=""
                        body={
                            <BaseIntakeForm
                                userId={user.id}
                                config={businessBrainFormConfig}
                                initialData={businessBrainData?.intakeData}
                                onClose={() => {
                                    setIsEditModalOpen(false);
                                }}
                                onSuccess={async (data) => {
                                    setIsEditModalOpen(false);

                                    // Step 1: Setup complete, now generate cards
                                    if (data.apiResult?.businessBrainId) {
                                        setBusinessBrainId(data.apiResult.businessBrainId);
                                        setStatus("setup_complete");

                                        // Wait a moment to show "Setup Complete" status
                                        await new Promise(resolve => setTimeout(resolve, 1500));

                                        // Step 2: Generate cards in the background
                                        setStatus("generating_cards");
                                        setStatusMessage("Updating your business intelligence cards...");

                                        try {
                                            const cardsResponse = await fetch(
                                                `/api/business-brain/generate-cards?profileId=${data.apiResult.businessBrainId}`,
                                                {
                                                    method: 'POST',
                                                }
                                            );

                                            if (!cardsResponse.ok) {
                                                const errorData = await cardsResponse.json();
                                                throw new Error(errorData.error || 'Failed to regenerate cards');
                                            }

                                            const cardsResult = await cardsResponse.json();

                                            if (cardsResult.success && cardsResult.cards) {
                                                setCards(cardsResult.cards);

                                                // Step 3: Synthesize knowledge base
                                                setStatusMessage("Synthesizing knowledge base...");

                                                try {
                                                    const synthesizeResponse = await fetch(
                                                        `/api/business-brain/${data.apiResult.businessBrainId}/synthesize-knowledge`,
                                                        {
                                                            method: 'POST',
                                                        }
                                                    );

                                                    if (!synthesizeResponse.ok) {
                                                        const errorData = await synthesizeResponse.json();
                                                        console.warn('Failed to synthesize knowledge base:', errorData.error);
                                                        // Don't fail the whole process if synthesis fails
                                                    } else {
                                                        const synthesizeResult = await synthesizeResponse.json();
                                                        console.log('Knowledge base synthesized:', synthesizeResult.success);
                                                    }
                                                } catch (synthesizeError) {
                                                    console.warn('Error synthesizing knowledge base:', synthesizeError);
                                                    // Don't fail the whole process if synthesis fails
                                                }

                                                setStatus("cards_ready");
                                                setStatusMessage("");

                                                // Reload business brain data
                                                const latestResponse = await fetch('/api/business-brain/latest');
                                                const latestResult = await latestResponse.json();
                                                if (latestResult.success && latestResult.businessBrain) {
                                                    setBusinessBrainData({
                                                        intakeData: latestResult.businessBrain.intakeData,
                                                        fileUploads: latestResult.businessBrain.fileUploads,
                                                    });
                                                }
                                            } else {
                                                throw new Error('No cards returned');
                                            }
                                        } catch (cardError) {
                                            console.error('Error regenerating cards:', cardError);
                                            setError(cardError instanceof Error ? cardError.message : 'Failed to regenerate cards');
                                            setStatus("error");
                                        }
                                    } else {
                                        setError('Business brain ID not found in response');
                                        setStatus("error");
                                    }
                                }}
                                onProgress={(stage) => {
                                    setStatus("uploading");
                                    setStatusMessage(stage || "Uploading files...");
                                    setIsEditModalOpen(false);
                                }}
                                onSubmit={async (formData, files) => {
                                    // Step 1: Upload files and setup business brain
                                    setStatus("uploading");
                                    setStatusMessage("Uploading files and updating your business brain...");

                                    // Prepare form data for API
                                    const payload = new FormData();
                                    payload.append("intake_json", JSON.stringify(formData));

                                    // Append files
                                    Object.entries(files).forEach(([key, file]) => {
                                        if (file) {
                                            payload.append(key, file);
                                        }
                                    });

                                    const response = await fetch('/api/business-brain/setup', {
                                        method: 'POST',
                                        body: payload,
                                    });

                                    if (!response.ok) {
                                        let message = 'Unable to update your business profile. Please try again.';
                                        let userFriendlyMessage = message;
                                        try {
                                            const errorPayload = await response.json();
                                            if (errorPayload?.error) {
                                                message = errorPayload.error;
                                                // Provide user-friendly messages for technical errors
                                                if (message.includes("must not be null") || message.includes("undefined")) {
                                                    userFriendlyMessage = "There was an issue updating your profile. Please try again. If the problem persists, contact support.";
                                                } else {
                                                    userFriendlyMessage = message;
                                                }
                                            }
                                        } catch {
                                            // Ignore JSON parse errors
                                        }
                                        const error = new Error(message);
                                        (error as any).userFriendlyMessage = userFriendlyMessage;
                                        throw error;
                                    }

                                    const result = await response.json();

                                    if (!result.success) {
                                        throw new Error(result.error || 'Failed to update business brain');
                                    }

                                    return {
                                        businessBrainId: result.businessBrainId,
                                        businessBrain: result.businessBrain,
                                    };
                                }}
                            />
                        }
                        confirmText=""
                        cancelText=""
                        maxWidth="4xl"
                    />
                </>
            )}
        </>
    );
}