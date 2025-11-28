'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'

type AuthMode = 'signin' | 'signup'

export interface AuthFormValues {
    firstname?: string
    lastname?: string
    email: string
    password: string
    confirmPassword?: string
}

export interface AuthFormProps {
    mode: AuthMode
    onSubmit: (values: AuthFormValues) => void | Promise<void>
    isSubmitting?: boolean
    errorMessage?: string
    submitLabel?: string
    initialValues?: Partial<AuthFormValues>
}

export default function AuthForm({
    mode,
    onSubmit,
    isSubmitting = false,
    errorMessage,
    submitLabel,
    initialValues,
}: AuthFormProps) {

    const [values, setValues] = useState<AuthFormValues>({
        firstname: initialValues?.firstname || '',
        lastname: initialValues?.lastname || '',
        email: initialValues?.email || '',
        password: '',
        confirmPassword: '',
    })

    useEffect(() => {
        if (initialValues) {
            setValues((prev) => ({
                ...prev,
                ...initialValues,
                password: prev.password || '',
                confirmPassword: prev.confirmPassword || '',
            }))
        }
    }, [initialValues])

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [passwordMismatchError, setPasswordMismatchError] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState<{ valid: boolean; message: string }>({ valid: false, message: '' })

    const isSignup = mode === 'signup'

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target
        setValues((prev) => ({ ...prev, [name]: value }))

        if (name === 'password' && isSignup) {
            checkPasswordStrength(value)
            if (passwordMismatchError) setPasswordMismatchError(false)
        }

        if (name === 'confirmPassword' && isSignup && passwordMismatchError) {
            setPasswordMismatchError(false)
        }
    }

    function checkPasswordStrength(password: string) {
        const specialCharRegex = /[_!@#$%^&*(),.?":{}|<>]/
        const minLength = 8

        if (password.length === 0) {
            setPasswordStrength({ valid: false, message: '' })
        } else if (password.length < minLength) {
            setPasswordStrength({ valid: false, message: 'Password must be at least 8 characters.' })
        } else if (!specialCharRegex.test(password)) {
            setPasswordStrength({ valid: false, message: 'Password must contain at least one special character.' })
        } else {
            setPasswordStrength({ valid: true, message: 'Strong password!' })
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSignup && values.password !== values.confirmPassword) {
            setPasswordMismatchError(true)
            return
        }
        if (isSignup && !passwordStrength.valid) return

        setPasswordMismatchError(false)
        await onSubmit({
            firstname: values.firstname?.trim() || undefined,
            lastname: values.lastname?.trim() || undefined,
            email: values.email.trim(),
            password: values.password,
            confirmPassword: isSignup ? values.confirmPassword : undefined,
        })
    }

    const heading = isSignup ? 'Create your account' : 'Welcome back'
    const buttonLabel = submitLabel || (isSignup ? 'Sign up' : 'Sign in')

    const sharedInputClasses = "w-full px-3 py-2 border rounded-md transition-all duration-200 focus:outline-none border-gray-300 dark:border-gray-600 focus:border-[#18416B] dark:focus:border-[#FAC133] focus:ring-[3px] focus:ring-[#18416B]/10 dark:focus:ring-[#FAC133]/10 bg-[var(--background)] text-[var(--text-primary)] placeholder:text-gray-400 dark:placeholder:text-gray-500"

    return (
        <div className="min-h-screen flex items-center justify-center px-4 transition-colors duration-150 bg-[var(--background)] text-[var(--text-primary)]">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-2xl p-8 border shadow-lg transition-all duration-150 bg-[var(--card-bg)] border-[var(--border-color)]"
            >
                <div className="mb-8">
                    <p className="text-md mb-1 transition-colors duration-150 text-[var(--accent)] dark:text-[var(--text-muted)]">Please enter details</p>
                    <h2 className="text-3xl font-semibold mb-2 transition-colors duration-150 text-[var(--primary)] dark:text-[var(--accent)]">{heading}</h2>
                    {errorMessage && (
                        <div className="mt-4 p-3 border rounded-md transition-colors duration-150 bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)]">
                            <p className="text-sm transition-colors duration-150 text-[rgb(220,38,38)]">{errorMessage}</p>
                        </div>
                    )}
                </div>

                {isSignup && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="firstname" className="block text-sm font-medium mb-1 transition-colors duration-150 text-[var(--text-secondary)]">First name</label>
                            <input id="firstname" name="firstname" type="text" placeholder="John" value={values.firstname || ''} onChange={handleChange} autoComplete="firstname" className={sharedInputClasses} />
                        </div>
                        <div>
                            <label htmlFor="lastname" className="block text-sm font-medium mb-1 transition-colors duration-150 text-[var(--text-secondary)]">Last name</label>
                            <input id="lastname" name="lastname" type="text" placeholder="Doe" value={values.lastname || ''} onChange={handleChange} autoComplete="lastname" className={sharedInputClasses} />
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium mb-1 transition-colors duration-150 text-[var(--text-secondary)]">Email</label>
                    <input id="email" name="email" type="email" placeholder="you@example.com" value={values.email} onChange={handleChange} autoComplete="email" required className={sharedInputClasses} />
                </div>

                <div className={`relative ${isSignup ? 'mb-4' : 'mb-2'}`}>
                    <label htmlFor="password" className="block text-sm font-medium mb-1 transition-colors duration-150 text-[var(--text-secondary)]">Password</label>
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={values.password}
                        onChange={handleChange}
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        required
                        className={sharedInputClasses}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-[35px] transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>

                    {isSignup && values.password.length > 0 && (
                        <p className={`mt-2 text-sm transition-colors duration-150 ${passwordStrength.valid ? 'text-green-600' : 'text-red-600'}`}>
                            {passwordStrength.message}
                        </p>
                    )}
                </div>

                {!isSignup && (
                    <div className="flex justify-end mb-4">
                        <Link href="/forgot-password" className="text-xs transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--primary)] dark:hover:text-[var(--accent)]">Forgot password?</Link>
                    </div>
                )}

                {isSignup && (
                    <div className="mb-6 relative">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1 transition-colors duration-150 text-[var(--text-secondary)]">Confirm password</label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={values.confirmPassword || ''}
                            onChange={handleChange}
                            autoComplete="new-password"
                            required
                            className={`${sharedInputClasses} ${passwordMismatchError ? '!border-red-500 focus:!border-red-500 focus:!ring-red-500/20' : ''}`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            className="absolute right-3 top-[35px] transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--primary)] dark:hover:text-[var(--accent)]"
                        >
                            {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                        {passwordMismatchError && <p className="mt-2 text-sm text-red-600 transition-colors duration-150">Passwords do not match</p>}
                    </div>
                )}

                <div className="mb-6">
                    <button
                        type="submit"
                        disabled={isSubmitting || (isSignup && !passwordStrength.valid)}
                        className="w-full bg-[var(--primary)] dark:bg-[var(--accent)] hover:brightness-110 text-white font-semibold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--primary)] dark:focus:ring-[var(--accent)]/40 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Submitting...</span>
                            </div>
                        ) : (
                            buttonLabel
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}