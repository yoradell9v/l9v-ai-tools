"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import AnalysisCard, { SavedAnalysis } from "@/components/ui/AnalysisCard";
import Modal from "@/components/ui/Modal";
import RefinementForm from "@/components/forms/RefinementForm";
import { FileText, AlertCircle, Plus } from "lucide-react";
import Navbar from "@/components/ui/Navbar";

export default function SavedPage() {
    const { user } = useUser();
    const [savedItems, setSavedItems] = useState<SavedAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);

    useEffect(() => {
        if (!user?.id) return;

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
                <Navbar />
                <div
                    className="transition-all duration-300 ease-in-out min-h-screen ml-64"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex flex-col items-center justify-center py-16">
                            <svg className="animate-spin h-8 w-8 mb-3 text-[#FAC133]" viewBox="0 0 24 24">
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
                            <p className="text-sm text-[#1a1a1a] dark:text-[#e0e0e0]">Loading...</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Navbar />
                <div
                    className="transition-all duration-300 ease-in-out min-h-screen ml-64"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <div
                                className="p-4 rounded-xl mb-4 bg-gray-100 dark:bg-gray-800"
                            >
                                <AlertCircle
                                    size={40}
                                    className="text-red-600 dark:text-red-400"
                                />
                            </div>
                            <h3
                                className="text-base font-medium mb-1 text-[#18416B] dark:text-[#FAC133]"
                            >
                                Error Loading Analyses
                            </h3>
                            <p
                                className="text-sm mb-4 max-w-sm text-[#1a1a1a] dark:text-[#e0e0e0]"
                            >
                                {error}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[#FAC133] text-[#18416B] dark:text-[#1a1a1a]"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (savedItems.length === 0) {
        return (
            <>
                <Navbar />
                <div
                    className="transition-all duration-300 ease-in-out min-h-screen ml-64"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                            <a
                                href="/dashboard/jd-builder"
                                className="hover:underline transition-colors text-amber-500  "
                            >
                                JD Builder
                            </a>
                            <span>•</span>
                            <span>Saved Analyses</span>
                        </div>

                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <div
                                className="p-4 rounded-xl mb-4 bg-[var(--accent)]/20"
                            >
                                <FileText
                                    size={40}
                                    className="text-[var(--accent)]"
                                />
                            </div>
                            <h3
                                className="text-lg font-medium mb-3"
                            >
                                No saved analyses
                            </h3>
                            <p
                                className="text-sm mb-4 max-w-sm text-[#1a1a1a] dark:text-[#e0e0e0]"
                            >
                                Start by creating your first job description analysis. Your saved analyses will appear here.
                            </p>
                            <a
                                href="/dashboard/jd-builder"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] text-white dark:bg-[var(--accent)]"
                            >
                                <Plus size={16} />
                                <span>Start Analysis</span>
                            </a>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div
                className="transition-all duration-300 ease-in-out h-screen flex flex-col overflow-hidden ml-64"
            >
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col h-full">
                    {/* Fixed Header */}
                    <div className="flex-shrink-0 pt-8 pb-6">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                            <a
                                href="/dashboard/jd-builder"
                                className="hover:underline transition-colors text-amber-500  "
                            >
                                JD Builder
                            </a>
                            <span>•</span>
                            <span>Saved Analyses</span>
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1
                                    className="text-2xl font-semibold mb-1 text-[var(--primary)] dark:text-[var(--accent)]"
                                >
                                    Saved Analyses
                                </h1>
                                <p
                                    className="text-sm text-[#1a1a1a] dark:text-[#e0e0e0]"
                                >
                                    You have {savedItems.length} saved {savedItems.length === 1 ? "analysis" : "analyses"}
                                </p>
                            </div>
                            <a
                                href="/dashboard/jd-builder"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] text-white dark:bg-[var(--accent)] "
                            >
                                <Plus size={18} />
                                <span>New Analysis</span>
                            </a>
                        </div>
                    </div>

                    {/* Scrollable Analyses List */}
                    <div className="flex-1 overflow-y-auto pb-8">
                        <div
                            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a]"
                        >
                            <div className="p-4">
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
                </div>
            </div>

            {/* Refinement Modal */}
            {user && selectedAnalysis && (
                <Modal
                    isOpen={isRefinementModalOpen}
                    onClose={() => {
                        setIsRefinementModalOpen(false);
                        setSelectedAnalysis(null);
                    }}
                    onConfirm={() => { }}
                    title="Refine Analysis"
                    message="Provide feedback on what you'd like to change in your analysis."
                    body={
                        <RefinementForm
                            analysisId={selectedAnalysis.id}
                            userId={user.id}
                            serviceType={selectedAnalysis.analysis?.preview?.service_type || selectedAnalysis.analysis?.full_package?.service_structure?.service_type}
                            onRefinementComplete={handleRefinementComplete}
                        />
                    }
                    confirmText=""
                    cancelText=""
                    maxWidth="4xl"
                />
            )}
        </>
    );
}
