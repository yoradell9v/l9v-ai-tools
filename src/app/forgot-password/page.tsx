'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsSubmitting(true)
        setErrorMessage('')

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reset email')
            }

            setIsSuccess(true)
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Something went wrong')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSuccess) {
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
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 bg-green-100 dark:bg-green-900/30">
                                <svg
                                    className="h-6 w-6 text-green-600 dark:text-green-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <CardTitle className="text-center">Check your email</CardTitle>
                            <CardDescription className="text-center">
                                We've sent a password reset link to <strong>{email}</strong>
                            </CardDescription>
                            <div className="mt-4">
                                <p className="text-xs text-center text-[var(--text-muted)]">
                                    Didn't receive the email? Check your spam folder or{' '}
                                    <button
                                        onClick={() => setIsSuccess(false)}
                                        className="font-medium transition-all duration-150 text-[var(--primary)] hover:text-[var(--accent)]"
                                    >
                                        try again
                                    </button>
                                </p>
                            </div>
                        </CardHeader>
                        <CardFooter className="justify-center">
                            <Button
                                asChild
                                className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-base font-bold hover:scale-105 transition-transform duration-200"
                            >
                                <Link href="/signin">
                                    ← Back to sign in
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        )
    }

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
                        <CardTitle className="text-3xl font-semibold text-center">Forgot password?</CardTitle>
                        <CardDescription className="text-center">No worries, we'll send you reset instructions.</CardDescription>
                        {errorMessage && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertDescription>{errorMessage}</AlertDescription>
                            </Alert>
                        )}
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent>
                            <div className="flex flex-col gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4 pt-6">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-base font-bold"
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
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
                                        <span className="text-base font-bold">Sending...</span>
                                    </div>
                                ) : (
                                    'Send reset link'
                                )}
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="w-full border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-transparent text-base font-bold"
                            >
                                <Link href="/signin" className="flex items-center justify-center gap-1">
                                    <ChevronLeft className="w-4 h-4" />
                                    Back to sign in
                                </Link>
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    )
}
