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
            <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
            </div>
            <div className="min-h-screen">
                <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">

                    <div className="flex flex-col gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/dashboard/process-builder")}
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold">SOP History</h1>
                                <p className="text-base text-muted-foreground">
                                    View and manage all your generated Standard Operating Procedures
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base text-muted-foreground">View:</span>
                                <div className="flex border rounded-md">
                                    <Button
                                        variant={viewMode === "grouped" ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => {
                                            setViewMode("grouped");
                                            setCurrentPage(1);
                                        }}
                                        className={viewMode === "grouped" ? "rounded-r-none bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : "rounded-r-none"}
                                    >
                                        <Layers className="h-4 w-4 mr-2" />
                                        Grouped
                                    </Button>
                                    <Button
                                        variant={viewMode === "individual" ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => {
                                            setViewMode("individual");
                                            setCurrentPage(1);
                                        }}
                                        className={viewMode === "individual" ? "rounded-l-none bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : "rounded-l-none"}
                                    >
                                        <List className="h-4 w-4 mr-2" />
                                        All Versions
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-base text-muted-foreground">Filter:</span>
                                    <div className="flex border rounded-md">
                                        <Button
                                            variant={draftFilter === "all" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => {
                                                setDraftFilter("all");
                                                setCurrentPage(1);
                                            }}
                                            className={draftFilter === "all" ? "rounded-r-none bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : "rounded-r-none"}
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
                                            className={draftFilter === "drafts" ? "rounded-none bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : "rounded-none"}
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
                                            className={draftFilter === "published" ? "rounded-l-none bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : "rounded-l-none"}
                                        >
                                            Published
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-base text-muted-foreground">Sort by:</span>
                                    <Select
                                        value={sortBy}
                                        onValueChange={(value: "recent" | "oldest") => {
                                            setSortBy(value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="w-[140px]">
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

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search SOPs by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {isLoading && (
                        <Card>
                            <CardContent className="flex items-center justify-center gap-3 py-12">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <p className="text-base font-medium">Loading SOPs...</p>
                            </CardContent>
                        </Card>
                    )}

                    {!isLoading &&
                        ((viewMode === "grouped" && filteredGroups.length === 0) ||
                            (viewMode === "individual" && filteredSOPs.length === 0)) && (
                            <div className="py-16 space-y-6 text-center">
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                    <ClipboardDocumentCheckIcon className="h-12 w-12 text-[color:var(--accent-strong)]" />
                                </div>
                                <div className="space-y-3 max-w-2xl mx-auto">
                                    <h3 className="text-2xl font-semibold">No SOPs found</h3>
                                    <p className="text-base text-muted-foreground">
                                        {searchQuery
                                            ? "No SOPs match your search criteria."
                                            : "You haven't generated any SOPs yet. Generate your first SOP to see it here."}
                                    </p>
                                </div>
                                {!searchQuery && (
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                        <Button
                                            onClick={() => router.push("/dashboard/process-builder")}
                                            size="lg"
                                            className="inline-flex items-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {filteredGroups.map((group) => {
                                    const isExpanded = expandedGroups.has(group.rootSOPId);
                                    const currentVersion = group.currentVersion;

                                    return (
                                        <Card
                                            key={group.rootSOPId}
                                            className="group transition-all duration-200 hover:shadow-lg hover:border-primary/50"
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between gap-2">
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
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between">
                                    <div className="text-base text-muted-foreground">
                                        Showing {(currentPage - 1) * limit + 1} to{" "}
                                        {Math.min(currentPage * limit, total)} of {total} SOP groups
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1 || isLoading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <div className="text-base text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                            }
                                            disabled={currentPage === totalPages || isLoading}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {filteredSOPs.map((sop) => (
                                    <Card
                                        key={sop.id}
                                        className="group transition-all duration-200 hover:shadow-lg hover:border-primary/50 cursor-pointer"
                                        onClick={() => handleViewSOP(sop.id)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-2">
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
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between">
                                    <div className="text-base text-muted-foreground">
                                        Showing {(currentPage - 1) * limit + 1} to{" "}
                                        {Math.min(currentPage * limit, total)} of {total} SOPs
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1 || isLoading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <div className="text-base text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                            }
                                            disabled={currentPage === totalPages || isLoading}
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
                                <CardContent className="py-12 space-y-4">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                        <Search className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold">No Results Found</h3>
                                        <p className="text-base text-muted-foreground">
                                            No SOPs match your search query: "{searchQuery}"
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => setSearchQuery("")}
                                        className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white border-[var(--primary-dark)]"
                                    >
                                        Clear Search
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                </div>
            </div>
        </>
    );
}

