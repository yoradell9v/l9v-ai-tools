"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm, { AuthFormValues } from "@/components/forms/AuthForm";
import Modal from "@/components/ui/Modal";
import { AnimatePresence, motion } from "framer-motion";

export default function SignUpPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleSubmit = async ({ firstname, lastname, email, password, confirmPassword }: AuthFormValues) => {
        try {
            setLoading(true);
            setError(undefined);

            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    firstname,
                    lastname,
                    email,
                    password,
                    confirmPassword,
                }),
            });

            const text = await response.text();

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                console.error("Non-JSON response from API:", text);
                throw new Error("Server returned non-JSON response");
            }

            if (!response.ok) {
                setError(data.error || "Failed to sign up");
                return;
            }

            setShowSuccessModal(true);

        } catch (err) {
            console.error("Signup error:", err);
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AuthForm
                mode="signup"
                onSubmit={handleSubmit}
                isSubmitting={loading}
                errorMessage={error}
            />


            <AnimatePresence>
                {showSuccessModal && (

                    <Modal
                        isOpen={showSuccessModal}
                        onClose={() => setShowSuccessModal(false)}
                        onConfirm={() => {
                            setShowSuccessModal(false);
                            router.push("/signin");
                        }}
                        title="Signup Successful!"
                        message="Your account has been created successfully. Click below to sign in."
                        confirmText="Proceed to Sign In"
                        cancelText="Cancel"
                        confirmVariant="primary"
                    />

                )}
            </AnimatePresence>
        </>
    );
}
