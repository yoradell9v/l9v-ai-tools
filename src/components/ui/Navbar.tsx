"use client";

import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    Wrench,
    Building2,
    User,
    LayoutDashboard,
    FileText,
    BookOpen,
    Brain,
    Users,
    Bookmark
} from "lucide-react";

export interface User {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    createdAt: string;
    globalRole: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

export default function Navbar() {
    const { user } = useUser() as { user: User | null };
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isJdBuilderExpanded, setIsJdBuilderExpanded] = useState(false);

    // Update CSS variable for sidebar width
    useEffect(() => {
        document.documentElement.style.setProperty(
            "--sidebar-width",
            isCollapsed ? "5rem" : "16rem"
        );
    }, [isCollapsed]);

    const toggleSidebar = () => {
        setIsCollapsed((prev) => !prev);
    };

    const isActive = (path: string) => {
        return pathname === path;
    };

    const navItemClasses = (path: string) => {
        const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full";
        const activeClasses = isActive(path)
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--text-primary)] hover:bg-[var(--hover-bg)]";
        return `${baseClasses} ${activeClasses}`;
    };

    if (!user) {
        return null;
    }

    const sidebarWidth = isCollapsed ? "w-20" : "w-64";
    const iconSize = 20;

    return (
        <aside
            className={`${sidebarWidth} fixed left-0 top-0 h-screen border-r transition-all duration-300 ease-in-out flex flex-col`}
            style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--card-bg)"
            }}
        >
            {/* Header with toggle button */}
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} p-4 border-b`} style={{ borderColor: "var(--border-color)" }}>
                {!isCollapsed && (
                    <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                        Menu
                    </h2>
                )}
                <button
                    onClick={toggleSidebar}
                    className={`p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200 ${isCollapsed ? "" : "ml-auto"}`}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? (
                        <ChevronRight size={20} style={{ color: "var(--text-primary)" }} />
                    ) : (
                        <ChevronLeft size={20} style={{ color: "var(--text-primary)" }} />
                    )}
                </button>
            </div>

            {/* Navigation items */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {/* SUPERADMIN Navigation */}
                {user.globalRole === "SUPERADMIN" && (
                    <>
                        <Link
                            href="/dashboard"
                            className={`${navItemClasses("/dashboard")} ${isCollapsed ? "justify-center" : ""}`}
                            title={isCollapsed ? "Dashboard" : undefined}
                        >
                            <LayoutDashboard size={iconSize} className="flex-shrink-0" />
                            {!isCollapsed && <span>Dashboard</span>}
                        </Link>
                        <Link
                            href="/dashboard/tenants"
                            className={`${navItemClasses("/dashboard/tenants")} ${isCollapsed ? "justify-center" : ""}`}
                            title={isCollapsed ? "Tenants" : undefined}
                        >
                            <Building2 size={iconSize} className="flex-shrink-0" />
                            {!isCollapsed && <span>Tenants</span>}
                        </Link>
                    </>
                )}

                {/* ADMIN Navigation */}
                {user.globalRole === "ADMIN" && (
                    <Link
                        href="/dashboard/members"
                        className={`${navItemClasses("/dashboard/members")} ${isCollapsed ? "justify-center" : ""}`}
                        title={isCollapsed ? "Members" : undefined}
                    >
                        <Users size={iconSize} className="flex-shrink-0" />
                        {!isCollapsed && <span>Members</span>}
                    </Link>
                )}

                {/* Divider and Tools Section */}
                {(user.globalRole === "SUPERADMIN" || user.globalRole === "ADMIN" || user.globalRole === "MEMBER") && (
                    <>
                        <div className="my-4 border-t" style={{ borderColor: "var(--border-color)" }} />
                        {!isCollapsed && (
                            <div className="px-4 py-2">
                                <h3
                                    className="text-xs font-semibold uppercase tracking-wider"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Tools
                                </h3>
                            </div>
                        )}
                        <div>
                            <Link
                                href="/dashboard/jd-builder"
                                className={`${navItemClasses("/dashboard/jd-builder")} ${isCollapsed ? "justify-center" : ""}`}
                                title={isCollapsed ? "JD Builder" : undefined}
                            >
                                <FileText size={iconSize} className="flex-shrink-0" />
                                {!isCollapsed && <span>JD Builder</span>}
                                {!isCollapsed && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setIsJdBuilderExpanded(!isJdBuilderExpanded);
                                        }}
                                        className="ml-auto p-1 rounded hover:bg-[var(--hover-bg)] transition-colors"
                                        aria-label={isJdBuilderExpanded ? "Collapse" : "Expand"}
                                    >
                                        {isJdBuilderExpanded ? (
                                            <ChevronUp size={16} style={{ color: "var(--text-primary)" }} />
                                        ) : (
                                            <ChevronDown size={16} style={{ color: "var(--text-primary)" }} />
                                        )}
                                    </button>
                                )}
                            </Link>
                            {!isCollapsed && (
                                <div
                                    className="ml-8 mt-1 space-y-1 overflow-hidden transition-all duration-300 ease-in-out"
                                    style={{
                                        maxHeight: isJdBuilderExpanded ? "200px" : "0",
                                        opacity: isJdBuilderExpanded ? 1 : 0,
                                    }}
                                >
                                    <Link
                                        href="/dashboard/jd-builder/saved"
                                        className={`${navItemClasses("/dashboard/jd-builder/saved")} text-xs py-2`}
                                    >
                                        <Bookmark size={16} className="flex-shrink-0" />
                                        <span>Saved Items</span>
                                    </Link>
                                </div>
                            )}
                        </div>
                        <Link
                            href="/dashboard/sop-generator"
                            className={`${navItemClasses("/dashboard/sop-generator")} ${isCollapsed ? "justify-center" : ""}`}
                            title={isCollapsed ? "SOP Generator" : undefined}
                        >
                            <BookOpen size={iconSize} className="flex-shrink-0" />
                            {!isCollapsed && <span>SOP Generator</span>}
                        </Link>
                        <Link
                            href="/dashboard/ai-business-brain"
                            className={`${navItemClasses("/dashboard/ai-business-brain")} ${isCollapsed ? "justify-center" : ""}`}
                            title={isCollapsed ? "AI Business Brain" : undefined}
                        >
                            <Brain size={iconSize} className="flex-shrink-0" />
                            {!isCollapsed && <span>AI Business Brain</span>}
                        </Link>
                    </>
                )}
            </nav>

            {/* User info footer */}
            {user && (
                <div
                    className="p-4 border-t"
                    style={{ borderColor: "var(--border-color)" }}
                >
                    <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
                        <div
                            className="p-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: "var(--hover-bg)" }}
                        >
                            <User size={iconSize} style={{ color: "var(--text-primary)" }} />
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col min-w-0">
                                <span
                                    className="text-sm font-medium truncate"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {user.firstname} {user.lastname}
                                </span>
                                <span
                                    className="text-xs truncate"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {user.email}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}

