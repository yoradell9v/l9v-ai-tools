"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthForm, { AuthFormValues } from "@/components/forms/AuthForm";
import Modal from "@/components/ui/Modal";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";

interface InviteDetails {
    email: string;
    role: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    expiresAt: string;
    userExists: boolean;
}

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
    const [isValidating, setIsValidating] = useState(true);
    const [validationError, setValidationError] = useState<string | undefined>(undefined);

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setValidationError("No invitation token provided.");
                setIsValidating(false);
                return;
            }

            try {
                const response = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`, {
                    method: "GET",
                    credentials: "include",
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    // Check if organization is deactivated
                    if (data.organizationDeactivated) {
                        setValidationError(data.message || "The organization has been deactivated. Please contact your administrator.");
                    } else {
                        setValidationError(data.message || "Invalid or expired invitation.");
                    }
                    setIsValidating(false);
                    return;
                }

                setInviteDetails(data.invite);
                setIsValidating(false);
            } catch (err) {
                console.error("Error validating invite:", err);
                setValidationError("Failed to validate invitation. Please try again.");
                setIsValidating(false);
            }
        };

        validateToken();
    }, [token]);

    const handleSubmit = async ({ firstname, lastname, email, password, confirmPassword }: AuthFormValues) => {
        if (!token) {
            setError("Invalid invitation token.");
            return;
        }

        try {
            setLoading(true);
            setError(undefined);

            const response = await fetch("/api/auth/accept-invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    firstname,
                    lastname,
                    password,
                    confirmPassword,
                }),
                credentials: "include",
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                // Check if organization is deactivated
                if (data.organizationDeactivated) {
                    setError(data.message || "The organization has been deactivated. Please contact your administrator.");
                } else {
                    setError(data.message || "Failed to accept invitation.");
                }
                return;
            }

            setShowSuccessModal(true);
        } catch (err) {
            console.error("Accept invite error:", err);
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (isValidating) {
        return (
            <div className="relative min-h-screen" style={{ backgroundColor: 'var(--primary-dark)' }}>
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at bottom left, hsl(var(--primary) / 0.2) 0%, transparent 50%)'
                    }}
                />
                <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
                    <div className="flex justify-center mb-8">
                        <Image
                            src="/logo-light.png"
                            alt="Level 9 Virtual"
                            width={200}
                            height={200}
                            className="object-contain"
                            priority
                        />
                    </div>
                    <Card className="w-full max-w-md">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-[var(--primary)]" viewBox="0 0 24 24">
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
                                <p className="text-[var(--text-primary)]">Validating invitation...</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (validationError || !inviteDetails) {
        return (
            <div className="relative min-h-screen" style={{ backgroundColor: 'var(--primary-dark)' }}>
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at bottom left, hsl(var(--primary) / 0.2) 0%, transparent 50%)'
                    }}
                />
                <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
                    <div className="flex justify-center mb-8">
                        <Image
                            src="/logo-light.png"
                            alt="Level 9 Virtual"
                            width={200}
                            height={200}
                            className="object-contain"
                            priority
                        />
                    </div>
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold text-center">Invalid Invitation</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Alert variant="destructive" className="mb-6">
                                <AlertDescription>{validationError || "This invitation is invalid or has expired."}</AlertDescription>
                            </Alert>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={() => router.push("/signin")} className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-base font-bold">
                                Go to Sign In
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen" style={{ backgroundColor: 'var(--primary-dark)' }}>
            <div 
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse at bottom left, hsl(var(--primary) / 0.2) 0%, transparent 50%)'
                }}
            />
            <div className="relative">
                <AuthForm
                    mode="signup"
                    onSubmit={handleSubmit}
                    isSubmitting={loading}
                    errorMessage={error}
                    submitLabel="Accept Invitation & Create Account"
                    initialValues={{
                        email: inviteDetails.email,
                    }}
                />
            </div>

            <AnimatePresence>
                {showSuccessModal && (
                    <Modal
                        isOpen={showSuccessModal}
                        onClose={() => {
                            setShowSuccessModal(false);
                            router.push("/dashboard");
                        }}
                        onConfirm={() => {
                            setShowSuccessModal(false);
                            router.push("/dashboard");
                        }}
                        title="Welcome!"
                        message="Your account has been created successfully and you have been added to the organization. You are now signed in."
                        confirmText="Go to Dashboard"
                        cancelText=""
                        confirmVariant="primary"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense
            fallback={
                <div className="relative min-h-screen" style={{ backgroundColor: 'var(--primary-dark)' }}>
                    <div 
                        className="absolute inset-0"
                        style={{
                            background: 'radial-gradient(ellipse at bottom left, hsl(var(--primary) / 0.2) 0%, transparent 50%)'
                        }}
                    />
                    <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
                        <div className="flex justify-center mb-8">
                            <Image
                                src="/logo-light.png"
                                alt="Level 9 Virtual"
                                width={200}
                                height={200}
                                className="object-contain"
                                priority
                            />
                        </div>
                        <Card className="w-full max-w-md">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-[var(--primary)]" viewBox="0 0 24 24">
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
                                    <p className="text-[var(--text-primary)]">Loading...</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            }
        >
            <AcceptInviteContent />
        </Suspense>
    );
}

