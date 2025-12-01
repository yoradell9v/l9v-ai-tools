'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'
import { ChevronLeft } from "lucide-react"

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
                className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-white dark:bg-[#121212]"
            >
                <div
                    className="w-full max-w-md rounded-2xl px-8 pt-8 pb-10 border shadow-lg transition-colors duration-150 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a]"
                >
                    <div className="text-center">
                        <div
                            className="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 bg-green-100 dark:bg-green-900/30"
                        >
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
                        <h2
                            className="text-2xl font-semibold mb-2 transition-colors duration-150 text-[#18416B] dark:text-[#FAC133]"
                        >
                            Password reset successful!
                        </h2>
                        <p
                            className="text-sm mb-6 transition-colors duration-150 text-[#1a1a1a] dark:text-[#e0e0e0]"
                        >
                            Your password has been reset. Redirecting to sign in...
                        </p>
                        <Link
                            href="/signin"
                            className="inline-block text-sm font-medium transition-all duration-150 text-[#18416B] dark:text-[#FAC133] hover:text-[#245884] dark:hover:text-[#FAC133]/80"
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
            className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-white dark:bg-[#121212]"
        >
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-2xl px-8 pt-8 pb-10 border shadow-lg transition-all duration-150 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a]"
            >
                <div className="mb-8">
                    <h2
                        className="text-2xl font-semibold mb-2 transition-colors duration-150 text-[#18416B] dark:text-[#FAC133]"
                    >
                        Set new password
                    </h2>
                    <p
                        className="text-sm transition-colors duration-150 text-[#1a1a1a] dark:text-[#e0e0e0]"
                    >
                        Please enter your new password below.
                    </p>
                    {errorMessage && (
                        <div
                            className="mt-4 p-3 border rounded-md transition-colors duration-150 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                        >
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {errorMessage}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mb-4 relative">
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium mb-1 transition-colors duration-150 text-gray-700 dark:text-gray-300"
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
                        className="w-full px-3 py-2 border rounded-md transition-all duration-200 focus:outline-none border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-white dark:bg-[#121212] text-[#1a1a1a] dark:text-[#e0e0e0] placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-[35px] transition-colors duration-150 disabled:opacity-50 text-gray-500 dark:text-gray-400 hover:text-[#FAC133] disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400"
                        disabled={!token}
                    >
                        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>

                    {password.length > 0 && (
                        <p
                            className={`mt-2 text-sm transition-colors duration-150 ${passwordStrength.valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                        >
                            {passwordStrength.message}
                        </p>
                    )}
                </div>

                <div className="mb-6 relative">
                    <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium mb-1 transition-colors duration-150 text-gray-700 dark:text-gray-300"
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
                        className="w-full px-3 py-2 border rounded-md transition-all duration-200 focus:outline-none border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-white dark:bg-[#121212] text-[#1a1a1a] dark:text-[#e0e0e0] placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-[35px] transition-colors duration-150 disabled:opacity-50 text-gray-500 dark:text-gray-400 hover:text-[#FAC133] disabled:hover:text-gray-500 dark:disabled:hover:text-gray-400"
                        disabled={!token}
                    >
                        {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>

                <div className="mb-6">
                    <button
                        type="submit"
                        disabled={isSubmitting || !passwordStrength.valid || !token}
                        className="w-full bg-[#FAC133] hover:brightness-110 text-[#18416B] dark:text-[#1a1a1a] font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FAC133]/40 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
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
                        className="w-full flex items-center justify-center gap-1 text-sm font-medium rounded-xl py-2.5 px-4 transition-all duration-150 border border-[#18416B] dark:border-[#FAC133] text-[#18416B] dark:text-[#FAC133] hover:text-[#245884] dark:hover:text-[#FAC133]/80"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to sign in
                    </Link>
                </div>
            </form>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div
                className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-white dark:bg-[#121212]"
            >
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FAC133] mx-auto mb-4"></div>
                    <p className="text-[#1a1a1a] dark:text-[#e0e0e0]">Loading...</p>
                </div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    )
}
