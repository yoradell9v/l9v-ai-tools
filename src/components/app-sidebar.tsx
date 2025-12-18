"use client";

import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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
    Lightbulb,
    AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { GlobalRole } from "@prisma/client";
import Image from "next/image";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuAction,
    SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { checkOnboardingStatus, type OnboardingStatus } from "@/lib/organizationKnowledgeBase";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface User {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    createdAt: string;
    globalRole: GlobalRole | null;
}

export function AppSidebar() {
    const { user } = useUser() as { user: User | null };
    const pathname = usePathname();
    const router = useRouter();
    const [isSignoutModalOpen, setIsSignoutModalOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);

    if (!user) {
        return null;
    }

    // Fetch knowledge base completion status for badge
    const fetchOnboardingStatus = async () => {
        try {
            const response = await fetch("/api/organization-knowledge-base", {
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const status = checkOnboardingStatus(data.organizationProfile);
                    setOnboardingStatus(status);
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
        }
    };

    // Initial fetch on mount
    useEffect(() => {
        fetchOnboardingStatus();
    }, []);

    // Refetch when pathname changes (e.g., user navigates to/from knowledge base page or dashboard)
    // This ensures the badge updates when knowledge base is completed
    useEffect(() => {
        fetchOnboardingStatus();
    }, [pathname]);

    // Listen for custom event when knowledge base is updated
    useEffect(() => {
        const handleKnowledgeBaseUpdate = () => {
            fetchOnboardingStatus();
        };

        window.addEventListener("organizationProfileUpdated", handleKnowledgeBaseUpdate);
        return () => {
            window.removeEventListener("organizationProfileUpdated", handleKnowledgeBaseUpdate);
        };
    }, []);

    // Refetch onboarding status when pathname changes (e.g., user navigates to/from knowledge base page)
    useEffect(() => {
        if (pathname === "/dashboard/organization-profile" || pathname === "/dashboard") {
            fetchOnboardingStatus();
        }
    }, [pathname]);

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

            window.location.href = "/signin";
        } catch (error) {
            console.error("Signout error:", error);
            setIsSigningOut(false);
            alert("Failed to sign out. Please try again.");
        }
    };

    const isActive = (path: string) => {
        if (path === "/dashboard/jd-builder") {
            return pathname === path || pathname?.startsWith(path + "/");
        }
        if (path === "/dashboard/organization-profile") {
            return pathname === path || pathname?.startsWith(path + "/");
        }
        return pathname === path;
    };

    // SUPERADMIN Navigation items
    const superAdminItems = [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Tenants",
            url: "/dashboard/tenants",
            icon: Building2,
        },
    ];

    // ADMIN Navigation items
    const adminItems = [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Members",
            url: "/dashboard/members",
            icon: Users,
        },
    ];

    // MEMBER Navigation items
    const memberItems = [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: LayoutDashboard,
        },
    ];

    // Tools items (for all roles)
    const toolsItems = [
        {
            title: "JD Builder",
            url: "/dashboard/jd-builder",
            icon: FileText,
        },
        {
            title: "SOP Generator",
            url: "/dashboard/sop-generator",
            icon: BookOpen,
        },
        {
            title: "AI Business Brain",
            url: "/dashboard/ai-business-brain",
            icon: Brain,
        },
    ];

    return (
        <>
            <Sidebar>
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <a href="/">
                                    <div className="flex aspect-square size-8 items-center justify-center text-sidebar-primary-foreground">
                                        <Image
                                            src="/icon.png"
                                            alt="L9V Logo"
                                            width={32}
                                            height={32}
                                            className="rounded"
                                        />
                                    </div>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">L9V AI Tools</span>
                                    </div>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    {/* SUPERADMIN Navigation */}
                    {user.globalRole === "SUPERADMIN" && (
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {superAdminItems.map((item) => (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive(item.url)}
                                            >
                                                <Link href={item.url}>
                                                    <item.icon />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}

                    {/* ADMIN Navigation */}
                    {user.globalRole === "ADMIN" && (
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {adminItems.map((item) => (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive(item.url)}
                                            >
                                                <Link href={item.url}>
                                                    <item.icon />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}

                    {/* MEMBER Navigation */}
                    {user.globalRole === "MEMBER" && (
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {memberItems.map((item) => (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive(item.url)}
                                            >
                                                <Link href={item.url}>
                                                    <item.icon />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )}


                    {(user.globalRole === "ADMIN" ||
                        user.globalRole === "MEMBER" ||
                        user.globalRole === "SUPERADMIN") && (
                            <SidebarGroup>
                                <SidebarGroupLabel>Organization</SidebarGroupLabel>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive("/dashboard/organization-profile")}
                                            >
                                                <Link href="/dashboard/organization-profile" className="flex items-center gap-2 w-full">
                                                    <Lightbulb className="h-4 w-4" />
                                                    <span className="flex-1">Knowledge Base</span>
                                                    {onboardingStatus && onboardingStatus.needsOnboarding && (
                                                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        )}

                    {/* Tools Section */}
                    {(user.globalRole === "SUPERADMIN" ||
                        user.globalRole === "ADMIN" ||
                        user.globalRole === "MEMBER") && (
                            <SidebarGroup>
                                <SidebarGroupLabel>Tools</SidebarGroupLabel>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {toolsItems.map((item) => (
                                            <SidebarMenuItem key={item.title}>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={isActive(item.url)}
                                                >
                                                    <Link href={item.url}>
                                                        <item.icon />
                                                        <span>{item.title}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        )}
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <User className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{user.firstname} {user.lastname}</span>
                                    <span className="truncate text-xs">{user.email}</span>
                                </div>
                            </SidebarMenuButton>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuAction showOnHover>
                                        <MoreVertical />
                                        <span className="sr-only">More</span>
                                    </SidebarMenuAction>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                    side="bottom"
                                    align="end"
                                >
                                    <DropdownMenuItem
                                        onClick={() => {
                                            // TODO: Navigate to account information page
                                        }}
                                    >
                                        <UserCircle className="mr-2 size-4" />
                                        <span>Account Information</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setIsSignoutModalOpen(true);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <LogOut className="mr-2 size-4" />
                                        <span>Sign Out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>

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
        </>
    );
}

