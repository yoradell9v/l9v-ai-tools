"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/context/UserContext";
import {
    Brain,
    AlertCircle,
    X,
    ArrowRight,
    Info,
    Lightbulb,
    Plus,
    CheckCircle2,
    Circle
} from "lucide-react";
import {
    BriefcaseIcon,
    ListBulletIcon,
    LightBulbIcon,
    BuildingOffice2Icon,
    UserGroupIcon,
    DocumentTextIcon,
    ClipboardDocumentCheckIcon,
    EnvelopeIcon,
    ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
}

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: number;
    relatedTool?: string;
    href?: string;
}

const StatCard = ({ icon: Icon, label, value, relatedTool, href }: StatCardProps) => {
    const handleClick = () => {
        if (href) {
            window.location.href = href;
        }
    };

    return (
        <Card className="group cursor-pointer transition-all duration-200" onClick={handleClick}>
            <CardContent className="px-6 py-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary-dark)] to-[var(--primary-light)]">
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                    {href && (
                        <ArrowRightIcon className="h-5 w-5 text-muted-foreground group-hover:text-[var(--primary-dark)] transition-colors" />
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-bold">{value.toLocaleString()}</p>
                    <p className="text-base font-medium text-muted-foreground">{label}</p>
                    {relatedTool && (
                        <p className="text-base font-bold text-[color:var(--text-primary)] mt-2">{relatedTool}</p>
                    )}
                </div>
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

        if (user?.globalRole === "SUPERADMIN") {
            return (
                <>
                    <StatCard
                        icon={BuildingOffice2Icon}
                        label="Total Organizations"
                        value={stats.totalOrganizations || 0}
                        relatedTool="Organizations"
                        href="/dashboard/tenants"
                    />
                    <StatCard
                        icon={UserGroupIcon}
                        label="Total Users"
                        value={stats.totalUsers || 0}
                        relatedTool="Users"
                        href="/dashboard/tenants"
                    />
                    <StatCard
                        icon={BriefcaseIcon}
                        label="Total Roles"
                        value={stats.totalAnalyses || 0}
                        relatedTool="Role Builder"
                        href="/dashboard/role-builder"
                    />
                    <StatCard
                        icon={ClipboardDocumentCheckIcon}
                        label="Total SOPs"
                        value={stats.totalSOPs || 0}
                        relatedTool="Process Builder"
                        href="/dashboard/process-builder"
                    />
                    <StatCard
                        icon={LightBulbIcon}
                        label="Knowledge Bases"
                        value={stats.totalKnowledgeBases || 0}
                        relatedTool="Knowledge Base"
                        href="/dashboard/organization-profile"
                    />
                    <StatCard
                        icon={EnvelopeIcon}
                        label="Pending Invitations"
                        value={stats.pendingInvitations || 0}
                        relatedTool="Invitations"
                        href="/dashboard/tenants"
                    />
                </>
            );
        }

        if (stats.organizationMembers !== undefined) {
            return (
                <>
                    <StatCard
                        icon={UserGroupIcon}
                        label="Organization Members"
                        value={stats.organizationMembers || 0}
                        relatedTool="Members"
                        href="/dashboard/tenants"
                    />
                    <StatCard
                        icon={BriefcaseIcon}
                        label="Roles"
                        value={stats.organizationAnalyses || 0}
                        relatedTool="Role Builder"
                        href="/dashboard/role-builder"
                    />
                    <StatCard
                        icon={ClipboardDocumentCheckIcon}
                        label="SOPs"
                        value={stats.organizationSOPs || 0}
                        relatedTool="Process Builder"
                        href="/dashboard/process-builder"
                    />
                    <StatCard
                        icon={LightBulbIcon}
                        label="Knowledge Bases"
                        value={stats.organizationKnowledgeBases || 0}
                        relatedTool="Knowledge Base"
                        href="/dashboard/organization-profile"
                    />
                    <StatCard
                        icon={EnvelopeIcon}
                        label="Pending Invitations"
                        value={stats.pendingInvitations || 0}
                        relatedTool="Invitations"
                        href="/dashboard/tenants"
                    />
                </>
            );
        }

        return (
            <>
                <StatCard
                    icon={BriefcaseIcon}
                    label="My Roles"
                    value={stats.myAnalyses || 0}
                    relatedTool="Role Builder"
                    href="/dashboard/role-builder"
                />
                <StatCard
                    icon={ClipboardDocumentCheckIcon}
                    label="My SOPs"
                    value={stats.mySOPs || 0}
                    relatedTool="Process Builder"
                    href="/dashboard/process-builder"
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
                            <ScrollArea className="flex-1 min-h-0">
                                <div className="px-6 space-y-5">
                                    <div className="bg-gradient-to-r from-[color:var(--accent-strong)]/10 to-[color:var(--accent-strong)]/5 border border-[color:var(--accent-strong)]/20 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <Lightbulb className="h-5 w-5 text-[color:var(--accent-strong)] mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-base font-semibold text-[color:var(--text-primary)] mb-1">
                                                    Your Knowledge Base powers everything
                                                </p>
                                                <p className="text-base text-[color:var(--text-secondary)] leading-relaxed">
                                                    This single source of truth feeds all your tools—Job Descriptions, SOPs, Business Brain conversations, and more. The more complete it is, the smarter your results become.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className=" p-4 rounded-lg space-y-3 border border-[color:var(--border-color)]">
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
                                </div>
                            </ScrollArea>

                            <div className="flex gap-2 pt-4 pb-6 px-6 border-t flex-shrink-0">
                                <Button
                                    onClick={handleCompleteKnowledgeBase}
                                    className="flex-1 bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                >
                                    <Brain className="h-4 w-4 mr-2" />
                                    Complete Knowledge Base
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={dismissModal}
                                    className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white"
                                >
                                    Maybe Later
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex-1 space-y-6 py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">
                            Welcome, {user?.firstname || "User"}
                        </h2>
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
                        <CardContent>
                            <div className="flex items-start justify-between gap-4">
                                {/* Header */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--accent-strong)]/10 flex-shrink-0">
                                        <Brain className="h-5 w-5 text-[color:var(--accent-strong)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">
                                                Complete Your Knowledge Base
                                            </h3>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[color:var(--accent-strong)] text-white uppercase tracking-wide">
                                                Required
                                            </span>
                                        </div>
                                        <p className="text-base text-[color:var(--text-secondary)] leading-relaxed">
                                            Build your single source of truth to unlock smarter AI-powered job descriptions, SOPs, and conversations.
                                        </p>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    onClick={handleCompleteKnowledgeBase}
                                    size="lg"
                                    className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white font-medium px-6 py-6 text-base flex-shrink-0"
                                >
                                    Complete Knowledge Base
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="px-6 py-4">
                                    <Skeleton className="h-12 w-12 rounded-lg mb-3" />
                                    <Skeleton className="h-8 w-16 mb-2" />
                                    <Skeleton className="h-4 w-24 mb-2" />
                                    <Skeleton className="h-5 w-20" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {renderStatsCards()}
                    </div>
                )}

                {/* Your Tools and Getting Started Section */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Your Tools - Takes 2 columns */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-xl font-semibold">Your Tools</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Role Builder Card */}
                            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                            <BriefcaseIcon className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-semibold mb-2">Role Builder</h4>
                                    <p className="text-base text-muted-foreground mb-4">
                                        Create comprehensive job descriptions tailored to your organization's needs.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white font-bold"
                                        onClick={() => router.push("/dashboard/role-builder")}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Define New Role
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Process Builder Card */}
                            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                            <ListBulletIcon className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-semibold mb-2">Process Builder</h4>
                                    <p className="text-base text-muted-foreground mb-4">
                                        Generate detailed standard operating procedures for your team.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white font-bold"
                                        onClick={() => router.push("/dashboard/process-builder")}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Generate New Process
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* AI Business Brain Card */}
                            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                            <Brain className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-semibold mb-2">AI Business Brain</h4>
                                    <p className="text-base text-muted-foreground mb-4">
                                        Get AI-powered insights and answers about your business operations.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white font-bold"
                                        onClick={() => router.push("/dashboard/ai-business-brain")}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Start New Chat
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Knowledge Base Card */}
                            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent-light)]">
                                            <LightBulbIcon className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-semibold mb-2">Knowledge Base</h4>
                                    <p className="text-base text-muted-foreground mb-4">
                                        Build and manage your organization's knowledge repository.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)] hover:text-white font-bold"
                                        onClick={() => router.push("/dashboard/organization-profile")}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Improve Knowledge Base
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Getting Started - Takes 1 column */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Getting Started</h3>
                        <Card>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {(() => {
                                        const isKBComplete = onboardingStatus && !onboardingStatus.needsOnboarding;

                                        // Check SOP completion based on user role
                                        const hasSOP = stats
                                            ? (user?.globalRole === "SUPERADMIN" && (stats.totalSOPs ?? 0) > 0) ||
                                            (user?.globalRole === "ADMIN" && (stats.organizationSOPs ?? 0) > 0) ||
                                            (user?.globalRole === "MEMBER" && (stats.mySOPs ?? 0) > 0) ||
                                            (stats.mySOPs ?? 0) > 0 ||
                                            (stats.organizationSOPs ?? 0) > 0 ||
                                            (stats.totalSOPs ?? 0) > 0
                                            : false;

                                        // Check role/analysis completion based on user role
                                        const hasRole = stats
                                            ? (user?.globalRole === "SUPERADMIN" && (stats.totalAnalyses ?? 0) > 0) ||
                                            (user?.globalRole === "ADMIN" && (stats.organizationAnalyses ?? 0) > 0) ||
                                            (user?.globalRole === "MEMBER" && (stats.myAnalyses ?? 0) > 0) ||
                                            (stats.myAnalyses ?? 0) > 0 ||
                                            (stats.organizationAnalyses ?? 0) > 0 ||
                                            (stats.totalAnalyses ?? 0) > 0
                                            : false;

                                        // Check conversation completion based on user role
                                        const hasConversation = stats
                                            ? (user?.globalRole === "SUPERADMIN" && (stats.totalConversations ?? 0) > 0) ||
                                            (user?.globalRole === "ADMIN" && (stats.organizationConversations ?? 0) > 0) ||
                                            (user?.globalRole === "MEMBER" && (stats.myConversations ?? 0) > 0) ||
                                            (stats.myConversations ?? 0) > 0 ||
                                            (stats.organizationConversations ?? 0) > 0 ||
                                            (stats.totalConversations ?? 0) > 0
                                            : false;

                                        const completedCount = [
                                            isKBComplete,
                                            hasSOP,
                                            hasRole,
                                            hasConversation,
                                        ].filter(Boolean).length;

                                        return (
                                            <>
                                                <div className="flex items-center justify-between pb-3 border-b">
                                                    <span className="text-base font-medium text-muted-foreground">Progress</span>
                                                    <span className="text-base font-semibold">
                                                        {completedCount} of 4 complete
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => router.push("/dashboard/organization-profile")}
                                                    >
                                                        {isKBComplete ? (
                                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                        )}
                                                        <span className={`text-base ${isKBComplete ? "text-muted-foreground line-through" : ""}`}>
                                                            Setup org knowledge base
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => router.push("/dashboard/process-builder")}
                                                    >
                                                        {hasSOP ? (
                                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                        )}
                                                        <span className={`text-base ${hasSOP ? "text-muted-foreground line-through" : ""}`}>
                                                            Create your first SOP
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => router.push("/dashboard/role-builder")}
                                                    >
                                                        {hasRole ? (
                                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                        )}
                                                        <span className={`text-base ${hasRole ? "text-muted-foreground line-through" : ""}`}>
                                                            Define a role
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => router.push("/dashboard/ai-business-brain")}
                                                    >
                                                        {hasConversation ? (
                                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                        )}
                                                        <span className={`text-base ${hasConversation ? "text-muted-foreground line-through" : ""}`}>
                                                            Talk with your AI Business Brain
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}