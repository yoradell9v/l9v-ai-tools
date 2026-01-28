"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export interface Document {
    id: string;
    name: string;
    url: string;
    key: string;
    type: string;
    size?: number;
    uploadedAt?: string;
    extractionStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    extractionError?: string | null;
    extractedAt?: string | null;
    extractedContent?: {
        summary?: string | null;
        keyPoints?: string[];
    } | null;
    insights?: Array<{
        field: string;
        insight: string;
        confidence: number;
        extractedAt?: string;
    }>;
}

interface DocumentLibraryProps {
    documents: Document[];
    onDocumentsChange: (documents: Document[]) => void;
}

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function DocumentLibrary({ documents, onDocumentsChange }: DocumentLibraryProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<Record<number, boolean>>({});
    const [fileUploadErrors, setFileUploadErrors] = useState<Record<number, string>>({});
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [completionModal, setCompletionModal] = useState<{
        open: boolean;
        document: Document | null;
    }>({ open: false, document: null });
    const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});
    const documentsRef = useRef<Document[]>(documents);

    // Keep ref in sync with documents
    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    const validateFile = (file: File): string | null => {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return `File "${file.name}" is too large. Please upload files under ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB.`;
        }

        // Check file extension
        const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        const isExtensionAllowed = ALLOWED_EXTENSIONS.some(ext => extension === ext);
        const isMimeAllowed = file.type ? ALLOWED_MIME_TYPES.includes(file.type) : isExtensionAllowed;

        if (!isExtensionAllowed && !isMimeAllowed) {
            return `Unsupported file type for "${file.name}". Allowed types: ${ALLOWED_EXTENSIONS.join(", ").toUpperCase()}.`;
        }

        return null;
    };

    const uploadFileToS3 = async (
        file: File,
        fileIndex: number
    ): Promise<{ url: string; name: string; key: string; type: string } | null> => {
        try {
            // Get presigned URL
            const presignedResponse = await fetch("/api/upload/presigned-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    fieldId: "organization-documents",
                    maxSize: MAX_FILE_SIZE,
                    allowedMimeTypes: ALLOWED_MIME_TYPES,
                }),
            });

            if (!presignedResponse.ok) {
                const errorData = await presignedResponse.json();
                throw new Error(errorData.error || "Failed to get upload URL");
            }

            const { presignedUrl, fileUrl, key } = await presignedResponse.json();

            const uploadResponse = await fetch(presignedUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type || "application/octet-stream",
                },
                credentials: "omit",
            });

            if (!uploadResponse.ok) {
                let errorText = "Failed to upload file to S3";
                try {
                    const errorBody = await uploadResponse.text();
                    if (errorBody) {
                        errorText = `S3 upload failed: ${errorBody}`;
                    } else {
                        errorText = `S3 upload failed with status ${uploadResponse.status}: ${uploadResponse.statusText}`;
                    }
                } catch (e) {
                    errorText = `S3 upload failed with status ${uploadResponse.status}: ${uploadResponse.statusText}`;
                }
                throw new Error(errorText);
            }

            return {
                url: fileUrl,
                name: file.name,
                key: key,
                type: file.type || "application/octet-stream",
            };
        } catch (error) {
            console.error("Error uploading file to S3:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to upload file";

            setFileUploadErrors((prev) => ({
                ...prev,
                [fileIndex]: errorMessage,
            }));

            return null;
        }
    };

    const handleFilesAdd = async (newFiles: File[]) => {
        const validFiles: File[] = [];
        const errors: string[] = [];

        // Validate each file
        newFiles.forEach((file) => {
            const error = validateFile(file);
            if (error) {
                errors.push(error);
            } else {
                // Check for duplicates
                const isDuplicate = files.some(
                    (existingFile) => existingFile.name === file.name && existingFile.size === file.size
                ) || documents.some(
                    (doc) => doc.name === file.name
                );
                if (!isDuplicate) {
                    validFiles.push(file);
                } else {
                    errors.push(`File "${file.name}" is already uploaded.`);
                }
            }
        });

        // Show errors if any
        if (errors.length > 0) {
            errors.forEach((error) => {
                toast.error(error);
            });
        }

        if (validFiles.length === 0) return;

        // Add valid files to UI state
        const startIndex = files.length;
        const updatedFiles = [...files, ...validFiles];
        setFiles(updatedFiles);

        // Mark files as uploading
        setUploadingFiles((prev) => {
            const newState = { ...prev };
            validFiles.forEach((_, index) => {
                newState[startIndex + index] = true;
            });
            return newState;
        });

        // Upload each file to S3
        const uploadPromises = validFiles.map(async (file, index) => {
            const fileIndex = startIndex + index;
            const uploadResult = await uploadFileToS3(file, fileIndex);

            // Remove from uploading state
            setUploadingFiles((prev) => {
                const newState = { ...prev };
                delete newState[fileIndex];
                return newState;
            });

            if (uploadResult) {
                // Save document to backend
                try {
                    const response = await fetch("/api/organization-knowledge-base/documents", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            name: uploadResult.name,
                            url: uploadResult.url,
                            key: uploadResult.key,
                            type: uploadResult.type,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error("Failed to save document");
                    }

                    const result = await response.json();
                    if (result.success && result.document) {
                        // Add to documents list
                        const newDocument = {
                            ...result.document,
                            extractionStatus: result.document.extractionStatus || "PENDING",
                        };
                        onDocumentsChange([...documents, newDocument]);
                        toast.success(`"${file.name}" uploaded successfully`, {
                            description: "Processing will begin shortly...",
                        });
                    }
                } catch (error) {
                    console.error("Error saving document:", error);
                    toast.error(`Failed to save "${file.name}"`);
                }
            }

            // Remove from files state after upload completes
            setFiles((prev) => prev.filter((f) => f !== file));
        });

        await Promise.all(uploadPromises);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            handleFilesAdd(Array.from(selectedFiles));
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles.length > 0) {
            handleFilesAdd(Array.from(droppedFiles));
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
                onDocumentsChange(documents.filter((doc) => doc.id !== documentId));
                toast.success(`"${documentName}" deleted successfully`);
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            toast.error(`Failed to delete "${documentName}"`);
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
        });
    };

    const checkDocumentStatus = async (documentId: string) => {
        try {
            const response = await fetch(`/api/organization-knowledge-base/documents/${documentId}`);
            if (!response.ok) return;

            const result = await response.json();
            if (result.success && result.document) {
                const updatedDoc = result.document;
                
                // Update the document in the list using ref to get latest documents
                const currentDocuments = documentsRef.current;
                const updatedDocuments = currentDocuments.map((doc) =>
                    doc.id === documentId ? { ...doc, ...updatedDoc } : doc
                );
                onDocumentsChange(updatedDocuments);

                // If processing completed, show modal and stop polling
                if (updatedDoc.extractionStatus === "COMPLETED") {
                    // Stop polling
                    if (pollingIntervals.current[documentId]) {
                        clearInterval(pollingIntervals.current[documentId]);
                        delete pollingIntervals.current[documentId];
                    }

                    // Show completion modal if there are insights
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
                    // Stop polling on failure
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
        documents.forEach((doc) => {
            if (
                (doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING") &&
                !pollingIntervals.current[doc.id]
            ) {
                // Check immediately
                checkDocumentStatus(doc.id);

                // Then poll every 3 seconds
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

    const hasUploading = Object.values(uploadingFiles).some((uploading) => uploading);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Document Library
                        </CardTitle>
                        <CardDescription>
                            Upload business documents, transcripts, customer data, and other relevant files to enhance your knowledge base context
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Area */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/50 hover:border-primary/50"
                        } ${hasUploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ALLOWED_EXTENSIONS.join(",")}
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={hasUploading}
                    />
                    <div className="flex flex-col items-center justify-center text-center">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="text-base font-medium mb-1">
                            {dragOver ? "Drop files here" : "Drag and drop files here"}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">or click to browse</p>
                        <p className="text-xs text-muted-foreground">
                            Accepted: {ALLOWED_EXTENSIONS.join(", ").toUpperCase()} · Max: {(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB per file
                        </p>
                    </div>
                </div>

                {/* Uploading Files List */}
                {files.length > 0 && (
                    <div className="space-y-2">
                        {files.map((file, index) => {
                            const isUploading = uploadingFiles[index] || false;
                            const uploadError = fileUploadErrors[index];

                            return (
                                <div
                                    key={`${file.name}-${index}`}
                                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${uploadError ? "border-destructive bg-destructive/5" : ""
                                        }`}
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {isUploading ? (
                                            <Loader2 className="w-4 h-4 flex-shrink-0 text-primary animate-spin" />
                                        ) : uploadError ? (
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-destructive" />
                                        ) : (
                                            <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <span className="truncate block">
                                                {file.name} · {formatFileSize(file.size)}
                                            </span>
                                            {uploadError && (
                                                <span className="text-destructive text-[10px] block mt-0.5">
                                                    {uploadError}
                                                </span>
                                            )}
                                            {isUploading && (
                                                <span className="text-muted-foreground text-[10px] block mt-0.5">
                                                    Uploading...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Existing Documents List */}
                {documents.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-base font-medium">Uploaded Documents ({documents.length})</p>
                        </div>
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
                                                onClick={() => window.open(doc.url, "_blank")}
                                            >
                                                View
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {documents.length === 0 && files.length === 0 && !hasUploading && (
                    <div className="text-center py-4">
                        <p className="text-base text-muted-foreground">
                            No documents uploaded yet. Upload files to add context to your knowledge base.
                        </p>
                    </div>
                )}
            </CardContent>

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
                                    <h4 className="text-base font-semibold">Summary</h4>
                                    <p className="text-base text-muted-foreground">
                                        {completionModal.document.extractedContent.summary}
                                    </p>
                                </div>
                            )}

                            {completionModal.document?.insights && completionModal.document.insights.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-base font-semibold">
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
                                                <p className="text-base mt-1">{insight.insight}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {completionModal.document?.extractedContent?.keyPoints &&
                                completionModal.document.extractedContent.keyPoints.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-base font-semibold">Key Points</h4>
                                        <ul className="list-disc list-inside space-y-1 text-base text-muted-foreground">
                                            {completionModal.document.extractedContent.keyPoints.map((point, idx) => (
                                                <li key={idx}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            {(!completionModal.document?.insights || completionModal.document.insights.length === 0) &&
                                !completionModal.document?.extractedContent?.summary && (
                                    <div className="text-center py-4">
                                        <p className="text-base text-muted-foreground">
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
        </Card>
    );
}

