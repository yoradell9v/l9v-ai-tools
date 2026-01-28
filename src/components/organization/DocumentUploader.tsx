"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Document } from "./DocumentLibrary";

interface DocumentUploaderProps {
    documents: Document[];
    onDocumentsChange: (documents: Document[]) => void;
    onDocumentComplete?: (document: Document) => void;
    hideHeader?: boolean;
    hideCard?: boolean;
}

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function DocumentUploader({ documents, onDocumentsChange, onDocumentComplete, hideHeader = false, hideCard = false }: DocumentUploaderProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<Record<number, boolean>>({});
    const [fileUploadErrors, setFileUploadErrors] = useState<Record<number, string>>({});
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});
    const documentsRef = useRef<Document[]>(documents);

    const activeDocuments = documents.filter(
        (doc) => doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING"
    );

    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    const validateFile = (file: File): string | null => {
        if (file.size > MAX_FILE_SIZE) {
            return `File "${file.name}" is too large. Please upload files under ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB.`;
        }

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

        newFiles.forEach((file) => {
            const error = validateFile(file);
            if (error) {
                errors.push(error);
            } else {
                const isDuplicate = files.some(
                    (existingFile) => existingFile.name === file.name && existingFile.size === file.size
                ) || documents.some(
                    (doc) => doc.name === file.name
                );
                if (isDuplicate) {
                    errors.push(`File "${file.name}" is already uploaded.`);
                } else {
                    validFiles.push(file);
                }
            }
        });

        if (errors.length > 0) {
            errors.forEach((error) => {
                toast.error(error);
            });
        }

        if (validFiles.length === 0) return;

        const startIndex = files.length;
        const updatedFiles = [...files, ...validFiles];
        setFiles(updatedFiles);

        setUploadingFiles((prev) => {
            const newState = { ...prev };
            validFiles.forEach((_, index) => {
                newState[startIndex + index] = true;
            });
            return newState;
        });

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const fileIndex = startIndex + i;
            const uploadResult = await uploadFileToS3(file, fileIndex);

            setUploadingFiles((prev) => {
                const newState = { ...prev };
                delete newState[fileIndex];
                return newState;
            });

            if (uploadResult) {
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

            setFiles((prev) => prev.filter((f) => f !== file));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            handleFilesAdd(Array.from(selectedFiles));
        }
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

                if (updatedDoc.extractionStatus === "COMPLETED" || updatedDoc.extractionStatus === "FAILED") {
                    if (pollingIntervals.current[documentId]) {
                        clearInterval(pollingIntervals.current[documentId]);
                        delete pollingIntervals.current[documentId];
                    }

                    const completedDoc = updatedDocuments.find(d => d.id === documentId);
                    if (completedDoc) {
                        if (updatedDoc.extractionStatus === "COMPLETED") {
                            toast.success(`"${updatedDoc.name}" processed successfully!`, {
                                description: updatedDoc.insights && updatedDoc.insights.length > 0
                                    ? `${updatedDoc.insights.length} insight${updatedDoc.insights.length > 1 ? 's' : ''} extracted. Document moved to Documents page.`
                                    : "Content extracted and added to your knowledge base. Document moved to Documents page.",
                                duration: 6000,
                            });
                        } else if (updatedDoc.extractionStatus === "FAILED") {
                            toast.error(`"${updatedDoc.name}" processing failed`, {
                                description: updatedDoc.extractionError || "An error occurred during processing. You can view it in the Documents page.",
                                duration: 6000,
                            });
                        }
                        
                        if (onDocumentComplete) {
                            onDocumentComplete(completedDoc);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error checking document status:", error);
        }
    };

    useEffect(() => {
        Object.keys(pollingIntervals.current).forEach((docId) => {
            const doc = activeDocuments.find((d) => d.id === docId);
            if (!doc || (doc.extractionStatus !== "PENDING" && doc.extractionStatus !== "PROCESSING")) {
                if (pollingIntervals.current[docId]) {
                    clearInterval(pollingIntervals.current[docId]);
                    delete pollingIntervals.current[docId];
                }
            }
        });

        activeDocuments.forEach((doc) => {
            if (
                (doc.extractionStatus === "PENDING" || doc.extractionStatus === "PROCESSING") &&
                !pollingIntervals.current[doc.id]
            ) {
                checkDocumentStatus(doc.id);
                pollingIntervals.current[doc.id] = setInterval(() => {
                    checkDocumentStatus(doc.id);
                }, 3000);
            }
        });

        return () => {
            Object.values(pollingIntervals.current).forEach((interval) => {
                clearInterval(interval);
            });
            pollingIntervals.current = {};
        };
    }, [activeDocuments]);

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return "Unknown size";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

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
            default:
                return <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />;
        }
    };

    const hasUploading = Object.values(uploadingFiles).some((uploading) => uploading);

    const content = (
        <div className="space-y-4">
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                        dragOver
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
                        <p className="text-sm font-medium mb-1">
                            {dragOver ? "Drop files here" : "Drag and drop files here"}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">or click to browse</p>
                        <p className="text-xs text-muted-foreground">
                            Accepted: {ALLOWED_EXTENSIONS.join(", ").toUpperCase()} · Max: {(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB per file
                        </p>
                    </div>
                </div>

                {files.length > 0 && (
                    <div className="space-y-2">
                        {files.map((file, index) => {
                            const isUploading = uploadingFiles[index] || false;
                            const uploadError = fileUploadErrors[index];

                            return (
                                <div
                                    key={`${file.name}-${index}`}
                                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                                        uploadError ? "border-destructive bg-destructive/5" : ""
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

                {activeDocuments.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Processing ({activeDocuments.length})</p>
                        </div>
                        <div className="space-y-2">
                            {activeDocuments.map((doc) => (
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
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeDocuments.length === 0 && files.length === 0 && !hasUploading && (
                    <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                            No documents currently processing. Upload files to get started.
                        </p>
                    </div>
                )}
        </div>
    );

    if (hideCard) {
        return content;
    }

    return (
        <Card>
            {!hideHeader && (
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Document Upload
                            </CardTitle>
                            <CardDescription>
                                Upload business documents to enhance your knowledge base. Documents will be processed automatically.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            )}
            <CardContent className="space-y-4">
                {content}
            </CardContent>
        </Card>
    );
}

