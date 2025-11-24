'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'
import { ChevronLeft } from "lucide-react"

export default function ResetPasswordContent() {
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
            setErrorMessage('Invalid or missing reset token')
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
            <div
                className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150"
                style={{ backgroundColor: "var(--background)", color: "var(--text-primary)" }}
            >
                <div
                    className="w-full max-w-md rounded-2xl px-8 pt-8 pb-10 border shadow-lg transition-colors duration-150"
                    style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card-bg)" }}
                >
                    <div className="text-center">
                        <div
                            className="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4"
                            style={{ backgroundColor: "rgba(34,197,94,0.15)" }}
                        >
                            <svg
                                className="h-6 w-6"
                                style={{ color: "rgb(34,197,94)" }}
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
                        <h2
                            className="text-2xl font-semibold mb-2 transition-colors duration-150"
                            style={{ color: "var(--text-primary)" }}
                        >
                            Password reset successful!
                        </h2>
                        <p
                            className="text-sm mb-6 transition-colors duration-150"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Your password has been reset. Redirecting to sign in...
                        </p>
                        <Link
                            href="/signin"
                            className="inline-block text-sm font-medium transition-all duration-150"
                            style={{ color: "var(--accent)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
                        >
                            Go to sign in →
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150"
            style={{ backgroundColor: "var(--background)", color: "var(--text-primary)" }}
        >
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-2xl px-8 pt-8 pb-10 border shadow-lg transition-all duration-150"
                style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card-bg)" }}
            >
                <div className="mb-8">
                    <h2
                        className="text-2xl font-semibold mb-2 transition-colors duration-150"
                        style={{ color: "var(--text-primary)" }}
                    >
                        Set new password
                    </h2>
                    <p
                        className="text-sm transition-colors duration-150"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Please enter your new password below.
                    </p>
                    {errorMessage && (
                        <div
                            className="mt-4 p-3 border rounded-md transition-colors duration-150"
                            style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        >
                            <p className="text-sm" style={{ color: "rgb(220, 38, 38)" }}>
                                {errorMessage}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mb-4 relative">
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium mb-1 transition-colors duration-150"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        New Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={!token}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: "var(--background)",
                            color: "var(--text-primary)"
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-[35px] transition-colors duration-150 disabled:opacity-50"
                        style={{ color: "var(--text-muted)" }}
                        disabled={!token}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.color = "var(--accent)")}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>

                    {password.length > 0 && (
                        <p
                            className="mt-2 text-sm transition-colors duration-150"
                            style={{ color: passwordStrength.valid ? "rgb(22,163,74)" : "rgb(220,38,38)" }}
                        >
                            {passwordStrength.message}
                        </p>
                    )}
                </div>

                <div className="mb-6 relative">
                    <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium mb-1 transition-colors duration-150"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Confirm New Password
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={!token}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: "var(--background)",
                            color: "var(--text-primary)"
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-[35px] transition-colors duration-150 disabled:opacity-50"
                        style={{ color: "var(--text-muted)" }}
                        disabled={!token}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.color = "var(--accent)")}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="mb-6">
                    <button
                        type="submit"
                        disabled={isSubmitting || !passwordStrength.valid || !token}
                        className="w-full bg-[var(--accent)] hover:brightness-110 text-white font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
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
                    </button>
                </div>

                <div className="flex justify-center">
                    <Link
                        href="/signin"
                        className="w-full flex items-center justify-center gap-1 text-sm font-medium rounded-xl py-2.5 px-4 transition-all duration-150"
                        style={{
                            color: "var(--accent)",
                            borderColor: "var(--accent)",
                            borderWidth: "1px"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to sign in
                    </Link>
                </div>
            </form>
        </div>
    )
}