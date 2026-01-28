"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/context/UserContext";
import {
    Brain,
    ArrowRight,
    Plus,
    CheckCircle2,
    Circle,
    Rocket,
    Clock,
    MessageSquare,
    ChevronRight,
    Sparkles,
} from "lucide-react";
import {
    BriefcaseIcon,
    ListBulletIcon,
    LightBulbIcon,
    UserGroupIcon,
    ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { checkOnboardingStatus, type OnboardingStatus } from "@/lib/knowledge-base/organization-knowledge-base";
import { ToolChatDialog } from "@/components/chat/ToolChatDialog";

interface DashboardStats {
    // SUPERADMIN stats
    totalOrganizations?: number;
    totalUsers?: number;
    totalAnalyses?: number;
    totalSOPs?: number;
    totalKnowledgeBases?: number;
    pendingInvitations?: number;
    totalConversations?: number;
    // ADMIN stats
    organizationMembers?: number;
    organizationAnalyses?: number;
    organizationSOPs?: number;
    organizationKnowledgeBases?: number;
    organizationConversations?: number;
    // MEMBER stats
    myAnalyses?: number;
    mySOPs?: number;
    myConversations?: number;
}

interface TeamMember {
    id: string;
    userId: string;
    firstname: string;
    lastname: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    joinedAt?: string;
    deactivatedAt?: string | null;
}

export default function DashboardPage() {
    const { user } = useUser();
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
    const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoadingTeam, setIsLoadingTeam] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [completionAnalysis, setCompletionAnalysis] = useState<{
        overallScore: number;
        toolReadiness?: {
            jobDescriptionBuilder?: { ready: boolean; score: number };
            sopGenerator?: { ready: boolean; score: number };
            businessBrain?: { ready: boolean; score: number };
        };
    } | null>(null);
    const [sopsCreatedToday, setSopsCreatedToday] = useState<number>(0);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const response = await fetch("/api/dashboard/stats", {
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch stats");
                }

                const data = await response.json();
                if (data.success) {
                    setStats(data.stats);
                } else {
                    throw new Error(data.error || "Failed to fetch stats");
                }
            } catch (err: any) {
                console.error("Error fetching stats:", err);
                setError(err.message || "Failed to load dashboard stats");
            } finally {
                setIsLoading(false);
            }
        };

        const fetchTeam = async () => {
            try {
                setIsLoadingTeam(true);
                setTeamError(null);

                const tenantRes = await fetch("/api/tenant", { credentials: "include" });
                const tenantData = await tenantRes.json();
                const currentTenantId = tenantData?.currentTenantId;
                if (!tenantRes.ok || !currentTenantId) {
                    setTeamMembers([]);
                    if (!tenantRes.ok) {
                        setTeamError(tenantData?.message || "Unable to load team.");
                    }
                    return;
                }

                const teamRes = await fetch(`/api/tenant/${currentTenantId}`, { credentials: "include" });
                const teamData = await teamRes.json();
                if (!teamRes.ok || !teamData.success) {
                    setTeamError(teamData?.message || "Unable to load team.");
                    setTeamMembers([]);
                    return;
                }

                const collaborators: TeamMember[] = (teamData?.tenant?.collaborators || []).map((c: any) => ({
                    id: c.id,
                    userId: c.userId,
                    firstname: c.firstname,
                    lastname: c.lastname,
                    email: c.email,
                    role: c.role,
                    joinedAt: c.joinedAt,
                    deactivatedAt: c.deactivatedAt ?? null,
                }));
                setTeamMembers(collaborators);
            } catch (err: any) {
                console.error("Error fetching team:", err);
                setTeamError("Failed to load team members.");
                setTeamMembers([]);
            } finally {
                setIsLoadingTeam(false);
            }
        };

        const fetchOnboardingStatus = async () => {
            try {
                setIsLoadingOnboarding(true);
                const response = await fetch("/api/organization-knowledge-base", {
                    credentials: "include",
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const status = checkOnboardingStatus(data.organizationProfile);
                        setOnboardingStatus(status);
                        // Also store completion analysis for KB percentage and tool readiness
                        if (data.completionAnalysis) {
                            setCompletionAnalysis(data.completionAnalysis);
                        }
                    } else {
                        const status = checkOnboardingStatus(null);
                        setOnboardingStatus(status);
                    }
                } else {
                    const status = checkOnboardingStatus(null);
                    setOnboardingStatus(status);
                }
            } catch (err) {
                console.error("Error fetching onboarding status:", err);
                const status = checkOnboardingStatus(null);
                setOnboardingStatus(status);
            } finally {
                setIsLoadingOnboarding(false);
            }
        };

        const fetchSOPsCreatedToday = async () => {
            try {
                // Get today's date range
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Fetch recent SOPs (last 100 should cover today's SOPs)
                const response = await fetch(
                    `/api/sop/saved?page=1&limit=100`,
                    {
                        credentials: "include",
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.sops) {
                        // Filter SOPs created today
                        const todaySOPs = data.data.sops.filter((sop: any) => {
                            const createdAt = new Date(sop.createdAt);
                            return createdAt >= today && createdAt < tomorrow;
                        });
                        setSopsCreatedToday(todaySOPs.length);
                    }
                }
            } catch (err) {
                console.error("Error fetching SOPs created today:", err);
            }
        };

        fetchStats();
        fetchOnboardingStatus();
        fetchTeam();
        fetchSOPsCreatedToday();
    }, []);

    // Helper functions
    const getKBCompletion = () => {
        // Use completionAnalysis.overallScore if available, otherwise fall back to onboardingStatus
        if (completionAnalysis?.overallScore !== undefined) {
            return completionAnalysis.overallScore;
        }
        if (!onboardingStatus) return 0;
        return onboardingStatus.completionStatus?.percentage || 0;
    };

    const isToolReady = (toolName: 'jobDescriptionBuilder' | 'sopGenerator' | 'businessBrain') => {
        if (!completionAnalysis?.toolReadiness) return false;
        const tool = completionAnalysis.toolReadiness[toolName];
        return tool?.ready === true;
    };

    const isKBComplete = () => {
        return onboardingStatus && !onboardingStatus.needsOnboarding;
    };

    const hasSOP = () => {
        if (!stats) return false;
        return (
            (user?.globalRole === "SUPERADMIN" && (stats.totalSOPs ?? 0) > 0) ||
            (user?.globalRole === "ADMIN" && (stats.organizationSOPs ?? 0) > 0) ||
            (user?.globalRole === "MEMBER" && (stats.mySOPs ?? 0) > 0) ||
            (stats.mySOPs ?? 0) > 0 ||
            (stats.organizationSOPs ?? 0) > 0 ||
            (stats.totalSOPs ?? 0) > 0
        );
    };

    const hasRole = () => {
        if (!stats) return false;
        return (
            (user?.globalRole === "SUPERADMIN" && (stats.totalAnalyses ?? 0) > 0) ||
            (user?.globalRole === "ADMIN" && (stats.organizationAnalyses ?? 0) > 0) ||
            (user?.globalRole === "MEMBER" && (stats.myAnalyses ?? 0) > 0) ||
            (stats.myAnalyses ?? 0) > 0 ||
            (stats.organizationAnalyses ?? 0) > 0 ||
            (stats.totalAnalyses ?? 0) > 0
        );
    };

    const hasConversation = () => {
        if (!stats) return false;
        return (
            (user?.globalRole === "SUPERADMIN" && (stats.totalConversations ?? 0) > 0) ||
            (user?.globalRole === "ADMIN" && (stats.organizationConversations ?? 0) > 0) ||
            (user?.globalRole === "MEMBER" && (stats.myConversations ?? 0) > 0) ||
            (stats.myConversations ?? 0) > 0 ||
            (stats.organizationConversations ?? 0) > 0 ||
            (stats.totalConversations ?? 0) > 0
        );
    };

    const getProgressCount = () => {
        return [isKBComplete(), hasSOP(), hasRole(), hasConversation()].filter(Boolean).length;
    };

    const estimateTimeToComplete = (percentage: number) => {
        const remaining = 100 - percentage;
        return Math.ceil((remaining / 100) * 8);
    };

    const getRecommendedAction = () => {
        if (!isKBComplete()) {
            return {
                title: "Complete Your Knowledge Base",
                description: "Finish your knowledge base to unlock all tools",
                action: () => router.push("/dashboard/organization-profile"),
                timeEstimate: estimateTimeToComplete(getKBCompletion()),
            };
        }
        if (!hasRole()) {
            return {
                title: "Define Your First Role",
                description: "Create a job description to get started",
                action: () => router.push("/dashboard/role-builder"),
                timeEstimate: 3,
            };
        }
        if (!hasSOP()) {
            return {
                title: "Create Your First SOP",
                description: "Document a process for your team",
                action: () => router.push("/dashboard/process-builder"),
                timeEstimate: 5,
            };
        }
        return null;
    };

    const handleCompleteKnowledgeBase = () => {
        router.push("/dashboard/organization-profile");
    };

    // Render Compact Hero Section (<120px)
    const renderHeroSection = () => {
        const kbCompletion = getKBCompletion();
        const isComplete = isKBComplete();

        if (!isComplete && kbCompletion < 100) {
            const timeEstimate = estimateTimeToComplete(kbCompletion);
            const remainingFields = onboardingStatus?.completionStatus?.missingFields?.length || 0;

            return (
                <Card className="border-2 border-[color:var(--accent-strong)]/30 bg-gradient-to-r from-[color:var(--accent-strong)]/10 to-[color:var(--accent-strong)]/5">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                                <Brain className="h-5 w-5 text-[color:var(--accent-strong)] flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg font-semibold mb-1">Complete Your Knowledge Base</h2>
                                    <p className="text-base text-muted-foreground">
                                        {Math.round(kbCompletion)}% complete • {remainingFields} fields remaining • ~{timeEstimate} minutes left
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                    onClick={handleCompleteKnowledgeBase}
                                    size="sm"
                                    className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                >
                                    Complete Now
                                </Button>
                                <ToolChatDialog
                                    toolId="organization-profile"
                                    buttonLabel="Tell AI"
                                    buttonVariant="outline"
                                    buttonSize="sm"
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                >
                                    Skip
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        return null; // Hide welcome message when KB is complete
    };

    // Render Setup Progress Component (Redesigned)
    const renderSetupProgress = () => {
        const progressCount = getProgressCount();
        const progressPercent = (progressCount / 4) * 100;

        // Define tasks in order
        const tasks = [
            {
                id: "kb",
                title: "Build Your Business Brain",
                subtitle: "Add brand info, preferences, and context",
                completed: isKBComplete(),
                action: () => router.push("/dashboard/organization-profile"),
            },
            {
                id: "sop",
                title: "Document a Process",
                subtitle: "Create a step-by-step SOP",
                completed: hasSOP(),
                action: () => router.push("/dashboard/process-builder"),
            },
            {
                id: "role",
                title: "Define a Role",
                subtitle: "Clarify responsibilities and skills",
                completed: hasRole(),
                action: () => router.push("/dashboard/role-builder"),
            },
            {
                id: "task",
                title: "Submit Your First Task",
                subtitle: "Delegate work with AI assistance",
                completed: hasConversation(),
                action: () => router.push("/dashboard/ai-business-brain"),
            },
        ];

        // Find first incomplete task
        const firstIncompleteIndex = tasks.findIndex((task) => !task.completed);
        const firstIncomplete = firstIncompleteIndex !== -1 ? tasks[firstIncompleteIndex] : null;

        return (
            <Card>
                <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            Getting Started
                        </CardTitle>
                        <span className="text-2xl font-bold text-[var(--primary-dark)]">
                            {Math.round(progressPercent)}%
                        </span>
                    </div>
                    <CardDescription className="text-base">
                        {progressCount} of 4 complete
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Gradient Progress Bar */}
                    <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${progressPercent}%`,
                                background: "linear-gradient(90deg, #f0b214 0%, #1374B4 100%)",
                            }}
                        />
                    </div>

                    {/* Checklist Items */}
                    <div className="space-y-3">
                        {tasks.map((task, index) => {
                            const isFirstIncomplete = !task.completed && index === firstIncompleteIndex;

                            return (
                                <div
                                    key={task.id}
                                    className={`p-3 rounded-lg border transition-all ${task.completed
                                        ? "bg-muted/30 border-muted"
                                        : isFirstIncomplete
                                            ? "border-[color:var(--accent-strong)] border-2 bg-[color:var(--accent-strong)]/5"
                                            : "border-border"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1">
                                            {task.completed ? (
                                                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4
                                                    className={`text-base font-semibold ${task.completed ? "line-through text-muted-foreground" : ""
                                                        }`}
                                                >
                                                    {task.title}
                                                </h4>
                                                <p className="text-sm text-muted-foreground mt-0.5">
                                                    {task.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        {isFirstIncomplete && (
                                            <Button
                                                onClick={task.action}
                                                size="sm"
                                                className="bg-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/90 text-[color:var(--primary)] flex-shrink-0"
                                            >
                                                Start
                                                <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Render Compact Stats Section (3-4 cards)
    const renderStatsSection = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <Skeleton className="h-8 w-16 mb-2" />
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-5 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            );
        }

        if (!stats) return null;

        const kbCompletion = getKBCompletion();
        const kbStatus = isKBComplete() ? "✓ Ready" : "Complete";
        const rolesCount = stats.organizationAnalyses || stats.myAnalyses || stats.totalAnalyses || 0;
        const sopsCount = stats.organizationSOPs || stats.mySOPs || stats.totalSOPs || 0;
        const teamCount = stats.organizationMembers || 0;
        const conversationsCount = stats.organizationConversations || stats.myConversations || stats.totalConversations || 0;

        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Workspace Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                    
                    <Card
                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative"
                        onClick={() => router.push("/dashboard/organization-profile")}
                    >
                        <CardContent className="p-4">
                            <ChevronRight className="h-4 w-4 text-muted-foreground absolute top-4 right-4" />
                            <div className="flex items-center gap-2 mb-2">
                                <LightBulbIcon className="h-5 w-5 text-[var(--primary-dark)]" />
                                <span className="text-base font-semibold">KB</span>
                            </div>
                            <div className="text-2xl font-bold mb-1">{Math.round(kbCompletion)}%</div>
                            <Badge className="text-xs mb-2 bg-[var(--primary-dark)] text-white">
                                {kbStatus}
                            </Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative"
                        onClick={() => router.push("/dashboard/role-builder")}
                    >
                        <CardContent className="p-4">
                            <ChevronRight className="h-4 w-4 text-muted-foreground absolute top-4 right-4" />
                            <div className="flex items-center gap-2 mb-2">
                                <BriefcaseIcon className="h-5 w-5 text-[var(--primary-dark)]" />
                                <span className="text-base font-semibold">Roles</span>
                            </div>
                            <div className="text-2xl font-bold mb-1">{rolesCount}</div>
                            <Badge className={`text-xs mb-2 ${isToolReady('jobDescriptionBuilder') ? 'bg-[var(--primary-dark)] text-white' : 'bg-muted text-muted-foreground'}`}>
                                {isToolReady('jobDescriptionBuilder') ? '✓ Ready' : 'Not Ready'}
                            </Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative"
                        onClick={() => router.push("/dashboard/process-builder")}
                    >
                        <CardContent className="p-4">
                            <ChevronRight className="h-4 w-4 text-muted-foreground absolute top-4 right-4" />
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardDocumentCheckIcon className="h-5 w-5 text-[var(--primary-dark)]" />
                                <span className="text-base font-semibold">SOPs</span>
                            </div>
                            <div className="text-2xl font-bold mb-1">{sopsCount}</div>
                            <Badge className={`text-xs mb-2 ${isToolReady('sopGenerator') ? 'bg-[var(--primary-dark)] text-white' : 'bg-muted text-muted-foreground'}`}>
                                {sopsCreatedToday > 0 ? `+${sopsCreatedToday} today` : (isToolReady('sopGenerator') ? '✓ Ready' : 'Not Ready')}
                            </Badge>
                        </CardContent>
                    </Card>
                </div>

                {teamCount > 0 && (
                    <Card
                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
                        onClick={() => router.push("/dashboard/tenants")}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <UserGroupIcon className="h-5 w-5 text-[var(--primary-dark)]" />
                                        <span className="text-base font-semibold">Team: {teamCount} members</span>
                                    </div>
                                    {conversationsCount > 0 && (
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-base text-muted-foreground">{conversationsCount} conversations</span>
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm">
                                    Manage team
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    const renderToolsSection = () => {
        const rolesCount = stats ? (stats.organizationAnalyses || stats.myAnalyses || stats.totalAnalyses || 0) : 0;
        const sopsCount = stats ? (stats.organizationSOPs || stats.mySOPs || stats.totalSOPs || 0) : 0;
        const kbCompletion = getKBCompletion();

        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Your Tools</h3>
                <div className="grid grid-cols-2 gap-4">
                    
                    <Card className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                    <BriefcaseIcon className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <h4 className="text-base font-semibold mb-1">Role Builder</h4>
                            <p className="text-sm text-muted-foreground mb-3">{rolesCount} active roles</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white"
                                onClick={() => router.push("/dashboard/role-builder")}
                            >
                                <Plus className="h-3 w-3 mr-2" />
                                Define New Role
                                <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                    <ListBulletIcon className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <h4 className="text-base font-semibold mb-1">Process Builder</h4>
                            <p className="text-sm text-muted-foreground mb-3">{sopsCount} SOPs created</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white"
                                onClick={() => router.push("/dashboard/process-builder")}
                            >
                                <Plus className="h-3 w-3 mr-2" />
                                Generate Process
                                <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                    <Brain className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <h4 className="text-base font-semibold mb-1">AI Business Brain</h4>
                            <p className="text-sm text-muted-foreground mb-3">24 conversations</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white"
                                onClick={() => router.push("/dashboard/ai-business-brain")}
                            >
                                <Plus className="h-3 w-3 mr-2" />
                                Start New Chat
                                <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                    <LightBulbIcon className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <h4 className="text-base font-semibold mb-1">Knowledge Base</h4>
                            <p className="text-sm text-muted-foreground mb-3">{Math.round(kbCompletion)}% complete</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white"
                                onClick={() => router.push("/dashboard/organization-profile")}
                            >
                                {isKBComplete() ? (
                                    <>
                                        Improve Setup
                                        <ChevronRight className="h-3 w-3 ml-1" />
                                    </>
                                ) : (
                                    <>
                                        Complete Setup
                                        <ChevronRight className="h-3 w-3 ml-1" />
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    const renderTeamSection = () => {
        if (isLoadingTeam) {
            return (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Team</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <Skeleton key={idx} className="h-8 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            );
        }

        if (teamError || teamMembers.length === 0) {
            return null; // Hide if no team
        }

        const currentUser = teamMembers.find((member) => member.userId === user?.id);
        const otherMembers = teamMembers.filter((member) => member.userId !== user?.id).slice(0, 4);
        const activeCount = teamMembers.length;

        return (
            <Card>
                <CardHeader className="pb-0 gap-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Team</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/tenants")}>
                            Manage
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="text-base text-muted-foreground">
                        {activeCount} members • 3 active now
                    </div>
                    <div className="space-y-2">
                        {currentUser && (
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="h-8 w-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-xs font-semibold text-[var(--primary-dark)]">
                                    {`${currentUser.firstname?.[0] ?? ""}${currentUser.lastname?.[0] ?? ""}`.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold">{currentUser.firstname} {currentUser.lastname}</div>
                                    <div className="text-xs text-muted-foreground">You • {currentUser.role}</div>
                                </div>
                            </div>
                        )}
                        {otherMembers.map((member) => (
                            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                                    {`${member.firstname?.[0] ?? ""}${member.lastname?.[0] ?? ""}`.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold">{member.firstname} {member.lastname}</div>
                                    <div className="text-xs text-muted-foreground">{member.role}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    };


    const progressCount = getProgressCount();

    return (
        <div className="flex-1 space-y-6 py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.firstname || "User"}</h1>
                </div>
                <SidebarTrigger />
            </div>

            {/* Compact Hero Section */}
            {!isLoadingOnboarding && renderHeroSection()}

            {/* Main Content: 2-Column Layout */}
            <div className="grid gap-6 lg:grid-cols-[65%_35%]">
                {/* Left Column: Stats + Tools */}
                <div className="space-y-6">
                    {/* Stats Section - Top Priority */}
                    {renderStatsSection()}

                    {/* Tools Section - Below Stats */}
                    {!isLoading && renderToolsSection()}
                </div>

                {/* Right Column: Team + Setup Progress */}
                <div className="space-y-6">
                    {/* Team Section - Moved to top */}
                    {renderTeamSection()}

                    {/* Setup Progress - Replaces Quick Actions */}
                    {!isLoadingOnboarding && renderSetupProgress()}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
