"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import BaseIntakeForm from "@/components/forms/BaseIntakeForm";
import { businessBrainFormConfig } from "@/components/forms/configs/businessBrainFormConfig";
import { useUser } from "@/context/UserContext";
import {
  Brain,
  Plus,
  Calendar,
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  Search,
  Trash,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

type BusinessBrain = {
  id: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
  completionScore: number | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
  hasCards: boolean;
  cardsCount: number;
  conversationsCount: number;
};

type OrganizationStat = {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  count: number;
};

export default function BusinessBrainList() {
  const { user } = useUser();
  const router = useRouter();
  const [businessBrains, setBusinessBrains] = useState<BusinessBrain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [currentUserOrgIds, setCurrentUserOrgIds] = useState<string[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessBrain | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [organizationStats, setOrganizationStats] = useState<OrganizationStat[]>([]);

  const effectiveGlobalRole = user?.globalRole || currentUserRole;
  const isSuperadmin = effectiveGlobalRole === "SUPERADMIN";

  useEffect(() => {
    const loadBusinessBrains = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/business-brain/list");
        const result = await response.json();

        if (result.success) {
          setBusinessBrains(result.businessBrains || []);
          setCurrentUserOrgIds(result.currentUserOrganizationIds || []);
          if (result.currentUserGlobalRole) {
            setCurrentUserRole(result.currentUserGlobalRole);
          }
          if (result.organizationStats) {
            setOrganizationStats(result.organizationStats);
          }
          if (
            (user?.globalRole === "SUPERADMIN" ||
              result.currentUserGlobalRole === "SUPERADMIN") &&
            result.currentUserOrganizationIds?.length &&
            activeTab === "all"
          ) {
            setActiveTab(result.currentUserOrganizationIds[0]);
          }
        } else {
          const message = result.error || "Failed to load business brains";
          setError(message);
          toast.error(message);
        }
      } catch (error) {
        console.error("Error loading business brains:", error);
        setError("Failed to load business brains");
        toast.error("Failed to load business brains");
      } finally {
        setIsLoading(false);
      }
    };

    loadBusinessBrains();
  }, [user]);

  // Group brains by organization
  const brainsByOrganization = businessBrains.reduce((acc, brain) => {
    const orgId = brain.organization.id;
    if (!acc[orgId]) {
      acc[orgId] = {
        organization: brain.organization,
        brains: [],
      };
    }
    acc[orgId].brains.push(brain);
    return acc;
  }, {} as Record<string, { organization: BusinessBrain["organization"]; brains: BusinessBrain[] }>);

  // Get unique organizations
  const organizations = Object.values(brainsByOrganization).map((group) => group.organization);

  // Filter brains based on active tab and search query
  const getFilteredBrains = () => {
    let brainsToFilter: BusinessBrain[] = [];

    if (activeTab === "all") {
      brainsToFilter = businessBrains;
    } else {
      const orgGroup = brainsByOrganization[activeTab];
      brainsToFilter = orgGroup ? orgGroup.brains : [];
    }

    return brainsToFilter.filter(
      (brain) =>
        brain.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brain.organization.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredBrains = getFilteredBrains();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCompletionColor = (score: number | null) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getCompletionBg = (score: number | null) => {
    if (!score) return "bg-gray-100 dark:bg-gray-800";
    if (score >= 80) return "bg-green-100 dark:bg-green-900/20";
    if (score >= 60) return "bg-amber-100 dark:bg-amber-900/20";
    return "bg-red-100 dark:bg-red-900/20";
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    brain: BusinessBrain
  ) => {
    e.stopPropagation();
    setDeleteTarget(brain);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(
        `/api/business-brain/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete business brain");
      }

      setBusinessBrains((prev) =>
        prev.filter((brain) => brain.id !== deleteTarget.id)
      );
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      toast.success("Business brain deleted");
    } catch (err) {
      console.error("Error deleting business brain:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete business brain"
      );
      toast.error(
        err instanceof Error ? err.message : "Failed to delete business brain"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 p-4 border-b">
        <SidebarTrigger />
      </div>
      <div className="min-h-screen">
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">AI Business Brain</h1>
                <p className="text-sm text-muted-foreground">
                  Manage and access your business intelligence profiles
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                <div className="relative sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by business or organization..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="sm:self-start">
                  <Plus className="h-4 w-4" />
                  <span>Setup New Business Brain</span>
                </Button>
              </div>
            </div>
          </div>

          {isSuperadmin && (
            <Card className="border-dashed">
              <CardContent className="text-sm text-muted-foreground">
                Only members of an organization can access its business profiles and conversation history. Cross-organization access is restricted for privacy.
              </CardContent>
            </Card>
          )}

          {isSuperadmin && organizationStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Organization totals</CardTitle>
                <CardDescription>Business brains per org</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {organizationStats.map((stat) => (
                  <Badge key={stat.organization.id} variant="secondary" className="gap-2">
                    <span className="font-medium">{stat.organization.name}</span>
                    <span className="text-muted-foreground">
                      {stat.count} brain{stat.count === 1 ? "" : "s"}
                    </span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {isSuperadmin && organizations.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex overflow-x-auto">
                <TabsTrigger value="all">All ({businessBrains.length})</TabsTrigger>
                {organizations.map((org) => {
                  const count = brainsByOrganization[org.id]?.brains.length ?? 0;
                  const isUsersOrg = currentUserOrgIds.includes(org.id);
                  return (
                    <TabsTrigger key={org.id} value={org.id} className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="truncate">{org.name}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                      {isUsersOrg && <Badge variant="secondary" className="text-[10px] px-1.5">Yours</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          )}

          {isProcessing && (
            <Card>
              <CardContent className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  {statusMessage || "Processing your business brain..."}
                </p>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {error && !isLoading && (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="py-4">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && filteredBrains.length === 0 && (
            <Card className="text-center">
              <CardContent className="py-12 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    {searchQuery
                      ? "No results found"
                      : activeTab === "all"
                        ? "No Business Brains Yet"
                        : `No Business Brains in ${organizations.find((o) => o.id === activeTab)?.name || "this organization"}`}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : activeTab === "all"
                        ? "Create your first AI Business Brain to get started"
                        : "Create a new business brain for this organization"}
                  </p>
                </div>
                {!searchQuery && (
                  <Button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {activeTab === "all" ? "Create Your First Brain" : "Create New Brain"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && filteredBrains.length > 0 && (
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBrains.map((brain) => {
                  const isUsersOrg = currentUserOrgIds.includes(brain.organization.id);
                  const canNavigate = !isSuperadmin || isUsersOrg;
                  return (
                    <Card
                      key={brain.id}
                      className={`hover:shadow-sm transition ${canNavigate ? "cursor-pointer" : "cursor-not-allowed opacity-90"}`}
                      onClick={() => {
                        if (canNavigate) {
                          router.push(`/dashboard/ai-business-brain/${brain.id}`);
                        }
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base line-clamp-1">{brain.businessName}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <span className="truncate">{brain.organization.name}</span>
                            </CardDescription>
                          </div>
                          <div className="flex items-start gap-2">
                            {brain.createdBy.id === user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteClick(e, brain)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Delete business brain"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex-shrink-0 w-12 h-12 rounded-lg ${getCompletionBg(
                                    brain.completionScore
                                  )} flex items-center justify-center`}
                                >
                                  <span
                                    className={`text-sm font-bold ${getCompletionColor(
                                      brain.completionScore
                                    )}`}
                                  >
                                    {brain.completionScore ?? "—"}%
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="center">
                                Intake form completion percentage
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>
                            {brain.createdBy.firstname} {brain.createdBy.lastname}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Created {formatDate(brain.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {brain.hasCards && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>{brain.cardsCount} cards</span>
                              </div>
                            )}
                            {brain.conversationsCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Brain className="h-4 w-4" />
                                <span>{brain.conversationsCount} chats</span>
                              </div>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {user && (
        <Dialog open={isModalOpen} onOpenChange={(open) => !isProcessing && setIsModalOpen(open)}>
          <DialogContent className="w-[min(1200px,95vw)] sm:max-w-5xl max-h-[90vh] overflow-hidden p-0 sm:p-2">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle>Setup Business Brain</DialogTitle>
              <DialogDescription>
                Provide the details to create a new business brain profile.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 pb-4">
              <BaseIntakeForm
                userId={user.id}
                config={businessBrainFormConfig}
                onClose={() => {
                  if (!isProcessing) {
                    setIsModalOpen(false);
                  }
                }}
                onSuccess={async (data) => {
                  setIsModalOpen(false);
                  setIsProcessing(true);

                  if (data.apiResult?.businessBrainId) {
                    const businessBrainId = data.apiResult.businessBrainId;

                    try {
                      setStatusMessage("Creating your business intelligence cards...");
                      const cardsResponse = await fetch(
                        `/api/business-brain/generate-cards?profileId=${businessBrainId}`,
                        {
                          method: "POST",
                        }
                      );

                      if (!cardsResponse.ok) {
                        const errorData = await cardsResponse.json();
                        throw new Error(errorData.error || "Failed to generate cards");
                      }

                      const cardsResult = await cardsResponse.json();
                      if (!cardsResult.success) {
                        throw new Error("Failed to generate cards");
                      }

                      setStatusMessage("Synthesizing knowledge base...");
                      try {
                        const synthesizeResponse = await fetch(
                          `/api/business-brain/${businessBrainId}/synthesize-knowledge`,
                          {
                            method: "POST",
                          }
                        );

                        if (!synthesizeResponse.ok) {
                          const errorData = await synthesizeResponse.json();
                          console.warn(
                            "Failed to synthesize knowledge base:",
                            errorData.error
                          );
                        }
                      } catch (synthesizeError) {
                        console.warn(
                          "Error synthesizing knowledge base:",
                          synthesizeError
                        );
                      }

                      setStatusMessage("Calculating completion score...");
                      try {
                        const completionResponse = await fetch(
                          "/api/business-brain/calculate-completion",
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              businessBrainId,
                            }),
                          }
                        );

                        if (!completionResponse.ok) {
                          console.warn("Failed to calculate completion");
                        }
                      } catch (completionError) {
                        console.warn("Error calculating completion:", completionError);
                      }

                      setIsProcessing(false);
                      toast.success("Business brain created");
                      router.push(`/dashboard/ai-business-brain/${businessBrainId}`);
                    } catch (error) {
                      console.error("Error processing business brain:", error);
                      setIsProcessing(false);
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Failed to process business brain";
                      setError(message);
                      toast.error(message);
                    }
                  } else {
                    setIsProcessing(false);
                    const message = "Business brain ID not found in response";
                    setError(message);
                    toast.error(message);
                  }
                }}
                onProgress={(stage) => {
                  setStatusMessage(stage || "Uploading files...");
                }}
                onSubmit={async (formData, uploadedFileUrls) => {
                  setStatusMessage("Setting up your business brain...");

                  // Send JSON payload with S3 URLs instead of FormData with files
                  const payload = {
                    intake_json: JSON.stringify(formData),
                    file_urls: JSON.stringify(uploadedFileUrls),
                  };

                  const response = await fetch("/api/business-brain/setup", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                  });

                  if (!response.ok) {
                    let message =
                      "Unable to save your business profile. Please try again.";
                    let userFriendlyMessage = message;
                    try {
                      const errorPayload = await response.json();
                      if (errorPayload?.error) {
                        message = errorPayload.error;
                        if (
                          message.includes("must not be null") ||
                          message.includes("undefined")
                        ) {
                          userFriendlyMessage =
                            "There was an issue saving your profile. Please try again. If the problem persists, contact support.";
                        } else {
                          userFriendlyMessage = message;
                        }
                      }
                    } catch {
                      // Ignore JSON parse errors
                    }
                    const error = new Error(message);
                    (error as any).userFriendlyMessage = userFriendlyMessage;
                    throw error;
                  }

                  const result = await response.json();

                  if (!result.success) {
                    throw new Error(result.error || "Failed to setup business brain");
                  }

                  return {
                    businessBrainId: result.businessBrainId,
                    businessBrain: result.businessBrain,
                  };
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isDeleteModalOpen} onOpenChange={(open) => {
        if (!isDeleting) {
          setIsDeleteModalOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Business Brain?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You can only delete business brains you created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
