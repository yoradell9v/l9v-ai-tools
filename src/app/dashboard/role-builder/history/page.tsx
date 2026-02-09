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
                <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                    <SidebarTrigger />
                </div>
                <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                    <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 justify-center items-center">
                        <Loader2 className="h-8 w-8 mb-3 animate-spin text-muted-foreground" />
                        <p className="text-base text-muted-foreground">Loading...</p>
                    </div>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                    <SidebarTrigger />
                </div>
                <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                    <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 justify-center items-center">
                        <Alert variant="destructive" className="max-w-md">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error Loading Analyses</AlertTitle>
                            <AlertDescription className="mb-4">{error}</AlertDescription>
                            <Button onClick={() => window.location.reload()} variant="outline">
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
                <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                    <SidebarTrigger />
                </div>
                <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                    <div className="w-full max-w-full py-6 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 overflow-hidden">
                        <header className="flex-shrink-0 space-y-4 mb-4 animate-section-in">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/dashboard/role-builder")}
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </header>
                        <div className="flex-1 flex flex-col items-center justify-center py-16">
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                <Briefcase className="h-12 w-12 text-[color:var(--accent-strong)]" />
                            </div>
                            <div className="space-y-3 max-w-2xl mx-auto text-center mt-6">
                                <h3 className="text-2xl font-semibold">No saved analyses yet</h3>
                                <p className="text-base text-muted-foreground">
                                    Start by creating your first job description analysis. Your saved analyses will appear here once you save them.
                                </p>
                            </div>
                            <Button
                                asChild
                                size="lg"
                                className="mt-6 bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
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
            <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                <SidebarTrigger />
            </div>
            <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
                <div className="w-full max-w-full py-6 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 overflow-hidden">
                    <header className="flex-shrink-0 space-y-4 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard/role-builder")}
                            className="gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold">Saved Analyses</h1>
                                <p className="text-base text-muted-foreground">
                                    View and manage all your job description analyses
                                </p>
                            </div>
                            <Button asChild className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white">
                                <a href="/dashboard/role-builder">
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Analysis
                                </a>
                            </Button>
                        </div>
                    </header>

                    <div className="flex-shrink-0 space-y-4 mb-4 animate-section-in" style={{ animationDelay: "80ms" }}>
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base text-muted-foreground">Sort by:</span>
                                <Select
                                    value={sortBy}
                                    onValueChange={(v: "recent" | "oldest") => setSortBy(v)}
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
                            <div className="relative w-full sm:w-auto sm:min-w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search analyses by title..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
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
                            <div className="py-12 text-center text-muted-foreground">
                                No analyses match your search.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={!!previewAnalysis} onOpenChange={(open) => !open && setPreviewAnalysis(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
                        <DialogTitle>
                            {previewAnalysis ? previewAnalysis.title : "Preview Analysis"}
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 min-h-0 px-4">
                        {previewAnalysis && (
                            <AnalysisCard
                                savedAnalysis={previewAnalysis}
                                previewMode
                            />
                        )}
                    </ScrollArea>
                    <DialogFooter className="px-4 pb-4 pt-2 flex-shrink-0 border-t">
                        <Button
                            variant="ghost"
                            onClick={() => setPreviewAnalysis(null)}
                        >
                            Close
                        </Button>
                        <Button
                            onClick={() => previewAnalysis && handleViewOnPage(previewAnalysis)}
                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                        >
                            View full analysis
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
