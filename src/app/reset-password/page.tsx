'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'
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

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get('token')

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [passwordStrength, setPasswordStrength] = useState<{
        valid: boolean
        message: string
    }>({ valid: false, message: '' })

    useEffect(() => {
        if (!token) {
            setErrorMessage('Missing reset token')
        }
    }, [token])

    function checkPasswordStrength(password: string) {
        const specialCharRegex = /[_!@#$%^&*(),.?":{}|<>]/
        const minLength = 8

        if (password.length === 0) {
            setPasswordStrength({ valid: false, message: '' })
        } else if (password.length < minLength) {
            setPasswordStrength({
                valid: false,
                message: 'Password must be at least 8 characters.',
            })
        } else if (!specialCharRegex.test(password)) {
            setPasswordStrength({
                valid: false,
                message: 'Password must contain at least one special character.',
            })
        } else {
            setPasswordStrength({ valid: true, message: 'Strong password!' })
        }
    }

    function handlePasswordChange(value: string) {
        setPassword(value)
        checkPasswordStrength(value)
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match')
            return
        }

        if (!passwordStrength.valid) {
            setErrorMessage('Please choose a stronger password')
            return
        }

        setIsSubmitting(true)
        setErrorMessage('')

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset password')
            }

            setIsSuccess(true)
            setTimeout(() => {
                router.push('/signin')
            }, 3000)
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Something went wrong')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-[var(--background)] text-[var(--text-primary)]">
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
                        <CardTitle className="text-center">Password reset successful!</CardTitle>
                        <CardDescription className="text-center">
                            Your password has been reset. Redirecting to sign in...
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Link
                            href="/signin"
                            className="text-sm font-medium transition-all duration-150 text-[var(--primary)] hover:text-[var(--accent)]"
                        >
                            Go to sign in →
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-[var(--background)] text-[var(--text-primary)]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-3xl font-semibold">Set new password</CardTitle>
                    <CardDescription>Please enter your new password below.</CardDescription>
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
                                <Label htmlFor="password">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                        disabled={!token}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-50"
                                        disabled={!token}
                                    >
                                        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                                {password.length > 0 && (
                                    <p className={`text-sm transition-colors duration-150 ${passwordStrength.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {passwordStrength.message}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                        disabled={!token}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-50"
                                        disabled={!token}
                                    >
                                        {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4 pt-6">
                        <Button
                            type="submit"
                            disabled={isSubmitting || !passwordStrength.valid || !token}
                            className="w-full"
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
                                    <span>Resetting...</span>
                                </div>
                            ) : (
                                'Reset password'
                            )}
                        </Button>
                        <Link
                            href="/signin"
                            className="w-full flex items-center justify-center gap-1 text-sm font-medium rounded-xl py-2.5 px-4 transition-all duration-150 border border-[color:var(--accent-strong)] text-[color:var(--accent-strong)] hover:bg-transparent"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back to sign in
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-[var(--background)] text-[var(--text-primary)]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-strong)] mx-auto mb-4"></div>
                    <p className="text-[var(--text-primary)]">Loading...</p>
                </div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    )
}
