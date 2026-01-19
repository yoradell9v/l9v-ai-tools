"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, FileText, Trash2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import DocumentList, { Document } from "@/components/organization/DocumentList";

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [completionModal, setCompletionModal] = useState<{
        open: boolean;
        document: Document | null;
    }>({ open: false, document: null });

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch("/api/organization-knowledge-base/documents");
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.documents) {
                    setDocuments(result.documents);
                } else {
                    setError(result.message || "Failed to load documents");
                }
            } else {
                setError("Failed to load documents");
            }
        } catch (error) {
            console.error("Error loading documents:", error);
            setError("Failed to load documents");
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

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Unknown date";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <>
                <div className="flex items-center gap-2 p-4 border-b">
                    <SidebarTrigger />
                </div>
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
            </div>
            <div className="min-h-screen">
                <div className="py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold mb-2">Documents</h1>
                                <p className="text-sm text-muted-foreground">
                                    Manage all your organization's uploaded documents
                                </p>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <Card className="border-destructive/30 bg-destructive/10">
                            <CardContent className="py-4">
                                <p className="text-base text-destructive">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    <DocumentList
                        documents={documents}
                        onDocumentsChange={setDocuments}
                        onDeleteDocument={handleDeleteDocument}
                        showUploadInterface={false}
                    />
                </div>
            </div>

            {/* Completion Modal */}
            <Dialog open={completionModal.open} onOpenChange={(open) => setCompletionModal({ open, document: null })}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-[color:var(--accent-strong)]" />
                            Document Processing Complete
                        </DialogTitle>
                        <DialogDescription>
                            {completionModal.document?.name && (
                                <span className="font-medium">{completionModal.document.name}</span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-4">
                            {completionModal.document?.extractedContent?.summary && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Summary</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {completionModal.document.extractedContent.summary}
                                    </p>
                                </div>
                            )}

                            {completionModal.document?.insights && completionModal.document.insights.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold">
                                        Insights Extracted ({completionModal.document.insights.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {completionModal.document.insights.map((insight, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 rounded-lg border bg-muted/30 space-y-1"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="outline" className="text-[10px] border-[var(--primary-dark)] text-[var(--primary-dark)]">
                                                        {insight.field}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {insight.confidence}% confidence
                                                    </span>
                                                </div>
                                                <p className="text-sm mt-1">{insight.insight}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {completionModal.document?.extractedContent?.keyPoints &&
                                completionModal.document.extractedContent.keyPoints.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Key Points</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            {completionModal.document.extractedContent.keyPoints.map((point, idx) => (
                                                <li key={idx}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            {(!completionModal.document?.insights || completionModal.document.insights.length === 0) &&
                                !completionModal.document?.extractedContent?.summary && (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-muted-foreground">
                                            Document processed successfully. Content has been added to your knowledge base.
                                        </p>
                                    </div>
                                )}
                        </div>
                    </ScrollArea>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            onClick={() => setCompletionModal({ open: false, document: null })}
                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

