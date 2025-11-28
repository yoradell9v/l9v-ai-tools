"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";
import { useUser } from "@/context/UserContext";
import {
    Building2,
    Users,
    FileText,
    Brain,
    FileCheck,
    Mail,
    Briefcase,
    Sparkles,
} from "lucide-react";
import Loader from "@/components/ui/Loader";

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
    color?: string;
}

const StatCard = ({ icon: Icon, label, value, color = "primary" }: StatCardProps) => {
    return (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                        {label}
                    </p>
                    <p className="text-3xl font-bold text-[var(--primary)] dark:text-[var(--accent)]">
                        {value.toLocaleString()}
                    </p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--accent)]/10 dark:bg-[var(--primary-light)]/10">
                    <Icon size={24} className="text-amber-500 dark:text-[var(--primary-light)]" />
                </div>
            </div>
        </div>
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
        <>
            <Navbar />
            <div className="transition-all duration-300 ease-in-out ml-64 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <h1 className="text-2xl font-semibold text-[#18416B] dark:text-[#FAC133] mb-2">
                            Dashboard
                        </h1>
                        <p className="text-sm text-[var(--text-secondary)]">
                            {user?.globalRole === "SUPERADMIN"
                                ? "Overview of all system statistics"
                                : stats && stats.organizationMembers !== undefined
                                    ? "Your organization statistics"
                                    : "Your personal statistics"}
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader />
                        </div>
                    ) : error ? (
                        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {renderStatsCards()}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}