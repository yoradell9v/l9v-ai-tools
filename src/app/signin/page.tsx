"use client";
import AuthForm from "@/components/forms/AuthForm";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SignInPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const router = useRouter();

    const handleSubmit = async ({ email, password }: { email: string; password: string }) => {
        setLoading(true);
        setError(undefined);

        try {
            const response = await fetch("/api/auth/signin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
                credentials: "include",
            });

            const data = await response.json();

            if (data.requiresPasswordReset && data.resetToken) {
                router.push(`/reset-password?token=${encodeURIComponent(data.resetToken)}`);
                return;
            }

            if (data.organizationDeactivated) {
                setError(data.message || "Your organization has been deactivated. Please contact your administrator.");
                return;
            }

            if (!response.ok) {
                console.log(error)
                setError(data.error || data.message || "An error occurred during sign in");
                return;
            }

            setTimeout(() => {
                window.location.href = "/dashboard";
            }, 100);


        } catch (err) {
            setError("Failed to connect to the server. Please try again.");
            console.error("Sign in error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen" style={{ backgroundColor: 'var(--primary-dark)' }}>
            {/* Radial Gradient Overlay */}
            <div 
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse at bottom left, hsl(var(--primary) / 0.2) 0%, transparent 50%)'
                }}
            />
            
            <div className="relative">
                <AuthForm
                    mode="signin"
                    onSubmit={handleSubmit}
                    isSubmitting={loading}
                    errorMessage={error}
                />
            </div>
        </div>
    );
}