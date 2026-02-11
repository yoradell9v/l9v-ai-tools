"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, Users, User, Brain, ChevronRight, Clock, CheckCircle2, Plus, Zap, ChevronDown, MessageSquareText } from "lucide-react";
import { LightBulbIcon, DocumentTextIcon, BoltIcon, SparklesIcon, ArrowTrendingUpIcon, ArrowUpOnSquareStackIcon, BriefcaseIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ToolChatDialog } from "@/components/chat/ToolChatDialog";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { organizationKnowledgeBaseConfig } from "@/components/forms/configs/organizationKnowledgeBaseConfig";
import { useUser } from "@/context/UserContext";
import { Document } from "@/components/organization/DocumentLibrary";
import DocumentUploader from "@/components/organization/DocumentUploader";
import { useRouter } from "next/navigation";

type CompletionAnalysis = {
    overallScore: number;
    tierStatus: {
        tier1Essential: {
            percentage: number;
            complete: boolean;
            totalFields: number;
            filledFields: number;
            fields: Array<{
                name: string;
                label: string;
                filled: boolean;
                importance: string;
                affectsTools: string[];
            }>;
        };
        tier2Context: {
            percentage: number;
            complete: boolean;
            totalFields: number;
            filledFields: number;
            fields: Array<{
                name: string;
                label: string;
                filled: boolean;
                importance: string;
                affectsTools: string[];
            }>;
        };
        tier3Intelligence: {
            percentage: number;
            complete: boolean;
            totalFields: number;
            filledFields: number;
            fields: Array<{
                name: string;
                label: string;
                filled: boolean;
                importance: string;
                affectsTools: string[];
            }>;
        };
    };
    toolReadiness: {
        jobDescriptionBuilder: {
            ready: boolean;
            score: number;
            quality: string;
            missingFields: string[];
            recommendations: string[];
            qualityScore?: number;
            qualityReadiness?: {
                score: number;
                quality: string;
                blockers?: string[];
                enhancers?: string[];
            };
        };
        sopGenerator: {
            ready: boolean;
            score: number;
            quality: string;
            missingFields: string[];
            recommendations: string[];
            qualityScore?: number;
            qualityReadiness?: {
                score: number;
                quality: string;
                blockers?: string[];
                enhancers?: string[];
            };
        };
        businessBrain: {
            ready: boolean;
            score: number;
            quality: string;
            missingFields: string[];
            recommendations: string[];
            qualityScore?: number;
            qualityReadiness?: {
                score: number;
                quality: string;
                blockers?: string[];
                enhancers?: string[];
            };
        };
    };
    recommendations: Array<{
        priority: string;
        category: string;
        message: string;
        fields: string[];
        benefit: string;
    }>;
    missingCriticalFields: string[];
};

type QualityAnalysis = {
    overallScore: number;
    fieldAnalysis: {
        [fieldName: string]: {
            qualityScore: number;
            specificityScore: number;
            actionabilityScore: number;
            overallQuality: string;
            strengths: string[];
            gaps: string[];
            recommendations: string[];
        };
    };
    crossFieldCoherence: {
        score: number;
        issues: string[];
        strengths: string[];
    };
    toolImpact: {
        jobDescriptionBuilder: {
            qualityScore: number;
            blockers: string[];
            enhancers: string[];
            estimatedImprovement?: string;
        };
        sopGenerator: {
            qualityScore: number;
            blockers: string[];
            enhancers: string[];
            estimatedImprovement?: string;
        };
        businessBrain: {
            qualityScore: number;
            blockers: string[];
            enhancers: string[];
            estimatedImprovement?: string;
        };
    };
    topRecommendations: Array<{
        priority: string;
        field?: string;
        message: string;
        impact: string;
    }>;
    analyzedAt: string;
};

type OrganizationProfile = {
    id: string;
    organizationId: string;
    businessName: string | null;
    website: string | null;
    industry: string | null;
    industryOther: string | null;
    whatYouSell: string | null;
    monthlyRevenue: string | null;
    teamSize: string | null;
    primaryGoal: string | null;
    biggestBottleNeck: string | null;
    idealCustomer: string | null;
    topObjection: string | null;
    coreOffer: string | null;
    customerJourney: string | null;
    toolStack: string[] | null;
    primaryCRM: string | null;
    defaultTimeZone: string | null;
    bookingLink: string | null;
    supportEmail: string | null;
    brandVoiceStyle: string | null;
    riskBoldness: string | null;
    voiceExampleGood: string | null;
    voiceExamplesAvoid: string | null;
    contentLinks: string | null;
    isRegulated: boolean | null;
    regulatedIndustry: string | null;
    forbiddenWords: string | null;
    disclaimers: string | null;
    defaultWeeklyHours: string | null;
    defaultManagementStyle: string | null;
    defaultEnglishLevel: string | null;
    proofAssets: string | null;
    proofFiles: any | null;
    pipeLineStages: string | null;
    emailSignOff: string | null;
    lastEditedBy: string | null;
    lastEditedAt: string | null;
    contributorsCount: number;
    requiredFieldsComplete: boolean;
    completedAt: string | null;
    completedBy: string | null;
    createdAt: string;
    updatedAt: string;
    completeness: number | null;
    completenessBreakdown: any | null;
    lastEditedByUser: {
        id: string;
        firstname: string;
        lastname: string;
        email: string;
    } | null;
    completedByUser: {
        id: string;
        firstname: string;
        lastname: string;
        email: string;
    } | null;
};

function useCountUp(target: number, enabled: boolean, durationMs = 900) {
    const [value, setValue] = useState(0);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (!enabled) {
            setValue(target);
            return;
        }
        const start = performance.now();
        const startVal = 0;
        const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / durationMs, 1);
            const eased = 1 - Math.pow(1 - t, 2);
            setValue(Math.round(startVal + (target - startVal) * eased));
            if (t < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, [target, enabled, durationMs]);

    return value;
}

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 45;

export default function OrganizationProfilePage() {
    const { user } = useUser();
    const router = useRouter();
    const [profile, setProfile] = useState<OrganizationProfile | null>(null);
    const [completionAnalysis, setCompletionAnalysis] = useState<CompletionAnalysis | null>(null);
    const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzingQuality, setIsAnalyzingQuality] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [allDocuments, setAllDocuments] = useState<Document[]>([]);
    const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
    const [isToolChatOpen, setIsToolChatOpen] = useState(false);
    /** When set, the tool chat was opened from All Tasks "Fix" and shows this task as the initial assistant message. */
    const [taskFixTask, setTaskFixTask] = useState<{
        message: string;
        description?: string;
        priority?: string;
        fields: string[];
        type: "completion" | "quality";
    } | null>(null);
    const previousCompletionState = useRef<boolean | null>(null);

    const healthScoreTarget = profile && completionAnalysis ? (qualityAnalysis?.overallScore ?? 0) : 0;
    const animatedHealthScore = useCountUp(healthScoreTarget, !!(profile && completionAnalysis && qualityAnalysis?.overallScore != null), 1000);

    useEffect(() => {
        loadProfile();
    }, []);


    useEffect(() => {
        if (profile && previousCompletionState.current !== null) {
            if (profile.requiredFieldsComplete && !previousCompletionState.current) {
                toast.success("🎉 Profile Complete!", {
                    description: "All required fields have been filled. Your organization profile is now complete!",
                    duration: 5000,
                });
            }
        }
        if (profile) {
            previousCompletionState.current = profile.requiredFieldsComplete;
        }
    }, [profile?.requiredFieldsComplete]);

    const loadDocuments = async () => {
        try {
            const response = await fetch("/api/organization-knowledge-base/documents");
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.documents) {
                    setAllDocuments(result.documents);
                    
                    const activeDocs = result.documents.filter(
                        (doc: Document) => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING"
                    );
                    setDocuments(activeDocs);
                }
            }
        } catch (error) {
            console.error("Error loading documents:", error);
        }
    };

    const loadProfile = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch("/api/organization-knowledge-base");
            const result = await response.json();

            if (result.success) {
                setProfile(result.organizationProfile);
                setCompletionAnalysis(result.completionAnalysis || null);
                setQualityAnalysis(result.qualityAnalysis || null);

                if (result.documents) {
                    setAllDocuments(result.documents);
                    const activeDocs = result.documents.filter(
                        (doc: Document) => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING"
                    );
                    setDocuments(activeDocs);
                } else {
                    loadDocuments();
                }
            } else {
                setError(result.message || "Failed to load organization profile");
            }
        } catch (error) {
            console.error("Error loading organization profile:", error);
            setError("Failed to load organization profile");
        } finally {
            setIsLoading(false);
        }
    };

    const loadQualityAnalysis = async () => {
        try {
            const response = await fetch("/api/organization-knowledge-base/analyze-quality");
            const result = await response.json();

            if (result.success && result.qualityAnalysis) {
                setQualityAnalysis(result.qualityAnalysis);
            }
        } catch (error) {
            console.error("Error loading quality analysis:", error);
        }
    };

    const analyzeQuality = async () => {
        try {
            setIsAnalyzingQuality(true);
            const response = await fetch("/api/organization-knowledge-base/analyze-quality", {
                method: "POST",
            });
            const result = await response.json();

            if (result.success) {
                setQualityAnalysis(result.qualityAnalysis);
                await loadProfile();
                toast.success("Quality analysis completed!", {
                    description: result.cached
                        ? "Returned cached analysis from less than 24 hours ago."
                        : "Your knowledge base quality has been analyzed.",
                });
            } else {
                throw new Error(result.message || "Failed to analyze quality");
            }
        } catch (error) {
            console.error("Error analyzing quality:", error);
            toast.error("Failed to analyze quality", {
                description: error instanceof Error ? error.message : "An unexpected error occurred",
            });
        } finally {
            setIsAnalyzingQuality(false);
        }
    };

    useEffect(() => {
        if (profile) {
            loadQualityAnalysis();
        }
    }, [profile]);

    const handleSave = async (formData: Record<string, any>, uploadedFileUrls?: Record<string, Array<{ url: string; name: string; key: string; type: string }>>) => {
        setIsSaving(true);
        const wasCreating = !profile;
        const wasComplete = profile?.requiredFieldsComplete ?? false;

        try {
            const processedData = { ...formData };

            if (uploadedFileUrls?.proofFiles && uploadedFileUrls.proofFiles.length > 0) {
                processedData.proofFiles = uploadedFileUrls.proofFiles.map(file => ({
                    url: file.url,
                    name: file.name,
                    key: file.key,
                    type: file.type
                }));
            } else if (formData.proofFiles === undefined || formData.proofFiles === null || formData.proofFiles === "") {
                delete processedData.proofFiles;
            }

            const response = await fetch("/api/organization-knowledge-base", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(processedData),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to save profile");
            }

            // Store completion analysis if provided
            if (result.completionAnalysis) {
                setCompletionAnalysis(result.completionAnalysis);
            }

            // Reload profile to get updated data with user info
            await loadProfile();

            // Dispatch custom event to notify sidebar to refresh
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("organizationProfileUpdated"));
            }

            // Show appropriate success message
            const isNowComplete = result.organizationProfile?.requiredFieldsComplete ?? false;
            if (wasCreating) {
                toast.success("Organization profile created successfully!", {
                    description: "Your profile has been saved and is ready to use.",
                });
            } else if (isNowComplete && !wasComplete) {
                // Completion celebration is handled by useEffect
                toast.success("Profile updated successfully!", {
                    description: "All required fields are now complete.",
                });
            } else {
                toast.success("Profile updated successfully!", {
                    description: "Your changes have been saved.",
                });
            }

            setIsEditing(false);
        } catch (error) {
            console.error("Error saving profile:", error);
            const message = error instanceof Error ? error.message : "Failed to save profile";
            toast.error("Failed to save profile", {
                description: message,
            });
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const getPrimaryCTA = (qualityAnalysis: QualityAnalysis | null, completionAnalysis: CompletionAnalysis | null) => {
        if (!qualityAnalysis) return { label: "Run quality check", action: () => analyzeQuality() };
        const score = qualityAnalysis.overallScore;
        if (score < 30) return { label: "Complete Setup", action: () => setIsEditing(true) };
        if (score < 70) return { label: "Continue Setup", action: () => setIsEditing(true) };
        return { label: "Optimize Quality", action: () => analyzeQuality() };
    };

    const estimateTimeToReady = (missingFields: string[]) => {
        const avgTimePerField = 2; // minutes
        return Math.max(2, missingFields.length * avgTimePerField);
    };

    const handleFixField = (fieldName: string) => {
        setIsEditing(true);
        // TODO: Scroll to field in form when dialog opens
        // This would require form ref or field ID mapping
    };

    /** Builds the assistant message shown when opening chat from All Tasks "Fix" (same pattern as critical questions in role-builder). */
    const buildTaskFixAssistantMessage = (task: {
        message: string;
        description?: string;
        fields?: string[];
    }): string => {
        let text = `Here’s a task to address:\n\n**${task.message}**`;
        if (task.description) {
            text += `\n\n${task.description}`;
        }
        if (task.fields?.length) {
            text += `\n\nFields involved: ${task.fields.join(", ")}.`;
        }
        text += "\n\nAdd your prompt below to address this task. The AI will use your input to improve your knowledge base.";
        return text;
    };

    const getCompletionTier = (score: number) => {
        if (score >= 80) return { label: "Optimized", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" };
        if (score >= 50) return { label: "Building", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" };
        return { label: "Getting Started", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" };
    };

    const getHealthDisplay = (quality: QualityAnalysis | null, completion: CompletionAnalysis | null) => {
        const primaryScore = quality?.overallScore ?? null;
        const coverageScore = completion?.overallScore ?? null;
        const primaryLabel = primaryScore !== null
            ? "Knowledge base quality"
            : "Not yet analyzed";
        return { primaryScore, coverageScore, primaryLabel };
    };

    const getBusinessBrainReadiness = (quality: QualityAnalysis | null) => {
        const impact = quality?.toolImpact?.businessBrain;
        const score = impact?.qualityScore ?? 0;
        const ready = score >= 60;
        let message = "Run quality check to see readiness";
        if (impact) {
            message = ready ? "Ready for AI conversations" : "Improve profile quality for better AI answers";
        }
        const qualityLabel = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "basic" : "insufficient";
        return { ready, score, message, quality: qualityLabel };
    };

    const isEnrichedWithAI = (quality: QualityAnalysis | null, toolKey: "jobDescriptionBuilder" | "sopGenerator") => {
        const impact = quality?.toolImpact?.[toolKey];
        return (impact?.qualityScore ?? 0) >= 50;
    };

    const getNextMilestone = (completionAnalysis: CompletionAnalysis | null, qualityAnalysis: QualityAnalysis | null) => {
        const brain = getBusinessBrainReadiness(qualityAnalysis);
        if (brain.ready) return null;
        return {
            toolName: "Business Brain",
            fieldsNeeded: 0,
            progress: brain.score,
            message: qualityAnalysis
                ? "Improve profile quality for better AI conversations"
                : "Run quality check to see how ready your knowledge base is for AI",
        };
    };

    const getQuickWins = (completionAnalysis: CompletionAnalysis | null, qualityAnalysis: QualityAnalysis | null) => {
        if (!completionAnalysis) return [];

        const qualityRecs = (qualityAnalysis?.topRecommendations || []).map(rec => ({ ...rec, type: 'quality' as const }));
        const completionRecs = completionAnalysis.recommendations.map(rec => ({ ...rec, type: 'completion' as const }));
        const allRecs = [...qualityRecs, ...completionRecs];

        return allRecs
            .filter(rec => {
                const isCompletionRec = rec.type === 'completion';
                const fields = isCompletionRec ? (rec as any).fields : ((rec as any).field ? [(rec as any).field] : []);
                const timeEstimate = estimateTimeToReady(fields);
                return timeEstimate <= 5; // Quick wins ar or less
            })
            .slice(0, 2) 
            .map(rec => {
                const isCompletionRec = rec.type === 'completion';
                const fields = isCompletionRec ? (rec as any).fields : ((rec as any).field ? [(rec as any).field] : []);
                const timeEstimate = estimateTimeToReady(fields);
                return { ...rec, timeEstimate, fields };
            });
    };

    if (isLoading) {
        return (
            <>
                <div className="flex items-center justify-between gap-3 py-6 px-4 md:py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <h1 className="text-xl font-semibold truncate min-w-0 md:text-2xl">Organization Knowledge Base</h1>
                    <SidebarTrigger className="flex-shrink-0" />
                </div>
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </>
        );
    }

    if (error && !profile) {
        return (
            <>
                <div className="flex items-center justify-between gap-3 py-6 px-4 md:py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <h1 className="text-xl font-semibold truncate min-w-0 md:text-2xl">Organization Knowledge Base</h1>
                    <SidebarTrigger className="flex-shrink-0" />
                </div>
                <div className="min-h-screen">
                    <div className="py-6 px-4 md:py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                        <Card className="border-destructive/30 bg-destructive/10">
                            <CardContent className="py-3 px-4 md:py-4">
                                <p className="text-sm text-destructive md:text-base">{error}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="min-h-screen">
                <div className="py-6 px-4 space-y-4 md:py-10 md:px-8 md:space-y-6 lg:px-16 xl:px-24 2xl:px-32">
                    <div className="flex items-center justify-between gap-3 animate-section-in opacity-0">
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold mb-1 truncate md:text-2xl md:mb-2">Organization Knowledge Base</h1>
                        </div>
                        <SidebarTrigger className="flex-shrink-0" />
                    </div>

                    {!profile && (
                        <div className="py-10 px-2 space-y-6 md:py-16 md:space-y-8 animate-section-in opacity-0">
                            <div className="mx-auto flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                <RocketLaunchIcon className="h-10 w-10 md:h-12 md:w-12 text-[color:var(--accent-strong)] animate-pulse" />
                            </div>
                            <div className="space-y-3 text-center max-w-2xl mx-auto md:space-y-4">
                                <h1 className="text-2xl font-bold md:text-3xl">Build Your AI Knowledge Base</h1>
                                <p className="text-base text-muted-foreground md:text-lg">
                                    Create a single source of truth that powers all your AI tools. The more complete it is, the smarter your results become.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 md:gap-4 md:mt-8">
                                    <div className="p-3 rounded-lg border bg-card md:p-4">
                                        <BriefcaseIcon className="h-5 w-5 md:h-6 md:w-6 mb-1.5 md:mb-2 text-primary" />
                                        <p className="font-semibold text-xs md:text-sm">Job Descriptions</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 md:text-xs md:mt-1">Generate role-specific job descriptions</p>
                                    </div>
                                    <div className="p-3 rounded-lg border bg-card md:p-4">
                                        <DocumentTextIcon className="h-5 w-5 md:h-6 md:w-6 mb-1.5 md:mb-2 text-primary" />
                                        <p className="font-semibold text-xs md:text-sm">SOPs</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 md:text-xs md:mt-1">Create standard operating procedures</p>
                                    </div>
                                    <div className="p-3 rounded-lg border bg-card md:p-4">
                                        <Brain className="h-5 w-5 md:h-6 md:w-6 mb-1.5 md:mb-2 text-primary" />
                                        <p className="font-semibold text-xs md:text-sm">Business Brain</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 md:text-xs md:mt-1">AI-powered business conversations</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                                <Button onClick={() => setIsEditing(true)} size="lg" className="w-full sm:w-auto bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-sm md:text-base">
                                    <RocketLaunchIcon className="h-5 w-5 mr-2" />
                                    Quick Start (5 min)
                                </Button>
                                <Button onClick={() => setIsEditing(true)} size="lg" variant="outline" className="w-full sm:w-auto text-sm md:text-base">
                                    Complete Setup (15 min)
                                </Button>
                                {/* Tell AI hidden when KB not set up — tool chat requires a knowledge base */}
                            </div>
                        </div>
                    )}

                    {profile && documents.some(doc => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING") && (
                        <Alert className="border-blue-500/20 bg-blue-500/5 animate-section-in opacity-0 transition-opacity duration-300 p-3 md:p-4">
                            <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
                            <AlertTitle className="text-sm md:text-base">Documents Processing</AlertTitle>
                            <AlertDescription className="text-xs md:text-sm">
                                {documents.filter(doc => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING").length} document{documents.filter(doc => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING").length > 1 ? 's' : ''} being processed. Fields will auto-fill when complete.
                            </AlertDescription>
                        </Alert>
                    )}

                    {profile && completionAnalysis && (() => {
                        const health = getHealthDisplay(qualityAnalysis, completionAnalysis);
                        const tier = getCompletionTier(completionAnalysis.overallScore);
                        const nextMilestone = getNextMilestone(completionAnalysis, qualityAnalysis);
                        const cta = getPrimaryCTA(qualityAnalysis, completionAnalysis);

                        return (
                            <div className="relative p-4 rounded-lg border bg-gradient-to-br from-background to-muted/20 animate-section-in opacity-0 md:p-6">
                                {/* Health Score: on mobile centered above content; on desktop top-right */}
                                <div className="flex justify-center mb-4 md:absolute md:top-4 md:right-4 md:mb-0">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="relative w-24 h-24 md:w-32 md:h-32">
                                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                        <defs>
                                                            <linearGradient id="healthGradientCompact" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                <stop offset="0%" stopColor="#f0b214" />
                                                                <stop offset="100%" stopColor="#1374B4" />
                                                            </linearGradient>
                                                        </defs>
                                                        <circle
                                                            cx="50"
                                                            cy="50"
                                                            r="45"
                                                            stroke="currentColor"
                                                            strokeWidth="8"
                                                            fill="none"
                                                            className="text-muted"
                                                        />
                                                        {health.primaryScore !== null ? (
                                                            <circle
                                                                cx="50"
                                                                cy="50"
                                                                r="45"
                                                                stroke="url(#healthGradientCompact)"
                                                                strokeWidth="8"
                                                                fill="none"
                                                                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                                                                strokeDashoffset={CIRCLE_CIRCUMFERENCE * (1 - animatedHealthScore / 100)}
                                                                className="transition-all duration-1000 ease-out"
                                                                strokeLinecap="round"
                                                            />
                                                        ) : null}
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        {health.primaryScore !== null ? (
                                                            <span className="text-lg font-bold tabular-nums md:text-2xl">{animatedHealthScore}%</span>
                                                        ) : (
                                                            <span className="text-[10px] font-medium text-muted-foreground text-center px-0.5 md:text-xs md:px-1">Not yet analyzed</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{health.primaryLabel}{health.primaryScore !== null ? `: ${health.primaryScore}%` : ""}</p>
                                                {health.coverageScore !== null && (
                                                    <p className="text-xs mt-1">Profile coverage: {health.coverageScore}%</p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>

                                <div className="space-y-3 pr-0 md:pr-40 md:space-y-4">
                                    {/* Tier + optional coverage */}
                                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                        <Badge className={`shrink-0 text-xs md:text-sm ${tier.bgColor} ${tier.color} ${tier.borderColor} border`}>
                                            {tier.label}
                                        </Badge>
                                        {health.coverageScore !== null && (
                                            <span className="text-xs text-muted-foreground md:text-sm">
                                                Profile coverage: <span className="font-medium">{health.coverageScore}%</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Next Milestone: Business Brain only (Phase 4) */}
                                    {nextMilestone ? (
                                        <div className="space-y-1 md:space-y-2">
                                            <p className="text-lg font-semibold md:text-2xl">Keep building your AI Knowledge Base</p>
                                            <p className="text-xs text-muted-foreground md:text-sm">
                                                {nextMilestone.message}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1 md:space-y-2">
                                            <p className="text-lg font-semibold md:text-2xl">Business Brain ready 🎉</p>
                                            <p className="text-xs text-muted-foreground md:text-sm">Your knowledge base quality supports strong AI conversations.</p>
                                        </div>
                                    )}

                                    {/* Primary CTA: stack on mobile, wrap on desktop */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                                        <Button
                                            onClick={cta.action}
                                            size="lg"
                                            variant="outline"
                                            className="w-full sm:w-auto border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white text-sm md:text-base"
                                            disabled={cta.label === "Run quality check" && isAnalyzingQuality}
                                        >
                                            {cta.label === "Run quality check" && isAnalyzingQuality ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Running…
                                                </>
                                            ) : (
                                                cta.label
                                            )}
                                        </Button>
                                        {profile?.requiredFieldsComplete && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    size="lg"
                                                    className="w-full sm:w-auto bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-sm md:text-base"
                                                >
                                                    <SparklesIcon className="h-4 w-4 mr-2" />
                                                    Improve with AI
                                                    <ChevronDown className="h-4 w-4 ml-2" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setIsToolChatOpen(true)}>
                                                    <MessageSquareText className="h-4 w-4 mr-2" />
                                                    Chat with AI
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setIsDocumentUploadOpen(true)}>
                                                    <ArrowUpOnSquareStackIcon className="h-4 w-4 mr-2" />
                                                    Upload Documents
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        )}
                                        <ToolChatDialog
                                            key={taskFixTask ? `task-fix-${taskFixTask.message.substring(0, 40)}-${taskFixTask.type}` : "general"}
                                            toolId="organization-profile"
                                            open={isToolChatOpen}
                                            onOpenChange={(open) => {
                                                setIsToolChatOpen(open);
                                                if (!open) {
                                                    setTaskFixTask(null);
                                                    loadProfile();
                                                }
                                            }}
                                            initialMessages={taskFixTask ? [{ role: "assistant", content: buildTaskFixAssistantMessage(taskFixTask) }] : undefined}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {profile && completionAnalysis && (() => {
                        const quickWins = getQuickWins(completionAnalysis, qualityAnalysis);
                        if (quickWins.length === 0) return null;

                        return (
                            <div className="space-y-3 md:space-y-4 animate-section-in opacity-0" style={{ animationDelay: "80ms" }}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                                        <h2 className="text-xl font-semibold md:text-2xl">Quick Wins</h2>
                                    </div>
                                    <p className="text-xs text-muted-foreground md:text-sm">
                                        Complete these in under 5 minutes to improve quality and coverage
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                    {quickWins.map((rec, idx) => {
                                        const isCompletionRec = rec.type === 'completion';
                                        const fields = rec.fields || [];
                                        const fieldCount = fields.length;
                                        const description = isCompletionRec ? (rec as any).benefit : (rec as any).impact;
                                        return (
                                            <div key={idx} className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow md:p-4 overflow-hidden">
                                                <div className="flex items-start justify-between gap-2 mb-2 md:gap-3 md:mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm mb-0.5 md:text-base md:mb-1 break-words">{rec.message}</p>
                                                        {description && (
                                                            <p className="text-xs text-muted-foreground md:text-sm break-words">{description}</p>
                                                        )}
                                                    </div>
                                                    <Badge
                                                        variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                                                        className="text-[10px] flex-shrink-0 md:text-xs"
                                                    >
                                                        {rec.priority === 'high' ? 'High' : rec.priority === 'medium' ? 'Medium' : 'Low'}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-2 md:gap-3 text-[10px] text-muted-foreground md:text-xs">
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            <span>~{rec.timeEstimate} min</span>
                                                        </div>
                                                        {fieldCount > 0 && (
                                                            <span>{fieldCount} field{fieldCount > 1 ? 's' : ''}</span>
                                                        )}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            if (fieldCount > 0) {
                                                                handleFixField(fields[0]);
                                                            } else {
                                                                setIsEditing(true);
                                                            }
                                                        }}
                                                        className="w-full sm:w-auto bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-xs md:text-sm"
                                                    >
                                                        Complete This
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {profile && completionAnalysis && (
                        <div className="space-y-3 md:space-y-4 animate-section-in opacity-0" style={{ animationDelay: "120ms" }}>
                            <div>
                                <h2 className="text-xl font-semibold mb-1 md:text-2xl">Completion Status</h2>
                                <p className="text-xs text-muted-foreground md:text-sm">
                                    Track your progress across knowledge base tiers
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 md:gap-3">
                                {[
                                    { name: "Basic Info", fields: completionAnalysis.tierStatus.tier1Essential, icon: User, tooltip: "Essential business information" },
                                    { name: "Business Details", fields: completionAnalysis.tierStatus.tier2Context, icon: BriefcaseIcon, tooltip: "Context and operational details" },
                                    { name: "Brand Voice", fields: completionAnalysis.tierStatus.tier3Intelligence, icon: SparklesIcon, tooltip: "Brand personality and voice" },
                                    { name: "Quality Check", complete: !!qualityAnalysis, icon: CheckCircle2, tooltip: "Quality analysis and optimization" },
                                ].map((step) => {
                                    const isComplete = step.complete || (step.fields && step.fields.complete);
                                    const IconComponent = step.icon;
                                    const progress = step.fields ? step.fields.percentage : (step.complete ? 100 : 0);

                                    return (
                                        <TooltipProvider key={step.name}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => {
                                                            if (step.name !== "Quality Check") {
                                                                setIsEditing(true);
                                                            } else if (!qualityAnalysis && !isAnalyzingQuality) {
                                                                analyzeQuality();
                                                            }
                                                        }}
                                                        disabled={step.name === "Quality Check" && !qualityAnalysis && isAnalyzingQuality}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 transition-all text-xs md:gap-2 md:px-4 md:py-2 md:text-sm ${isComplete
                                                                ? step.name === "Brand Voice"
                                                                    ? "bg-[color:var(--accent-strong)]/10 border-[color:var(--accent-strong)] text-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/20"
                                                                    : "bg-[var(--primary-dark)]/10 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/20"
                                                                : progress > 0
                                                                    ? step.name === "Brand Voice"
                                                                        ? "bg-[color:var(--accent-strong)]/10 border-[color:var(--accent-strong)] text-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/20"
                                                                        : "bg-[var(--primary-dark)]/10 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/20"
                                                                    : "bg-muted border-muted-foreground/30 text-muted-foreground hover:bg-muted/80"
                                                            }`}
                                                    >
                                                        {isComplete ? (
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        ) : step.name === "Quality Check" && isAnalyzingQuality ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <IconComponent className="h-4 w-4" />
                                                        )}
                                                        <span className="text-sm font-medium">{step.name}</span>
                                                        {step.fields && !step.fields.complete && (
                                                            <span className="text-xs">({step.fields.filledFields}/{step.fields.totalFields})</span>
                                                        )}
                                                        {step.name === "Quality Check" && isAnalyzingQuality && (
                                                            <span className="text-xs">Running…</span>
                                                        )}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{step.tooltip}</p>
                                                    {step.fields && !step.fields.complete && (
                                                        <p className="text-xs mt-1">{step.fields.totalFields - step.fields.filledFields} fields remaining</p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {profile && completionAnalysis && (
                        <div className="space-y-3 md:space-y-4 animate-section-in opacity-0" style={{ animationDelay: "160ms" }}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <BoltIcon className="h-4 w-4 md:h-5 md:w-5" />
                                    <h2 className="text-xl font-semibold md:text-2xl">Tool Readiness</h2>
                                </div>
                                <p className="text-xs text-muted-foreground md:text-sm">
                                    How ready your knowledge base is for each tool
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                {/* Job Descriptions: use anytime; Enriched with AI when quality sufficient */}
                                {(() => {
                                    const jdEnriched = isEnrichedWithAI(qualityAnalysis, "jobDescriptionBuilder");
                                    return (
                                        <div className="p-4 rounded-lg border border-border/50 bg-card space-y-3 overflow-hidden transition-all duration-300 hover:shadow-md md:p-6 md:space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <DocumentTextIcon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                                                    <span className="font-semibold text-sm truncate md:text-base">Job Descriptions</span>
                                                </div>
                                                {jdEnriched && (
                                                    <Badge className="bg-[color:var(--accent-strong)]/20 text-[color:var(--accent-strong)] border-[color:var(--accent-strong)]/30 text-[10px] shrink-0 md:text-xs">Enriched with AI</Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-center justify-center space-y-1.5 md:space-y-2">
                                                <p className="text-xs text-muted-foreground text-center md:text-sm">Use anytime. More profile data improves results.</p>
                                                <Badge variant="secondary" className="text-[10px] md:text-xs">Use anytime</Badge>
                                            </div>
                                            <Button
                                                onClick={() => router.push("/dashboard/role-builder")}
                                                className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-xs md:text-sm"
                                                size="sm"
                                            >
                                                Launch Job Descriptions
                                                <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        </div>
                                    );
                                })()}
                                {/* Process Builder (SOP): use anytime; Enriched with AI when quality sufficient */}
                                {(() => {
                                    const sopEnriched = isEnrichedWithAI(qualityAnalysis, "sopGenerator");
                                    return (
                                        <div className="p-4 rounded-lg border border-border/50 bg-card space-y-3 overflow-hidden transition-all duration-300 hover:shadow-md md:p-6 md:space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <DocumentTextIcon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                                                    <span className="font-semibold text-sm truncate md:text-base">Process Builder</span>
                                                </div>
                                                {sopEnriched && (
                                                    <Badge className="bg-[color:var(--accent-strong)]/20 text-[color:var(--accent-strong)] border-[color:var(--accent-strong)]/30 text-[10px] shrink-0 md:text-xs">Enriched with AI</Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-center justify-center space-y-1.5 md:space-y-2">
                                                <p className="text-xs text-muted-foreground text-center md:text-sm">Use anytime. More profile data improves results.</p>
                                                <Badge variant="secondary" className="text-[10px] md:text-xs">Use anytime</Badge>
                                            </div>
                                            <Button
                                                onClick={() => router.push("/dashboard/process-builder")}
                                                className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-xs md:text-sm"
                                                size="sm"
                                            >
                                                Launch Process Builder
                                                <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        </div>
                                    );
                                })()}
                                {/* Business Brain: readiness from quality only */}
                                {(() => {
                                    const brain = getBusinessBrainReadiness(qualityAnalysis);
                                    const Icon = Brain;
                                    return (
                                        <div className="p-4 rounded-lg border border-border/50 bg-card space-y-3 overflow-hidden transition-all duration-300 hover:shadow-md md:p-6 md:space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Icon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                                                    <span className="font-semibold text-sm truncate md:text-base">Business Brain</span>
                                                </div>
                                                {brain.ready && <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600 flex-shrink-0" />}
                                            </div>
                                            <div className="flex flex-col items-center justify-center space-y-1.5 md:space-y-2">
                                                <div className="relative w-20 h-20 md:w-24 md:h-24">
                                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                        <defs>
                                                            <linearGradient id="toolGradient-Business-Brain" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                <stop offset="0%" stopColor="#f0b214" />
                                                                <stop offset="100%" stopColor="#1374B4" />
                                                            </linearGradient>
                                                        </defs>
                                                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
                                                        <circle
                                                            cx="50" cy="50" r="45"
                                                            stroke="url(#toolGradient-Business-Brain)"
                                                            strokeWidth="8" fill="none"
                                                            strokeDasharray={`${2 * Math.PI * 45}`}
                                                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - brain.score / 100)}`}
                                                            className="transition-all duration-500"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-base font-bold md:text-xl">{brain.score}%</span>
                                                        <span className="text-[10px] text-muted-foreground md:text-xs">{brain.quality}</span>
                                                    </div>
                                                </div>
                                                <Badge variant={brain.ready ? "default" : "secondary"} className="text-[10px] md:text-xs">
                                                    {brain.ready ? "Ready" : "Not yet ready"}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground text-center md:text-xs">{brain.message}</span>
                                            </div>
                                            <Button
                                                onClick={() => {
                                                    if (brain.ready) router.push("/dashboard/ai-business-brain");
                                                    else if (qualityAnalysis) setIsEditing(true);
                                                    else if (!isAnalyzingQuality) analyzeQuality();
                                                }}
                                                disabled={!brain.ready && !qualityAnalysis && isAnalyzingQuality}
                                                className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-xs md:text-sm"
                                                size="sm"
                                            >
                                                {brain.ready ? (
                                                    <>Launch Business Brain<ChevronRight className="h-4 w-4 ml-1" /></>
                                                ) : qualityAnalysis ? (
                                                    <>Improve profile</>
                                                ) : isAnalyzingQuality ? (
                                                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Running…</>
                                                ) : (
                                                    <>Run quality check</>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {profile && completionAnalysis && (() => {
                        const allRecs = [
                            ...completionAnalysis.recommendations.map(rec => ({ ...rec, type: 'completion' as const })),
                            ...(qualityAnalysis?.topRecommendations || []).map(rec => ({ ...rec, type: 'quality' as const }))
                        ];
                        const quickWins = getQuickWins(completionAnalysis, qualityAnalysis);
                        const remainingTasks = allRecs.filter(rec => {
                            const isCompletionRec = rec.type === 'completion';
                            const fields = isCompletionRec ? (rec as any).fields : ((rec as any).field ? [(rec as any).field] : []);
                            const timeEstimate = estimateTimeToReady(fields);
                            return !quickWins.some(qw => qw.message === rec.message);
                        });

                        if (remainingTasks.length === 0) return null;

                        return (
                            <Accordion type="single" collapsible className="w-full animate-section-in opacity-0" style={{ animationDelay: "200ms" }}>
                                <AccordionItem value="all-tasks" className="border-none">
                                    <AccordionTrigger className="hover:no-underline py-2 md:py-4">
                                        <div className="flex flex-wrap items-center gap-2 text-left">
                                            <ArrowTrendingUpIcon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                                            <h2 className="text-xl font-semibold md:text-2xl">All Tasks</h2>
                                            <Badge variant="outline" className="text-xs shrink-0">
                                                {remainingTasks.length}
                                            </Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-2 pt-2 md:pt-4">
                                            {remainingTasks.map((rec, idx) => {
                                                const isCompletionRec = rec.type === 'completion';
                                                const fields = isCompletionRec ? (rec as any).fields : ((rec as any).field ? [(rec as any).field] : []);
                                                const fieldCount = fields.length;
                                                const timeEstimate = fieldCount > 0 ? estimateTimeToReady(fields) : 3;
                                                const description = isCompletionRec ? (rec as any).benefit : (rec as any).impact;
                                                return (
                                                    <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors overflow-hidden sm:flex-row sm:items-start sm:gap-3">
                                                        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                                            <div className="mt-0.5 flex-shrink-0">
                                                                <div className="w-4 h-4 md:w-5 md:h-5 rounded border-2 border-muted-foreground/30 flex items-center justify-center">
                                                                    {/* Checkbox */}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0 space-y-1">
                                                                <p className="text-xs font-medium break-words md:text-sm">{rec.message}</p>
                                                                {description && (
                                                                    <p className="text-[10px] text-muted-foreground break-words md:text-xs">{description}</p>
                                                                )}
                                                                <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[10px] text-muted-foreground md:text-xs">
                                                                    <Badge
                                                                        variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                                                                        className="text-[10px] shrink-0 md:text-xs"
                                                                    >
                                                                        {rec.priority === 'high' ? 'High' : rec.priority === 'medium' ? 'Medium' : 'Low'}
                                                                    </Badge>
                                                                    <div className="flex items-center gap-1">
                                                                        <Clock className="h-3 w-3" />
                                                                        <span>~{timeEstimate} min</span>
                                                                    </div>
                                                                    {fieldCount > 0 && (
                                                                        <span>{fieldCount} field{fieldCount > 1 ? 's' : ''}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setTaskFixTask({
                                                                    message: rec.message,
                                                                    description: description ?? undefined,
                                                                    priority: rec.priority,
                                                                    fields: fields,
                                                                    type: rec.type,
                                                                });
                                                                setIsToolChatOpen(true);
                                                            }}
                                                            className="w-full sm:w-auto shrink-0 text-xs md:text-sm"
                                                        >
                                                            Fix
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        );
                    })()}

                    <Dialog open={isDocumentUploadOpen} onOpenChange={setIsDocumentUploadOpen}>
                        <DialogContent className="w-[min(600px,95vw)] sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 sm:p-2 flex flex-col">
                            <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
                                <DialogTitle>
                                    Upload Documents
                                </DialogTitle>
                                <DialogDescription>
                                    Upload documents to automatically extract and fill knowledge base fields. Upload 1 document → auto-fill 12+ fields in seconds.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="px-4 pb-4 flex flex-col flex-1 min-h-0 overflow-auto">
                                <DocumentUploader
                                    hideCard={true}
                                    hideHeader={true}
                                    documents={documents}
                                    onDocumentsChange={(updatedDocs) => {
                                        setDocuments(updatedDocs);
                                        const completedDocs = allDocuments.filter(
                                            (doc) => doc.extractionStatus !== "PENDING" && doc.extractionStatus !== "PROCESSING"
                                        );
                                        const activeDocs = updatedDocs.filter(
                                            (doc) => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING"
                                        );
                                        setAllDocuments([...completedDocs, ...activeDocs]);
                                    }}
                                    onDocumentComplete={(completedDoc: Document) => {
                                        setDocuments((prev) => prev.filter((doc) => doc.id !== completedDoc.id));
                                        setAllDocuments((prev) => {
                                            const exists = prev.find((d) => d.id === completedDoc.id);
                                            if (exists) {
                                                return prev.map((d) => d.id === completedDoc.id ? completedDoc : d);
                                            }
                                            return [...prev, completedDoc];
                                        });

                                        if (completedDoc.extractionStatus === "COMPLETED") {
                                            toast.success(`"${completedDoc.name}" processed successfully!`, {
                                                description: completedDoc.insights && completedDoc.insights.length > 0
                                                    ? `${completedDoc.insights.length} insight${completedDoc.insights.length > 1 ? 's' : ''} extracted.`
                                                    : "Content extracted and added to your knowledge base.",
                                                duration: 6000,
                                            });
                                        } else if (completedDoc.extractionStatus === "FAILED") {
                                            toast.error(`"${completedDoc.name}" processing failed`, {
                                                description: completedDoc.extractionError || "An error occurred during processing.",
                                                duration: 6000,
                                            });
                                        }
                                    }}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>

                    {user && (
                        <Dialog open={isEditing} onOpenChange={(open) => {
                            if (!isSaving) {
                                setIsEditing(open);
                            }
                        }}>
                            <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2 flex flex-col">
                                <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
                                    <DialogTitle>
                                        {profile ? "Update Knowledge Base" : "Setup Knowledge Base"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        This single source of truth feeds all your tools—Job Descriptions, SOPs, Business Brain conversations, and more. The more complete it is, the smarter your results become.

                                    </DialogDescription>
                                </DialogHeader>
                                <div className="px-4 pb-4 flex flex-col flex-1 min-h-0 overflow-hidden">
                                    <BaseIntakeForm
                                        userId={user.id}
                                        config={organizationKnowledgeBaseConfig}
                                        initialData={profile ? {
                                            businessName: profile.businessName || "",
                                            website: profile.website || "",
                                            industry: profile.industry || "",
                                            industryOther: profile.industryOther || "",
                                            whatYouSell: profile.whatYouSell || "",
                                            monthlyRevenue: profile.monthlyRevenue || "",
                                            teamSize: profile.teamSize || "",
                                            primaryGoal: profile.primaryGoal || "",
                                            biggestBottleNeck: profile.biggestBottleNeck || "",
                                            idealCustomer: profile.idealCustomer || "",
                                            topObjection: profile.topObjection || "",
                                            coreOffer: profile.coreOffer || "",
                                            customerJourney: profile.customerJourney || "",
                                            toolStack: Array.isArray(profile.toolStack) ? profile.toolStack.join(", ") : (profile.toolStack || ""),
                                            primaryCRM: profile.primaryCRM || "",
                                            defaultTimeZone: profile.defaultTimeZone || "",
                                            bookingLink: profile.bookingLink || "",
                                            supportEmail: profile.supportEmail || "",
                                            brandVoiceStyle: profile.brandVoiceStyle || "",
                                            riskBoldness: profile.riskBoldness || "",
                                            voiceExampleGood: profile.voiceExampleGood || "",
                                            voiceExamplesAvoid: profile.voiceExamplesAvoid || "",
                                            contentLinks: profile.contentLinks || "",
                                            isRegulated: profile.isRegulated === true ? "yes" : profile.isRegulated === false ? "no" : "",
                                            regulatedIndustry: profile.regulatedIndustry || "",
                                            forbiddenWords: profile.forbiddenWords || "",
                                            disclaimers: profile.disclaimers || "",
                                            defaultWeeklyHours: profile.defaultWeeklyHours || "",
                                            defaultManagementStyle: profile.defaultManagementStyle || "",
                                            defaultEnglishLevel: profile.defaultEnglishLevel || "",
                                            proofAssets: profile.proofAssets || "",
                                            proofFiles: profile.proofFiles || "",
                                            pipeLineStages: profile.pipeLineStages || "",
                                            emailSignOff: profile.emailSignOff || "",
                                        } : undefined}
                                        hideTitleAndDescription={true}
                                        onClose={() => {
                                            if (!isSaving) {
                                                setIsEditing(false);
                                            }
                                        }}
                                        onSuccess={async () => {
                                            // Success is handled in handleSave
                                            // This is just a fallback
                                            await loadProfile();
                                            setIsEditing(false);
                                        }}
                                        onSubmit={async (formData, uploadedFileUrls) => {
                                            await handleSave(formData, uploadedFileUrls);
                                            return { success: true };
                                        }}
                                        onError={(error) => {
                                            console.error("Form error:", error);
                                            toast.error("Failed to save profile", {
                                                description: error || "An unexpected error occurred",
                                            });
                                        }}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                </div>
            </div>
        </>
    );
}

