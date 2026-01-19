"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, AlertCircle, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Document } from "./DocumentLibrary";
import DocumentPreviewSheet from "./DocumentPreviewSheet";

export type { Document } from "./DocumentLibrary";

interface DocumentListProps {
    documents: Document[];
    onDocumentsChange: (documents: Document[]) => void;
    onDeleteDocument?: (documentId: string, documentName: string) => void;
    showUploadInterface?: boolean;
}

export default function DocumentList({
    documents,
    onDocumentsChange,
    onDeleteDocument,
    showUploadInterface = false
}: DocumentListProps) {
    const [completionModal, setCompletionModal] = useState<{
        open: boolean;
        document: Document | null;
    }>({ open: false, document: null });
    const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});
    const documentsRef = useRef<Document[]>(documents);

    // Keep ref in sync with documents
    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    const handleDeleteClick = (documentId: string, documentName: string) => {
        setDocumentToDelete({ id: documentId, name: documentName });
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!documentToDelete) return;

        setIsDeleting(true);
        const { id: documentId, name: documentName } = documentToDelete;

        try {
            if (onDeleteDocument) {
                await onDeleteDocument(documentId, documentName);
            } else {
                const response = await fetch(`/api/organization-knowledge-base/documents/${documentId}`, {
                    method: "DELETE",
                });

                if (!response.ok) {
                    throw new Error("Failed to delete document");
                }

                const result = await response.json();
                if (result.success) {
                    onDocumentsChange(documents.filter((doc) => doc.id !== documentId));
                    toast.success(`"${documentName}" deleted successfully`);
                }
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            toast.error(`Failed to delete "${documentName}"`);
        } finally {
            setIsDeleting(false);
            setDeleteConfirmOpen(false);
            setDocumentToDelete(null);
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return "Unknown size";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

    const checkDocumentStatus = async (documentId: string) => {
        try {
            const response = await fetch(`/api/organization-knowledge-base/documents/${documentId}`);
            if (!response.ok) return;

            const result = await response.json();
            if (result.success && result.document) {
                const updatedDoc = result.document;

                const currentDocuments = documentsRef.current;
                const updatedDocuments = currentDocuments.map((doc) =>
                    doc.id === documentId ? { ...doc, ...updatedDoc } : doc
                );
                onDocumentsChange(updatedDocuments);

                // If processing completed, show modal and stop polling
                if (updatedDoc.extractionStatus === "COMPLETED") {
                    if (pollingIntervals.current[documentId]) {
                        clearInterval(pollingIntervals.current[documentId]);
                        delete pollingIntervals.current[documentId];
                    }

                    if (updatedDoc.insights && updatedDoc.insights.length > 0) {
                        setCompletionModal({
                            open: true,
                            document: updatedDoc,
                        });
                        toast.success(`"${updatedDoc.name}" processed successfully!`, {
                            description: `Extracted ${updatedDoc.insights.length} insight${updatedDoc.insights.length > 1 ? 's' : ''} from your document.`,
                            duration: 5000,
                        });
                    } else {
                        toast.success(`"${updatedDoc.name}" processed successfully!`, {
                            description: "Content extracted and added to your knowledge base.",
                            duration: 5000,
                        });
                    }
                } else if (updatedDoc.extractionStatus === "FAILED") {
                    if (pollingIntervals.current[documentId]) {
                        clearInterval(pollingIntervals.current[documentId]);
                        delete pollingIntervals.current[documentId];
                    }

                    toast.error(`Failed to process "${updatedDoc.name}"`, {
                        description: updatedDoc.extractionError || "An error occurred during processing.",
                        duration: 5000,
                    });
                }
            }
        } catch (error) {
            console.error("Error checking document status:", error);
        }
    };

    // Start polling for documents that are pending or processing
    useEffect(() => {
        const processingDocs = documents.filter(
            (doc) => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING"
        );

        // Clean up intervals for documents that are no longer pending/processing
        Object.keys(pollingIntervals.current).forEach((docId) => {
            const doc = documents.find((d) => d.id === docId);
            if (!doc || (doc.extractionStatus !== "PENDING" && doc.extractionStatus !== "PROCESSING")) {
                if (pollingIntervals.current[docId]) {
                    clearInterval(pollingIntervals.current[docId]);
                    delete pollingIntervals.current[docId];
                }
            }
        });

        // Start polling for new documents
        processingDocs.forEach((doc) => {
            if (!pollingIntervals.current[doc.id]) {
                checkDocumentStatus(doc.id);
                pollingIntervals.current[doc.id] = setInterval(() => {
                    checkDocumentStatus(doc.id);
                }, 3000);
            }
        });

        // Cleanup on unmount
        return () => {
            Object.values(pollingIntervals.current).forEach((interval) => {
                clearInterval(interval);
            });
            pollingIntervals.current = {};
        };
    }, [documents]);

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case "PENDING":
                return (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        Pending
                    </Badge>
                );
            case "PROCESSING":
                return (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Processing
                    </Badge>
                );
            case "COMPLETED":
                return (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Processed
                    </Badge>
                );
            case "FAILED":
                return (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Failed
                    </Badge>
                );
            default:
                return null;
        }
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case "PENDING":
                return <FileText className="w-4 h-4 flex-shrink-0 text-amber-500" />;
            case "PROCESSING":
                return <Loader2 className="w-4 h-4 flex-shrink-0 text-blue-500 animate-spin" />;
            case "COMPLETED":
                return <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />;
            case "FAILED":
                return <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />;
            default:
                return <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />;
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Document Library
                            </CardTitle>
                            <CardDescription>
                                {documents.length === 0
                                    ? "No documents uploaded yet."
                                    : `${documents.length} document${documents.length === 1 ? '' : 's'} uploaded`}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Documents List */}
                    {documents.length > 0 ? (
                        <div className="space-y-2">
                            {documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {getStatusIcon(doc.extractionStatus)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="truncate block font-medium">{doc.name}</span>
                                                {doc.size && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {formatFileSize(doc.size)}
                                                    </Badge>
                                                )}
                                                {getStatusBadge(doc.extractionStatus)}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                {doc.uploadedAt && (
                                                    <span className="text-muted-foreground text-[10px]">
                                                        Uploaded {formatDate(doc.uploadedAt)}
                                                    </span>
                                                )}
                                                {doc.extractedAt && doc.extractionStatus === "COMPLETED" && (
                                                    <>
                                                        <span className="text-muted-foreground text-[10px]">•</span>
                                                        <span className="text-muted-foreground text-[10px]">
                                                            Processed {formatDate(doc.extractedAt)}
                                                        </span>
                                                    </>
                                                )}
                                                {doc.extractionStatus === "COMPLETED" && doc.insights && doc.insights.length > 0 && (
                                                    <>
                                                        <span className="text-muted-foreground text-[10px]">•</span>
                                                        <span className="text-[10px] text-[color:var(--accent-strong)] font-medium">
                                                            {doc.insights.length} insight{doc.insights.length > 1 ? 's' : ''} extracted
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            {doc.extractionError && doc.extractionStatus === "FAILED" && (
                                                <span className="text-destructive text-[10px] block mt-0.5">
                                                    {doc.extractionError}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {doc.url && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs"
                                                onClick={() => {
                                                    setPreviewDocument(doc);
                                                    setPreviewOpen(true);
                                                }}
                                            >
                                                View
                                            </Button>
                                        )}
                                        {doc.extractionStatus === "COMPLETED" && doc.insights && doc.insights.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs"
                                                onClick={() => setCompletionModal({ open: true, document: doc })}
                                            >
                                                <Sparkles className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteClick(doc.id, doc.name)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">
                                No documents uploaded yet. Upload files from the Knowledge Base page to get started.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

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

            {/* Document Preview Sheet */}
            <DocumentPreviewSheet
                document={previewDocument}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
                if (!isDeleting) {
                    setDeleteConfirmOpen(open);
                    if (!open) {
                        setDocumentToDelete(null);
                    }
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone and will permanently remove the document from your knowledge base.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

