"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid"
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
import { ScrollArea } from "@/components/ui/scroll-area"

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

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 pt-12 pb-6 sm:pt-16 sm:pb-8 transition-colors duration-150 text-[var(--text-primary)]">
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
            <Card className="w-full max-w-md max-h-[90vh] flex flex-col">
                <CardHeader className="pt-4 pb-2 flex-shrink-0">
                    <CardTitle className="text-4xl font-semibold text-center">{heading}</CardTitle>
                    <CardDescription className="text-center text-md">Sign in to access Level 9 OS™</CardDescription>
                    {errorMessage && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    )}
                </CardHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <CardContent className="flex-1 min-h-0">
                        <ScrollArea className="h-full w-full">
                            {/* Padding prevents focus rings/borders from being clipped by the ScrollArea overflow */}
                            <div className="p-1">
                                <div className="flex flex-col gap-6 pr-4">
                                    {isSignup && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="firstname" className="text-base">First name</Label>
                                                <Input id="firstname" name="firstname" type="text" placeholder="John" value={values.firstname || ''} onChange={handleChange} autoComplete="firstname" className="focus-visible:border-[var(--primary-dark)] focus-visible:ring-[var(--primary-dark)]" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="lastname" className="text-base">Last name</Label>
                                                <Input id="lastname" name="lastname" type="text" placeholder="Doe" value={values.lastname || ''} onChange={handleChange} autoComplete="lastname" className="focus-visible:border-[var(--primary-dark)] focus-visible:ring-[var(--primary-dark)]" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label htmlFor="email" className="text-base">Email</Label>
                                        <Input id="email" name="email" type="email" placeholder="you@example.com" value={values.email} onChange={handleChange} autoComplete="email" required />
                                    </div>

                                    <div className="grid gap-2">
                                        <div className="flex items-center">
                                            <Label htmlFor="password" className="text-base">Password</Label>
                                            {!isSignup && (
                                                <Link href="/forgot-password" className="ml-auto inline-block text-base underline-offset-4 hover:underline transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--primary)] dark:hover:text-[var(--accent)]">
                                                    Forgot password?
                                                </Link>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                name="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={values.password}
                                                onChange={handleChange}
                                                autoComplete={isSignup ? 'new-password' : 'current-password'}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--accent)]"
                                            >
                                                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        {isSignup && values.password.length > 0 && (
                                            <p className={`text-sm transition-colors duration-150 ${passwordStrength.valid ? 'text-green-600' : 'text-red-600'}`}>
                                                {passwordStrength.message}
                                            </p>
                                        )}
                                    </div>

                                    {isSignup && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="confirmPassword" className="text-base">Confirm password</Label>
                                            <div className="relative">
                                                <Input
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    value={values.confirmPassword || ''}
                                                    onChange={handleChange}
                                                    autoComplete="new-password"
                                                    required
                                                    className={passwordMismatchError ? 'border-red-500 focus-visible:ring-red-500/20 focus-visible:ring-2' : undefined}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 text-[var(--text-muted)] hover:text-[var(--primary)] dark:hover:text-[var(--accent)]"
                                                >
                                                    {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                                </button>
                                            </div>
                                            {passwordMismatchError && <p className="text-sm text-red-600 transition-colors duration-150">Passwords do not match</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="pt-6 pb-4 flex-shrink-0">
                        <Button
                            type="submit"
                            disabled={isSubmitting || (isSignup && !passwordStrength.valid)}
                            className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white text-base font-bold py-2 h-auto"
                            size="lg"
                        >
                            <div className="flex items-center justify-center gap-2">
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    buttonLabel
                                )}
                            </div>
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}