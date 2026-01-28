"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import AnalysisCard, { SavedAnalysis } from "@/components/ui/AnalysisCard";
import { FileText, AlertCircle, Plus, Loader2, Briefcase } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function SavedPage() {
    const { user } = useUser();
    const router = useRouter();
    const [savedItems, setSavedItems] = useState<SavedAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
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
                hasFetchedRef.current = false;
            } finally {
                setIsLoading(false);
            }
        };

        fetchSavedAnalyses();
    }, [user?.id]);

    const handleEdit = (analysis: SavedAnalysis) => {
        router.push(`/dashboard/role-builder?analysisId=${analysis.id}&refine=true`);
    };


    if (!user || isLoading) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="transition-all duration-300 ease-in-out min-h-screen">
                    <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
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
                    <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">

                        <div className="flex items-center gap-2 mb-4 text-base text-muted-foreground">
                            <a
                                href="/dashboard/role-builder"
                                className="hover:underline transition-colors text-amber-500"
                            >
                                Role Builder
                            </a>
                            <span>•</span>
                            <span>Saved Analyses</span>
                        </div>

                        <div className="py-16 space-y-6 text-center">
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                <Briefcase className="h-12 w-12 text-[color:var(--accent-strong)]" />
                            </div>
                            <div className="space-y-3 max-w-2xl mx-auto">
                                <h3 className="text-2xl font-semibold">No saved analyses yet</h3>
                                <p className="text-base text-muted-foreground">
                                    Start by creating your first job description analysis. Your saved analyses will appear here once you save them.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                <Button
                                    asChild
                                    size="lg"
                                    className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                >
                                    <a href="/dashboard/role-builder">
                                        <Plus className="h-4 w-4 mr-2" />
                                        <span>Start Analysis</span>
                                    </a>
                                </Button>
                            </div>
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
                <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0">

                    <div className="flex-shrink-0 pt-0">

                        <div className="flex items-center gap-2 mb-4 text-base text-muted-foreground">
                            <a
                                href="/dashboard/role-builder"
                                className="hover:underline transition-colors text-amber-500"
                            >
                                Role Builder
                            </a>
                            <span>•</span>
                            <span>Saved Analyses</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="pb-2">
                                <h1 className="text-2xl font-semibold mb-1">
                                    Saved Analyses
                                </h1>
                                <p className="text-base text-muted-foreground">
                                    {savedItems.length} {savedItems.length === 1 ? "analysis" : "analyses"} from your organization
                                </p>
                            </div>
                            <Button asChild className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white">
                                <a href="/dashboard/role-builder">
                                    <Plus className="h-4 w-4" />
                                    <span>New Analysis</span>
                                </a>
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
                    </div>
                </div>
            </div>

        </>
    );
}
