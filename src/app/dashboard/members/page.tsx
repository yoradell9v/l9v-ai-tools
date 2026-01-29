"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
    Plus,
    Mail,
    Trash2,
    Users,
    AlertCircle,
    PowerOff,
    CheckCircle2,
    MoreVertical,
    Loader2,
} from "lucide-react";
import { InboxIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Member {
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
    const { user } = useUser();
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
    const [activeTab, setActiveTab] = useState<"members" | "invites" | "deactivated">("members");
    const [memberToDeactivate, setMemberToDeactivate] = useState<Member | null>(null);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [memberToActivate, setMemberToActivate] = useState<Member | null>(null);
    const [showActivateModal, setShowActivateModal] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [inviteToCancelId, setInviteToCancelId] = useState<string | null>(null);

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

    const handleDeactivateMember = async () => {
        if (!memberToDeactivate) return { success: false, selfDeactivated: false };

        const isSelfDeactivation = memberToDeactivate.userId === user?.id;
        setIsDeactivating(true);
        try {
            const response = await fetch("/api/members", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    memberId: memberToDeactivate.id,
                    action: "deactivate",
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                const message = data.message || "Failed to deactivate member. Please try again.";
                console.error("Error deactivating member:", message);
                toast.error(message);
                return { success: false, selfDeactivated: false };
            }

            setShowDeactivateModal(false);
            setMemberToDeactivate(null);
            setOpenMenuId(null);

            if (!isSelfDeactivation) {
                await fetchMembers();
            }

            return { success: true, selfDeactivated: isSelfDeactivation };
        } catch (error) {
            console.error("Error deactivating member:", error);
            toast.error("Failed to deactivate member. Please try again.");
            return { success: false, selfDeactivated: false };
        } finally {
            setIsDeactivating(false);
        }
    };

    const handleActivateMember = async () => {
        if (!memberToActivate) return false;

        setIsActivating(true);
        try {
            const response = await fetch("/api/members", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    memberId: memberToActivate.id,
                    action: "activate",
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                const message = data.message || "Failed to activate member. Please try again.";
                console.error("Error activating member:", message);
                toast.error(message);
                return false;
            }

            setShowActivateModal(false);
            setMemberToActivate(null);
            setOpenMenuId(null);
            await fetchMembers();
            return true;
        } catch (error) {
            console.error("Error activating member:", error);
            toast.error("Failed to activate member. Please try again.");
            return false;
        } finally {
            setIsActivating(false);
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

    const renderMembersTable = () => {
        if (!selectedOrganization) return null;
        const activeMembers = selectedOrganization.members.filter((m) => !m.deactivatedAt);
        if (activeMembers.length === 0) {
            return (
                <Card>
                    <CardContent className="py-10 text-center text-base text-muted-foreground">
                        No active members yet.
                    </CardContent>
                </Card>
            );
        }
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Active Members</CardTitle>
                    <CardDescription>Manage roles and access</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeMembers.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell className="font-medium">
                                        {member.firstname} {member.lastname}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {member.email}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${member.role === "ADMIN"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-blue-100 text-blue-700"
                                            }`}>
                                            {member.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(member.joinedAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => {
                                                        setMemberToDeactivate(member);
                                                        setShowDeactivateModal(true);
                                                    }}
                                                >
                                                    <PowerOff className="h-4 w-4 mr-2" />
                                                    Deactivate
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    const renderDeactivatedTable = () => {
        if (!selectedOrganization) return null;
        const deactivatedMembers = selectedOrganization.members.filter((m) => m.deactivatedAt);
        if (deactivatedMembers.length === 0) {
            return (
                <Card>
                    <CardContent className="py-16 text-center">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20 mb-4">
                            <UserPlusIcon className="h-12 w-12 text-[var(--primary-dark)]" />
                        </div>
                        <p className="text-base text-muted-foreground">No deactivated members.</p>
                    </CardContent>
                </Card>
            );
        }
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Deactivated Members</CardTitle>
                    <CardDescription>Restore access when needed</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Deactivated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {deactivatedMembers.map((member) => (
                                <TableRow key={member.id} className="opacity-80">
                                    <TableCell className="font-medium">
                                        {member.firstname} {member.lastname}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {member.email}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${member.role === "ADMIN"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-blue-100 text-blue-700"
                                            }`}>
                                            {member.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {member.deactivatedAt
                                            ? new Date(member.deactivatedAt).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-green-600"
                                                    onClick={() => {
                                                        setMemberToActivate(member);
                                                        setShowActivateModal(true);
                                                    }}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Activate
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    const renderInvitesTable = () => {
        if (!selectedOrganization) return null;
        const invites = selectedOrganization.pendingInvites;
        if (invites.length === 0) {
            return (
                <Card>
                    <CardContent className="py-16 text-center">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20 mb-4">
                            <InboxIcon className="h-12 w-12 text-[var(--primary-dark)]" />
                        </div>
                        <p className="text-base text-muted-foreground">No pending invites.</p>
                    </CardContent>
                </Card>
            );
        }
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Pending Invites</CardTitle>
                    <CardDescription>Manage invitations</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Sent</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invites.map((invite) => (
                                <TableRow key={invite.id}>
                                    <TableCell className="font-medium">{invite.email}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${invite.role === "ADMIN"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-blue-100 text-blue-700"
                                            }`}>
                                            {invite.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(invite.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCancelInvite(invite.id)}
                                            disabled={cancellingInviteId === invite.id}
                                            className="text-destructive"
                                        >
                                            {cancellingInviteId === invite.id ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Cancelling...
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Cancel
                                                </>
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    return (
        <>
            <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
            </div>
            <div className="min-h-screen py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold">
                            {selectedOrganization ? selectedOrganization.organization.name : "Tenant Members"}
                        </h1>
                        <p className="text-base text-muted-foreground">
                            Manage members of your organization
                        </p>
                    </div>
                    {selectedOrganization && (
                        <Button onClick={() => setIsInviteModalOpen(true)} className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Invite Member
                        </Button>
                    )}
                </div>

                {error && (
                    <Card className="border-destructive/30 bg-destructive/10">
                        <CardContent className="py-4 flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            <p className="text-base text-destructive">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {!error && (
                    <>
                        {isLoading ? (
                            <Card>
                                <CardContent className="py-12 flex items-center justify-center gap-3 text-base text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Loading...
                                </CardContent>
                            </Card>
                        ) : !selectedOrganization ? (
                            <div className="py-16 space-y-6 text-center">
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                    <Users className="h-12 w-12 text-[var(--primary-dark)]" />
                                </div>
                                <div className="space-y-3 max-w-2xl mx-auto">
                                    <p className="text-2xl font-semibold">No organizations found</p>
                                    <p className="text-base text-muted-foreground">
                                        You need to be a tenant admin to view and manage members. Ask your admin to grant you access.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className=" space-y-4">
                                <TabsList className="inline-flex">
                                    <TabsTrigger value="members">Active Members</TabsTrigger>
                                    <TabsTrigger value="invites">Pending Invites</TabsTrigger>
                                    <TabsTrigger value="deactivated">Deactivated</TabsTrigger>
                                </TabsList>
                                <TabsContent value="members">{renderMembersTable()}</TabsContent>
                                <TabsContent value="invites">{renderInvitesTable()}</TabsContent>
                                <TabsContent value="deactivated">{renderDeactivatedTable()}</TabsContent>
                            </Tabs>
                        )}
                    </>
                )}
            </div>

            {/* Invite Member Dialog */}
            <Dialog open={isInviteModalOpen} onOpenChange={(open) => !isSendingInvitation && setIsInviteModalOpen(open)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Invite Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation to join {selectedOrganization?.organization.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-base font-medium flex items-center gap-1">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                Email Address <span className="text-destructive">*</span>
                            </label>
                            <Input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="Enter email address"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-base font-medium">
                                Role <span className="text-destructive">*</span>
                            </label>
                            <Select value={inviteRole} onValueChange={(v: "ADMIN" | "MEMBER") => setInviteRole(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
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
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{inviteError}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} disabled={isSendingInvitation} className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10">
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                await handleSendInvitation();
                                if (!inviteError && !isSendingInvitation) {
                                    toast.success("Invitation sent");
                                }
                            }}
                            disabled={isSendingInvitation || !inviteEmail.trim()}
                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                        >
                            {isSendingInvitation ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send Invitation"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deactivate Member Confirmation */}
            <AlertDialog open={showDeactivateModal} onOpenChange={(open) => !isDeactivating && setShowDeactivateModal(open)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Member</AlertDialogTitle>
                        <AlertDialogDescription>
                            {memberToDeactivate
                                ? memberToDeactivate.userId === user?.id
                                    ? "You are deactivating your own account. You will be signed out after."
                                    : `Are you sure you want to deactivate "${memberToDeactivate.firstname} ${memberToDeactivate.lastname}"?`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeactivating} className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                const result = await handleDeactivateMember();
                                if (result?.success) {
                                    if (result.selfDeactivated) {
                                        try {
                                            await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
                                        } catch (err) {
                                            console.error("Error signing out after self deactivation:", err);
                                        } finally {
                                            window.location.href = "/signin";
                                        }
                                    } else {
                                        toast.success("Member deactivated");
                                    }
                                }
                            }}
                            disabled={isDeactivating}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeactivating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deactivating...
                                </>
                            ) : (
                                "Deactivate"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Activate Member Confirmation */}
            <AlertDialog open={showActivateModal} onOpenChange={(open) => !isActivating && setShowActivateModal(open)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Activate Member</AlertDialogTitle>
                        <AlertDialogDescription>
                            {memberToActivate
                                ? `Are you sure you want to activate "${memberToActivate.firstname} ${memberToActivate.lastname}"?`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isActivating} className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                const success = await handleActivateMember();
                                if (success) {
                                    toast.success("Member activated");
                                }
                            }}
                            disabled={isActivating}
                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                        >
                            {isActivating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Activating...
                                </>
                            ) : (
                                "Activate"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Cancel Invitation Confirmation */}
            <AlertDialog open={!!inviteToCancelId} onOpenChange={(open) => !open && !cancellingInviteId && setInviteToCancelId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel invitation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this invitation? The recipient will no longer be able to join with this invite.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={!!cancellingInviteId} className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (inviteToCancelId) {
                                    await handleCancelInvite(inviteToCancelId);
                                    setInviteToCancelId(null);
                                    toast.success("Invitation cancelled");
                                }
                            }}
                            disabled={!!cancellingInviteId}
                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                        >
                            {cancellingInviteId === inviteToCancelId ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Cancelling...
                                </>
                            ) : (
                                "Cancel invitation"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
