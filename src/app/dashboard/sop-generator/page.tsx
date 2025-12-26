"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText, Plus, Loader2, CheckCircle2, Edit, Save, X, Sparkles, Download, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { sopGeneratorConfig } from "@/components/forms/configs/sopGeneratorConfig";
import { useUser } from "@/context/UserContext";
import { markdownToHtml } from "@/lib/markdown-to-html";

interface GeneratedSOP {
  sop: string; // Markdown content (for editing)
  sopHtml?: string; // HTML content (for display)
  sopId: string | null;
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

export default function SopPage() {
  const { user } = useUser();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedSOP, setGeneratedSOP] = useState<GeneratedSOP | null>(null);
  const [sopHtml, setSopHtml] = useState<string>("");
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

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save SOP modifications");
      }

      // Update local state with the updated SOP
      // Handle both string content (legacy) and object with markdown/html fields
      const responseContent = result.sop.content;
      let markdownContent = "";
      let htmlContent = undefined;

      if (typeof responseContent === "string") {
        // Legacy: content is just a string (markdown)
        markdownContent = responseContent;
      } else if (responseContent && typeof responseContent === "object") {
        // New: content is an object with markdown and html fields
        markdownContent = responseContent.markdown || "";
        htmlContent = responseContent.html || undefined;
      }

      console.log("[SOP Page] Updated SOP:", {
        hasMarkdown: !!markdownContent,
        hasHtml: !!htmlContent,
        markdownLength: markdownContent.length,
        htmlLength: htmlContent?.length || 0,
      });

      setGeneratedSOP({
        ...generatedSOP,
        sop: markdownContent,
        sopHtml: htmlContent,
        sopId: result.sop.id,
      });

      setIsEditing(false);
      setReviewWithAI(false);
      setAiReviewSuggestions(null);
      setShowReviewResults(false);

      toast.success("SOP modifications saved!", {
        description: `Your changes have been saved successfully (version ${result.sop.version}).`,
      });
    } catch (error: any) {
      console.error("Error saving SOP modifications:", error);
      toast.error("Failed to save modifications", {
        description: error.message || "An error occurred while saving.",
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

          // FIX: Properly extract markdown and HTML from content object
          let markdownContent = "";
          let htmlContent = undefined;

          if (typeof content === "string") {
            // Legacy: content is just a string (markdown)
            markdownContent = content;
          } else if (content && typeof content === "object") {
            // New: content is an object with markdown and html fields
            markdownContent = content.markdown || "";
            htmlContent = content.html || undefined;
          }

          console.log("[SOP Page] Loaded SOP:", {
            hasMarkdown: !!markdownContent,
            hasHtml: !!htmlContent,
            markdownLength: markdownContent.length,
            htmlLength: htmlContent?.length || 0,
          });

          setGeneratedSOP({
            sop: markdownContent,
            sopHtml: htmlContent,
            sopId: latestSOP.id,
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
          setHasNoSavedSOPs(false);
        } else {
          setHasNoSavedSOPs(true);
        }
      } catch (error) {
        console.error("Error loading latest SOP:", error);
        setHasNoSavedSOPs(true);
      } finally {
        setIsLoadingLatest(false);
      }
    };

    loadLatestSOP();
  }, [user, generatedSOP, isLoadingLatest]);

  // Use HTML from API response or convert markdown to HTML if needed
  useEffect(() => {
    if (generatedSOP) {
      // Prefer HTML from API response, fallback to converting markdown
      if (generatedSOP.sopHtml) {
        setSopHtml(generatedSOP.sopHtml);
      } else if (generatedSOP.sop) {
        // Fallback: convert markdown if HTML not provided
        const convertToHtml = async () => {
          try {
            const html = await markdownToHtml(generatedSOP.sop);
            if (html && html.trim()) {
              setSopHtml(html);
            } else {
              setSopHtml(`<pre>${generatedSOP.sop.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
            }
          } catch (error) {
            console.error("Error converting markdown to HTML:", error);
            setSopHtml(`<pre>${generatedSOP.sop.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
          }
        };
        convertToHtml();
      } else {
        setSopHtml("");
      }
    } else {
      setSopHtml("");
    }
  }, [generatedSOP]);

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
          sopContent: generatedSOP.sop,
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
        toast.success("PDF downloaded successfully!");
      }, 100);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download PDF", {
        description: error.message || "An error occurred while generating the PDF.",
      });
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 p-4 border-b">
        <SidebarTrigger />
      </div>
      <div className="transition-all duration-300 ease-in-out min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">SOP Builder AI</h1>
                <p className="text-sm text-muted-foreground">
                  Automatically generate standard operating procedures for your business
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsModalOpen(true)} className="sm:self-start">
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Generate SOP</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard/sop-generator/history")}
                  className="sm:self-start"
                >
                  <History className="h-4 w-4 mr-2" />
                  <span>History</span>
                </Button>

              </div>
            </div>
          </div>

          {/* Loading Latest SOP */}
          {isLoadingLatest && !generatedSOP && !isProcessing && (
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  Loading your latest SOP...
                </p>
              </CardContent>
            </Card>
          )}

          {isProcessing && (
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  {statusMessage || "Processing your SOP..."}
                </p>
              </CardContent>
            </Card>
          )}

          {error && !isProcessing && (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="py-4">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    setIsModalOpen(true);
                  }}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {generatedSOP && !isProcessing && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      {generatedSOP.metadata.title}
                    </CardTitle>
                    <CardDescription>
                      Generated on {new Date(generatedSOP.metadata.generatedAt).toLocaleString()}
                      {generatedSOP.metadata.organizationProfileUsed && (
                        <span className="ml-2">• Using organization profile</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setIsPreviewDialogOpen(true)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(true);
                            setEditedSOPContent(generatedSOP.sop);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit SOP
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
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
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            if (reviewWithAI) {
                              // AI Review flow
                              setIsReviewing(true);
                              try {
                                // TODO: Backend API call for AI review
                                // For now, simulate AI review
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

                                if (response.ok) {
                                  const result = await response.json();
                                  if (result.suggestions && result.suggestions.length > 0) {
                                    setAiReviewSuggestions(result);
                                    setShowReviewResults(true);
                                    toast.info("AI review complete", {
                                      description: `Found ${result.suggestions.length} suggestion(s). Review them below.`,
                                    });
                                  } else {
                                    // No suggestions, proceed to save
                                    await saveSOPModifications(editedSOPContent);
                                  }
                                } else {
                                  throw new Error("AI review failed");
                                }
                              } catch (error: any) {
                                console.error("Error during AI review:", error);
                                // If review fails, still allow saving
                                toast.warning("AI review unavailable", {
                                  description: "Proceeding with save. You can still submit your changes.",
                                });
                                await saveSOPModifications(editedSOPContent);
                              } finally {
                                setIsReviewing(false);
                              }
                            } else {
                              // Direct save without review
                              await saveSOPModifications(editedSOPContent);
                            }
                          }}
                          disabled={isSubmitting || isReviewing || !editedSOPContent.trim()}
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
                  <div className="space-y-4 w-full max-w-full">
                    {showReviewResults && aiReviewSuggestions && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">AI Review Suggestions</h3>
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
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {aiReviewSuggestions.suggestions?.map((suggestion: any, index: number) => (
                            <div key={index} className="p-3 bg-background rounded border">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {suggestion.type || "Suggestion"}
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Apply suggestion
                                      const updatedContent = editedSOPContent.replace(
                                        suggestion.original,
                                        suggestion.suggested
                                      );
                                      setEditedSOPContent(updatedContent);
                                      // Remove this suggestion
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
                                      // Remove suggestion
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
                                  <span className="text-muted-foreground">Original: </span>
                                  <span className="line-through text-muted-foreground">{suggestion.original}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Suggested: </span>
                                  <span className="text-foreground">{suggestion.suggested}</span>
                                </div>
                                {suggestion.reason && (
                                  <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            {aiReviewSuggestions.suggestions?.length || 0} suggestion(s) remaining
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              // Apply all suggestions
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
                      </div>
                    )}
                    <Textarea
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
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="review-with-ai"
                        checked={reviewWithAI}
                        onChange={(e) => setReviewWithAI(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        disabled={isSubmitting || isReviewing}
                      />
                      <Label
                        htmlFor="review-with-ai"
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className="h-4 w-4 text-primary" />
                        Review with AI before submitting
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 Tip: You can edit the markdown content directly. {reviewWithAI ? "When enabled, AI will review your changes for grammar, clarity, and consistency before saving." : "Changes will be saved when you click 'Submit Modifications'."}
                    </p>
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
                    <div
                      className="sop-content-display w-full max-w-full"
                      style={{
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        overflowX: 'hidden',
                        maxWidth: '100%'
                      }}
                      dangerouslySetInnerHTML={{ __html: sopHtml }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {!generatedSOP && !isProcessing && !error && !isLoadingLatest && hasNoSavedSOPs && (
            <Card className="text-center">
              <CardContent className="py-12 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No SOPs Generated Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Create your first Standard Operating Procedure to get started
                  </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Generate Your First SOP
                </Button>
              </CardContent>
            </Card>
          )}
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

                  try {
                    const response = await fetch("/api/sop/generate", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      credentials: "include",
                      body: JSON.stringify(formData),
                    });

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                      throw new Error(result.message || "Failed to generate SOP");
                    }

                    console.log("[SOP Page] Received response:", {
                      hasSop: !!result.sop,
                      hasSopHtml: !!result.sopHtml,
                      sopLength: result.sop?.length || 0,
                      sopHtmlLength: result.sopHtml?.length || 0,
                    });

                    setGeneratedSOP({
                      sop: result.sop, // Markdown for editing
                      sopHtml: result.sopHtml || undefined, // HTML from API
                      sopId: result.sopId || null,
                      metadata: result.metadata,
                    });

                    setIsModalOpen(false);
                    setIsProcessing(false);
                    toast.success("SOP generated successfully!", {
                      description: `Your SOP "${result.metadata.title}" has been created.`,
                    });

                    return {
                      success: true,
                      message: "SOP generated successfully",
                    };
                  } catch (error: any) {
                    console.error("SOP generation error:", error);
                    setIsProcessing(false);
                    const errorMessage = error.message || "Failed to generate SOP";
                    setError(errorMessage);
                    toast.error("Failed to generate SOP", {
                      description: errorMessage,
                    });
                    throw error;
                  }
                }}
                onError={(error) => {
                  console.error("SOP generation error:", error);
                  toast.error(error || "Failed to generate SOP");
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
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <DialogTitle>Preview SOP Document</DialogTitle>
              <DialogDescription>
                Review your Standard Operating Procedure before downloading as PDF
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div
                className="sop-content-display w-full max-w-full"
                style={{
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  overflowX: 'hidden',
                  maxWidth: '100%'
                }}
                dangerouslySetInnerHTML={{ __html: sopHtml }}
              />
            </div>
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