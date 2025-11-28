"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import Modal from "@/components/ui/Modal";
import { Plus, Building2, X, UserPlus, Mail, Link2, ChevronDown, Trash2, MoreVertical, PowerOff, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Listbox } from "@headlessui/react";

interface OrganizationFormData {
    name: string;
    slug: string;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
    deactivatedAt?: string | null;
}

interface Collaborator {
    id: string;
    userId: string;
    firstname: string;
    lastname: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    joinedAt: string;
}

interface PendingInvite {
    id: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    createdAt: string;
    expiresAt: string;
}

interface TenantDetails extends Tenant {
    collaborators: Collaborator[];
    pendingInvites: PendingInvite[];
}

export default function TenantsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<OrganizationFormData>({
        name: "",
        slug: "",
    });
    const [errors, setErrors] = useState<Partial<OrganizationFormData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<TenantDetails | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isLoadingTenantDetails, setIsLoadingTenantDetails] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
    const [isSendingInvitation, setIsSendingInvitation] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [tenantToDeactivate, setTenantToDeactivate] = useState<Tenant | null>(null);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [tenantToActivate, setTenantToActivate] = useState<Tenant | null>(null);
    const [showActivateModal, setShowActivateModal] = useState(false);
    const [activeTab, setActiveTab] = useState<"current" | "active" | "inactive">("current");
    const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
    const [currentTenantDetails, setCurrentTenantDetails] = useState<TenantDetails | null>(null);
    const [isLoadingCurrentTenant, setIsLoadingCurrentTenant] = useState(false);

    const roleOptions = [
        { value: "ADMIN" as const, label: "Tenant Admin" },
        { value: "MEMBER" as const, label: "Member" },
    ];

    // Fetch tenants on component mount
    useEffect(() => {
        fetchTenants();
    }, []);

    // Fetch current tenant details when we know the current tenant id
    useEffect(() => {
        if (currentTenantId) {
            fetchCurrentTenantDetails(currentTenantId);
        }
    }, [currentTenantId]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [openMenuId]);

    const fetchTenants = async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/tenant", {
                method: "GET",
                credentials: "include",
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setTenants(data.tenants || []);
                setCurrentTenantId(data.currentTenantId ?? null);
            }
        } catch (error) {
            console.error("Error fetching tenants:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTenantDetails = async (tenantId: string) => {
        try {
            setIsLoadingTenantDetails(true);
            const response = await fetch(`/api/tenant/${tenantId}`, {
                method: "GET",
                credentials: "include",
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSelectedTenant(data.tenant);
                setIsPanelOpen(true);
            }
        } catch (error) {
            console.error("Error fetching tenant details:", error);
        } finally {
            setIsLoadingTenantDetails(false);
        }
    };

    const fetchCurrentTenantDetails = async (tenantId: string) => {
        try {
            setIsLoadingCurrentTenant(true);
            const response = await fetch(`/api/tenant/${tenantId}`, {
                method: "GET",
                credentials: "include",
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setCurrentTenantDetails(data.tenant);
            }
        } catch (error) {
            console.error("Error fetching current tenant details:", error);
        } finally {
            setIsLoadingCurrentTenant(false);
        }
    };

    const handleTenantClick = (tenant: Tenant) => {
        console.log("Tenant clicked: ", tenant.id)
        fetchTenantDetails(tenant.id);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedTenant(null);
        setInviteEmail("");
        setInviteRole("MEMBER");
        setInviteError(null);
        setCancellingInviteId(null);
        setOpenMenuId(null);
    };

    const handleDeactivateTenant = async () => {
        if (!tenantToDeactivate) return;

        setIsDeactivating(true);
        try {
            const response = await fetch(`/api/tenant/${tenantToDeactivate.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: "deactivate" }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error deactivating tenant:", data.message);
                // TODO: Show error message to user
                return;
            }

            // Close modal and refresh tenants list
            setShowDeactivateModal(false);
            setTenantToDeactivate(null);
            await fetchTenants();
        } catch (error) {
            console.error("Error deactivating tenant:", error);
        } finally {
            setIsDeactivating(false);
        }
    };

    const handleActivateTenant = async () => {
        if (!tenantToActivate) return;

        setIsActivating(true);
        try {
            const response = await fetch(`/api/tenant/${tenantToActivate.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: "activate" }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error activating tenant:", data.message);
                // TODO: Show error message to user
                return;
            }

            // Close modal and refresh tenants list
            setShowActivateModal(false);
            setTenantToActivate(null);
            setOpenMenuId(null);
            await fetchTenants();
        } catch (error) {
            console.error("Error activating tenant:", error);
        } finally {
            setIsActivating(false);
        }
    };

    const handleCancelInvite = async (inviteId: string) => {
        if (!selectedTenant) return;

        setCancellingInviteId(inviteId);
        try {
            const response = await fetch(`/api/invite?id=${inviteId}`, {
                method: "DELETE",
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error cancelling invitation:", data.message);
                // TODO: Show error message to user
                return;
            }

            // Refresh tenant details to update the pending invites list
            await fetchTenantDetails(selectedTenant.id);
        } catch (error) {
            console.error("Error cancelling invitation:", error);
        } finally {
            setCancellingInviteId(null);
        }
    };

    const handleSendInvitation = async () => {
        if (!inviteEmail.trim() || !selectedTenant) {
            return;
        }

        setIsSendingInvitation(true);
        setInviteError(null);
        try {
            const response = await fetch("/api/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    organizationId: selectedTenant.id,
                    email: inviteEmail.trim(),
                    role: inviteRole,
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error sending invitation:", data.message);
                setInviteError(data.message || "Failed to send invitation. Please try again.");
                return;
            }

            // Reset form after successful send
            setInviteEmail("");
            setInviteRole("MEMBER");
            setInviteError(null);

            // Refresh tenant details to show the new pending invite
            await fetchTenantDetails(selectedTenant.id);
        } catch (error) {
            console.error("Error sending invitation:", error);
            setInviteError("Failed to connect to the server. Please try again.");
        } finally {
            setIsSendingInvitation(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Auto-generate slug from name
        if (name === "name") {
            const slug = value
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            setFormData((prev) => ({ ...prev, name: value, slug }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }

        // Clear error when user starts typing
        if (errors[name as keyof OrganizationFormData]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<OrganizationFormData> = {};

        if (!formData.name.trim()) {
            newErrors.name = "Organization name is required";
        }

        // Validate slug internally (auto-generated, so no user-facing error needed)
        if (!formData.slug.trim() || !/^[a-z0-9-]+$/.test(formData.slug)) {
            // If slug is invalid, it means the name couldn't generate a valid slug
            if (formData.name.trim()) {
                newErrors.name = "Organization name must contain at least one letter or number";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const response = await fetch("/api/tenant", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    slug: formData.slug.trim(),
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                setSubmitError(data.message || "Failed to create tenant. Please try again.");
                return;
            }

            // Success - reset form and close modal
            setFormData({ name: "", slug: "" });
            setErrors({});
            setSubmitError(null);
            setIsModalOpen(false);

            // Show success modal and refresh tenants list
            setShowSuccessModal(true);
            await fetchTenants();
        } catch (error) {
            console.error("Error creating tenant:", error);
            setSubmitError("Failed to connect to the server. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting) return; // Prevent closing during submission
        setFormData({ name: "", slug: "" });
        setErrors({});
        setSubmitError(null);
        setIsModalOpen(false);
    };

    const formBody = (
        <div className="space-y-4">
            <div>
                <label
                    htmlFor="name"
                    className="block text-sm font-medium mb-2"
                >
                    Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter organization name"
                    className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 focus:outline-none ${errors.name
                        ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                        : "border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10"
                        } bg-white dark:bg-[#1a1a1a] text-[#1a1a1a] dark:text-[#e0e0e0] placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                />
                {errors.name && (
                    <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                )}
                {submitError && (
                    <p className="mt-2 text-sm text-red-500">{submitError}</p>
                )}
                {/* <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    A URL-friendly slug will be automatically generated from the organization name
                </p> */}
            </div>
        </div>
    );

    return (
        <>
            <Navbar />
            <div
                className="transition-all duration-300 ease-in-out min-h-screen ml-64"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1
                                className="text-2xl font-semibold mb-1 text-[#18416B] dark:text-[#FAC133]"
                            >
                                Tenants
                            </h1>
                            <p
                                className="text-sm text-[#1a1a1a] dark:text-[#e0e0e0]"
                            >
                                Manage your organizations
                            </p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[#18416B] dark:bg-[var(--accent)] text-white"

                        >
                            <Plus size={18} />
                            <span>Add Tenant</span>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="mb-4 flex gap-1 border-b border-gray-300 dark:border-gray-600">
                        <button
                            onClick={() => setActiveTab("current")}
                            className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative ${activeTab === "current" ? "text-[#18416B] dark:text-[var(--accent)]" : "text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100"
                                }`}
                        >
                            Current Organization
                            {activeTab === "current" && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("active")}
                            className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative ${activeTab === "active" ? "text-[#18416B] dark:text-[#FAC133]" : "text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100"
                                }`}
                        >
                            Active
                            {activeTab === "active" && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("inactive")}
                            className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative ${activeTab === "inactive" ? "text-[#18416B] dark:text-[#FAC133]" : "text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100"
                                }`}
                        >
                            Inactive
                            {activeTab === "inactive" && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FAC133]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                    </div>

                    {/* Tenants List */}
                    <div
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a]"
                    >
                        {(() => {
                            if (isLoading) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <svg className="animate-spin h-8 w-8 mb-3 text-[#FAC133]" viewBox="0 0 24 24">
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
                                        <p className="text-sm text-[#1a1a1a] dark:text-[#e0e0e0]">Loading...</p>
                                    </div>
                                );
                            }

                            // Current Organization tab
                            if (activeTab === "current") {
                                if (!currentTenantId) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                            <div className="p-4 rounded-xl mb-4 bg-[var(--accent)]/20">
                                                <Building2
                                                    size={40}
                                                    className="text-[var(--accent)] dark:text-[var(--primary-light)]"
                                                />
                                            </div>
                                            <h3 className="text-base font-medium mb-1 text-[var(--primary)] dark:text-[var(--accent)]">
                                                No current organization detected
                                            </h3>
                                            <p className="text-sm mb-4 max-w-sm text-[var(--text-primary)] dark:text-[var(--text-muted)]">
                                                You are not currently associated with an organization.
                                            </p>
                                        </div>
                                    );
                                }

                                if (isLoadingCurrentTenant || !currentTenantDetails) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-16">
                                            <svg className="animate-spin h-8 w-8 mb-3 text-[#FAC133]" viewBox="0 0 24 24">
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
                                            <p className="text-sm text-[#1a1a1a] dark:text-[#e0e0e0]">Loading current organization...</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="p-4 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-semibold text-[var(--primary)] dark:text-zinc-100">
                                                    {currentTenantDetails.name}
                                                </h2>
                                                <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">
                                                    {currentTenantDetails.slug}
                                                </p>
                                            </div>
                                            <span className="px-3 py-1 rounded-full text-xs  uppercase tracking-wide bg-[var(--accent)] text-white">
                                                Your organization
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-medium mb-3 text-[var(--text-primary)]">
                                                Members
                                            </h3>
                                            {currentTenantDetails.collaborators.length === 0 ? (
                                                <div className="py-6 text-center rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                                                    <p
                                                        className="text-xs"
                                                        style={{ color: "var(--text-secondary)" }}
                                                    >
                                                        No members found in this organization.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-600">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 dark:bg-gray-900/30">
                                                            <tr>
                                                                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                                    Name
                                                                </th>
                                                                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                                    Email
                                                                </th>
                                                                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                                    Role
                                                                </th>
                                                                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                                    Joined
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {currentTenantDetails.collaborators.map((collaborator) => (
                                                                <tr
                                                                    key={collaborator.id}
                                                                    className="border-t border-gray-200 dark:border-gray-700"
                                                                >
                                                                    <td className="py-2.5 px-4">
                                                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                            {collaborator.firstname} {collaborator.lastname}
                                                                        </p>
                                                                    </td>
                                                                    <td className="py-2.5 px-4">
                                                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                            {collaborator.email}
                                                                        </p>
                                                                    </td>
                                                                    <td className="py-2.5 px-4">
                                                                        <span
                                                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${collaborator.role === "ADMIN"
                                                                                ? "bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent)]"
                                                                                : "bg-[var(--accent)]/10 text-[var(--accent)]"
                                                                                }`}
                                                                        >
                                                                            {collaborator.role}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-4">
                                                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                            {new Date(collaborator.joinedAt).toLocaleDateString("en-US", {
                                                                                month: "short",
                                                                                day: "numeric",
                                                                                year: "numeric",
                                                                            })}
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            const filteredTenants = tenants.filter((tenant: Tenant) =>
                                tenant.id !== currentTenantId && (activeTab === "active"
                                    ? !tenant.deactivatedAt
                                    : tenant.deactivatedAt !== null)
                            );


                            if (filteredTenants.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                        <div
                                            className="p-4 rounded-xl mb-4 bg-[var(--accent)]/20 dark:bg-[var(--primary-light)]/20"
                                        >
                                            <Building2
                                                size={40}
                                                className="text-[var(--accent)] dark:text-[var(--primary-light)]"

                                            />
                                        </div>
                                        <h3
                                            className="text-base font-medium mb-1 text-[var(--primary)] dark:text-zinc-500"
                                        >
                                            {activeTab === "active" ? "No active tenants" : "No inactive tenants"}
                                        </h3>
                                        <p
                                            className="text-sm mb-4 max-w-sm text-[var(--text-primary)] dark:text-[var(--text-muted)]"
                                        >
                                            {activeTab === "active"
                                                ? "Create your first organization tenant to get started."
                                                : "No deactivated tenants yet."}
                                        </p>
                                        {activeTab === "active" && (
                                            <button
                                                onClick={() => setIsModalOpen(true)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[#FAC133] text-[#18416B] dark:text-[#1a1a1a]"
                                            >
                                                <Plus size={16} />
                                                <span>Add Tenant</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredTenants.map((tenant: Tenant) => {
                                            const isCurrentTenant = tenant.id === currentTenantId;

                                            return (
                                                <div
                                                    key={tenant.id}
                                                    onClick={() => !tenant.deactivatedAt && handleTenantClick(tenant)}
                                                    className={`p-4 rounded-lg border transition-all duration-150 group ${isCurrentTenant
                                                        ? "border-[#FAC133] ring-1 ring-[#FAC133] bg-[#FFFAE6] dark:bg-[#1f2937]"
                                                        : "border-gray-300 dark:border-gray-600"
                                                        } ${tenant.deactivatedAt
                                                            ? "opacity-60"
                                                            : "hover:shadow-md cursor-pointer"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                            <div className="p-2 rounded-lg flex-shrink-0 bg-[var(--accent)]/10 dark:bg-[var(--primary-light)]/10">
                                                                <Building2
                                                                    size={18}
                                                                    className="text-[var(--accent)] dark:text-[var(--primary-light)]"
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h3
                                                                        className="font-semibold text-md truncate text-semibold text-[var(--primary)] dark:text-zinc-100"
                                                                        title={tenant.name}
                                                                    >
                                                                        {tenant.name}
                                                                    </h3>
                                                                    {isCurrentTenant && (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#FAC133] text-[#18416B]">
                                                                            Your organization
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p
                                                                    className="text-xs font-mono truncate mt-0.5 text-[#18416B] dark:text-[var(--accent)]"
                                                                    title={tenant.slug}
                                                                >
                                                                    {tenant.slug}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {/* Actions menu (hidden for the current user's organization) */}
                                                        {!isCurrentTenant && (
                                                            <div className="relative flex-shrink-0">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMenuId(openMenuId === tenant.id ? null : tenant.id);
                                                                    }}
                                                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
                                                                >
                                                                    <MoreVertical size={16} />
                                                                </button>
                                                                {openMenuId === tenant.id && (
                                                                    <>
                                                                        <div
                                                                            className="fixed inset-0 z-10"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setOpenMenuId(null);
                                                                            }}
                                                                        />
                                                                        <div
                                                                            className="absolute right-0 mt-1 z-20 rounded-lg border shadow-lg overflow-hidden border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a] min-w-[140px]"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {!tenant.deactivatedAt ? (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setTenantToDeactivate(tenant);
                                                                                        setShowDeactivateModal(true);
                                                                                        setOpenMenuId(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-red-500/10 flex items-center gap-2"
                                                                                    style={{ color: "rgb(239, 68, 68)" }}
                                                                                >
                                                                                    <PowerOff size={14} />
                                                                                    <span>Deactivate</span>
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setTenantToActivate(tenant);
                                                                                        setShowActivateModal(true);
                                                                                        setOpenMenuId(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-green-500/10 flex items-center gap-2"
                                                                                    style={{ color: "rgb(34, 197, 94)" }}
                                                                                >
                                                                                    <CheckCircle2 size={14} />
                                                                                    <span>Activate</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                                        <span>
                                                            {new Date(tenant.createdAt).toLocaleDateString("en-US", {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            })}
                                                        </span>
                                                        {tenant.deactivatedAt && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Add Tenant Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleClose}
                onConfirm={handleSubmit}
                title="Add New Tenant"
                message="Create a new organization tenant by filling in the details below."
                body={formBody}
                confirmText={
                    isSubmitting ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                            Creating...
                        </span>
                    ) : (
                        "Create Tenant"
                    )
                }
                cancelText="Cancel"
                confirmVariant="primary"
                maxWidth="lg"
                isSubmitting={isSubmitting}
            />

            {/* Success Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                onConfirm={() => setShowSuccessModal(false)}
                title="Success!"
                message="Tenant has been created successfully."
                confirmText="OK"
                cancelText=""
                confirmVariant="primary"
                maxWidth="sm"
            />

            {/* Deactivate Tenant Confirmation Modal */}
            <Modal
                isOpen={showDeactivateModal}
                onClose={() => {
                    if (!isDeactivating) {
                        setShowDeactivateModal(false);
                        setTenantToDeactivate(null);
                    }
                }}
                onConfirm={handleDeactivateTenant}
                title="Deactivate Tenant"
                message={
                    tenantToDeactivate
                        ? `Are you sure you want to deactivate "${tenantToDeactivate.name}"? This will prevent all users in this organization from accessing the system. This action can be reversed later.`
                        : ""
                }
                confirmText={
                    isDeactivating ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                            Deactivating...
                        </span>
                    ) : (
                        "Deactivate"
                    )
                }
                cancelText="Cancel"
                confirmVariant="danger"
                maxWidth="md"
                isSubmitting={isDeactivating}
            />

            {/* Activate Tenant Confirmation Modal */}
            <Modal
                isOpen={showActivateModal}
                onClose={() => {
                    if (!isActivating) {
                        setShowActivateModal(false);
                        setTenantToActivate(null);
                    }
                }}
                onConfirm={handleActivateTenant}
                title="Activate Tenant"
                message={
                    tenantToActivate
                        ? `Are you sure you want to activate "${tenantToActivate.name}"? This will restore access for all users in this organization.`
                        : ""
                }
                confirmText={
                    isActivating ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                            Activating...
                        </span>
                    ) : (
                        "Activate"
                    )
                }
                cancelText="Cancel"
                confirmVariant="primary"
                maxWidth="md"
                isSubmitting={isActivating}
            />

            {/* Side Panel */}
            <AnimatePresence>
                {isPanelOpen && selectedTenant && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                            onClick={handleClosePanel}
                        />

                        {/* Side Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed right-0 top-0 h-screen w-full max-w-md z-50 shadow-2xl"
                            style={{
                                backgroundColor: "var(--card-bg)",
                                borderLeft: "1px solid var(--border-color)",
                            }}
                        >
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div
                                    className="flex items-center justify-between p-4 border-b sticky top-0 z-10"
                                    style={{
                                        borderColor: "var(--border-color)",
                                        backgroundColor: "var(--card-bg)",
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="p-1.5 rounded-lg bg-[var(--accent)]/10 dark:bg-[var(--primary-light)]/10"

                                        >
                                            <Building2 size={20} className="text-amber-500 dark:text-[var(--primary-light)]" />
                                        </div>
                                        <h2
                                            className="text-lg font-semibold text-[var(--primary)] dark:text-zinc-100"
                                        >
                                            Tenant Details
                                        </h2>
                                    </div>
                                    <button
                                        onClick={handleClosePanel}
                                        className="p-1.5 rounded hover:bg-[var(--hover-bg)] transition-colors"
                                        aria-label="Close panel"
                                    >
                                        <X size={18} style={{ color: "var(--text-secondary)" }} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {isLoadingTenantDetails ? (
                                        <div className="flex items-center justify-center py-12">
                                            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" style={{ color: "var(--text-secondary)" }}>
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
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Tenant Name and Created At */}
                                            <div className="pb-4 border-b" style={{ borderColor: "var(--border-color)" }}>
                                                <h3
                                                    className="text-lg font-semibold mb-1 text-[var(--primary)] dark:text-zinc-100"

                                                >
                                                    {selectedTenant.name}
                                                </h3>
                                                <p
                                                    className="text-xs"
                                                    style={{ color: "var(--text-secondary)" }}
                                                >
                                                    Created {new Date(selectedTenant.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>

                                            {/* Send Invitation Section */}
                                            <div>
                                                <h4
                                                    className="text-sm font-medium mb-3"
                                                    style={{ color: "var(--text-primary)" }}
                                                >
                                                    Invite a collaborator
                                                </h4>
                                                <div className="space-y-3">
                                                    <div className="relative">
                                                        <Mail
                                                            size={16}
                                                            className="absolute left-3 top-1/2 transform -translate-y-1/2"
                                                            style={{ color: "var(--text-secondary)" }}
                                                        />
                                                        <input
                                                            type="email"
                                                            id="invite-email"
                                                            value={inviteEmail}
                                                            onChange={(e) => setInviteEmail(e.target.value)}
                                                            placeholder="Enter email address"
                                                            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-all duration-200 focus:outline-none border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-white dark:bg-[#1a1a1a] text-[#1a1a1a] dark:text-[#e0e0e0] placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                                        />
                                                    </div>

                                                    {/* Role Select Dropdown */}
                                                    <Listbox value={inviteRole} onChange={setInviteRole}>
                                                        {({ open }) => (
                                                            <div className="relative">
                                                                <Listbox.Button
                                                                    className="relative w-full pl-3 pr-8 py-2 text-left rounded-lg border text-sm transition-all duration-200 focus:outline-none cursor-pointer border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-white dark:bg-[#1a1a1a] text-[#1a1a1a] dark:text-[#e0e0e0]"
                                                                >
                                                                    <span className="block truncate">
                                                                        {roleOptions.find((opt) => opt.value === inviteRole)?.label}
                                                                    </span>
                                                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                                                        <ChevronDown
                                                                            size={16}
                                                                            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                                                                            style={{ color: "var(--text-secondary)" }}
                                                                        />
                                                                    </span>
                                                                </Listbox.Button>
                                                                <Listbox.Options
                                                                    className="absolute z-10 mt-1 w-full rounded-lg border shadow-md focus:outline-none overflow-hidden"
                                                                    style={{
                                                                        borderColor: "var(--border-color)",
                                                                        backgroundColor: "var(--card-bg)",
                                                                    }}
                                                                >
                                                                    {roleOptions.map((option) => (
                                                                        <Listbox.Option
                                                                            key={option.value}
                                                                            value={option.value}
                                                                            className={({ active }) =>
                                                                                `relative cursor-pointer select-none text-sm transition-colors`
                                                                            }
                                                                        >
                                                                            {({ active, selected }: { active: boolean; selected: boolean }) => (
                                                                                <div
                                                                                    className="flex items-center justify-between"
                                                                                    style={{
                                                                                        backgroundColor: active ? "var(--hover-bg)" : "transparent",
                                                                                        color: "var(--text-primary)",
                                                                                        padding: active ? "0.75rem 0.75rem" : "0.5rem 0.75rem",
                                                                                    }}
                                                                                >
                                                                                    <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                                                                        {option.label}
                                                                                    </span>
                                                                                    {selected && (
                                                                                        <span className="text-xs text-[var(--primary)] dark:text-[var(--accent)]" >
                                                                                            ✓
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </Listbox.Option>
                                                                    ))}
                                                                </Listbox.Options>
                                                            </div>
                                                        )}
                                                    </Listbox>

                                                    {inviteError && (
                                                        <div className="p-2 border rounded text-xs" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
                                                            <p style={{ color: "rgb(220, 38, 38)" }}>{inviteError}</p>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={handleSendInvitation}
                                                        disabled={!inviteEmail.trim() || isSendingInvitation}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)]"

                                                    >
                                                        {isSendingInvitation ? (
                                                            <>
                                                                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
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
                                                                <span>Sending...</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-white">Send Invitation</span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="border-t my-4" style={{ borderColor: "var(--border-color)" }} />

                                            {/* Pending Invites Section */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Mail size={16} className="dark:text-[var(--accent)] text-[var(--primary)]" />
                                                    <h4
                                                        className="text-sm font-medium text-[var(--text-primary)]"
                                                    >
                                                        Pending Invites
                                                    </h4>
                                                    {selectedTenant.pendingInvites && selectedTenant.pendingInvites.length > 0 && (
                                                        <span
                                                            className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--accent)] text-white "

                                                        >
                                                            {selectedTenant.pendingInvites.length}
                                                        </span>
                                                    )}
                                                </div>

                                                {!selectedTenant.pendingInvites || selectedTenant.pendingInvites.length === 0 ? (
                                                    <div className="py-6 text-center rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                                                        <p
                                                            className="text-xs"
                                                            style={{ color: "var(--text-secondary)" }}
                                                        >
                                                            No pending invites
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {selectedTenant.pendingInvites.map((invite) => (
                                                            <div
                                                                key={invite.id}
                                                                className="p-3 rounded-lg border transition-all duration-150 hover:shadow-sm"
                                                                style={{
                                                                    borderColor: "var(--border-color)",
                                                                    backgroundColor: "var(--hover-bg)",
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p
                                                                            className="font-medium text-xs mb-0.5 truncate"
                                                                            style={{ color: "var(--text-primary)" }}
                                                                            title={invite.email}
                                                                        >
                                                                            {invite.email}
                                                                        </p>
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <p
                                                                                className="text-xs"
                                                                                style={{ color: "var(--text-secondary)" }}
                                                                            >
                                                                                {new Date(invite.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                            </p>
                                                                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>•</span>
                                                                            <p
                                                                                className="text-xs"
                                                                                style={{ color: "var(--text-secondary)" }}
                                                                            >
                                                                                Expires {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                        <span
                                                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${invite.role === "ADMIN"
                                                                                ? "bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent)]"
                                                                                : "bg-blue-200 text-blue-600"
                                                                                }`}

                                                                        >
                                                                            {invite.role}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => handleCancelInvite(invite.id)}
                                                                            disabled={cancellingInviteId === invite.id}
                                                                            className="p-1 rounded transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            style={{ color: "rgb(239, 68, 68)" }}
                                                                            title="Cancel invitation"
                                                                        >
                                                                            {cancellingInviteId === invite.id ? (
                                                                                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
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
                                                                            ) : (
                                                                                <Trash2 size={14} />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Divider */}
                                            <div className="border-t my-4" style={{ borderColor: "var(--border-color)" }} />

                                            {/* Collaborators Section */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <UserPlus size={16} className="dark:text-[var(--accent)] text-[var(--primary)]" />
                                                    <h4
                                                        className="text-sm font-medium text-[var(--text-primary)]"
                                                    >
                                                        Collaborators
                                                    </h4>
                                                    {selectedTenant.collaborators && selectedTenant.collaborators.length > 0 && (
                                                        <span
                                                            className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--accent)] text-white "

                                                        >
                                                            {selectedTenant.collaborators.length}
                                                        </span>
                                                    )}
                                                </div>

                                                {selectedTenant.collaborators.length === 0 ? (
                                                    <div className="py-6 text-center rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                                                        <p
                                                            className="text-xs"
                                                            style={{ color: "var(--text-secondary)" }}
                                                        >
                                                            No collaborators yet
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {selectedTenant.collaborators.map((collaborator) => (
                                                            <div
                                                                key={collaborator.id}
                                                                className="p-3 rounded-lg border transition-all duration-150 hover:shadow-sm"
                                                                style={{
                                                                    borderColor: "var(--border-color)",
                                                                    backgroundColor: "var(--hover-bg)",
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p
                                                                            className="font-medium text-xs mb-0.5"
                                                                            style={{ color: "var(--text-primary)" }}
                                                                        >
                                                                            {collaborator.firstname} {collaborator.lastname}
                                                                        </p>
                                                                        <p
                                                                            className="text-xs truncate"
                                                                            style={{ color: "var(--text-secondary)" }}
                                                                            title={collaborator.email}
                                                                        >
                                                                            {collaborator.email}
                                                                        </p>
                                                                        <p
                                                                            className="text-xs mt-0.5"
                                                                            style={{ color: "var(--text-secondary)" }}
                                                                        >
                                                                            Joined {new Date(collaborator.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                                                        </p>
                                                                    </div>
                                                                    <span
                                                                        className={`
  px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0
  ${collaborator.role === "ADMIN"
                                                                                ? "bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent)]"
                                                                                : "bg-[var(--accent)]/10 text-[var(--accent)] "
                                                                            }
`}

                                                                    >
                                                                        {collaborator.role}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

