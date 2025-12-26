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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
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

interface SOPsResponse {
    success: boolean;
    data: {
        sops: SavedSOP[];
        total: number;
        page: number;
        limit: number;
    };
}

export default function SOPHistoryPage() {
    const { user } = useUser();
    const router = useRouter();
    const [sops, setSops] = useState<SavedSOP[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 12; // Items per page

    useEffect(() => {
        if (user) {
            loadSOPs();
        }
    }, [user, currentPage]);

    const loadSOPs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `/api/sop/saved?page=${currentPage}&limit=${limit}`,
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
                setSops(data.data.sops);
                setTotal(data.data.total);
                setTotalPages(Math.ceil(data.data.total / limit));
            } else {
                setSops([]);
                setTotal(0);
                setTotalPages(1);
            }
        } catch (error: any) {
            console.error("Error loading SOPs:", error);
            toast.error("Failed to load SOPs", {
                description: error.message || "An error occurred while loading SOPs.",
            });
            setSops([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewSOP = (sopId: string) => {
        // Navigate to the main SOP page with the SOP ID
        // The main page will load this SOP
        router.push(`/dashboard/sop-generator?sopId=${sopId}`);
    };

    const handleDownloadPDF = async (sop: SavedSOP, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click

        try {
            // Extract markdown content
            const content = typeof sop.content === "string"
                ? sop.content
                : (sop.content as any)?.markdown || "";

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
                    sopContent: content,
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

    const filteredSOPs = sops.filter((sop) =>
        sop.title.toLowerCase().includes(searchQuery.toLowerCase())
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="flex flex-col gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/dashboard/sop-generator")}
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold">SOP History</h1>
                                <p className="text-sm text-muted-foreground">
                                    View and manage all your generated Standard Operating Procedures
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mb-6">
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

                    {/* Loading State */}
                    {isLoading && (
                        <Card>
                            <CardContent className="flex items-center justify-center gap-3 py-12">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <p className="text-sm font-medium">Loading SOPs...</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {!isLoading && sops.length === 0 && (
                        <Card className="text-center">
                            <CardContent className="py-12 space-y-4">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">No SOPs Found</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        {searchQuery
                                            ? "No SOPs match your search criteria."
                                            : "You haven't generated any SOPs yet. Create your first one to get started."}
                                    </p>
                                </div>
                                {!searchQuery && (
                                    <Button
                                        onClick={() => router.push("/dashboard/sop-generator")}
                                        className="inline-flex items-center gap-2"
                                    >
                                        Generate Your First SOP
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* SOPs Grid */}
                    {!isLoading && filteredSOPs.length > 0 && (
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

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
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
                                        <div className="text-sm text-muted-foreground">
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

                    {/* No Results for Search */}
                    {!isLoading && sops.length > 0 && filteredSOPs.length === 0 && (
                        <Card className="text-center">
                            <CardContent className="py-12 space-y-4">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <Search className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">No Results Found</h3>
                                    <p className="text-sm text-muted-foreground">
                                        No SOPs match your search query: "{searchQuery}"
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setSearchQuery("")}
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

