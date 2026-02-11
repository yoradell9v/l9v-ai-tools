"use client";

import { useEffect, useState, useRef } from "react";
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
    // Task Intelligence: submitted (non-draft) tasks for Getting Started
    submittedTasksCount?: number;
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

/** Animates from 0 to target over duration when enabled. */
function useCountUp(target: number, enabled: boolean, durationMs = 800) {
    const [value, setValue] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
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
    const [kbBannerDismissed, setKbBannerDismissed] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try {
            return localStorage.getItem("dashboard-kb-banner-dismissed") === "true";
        } catch {
            return false;
        }
    });

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

    /** True if user has submitted at least one task (non-draft) in Task Intelligence. */
    const hasSubmittedTask = () => {
        if (!stats) return false;
        return (stats.submittedTasksCount ?? 0) > 0;
    };

    const getProgressCount = () => {
        return [isKBComplete(), hasSOP(), hasRole(), hasSubmittedTask()].filter(Boolean).length;
    };

    // Targets for count-up and progress animations (computed from current state)
    const kbCompletionTarget = getKBCompletion();
    const progressCountTarget = getProgressCount();
    const progressPercentTarget = (progressCountTarget / 4) * 100;
    const rolesCountTarget = stats ? (stats.organizationAnalyses || stats.myAnalyses || stats.totalAnalyses || 0) : 0;
    const sopsCountTarget = stats ? (stats.organizationSOPs || stats.mySOPs || stats.totalSOPs || 0) : 0;
    const teamCountTarget = stats ? (stats.organizationMembers || 0) : 0;
    const conversationsCountTarget = stats ? (stats.organizationConversations || stats.myConversations || stats.totalConversations || 0) : 0;

    const animatedKb = useCountUp(kbCompletionTarget, !isLoadingOnboarding, 700);
    const animatedProgressCount = useCountUp(progressCountTarget, !isLoadingOnboarding, 600);
    const animatedProgressPercent = useCountUp(Math.round(progressPercentTarget), !isLoadingOnboarding, 900);
    const animatedRoles = useCountUp(rolesCountTarget, !!stats && !isLoading, 700);
    const animatedSops = useCountUp(sopsCountTarget, !!stats && !isLoading, 700);
    const animatedTeam = useCountUp(teamCountTarget, !!stats && !isLoading, 700);
    const animatedConversations = useCountUp(conversationsCountTarget, !!stats && !isLoading, 700);

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

        if (!isComplete && kbCompletion < 100 && !kbBannerDismissed) {
            const timeEstimate = estimateTimeToComplete(kbCompletion);
            const remainingFields = onboardingStatus?.completionStatus?.missingFields?.length || 0;

            const handleSkipBanner = () => {
                setKbBannerDismissed(true);
                try {
                    localStorage.setItem("dashboard-kb-banner-dismissed", "true");
                } catch {}
            };

            return (
                <Card className="animate-dashboard-card-in opacity-0 py-2 px-3 md:py-2 md:px-4">
                    <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-base font-semibold mb-1 md:text-lg">Complete Your Knowledge Base</h2>
                                <p className="text-sm text-muted-foreground md:text-base">
                                    {Math.round(kbCompletion)}% complete • {remainingFields} fields remaining • ~{timeEstimate} min
                                </p>
                            </div>
                            <div className="flex flex-shrink-0 gap-2">
                                <Button
                                    onClick={handleCompleteKnowledgeBase}
                                    size="sm"
                                    className="flex-1 sm:flex-none bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                >
                                    Complete Now
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSkipBanner}
                                    className="flex-1 sm:flex-none border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
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
    const renderSetupProgress = (animatedPercent?: number, animatedCount?: number) => {
        const progressCount = getProgressCount();
        const progressPercent = (progressCount / 4) * 100;
        const displayPercent = animatedPercent ?? Math.round(progressPercent);
        const displayCount = animatedCount ?? progressCount;

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
                completed: hasSubmittedTask(),
                action: () => router.push("/dashboard/task-intelligence"),
            },
        ];

        // Find first incomplete task
        const firstIncompleteIndex = tasks.findIndex((task) => !task.completed);
        const firstIncomplete = firstIncompleteIndex !== -1 ? tasks[firstIncompleteIndex] : null;

        return (
            <Card className="animate-dashboard-card-in opacity-0" style={{ animationDelay: "200ms" }}>
                <CardHeader className="pb-0 p-3 md:p-6 md:pb-0">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 md:text-xl">
                            <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
                            Getting Started
                        </CardTitle>
                        <span className="text-xl font-bold text-[var(--primary-dark)] tabular-nums md:text-2xl">
                            {displayPercent}%
                        </span>
                    </div>
                    <CardDescription className="text-sm md:text-base">
                        {displayCount} of 4 complete
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3 pt-0 md:space-y-4 md:p-6 md:pt-0">
                    {/* Gradient Progress Bar - animates from 0 to value */}
                    <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden md:h-3">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${displayPercent}%`,
                                background: "linear-gradient(90deg, #f0b214 0%, #1374B4 100%)",
                            }}
                        />
                    </div>

                    {/* Checklist Items */}
                    <div className="space-y-2 md:space-y-3">
                        {tasks.map((task, index) => {
                            const isFirstIncomplete = !task.completed && index === firstIncompleteIndex;

                            return (
                                <div
                                    key={task.id}
                                    className={`p-2.5 rounded-lg border transition-all md:p-3 ${task.completed
                                        ? "bg-muted/30 border-muted"
                                        : isFirstIncomplete
                                            ? "border-[color:var(--accent-strong)] border-2 bg-[color:var(--accent-strong)]/5"
                                            : "border-border"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2 md:gap-3">
                                        <div className="flex items-start gap-2 flex-1 min-w-0 md:gap-3">
                                            {task.completed ? (
                                                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5 md:h-5 md:w-5" />
                                            ) : (
                                                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 md:h-5 md:w-5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4
                                                    className={`text-sm font-semibold md:text-base ${task.completed ? "line-through text-muted-foreground" : ""
                                                        }`}
                                                >
                                                    {task.title}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-0.5 md:text-sm">
                                                    {task.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        {isFirstIncomplete && (
                                            <Button
                                                onClick={task.action}
                                                size="sm"
                                                className="bg-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/90 text-[color:var(--primary)] flex-shrink-0 text-xs md:text-sm"
                                            >
                                                Start
                                                <ChevronRight className="h-3 w-3 ml-1 md:h-4 md:w-4" />
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
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-3 md:p-4">
                                <Skeleton className="h-6 w-12 mb-1.5 md:h-8 md:w-16 md:mb-2" />
                                <Skeleton className="h-3 w-16 mb-1.5 md:h-4 md:w-24 md:mb-2" />
                                <Skeleton className="h-4 w-14 md:h-5 md:w-20" />
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
            <div className="space-y-3 md:space-y-4">
                <h3 className="text-base font-semibold md:text-lg">Workspace Overview</h3>
                <div className="grid grid-cols-3 gap-2 md:gap-4">

                    <Card
                        className="animate-dashboard-card-in opacity-0 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative"
                        style={{ animationDelay: "0ms" }}
                        onClick={() => router.push("/dashboard/organization-profile")}
                    >
                        <CardContent className="p-3 md:p-4">
                            <ChevronRight className="h-3 w-3 text-muted-foreground absolute top-2 right-2 md:h-4 md:w-4 md:top-4 md:right-4" />
                            <div className="flex items-center gap-1.5 mb-1 md:gap-2 md:mb-2">
                                <LightBulbIcon className="h-4 w-4 text-[var(--primary-dark)] md:h-5 md:w-5" />
                                <span className="text-xs font-semibold md:text-base">KB</span>
                            </div>
                            <div className="text-lg font-bold mb-0.5 tabular-nums md:text-2xl md:mb-1">{animatedKb}%</div>
                            <Badge className="text-[10px] px-1.5 py-0 mb-1 bg-[var(--primary-dark)] text-white md:text-xs md:mb-2 md:px-2 md:py-0.5">
                                {kbStatus}
                            </Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="animate-dashboard-card-in opacity-0 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative"
                        style={{ animationDelay: "80ms" }}
                        onClick={() => router.push("/dashboard/role-builder")}
                    >
                        <CardContent className="p-3 md:p-4">
                            <ChevronRight className="h-3 w-3 text-muted-foreground absolute top-2 right-2 md:h-4 md:w-4 md:top-4 md:right-4" />
                            <div className="flex items-center gap-1.5 mb-1 md:gap-2 md:mb-2">
                                <BriefcaseIcon className="h-4 w-4 text-[var(--primary-dark)] md:h-5 md:w-5" />
                                <span className="text-xs font-semibold md:text-base">Roles</span>
                            </div>
                            <div className="text-lg font-bold mb-0.5 tabular-nums md:text-2xl md:mb-1">{animatedRoles}</div>
                            <Badge className={`text-[10px] px-1.5 py-0 mb-1 md:text-xs md:mb-2 md:px-2 md:py-0.5 ${isToolReady('jobDescriptionBuilder') ? 'bg-[var(--primary-dark)] text-white' : 'bg-muted text-muted-foreground'}`}>
                                {isToolReady('jobDescriptionBuilder') ? '✓ Ready' : 'Not Ready'}
                            </Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="animate-dashboard-card-in opacity-0 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative"
                        style={{ animationDelay: "160ms" }}
                        onClick={() => router.push("/dashboard/process-builder")}
                    >
                        <CardContent className="p-3 md:p-4">
                            <ChevronRight className="h-3 w-3 text-muted-foreground absolute top-2 right-2 md:h-4 md:w-4 md:top-4 md:right-4" />
                            <div className="flex items-center gap-1.5 mb-1 md:gap-2 md:mb-2">
                                <ClipboardDocumentCheckIcon className="h-4 w-4 text-[var(--primary-dark)] md:h-5 md:w-5" />
                                <span className="text-xs font-semibold md:text-base">SOPs</span>
                            </div>
                            <div className="text-lg font-bold mb-0.5 tabular-nums md:text-2xl md:mb-1">{animatedSops}</div>
                            <Badge className={`text-[10px] px-1.5 py-0 mb-1 md:text-xs md:mb-2 md:px-2 md:py-0.5 ${isToolReady('sopGenerator') ? 'bg-[var(--primary-dark)] text-white' : 'bg-muted text-muted-foreground'}`}>
                                {sopsCreatedToday > 0 ? `+${sopsCreatedToday} today` : (isToolReady('sopGenerator') ? '✓ Ready' : 'Not Ready')}
                            </Badge>
                        </CardContent>
                    </Card>
                </div>

                {teamCount > 0 && (
                    <Card
                        className="animate-dashboard-card-in opacity-0 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
                        style={{ animationDelay: "240ms" }}
                        onClick={() => router.push("/dashboard/tenants")}
                    >
                        <CardContent className="p-3 md:p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                    <div className="flex items-center gap-2">
                                        <UserGroupIcon className="h-4 w-4 text-[var(--primary-dark)] md:h-5 md:w-5" />
                                        <span className="text-sm font-semibold md:text-base">Team: <span className="tabular-nums">{animatedTeam}</span> members</span>
                                    </div>
                                    {conversationsCount > 0 && (
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-3 w-3 text-muted-foreground md:h-4 md:w-4" />
                                            <span className="text-xs text-muted-foreground tabular-nums md:text-base">{animatedConversations} conversations</span>
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" className="self-start sm:self-center text-xs md:text-sm">
                                    Manage team
                                    <ChevronRight className="h-3 w-3 ml-1 md:h-4 md:w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    const renderToolsSection = () => {
        return (
            <div className="space-y-3 md:space-y-4">
                <h3 className="text-base font-semibold md:text-lg">Your Tools</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-4">

                    <Card className="animate-dashboard-card-in opacity-0 group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1" style={{ animationDelay: "100ms" }}>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-start justify-between mb-2 md:mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)] md:h-10 md:w-10">
                                    <BriefcaseIcon className="h-4 w-4 text-white md:h-5 md:w-5" />
                                </div>
                            </div>
                            <h4 className="text-sm font-semibold mb-0.5 md:text-base md:mb-1">Role Builder</h4>
                            <p className="text-xs text-muted-foreground mb-2 tabular-nums md:text-sm md:mb-3">{animatedRoles} active roles</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white text-xs md:text-sm h-8 md:h-9"
                                onClick={() => router.push("/dashboard/role-builder")}
                            >
                                <Plus className="h-3 w-3 mr-1.5 md:mr-2" />
                                <span className="sm:hidden">New Role</span>
                                <span className="hidden sm:inline">Define New Role</span>
                                <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="animate-dashboard-card-in opacity-0 group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1" style={{ animationDelay: "180ms" }}>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-start justify-between mb-2 md:mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)] md:h-10 md:w-10">
                                    <ListBulletIcon className="h-4 w-4 text-white md:h-5 md:w-5" />
                                </div>
                            </div>
                            <h4 className="text-sm font-semibold mb-0.5 md:text-base md:mb-1">Process Builder</h4>
                            <p className="text-xs text-muted-foreground mb-2 tabular-nums md:text-sm md:mb-3">{animatedSops} SOPs created</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white text-xs md:text-sm h-8 md:h-9"
                                onClick={() => router.push("/dashboard/process-builder")}
                            >
                                <Plus className="h-3 w-3 mr-1.5 md:mr-2" />
                                <span className="hidden sm:inline">Generate Process</span>
                                <span className="sm:hidden">Process</span>
                                <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="animate-dashboard-card-in opacity-0 group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1" style={{ animationDelay: "260ms" }}>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-start justify-between mb-2 md:mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)] md:h-10 md:w-10">
                                    <Brain className="h-4 w-4 text-white md:h-5 md:w-5" />
                                </div>
                            </div>
                            <h4 className="text-sm font-semibold mb-0.5 md:text-base md:mb-1">AI Business Brain</h4>
                            <p className="text-xs text-muted-foreground mb-2 tabular-nums md:text-sm md:mb-3">{animatedConversations} conversations</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white text-xs md:text-sm h-8 md:h-9"
                                onClick={() => router.push("/dashboard/ai-business-brain")}
                            >
                                <Plus className="h-3 w-3 mr-1.5 md:mr-2" />
                                <span className="hidden sm:inline">Start New Chat</span>
                                <span className="sm:hidden">New Chat</span>
                                <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="animate-dashboard-card-in opacity-0 group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1" style={{ animationDelay: "340ms" }}>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-start justify-between mb-2 md:mb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)] md:h-10 md:w-10">
                                    <LightBulbIcon className="h-4 w-4 text-white md:h-5 md:w-5" />
                                </div>
                            </div>
                            <h4 className="text-sm font-semibold mb-0.5 md:text-base md:mb-1">Knowledge Base</h4>
                            <p className="text-xs text-muted-foreground mb-2 tabular-nums md:text-sm md:mb-3">{animatedKb}% complete</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white text-xs md:text-sm h-8 md:h-9"
                                onClick={() => router.push("/dashboard/organization-profile")}
                            >
                                {isKBComplete() ? (
                                    <>
                                        <span className="hidden sm:inline">Improve Setup</span>
                                        <span className="sm:hidden">Improve</span>
                                        <ChevronRight className="h-3 w-3 ml-1" />
                                    </>
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">Complete Setup</span>
                                        <span className="sm:hidden">Complete</span>
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
                    <CardHeader className="pb-2 p-3 md:pb-3 md:p-6">
                        <CardTitle className="text-sm md:text-base">Team</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                        <div className="space-y-1.5 md:space-y-2">
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <Skeleton key={idx} className="h-7 w-full md:h-8" />
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
            <Card className="animate-dashboard-card-in opacity-0" style={{ animationDelay: "120ms" }}>
                <CardHeader className="pb-0 gap-0 p-3 md:p-6 md:pb-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold md:text-base">Team</CardTitle>
                        <Button variant="ghost" size="sm" className="text-xs md:text-sm h-8 md:h-9" onClick={() => router.push("/dashboard/tenants")}>
                            Manage
                            <ChevronRight className="h-3 w-3 ml-1 md:h-4 md:w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1.5 p-3 pt-0 md:space-y-2 md:p-6 md:pt-0">
                    <div className="text-xs text-muted-foreground md:text-base">
                        {activeCount} members • 3 active now
                    </div>
                    <div className="space-y-1 md:space-y-2">
                        {currentUser && (
                            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors md:gap-3 md:p-2">
                                <div className="h-7 w-7 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[10px] font-semibold text-[var(--primary-dark)] md:h-8 md:w-8 md:text-xs">
                                    {`${currentUser.firstname?.[0] ?? ""}${currentUser.lastname?.[0] ?? ""}`.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold truncate md:text-sm">{currentUser.firstname} {currentUser.lastname}</div>
                                    <div className="text-[10px] text-muted-foreground md:text-xs">You • {currentUser.role}</div>
                                </div>
                            </div>
                        )}
                        {otherMembers.map((member) => (
                            <div key={member.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors md:gap-3 md:p-2">
                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold md:h-8 md:w-8 md:text-xs">
                                    {`${member.firstname?.[0] ?? ""}${member.lastname?.[0] ?? ""}`.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold truncate md:text-sm">{member.firstname} {member.lastname}</div>
                                    <div className="text-[10px] text-muted-foreground md:text-xs">{member.role}</div>
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
        <div className="flex-1 space-y-4 py-6 px-4 md:space-y-6 md:py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl truncate">Welcome, {user?.firstname || "User"}</h1>
                </div>
                <SidebarTrigger className="flex-shrink-0" />
            </div>

            {/* Compact Hero Section */}
            {!isLoadingOnboarding && renderHeroSection()}

            {/* Main Content: 2-Column Layout */}
            <div className="grid gap-4 lg:gap-6 lg:grid-cols-[65%_35%]">
                {/* Left Column: Stats + Tools */}
                <div className="space-y-4 md:space-y-6">
                    {/* Stats Section - Top Priority */}
                    {renderStatsSection()}

                    {/* Tools Section - Below Stats */}
                    {!isLoading && renderToolsSection()}
                </div>

                {/* Right Column: Team + Setup Progress */}
                <div className="space-y-4 md:space-y-6">
                    {/* Team Section - Moved to top */}
                    {renderTeamSection()}

                    {/* Setup Progress - Replaces Quick Actions */}
                    {!isLoadingOnboarding && renderSetupProgress(animatedProgressPercent, animatedProgressCount)}
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
