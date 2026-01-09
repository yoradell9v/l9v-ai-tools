"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@/context/UserContext";
import AnalysisCard, { SavedAnalysis } from "@/components/ui/AnalysisCard";
import RefinementForm from "@/components/forms/RefinementForm";
import { FileText, AlertCircle, Plus, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function SavedPage() {
    const { user } = useUser();
    const [savedItems, setSavedItems] = useState<SavedAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
    const hasFetchedRef = useRef(false);
    const lastUserIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        // Only fetch if we have a user ID and either:
        // 1. We haven't fetched yet, or
        // 2. The user ID has changed
        if (!user?.id) return;
        
        // Skip if we've already fetched for this user ID
        if (hasFetchedRef.current && lastUserIdRef.current === user.id) return;

        hasFetchedRef.current = true;
        lastUserIdRef.current = user.id;

        const fetchSavedAnalyses = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await fetch(
                    `/api/jd/saved?page=1&limit=50`,
                    {
                        method: "GET",
                        cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    }
                );
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to load saved analyses (${res.status})`);
                }
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.error || "Failed to load saved analyses");
                }
                console.log("Raw data: ", data.data);
                const analyses = (data?.data?.analyses ?? []) as SavedAnalysis[];
                setSavedItems(analyses);
                console.log("Fetched saved analyses:", analyses);

            } catch (err: any) {
                console.error("Error fetching saved analyses:", err);
                setError(err.message || "Unable to load saved analyses. Please try again.");
                setSavedItems([]);
                // Reset ref on error so we can retry
                hasFetchedRef.current = false;
            } finally {
                setIsLoading(false);
            }
        };

        fetchSavedAnalyses();
    }, [user?.id]);

    const handleEdit = (analysis: SavedAnalysis) => {
        setSelectedAnalysis(analysis);
        setIsRefinementModalOpen(true);
    };

    const handleRefinementComplete = async (refinedPackage: any) => {
        // Refresh the analyses list to show updated data
        if (user?.id) {
            try {
                const res = await fetch(
                    `/api/jd/saved?page=1&limit=50`,
                    {
                        method: "GET",
                        cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        const analyses = (data?.data?.analyses ?? []) as SavedAnalysis[];
                        setSavedItems(analyses);
                    }
                }
            } catch (err) {
                console.error("Error refreshing analyses:", err);
            }
        }
        setIsRefinementModalOpen(false);
        setSelectedAnalysis(null);
    };

    if (!user || isLoading) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="transition-all duration-300 ease-in-out min-h-screen">
                    <div className="max-w-7xl mx-auto py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 mb-3 animate-spin" />
                            <p className="text-base text-muted-foreground">Loading...</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="transition-all duration-300 ease-in-out min-h-screen">
                    <div className="max-w-7xl mx-auto py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <Alert variant="destructive" className="max-w-md">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error Loading Analyses</AlertTitle>
                                <AlertDescription className="mb-4">
                                    {error}
                                </AlertDescription>
                                <Button
                                    onClick={() => window.location.reload()}
                                    variant="outline"
                                >
                                    Retry
                                </Button>
                            </Alert>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (savedItems.length === 0) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="transition-all duration-300 ease-in-out min-h-screen">
                    <div className="max-w-7xl mx-auto py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 mb-4 text-base text-muted-foreground">
                            <a
                                href="/dashboard/jd-builder"
                                className="hover:underline transition-colors text-amber-500"
                            >
                                JD Builder
                            </a>
                            <span>•</span>
                            <span>Saved Analyses</span>
                        </div>

                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <div className="p-4 rounded-xl mb-4 bg-muted">
                                <FileText className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium mb-3">
                                No saved analyses
                            </h3>
                            <p className="text-base mb-4 max-w-sm text-muted-foreground">
                                Start by creating your first job description analysis. Your saved analyses will appear here.
                            </p>
                            <Button asChild>
                                <a href="/dashboard/jd-builder">
                                    <Plus className="h-4 w-4" />
                                    <span>Start Analysis</span>
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
            <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
            </div>
            <div className="transition-all duration-300 ease-in-out h-screen flex flex-col overflow-hidden overflow-x-hidden">
                <div className="w-full p-4 md:p-8 pt-6 flex flex-col h-full">
                    {/* Fixed Header */}
                    <div className="flex-shrink-0 pt-0">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 mb-4 text-base text-muted-foreground">
                            <a
                                href="/dashboard/jd-builder"
                                className="hover:underline transition-colors text-amber-500"
                            >
                                JD Builder
                            </a>
                            <span>•</span>
                            <span>Saved Analyses</span>
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="pb-2">
                                <h1 className="text-2xl font-semibold mb-1">
                                    Saved Analyses
                                </h1>
                                <p className="text-base text-muted-foreground">
                                    {savedItems.length} {savedItems.length === 1 ? "analysis" : "analyses"} from your organization
                                </p>
                            </div>
                            <Button asChild>
                                <a href="/dashboard/jd-builder">
                                    <Plus className="h-4 w-4" />
                                    <span>New Analysis</span>
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Scrollable Analyses List */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        <Card className="p-0">
                            <CardContent className="p-2">
                                <div className="space-y-3">
                                    {savedItems.map((item) => (
                                        <AnalysisCard
                                            key={item.id}
                                            savedAnalysis={item}
                                            onDelete={(deletedId: string) =>
                                                setSavedItems((prev) => prev.filter((i) => i.id !== deletedId))
                                            }
                                            onEdit={handleEdit}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Refinement Dialog */}
            {user && selectedAnalysis && (
                <Dialog open={isRefinementModalOpen} onOpenChange={(open) => {
                    if (!open) {
                        setIsRefinementModalOpen(false);
                        setSelectedAnalysis(null);
                    }
                }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
                        <DialogHeader>
                            <DialogTitle>Refine Analysis</DialogTitle>
                            <DialogDescription>
                                Provide feedback on what you'd like to change in your analysis.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-hidden">
                            <RefinementForm
                                analysisId={selectedAnalysis.id}
                                userId={user.id}
                                serviceType={selectedAnalysis.analysis?.preview?.service_type || selectedAnalysis.analysis?.full_package?.service_structure?.service_type}
                                onRefinementComplete={handleRefinementComplete}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
