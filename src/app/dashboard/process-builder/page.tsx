"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText, Plus, Loader2, CheckCircle2, Save, X, Download, History, AlertCircle, RotateCcw, Info, MoreVertical, ChevronDown, Copy } from "lucide-react";
import { SparklesIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ToolChat } from "@/components/chat/ToolChat";
import { ToolChatDialog } from "@/components/chat/ToolChatDialog";
import { getToolChatConfig } from "@/lib/tool-chat/registry";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BaseIntakeForm, { BaseIntakeFormRef } from "@/components/forms/BaseIntakeForm";
import { sopGeneratorConfig } from "@/components/forms/configs/sopGeneratorConfig";
import { useUser } from "@/context/UserContext";
import { htmlToMarkdown } from "@/lib/extraction/html-to-markdown";
import { isRateLimitError, parseRateLimitError, getRateLimitErrorMessage } from "@/lib/rate-limiting/rate-limit-client";
import { copyToClipboard } from "@/lib/utils/copy-to-clipboard";

interface GeneratedSOP {
  sopHtml: string;
  sopId: string | null;
  versionNumber?: number;
  isCurrentVersion?: boolean;
  isDraft?: boolean; // true if generated from chat and not yet saved
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
  const [isToolChatOpen, setIsToolChatOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedSOP, setGeneratedSOP] = useState<GeneratedSOP | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
  const [hasNoSavedSOPs, setHasNoSavedSOPs] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [versions, setVersions] = useState<SOPVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreDraftDialogOpen, setIsRestoreDraftDialogOpen] = useState(false);
  const [pendingDraftData, setPendingDraftData] = useState<{ sop: GeneratedSOP; formData?: Record<string, any> } | null>(null);
  const hasAttemptedLoadRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const sopFormRef = useRef<BaseIntakeFormRef>(null);
  const draftFormDataRef = useRef<Record<string, any> | null>(null); // Store form data for draft saves

  // Save draft SOP (not published, isCurrentVersion: false)
  const saveSOPAsDraft = async () => {
    if (!generatedSOP) {
      toast.error("No SOP to save");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use stored form data from when "View on Page" was clicked, or fallback to minimal
      const formData = draftFormDataRef.current || {};
      const sopTitle = formData.sopTitle || generatedSOP.metadata.title || "SOP";

      // Ensure all required fields are present
      const saveFormData = {
        sopTitle: sopTitle,
        processOverview: formData.processOverview || "Generated from chat",
        primaryRole: formData.primaryRole || "Process Performer",
        mainSteps: formData.mainSteps || "See SOP content",
        toolsUsed: formData.toolsUsed || "See SOP content",
        frequency: formData.frequency || "As-needed",
        trigger: formData.trigger || "Manual initiation",
        successCriteria: formData.successCriteria || "Process completed successfully",
        ...formData, // Include any other fields
      };

      // For drafts, we already have the HTML - just save it
      // We'll use the generate endpoint but pass the existing HTML to skip regeneration
      const response = await fetch("/api/sop/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...saveFormData,
          existingSOPHtml: generatedSOP.sopHtml, // Pass existing HTML to skip regeneration
          saveAsDraft: true, // Flag to save as draft (isDraft: true)
          sopId: generatedSOP.sopId || undefined, // If updating existing draft, pass the ID
        }),
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
        throw new Error(result.message || "Failed to save SOP as draft");
      }

      if (!result.sopHtml) {
        throw new Error("No HTML content received from server");
      }

      // Update state - mark as saved draft
      setGeneratedSOP({
        ...generatedSOP,
        sopHtml: result.sopHtml,
        sopId: result.sopId || null,
        versionNumber: result.metadata?.versionNumber,
        isCurrentVersion: false, // Drafts are not current versions
        isDraft: true, // Still a draft, just saved to DB
      });

      // Update localStorage draft with saved version
      try {
        localStorage.setItem('sop-draft', JSON.stringify({
          sop: {
            sopHtml: result.sopHtml,
            sopId: result.sopId || null,
            versionNumber: result.metadata?.versionNumber,
            isCurrentVersion: false,
            isDraft: true,
            metadata: result.metadata,
          },
          formData: draftFormDataRef.current,
        }));
      } catch (e) {
        console.warn("Failed to update localStorage draft:", e);
      }

      if (result.sopId) {
        setSelectedVersionId(result.sopId);
        loadVersions(result.sopId);
      }

      toast.success("SOP saved as draft", {
        description: "Your SOP has been saved. You can publish it later or continue editing.",
      });
    } catch (error: any) {
      console.error("Error saving SOP as draft:", error);
      toast.error("Failed to save draft", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save and publish SOP (isCurrentVersion: true)
  const saveSOPAndPublish = async () => {
    if (!generatedSOP) {
      toast.error("No SOP to save");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use stored form data from when "View on Page" was clicked, or fallback to minimal
      const formData = draftFormDataRef.current || {};
      const sopTitle = formData.sopTitle || generatedSOP.metadata.title || "SOP";

      // Ensure all required fields are present
      const saveFormData = {
        sopTitle: sopTitle,
        processOverview: formData.processOverview || "Generated from chat",
        primaryRole: formData.primaryRole || "Process Performer",
        mainSteps: formData.mainSteps || "See SOP content",
        toolsUsed: formData.toolsUsed || "See SOP content",
        frequency: formData.frequency || "As-needed",
        trigger: formData.trigger || "Manual initiation",
        successCriteria: formData.successCriteria || "Process completed successfully",
        ...formData, // Include any other fields
      };

      // For publishing, we already have the HTML - just save it
      const response = await fetch("/api/sop/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...saveFormData,
          existingSOPHtml: generatedSOP.sopHtml, // Pass existing HTML to skip regeneration
          saveAndPublish: true, // Publish (isDraft: false, isCurrentVersion: true)
        }),
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
        throw new Error(result.message || "Failed to save and publish SOP");
      }

      if (!result.sopHtml) {
        throw new Error("No HTML content received from server");
      }

      // Update state - mark as published
      setGeneratedSOP({
        ...generatedSOP,
        sopHtml: result.sopHtml,
        sopId: result.sopId || null,
        versionNumber: result.metadata?.versionNumber || 1,
        isCurrentVersion: true, // Published and current
        isDraft: false, // Published, not a draft
      });

      // Clear localStorage draft (no longer needed as it's published)
      try {
        localStorage.removeItem('sop-draft');
      } catch (e) {
        console.warn("Failed to clear localStorage draft:", e);
      }

      // Load versions for the published SOP
      if (result.sopId) {
        await loadVersions(result.sopId);
      }

      if (result.sopId) {
        setSelectedVersionId(result.sopId);
        loadVersions(result.sopId);
      }

      toast.success("SOP saved and published", {
        description: "Your SOP has been saved and is now the current version.",
      });
    } catch (error: any) {
      console.error("Error saving and publishing SOP:", error);
      toast.error("Failed to save SOP", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };


  // Auto-save draft to localStorage
  useEffect(() => {
    if (!generatedSOP?.isDraft) return;

    const autoSaveInterval = setInterval(() => {
      try {
        localStorage.setItem('sop-draft', JSON.stringify({
          sop: generatedSOP,
          formData: draftFormDataRef.current,
        }));
      } catch (e) {
        console.warn("Failed to auto-save draft to localStorage:", e);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [generatedSOP]);

  // Beforeunload warning for unsaved drafts
  useEffect(() => {
    if (!generatedSOP?.isDraft) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have an unsaved draft. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [generatedSOP?.isDraft]);

  // Check for pending SOP from role-builder (created from job analysis)
  // This must run BEFORE loadLatestSOP to prevent overwriting
  // Run this effect FIRST, before any other SOP loading logic
  useEffect(() => {
    if (!user) return;

    // Check for pending SOP immediately on mount or user change
    try {
      const pendingSOP = sessionStorage.getItem('pending-sop');
      if (pendingSOP) {
        const parsed = JSON.parse(pendingSOP);
        if (parsed.sop) {
          // Set the flag FIRST to prevent loadLatestSOP from running
          hasAttemptedLoadRef.current = true;

          const pendingSOPData = {
            sopHtml: parsed.sop.sopHtml || "",
            sopId: null,
            isDraft: true,
            metadata: parsed.sop.metadata || {
              title: parsed.formData?.sopTitle || "SOP",
              generatedAt: new Date().toISOString(),
              tokens: { prompt: 0, completion: 0, total: 0 },
              organizationProfileUsed: false,
            },
          };

          setGeneratedSOP(pendingSOPData);

          if (parsed.formData) {
            draftFormDataRef.current = parsed.formData;
          }

          // Save to localStorage for consistency
          try {
            localStorage.setItem('sop-draft', JSON.stringify({
              sop: pendingSOPData,
              formData: parsed.formData,
            }));
          } catch (e) {
            console.warn("Failed to save draft to localStorage:", e);
          }

          sessionStorage.removeItem('pending-sop');

          toast.success("SOP created from job analysis", {
            description: "Your process has been generated. You can review and save it.",
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load pending SOP from sessionStorage:", e);
    }
  }, [user]); // Only depend on user, not generatedSOP, to run first

  // Restore draft from localStorage on mount
  // This runs AFTER pending SOP check, so pending SOPs take priority
  useEffect(() => {
    if (!user || generatedSOP) return; // Don't restore if we already have a SOP

    // Don't restore if there's a pending SOP in sessionStorage (it will be handled by the pending SOP effect)
    try {
      const pendingSOP = sessionStorage.getItem('pending-sop');
      if (pendingSOP) {
        // Pending SOP exists, don't restore draft
        return;
      }
    } catch (e) {
      // Ignore errors
    }

    try {
      const savedDraft = localStorage.getItem('sop-draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.sop && parsed.sop.isDraft) {
          // Store draft data and show dialog
          setPendingDraftData({
            sop: parsed.sop,
            formData: parsed.formData,
          });
          setIsRestoreDraftDialogOpen(true);
        }
      }
    } catch (e) {
      console.warn("Failed to restore draft from localStorage:", e);
    }
  }, [user, generatedSOP]);

  useEffect(() => {
    const loadLatestSOP = async () => {
      // Don't load if we already have a SOP (including drafts)
      if (!user || generatedSOP || isLoadingLatest) return;

      // Check if there's a pending SOP first - if so, don't load latest
      // This check is critical to prevent overwriting pending SOPs
      try {
        const pendingSOP = sessionStorage.getItem('pending-sop');
        if (pendingSOP) {
          // Pending SOP exists, let the other effect handle it
          // Set flag to prevent this from running again
          hasAttemptedLoadRef.current = true;
          return;
        }
      } catch (e) {
        // Ignore errors checking sessionStorage
      }

      // Check if there's a draft in localStorage - if so, don't load latest
      try {
        const savedDraft = localStorage.getItem('sop-draft');
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.sop && parsed.sop.isDraft) {
            // Draft exists, don't overwrite it with latest saved SOP
            hasAttemptedLoadRef.current = true;
            return;
          }
        }
      } catch (e) {
        // Ignore errors checking localStorage
      }

      // Check if flag is set (meaning pending SOP was loaded)
      if (hasAttemptedLoadRef.current) return;

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

          let htmlContent = "";

          if (typeof content === "string") {
            if (content.includes("<") && content.includes(">")) {
              htmlContent = content;
            } else {
              console.warn("[SOP Page] Legacy SOP with markdown content detected");
              htmlContent = "";
            }
          } else if (content && typeof content === "object") {
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
            isDraft: false, // Explicitly set to false for saved SOPs
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

          if (latestSOP.id) {
            loadVersions(latestSOP.id);
          }
        } else {
          setHasNoSavedSOPs(true);
        }
      } catch (error: any) {
        console.error("Error loading latest SOP:", error);
        setHasNoSavedSOPs(true);

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
        const currentVersion = data.versions.find((v: SOPVersion) => v.isCurrentVersion);
        if (currentVersion && !selectedVersionId) {
          setSelectedVersionId(currentVersion.id);
        } else if (data.versions.length > 0 && !selectedVersionId) {
          setSelectedVersionId(data.versions[0].id);
        }
      } else {
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

  const loadVersion = async (versionId: string) => {
    try {
      let response = await fetch(`/api/sop/${versionId}`, {
        method: "GET",
        credentials: "include",
      });

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
        if (data.sop) {
          versionSOP = data.sop;
        }
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
            isDraft: false, // Versions are always saved, not drafts
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

        if (data.sop?.id) {
          await loadVersion(data.sop.id);

          const rootSOPId = (generatedSOP as any)?.rootSOPId || generatedSOP?.sopId || data.sop.id;
          await loadVersions(rootSOPId);
        } else if (generatedSOP?.sopId) {
          const rootSOPId = (generatedSOP as any)?.rootSOPId || generatedSOP.sopId;
          await loadVersions(rootSOPId);

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
          sopHtml: generatedSOP.sopHtml,
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
      <div className="w-full max-w-screen overflow-x-hidden h-screen flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
          <SidebarTrigger />
        </div>
        <div
          className="transition-all duration-300 ease-in-out flex-1 min-h-0 flex flex-col overflow-hidden overflow-x-hidden w-full max-w-full"
        >
          <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0">
            <div className="flex-shrink-0 p-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold mb-1">
                    SOP Builder AI
                  </h1>
                  <p className="text-base text-muted-foreground">
                    Automatically generate standard operating procedures for your business
                  </p>
                </div>
                <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-4 mt-1 md:mt-0">
                  {!isProcessing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white">
                          <Plus className="h-4 w-4" />
                          <span>Generate SOP</span>
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsModalOpen(true)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Fill Out Form
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsToolChatOpen(true)}>
                          <SparklesIcon className="h-4 w-4 mr-2" />
                          Generate with AI
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard/process-builder/history")}
                    className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                  >
                    <History className="h-4 w-4" />
                    History
                  </Button>
                </div>
              </div>
              <Separator />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">

              {isLoadingLatest && !generatedSOP && !isProcessing && (
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <div className="space-y-2 flex-1">
                        <p className="text-base font-medium text-foreground">
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

              {isProcessing && (
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <div className="space-y-1 flex-1">
                        <p className="text-base font-medium text-foreground">
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

              {generatedSOP && !isProcessing && (
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Draft Banner */}
                  {generatedSOP.isDraft && (
                    <div className="flex-shrink-0 p-4 pb-0">
                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle className="text-amber-900 dark:text-amber-100">Draft (Not Saved)</AlertTitle>
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          This SOP was generated from chat and hasn't been saved yet. Save it to keep it permanently.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="flex-shrink-0 space-y-4 p-6 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b sticky top-0 z-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-xl sm:text-2xl font-semibold">
                                {generatedSOP.metadata.title}
                              </h2>
                              {generatedSOP.isDraft && (
                                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                                  Draft
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
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

                        {/* Save Buttons for Drafts */}
                        {generatedSOP.isDraft && (
                          <div className="flex flex-wrap gap-3 pt-2">
                            <Button
                              onClick={async () => {
                                await saveSOPAsDraft();
                              }}
                              variant="outline"
                              disabled={isSubmitting}
                              className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save as Draft
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={async () => {
                                await saveSOPAndPublish();
                              }}
                              disabled={isSubmitting}
                              className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Publishing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Save & Publish
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        <Separator />

                        {/* Version selector - only show for saved SOPs, not drafts */}
                        {!generatedSOP.isDraft && (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              <Label htmlFor="version-select" className="text-base font-medium shrink-0">
                                Version:
                              </Label>
                              {isLoadingVersions ? (
                                <div className="flex items-center gap-2 text-base text-muted-foreground">
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
                                  <span className="text-base text-muted-foreground">
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
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="w-full sm:w-auto border-[var(--accent-strong)] text-[var(--accent-strong)] hover:bg-[var(--accent-strong)]/10">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={async () => {
                              if (generatedSOP?.sopHtml) {
                                const markdown = htmlToMarkdown(generatedSOP.sopHtml);
                                const success = await copyToClipboard(
                                  markdown,
                                  () => toast.success("SOP content copied to clipboard"),
                                  (error: Error) => toast.error("Failed to copy", { description: error.message })
                                );
                              } else {
                                toast.error("No SOP content to copy");
                              }
                            }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy to Clipboard
                            </DropdownMenuItem>
                            <Separator />
                            <DropdownMenuItem onClick={() => setIsPreviewDialogOpen(true)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <Separator />
                            <DropdownMenuItem onClick={() => setIsRefinementModalOpen(true)}>
                              <SparklesIcon className="h-4 w-4 mr-2" />
                              Refine SOP
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div id="sop-display" className="p-6 pt-4 w-full max-w-full overflow-x-hidden">
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
                        <div className="w-full">
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
                        </div>
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
                    </div>
                  </ScrollArea>
                </div>
              )}

              {!generatedSOP && !isProcessing && !error && !isLoadingLatest && hasNoSavedSOPs && (
                <Card>
                  <CardContent className="py-16 sm:py-20">
                    <div className="flex flex-col items-center justify-center space-y-6 text-center max-w-md mx-auto">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-xl sm:text-2xl">No SOPs Generated Yet</CardTitle>
                        <CardDescription className="text-base sm:text-base">
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
      </div>

      {user && (
        <Dialog open={isModalOpen} onOpenChange={(open) => !isProcessing && setIsModalOpen(open)}>
          <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2 flex flex-col">

            <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
              <DialogTitle >Generate SOP</DialogTitle>
              <DialogDescription>
                Fill out the details below and the AI will generate a clear, detailed SOP for your process.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 pb-4 flex flex-col flex-1 min-h-0 overflow-hidden">
              <BaseIntakeForm
                ref={sopFormRef}
                userId={user.id}
                config={sopGeneratorConfig}
                onClose={() => {
                  if (!isProcessing) {
                    setIsModalOpen(false);
                  }
                }}
                onSuccess={async (data) => {
                }}
                onProgress={(stage) => {
                  setStatusMessage(stage || "Generating SOP...");
                }}
                onSubmit={async (formData, uploadedFileUrls) => {
                  setIsProcessing(true);
                  setStatusMessage("Generating your SOP...");
                  setError(null);
                  setIsModalOpen(false);

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

                    // Form-generated SOPs are now drafts until user saves
                    setGeneratedSOP({
                      sopHtml: result.sopHtml,
                      sopId: result.sopId || null, // Will be null if not saved
                      versionNumber: result.metadata?.versionNumber,
                      isCurrentVersion: false,
                      isDraft: result.isDraft !== undefined ? result.isDraft : true, // Default to draft if not saved
                      metadata: result.metadata,
                    });

                    // Store form data for saving later
                    draftFormDataRef.current = formData;

                    // Save to localStorage for auto-recovery
                    try {
                      localStorage.setItem('sop-draft', JSON.stringify({
                        sop: {
                          sopHtml: result.sopHtml,
                          sopId: result.sopId || null,
                          versionNumber: result.metadata?.versionNumber,
                          isCurrentVersion: false,
                          isDraft: true,
                          metadata: result.metadata,
                        },
                        formData: formData,
                      }));
                    } catch (e) {
                      console.warn("Failed to save draft to localStorage:", e);
                    }

                    if (result.sopId) {
                      setSelectedVersionId(result.sopId);
                    }

                    if (result.sopId) {
                      loadVersions(result.sopId);
                    }

                    setIsProcessing(false);
                    toast.success("SOP generated successfully!", {
                      description: `Your Standard Operating Procedure "${result.metadata.title}" is ready. Review it below and save when ready.`,
                    });

                    return {
                      success: true,
                      message: "SOP generated successfully",
                    };
                  } catch (error: any) {
                    console.error("SOP generation error:", error);
                    setIsProcessing(false);

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

      {generatedSOP && (
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Download</DialogTitle>
              <DialogDescription className="text-base pt-2">
                Version {generatedSOP.versionNumber || 1} of <strong>{generatedSOP.metadata.title}</strong> will be downloaded.
                <br />
                <br />
                Please make sure you are downloading the right version.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
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
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Controlled Tool Chat Dialog */}
      <Dialog open={isToolChatOpen} onOpenChange={setIsToolChatOpen}>
        <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>{getToolChatConfig("process-builder").title}</DialogTitle>
            <DialogDescription>
              {getToolChatConfig("process-builder").description ?? "Use chat to describe what you want to build."}
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 pb-4 h-[calc(90vh-140px)]">
            <ToolChat
              toolId="process-builder"
              mode="both"
              className="h-full"
              onApplyAction={async (action: any) => {
                try {
                  const formData = action?.formData || {};
                  const sop = action?.sop;

                  // Populate the form with extracted data
                  if (sopFormRef.current) {
                    sopFormRef.current.setFormData(formData);
                  }

                  // Store form data for later use when saving
                  draftFormDataRef.current = formData;

                  // If SOP was generated, set it as a draft (not saved yet)
                  if (sop?.sopHtml) {
                    const draftSOP: GeneratedSOP = {
                      sopHtml: sop.sopHtml,
                      sopId: null, // Will be set when saved
                      versionNumber: 1,
                      isCurrentVersion: false,
                      isDraft: true, // Mark as draft from chat
                      metadata: {
                        title: formData.sopTitle || sop.metadata?.title || "SOP",
                        generatedAt: new Date().toISOString(),
                        tokens: sop.metadata?.tokens || {
                          prompt: 0,
                          completion: 0,
                          total: 0,
                        },
                        organizationProfileUsed: (action?.kbDefaultsUsed?.length || 0) > 0,
                      },
                    };

                    setGeneratedSOP(draftSOP);

                    // Set flag to prevent loadLatestSOP from overwriting this draft
                    hasAttemptedLoadRef.current = true;

                    // Save to localStorage for auto-recovery
                    try {
                      localStorage.setItem('sop-draft', JSON.stringify({
                        sop: draftSOP,
                        formData: formData,
                      }));
                    } catch (e) {
                      console.warn("Failed to save draft to localStorage:", e);
                    }
                  }

                  setIsToolChatOpen(false);

                  if (sop?.sopHtml) {
                    toast.success("SOP generated and displayed on page", {
                      description: "Review the SOP below. You can continue chatting to make edits, or save it when ready.",
                    });
                  } else {
                    toast.success("Form populated", {
                      description: "The process details have been extracted and filled in. Review and click 'Generate SOP' when ready.",
                    });
                  }
                } catch (error) {
                  console.error("Error applying chat action:", error);
                  toast.error("Failed to apply process details", {
                    description: error instanceof Error ? error.message : "An error occurred",
                  });
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Refinement Dialog */}
      {generatedSOP && (
        <ToolChatDialog
          toolId="process-builder"
          mode="both"
          open={isRefinementModalOpen}
          onOpenChange={setIsRefinementModalOpen}
          buttonLabel=""
          initialContext={{
            existingSOP: {
              sopHtml: generatedSOP.sopHtml,
              sopMarkdown: htmlToMarkdown(generatedSOP.sopHtml),
              metadata: generatedSOP.metadata,
            },
            existingFormData: draftFormDataRef.current || {},
          }}
          showSOPBadge={true}
          sopBadgeData={{
            sop: {
              sopHtml: generatedSOP.sopHtml,
              metadata: generatedSOP.metadata,
            },
          }}
          onViewSOP={() => {
            setIsRefinementModalOpen(false);
            setTimeout(() => {
              const sopElement = document.getElementById('sop-display');
              if (sopElement) {
                sopElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }, 100);
          }}
          onApplyAction={async (action: any) => {
            try {
              // Support both refinedSOP and sop properties
              const refinedSOP = action?.refinedSOP || action?.sop;
              const formData = action?.formData || draftFormDataRef.current || {};

              if (refinedSOP) {
                // Create a new draft from the refined SOP (don't auto-save or increment version)
                // Preserve the original draft status - if base was draft, refined is draft
                // If base was published, refined becomes a new draft
                const refinedDraft: GeneratedSOP = {
                  sopHtml: refinedSOP.sopHtml || generatedSOP.sopHtml,
                  sopId: null, // Will be set when saved (don't auto-save)
                  versionNumber: undefined, // Drafts don't have version numbers
                  isCurrentVersion: false, // Drafts are not current versions
                  isDraft: true, // Always create as draft, regardless of base SOP status
                  metadata: refinedSOP.metadata || generatedSOP.metadata,
                };

                setGeneratedSOP(refinedDraft);

                // Store form data for saving later
                draftFormDataRef.current = formData;

                // Save to localStorage for auto-recovery
                try {
                  localStorage.setItem('sop-draft', JSON.stringify({
                    sop: refinedDraft,
                    formData: formData,
                  }));
                } catch (e) {
                  console.warn("Failed to save draft to localStorage:", e);
                }

                toast.success("SOP refined", {
                  description: "Review the refined SOP below. You can save it as a draft or publish it.",
                });

                setIsRefinementModalOpen(false);
              }
            } catch (error) {
              console.error("Error applying refinement:", error);
              toast.error("Failed to apply refinement");
            }
          }}
          parseAction={(raw: unknown) => {
            // Parse the action to extract refined SOP
            // Map refinedSOP to sop so ToolChat can display it using SOPDisplay
            if (typeof raw === 'object' && raw !== null) {
              const action = raw as any;
              if (action.refinedSOP) {
                return {
                  ...action,
                  sop: action.refinedSOP, // Map to sop for display
                  refinedSOP: action.refinedSOP, // Keep original for onApplyAction
                };
              }
            }
            return raw;
          }}
        />
      )}

      {/* Restore Draft Dialog */}
      <Dialog open={isRestoreDraftDialogOpen} onOpenChange={setIsRestoreDraftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Draft?</DialogTitle>
            <DialogDescription>
              You have an unsaved draft from a previous session. Would you like to restore it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // User chose not to restore, clear it
                if (pendingDraftData) {
                  try {
                    localStorage.removeItem('sop-draft');
                  } catch (e) {
                    console.warn("Failed to clear draft from localStorage:", e);
                  }
                }
                setPendingDraftData(null);
                setIsRestoreDraftDialogOpen(false);
              }}
            >
              Discard
            </Button>
            <Button
              onClick={() => {
                if (pendingDraftData) {
                  setGeneratedSOP(pendingDraftData.sop);
                  if (pendingDraftData.formData) {
                    draftFormDataRef.current = pendingDraftData.formData;
                    if (sopFormRef.current) {
                      sopFormRef.current.setFormData(pendingDraftData.formData);
                    }
                  }
                  hasAttemptedLoadRef.current = true; // Prevent loadLatestSOP from running
                  toast.info("Draft restored", {
                    description: "Your previous draft has been restored. You can continue editing or save it.",
                  });
                }
                setPendingDraftData(null);
                setIsRestoreDraftDialogOpen(false);
              }}
              className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}