"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Loader2, AlertCircle, Calendar, HardDrive } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Document } from "./DocumentLibrary";

interface DocumentPreviewSheetProps {
    document: Document | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function DocumentPreviewSheet({
    document,
    open,
    onOpenChange,
}: DocumentPreviewSheetProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [iframeKey, setIframeKey] = useState(0);
    const [presignedUrl, setPresignedUrl] = useState<string | null>(null);

    // Reset state when document changes
    useEffect(() => {
        if (document && open) {
            setIsLoading(true);
            setLoadError(null);
            setTextContent(null);
            setPresignedUrl(null);
            setIframeKey((prev) => prev + 1);

            const isPDF = document.type === "application/pdf" || document.name.endsWith(".pdf");
            const isText = document.type === "text/plain" || document.name.endsWith(".txt");

            // For PDFs and text files, get a fresh presigned URL
            if (isPDF || isText) {
                fetch(`/api/organization-knowledge-base/documents/${document.id}/view-url`)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error("Failed to get view URL");
                        }
                        return response.json();
                    })
                    .then((data) => {
                        if (data.success && data.presignedUrl) {
                            setPresignedUrl(data.presignedUrl);

                            if (isText) {
                                // For text files, fetch and display content using presigned URL
                                fetch(data.presignedUrl)
                                    .then((response) => {
                                        if (!response.ok) {
                                            throw new Error("Failed to load text file");
                                        }
                                        return response.text();
                                    })
                                    .then((text) => {
                                        setTextContent(text);
                                        setIsLoading(false);
                                    })
                                    .catch((error) => {
                                        console.error("Error loading text file:", error);
                                        setLoadError("Failed to load text content");
                                        setIsLoading(false);
                                    });
                            } else {
                                // For PDFs, presigned URL will be used in iframe
                                setIsLoading(false);
                            }
                        } else {
                            throw new Error("Invalid response from server");
                        }
                    })
                    .catch((error) => {
                        console.error("Error getting presigned URL:", error);
                        setLoadError("Failed to generate view URL. Please try again or download the file.");
                        setIsLoading(false);
                    });
            } else {
                setIsLoading(false);
            }
        }
    }, [document, open]);

    if (!document) return null;

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

    const getFileType = () => {
        const extension = document.name.substring(document.name.lastIndexOf(".")).toLowerCase();
        switch (extension) {
            case ".pdf":
                return "PDF";
            case ".doc":
                return "Word Document";
            case ".docx":
                return "Word Document";
            case ".txt":
                return "Text File";
            default:
                return document.type || "Unknown";
        }
    };

    const isPDF = document.type === "application/pdf" || document.name.endsWith(".pdf");
    const isText = document.type === "text/plain" || document.name.endsWith(".txt");
    const isWordDoc =
        document.type === "application/msword" ||
        document.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        document.name.endsWith(".doc") ||
        document.name.endsWith(".docx");

    const handleDownload = async () => {
        if (typeof window === "undefined" || !document) return;

        try {
            // Get a fresh presigned URL for download
            const response = await fetch(`/api/organization-knowledge-base/documents/${document.id}/view-url`);
            const data = await response.json();

            if (data.success && data.presignedUrl) {
                const link = window.document.createElement("a");
                link.href = data.presignedUrl;
                link.download = document.name;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
            } else {
                // Fallback to direct URL
                const link = window.document.createElement("a");
                link.href = document.url;
                link.download = document.name;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
            }
        } catch (error) {
            console.error("Error downloading file:", error);
            // Fallback to direct URL
            const link = window.document.createElement("a");
            link.href = document.url;
            link.download = document.name;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-4xl flex flex-col p-0 h-full overflow-hidden">
                <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <SheetTitle className="text-xl mb-2 line-clamp-2">{document.name}</SheetTitle>
                            <SheetDescription className="sr-only">
                                Document preview for {document.name}
                            </SheetDescription>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                                <div className="flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" />
                                    <span>{getFileType()}</span>
                                </div>
                                {document.size && (
                                    <>
                                        <span>•</span>
                                        <div className="flex items-center gap-1.5">
                                            <HardDrive className="h-3 w-3" />
                                            <span>{formatFileSize(document.size)}</span>
                                        </div>
                                    </>
                                )}
                                {document.uploadedAt && (
                                    <>
                                        <span>•</span>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3" />
                                            <span>Uploaded {formatDate(document.uploadedAt)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="shrink-0"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                    </div>
                </SheetHeader>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {isLoading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading document...</p>
                            </div>
                        </div>
                    )}

                    {!isLoading && loadError && (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-3 text-center px-6">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                                <p className="text-sm font-medium">{loadError}</p>
                                <Button variant="outline" size="sm" onClick={handleDownload}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Instead
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !loadError && isPDF && presignedUrl && (
                        <div className="h-full w-full">
                            <iframe
                                key={iframeKey}
                                src={presignedUrl}
                                className="w-full h-full border-0"
                                title={document.name}
                                onLoad={() => {
                                    setIsLoading(false);
                                }}
                                onError={() => {
                                    setLoadError("Failed to load PDF. The document may be unavailable.");
                                    setIsLoading(false);
                                }}
                            />
                        </div>
                    )}

                    {!isLoading && !loadError && isPDF && !presignedUrl && (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Preparing document...</p>
                            </div>
                        </div>
                    )}

                    {!isLoading && !loadError && isText && textContent !== null && (
                        <ScrollArea className="h-full">
                            <div className="p-6">
                                <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-4 rounded-lg border">
                                    {textContent}
                                </pre>
                            </div>
                        </ScrollArea>
                    )}

                    {!isLoading && !loadError && isWordDoc && (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
                                <div className="p-4 rounded-full bg-muted">
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Preview Not Available</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Word documents cannot be previewed in the browser. Please download the file to view it.
                                    </p>
                                </div>
                                <Button onClick={handleDownload} className="mt-2">
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Document
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !loadError && !isPDF && !isText && !isWordDoc && (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
                                <div className="p-4 rounded-full bg-muted">
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Preview Not Available</h3>
                                    <p className="text-sm text-muted-foreground">
                                        This file type cannot be previewed in the browser. Please download the file to view it.
                                    </p>
                                </div>
                                <Button onClick={handleDownload} className="mt-2">
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Document
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <SheetFooter className="px-6 py-4 border-t shrink-0">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            {document.extractionStatus === "COMPLETED" && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Processed
                                </Badge>
                            )}
                            {document.extractionStatus === "PROCESSING" && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Processing
                                </Badge>
                            )}
                            {document.extractionStatus === "PENDING" && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    Pending
                                </Badge>
                            )}
                            {document.extractionStatus === "FAILED" && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    Failed
                                </Badge>
                            )}
                        </div>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

