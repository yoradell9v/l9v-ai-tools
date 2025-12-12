"use client";

import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/context/UserContext";
import {
    Building2,
    Users,
    FileText,
    Brain,
    FileCheck,
    Mail,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardStats {
    // SUPERADMIN stats
    totalOrganizations?: number;
    totalUsers?: number;
    totalAnalyses?: number;
    totalBusinessBrains?: number;
    totalSOPs?: number;
    pendingInvitations?: number;
    // ADMIN stats
    organizationMembers?: number;
    organizationAnalyses?: number;
    organizationBusinessBrains?: number;
    organizationSOPs?: number;
    // MEMBER stats
    myAnalyses?: number;
    myBusinessBrains?: number;
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
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

        fetchStats();
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
                        color="primary"
                    />
                    <StatCard
                        icon={Users}
                        label="Total Users"
                        value={stats.totalUsers || 0}
                        color="blue"
                    />
                    <StatCard
                        icon={FileText}
                        label="Total Analyses"
                        value={stats.totalAnalyses || 0}
                        color="green"
                    />
                    <StatCard
                        icon={Brain}
                        label="Business Brains"
                        value={stats.totalBusinessBrains || 0}
                        color="purple"
                    />
                    <StatCard
                        icon={FileCheck}
                        label="Total SOPs"
                        value={stats.totalSOPs || 0}
                        color="orange"
                    />
                    <StatCard
                        icon={Mail}
                        label="Pending Invitations"
                        value={stats.pendingInvitations || 0}
                        color="primary"
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
                        color="blue"
                    />
                    <StatCard
                        icon={FileText}
                        label="Analyses"
                        value={stats.organizationAnalyses || 0}
                        color="green"
                    />
                    <StatCard
                        icon={Brain}
                        label="Business Brains"
                        value={stats.organizationBusinessBrains || 0}
                        color="purple"
                    />
                    <StatCard
                        icon={FileCheck}
                        label="SOPs"
                        value={stats.organizationSOPs || 0}
                        color="orange"
                    />
                    <StatCard
                        icon={Mail}
                        label="Pending Invitations"
                        value={stats.pendingInvitations || 0}
                        color="primary"
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
                    color="green"
                />
                <StatCard
                    icon={Brain}
                    label="My Business Brains"
                    value={stats.myBusinessBrains || 0}
                    color="purple"
                />
                <StatCard
                    icon={FileCheck}
                    label="My SOPs"
                    value={stats.mySOPs || 0}
                    color="orange"
                />
            </>
        );
    };

    return (
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
    );
}