"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Building2, Loader2, CheckCircle2, Users, Calendar, Edit, AlertCircle, Sparkles, Globe, Briefcase, Database, DollarSign, User, Lightbulb, Target, TrendingUp, FileText, Brain, Zap, Award, BarChart3, Sparkle, Info, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { organizationKnowledgeBaseConfig } from "@/components/forms/configs/organizationKnowledgeBaseConfig";
import { useUser } from "@/context/UserContext";

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

export default function OrganizationProfilePage() {
    const { user } = useUser();
    const [profile, setProfile] = useState<OrganizationProfile | null>(null);
    const [completionAnalysis, setCompletionAnalysis] = useState<CompletionAnalysis | null>(null);
    const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzingQuality, setIsAnalyzingQuality] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const previousCompletionState = useRef<boolean | null>(null);

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

    const loadProfile = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch("/api/organization-knowledge-base");
            const result = await response.json();

            if (result.success) {
                setProfile(result.organizationProfile);
                setCompletionAnalysis(result.completionAnalysis || null);
                if (result.qualityAnalysis) {
                    setQualityAnalysis(result.qualityAnalysis);
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
                // Reload profile to get updated completion analysis with quality readiness scores
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

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatRelativeTime = (dateString: string | null) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        return formatDate(dateString);
    };

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

    const getQualityColor = (quality: string) => {
        switch (quality?.toLowerCase()) {
            case "excellent":
                return "text-green-600 dark:text-green-400";
            case "good":
                return "text-[color:var(--accent-strong)]";
            case "basic":
                return "text-amber-600 dark:text-amber-400";
            case "insufficient":
                return "text-red-600 dark:text-red-400";
            default:
                return "text-muted-foreground";
        }
    };

    const getQualityBadgeVariant = (quality: string) => {
        switch (quality?.toLowerCase()) {
            case "excellent":
                return "default";
            case "good":
                return "secondary";
            case "basic":
                return "outline";
            case "insufficient":
                return "destructive";
            default:
                return "outline";
        }
    };

    if (isLoading) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
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
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="min-h-screen">
                    <div className="p-6">
                        <Card className="border-destructive/30 bg-destructive/10">
                            <CardContent className="py-4">
                                <p className="text-sm text-destructive">{error}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
            </div>
            <div className="min-h-screen">
                <div className="p-6 space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold mb-2">Organization Knowledge Base</h1>

                            </div>
                            {!isEditing && (
                                <Button onClick={() => setIsEditing(true)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    {profile ? "Edit Knowledge Base" : "Setup Knowledge Base"}
                                </Button>
                            )}
                        </div>

                        {/* Help Text Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Info className="h-5 w-5 text-[color:var(--accent-strong)]" />
                                    Living Knowledge Base
                                </CardTitle>
                                <CardDescription>
                                    This is your initial knowledge base setup. It will automatically improve and learn from your usage across all tools
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                    <li>Job Descriptions you create will enhance your organizational context</li>
                                    <li>SOPs you generate will refine your operational knowledge</li>
                                    <li>Business Brain conversations will capture insights and patterns</li>
                                    <li>All tools contribute back to make your knowledge base smarter over time</li>
                                </ul>
                                <p className="mt-4 text-sm font-medium text-foreground">Start with the essential fields below—you can always refine and expand later!</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Overall Completion Score Card */}
                    {profile && completionAnalysis && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            Overall Knowledge Base Score
                                            {completionAnalysis.overallScore >= 80 && (
                                                <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)] animate-pulse" />
                                            )}
                                        </CardTitle>
                                        <CardDescription>
                                            Completion and quality scores across all tiers and tools
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-2xl font-bold">
                                                {completionAnalysis.overallScore}%
                                            </div>
                                            <Badge variant="outline" className="text-xs mt-1">
                                                Completion
                                            </Badge>
                                        </div>
                                        {qualityAnalysis && (
                                            <>
                                                <Separator orientation="vertical" className="h-12" />
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-[color:var(--accent-strong)]">
                                                        {qualityAnalysis.overallScore}%
                                                    </div>
                                                    <Badge variant="outline" className="text-xs mt-1">
                                                        Quality
                                                    </Badge>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Completion</span>
                                        <span className="font-medium">{completionAnalysis.overallScore}%</span>
                                    </div>
                                    <Progress
                                        value={completionAnalysis.overallScore}
                                        className="h-2"
                                    />
                                    {qualityAnalysis && (
                                        <>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Quality</span>
                                                <span className="font-medium">{qualityAnalysis.overallScore}%</span>
                                            </div>
                                            <Progress
                                                value={qualityAnalysis.overallScore}
                                                className="h-2 [&>div]:bg-[color:var(--accent-strong)]"
                                            />
                                        </>
                                    )}
                                </div>

                                {!qualityAnalysis && (
                                    <div className="space-y-2 p-4 rounded-lg border">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">Quality Analysis</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Get AI-powered quality scores for your knowledge base
                                                </p>
                                            </div>
                                            <Button
                                                onClick={analyzeQuality}
                                                disabled={isAnalyzingQuality}
                                                size="sm"
                                                variant="outline"
                                            >
                                                {isAnalyzingQuality ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkle className="h-4 w-4 mr-2" />
                                                        Analyze Quality
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {qualityAnalysis && (
                                    <div className="space-y-2 p-4 rounded-lg border">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">Last Analyzed</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatRelativeTime(qualityAnalysis.analyzedAt)}
                                                </p>
                                            </div>
                                            <Button
                                                onClick={analyzeQuality}
                                                disabled={isAnalyzingQuality}
                                                size="sm"
                                                variant="outline"
                                            >
                                                {isAnalyzingQuality ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkle className="h-4 w-4 mr-2" />
                                                        Re-analyze
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Separator />

                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                    {profile.lastEditedByUser && profile.lastEditedAt && (
                                        <>
                                            <span>Last updated {formatRelativeTime(profile.lastEditedAt)} by {profile.lastEditedByUser.firstname} {profile.lastEditedByUser.lastname}</span>
                                        </>
                                    )}
                                    {profile.contributorsCount > 0 && (
                                        <>
                                            {profile.lastEditedByUser && profile.lastEditedAt && <span>•</span>}
                                            <span>{profile.contributorsCount} {profile.contributorsCount === 1 ? "contributor" : "contributors"}</span>
                                        </>
                                    )}
                                    {profile.createdAt && (
                                        <>
                                            {(profile.lastEditedByUser || profile.contributorsCount > 0) && <span>•</span>}
                                            <span>Created {formatDate(profile.createdAt)}</span>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tool Readiness Card */}
                    {profile && completionAnalysis && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Zap className="h-5 w-5" />
                                            Tool Readiness
                                        </CardTitle>
                                        <CardDescription>
                                            How ready your knowledge base is for each tool
                                        </CardDescription>
                                    </div>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <HelpCircle className="h-4 w-4 text-muted-foreground mt-1" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-sm">
                                                <p className="text-xs mb-2"><strong>Basic Readiness:</strong> Based on field completion. Shows if you have the minimum required fields filled.</p>
                                                <p className="text-xs"><strong>Quality Readiness:</strong> Combined completion + quality score. Shows how well your filled fields will work for AI tools. Requires quality analysis.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Job Description Builder */}
                                    <div className="space-y-2 p-4 rounded-lg border">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                <span className="font-medium text-sm">Job Descriptions</span>
                                            </div>
                                            {completionAnalysis.toolReadiness.jobDescriptionBuilder.ready && (
                                                <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-strong)]" />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {/* Basic Readiness */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Basic Readiness</span>
                                                    <span className={`text-sm font-bold ${getQualityColor(completionAnalysis.toolReadiness.jobDescriptionBuilder.quality)}`}>
                                                        {completionAnalysis.toolReadiness.jobDescriptionBuilder.score}%
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={completionAnalysis.toolReadiness.jobDescriptionBuilder.score}
                                                    className="h-2"
                                                />
                                                <Badge
                                                    variant={getQualityBadgeVariant(completionAnalysis.toolReadiness.jobDescriptionBuilder.quality) as any}
                                                    className="text-xs"
                                                >
                                                    {completionAnalysis.toolReadiness.jobDescriptionBuilder.quality}
                                                </Badge>
                                            </div>

                                            {/* Quality Readiness (if available) */}
                                            {completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness && (
                                                <>
                                                    <Separator />
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                Quality Readiness
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <HelpCircle className="h-3 w-3" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="text-xs">Combined completion + quality score</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </span>
                                                            <span className={`text-sm font-bold ${getQualityColor(completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.quality)}`}>
                                                                {completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.score}%
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.score}
                                                            className="h-2 [&>div]:bg-[color:var(--accent-strong)]"
                                                        />
                                                        <Badge
                                                            variant={getQualityBadgeVariant(completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.quality) as any}
                                                            className="text-xs"
                                                        >
                                                            {completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.quality}
                                                        </Badge>
                                                        {completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.blockers && completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.blockers.length > 0 && (
                                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                                Quality blockers: {completionAnalysis.toolReadiness.jobDescriptionBuilder.qualityReadiness.blockers.slice(0, 2).join(", ")}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {completionAnalysis.toolReadiness.jobDescriptionBuilder.missingFields.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs text-muted-foreground mb-1">Missing:</p>
                                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                                    {completionAnalysis.toolReadiness.jobDescriptionBuilder.missingFields.slice(0, 2).map((field, idx) => (
                                                        <li key={idx}>• {field}</li>
                                                    ))}
                                                    {completionAnalysis.toolReadiness.jobDescriptionBuilder.missingFields.length > 2 && (
                                                        <li className="text-xs">+{completionAnalysis.toolReadiness.jobDescriptionBuilder.missingFields.length - 2} more</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* SOP Generator */}
                                    <div className="space-y-2 p-4 rounded-lg border">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                <span className="font-medium text-sm">SOP Generator</span>
                                            </div>
                                            {completionAnalysis.toolReadiness.sopGenerator.ready && (
                                                <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-strong)]" />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {/* Basic Readiness */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Basic Readiness</span>
                                                    <span className={`text-sm font-bold ${getQualityColor(completionAnalysis.toolReadiness.sopGenerator.quality)}`}>
                                                        {completionAnalysis.toolReadiness.sopGenerator.score}%
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={completionAnalysis.toolReadiness.sopGenerator.score}
                                                    className="h-2"
                                                />
                                                <Badge
                                                    variant={getQualityBadgeVariant(completionAnalysis.toolReadiness.sopGenerator.quality) as any}
                                                    className="text-xs"
                                                >
                                                    {completionAnalysis.toolReadiness.sopGenerator.quality}
                                                </Badge>
                                            </div>

                                            {/* Quality Readiness (if available) */}
                                            {completionAnalysis.toolReadiness.sopGenerator.qualityReadiness && (
                                                <>
                                                    <Separator />
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                Quality Readiness
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <HelpCircle className="h-3 w-3" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="text-xs">Combined completion + quality score</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </span>
                                                            <span className={`text-sm font-bold ${getQualityColor(completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.quality)}`}>
                                                                {completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.score}%
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.score}
                                                            className="h-2 [&>div]:bg-[color:var(--accent-strong)]"
                                                        />
                                                        <Badge
                                                            variant={getQualityBadgeVariant(completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.quality) as any}
                                                            className="text-xs"
                                                        >
                                                            {completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.quality}
                                                        </Badge>
                                                        {completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.blockers && completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.blockers.length > 0 && (
                                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                                Quality blockers: {completionAnalysis.toolReadiness.sopGenerator.qualityReadiness.blockers.slice(0, 2).join(", ")}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {completionAnalysis.toolReadiness.sopGenerator.missingFields.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs text-muted-foreground mb-1">Missing:</p>
                                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                                    {completionAnalysis.toolReadiness.sopGenerator.missingFields.slice(0, 2).map((field, idx) => (
                                                        <li key={idx}>• {field}</li>
                                                    ))}
                                                    {completionAnalysis.toolReadiness.sopGenerator.missingFields.length > 2 && (
                                                        <li className="text-xs">+{completionAnalysis.toolReadiness.sopGenerator.missingFields.length - 2} more</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Business Brain */}
                                    <div className="space-y-2 p-4 rounded-lg border">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Brain className="h-4 w-4" />
                                                <span className="font-medium text-sm">Business Brain</span>
                                            </div>
                                            {completionAnalysis.toolReadiness.businessBrain.ready && (
                                                <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-strong)]" />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {/* Basic Readiness */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Basic Readiness</span>
                                                    <span className={`text-sm font-bold ${getQualityColor(completionAnalysis.toolReadiness.businessBrain.quality)}`}>
                                                        {completionAnalysis.toolReadiness.businessBrain.score}%
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={completionAnalysis.toolReadiness.businessBrain.score}
                                                    className="h-2"
                                                />
                                                <Badge
                                                    variant={getQualityBadgeVariant(completionAnalysis.toolReadiness.businessBrain.quality) as any}
                                                    className="text-xs"
                                                >
                                                    {completionAnalysis.toolReadiness.businessBrain.quality}
                                                </Badge>
                                            </div>

                                            {/* Quality Readiness (if available) */}
                                            {completionAnalysis.toolReadiness.businessBrain.qualityReadiness && (
                                                <>
                                                    <Separator />
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                Quality Readiness
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <HelpCircle className="h-3 w-3" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="text-xs">Combined completion + quality score</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </span>
                                                            <span className={`text-sm font-bold ${getQualityColor(completionAnalysis.toolReadiness.businessBrain.qualityReadiness.quality)}`}>
                                                                {completionAnalysis.toolReadiness.businessBrain.qualityReadiness.score}%
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={completionAnalysis.toolReadiness.businessBrain.qualityReadiness.score}
                                                            className="h-2 [&>div]:bg-[color:var(--accent-strong)]"
                                                        />
                                                        <Badge
                                                            variant={getQualityBadgeVariant(completionAnalysis.toolReadiness.businessBrain.qualityReadiness.quality) as any}
                                                            className="text-xs"
                                                        >
                                                            {completionAnalysis.toolReadiness.businessBrain.qualityReadiness.quality}
                                                        </Badge>
                                                        {completionAnalysis.toolReadiness.businessBrain.qualityReadiness.blockers && completionAnalysis.toolReadiness.businessBrain.qualityReadiness.blockers.length > 0 && (
                                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                                Quality blockers: {completionAnalysis.toolReadiness.businessBrain.qualityReadiness.blockers.slice(0, 2).join(", ")}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {completionAnalysis.toolReadiness.businessBrain.missingFields.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs text-muted-foreground mb-1">Missing:</p>
                                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                                    {completionAnalysis.toolReadiness.businessBrain.missingFields.slice(0, 2).map((field, idx) => (
                                                        <li key={idx}>• {field}</li>
                                                    ))}
                                                    {completionAnalysis.toolReadiness.businessBrain.missingFields.length > 2 && (
                                                        <li className="text-xs">+{completionAnalysis.toolReadiness.businessBrain.missingFields.length - 2} more</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommendations Card */}
                    {profile && completionAnalysis && completionAnalysis.recommendations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5" />
                                    Recommendations
                                </CardTitle>
                                <CardDescription>
                                    Suggestions to improve your knowledge base
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {completionAnalysis.recommendations.map((rec, idx) => (
                                        <div key={idx} className="space-y-2 p-4 rounded-lg border">
                                            <div className="flex items-start gap-2">
                                                <Award className={`h-4 w-4 mt-0.5 flex-shrink-0 ${rec.priority === 'high' ? 'text-red-500' :
                                                    rec.priority === 'medium' ? 'text-amber-500' :
                                                        'text-[color:var(--accent-strong)]'
                                                    }`} />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{rec.message}</p>
                                                    {rec.benefit && (
                                                        <p className="text-xs text-muted-foreground mt-1">{rec.benefit}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quality Recommendations Card */}
                    {profile && qualityAnalysis && qualityAnalysis.topRecommendations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Sparkle className="h-5 w-5" />
                                    Quality Improvement Recommendations
                                </CardTitle>
                                <CardDescription>
                                    AI-powered suggestions to improve the quality and specificity of your knowledge base
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {qualityAnalysis.topRecommendations.map((rec, idx) => (
                                        <div key={idx} className="space-y-2 p-4 rounded-lg border">
                                            <div className="flex items-start gap-2">
                                                <Sparkle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${rec.priority === 'high' ? 'text-red-500' :
                                                    rec.priority === 'medium' ? 'text-amber-500' :
                                                        'text-[color:var(--accent-strong)]'
                                                    }`} />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{rec.message}</p>
                                                    {rec.impact && (
                                                        <p className="text-xs text-muted-foreground mt-1">{rec.impact}</p>
                                                    )}
                                                    {rec.field && (
                                                        <Badge variant="outline" className="text-xs mt-2">
                                                            {rec.field}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {!profile && (
                        <Card className="text-center">
                            <CardContent className="py-12 space-y-4">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <Lightbulb className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">No Knowledge Base Setup Yet</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        Setup your organization's knowledge base to get started. This information will be used to pre-fill forms across the platform.
                                    </p>
                                </div>
                                <Button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    Setup Knowledge Base
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Edit Form Dialog */}
                    {user && (
                        <Dialog open={isEditing} onOpenChange={(open) => {
                            if (!isSaving) {
                                setIsEditing(open);
                            }
                        }}>
                            <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2">
                                <DialogHeader className="px-4 pt-4 pb-2">
                                    <DialogTitle>
                                        {profile ? "Update Knowledge Base" : "Setup Knowledge Base"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        This single source of truth feeds all your tools—Job Descriptions, SOPs, Business Brain conversations, and more. The more complete it is, the smarter your results become.

                                    </DialogDescription>
                                </DialogHeader>
                                <div className="px-4 pb-4 overflow-y-auto max-h-[calc(90vh-120px)]">
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

