"use client";

import { useState, useEffect } from "react";
import { Plus, Building2, X, UserPlus, Mail, Trash2, MoreVertical, PowerOff, CheckCircle2 } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

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
    deactivatedAt?: string | null;
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
    const { user } = useUser();
    const isSuperAdmin = user?.globalRole === "SUPERADMIN";
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
    const [collaboratorMenuOpenId, setCollaboratorMenuOpenId] = useState<string | null>(null);
    const [collaboratorToDeactivate, setCollaboratorToDeactivate] = useState<Collaborator | null>(null);
    const [showDeactivateCollaboratorModal, setShowDeactivateCollaboratorModal] = useState(false);
    const [isDeactivatingCollaborator, setIsDeactivatingCollaborator] = useState(false);
    const [collaboratorToActivate, setCollaboratorToActivate] = useState<Collaborator | null>(null);
    const [showActivateCollaboratorModal, setShowActivateCollaboratorModal] = useState(false);
    const [isActivatingCollaborator, setIsActivatingCollaborator] = useState(false);

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
            if (collaboratorMenuOpenId) {
                setCollaboratorMenuOpenId(null);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [openMenuId, collaboratorMenuOpenId]);

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

    const handleClosePanel = (open: boolean) => {
        setIsPanelOpen(open);
        if (!open) {
            setSelectedTenant(null);
            setInviteEmail("");
            setInviteRole("MEMBER");
            setInviteError(null);
            setCancellingInviteId(null);
            setOpenMenuId(null);
            setCollaboratorMenuOpenId(null);
        }
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
                toast.error("Failed to deactivate organization", {
                    description: data.message || "An error occurred while deactivating the organization.",
                });
                return;
            }

            // Close modal and refresh tenants list
            setShowDeactivateModal(false);
            setTenantToDeactivate(null);
            toast.success("Organization deactivated", {
                description: `${tenantToDeactivate.name} has been deactivated successfully.`,
            });
            await fetchTenants();
        } catch (error) {
            console.error("Error deactivating tenant:", error);
        } finally {
            setIsDeactivating(false);
        }
    };

    const handleDeactivateCollaborator = async () => {
        if (!collaboratorToDeactivate || !selectedTenant) return;

        setIsDeactivatingCollaborator(true);
        try {
            const response = await fetch("/api/members", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    memberId: collaboratorToDeactivate.id,
                    action: "deactivate",
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error deactivating collaborator:", data.message);
                toast.error("Failed to deactivate member", {
                    description: data.message || "An error occurred while deactivating the member.",
                });
                return;
            }

            setShowDeactivateCollaboratorModal(false);
            setCollaboratorToDeactivate(null);
            setCollaboratorMenuOpenId(null);
            toast.success("Member deactivated", {
                description: `${collaboratorToDeactivate.firstname} ${collaboratorToDeactivate.lastname} has been deactivated successfully.`,
            });
            await fetchTenantDetails(selectedTenant.id);
        } catch (error) {
            console.error("Error deactivating collaborator:", error);
        } finally {
            setIsDeactivatingCollaborator(false);
        }
    };

    const handleActivateCollaborator = async () => {
        if (!collaboratorToActivate || !selectedTenant) return;

        setIsActivatingCollaborator(true);
        try {
            const response = await fetch("/api/members", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    memberId: collaboratorToActivate.id,
                    action: "activate",
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error activating collaborator:", data.message);
                toast.error("Failed to activate member", {
                    description: data.message || "An error occurred while activating the member.",
                });
                return;
            }

            setShowActivateCollaboratorModal(false);
            setCollaboratorToActivate(null);
            setCollaboratorMenuOpenId(null);
            toast.success("Member activated", {
                description: `${collaboratorToActivate.firstname} ${collaboratorToActivate.lastname} has been activated successfully.`,
            });
            await fetchTenantDetails(selectedTenant.id);
        } catch (error) {
            console.error("Error activating collaborator:", error);
        } finally {
            setIsActivatingCollaborator(false);
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
                toast.error("Failed to activate organization", {
                    description: data.message || "An error occurred while activating the organization.",
                });
                return;
            }

            // Close modal and refresh tenants list
            setShowActivateModal(false);
            setTenantToActivate(null);
            setOpenMenuId(null);
            toast.success("Organization activated", {
                description: `${tenantToActivate.name} has been activated successfully.`,
            });
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
                toast.error("Failed to cancel invitation", {
                    description: data.message || "An error occurred while cancelling the invitation.",
                });
                return;
            }

            // Refresh tenant details to update the pending invites list
            toast.success("Invitation cancelled", {
                description: "The invitation has been cancelled successfully.",
            });
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
                toast.error("Failed to send invitation", {
                    description: data.message || "An error occurred while sending the invitation.",
                });
                return;
            }

            // Reset form after successful send
            setInviteEmail("");
            setInviteRole("MEMBER");
            setInviteError(null);

            toast.success("Invitation sent", {
                description: `An invitation has been sent to ${inviteEmail.trim()}.`,
            });

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
                toast.error("Failed to create organization", {
                    description: data.message || "An error occurred while creating the organization.",
                });
                return;
            }

            // Success - reset form and close modal
            setFormData({ name: "", slug: "" });
            setErrors({});
            setSubmitError(null);
            setIsModalOpen(false);

            toast.success("Organization created", {
                description: `${formData.name.trim()} has been created successfully.`,
            });

            // Refresh tenants list
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


    return (
        <>
            <Toaster />
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Tenants</h2>
                        <p className="text-muted-foreground">Manage your organizations</p>
                    </div>
                    <SidebarTrigger />
                </div>
                <div className="flex items-center justify-between">
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Tenant
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="current">Current Organization</TabsTrigger>
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="inactive">Inactive</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="space-y-4">
                        <Card>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                ) : (() => {

                                    // Current Organization tab
                                    if (activeTab === "current") {
                                        if (!currentTenantId) {
                                            return (
                                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                                    <div className="p-4 rounded-xl mb-4 bg-muted">
                                                        <Building2 className="h-10 w-10 text-muted-foreground" />
                                                    </div>
                                                    <h3 className="text-lg font-semibold mb-1">No current organization detected</h3>
                                                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                                                        You are not currently associated with an organization.
                                                    </p>
                                                </div>
                                            );
                                        }

                                        if (isLoadingCurrentTenant || !currentTenantDetails) {
                                            return (
                                                <div className="space-y-4">
                                                    <Skeleton className="h-8 w-48" />
                                                    <Skeleton className="h-64 w-full" />
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h2 className="text-lg font-semibold">{currentTenantDetails.name}</h2>
                                                        <p className="text-xs text-muted-foreground font-mono mt-1">
                                                            {currentTenantDetails.slug}
                                                        </p>
                                                    </div>
                                                    <Badge>Your organization</Badge>
                                                </div>

                                                <div>
                                                    <h3 className="text-sm font-medium mb-3">Members</h3>
                                                    {currentTenantDetails.collaborators.length === 0 ? (
                                                        <div className="py-6 text-center rounded-lg border border-dashed">
                                                            <p className="text-xs text-muted-foreground">
                                                                No members found in this organization.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Name</TableHead>
                                                                        <TableHead>Email</TableHead>
                                                                        <TableHead>Role</TableHead>
                                                                        <TableHead>Joined</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {currentTenantDetails.collaborators.map((collaborator) => (
                                                                        <TableRow key={collaborator.id}>
                                                                            <TableCell className="font-medium">
                                                                                {collaborator.firstname} {collaborator.lastname}
                                                                            </TableCell>
                                                                            <TableCell>{collaborator.email}</TableCell>
                                                                            <TableCell>
                                                                                <Badge variant={collaborator.role === "ADMIN" ? "default" : "secondary"}>
                                                                                    {collaborator.role}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-muted-foreground">
                                                                                {new Date(collaborator.joinedAt).toLocaleDateString("en-US", {
                                                                                    month: "short",
                                                                                    day: "numeric",
                                                                                    year: "numeric",
                                                                                })}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
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
                                                <div className="p-4 rounded-xl mb-4 bg-muted">
                                                    <Building2 className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-lg font-semibold mb-1">
                                                    {activeTab === "active" ? "No active tenants" : "No inactive tenants"}
                                                </h3>
                                                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                                                    {activeTab === "active"
                                                        ? "Create your first organization tenant to get started."
                                                        : "No deactivated tenants yet."}
                                                </p>
                                                {activeTab === "active" && (
                                                    <Button onClick={() => setIsModalOpen(true)}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add Tenant
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {filteredTenants.map((tenant: Tenant) => {
                                                const isCurrentTenant = tenant.id === currentTenantId;

                                                return (
                                                    <Card
                                                        key={tenant.id}
                                                        onClick={() => !tenant.deactivatedAt && handleTenantClick(tenant)}
                                                        className={`group transition-all duration-200 ${isCurrentTenant ? "ring-2 ring-primary shadow-md" : ""} ${tenant.deactivatedAt ? "opacity-60" : "hover:shadow-lg hover:border-primary/50 cursor-pointer"}`}
                                                    >
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                    <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                                                                        <Building2 className="h-5 w-5 text-primary" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 space-y-1">
                                                                        <div className="flex items-start gap-2">
                                                                            <CardTitle className="text-base font-semibold leading-tight truncate" title={tenant.name}>
                                                                                {tenant.name}
                                                                            </CardTitle>
                                                                            {isCurrentTenant && (
                                                                                <Badge variant="default" className="shrink-0 text-xs">Current</Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs font-mono truncate text-muted-foreground" title={tenant.slug}>
                                                                            {tenant.slug}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {!isCurrentTenant && (
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                                            >
                                                                                <MoreVertical className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            {!tenant.deactivatedAt ? (
                                                                                <DropdownMenuItem
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setTenantToDeactivate(tenant);
                                                                                        setShowDeactivateModal(true);
                                                                                    }}
                                                                                    className="text-destructive"
                                                                                >
                                                                                    <PowerOff className="h-4 w-4 mr-2" />
                                                                                    Deactivate
                                                                                </DropdownMenuItem>
                                                                            ) : (
                                                                                <DropdownMenuItem
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setTenantToActivate(tenant);
                                                                                        setShowActivateModal(true);
                                                                                    }}
                                                                                >
                                                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                                    Activate
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pt-0">
                                                            <div className="flex items-center justify-between text-xs pt-3 border-t">
                                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                    <span>Created</span>
                                                                    <span className="font-medium">
                                                                        {new Date(tenant.createdAt).toLocaleDateString("en-US", {
                                                                            month: "short",
                                                                            day: "numeric",
                                                                            year: "numeric",
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                {tenant.deactivatedAt && (
                                                                    <Badge variant="destructive" className="text-xs">Inactive</Badge>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Add Tenant Dialog */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Tenant</DialogTitle>
                            <DialogDescription>
                                Create a new organization tenant by filling in the details below.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    Organization Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter organization name"
                                    className={errors.name ? "border-destructive" : ""}
                                />
                                {errors.name && (
                                    <p className="text-sm text-destructive">{errors.name}</p>
                                )}
                                {submitError && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{submitError}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create Tenant"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>


                {/* Deactivate Tenant Alert Dialog */}
                <AlertDialog open={showDeactivateModal} onOpenChange={(open) => {
                    if (!isDeactivating) {
                        setShowDeactivateModal(open);
                        if (!open) setTenantToDeactivate(null);
                    }
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate Tenant</AlertDialogTitle>
                            <AlertDialogDescription>
                                {tenantToDeactivate
                                    ? `Are you sure you want to deactivate "${tenantToDeactivate.name}"? This will prevent all users in this organization from accessing the system. This action can be reversed later.`
                                    : ""}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeactivateTenant}
                                disabled={isDeactivating}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeactivating ? "Deactivating..." : "Deactivate"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Activate Tenant Alert Dialog */}
                <AlertDialog open={showActivateModal} onOpenChange={(open) => {
                    if (!isActivating) {
                        setShowActivateModal(open);
                        if (!open) setTenantToActivate(null);
                    }
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Activate Tenant</AlertDialogTitle>
                            <AlertDialogDescription>
                                {tenantToActivate
                                    ? `Are you sure you want to activate "${tenantToActivate.name}"? This will restore access for all users in this organization.`
                                    : ""}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleActivateTenant} disabled={isActivating}>
                                {isActivating ? "Activating..." : "Activate"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Deactivate Collaborator Alert Dialog */}
                <AlertDialog open={showDeactivateCollaboratorModal} onOpenChange={(open) => {
                    if (!isDeactivatingCollaborator) {
                        setShowDeactivateCollaboratorModal(open);
                        if (!open) setCollaboratorToDeactivate(null);
                    }
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate Collaborator</AlertDialogTitle>
                            <AlertDialogDescription>
                                {collaboratorToDeactivate
                                    ? `Are you sure you want to deactivate "${collaboratorToDeactivate.firstname} ${collaboratorToDeactivate.lastname}"? This will prevent them from accessing the system. This action can be reversed later.`
                                    : ""}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeactivatingCollaborator}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeactivateCollaborator}
                                disabled={isDeactivatingCollaborator}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeactivatingCollaborator ? "Deactivating..." : "Deactivate"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Activate Collaborator Alert Dialog */}
                <AlertDialog open={showActivateCollaboratorModal} onOpenChange={(open) => {
                    if (!isActivatingCollaborator) {
                        setShowActivateCollaboratorModal(open);
                        if (!open) setCollaboratorToActivate(null);
                    }
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Activate Collaborator</AlertDialogTitle>
                            <AlertDialogDescription>
                                {collaboratorToActivate
                                    ? `Are you sure you want to activate "${collaboratorToActivate.firstname} ${collaboratorToActivate.lastname}"? This will restore their access to the system.`
                                    : ""}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isActivatingCollaborator}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleActivateCollaborator} disabled={isActivatingCollaborator}>
                                {isActivatingCollaborator ? "Activating..." : "Activate"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Side Panel Sheet */}
                <Sheet open={isPanelOpen} onOpenChange={handleClosePanel}>
                    <SheetContent className="w-full sm:max-w-md flex flex-col p-0 h-full overflow-hidden">
                        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <SheetTitle className="text-2xl">Tenant Details</SheetTitle>
                                    <SheetDescription className="mt-1">
                                        Manage collaborators and invitations for this organization
                                    </SheetDescription>
                                </div>
                            </div>
                        </SheetHeader>
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <ScrollArea className="h-full px-6">
                                <div className="pr-6">
                                    {isLoadingTenantDetails ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                        </div>
                                    ) : selectedTenant ? (
                                        <div className="space-y-6 py-6">
                                            <div>
                                                <h3 className="text-lg font-semibold mb-1">{selectedTenant.name}</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Created {new Date(selectedTenant.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                            <Separator />

                                            <div>
                                                <h4 className="text-sm font-medium mb-3">Invite a collaborator</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="invite-email">Email</Label>
                                                        <Input
                                                            id="invite-email"
                                                            type="email"
                                                            value={inviteEmail}
                                                            onChange={(e) => setInviteEmail(e.target.value)}
                                                            placeholder="Enter email address"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="invite-role">Role</Label>
                                                        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "ADMIN" | "MEMBER")}>
                                                            <SelectTrigger id="invite-role">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {roleOptions.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {inviteError && (
                                                        <Alert variant="destructive">
                                                            <AlertDescription>{inviteError}</AlertDescription>
                                                        </Alert>
                                                    )}
                                                    <Button
                                                        onClick={handleSendInvitation}
                                                        disabled={!inviteEmail.trim() || isSendingInvitation}
                                                        className="w-full"
                                                    >
                                                        {isSendingInvitation ? "Sending..." : "Send Invitation"}
                                                    </Button>
                                                </div>
                                            </div>
                                            <Separator />

                                            {/* Divider */}
                                            <div className="border-t my-4" style={{ borderColor: "var(--border-color)" }} />

                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Mail className="h-4 w-4" />
                                                    <h4 className="text-sm font-medium">Pending Invites</h4>
                                                    {selectedTenant.pendingInvites && selectedTenant.pendingInvites.length > 0 && (
                                                        <Badge>{selectedTenant.pendingInvites.length}</Badge>
                                                    )}
                                                </div>
                                                {!selectedTenant.pendingInvites || selectedTenant.pendingInvites.length === 0 ? (
                                                    <div className="py-6 text-center rounded-lg border border-dashed">
                                                        <p className="text-xs text-muted-foreground">No pending invites</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {selectedTenant.pendingInvites.map((invite) => (
                                                            <Card key={invite.id}>
                                                                <CardContent className="p-3">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-medium text-xs mb-0.5 truncate" title={invite.email}>
                                                                                {invite.email}
                                                                            </p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {new Date(invite.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • Expires {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                            <Badge variant={invite.role === "ADMIN" ? "default" : "secondary"}>
                                                                                {invite.role}
                                                                            </Badge>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6"
                                                                                onClick={() => handleCancelInvite(invite.id)}
                                                                                disabled={cancellingInviteId === invite.id}
                                                                            >
                                                                                {cancellingInviteId === invite.id ? (
                                                                                    <Skeleton className="h-3.5 w-3.5 rounded-full" />
                                                                                ) : (
                                                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <Separator />

                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <UserPlus className="h-4 w-4" />
                                                    <h4 className="text-sm font-medium">Collaborators</h4>
                                                    {selectedTenant.collaborators && selectedTenant.collaborators.length > 0 && (
                                                        <Badge>{selectedTenant.collaborators.length}</Badge>
                                                    )}
                                                </div>
                                                {selectedTenant.collaborators.length === 0 ? (
                                                    <div className="py-6 text-center rounded-lg border border-dashed">
                                                        <p className="text-xs text-muted-foreground">No collaborators yet</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {selectedTenant.collaborators.map((collaborator) => (
                                                            <Card key={collaborator.id} className={collaborator.deactivatedAt ? "opacity-60" : ""}>
                                                                <CardContent className="p-3">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-medium text-xs mb-0.5">
                                                                                {collaborator.firstname} {collaborator.lastname}
                                                                            </p>
                                                                            <p className="text-xs truncate text-muted-foreground" title={collaborator.email}>
                                                                                {collaborator.email}
                                                                            </p>
                                                                            <p className="text-xs mt-0.5 text-muted-foreground">
                                                                                {collaborator.deactivatedAt
                                                                                    ? `Deactivated ${new Date(collaborator.deactivatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                                                                    : `Joined ${new Date(collaborator.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                                            <Badge variant={collaborator.role === "ADMIN" ? "default" : "secondary"}>
                                                                                {collaborator.role}
                                                                            </Badge>
                                                                            {isSuperAdmin && (
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="end">
                                                                                        {!collaborator.deactivatedAt ? (
                                                                                            <DropdownMenuItem
                                                                                                onClick={() => {
                                                                                                    setCollaboratorToDeactivate(collaborator);
                                                                                                    setShowDeactivateCollaboratorModal(true);
                                                                                                }}
                                                                                                className="text-destructive"
                                                                                            >
                                                                                                <PowerOff className="h-4 w-4 mr-2" />
                                                                                                Deactivate
                                                                                            </DropdownMenuItem>
                                                                                        ) : (
                                                                                            <DropdownMenuItem
                                                                                                onClick={() => {
                                                                                                    setCollaboratorToActivate(collaborator);
                                                                                                    setShowActivateCollaboratorModal(true);
                                                                                                }}
                                                                                            >
                                                                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                                                Activate
                                                                                            </DropdownMenuItem>
                                                                                        )}
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </ScrollArea>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}

