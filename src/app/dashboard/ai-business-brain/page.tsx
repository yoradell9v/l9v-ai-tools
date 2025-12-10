"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Modal from "@/components/ui/Modal";
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
  Rocket,
  Trash,
} from "lucide-react";

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
          setError(result.error || "Failed to load business brains");
        }
      } catch (error) {
        console.error("Error loading business brains:", error);
        setError("Failed to load business brains");
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
    } catch (err) {
      console.error("Error deleting business brain:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete business brain"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="transition-all duration-300 ease-in-out min-h-screen ml-[var(--sidebar-width,16rem)] bg-[var(--bg-color)]">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1 text-[var(--text-primary)]">
                AI Business Brain
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Manage and access your business intelligence profiles
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)] text-white"
            >
              <Plus size={18} />
              <span>Setup New Business Brain</span>
            </button>
          </div>

          {isSuperadmin && (
            <div className="mb-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              Only members of an organization can access its business profiles and conversation history. Cross-organization access is restricted for privacy.
            </div>
          )}

          {/* Tenant counts for superadmins */}
          {isSuperadmin && organizationStats.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {organizationStats.map((stat) => (
                <div
                  key={stat.organization.id}
                  className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] flex items-center gap-2"
                >
                  <span className="font-semibold">{stat.organization.name}</span>
                  <span className="text-[var(--text-secondary)]">
                    {stat.count} business brain{stat.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          {isSuperadmin && organizations.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] overflow-x-auto">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "all"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  All ({businessBrains.length})
                </button>
                {organizations.map((org) => {
                  const orgGroup = brainsByOrganization[org.id];
                  const count = orgGroup ? orgGroup.brains.length : 0;
                  const isUsersOrg = currentUserOrgIds.includes(org.id);
                  return (
                    <button
                      key={org.id}
                      onClick={() => setActiveTab(org.id)}
                      className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 rounded-t ${activeTab === org.id
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        } ${isUsersOrg ? "bg-[var(--primary)]/10 dark:bg-[var(--accent)]/10" : ""}`}
                    >
                      <Building2 size={14} />
                      <span>{org.name}</span>
                      <span className="text-xs opacity-70">({count})</span>
                      {isUsersOrg && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary)] text-white dark:bg-[var(--accent)]">
                          Yours
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]"
              />
              <input
                type="text"
                placeholder="Search by business name or organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
              />
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="mb-6 p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="animate-spin h-5 w-5 text-[var(--primary)]"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {statusMessage || "Processing your business brain..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-8 w-8 mb-3 text-[var(--accent)]"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredBrains.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-4">
                <Brain size={48} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {searchQuery
                  ? "No results found"
                  : activeTab === "all"
                    ? "No Business Brains Yet"
                    : `No Business Brains in ${organizations.find((o) => o.id === activeTab)?.name || "this organization"}`}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm text-center">
                {searchQuery
                  ? "Try adjusting your search query"
                  : activeTab === "all"
                    ? "Create your first AI Business Brain to get started"
                    : "Create a new business brain for this organization"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)] text-white"
                >
                  <Plus size={16} />
                  <span>
                    {activeTab === "all"
                      ? "Create Your First Brain"
                      : "Create New Brain"}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Business Brains Grid */}
          {!isLoading && !error && filteredBrains.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBrains.map((brain) => {
                const isUsersOrg = currentUserOrgIds.includes(brain.organization.id);
                const canNavigate = !isSuperadmin || isUsersOrg;
                return (
                  <div
                    key={brain.id}
                    onClick={() => {
                      if (canNavigate) {
                        router.push(`/dashboard/ai-business-brain/${brain.id}`);
                      }
                    }}
                    className={`p-6 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:border-[var(--primary)]/50 dark:hover:border-[var(--accent)]/50 transition-all duration-200 hover:shadow-lg ${canNavigate ? "cursor-pointer" : "cursor-not-allowed opacity-90"}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1 truncate">
                          {brain.businessName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <Building2 size={14} />
                          <span className="truncate">{brain.organization.name}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        {brain.createdBy.id === user?.id && (
                          <button
                            onClick={(e) => handleDeleteClick(e, brain)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                            aria-label="Delete business brain"
                          >
                            <Trash size={16} />
                          </button>
                        )}
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
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <User size={14} />
                        <span>
                          {brain.createdBy.firstname} {brain.createdBy.lastname}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Calendar size={14} />
                        <span>Created {formatDate(brain.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                        {brain.hasCards && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 size={14} className="text-green-500" />
                            <span>{brain.cardsCount} cards</span>
                          </div>
                        )}
                        {brain.conversationsCount > 0 && (
                          <div className="flex items-center gap-1">
                            <Brain size={14} />
                            <span>{brain.conversationsCount} chats</span>
                          </div>
                        )}
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-[var(--text-secondary)]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Setup Modal */}
      {user && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            if (!isProcessing) {
              setIsModalOpen(false);
            }
          }}
          onConfirm={() => { }}
          title=""
          message=""
          body={
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
                    router.push(`/dashboard/ai-business-brain/${businessBrainId}`);
                  } catch (error) {
                    console.error("Error processing business brain:", error);
                    setIsProcessing(false);
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Failed to process business brain"
                    );
                  }
                } else {
                  setIsProcessing(false);
                  setError("Business brain ID not found in response");
                }
              }}
              onProgress={(stage) => {
                setStatusMessage(stage || "Uploading files...");
              }}
              onSubmit={async (formData, files) => {
                setStatusMessage("Uploading files and setting up your business brain...");

                const payload = new FormData();
                payload.append("intake_json", JSON.stringify(formData));
                Object.entries(files).forEach(([key, fileArray]) => {
                  if (fileArray && Array.isArray(fileArray)) {
                    fileArray.forEach((file) => {
                      payload.append(key, file);
                    });
                  }
                });

                const response = await fetch("/api/business-brain/setup", {
                  method: "POST",
                  body: payload,
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
          }
          confirmText=""
          cancelText=""
          maxWidth="4xl"
        />
      )}

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete this Business Brain?"
        message="This action cannot be undone. You can only delete business brains you created."
        body={
          deleteError ? (
            <div className="text-sm text-red-500">{deleteError}</div>
          ) : null
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        isSubmitting={isDeleting}
        maxWidth="sm"
      />
    </>
  );
}
