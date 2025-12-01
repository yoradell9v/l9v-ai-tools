"use client";

import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    ChevronLeft,
    ChevronRight,
    Building2,
    User,
    LayoutDashboard,
    FileText,
    BookOpen,
    Brain,
    Users,
    MoreVertical,
    LogOut,
    UserCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import { GlobalRole } from "@prisma/client";

export interface User {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    createdAt: string;
    globalRole: GlobalRole | null;
}

export default function Navbar() {
    const { user } = useUser() as { user: User | null };
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSignoutModalOpen, setIsSignoutModalOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Update CSS variable for sidebar width
    useEffect(() => {
        document.documentElement.style.setProperty(
            "--sidebar-width",
            isCollapsed ? "5rem" : "16rem"
        );
    }, [isCollapsed]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleSignout = async () => {
        setIsSigningOut(true);
        try {
            const response = await fetch("/api/auth/signout", {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to sign out");
            }

            // Redirect to signin page
            window.location.href = "/signin";
        } catch (error) {
            console.error("Signout error:", error);
            setIsSigningOut(false);
            alert("Failed to sign out. Please try again.");
        }
    };

    const toggleSidebar = () => {
        setIsCollapsed((prev) => !prev);
    };

    const isActive = (path: string) => {
        if (path === "/dashboard/jd-builder") {
            // Active for both /dashboard/jd-builder and /dashboard/jd-builder/history
            return pathname === path || pathname?.startsWith(path + "/");
        }
        return pathname === path;
    };

    const navItemClasses = (path: string) => {
        const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full";
        const activeClasses = isActive(path)
            ? "bg-[var(--primary)] dark:bg-[var(--accent)] text-white"
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
            className={`${sidebarWidth} fixed left-0 top-0 h-screen border-r transition-all duration-300 ease-in-out flex flex-col border border-[var(--border-color)] bg-[var(--card-bg)]`}
        >
            {/* Header with toggle button */}
            <div className={`flex items-center border border-[var(--border-color)] ${isCollapsed ? "justify-center" : "justify-between"} p-4 border-b`}>
                {!isCollapsed && (
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        Menu
                    </h2>
                )}
                <button
                    onClick={toggleSidebar}
                    className={`p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200 ${isCollapsed ? "" : "ml-auto"}`}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? (
                        <ChevronRight size={20} className="text-[var(--text-primary)]" />
                    ) : (
                        <ChevronLeft size={20} className="text-[var(--text-primary)]" />
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
                        <div className="my-4 border-t border border-[var(--border-color)]" />
                        {!isCollapsed && (
                            <div className="px-4 py-2">
                                <h3
                                    className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
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

                            </Link>

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
                    className="p-4 border-t border border-[var(--border-color)]"
                >
                    <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "justify-between"}`}>
                        <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""} flex-1 min-w-0`}>
                            <div
                                className="p-2 rounded-full flex-shrink-0 bg-[var(--hover-bg)]"
                            >
                                <User size={iconSize} className="text-[var(--text-primary)]" />
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span
                                        className="text-sm font-medium truncate text-[var(--text-primary)]"
                                    >
                                        {user.firstname} {user.lastname}
                                    </span>
                                    <span
                                        className="text-xs truncate text-[var(--text-secondary)]"
                                    >
                                        {user.email}
                                    </span>
                                </div>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors text-[var(--text-secondary)]"
                                    aria-label="User menu"
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {isMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setIsMenuOpen(false)}
                                        />
                                        <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg border border-[var(--border-color)] shadow-lg z-20 overflow-hidden bg-[var(--card-bg)]">
                                            <button
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    // TODO: Navigate to account information page
                                                }}
                                                className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--hover-bg)] flex items-center gap-3 text-[var(--text-primary)]"
                                            >
                                                <UserCircle size={16} />
                                                <span>Account Information</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    setIsSignoutModalOpen(true);
                                                }}
                                                className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--hover-bg)] flex items-center gap-3 border-t border-[var(--border-color)] text-[var(--text-primary)]"
                                            >
                                                <LogOut size={16} />
                                                <span>Signout</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Signout Confirmation Modal */}
            <Modal
                isOpen={isSignoutModalOpen}
                onClose={() => {
                    if (!isSigningOut) {
                        setIsSignoutModalOpen(false);
                    }
                }}
                onConfirm={handleSignout}
                title="Sign Out"
                message="Are you sure you want to sign out?"
                confirmText={
                    isSigningOut ? (
                        <div className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                            <span>Signing out...</span>
                        </div>
                    ) : (
                        "Sign Out"
                    )
                }
                cancelText="Cancel"
                confirmVariant="primary"
                isSubmitting={isSigningOut}
            />
        </aside>
    );
}

