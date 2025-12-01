'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from "lucide-react"

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
                            Check your email
                        </h2>
                        <p
                            className="text-sm mb-6 transition-colors duration-150 text-[#1a1a1a] dark:text-[#e0e0e0]"
                        >
                            We've sent a password reset link to <strong>{email}</strong>
                        </p>
                        <p
                            className="text-xs mb-6 transition-colors duration-150 text-gray-600 dark:text-gray-400"
                        >
                            Didn't receive the email? Check your spam folder or{' '}
                            <button
                                onClick={() => setIsSuccess(false)}
                                className="font-medium transition-all duration-150 text-[#18416B] dark:text-[#FAC133] hover:text-[#245884] dark:hover:text-[#FAC133]/80"
                            >
                                try again
                            </button>
                        </p>
                        <Link
                            href="/signin"
                            className="inline-block text-sm font-medium transition-all duration-150 text-[#18416B] dark:text-[#FAC133] hover:text-[#245884] dark:hover:text-[#FAC133]/80"
                        >
                            ← Back to sign in
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
                        Forgot password?
                    </h2>
                    <p
                        className="text-sm transition-colors duration-150 text-[#1a1a1a] dark:text-[#e0e0e0]"
                    >
                        No worries, we'll send you reset instructions.
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

                <div className="mb-6">
                    <label
                        htmlFor="email"
                        className="block text-sm font-medium mb-1 transition-colors duration-150 text-gray-700 dark:text-gray-300"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className="w-full px-3 py-2 border rounded-md transition-all duration-200 focus:outline-none border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-white dark:bg-[#121212] text-[#1a1a1a] dark:text-[#e0e0e0] placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                </div>

                <div className="mb-6">
                    <button
                        type="submit"
                        disabled={isSubmitting}
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
                                <span>Sending...</span>
                            </div>
                        ) : (
                            'Send reset link'
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