"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import DocumentList, { Document } from "@/components/organization/DocumentList";

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
    const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "processing" | "pending" | "failed">("all");

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch("/api/organization-knowledge-base/documents");
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.success && result.documents) {
                setDocuments(result.documents);
            } else {
                const msg = result.message || "";
                const isNoProfile =
                    response.status === 404 ||
                    msg.toLowerCase().includes("knowledge base") ||
                    msg.toLowerCase().includes("organization") ||
                    msg.toLowerCase().includes("not found");
                setError(
                    isNoProfile
                        ? "Setup your organization profile first to add documents."
                        : msg || "Failed to load documents"
                );
            }
        } catch (error) {
            console.error("Error loading documents:", error);
            setError("Setup your organization profile first to add documents.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDocument = async (documentId: string, documentName: string) => {
        try {
            const response = await fetch(`/api/organization-knowledge-base/documents/${documentId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete document");
            }

            const result = await response.json();
            if (result.success) {
                setDocuments(documents.filter((doc) => doc.id !== documentId));
                toast.success(`"${documentName}" deleted successfully`);
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            toast.error(`Failed to delete "${documentName}"`);
        }
    };

    const filteredAndSortedDocuments = useMemo(() => {
        const filtered = documents.filter((doc) => {
            const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "completed" && doc.extractionStatus === "COMPLETED") ||
                (statusFilter === "processing" && doc.extractionStatus === "PROCESSING") ||
                (statusFilter === "pending" && doc.extractionStatus === "PENDING") ||
                (statusFilter === "failed" && doc.extractionStatus === "FAILED");
            return matchesSearch && matchesStatus;
        });

        filtered.sort((a, b) => {
            const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
            const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            return sortBy === "recent" ? dateB - dateA : dateA - dateB;
        });

        return filtered;
    }, [documents, searchQuery, sortBy, statusFilter]);

    if (isLoading) {
        return (
            <>
                <div className="flex items-center justify-between gap-3 py-6 px-4 md:py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <h1 className="text-xl font-semibold truncate min-w-0 md:text-2xl">Documents</h1>
                    <SidebarTrigger className="flex-shrink-0" />
                </div>
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="h-[calc(100vh-64px)] overflow-hidden">
                <div className="w-full max-w-full h-full py-6 px-4 flex flex-col min-h-0 md:py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-between gap-3 mb-4 animate-section-in opacity-0 md:mb-6">
                            <div className="min-w-0">
                                <h1 className="text-xl font-semibold mb-1 truncate md:text-2xl md:mb-2">Documents</h1>
                                <p className="text-sm text-muted-foreground md:text-base">
                                    Manage all your organization's uploaded documents
                                </p>
                            </div>
                            <SidebarTrigger className="flex-shrink-0" />
                        </div>

                        {error && (
                            <Card className="mb-4 border-border bg-card py-2 animate-section-in opacity-0 transition-shadow duration-300 md:mb-6" style={{ animationDelay: "60ms" }}>
                                <CardContent className="py-3 px-4 md:py-4">
                                    <p className="text-sm text-muted-foreground md:text-base">{error}</p>
                                </CardContent>
                            </Card>
                        )}

                        <div className="mb-4 space-y-3 animate-section-in opacity-0 md:mb-6 md:space-y-4" style={{ animationDelay: "100ms" }}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:gap-2">
                                    <span className="text-xs text-muted-foreground shrink-0 md:text-base">Filter:</span>
                                    <div className="flex flex-wrap gap-1">
                                        <Button
                                            variant={statusFilter === "all" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setStatusFilter("all")}
                                            className={`rounded-md text-xs md:text-sm ${statusFilter === "all" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            All
                                        </Button>
                                        <Button
                                            variant={statusFilter === "completed" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setStatusFilter("completed")}
                                            className={`rounded-md text-xs md:text-sm ${statusFilter === "completed" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            Completed
                                        </Button>
                                        <Button
                                            variant={statusFilter === "processing" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setStatusFilter("processing")}
                                            className={`rounded-md text-xs md:text-sm ${statusFilter === "processing" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            Processing
                                        </Button>
                                        <Button
                                            variant={statusFilter === "pending" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setStatusFilter("pending")}
                                            className={`rounded-md text-xs md:text-sm ${statusFilter === "pending" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            Pending
                                        </Button>
                                        <Button
                                            variant={statusFilter === "failed" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setStatusFilter("failed")}
                                            className={`rounded-md text-xs md:text-sm ${statusFilter === "failed" ? "bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white" : ""}`}
                                        >
                                            Failed
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                    <span className="text-xs text-muted-foreground shrink-0 md:text-base">Sort:</span>
                                    <Select value={sortBy} onValueChange={(v: "recent" | "oldest") => setSortBy(v)}>
                                        <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="recent">Date uploaded (newest)</SelectItem>
                                            <SelectItem value="oldest">Date uploaded (oldest)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="relative min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Search documents by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 text-sm md:pl-10 md:text-base"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 animate-section-in opacity-0 transition-opacity duration-300" style={{ animationDelay: "140ms" }}>
                        <DocumentList
                            documents={filteredAndSortedDocuments}
                            onDocumentsChange={setDocuments}
                            onDeleteDocument={handleDeleteDocument}
                            showUploadInterface={false}
                            scrollAreaClassName="h-full"
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

