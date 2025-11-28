"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import Modal from "@/components/ui/Modal";
import { Plus, Mail, ChevronDown, Trash2, Users, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Listbox } from "@headlessui/react";

interface Member {
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

interface OrganizationData {
    organization: {
        id: string;
        name: string;
        slug: string;
    };
    members: Member[];
    pendingInvites: PendingInvite[];
}

export default function TenantMembers() {
    const [organizations, setOrganizations] = useState<OrganizationData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrganization, setSelectedOrganization] = useState<OrganizationData | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
    const [isSendingInvitation, setIsSendingInvitation] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"members" | "invites">("members");

    const roleOptions = [
        { value: "ADMIN" as const, label: "Tenant Admin" },
        { value: "MEMBER" as const, label: "Member" },
    ];

    useEffect(() => {
        fetchMembers();
    }, []);


    useEffect(() => {
        if (organizations.length > 0 && !selectedOrganization) {
            setSelectedOrganization(organizations[0]);
        }
    }, [organizations, selectedOrganization]);

    const fetchMembers = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch("/api/members", {
                method: "GET",
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    setError(data.message || "You must be a tenant admin to view members.");
                } else {
                    setError(data.message || "Failed to load members. Please try again.");
                }
                setOrganizations([]);
                setSelectedOrganization(null);
                return;
            }

            if (data.success) {
                const newOrganizations = data.organizations || [];
                setOrganizations(newOrganizations);

                // Update selectedOrganization with fresh data
                if (selectedOrganization && newOrganizations.length > 0) {
                    const updatedOrg = newOrganizations.find(
                        (org: OrganizationData) => org.organization.id === selectedOrganization.organization.id
                    );
                    if (updatedOrg) {
                        setSelectedOrganization(updatedOrg);
                    } else if (newOrganizations.length > 0) {
                        // If current org not found, select first one
                        setSelectedOrganization(newOrganizations[0]);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching members:", error);
            setError("Failed to connect to the server. Please try again.");
            setOrganizations([]);
            setSelectedOrganization(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelInvite = async (inviteId: string) => {
        if (!selectedOrganization) return;

        setCancellingInviteId(inviteId);
        try {
            const response = await fetch(`/api/invite?id=${inviteId}`, {
                method: "DELETE",
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error cancelling invitation:", data.message);
                return;
            }

            // Refresh members to update pending invites
            await fetchMembers();
        } catch (error) {
            console.error("Error cancelling invitation:", error);
        } finally {
            setCancellingInviteId(null);
        }
    };

    const handleSendInvitation = async () => {
        if (!inviteEmail.trim() || !selectedOrganization) {
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
                    organizationId: selectedOrganization.organization.id,
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


            setInviteEmail("");
            setInviteRole("MEMBER");
            setInviteError(null);
            setIsInviteModalOpen(false);

            // Refresh members to update pending invites
            await fetchMembers();

            // Switch to pending invites tab to show the new invite
            setActiveTab("invites");
        } catch (error) {
            console.error("Error sending invitation:", error);
            setInviteError("Failed to connect to the server. Please try again.");
        } finally {
            setIsSendingInvitation(false);
        }
    };

    const inviteModalBody = (
        <div className="space-y-6">
            <div>
                <label
                    htmlFor="invite-email"
                    className="block text-sm font-medium mb-2 text-[#18416B] dark:text-[#FAC133]"
                >
                    Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <Mail
                        size={16}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
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
            </div>

            <div>
                <label
                    htmlFor="invite-role"
                    className="block text-sm font-medium mb-2 text-[#18416B] dark:text-[#FAC133]"
                >
                    Role <span className="text-red-500">*</span>
                </label>
                <Listbox value={inviteRole} onChange={setInviteRole}>
                    {({ open }) => (
                        <div className="relative">
                            <Listbox.Button
                                id="invite-role"
                                className="relative w-full pl-3 pr-8 py-2 text-left rounded-lg border text-sm transition-all duration-200 focus:outline-none cursor-pointer border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-white dark:bg-[#1a1a1a] text-[#1a1a1a] dark:text-[#e0e0e0]"
                            >
                                <span className="block truncate">
                                    {roleOptions.find((opt) => opt.value === inviteRole)?.label}
                                </span>
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <ChevronDown
                                        size={16}
                                        className={`transition-transform duration-200 text-gray-500 dark:text-gray-400 ${open ? "rotate-180" : ""}`}
                                    />
                                </span>
                            </Listbox.Button>
                            <Listbox.Options
                                className="absolute z-10 mt-1 w-full rounded-lg border shadow-md focus:outline-none overflow-hidden border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a]"
                            >
                                {roleOptions.map((option) => (
                                    <Listbox.Option
                                        key={option.value}
                                        value={option.value}
                                        className="relative cursor-pointer select-none text-sm transition-colors"
                                    >
                                        {({ active, selected }) => (
                                            <div
                                                className={`
                                                flex items-center justify-between
                                                py-2 px-3
                                                ${active ? "bg-gray-100 dark:bg-gray-800" : ""}
                                                text-[#1a1a1a] dark:text-[#e0e0e0]
                                            `}
                                            >
                                                <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                                    {option.label}
                                                </span>

                                                {selected && (
                                                    <span className="text-xs text-[var(--primary)] dark:text-[var(--accent)]">
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
            </div>

            {inviteError && (
                <div className="p-2 border rounded text-xs border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <p className="text-red-700 dark:text-red-300">{inviteError}</p>
                </div>
            )}
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
                                {selectedOrganization ? selectedOrganization.organization.name : "Tenant Members"}
                            </h1>
                            <p
                                className="text-sm text-[#1a1a1a] dark:text-[#e0e0e0]"
                            >
                                Manage members of your organization
                            </p>
                        </div>
                        {selectedOrganization && (
                            <button
                                onClick={() => setIsInviteModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95 bg-[var(--primary)] text-white dark:bg-[var(--accent)]"
                            >
                                <Plus size={18} />
                                <span>Invite Member</span>
                            </button>
                        )}
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="mb-6 p-4 rounded-lg border flex items-center gap-3 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                            <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Tabs */}
                    {selectedOrganization && !error && (
                        <div className="mb-4 flex gap-1">
                            <button
                                onClick={() => setActiveTab("members")}
                                className={`
                                    px-4 py-2 text-sm font-medium transition-all duration-200 relative
                                    ${activeTab === "members" ? "text-[#18416B] dark:text-[#FAC133]" : "text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100"}
                                    `}

                            >
                                Active Members
                                {activeTab === "members" && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FAC133]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab("invites")}
                                className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative ${activeTab === "invites" ? "text-[#18416B] dark:text-[#FAC133]" : "text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100"
                                    }`}
                            >
                                Pending Invites
                                {activeTab === "invites" && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FAC133]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    {!error && (
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

                                if (!selectedOrganization) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                            <div
                                                className="p-4 rounded-xl mb-4 bg-gray-100 dark:bg-gray-800"
                                            >
                                                <Users
                                                    size={40}
                                                    className="text-gray-500 dark:text-gray-400"
                                                />
                                            </div>
                                            <h3
                                                className="text-base font-medium mb-1 text-[#18416B] dark:text-[#FAC133]"
                                            >
                                                No organizations found
                                            </h3>
                                            <p
                                                className="text-sm mb-4 max-w-sm text-[#1a1a1a] dark:text-[#e0e0e0]"
                                            >
                                                You need to be a tenant admin to view and manage members.
                                            </p>
                                        </div>
                                    );
                                }

                                // Active Members Tab
                                if (activeTab === "members") {
                                    return (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-300 dark:border-gray-600">
                                                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                            Name
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                            Email
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                            Role
                                                        </th>
                                                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                            Joined
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedOrganization.members.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="py-12 text-center">
                                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                    No members yet
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        selectedOrganization.members.map((member) => (
                                                            <tr
                                                                key={member.id}
                                                                className="border-b hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-gray-300 dark:border-gray-600"
                                                            >
                                                                <td className="py-3 px-4">
                                                                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#e0e0e0]">
                                                                        {member.firstname} {member.lastname}
                                                                    </p>
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                        {member.email}
                                                                    </p>
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <span
                                                                        className={`
  px-2 py-1 text-xs font-medium rounded-full
  ${member.role === "ADMIN"
                                                                                ? "bg-amber-100 text-amber-500"
                                                                                : "bg-blue-200 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                                            }
`}
                                                                    >
                                                                        {member.role}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                        {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                }

                                // Pending Invites Tab
                                return (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-300 dark:border-gray-600">
                                                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                        Email
                                                    </th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                        Role
                                                    </th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                        Sent
                                                    </th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                        Expires
                                                    </th>
                                                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrganization.pendingInvites.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="py-12 text-center">
                                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                No pending invites
                                                            </p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    selectedOrganization.pendingInvites.map((invite) => (
                                                        <tr
                                                            key={invite.id}
                                                            className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                        >
                                                            <td className="py-3 px-4">
                                                                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#e0e0e0]">
                                                                    {invite.email}
                                                                </p>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span
                                                                    className={`px-2 py-1 text-xs font-medium rounded-full ${invite.role === "ADMIN"
                                                                        ? "bg-[#FAC133]/20 text-[#FAC133]"
                                                                        : "bg-blue-200 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                                        }`}
                                                                >
                                                                    {invite.role}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                    {new Date(invite.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </p>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                    {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </p>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleCancelInvite(invite.id)}
                                                                    disabled={cancellingInviteId === invite.id}
                                                                    className="p-1.5 rounded transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-[rgb(239, 68, 68)]"

                                                                    title="Cancel invitation"
                                                                >
                                                                    {cancellingInviteId === invite.id ? (
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
                                                                    ) : (
                                                                        <>
                                                                            <Trash2 size={14} />
                                                                            <span className="text-xs">Cancel</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Member Modal */}
            {selectedOrganization && (
                <Modal
                    isOpen={isInviteModalOpen}
                    onClose={() => {
                        if (!isSendingInvitation) {
                            setIsInviteModalOpen(false);
                            setInviteEmail("");
                            setInviteRole("MEMBER");
                            setInviteError(null);
                        }
                    }}
                    onConfirm={handleSendInvitation}
                    title={selectedOrganization.organization.name}
                    message="Invite a new member to your organization"
                    body={inviteModalBody}
                    confirmText={
                        isSendingInvitation ? (
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
                                Sending...
                            </span>
                        ) : (
                            "Send Invitation"
                        )
                    }
                    cancelText="Cancel"
                    confirmVariant="primary"
                    maxWidth="md"
                    isSubmitting={isSendingInvitation}
                />
            )}
        </>
    );
}
