"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    FileText,
    Loader2,
    Search,
    Calendar,
    User,
    ChevronLeft,
    ChevronRight,
    Eye,
    Download,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Layers,
    List,
    Plus,
} from "lucide-react";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/context/UserContext";

interface SavedSOP {
    id: string;
    title: string;
    content: {
        markdown?: string;
        html?: string;
        version?: string;
        generatedAt?: string;
    } | string;
    metadata?: {
        tokens?: {
            prompt: number;
            completion: number;
            total: number;
        };
        organizationProfileUsed?: boolean;
        generatedAt?: string;
    };
    isDraft?: boolean;
    versionNumber?: number;
    isCurrentVersion?: boolean;
    createdAt: string;
    updatedAt: string;
    userOrganization: {
        userId: string;
        user: {
            id: string;
            firstname: string;
            lastname: string;
            email: string;
        };
    };
}

interface SOPGroup {
    rootSOPId: string;
    title: string;
    currentVersion: SavedSOP;
    versions: SavedSOP[];
    mostRecentVersionDate: string;
    oldestVersionDate: string;
    versionCount: number;
}

interface SOPsResponse {
    success: boolean;
    data: {
        sops?: SavedSOP[];
        groups?: SOPGroup[];
        total: number;
        page: number;
        limit: number;
    };
}

export default function SOPHistoryPage() {
    const { user } = useUser();
    const router = useRouter();
    const [sops, setSops] = useState<SavedSOP[]>([]);
    const [sopGroups, setSopGroups] = useState<SOPGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [viewMode, setViewMode] = useState<"grouped" | "individual">("grouped");
    const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
    const [draftFilter, setDraftFilter] = useState<"all" | "drafts" | "published">("all");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const limit = 12; // Items per page

    useEffect(() => {
        if (user) {
            loadSOPs();
        }
    }, [user, currentPage, viewMode, sortBy, draftFilter]);

    const loadSOPs = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: limit.toString(),
                groupBySOP: viewMode === "grouped" ? "true" : "false",
                sortBy: sortBy,
            });

            if (draftFilter === "drafts") {
                params.append("isDraft", "true");
            } else if (draftFilter === "published") {
                params.append("isDraft", "false");
            }

            const response = await fetch(
                `/api/sop/saved?${params.toString()}`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch saved SOPs");
            }

            const data: SOPsResponse = await response.json();

            if (data.success && data.data) {
                if (viewMode === "grouped" && data.data.groups) {
                    setSopGroups(data.data.groups);
                    setSops([]);
                } else if (viewMode === "individual" && data.data.sops) {
                    setSops(data.data.sops);
                    setSopGroups([]);
                } else {
                    setSops([]);
                    setSopGroups([]);
                }
                setTotal(data.data.total);
                setTotalPages(Math.ceil(data.data.total / limit));
            } else {
                setSops([]);
                setSopGroups([]);
                setTotal(0);
                setTotalPages(1);
            }
        } catch (error: any) {
            console.error("Error loading SOPs:", error);
            toast.error("Failed to load SOPs", {
                description: error.message || "An error occurred while loading SOPs.",
            });
            setSops([]);
            setSopGroups([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewSOP = (sopId: string) => {
        router.push(`/dashboard/process-builder?sopId=${sopId}`);
    };

    const handleDownloadPDF = async (sop: SavedSOP, e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            let content = "";
            if (typeof sop.content === "string") {
                content = sop.content;
            } else if (sop.content && typeof sop.content === "object") {
                const contentObj = sop.content as any;
                content = contentObj.html || contentObj.markdown || "";
            }

            if (!content) {
                toast.error("SOP content not available");
                return;
            }

            const response = await fetch("/api/sop/download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    sopHtml: typeof sop.content === "object" && (sop.content as any)?.html
                        ? (sop.content as any).html
                        : content,
                    title: sop.title,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate PDF");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            const contentDisposition = response.headers.get("Content-Disposition");
            const filename = contentDisposition
                ? contentDisposition.split('filename="')[1]?.replace(/"/g, "") || "sop.pdf"
                : `${sop.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success("PDF downloaded successfully!");
            }, 100);
        } catch (error: any) {
            console.error("Download error:", error);
            toast.error("Failed to download PDF", {
                description: error.message || "An error occurred while generating the PDF.",
            });
        }
    };

    const toggleGroupExpansion = (rootSOPId: string) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(rootSOPId)) {
                newSet.delete(rootSOPId);
            } else {
                newSet.add(rootSOPId);
            }
            return newSet;
        });
    };

    const filteredSOPs = sops.filter((sop) =>
        sop.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGroups = sopGroups.filter((group) =>
        group.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getUserName = (sop: SavedSOP) => {
        const user = sop.userOrganization?.user;
        if (user?.firstname || user?.lastname) {
            return `${user.firstname || ""} ${user.lastname || ""}`.trim();
        }
        return user?.email || "Unknown";
    };

    const getVersion = (sop: SavedSOP) => {
        if (typeof sop.content === "object" && sop.content?.version) {
            return sop.content.version;
        }
        return "1.0";
    };

    return (
        <>
            <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                <div className="w-full max-w-full py-6 px-4 flex flex-col flex-1 min-h-0 overflow-hidden md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <header className="flex-shrink-0 space-y-3 mb-3 animate-section-in md:space-y-4 md:mb-4">
                        <div className="flex items-center gap-2 md:gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/dashboard/process-builder")}
                                className="gap-2 text-sm"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <h1 className="text-xl font-semibold truncate md:text-2xl">SOP History</h1>
                                <p className="text-sm text-muted-foreground md:text-base">
                                    View and manage all your generated Standard Operating Procedures
                                </p>
                            </div>
                            <SidebarTrigger className="flex-shrink-0" />
                        </div>
                    </header>

                    <div className="flex-shrink-0 space-y-3 mb-3 animate-section-in md:space-y-4 md:mb-4" style={{ animationDelay: "80ms" }}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:gap-2">
                                <span className="text-xs text-muted-foreground shrink-0 md:text-base">View:</span>
                                <div className="flex flex-wrap gap-1">
                                    <Button
                                        variant={viewMode === "grouped" ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => {
                                            setViewMode("grouped");
                                            setCurrentPage(1);
                                        }}
                                        className={`rounded-md text-xs md:text-sm ${viewMode === "grouped" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                    >
                                        <Layers className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                        Grouped
                                    </Button>
                                    <Button
                                        variant={viewMode === "individual" ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => {
                                            setViewMode("individual");
                                            setCurrentPage(1);
                                        }}
                                        className={`rounded-md text-xs md:text-sm ${viewMode === "individual" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                    >
                                        <List className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                        All Versions
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 min-w-0">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                                    <span className="text-xs text-muted-foreground shrink-0 md:text-base">Filter:</span>
                                    <div className="flex flex-wrap gap-1">
                                        <Button
                                            variant={draftFilter === "all" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => {
                                                setDraftFilter("all");
                                                setCurrentPage(1);
                                            }}
                                            className={`rounded-md text-xs md:text-sm ${draftFilter === "all" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            All
                                        </Button>
                                        <Button
                                            variant={draftFilter === "drafts" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => {
                                                setDraftFilter("drafts");
                                                setCurrentPage(1);
                                            }}
                                            className={`rounded-md text-xs md:text-sm ${draftFilter === "drafts" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            Drafts
                                        </Button>
                                        <Button
                                            variant={draftFilter === "published" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => {
                                                setDraftFilter("published");
                                                setCurrentPage(1);
                                            }}
                                            className={`rounded-md text-xs md:text-sm ${draftFilter === "published" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            Published
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                    <span className="text-xs text-muted-foreground shrink-0 md:text-base">Sort by:</span>
                                    <Select
                                        value={sortBy}
                                        onValueChange={(value: "recent" | "oldest") => {
                                            setSortBy(value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="w-full sm:w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="recent">Most Recent</SelectItem>
                                            <SelectItem value="oldest">Oldest</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="relative min-w-0">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search SOPs by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 text-sm md:pl-10 md:text-base"
                            />
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    {isLoading && (
                        <Card>
                            <CardContent className="flex items-center justify-center gap-2 py-8 md:gap-3 md:py-12">
                                <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin text-primary" />
                                <p className="text-sm font-medium md:text-base">Loading SOPs...</p>
                            </CardContent>
                        </Card>
                    )}

                    {!isLoading &&
                        ((viewMode === "grouped" && filteredGroups.length === 0) ||
                            (viewMode === "individual" && filteredSOPs.length === 0)) && (
                            <div className="py-10 px-4 space-y-4 text-center md:py-16 md:space-y-6">
                                <div className="mx-auto flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                    <ClipboardDocumentCheckIcon className="h-10 w-10 md:h-12 md:w-12 text-[color:var(--accent-strong)]" />
                                </div>
                                <div className="space-y-2 max-w-2xl mx-auto md:space-y-3">
                                    <h3 className="text-xl font-semibold md:text-2xl">No SOPs found</h3>
                                    <p className="text-sm text-muted-foreground md:text-base">
                                        {searchQuery
                                            ? "No SOPs match your search criteria."
                                            : "You haven't generated any SOPs yet. Generate your first SOP to see it here."}
                                    </p>
                                </div>
                                {!searchQuery && (
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                                        <Button
                                            onClick={() => router.push("/dashboard/process-builder")}
                                            size="lg"
                                            className="w-full sm:w-auto inline-flex items-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-sm md:text-base"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Generate Your First SOP
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                    {!isLoading && viewMode === "grouped" && filteredGroups.length > 0 && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 md:gap-4 md:mb-6">
                                {filteredGroups.map((group, index) => {
                                    const isExpanded = expandedGroups.has(group.rootSOPId);
                                    const currentVersion = group.currentVersion;

                                    return (
                                        <div
                                            key={group.rootSOPId}
                                            className="animate-analysis-in"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                        <Card
                                            className="group transition-all duration-200 hover:shadow-lg hover:border-primary/50"
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <CardTitle className="text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                                            {group.title}
                                                        </CardTitle>
                                                        <CardDescription className="text-xs space-y-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-3 w-3" />
                                                                <span>
                                                                    {formatDate(
                                                                        sortBy === "recent"
                                                                            ? group.mostRecentVersionDate
                                                                            : group.oldestVersionDate
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <User className="h-3 w-3" />
                                                                <span>{getUserName(currentVersion)}</span>
                                                            </div>
                                                        </CardDescription>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadPDF(currentVersion, e);
                                                            }}
                                                            title="Download PDF"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary">
                                                                {group.versionCount} version{group.versionCount !== 1 ? "s" : ""}
                                                            </Badge>
                                                            {currentVersion.isDraft && (
                                                                <Badge variant="outline" className="bg-[var(--accent-strong)] text-black border-[var(--accent-strong)]">
                                                                    Draft
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {currentVersion.metadata?.organizationProfileUsed && (
                                                            <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs">
                                                                Org Profile
                                                            </span>
                                                        )}
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                                        onClick={() => handleViewSOP(currentVersion.id)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2 text-[var(--primary-dark)]" />
                                                        View Current Version
                                                    </Button>

                                                    {group.versions.length > 1 && (
                                                        <>
                                                            <Separator />
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-between"
                                                                onClick={() => toggleGroupExpansion(group.rootSOPId)}
                                                            >
                                                                <span className="text-xs">
                                                                    {isExpanded ? "Hide" : "Show"} All Versions
                                                                </span>
                                                                {isExpanded ? (
                                                                    <ChevronUp className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                )}
                                                            </Button>

                                                            {isExpanded && (
                                                                <div className="space-y-2 pt-2 border-t">
                                                                    {group.versions.map((version) => (
                                                                        <div
                                                                            key={version.id}
                                                                            className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                                                        >
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    {version.isDraft ? (
                                                                                        <Badge variant="outline" className="bg-[var(--accent-strong)] text-black border-[var(--accent-strong)] text-xs">
                                                                                            Draft
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <span className="text-xs font-medium">
                                                                                            v{version.versionNumber || getVersion(version)}
                                                                                        </span>
                                                                                    )}
                                                                                    {version.id === currentVersion.id && !version.isDraft && (
                                                                                        <Badge variant="default" className="text-xs">
                                                                                            Current
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                                    {formatDate(version.createdAt)}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-1">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleViewSOP(version.id);
                                                                                    }}
                                                                                    title="View"
                                                                                >
                                                                                    <Eye className="h-3 w-3" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDownloadPDF(version, e);
                                                                                    }}
                                                                                    title="Download"
                                                                                >
                                                                                    <Download className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        </div>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-xs text-muted-foreground md:text-base order-2 sm:order-1">
                                        Showing {(currentPage - 1) * limit + 1} to{" "}
                                        {Math.min(currentPage * limit, total)} of {total} SOP groups
                                    </div>
                                    <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1 || isLoading}
                                            className="text-xs md:text-sm"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <div className="text-xs text-muted-foreground md:text-base min-w-[80px] text-center">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                            }
                                            disabled={currentPage === totalPages || isLoading}
                                            className="text-xs md:text-sm"
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {!isLoading && viewMode === "individual" && filteredSOPs.length > 0 && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 md:gap-4 md:mb-6">
                                {filteredSOPs.map((sop, index) => (
                                    <div
                                        key={sop.id}
                                        className="animate-analysis-in"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                    <Card
                                        className="group transition-all duration-200 hover:shadow-lg hover:border-primary/50 cursor-pointer"
                                        onClick={() => handleViewSOP(sop.id)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <CardTitle className="text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                                        {sop.title}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="h-3 w-3" />
                                                            <span>{formatDate(sop.createdAt)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="h-3 w-3" />
                                                            <span>{getUserName(sop)}</span>
                                                        </div>
                                                    </CardDescription>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => handleDownloadPDF(sop, e)}
                                                        title="Download PDF"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>Version {getVersion(sop)}</span>
                                                {sop.metadata?.organizationProfileUsed && (
                                                    <span className="px-2 py-1 rounded bg-primary/10 text-primary">
                                                        Org Profile
                                                    </span>
                                                )}
                                            </div>

                                        </CardContent>
                                    </Card>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-xs text-muted-foreground md:text-base order-2 sm:order-1">
                                        Showing {(currentPage - 1) * limit + 1} to{" "}
                                        {Math.min(currentPage * limit, total)} of {total} SOPs
                                    </div>
                                    <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1 || isLoading}
                                            className="text-xs md:text-sm"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <div className="text-xs text-muted-foreground md:text-base min-w-[80px] text-center">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                            }
                                            disabled={currentPage === totalPages || isLoading}
                                            className="text-xs md:text-sm"
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {!isLoading &&
                        ((viewMode === "grouped" && sopGroups.length > 0 && filteredGroups.length === 0) ||
                            (viewMode === "individual" && sops.length > 0 && filteredSOPs.length === 0)) && (
                            <Card className="text-center">
                                <CardContent className="py-8 px-4 space-y-3 md:py-12 md:space-y-4">
                                    <div className="mx-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-muted">
                                        <Search className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1 md:space-y-2">
                                        <h3 className="text-base font-semibold md:text-lg">No Results Found</h3>
                                        <p className="text-sm text-muted-foreground md:text-base">
                                            No SOPs match your search query: &quot;{searchQuery}&quot;
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSearchQuery("")}
                                        className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white border-[var(--primary-dark)] text-sm"
                                    >
                                        Clear Search
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

