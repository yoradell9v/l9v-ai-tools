"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import AnalysisCard, { SavedAnalysis } from "@/components/ui/AnalysisCard";
import { AlertCircle, Plus, Loader2, Briefcase, ArrowLeft, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SavedPage() {
    const { user } = useUser();
    const router = useRouter();
    const [savedItems, setSavedItems] = useState<SavedAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
    const [previewAnalysis, setPreviewAnalysis] = useState<SavedAnalysis | null>(null);
    const hasFetchedRef = useRef(false);
    const lastUserIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!user?.id) return;
        if (hasFetchedRef.current && lastUserIdRef.current === user.id) return;
        hasFetchedRef.current = true;
        lastUserIdRef.current = user.id;

        const fetchSavedAnalyses = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await fetch(`/api/jd/saved?page=1&limit=50`, {
                    method: "GET",
                    cache: "no-store",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to load saved analyses (${res.status})`);
                }
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.error || "Failed to load saved analyses");
                }
                const analyses = (data?.data?.analyses ?? []) as SavedAnalysis[];
                setSavedItems(analyses);
            } catch (err: any) {
                console.error("Error fetching saved analyses:", err);
                setError(err.message || "Unable to load saved analyses. Please try again.");
                setSavedItems([]);
                hasFetchedRef.current = false;
            } finally {
                setIsLoading(false);
            }
        };

        fetchSavedAnalyses();
    }, [user?.id]);

    const filteredAndSorted = useMemo(() => {
        let list = savedItems.filter(
            (item) =>
                !searchQuery ||
                item.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        list = [...list].sort((a, b) => {
            const da = new Date(a.createdAt).getTime();
            const db = new Date(b.createdAt).getTime();
            return sortBy === "recent" ? db - da : da - db;
        });
        return list;
    }, [savedItems, searchQuery, sortBy]);

    const handleEdit = (analysis: SavedAnalysis) => {
        router.push(`/dashboard/role-builder?analysisId=${analysis.id}&refine=true`);
    };

    const handleViewOnPage = (analysis: SavedAnalysis) => {
        setPreviewAnalysis(null);
        router.push(`/dashboard/role-builder?analysisId=${analysis.id}`);
    };

    if (!user || isLoading) {
        return (
            <>
                <div className="flex items-center justify-between gap-3 py-6 px-4 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <h1 className="text-xl font-semibold truncate min-w-0 md:text-2xl">Saved Analyses</h1>
                    <SidebarTrigger className="flex-shrink-0" />
                </div>
                <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                    <div className="w-full max-w-full py-10 px-4 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 justify-center items-center">
                        <Loader2 className="h-6 w-6 md:h-8 md:w-8 mb-2 md:mb-3 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground md:text-base">Loading...</p>
                    </div>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <div className="flex items-center justify-between gap-3 py-6 px-4 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <h1 className="text-xl font-semibold truncate min-w-0 md:text-2xl">Saved Analyses</h1>
                    <SidebarTrigger className="flex-shrink-0" />
                </div>
                <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                    <div className="w-full max-w-full py-10 px-4 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 justify-center items-center">
                        <Alert variant="destructive" className="max-w-md w-full mx-2 p-3 md:p-4">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <AlertTitle className="text-sm md:text-base">Error Loading Analyses</AlertTitle>
                            <AlertDescription className="mb-3 text-sm md:mb-4 md:text-base">{error}</AlertDescription>
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="text-sm">
                                Retry
                            </Button>
                        </Alert>
                    </div>
                </div>
            </>
        );
    }

    if (savedItems.length === 0) {
        return (
            <>
                <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                    <div className="w-full max-w-full py-6 px-4 flex flex-col flex-1 min-h-0 overflow-hidden md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                        <header className="flex-shrink-0 space-y-3 mb-3 animate-section-in md:space-y-4 md:mb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/dashboard/role-builder")}
                                className="gap-2 text-sm"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <div className="flex items-center justify-between gap-3">
                                <h1 className="text-xl font-semibold truncate min-w-0 md:text-2xl">Saved Analyses</h1>
                                <SidebarTrigger className="flex-shrink-0" />
                            </div>
                        </header>
                        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 md:py-16">
                            <div className="mx-auto flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                <Briefcase className="h-10 w-10 md:h-12 md:w-12 text-[color:var(--accent-strong)]" />
                            </div>
                            <div className="space-y-2 max-w-2xl mx-auto text-center mt-4 md:space-y-3 md:mt-6">
                                <h3 className="text-xl font-semibold md:text-2xl">No saved analyses yet</h3>
                                <p className="text-sm text-muted-foreground md:text-base">
                                    Start by creating your first job description analysis. Your saved analyses will appear here once you save them.
                                </p>
                            </div>
                            <Button
                                asChild
                                size="lg"
                                className="mt-4 w-full sm:w-auto bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-sm md:text-base md:mt-6"
                            >
                                <a href="/dashboard/role-builder">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Start Analysis
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                <div className="w-full max-w-full py-6 px-4 flex flex-col flex-1 min-h-0 overflow-hidden md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <header className="flex-shrink-0 space-y-3 mb-3 md:space-y-4 md:mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard/role-builder")}
                            className="gap-2 text-sm"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <h1 className="text-xl font-semibold truncate md:text-2xl">Saved Analyses</h1>
                                <p className="text-sm text-muted-foreground md:text-base">
                                    View and manage all your job description analyses
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                                <Button asChild className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-sm md:text-base">
                                    <a href="/dashboard/role-builder">
                                        <Plus className="h-4 w-4 mr-2" />
                                        New Analysis
                                    </a>
                                </Button>
                                <SidebarTrigger />
                            </div>
                        </div>
                    </header>

                    <div className="flex-shrink-0 space-y-3 mb-3 animate-section-in md:space-y-4 md:mb-4" style={{ animationDelay: "80ms" }}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                <span className="text-xs text-muted-foreground shrink-0 md:text-base">Sort by:</span>
                                <Select
                                    value={sortBy}
                                    onValueChange={(v: "recent" | "oldest") => setSortBy(v)}
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
                            <div className="relative w-full min-w-0 sm:min-w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Search analyses by title..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 text-sm md:pl-10 md:text-base"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4 md:gap-4 md:pb-6">
                            {filteredAndSorted.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="animate-analysis-in"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <AnalysisCard
                                        savedAnalysis={item}
                                        variant="compact"
                                        onDelete={(deletedId: string) =>
                                            setSavedItems((prev) => prev.filter((i) => i.id !== deletedId))
                                        }
                                        onEdit={handleEdit}
                                        onPreview={setPreviewAnalysis}
                                    />
                                </div>
                            ))}
                        </div>
                        {filteredAndSorted.length === 0 && searchQuery && (
                            <div className="py-8 px-4 text-center text-sm text-muted-foreground md:py-12 md:text-base">
                                No analyses match your search.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={!!previewAnalysis} onOpenChange={(open) => !open && setPreviewAnalysis(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 w-[95vw] sm:w-full">
                    <DialogHeader className="px-3 pt-3 pb-2 flex-shrink-0 md:px-4 md:pt-4">
                        <DialogTitle className="text-base truncate pr-8 md:text-lg">
                            {previewAnalysis ? previewAnalysis.title : "Preview Analysis"}
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 min-h-0 px-3 md:px-4">
                        {previewAnalysis && (
                            <AnalysisCard
                                savedAnalysis={previewAnalysis}
                                previewMode
                            />
                        )}
                    </ScrollArea>
                    <DialogFooter className="px-3 pb-3 pt-2 flex-shrink-0 border-t flex-col gap-2 sm:flex-row md:px-4 md:pb-4">
                        <Button
                            variant="ghost"
                            onClick={() => setPreviewAnalysis(null)}
                            className="w-full sm:w-auto text-sm"
                        >
                            Close
                        </Button>
                        <Button
                            onClick={() => previewAnalysis && handleViewOnPage(previewAnalysis)}
                            className="w-full sm:w-auto bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-sm"
                        >
                            View full analysis
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
