"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/context/UserContext";
import {
    Building2,
    Users,
    FileText,
    Brain,
    FileCheck,
    Mail,
    AlertCircle,
    X,
    ArrowRight,
    Info,
    Lightbulb
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { checkOnboardingStatus, type OnboardingStatus } from "@/lib/organizationKnowledgeBase";

interface DashboardStats {
    // SUPERADMIN stats
    totalOrganizations?: number;
    totalUsers?: number;
    totalAnalyses?: number;
    totalSOPs?: number;
    totalKnowledgeBases?: number;
    pendingInvitations?: number;
    // ADMIN stats
    organizationMembers?: number;
    organizationAnalyses?: number;
    organizationSOPs?: number;
    organizationKnowledgeBases?: number;
    // MEMBER stats
    myAnalyses?: number;
    mySOPs?: number;
}

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: number;
}

const StatCard = ({ icon: Icon, label, value }: StatCardProps) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--accent-strong)]/15">
                    <Icon className="h-4 w-4 text-[color:var(--accent-strong)]" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
};

export default function DashboardPage() {
    const { user } = useUser();
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);

    const isModalDismissed = () => {
        if (typeof window === "undefined") return false;
        return sessionStorage.getItem("onboardingModalDismissed") === "true";
    };

    const dismissModal = () => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("onboardingModalDismissed", "true");
            setShowOnboardingModal(false);
        }
    };

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

                        if (status.needsOnboarding && !isModalDismissed()) {
                            setShowOnboardingModal(true);
                        }
                    } else {
                        const status = checkOnboardingStatus(null);
                        setOnboardingStatus(status);
                        if (!isModalDismissed()) {
                            setShowOnboardingModal(true);
                        }
                    }
                } else {
                    const status = checkOnboardingStatus(null);
                    setOnboardingStatus(status);
                    if (!isModalDismissed()) {
                        setShowOnboardingModal(true);
                    }
                }
            } catch (err) {
                console.error("Error fetching onboarding status:", err);
                const status = checkOnboardingStatus(null);
                setOnboardingStatus(status);
                if (!isModalDismissed()) {
                    setShowOnboardingModal(true);
                }
            } finally {
                setIsLoadingOnboarding(false);
            }
        };

        fetchStats();
        fetchOnboardingStatus();
    }, []);

    const renderStatsCards = () => {
        if (!stats) return null;

        // SUPERADMIN cards
        if (user?.globalRole === "SUPERADMIN") {
            return (
                <>
                    <StatCard
                        icon={Building2}
                        label="Total Organizations"
                        value={stats.totalOrganizations || 0}
                    />
                    <StatCard
                        icon={Users}
                        label="Total Users"
                        value={stats.totalUsers || 0}
                    />
                    <StatCard
                        icon={FileText}
                        label="Total Analyses"
                        value={stats.totalAnalyses || 0}
                    />
                    <StatCard
                        icon={FileCheck}
                        label="Total SOPs"
                        value={stats.totalSOPs || 0}
                    />
                    <StatCard
                        icon={Brain}
                        label="Knowledge Bases"
                        value={stats.totalKnowledgeBases || 0}
                    />
                    <StatCard
                        icon={Mail}
                        label="Pending Invitations"
                        value={stats.pendingInvitations || 0}
                    />
                </>
            );
        }

        // Check if user is an ADMIN in any organization
        // For now, we'll show ADMIN stats if they have organizations
        if (stats.organizationMembers !== undefined) {
            return (
                <>
                    <StatCard
                        icon={Users}
                        label="Organization Members"
                        value={stats.organizationMembers || 0}
                    />
                    <StatCard
                        icon={FileText}
                        label="Analyses"
                        value={stats.organizationAnalyses || 0}
                    />
                    <StatCard
                        icon={FileCheck}
                        label="SOPs"
                        value={stats.organizationSOPs || 0}
                    />
                    <StatCard
                        icon={Brain}
                        label="Knowledge Bases"
                        value={stats.organizationKnowledgeBases || 0}
                    />
                    <StatCard
                        icon={Mail}
                        label="Pending Invitations"
                        value={stats.pendingInvitations || 0}
                    />
                </>
            );
        }

        // MEMBER cards
        return (
            <>
                <StatCard
                    icon={FileText}
                    label="My Analyses"
                    value={stats.myAnalyses || 0}
                />
                <StatCard
                    icon={FileCheck}
                    label="My SOPs"
                    value={stats.mySOPs || 0}
                />
            </>
        );
    };

    const handleCompleteKnowledgeBase = () => {
        router.push("/dashboard/organization-profile");
    };

    return (
        <>
            <Dialog open={showOnboardingModal} onOpenChange={setShowOnboardingModal}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Brain className="h-5 w-5 text-[color:var(--accent-strong)]" />
                            Complete Your Organization Knowledge Base
                        </DialogTitle>
                    </DialogHeader>
                    {onboardingStatus && onboardingStatus.needsOnboarding && (
                        <>
                            <div className="flex-1 overflow-y-auto px-6 space-y-5 min-h-0">
                                <div className="bg-gradient-to-r from-[color:var(--accent-strong)]/10 to-[color:var(--accent-strong)]/5 border border-[color:var(--accent-strong)]/20 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <Lightbulb className="h-5 w-5 text-[color:var(--accent-strong)] mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-[color:var(--text-primary)] mb-1">
                                                Your Knowledge Base powers everything
                                            </p>
                                            <p className="text-xs text-[color:var(--text-secondary)] leading-relaxed">
                                                This single source of truth feeds all your tools—Job Descriptions, SOPs, Business Brain conversations, and more. The more complete it is, the smarter your results become.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground font-medium">Knowledge Base Completion</span>
                                        <span className="font-semibold">
                                            {onboardingStatus.completionStatus.filled} of {onboardingStatus.completionStatus.total} required fields
                                        </span>
                                    </div>
                                    <Progress
                                        value={onboardingStatus.completionStatus.percentage}
                                        className="h-2.5"
                                    />
                                </div>

                                {onboardingStatus.completionStatus.missingFields.length > 0 && (
                                    <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Missing Required Fields:</p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                                            {onboardingStatus.completionStatus.missingFields.map((field) => (
                                                <li key={field}>{field}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="bg-muted/50 p-4 rounded-lg space-y-3 border border-[color:var(--border-color)]">
                                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">Why complete your Knowledge Base?</p>
                                    <ul className="text-sm text-[color:var(--text-secondary)] space-y-2 list-none">
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
                            </div>

                            <div className="flex gap-2 pt-4 pb-6 px-6 border-t flex-shrink-0">
                                <Button
                                    onClick={handleCompleteKnowledgeBase}
                                    className="flex-1 bg-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/90"
                                >
                                    <Brain className="h-4 w-4 mr-2" />
                                    Complete Knowledge Base
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                                <Button variant="outline" onClick={dismissModal}>
                                    Maybe Later
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                        <p className="text-muted-foreground">
                            {user?.globalRole === "SUPERADMIN"
                                ? "Overview of all system statistics"
                                : stats && stats.organizationMembers !== undefined
                                    ? "Your organization statistics"
                                    : "Your personal statistics"}
                        </p>
                    </div>
                    <SidebarTrigger />
                </div>

                {!isLoadingOnboarding && onboardingStatus && onboardingStatus.needsOnboarding && (
                    <Card>
                        <CardContent className="py-2">
                            <div className="flex items-start gap-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--accent-strong)]/15 flex-shrink-0">
                                    <Brain className="h-4 w-4 text-[color:var(--accent-strong)]" />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-[color:var(--text-primary)] mb-2 flex items-center gap-2">
                                            Complete Your Organization Knowledge Base
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[color:var(--accent-strong)] text-white">
                                                Required
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed">
                                            Your Knowledge Base is the single source of truth that powers all AI tools. Complete it now to unlock smarter, personalized results and save hours of work across Job Descriptions, SOPs, Business Brain conversations, and more.
                                        </p>
                                    </div>

                                    <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-[color:var(--text-primary)] mb-1.5 flex items-center gap-2">
                                                    Knowledge Base Completion
                                                </h4>
                                                <p className="text-xs text-[color:var(--text-secondary)]">
                                                    {onboardingStatus.completionStatus.filled} of {onboardingStatus.completionStatus.total} required fields completed
                                                </p>
                                            </div>
                                            <span className="text-3xl font-bold text-[color:var(--accent-strong)] tabular-nums">
                                                {onboardingStatus.completionStatus.percentage}%
                                            </span>
                                        </div>

                                        {onboardingStatus.completionStatus.missingFields.length > 0 ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="cursor-help">
                                                        <Progress
                                                            value={onboardingStatus.completionStatus.percentage}
                                                            className="h-3"
                                                        />
                                                        <p className="text-xs text-[color:var(--text-muted)] mt-2 flex items-center gap-1.5">
                                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent-strong)]"></span>
                                                            Hover to see missing fields
                                                        </p>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs">
                                                    <p className="font-semibold mb-2 text-sm">Missing Required Fields:</p>
                                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                                        {onboardingStatus.completionStatus.missingFields.map((field) => (
                                                            <li key={field} className="text-left">{field}</li>
                                                        ))}
                                                    </ul>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <div>
                                                <Progress
                                                    value={onboardingStatus.completionStatus.percentage}
                                                    className="h-3"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        onClick={handleCompleteKnowledgeBase}
                                        size="default"
                                        className="w-full bg-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]/90 text-white "
                                    >
                                        <Brain className="h-4 w-4 mr-2" />
                                        Complete Knowledge Base Now
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-4 rounded" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-16" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {renderStatsCards()}
                    </div>
                )}
            </div>
        </>
    );
}