"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText, Plus, Loader2, CheckCircle2, Edit, Save, X, Sparkles, Download, History, AlertCircle, RotateCcw, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { sopGeneratorConfig } from "@/components/forms/configs/sopGeneratorConfig";
import { useUser } from "@/context/UserContext";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { isRateLimitError, parseRateLimitError, getRateLimitErrorMessage } from "@/lib/rate-limit-client";

interface GeneratedSOP {
  sopHtml: string; // HTML content (primary format)
  sopId: string | null;
  versionNumber?: number;
  isCurrentVersion?: boolean;
  metadata: {
    title: string;
    generatedAt: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    organizationProfileUsed: boolean;
  };
}

interface SOPVersion {
  id: string;
  versionNumber: number;
  isCurrentVersion: boolean;
  createdBy: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
  createdAt: string;
  versionCreatedAt: string;
}

export default function SopPage() {
  const { user } = useUser();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedSOP, setGeneratedSOP] = useState<GeneratedSOP | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSOPContent, setEditedSOPContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewWithAI, setReviewWithAI] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [aiReviewSuggestions, setAiReviewSuggestions] = useState<any>(null);
  const [showReviewResults, setShowReviewResults] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const [hasNoSavedSOPs, setHasNoSavedSOPs] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [versions, setVersions] = useState<SOPVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const hasAttemptedLoadRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null>(null);

  const saveSOPModifications = async (content: string) => {
    setIsSubmitting(true);
    try {
      if (!generatedSOP?.sopId) {
        throw new Error("SOP ID not found. Please regenerate the SOP.");
      }

      const response = await fetch("/api/sop/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          sopId: generatedSOP.sopId,
          sopContent: content,
          reviewWithAI: reviewWithAI,
        }),
      });

      // Check for rate limit error
      if (isRateLimitError(response)) {
        const rateLimitError = await parseRateLimitError(response);
        const errorMessage = getRateLimitErrorMessage(rateLimitError);
        toast.error("Rate limit exceeded", {
          description: errorMessage,
          duration: 10000,
        });
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save SOP modifications");
      }

      // Update local state with the updated SOP (HTML only)
      const responseContent = result.sop.content;
      const htmlContent = typeof responseContent === "object"
        ? (responseContent.html || result.sopHtml)
        : result.sopHtml || "";

      if (!htmlContent) {
        throw new Error("No HTML content received from server");
      }

      setGeneratedSOP({
        ...generatedSOP,
        sopHtml: htmlContent,
        sopId: result.sop.id,
        versionNumber: result.sop.versionNumber || generatedSOP.versionNumber || 1,
        isCurrentVersion: true,
      });
      setSelectedVersionId(result.sop.id);

      // Reload versions after update
      if (result.sop.id) {
        loadVersions(result.sop.id);
      }

      setIsEditing(false);
      setReviewWithAI(false);
      setAiReviewSuggestions(null);
      setShowReviewResults(false);

      toast.success("SOP updated successfully!", {
        description: `Your changes have been saved. The SOP is now at version ${result.sop.version}.`,
      });
    } catch (error: any) {
      console.error("Error saving SOP modifications:", error);

      // User-friendly error messages
      let errorMessage = "We couldn't save your changes. Please try again.";
      if (error.message?.includes("not found")) {
        errorMessage = "The SOP could not be found. Please refresh the page and try again.";
      } else if (error.message?.includes("permission") || error.message?.includes("authorized")) {
        errorMessage = "You don't have permission to edit this SOP. Please contact your administrator.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Connection issue. Please check your internet connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error("Unable to save changes", {
        description: errorMessage,
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const loadLatestSOP = async () => {
      if (!user || generatedSOP || isLoadingLatest) return;
      const currentUserId = user.id;
      if (lastLoadedUserIdRef.current !== currentUserId) {
        hasAttemptedLoadRef.current = false;
      }
      if (hasAttemptedLoadRef.current) return;

      hasAttemptedLoadRef.current = true;
      lastLoadedUserIdRef.current = currentUserId;
      setIsLoadingLatest(true);
      try {
        const response = await fetch("/api/sop/saved?page=1&limit=1", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch saved SOPs");
        }

        const data = await response.json();
        if (data.success && data.data?.sops && data.data.sops.length > 0) {
          const latestSOP = data.data.sops[0];
          const content = latestSOP.content as any;
          const metadata = latestSOP.metadata as any;

          // Extract HTML from content (primary format)
          let htmlContent = "";

          if (typeof content === "string") {
            // Legacy: content is a string (treat as HTML if it has tags, otherwise it's markdown - should be rare)
            if (content.includes("<") && content.includes(">")) {
              htmlContent = content;
            } else {
              // Legacy markdown - this shouldn't happen with new SOPs
              console.warn("[SOP Page] Legacy SOP with markdown content detected");
              htmlContent = ""; // Will need conversion, but skip for now
            }
          } else if (content && typeof content === "object") {
            // New format: content is an object with html field
            htmlContent = content.html || "";
          }

          if (!htmlContent || htmlContent.trim().length === 0) {
            console.warn("[SOP Page] No HTML content found in SOP");
            setHasNoSavedSOPs(true);
            return;
          }

          setGeneratedSOP({
            sopHtml: htmlContent,
            sopId: latestSOP.id,
            versionNumber: latestSOP.versionNumber || 1,
            isCurrentVersion: true,
            metadata: {
              title: latestSOP.title,
              generatedAt: latestSOP.createdAt || new Date().toISOString(),
              tokens: metadata?.tokens || {
                prompt: 0,
                completion: 0,
                total: 0,
              },
              organizationProfileUsed: metadata?.organizationProfileUsed || false,
            },
          });
          setSelectedVersionId(latestSOP.id);
          setHasNoSavedSOPs(false);

          // Load versions for this SOP
          if (latestSOP.id) {
            loadVersions(latestSOP.id);
          }
        } else {
          setHasNoSavedSOPs(true);
        }
      } catch (error: any) {
        console.error("Error loading latest SOP:", error);
        setHasNoSavedSOPs(true);

        // Only show error toast if it's not just "no SOPs found"
        if (error.message && !error.message.includes("No SOPs")) {
          toast.error("Unable to load SOP", {
            description: "We couldn't load your saved SOP. Please refresh the page and try again.",
          });
        }
      } finally {
        setIsLoadingLatest(false);
      }
    };

    loadLatestSOP();
  }, [user, generatedSOP, isLoadingLatest]);

  // Load versions for a SOP
  const loadVersions = async (sopId: string) => {
    setIsLoadingVersions(true);
    try {
      const response = await fetch(`/api/sop/${sopId}/versions`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch versions");
      }

      const data = await response.json();
      if (data.success && data.versions) {
        setVersions(data.versions);
        // Set selected version to current if not already set
        const currentVersion = data.versions.find((v: SOPVersion) => v.isCurrentVersion);
        if (currentVersion && !selectedVersionId) {
          setSelectedVersionId(currentVersion.id);
        } else if (data.versions.length > 0 && !selectedVersionId) {
          // If no current version found, select the first one (latest)
          setSelectedVersionId(data.versions[0].id);
        }
      } else {
        // If no versions returned, create a single version entry for the current SOP
        if (generatedSOP?.sopId) {
          setVersions([{
            id: generatedSOP.sopId,
            versionNumber: generatedSOP.versionNumber || 1,
            isCurrentVersion: true,
            createdBy: {
              id: user?.id || "",
              firstname: user?.firstname || "",
              lastname: user?.lastname || "",
              email: user?.email || "",
            },
            createdAt: generatedSOP.metadata.generatedAt,
            versionCreatedAt: generatedSOP.metadata.generatedAt,
          }]);
          setSelectedVersionId(generatedSOP.sopId);
        }
      }
    } catch (error: any) {
      console.error("Error loading versions:", error);
      // If versions fail to load, create a single version entry for the current SOP
      // This handles the case where migration hasn't been run yet
      if (generatedSOP?.sopId) {
        setVersions([{
          id: generatedSOP.sopId,
          versionNumber: generatedSOP.versionNumber || 1,
          isCurrentVersion: true,
          createdBy: {
            id: user?.id || "",
            firstname: user?.firstname || "",
            lastname: user?.lastname || "",
            email: user?.email || "",
          },
          createdAt: generatedSOP.metadata.generatedAt,
          versionCreatedAt: generatedSOP.metadata.generatedAt,
        }]);
        setSelectedVersionId(generatedSOP.sopId);
      }
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Load a specific version
  const loadVersion = async (versionId: string) => {
    try {
      // Try to fetch the specific SOP by ID first
      let response = await fetch(`/api/sop/${versionId}`, {
        method: "GET",
        credentials: "include",
      });

      // If that fails, try fetching from saved endpoint
      if (!response.ok) {
        response = await fetch(`/api/sop/saved?page=1&limit=1000&includeAllVersions=true`, {
          method: "GET",
          credentials: "include",
        });
      }

      if (!response.ok) {
        throw new Error("Failed to fetch SOP");
      }

      const data = await response.json();
      let versionSOP: any = null;

      if (data.success) {
        // Handle response from /api/sop/[id]
        if (data.sop) {
          versionSOP = data.sop;
        }
        // Handle response from /api/sop/saved
        else if (data.data?.sops) {
          versionSOP = data.data.sops.find((s: any) => s.id === versionId);
        }
      }

      if (versionSOP) {
        const content = versionSOP.content as any;
        const htmlContent = typeof content === "object" ? content.html || "" : "";

        if (htmlContent) {
          setGeneratedSOP({
            sopHtml: htmlContent,
            sopId: versionSOP.id,
            versionNumber: versionSOP.versionNumber || 1,
            isCurrentVersion: versionSOP.isCurrentVersion ?? true,
            metadata: {
              title: versionSOP.title,
              generatedAt: versionSOP.createdAt || new Date().toISOString(),
              tokens: versionSOP.metadata?.tokens || {
                prompt: 0,
                completion: 0,
                total: 0,
              },
              organizationProfileUsed: versionSOP.metadata?.organizationProfileUsed || false,
            },
          });
          setSelectedVersionId(versionId);
        } else {
          throw new Error("SOP content not available");
        }
      } else {
        throw new Error("SOP version not found");
      }
    } catch (error: any) {
      console.error("Error loading version:", error);
      toast.error("Failed to load version", {
        description: error.message || "An error occurred while loading the version.",
      });
    }
  };

  // Restore a version
  const restoreVersion = async (versionId: string) => {
    setIsRestoring(true);
    try {
      const response = await fetch(`/api/sop/${versionId}/restore`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to restore version");
      }

      const data = await response.json();
      if (data.success) {
        toast.success("Version restored successfully!", {
          description: data.message || "The version has been restored as the current version.",
        });

        // Reload the current SOP and versions
        if (data.sop?.id) {
          // Load the newly restored version (which is now current)
          await loadVersion(data.sop.id);

          // Reload versions list
          const rootSOPId = (generatedSOP as any)?.rootSOPId || generatedSOP?.sopId || data.sop.id;
          await loadVersions(rootSOPId);
        } else if (generatedSOP?.sopId) {
          // Fallback: reload versions and find current
          const rootSOPId = (generatedSOP as any)?.rootSOPId || generatedSOP.sopId;
          await loadVersions(rootSOPId);

          // Find the new current version and load it
          try {
            const versionsResponse = await fetch(`/api/sop/${rootSOPId}/versions`, {
              method: "GET",
              credentials: "include",
            });
            if (versionsResponse.ok) {
              const versionsData = await versionsResponse.json();
              if (versionsData.success && versionsData.versions) {
                const newCurrent = versionsData.versions.find((v: SOPVersion) => v.isCurrentVersion);
                if (newCurrent) {
                  await loadVersion(newCurrent.id);
                }
              }
            }
          } catch (e) {
            // If versions endpoint fails, just reload the current SOP
            await loadVersion(generatedSOP.sopId);
          }
        }
      }
    } catch (error: any) {
      console.error("Error restoring version:", error);
      toast.error("Failed to restore version", {
        description: error.message || "An error occurred while restoring the version.",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // No need for separate HTML state - use generatedSOP.sopHtml directly

  const handleDownloadPDF = async () => {
    if (!generatedSOP) return;

    setIsDownloading(true);
    try {
      const response = await fetch("/api/sop/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          sopHtml: generatedSOP.sopHtml, // Use HTML directly
          title: generatedSOP.metadata.title,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition
        ? contentDisposition.split('filename="')[1]?.replace(/"/g, "") || "sop.pdf"
        : `${generatedSOP.metadata.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setIsDownloading(false);
        setIsPreviewDialogOpen(false);
        toast.success("PDF downloaded successfully!", {
          description: `Your SOP "${generatedSOP.metadata.title}" has been saved to your downloads folder.`,
        });
      }, 100);
    } catch (error: any) {
      console.error("Download error:", error);

      // User-friendly error messages
      let errorMessage = "We couldn't generate the PDF. Please try again.";
      if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Connection issue. Please check your internet connection and try again.";
      } else if (error.message?.includes("content") || error.message?.includes("markdown")) {
        errorMessage = "The SOP content couldn't be processed. Please try refreshing the page.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error("Unable to download PDF", {
        description: errorMessage,
      });
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 p-4 border-b bg-background">
        <SidebarTrigger />
      </div>
      <div className="transition-all duration-300 ease-in-out min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="space-y-6">
            {/* Header Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl sm:text-3xl">SOP Builder AI</CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      Automatically generate standard operating procedures for your business
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                      onClick={() => setIsModalOpen(true)}
                      size="default"
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      <span>Generate SOP</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/dashboard/sop-generator/history")}
                      size="default"
                      className="w-full sm:w-auto"
                    >
                      <History className="h-4 w-4 mr-2" />
                      <span>History</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Loading Latest SOP */}
            {isLoadingLatest && !generatedSOP && !isProcessing && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Loading your latest SOP...
                      </p>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Processing State */}
            {isProcessing && (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {statusMessage || "Processing your SOP..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This may take a few moments
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error State */}
            {error && !isProcessing && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{error}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setIsModalOpen(true);
                      }}
                    >
                      Try Again
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setError(null);
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* SOP Display Card */}
            {generatedSOP && !isProcessing && (
              <Card className="overflow-hidden">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <CardTitle className="text-xl sm:text-2xl">
                            {generatedSOP.metadata.title}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>Generated on {new Date(generatedSOP.metadata.generatedAt).toLocaleString()}</span>
                            {generatedSOP.metadata.organizationProfileUsed && (
                              <>
                                <Separator orientation="vertical" className="h-4" />
                                <span className="flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  Using organization profile
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Version Selector */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <Label htmlFor="version-select" className="text-sm font-medium shrink-0">
                            Version:
                          </Label>
                          {isLoadingVersions ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading versions...</span>
                            </div>
                          ) : versions.length > 0 ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Select
                                value={selectedVersionId || generatedSOP.sopId || ""}
                                onValueChange={(value) => {
                                  setSelectedVersionId(value);
                                  loadVersion(value);
                                }}
                                disabled={isLoadingVersions}
                              >
                                <SelectTrigger id="version-select" className="w-full sm:w-[280px]">
                                  <SelectValue placeholder="Select version" />
                                </SelectTrigger>
                                <SelectContent>
                                  {versions.map((version) => (
                                    <SelectItem key={version.id} value={version.id}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Version {version.versionNumber}</span>
                                        {version.isCurrentVersion && (
                                          <Badge variant="secondary" className="text-xs">
                                            Current
                                          </Badge>
                                        )}
                                        <span className="text-muted-foreground text-xs">
                                          • {new Date(version.versionCreatedAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {generatedSOP.versionNumber && (
                                <Badge variant={generatedSOP.isCurrentVersion ? "default" : "outline"}>
                                  {generatedSOP.isCurrentVersion ? "Current" : `v${generatedSOP.versionNumber}`}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Version {generatedSOP.versionNumber || 1}
                              </span>
                              {generatedSOP.isCurrentVersion && (
                                <Badge variant="secondary">Current</Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {generatedSOP.sopId && !generatedSOP.isCurrentVersion && versions.length > 0 && (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreVersion(generatedSOP.sopId!)}
                              disabled={isRestoring}
                            >
                              {isRestoring ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Restoring...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Make this version current
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      {!isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setIsPreviewDialogOpen(true)}
                            className="w-full sm:w-auto"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Download PDF</span>
                            <span className="sm:hidden">PDF</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              const markdown = htmlToMarkdown(generatedSOP.sopHtml);
                              setIsEditing(true);
                              setEditedSOPContent(markdown);
                            }}
                            className="w-full sm:w-auto"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit SOP
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false);
                              setEditedSOPContent("");
                              setReviewWithAI(false);
                              setAiReviewSuggestions(null);
                              setShowReviewResults(false);
                            }}
                            disabled={isSubmitting || isReviewing}
                            className="w-full sm:w-auto"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            onClick={async () => {
                              if (reviewWithAI) {
                                setIsReviewing(true);
                                try {
                                  const response = await fetch("/api/sop/review", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    credentials: "include",
                                    body: JSON.stringify({
                                      sopContent: editedSOPContent,
                                    }),
                                  });

                                  // Check for rate limit error
                                  if (isRateLimitError(response)) {
                                    const rateLimitError = await parseRateLimitError(response);
                                    const errorMessage = getRateLimitErrorMessage(rateLimitError);
                                    toast.error("Rate limit exceeded", {
                                      description: errorMessage,
                                      duration: 10000,
                                    });
                                    setIsReviewing(false);
                                    return;
                                  }

                                  if (response.ok) {
                                    const result = await response.json();
                                    if (result.suggestions && result.suggestions.length > 0) {
                                      setAiReviewSuggestions(result);
                                      setShowReviewResults(true);
                                      toast.info("AI review complete", {
                                        description: `Found ${result.suggestions.length} suggestion(s). Review them below.`,
                                      });
                                    } else {
                                      await saveSOPModifications(editedSOPContent);
                                    }
                                  } else {
                                    throw new Error("AI review failed");
                                  }
                                } catch (error: any) {
                                  console.error("Error during AI review:", error);
                                  toast.warning("AI review unavailable", {
                                    description: "Proceeding with save. You can still submit your changes.",
                                  });
                                  await saveSOPModifications(editedSOPContent);
                                } finally {
                                  setIsReviewing(false);
                                }
                              } else {
                                await saveSOPModifications(editedSOPContent);
                              }
                            }}
                            disabled={isSubmitting || isReviewing || !editedSOPContent.trim()}
                            className="w-full sm:w-auto"
                          >
                            {isReviewing ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Reviewing...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                {isSubmitting ? "Saving..." : "Submit Modifications"}
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="w-full max-w-full overflow-x-hidden">
                  {isEditing ? (
                    <div className="space-y-6 w-full max-w-full">
                      {/* AI Review Suggestions */}
                      {showReviewResults && aiReviewSuggestions && (
                        <Card className="border-primary/20 bg-muted/30">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">AI Review Suggestions</CardTitle>
                                <Badge variant="secondary">
                                  {aiReviewSuggestions.suggestions?.length || 0}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowReviewResults(false);
                                  setAiReviewSuggestions(null);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <ScrollArea className="h-[400px] pr-4">
                              <div className="space-y-3">
                                {aiReviewSuggestions.suggestions?.map((suggestion: any, index: number) => (
                                  <Card key={index} className="bg-background">
                                    <CardContent className="p-4 space-y-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {suggestion.type || "Suggestion"}
                                          </Badge>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const updatedContent = editedSOPContent.replace(
                                                suggestion.original,
                                                suggestion.suggested
                                              );
                                              setEditedSOPContent(updatedContent);
                                              const updatedSuggestions = {
                                                ...aiReviewSuggestions,
                                                suggestions: aiReviewSuggestions.suggestions.filter((_: any, i: number) => i !== index),
                                              };
                                              if (updatedSuggestions.suggestions.length === 0) {
                                                setShowReviewResults(false);
                                                setAiReviewSuggestions(null);
                                              } else {
                                                setAiReviewSuggestions(updatedSuggestions);
                                              }
                                              toast.success("Suggestion applied");
                                            }}
                                          >
                                            Accept
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const updatedSuggestions = {
                                                ...aiReviewSuggestions,
                                                suggestions: aiReviewSuggestions.suggestions.filter((_: any, i: number) => i !== index),
                                              };
                                              if (updatedSuggestions.suggestions.length === 0) {
                                                setShowReviewResults(false);
                                                setAiReviewSuggestions(null);
                                              } else {
                                                setAiReviewSuggestions(updatedSuggestions);
                                              }
                                            }}
                                          >
                                            Dismiss
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="text-muted-foreground font-medium">Original: </span>
                                          <span className="line-through text-muted-foreground">{suggestion.original}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground font-medium">Suggested: </span>
                                          <span className="text-foreground">{suggestion.suggested}</span>
                                        </div>
                                        {suggestion.reason && (
                                          <p className="text-xs text-muted-foreground mt-2 italic">{suggestion.reason}</p>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </ScrollArea>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">
                                {aiReviewSuggestions.suggestions?.length || 0} suggestion(s) remaining
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  let updatedContent = editedSOPContent;
                                  aiReviewSuggestions.suggestions.forEach((suggestion: any) => {
                                    updatedContent = updatedContent.replace(
                                      suggestion.original,
                                      suggestion.suggested
                                    );
                                  });
                                  setEditedSOPContent(updatedContent);
                                  setShowReviewResults(false);
                                  setAiReviewSuggestions(null);
                                  toast.success("All suggestions applied");
                                }}
                              >
                                Accept All
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Edit Textarea */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="sop-edit" className="text-sm font-medium">
                            Edit SOP Content
                          </Label>
                          <Textarea
                            id="sop-edit"
                            value={editedSOPContent}
                            onChange={(e) => setEditedSOPContent(e.target.value)}
                            className="min-h-[600px] font-mono text-sm w-full max-w-full resize-y break-words whitespace-pre-wrap"
                            placeholder="Edit your SOP content here..."
                            style={{
                              wordWrap: 'break-word',
                              overflowWrap: 'break-word',
                              overflowX: 'hidden',
                              maxWidth: '100%'
                            }}
                          />
                        </div>

                        {/* AI Review Checkbox */}
                        <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
                          <input
                            type="checkbox"
                            id="review-with-ai"
                            checked={reviewWithAI}
                            onChange={(e) => setReviewWithAI(e.target.checked)}
                            className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSubmitting || isReviewing}
                          />
                          <div className="flex-1 space-y-1">
                            <Label
                              htmlFor="review-with-ai"
                              className="text-sm font-medium cursor-pointer flex items-center gap-2"
                            >
                              <Sparkles className="h-4 w-4 text-primary" />
                              Review with AI before submitting
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              AI will review your changes for grammar, clarity, and consistency before saving.
                            </p>
                          </div>
                        </div>

                        {/* Helpful Tip */}
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Tip:</strong> You can edit the markdown content directly. {reviewWithAI ? "AI review is enabled and will check your changes before saving." : "Changes will be saved when you click 'Submit Modifications'."}
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  ) : (
                    <>
                      <style dangerouslySetInnerHTML={{
                        __html: `
                        .sop-content-display h1 {
                          font-size: 2rem;
                          font-weight: 700;
                          line-height: 1.2;
                          margin-top: 2rem;
                          margin-bottom: 1rem;
                          color: hsl(var(--foreground));
                        }
                        .sop-content-display h2 {
                          font-size: 1.5rem;
                          font-weight: 600;
                          line-height: 1.3;
                          margin-top: 1.5rem;
                          margin-bottom: 0.75rem;
                          color: hsl(var(--foreground));
                        }
                        .sop-content-display h3 {
                          font-size: 1.25rem;
                          font-weight: 600;
                          line-height: 1.4;
                          margin-top: 1.25rem;
                          margin-bottom: 0.5rem;
                          color: hsl(var(--foreground));
                        }
                        .sop-content-display h4,
                        .sop-content-display h5,
                        .sop-content-display h6 {
                          font-size: 1.125rem;
                          font-weight: 600;
                          line-height: 1.4;
                          margin-top: 1rem;
                          margin-bottom: 0.5rem;
                          color: hsl(var(--foreground));
                        }
                        .sop-content-display p {
                          margin-top: 1rem;
                          margin-bottom: 1rem;
                          line-height: 1.75;
                          color: hsl(var(--foreground));
                        }
                        .sop-content-display p:first-child {
                          margin-top: 0;
                        }
                        .sop-content-display p:last-child {
                          margin-bottom: 0;
                        }
                        .sop-content-display ul,
                        .sop-content-display ol {
                          margin-top: 1rem;
                          margin-bottom: 1rem;
                          padding-left: 1.5rem;
                          line-height: 1.75;
                        }
                        .sop-content-display li {
                          margin-top: 0.5rem;
                          margin-bottom: 0.5rem;
                        }
                        .sop-content-display strong {
                          font-weight: 600;
                          color: hsl(var(--foreground));
                        }
                        .sop-content-display em {
                          font-style: italic;
                        }
                        .sop-content-display code {
                          background-color: hsl(var(--muted));
                          padding: 0.125rem 0.375rem;
                          border-radius: 0.25rem;
                          font-size: 0.875em;
                          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
                        }
                        .sop-content-display pre {
                          background-color: hsl(var(--muted));
                          padding: 1rem;
                          border-radius: 0.5rem;
                          overflow-x: auto;
                          margin-top: 1rem;
                          margin-bottom: 1rem;
                        }
                        .sop-content-display pre code {
                          background-color: transparent;
                          padding: 0;
                        }
                        .sop-content-display blockquote {
                          border-left: 4px solid hsl(var(--border));
                          padding-left: 1rem;
                          margin-left: 0;
                          margin-top: 1rem;
                          margin-bottom: 1rem;
                          font-style: italic;
                          color: hsl(var(--muted-foreground));
                        }
                        .sop-content-display table {
                          width: 100%;
                          border-collapse: collapse;
                          margin-top: 1rem;
                          margin-bottom: 1rem;
                        }
                        .sop-content-display th,
                        .sop-content-display td {
                          border: 1px solid hsl(var(--border));
                          padding: 0.5rem;
                          text-align: left;
                        }
                        .sop-content-display th {
                          font-weight: 600;
                          background-color: hsl(var(--muted));
                        }
                        .sop-content-display hr {
                          border: none;
                          border-top: 1px solid hsl(var(--border));
                          margin-top: 2rem;
                          margin-bottom: 2rem;
                        }
                        .sop-content-display a {
                          color: hsl(var(--primary));
                          text-decoration: underline;
                        }
                        .sop-content-display a:hover {
                          text-decoration: none;
                        }
                      `}} />
                      {generatedSOP.sopHtml && generatedSOP.sopHtml.trim().length > 0 ? (
                        <ScrollArea className="h-[calc(100vh-400px)] w-full">
                          <div
                            className="sop-content-display w-full max-w-full pr-4"
                            style={{
                              wordWrap: 'break-word',
                              overflowWrap: 'break-word',
                              overflowX: 'hidden',
                              maxWidth: '100%'
                            }}
                            dangerouslySetInnerHTML={{ __html: generatedSOP.sopHtml }}
                          />
                        </ScrollArea>
                      ) : (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Content Unavailable</AlertTitle>
                          <AlertDescription className="space-y-3">
                            <p>HTML content not available. Please regenerate the SOP.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsModalOpen(true)}
                            >
                              Regenerate SOP
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!generatedSOP && !isProcessing && !error && !isLoadingLatest && hasNoSavedSOPs && (
              <Card>
                <CardContent className="py-16 sm:py-20">
                  <div className="flex flex-col items-center justify-center space-y-6 text-center max-w-md mx-auto">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl sm:text-2xl">No SOPs Generated Yet</CardTitle>
                      <CardDescription className="text-sm sm:text-base">
                        Create your first Standard Operating Procedure to get started with automated documentation for your business processes.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setIsModalOpen(true)}
                      size="lg"
                      className="inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Generate Your First SOP
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {user && (
        <Dialog open={isModalOpen} onOpenChange={(open) => !isProcessing && setIsModalOpen(open)}>
          <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2">

            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle >Generate SOP</DialogTitle>
              <DialogDescription>
                Fill out the details below and the AI will generate a clear, detailed SOP for your process.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 pb-4">
              <BaseIntakeForm
                userId={user.id}
                config={sopGeneratorConfig}
                onClose={() => {
                  if (!isProcessing) {
                    setIsModalOpen(false);
                  }
                }}
                onSuccess={async (data) => {
                  // Success is handled in onSubmit
                }}
                onProgress={(stage) => {
                  setStatusMessage(stage || "Generating SOP...");
                }}
                onSubmit={async (formData, uploadedFileUrls) => {
                  setIsProcessing(true);
                  setStatusMessage("Generating your SOP...");
                  setError(null);
                  setIsModalOpen(false); // Close modal immediately since loading state is shown on page

                  try {
                    const response = await fetch("/api/sop/generate", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      credentials: "include",
                      body: JSON.stringify(formData),
                    });

                    if (isRateLimitError(response)) {
                      const rateLimitError = await parseRateLimitError(response);
                      const errorMessage = getRateLimitErrorMessage(rateLimitError);
                      toast.error("Rate limit exceeded", {
                        description: errorMessage,
                        duration: 10000,
                      });
                      throw new Error(errorMessage);
                    }

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                      throw new Error(result.message || "Failed to generate SOP");
                    }

                    if (!result.sopHtml) {
                      throw new Error("No HTML content received from server");
                    }

                    setGeneratedSOP({
                      sopHtml: result.sopHtml, // HTML only (primary format)
                      sopId: result.sopId || null,
                      versionNumber: result.metadata?.versionNumber || 1,
                      isCurrentVersion: true,
                      metadata: result.metadata,
                    });
                    setSelectedVersionId(result.sopId);

                    // Load versions for the new SOP
                    if (result.sopId) {
                      loadVersions(result.sopId);
                    }

                    setIsProcessing(false);
                    toast.success("SOP generated successfully!", {
                      description: `Your Standard Operating Procedure "${result.metadata.title}" is ready to review and use.`,
                    });

                    return {
                      success: true,
                      message: "SOP generated successfully",
                    };
                  } catch (error: any) {
                    console.error("SOP generation error:", error);
                    setIsProcessing(false);

                    // User-friendly error messages
                    let errorMessage = "We couldn't generate your SOP. Please try again.";
                    if (error.message?.includes("network") || error.message?.includes("fetch")) {
                      errorMessage = "Connection issue. Please check your internet connection and try again.";
                    } else if (error.message?.includes("required") || error.message?.includes("missing")) {
                      errorMessage = "Please fill in all required fields and try again.";
                    } else if (error.message?.includes("token") || error.message?.includes("authenticated")) {
                      errorMessage = "Your session has expired. Please refresh the page and try again.";
                    } else if (error.message?.includes("OpenAI") || error.message?.includes("API")) {
                      errorMessage = "The AI service is temporarily unavailable. Please try again in a moment.";
                    } else if (error.message) {
                      errorMessage = error.message;
                    }

                    setError(errorMessage);
                    toast.error("Unable to generate SOP", {
                      description: errorMessage,
                    });
                    throw error;
                  }
                }}
                onError={(error) => {
                  console.error("SOP generation error:", error);
                  const errorMessage = typeof error === "string"
                    ? error
                    : "We couldn't generate your SOP. Please try again.";
                  toast.error("Unable to generate SOP", {
                    description: errorMessage,
                  });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PDF Preview Dialog */}
      {generatedSOP && (
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
              <DialogTitle className="text-xl">Preview SOP Document</DialogTitle>
              <DialogDescription>
                Review your Standard Operating Procedure before downloading as PDF
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
              {generatedSOP.sopHtml && generatedSOP.sopHtml.trim().length > 0 ? (
                <div
                  className="sop-content-display w-full max-w-full pr-4"
                  style={{
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    overflowX: 'hidden',
                    maxWidth: '100%'
                  }}
                  dangerouslySetInnerHTML={{ __html: generatedSOP.sopHtml }}
                />
              ) : (
                <Alert variant="destructive" className="my-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Preview Unavailable</AlertTitle>
                  <AlertDescription>
                    HTML content not available. Cannot preview.
                  </AlertDescription>
                </Alert>
              )}
            </ScrollArea>
            <DialogFooter className="px-6 py-4 flex-shrink-0 border-t">
              <Button
                variant="outline"
                onClick={() => setIsPreviewDialogOpen(false)}
                disabled={isDownloading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}