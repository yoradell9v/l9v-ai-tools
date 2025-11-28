import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, AlertTriangle } from 'lucide-react';

interface RefinementFormProps {
    analysisId: string;
    userId: string;
    serviceType?: string;
    onRefinementComplete: (refinedPackage: any) => void;
}

const RefinementForm: React.FC<RefinementFormProps> = ({
    analysisId,
    userId,
    serviceType,
    onRefinementComplete,
}) => {
    const [feedback, setFeedback] = useState('');
    const [refinementAreas, setRefinementAreas] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'clarification' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [clarificationQuestions, setClarificationQuestions] = useState<any[]>([]);
    const [changesSummary, setChangesSummary] = useState<any[]>([]);

    // Service-type-specific refinement areas
    const getAvailableAreas = () => {
        const commonAreas = [
            { value: 'service_type', label: 'Service Type' },
        ];

        if (serviceType === "Dedicated VA") {
            return [
                ...commonAreas,
                { value: 'role_title', label: 'Role Title' },
                { value: 'responsibilities', label: 'Responsibilities' },
                { value: 'kpis', label: 'KPIs' },
                { value: 'hours', label: 'Weekly Hours' },
                { value: 'tools', label: 'Tools Required' },
                { value: 'timeline', label: 'Timeline & Onboarding' },
                { value: 'outcomes', label: '90-Day Outcomes' },
                { value: 'skills', label: 'Skills Required' },
            ];
        } else if (serviceType === "Unicorn VA Service") {
            return [
                ...commonAreas,
                { value: 'role_title', label: 'Core VA Role Title' },
                { value: 'responsibilities', label: 'Core Responsibilities' },
                { value: 'kpis', label: 'KPIs' },
                { value: 'hours', label: 'Weekly Hours' },
                { value: 'tools', label: 'Tools Required' },
                { value: 'timeline', label: 'Timeline & Onboarding' },
                { value: 'team_support', label: 'Team Support Areas' },
                { value: 'outcomes', label: '90-Day Outcomes' },
                { value: 'skills', label: 'Skills Required' },
            ];
        } else if (serviceType === "Projects on Demand") {
            return [
                ...commonAreas,
                { value: 'projects', label: 'Projects' },
                { value: 'project_deliverables', label: 'Project Deliverables' },
                { value: 'project_timeline', label: 'Project Timeline' },
                { value: 'project_scope', label: 'Project Scope' },
                { value: 'project_skills', label: 'Required Skills' },
                { value: 'total_hours', label: 'Total Hours' },
                { value: 'project_sequence', label: 'Project Sequence' },
            ];
        }

        // Default fallback
        return [
            ...commonAreas,
            { value: 'role_title', label: 'Role/Project Title' },
            { value: 'responsibilities', label: 'Responsibilities' },
            { value: 'kpis', label: 'KPIs' },
            { value: 'hours', label: 'Hours' },
            { value: 'tools', label: 'Tools Required' },
            { value: 'timeline', label: 'Timeline' },
        ];
    };

    const availableAreas = getAvailableAreas();


    const toggleArea = (area: string) => {
        setRefinementAreas((prev) =>
            prev.includes(area)
                ? prev.filter((a) => a !== area)
                : [...prev, area]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!feedback.trim()) {
            setStatus('error');
            setMessage('Please provide feedback about what you\'d like to change.');
            return;
        }

        if (refinementAreas.length === 0) {
            setStatus('error');
            setMessage('Please select at least one area to refine.');
            return;
        }

        setIsSubmitting(true);
        setStatus('idle');
        setMessage('');

        try {
            const response = await fetch('/api/jd/refine', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysisId,
                    userId,
                    feedback,
                    refinement_areas: refinementAreas,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle validation errors
                if (data.feedback_type === 'spam' || data.feedback_type === 'irrelevant') {
                    setStatus('error');
                    setMessage(data.message || 'Invalid feedback provided');
                } else {
                    throw new Error(data.error || 'Refinement failed');
                }
                return;
            }

            // Handle clarification request
            if (data.status === 'clarification_needed') {
                setStatus('clarification');
                setMessage(data.message);
                setClarificationQuestions(data.questions || []);
                return;
            }

            // Success!
            setStatus('success');
            setMessage(`Analysis refined successfully! (Iteration ${data.iteration})`);
            setChangesSummary(data.changes_made || []);
            onRefinementComplete(data.refined_package);

            // Reset form after 2 seconds
            setTimeout(() => {
                setFeedback('');
                setRefinementAreas([]);
                setStatus('idle');
                setChangesSummary([]);
            }, 3000);
        } catch (error) {
            console.error('Refinement error:', error);
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Failed to refine analysis');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)] dark:text-[var(--accent)]">
                    What would you like to change?
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                    Be specific for best results. Select the areas you want to refine and provide detailed feedback.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Feedback Input */}
                <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-primary)] dark:text-zinc-900">
                        What would you like to change? *
                    </label>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder={
                            serviceType === "Projects on Demand"
                                ? "Example: The timeline for Project 1 seems too aggressive. We need 4-5 weeks instead of 3 weeks, and the deliverables should include user testing documentation."
                                : serviceType === "Unicorn VA Service"
                                    ? "Example: The weekly hours seem too low for the responsibilities listed. I think we need at least 35 hours per week, and we should add graphic design to the team support areas."
                                    : "Example: The weekly hours seem too low for the responsibilities listed. I think we need at least 35 hours per week, and the KPIs should include social media engagement metrics."
                        }
                        className="w-full h-32 px-4 py-3 rounded-lg border text-sm resize-none transition-all duration-200 focus:outline-none focus:ring-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/10 dark:focus:border-[var(--accent)] dark:focus:ring-[var(--accent)]/10"
                        disabled={isSubmitting}
                    />
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        💡 Tip: Be specific! {serviceType === "Projects on Demand"
                            ? "Instead of 'change the project', say 'Project 1 needs an additional deliverable for SEO audit documentation.'"
                            : "Instead of 'change the role', say 'The role title should emphasize content strategy, not just social media management.'"}
                    </p>
                </div>

                {/* Refinement Areas */}
                <div>
                    <label className="block text-sm font-medium mb-3 text-[var(--text-primary)]">
                        Which sections should we update? *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {availableAreas.map((area) => (
                            <button
                                key={area.value}
                                type="button"
                                onClick={() => toggleArea(area.value)}
                                disabled={isSubmitting}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border
    ${refinementAreas.includes(area.value)
                                        ? ' text-[var(--primary)] border-[var(--primary)] dark:text-[var(--accent)] dark:border-[var(--accent)]'
                                        : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)] dark:hover:bg-[var(--hover-bg-dark)]'
                                    }`}
                                data-selected={refinementAreas.includes(area.value) ? 'true' : 'false'}
                            >
                                <span className="block truncate">{area.label}</span>
                            </button>



                        ))}
                    </div>
                </div>

                {/* Status Messages */}
                {status === 'clarification' && (
                    <div className="rounded-lg border p-4 border-[var(--accent)] bg-[var(--accent)]/10">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium mb-3 text-amber-500">
                                    {message}
                                </p>
                                <ul className="space-y-2">
                                    {clarificationQuestions.map((q: any, idx: number) => (
                                        <li key={idx} className="text-sm text-[var(--text-primary)]">
                                            <span className="font-medium">• {q.question}</span>
                                            {q.why && (
                                                <p className="text-xs mt-1 ml-4 text-[var(--text-secondary)]">
                                                    {q.why}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="rounded-lg border p-4 border-red-500 bg-red-500/10">
                        <div className="flex items-start gap-3">
                            <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-red-500" />
                            <p className="text-sm text-red-500">{message}</p>
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="rounded-lg border p-4 border-green-500 bg-green-500/10">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-green-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium mb-3 text-green-500">
                                    {message}
                                </p>
                                {changesSummary.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-green-500">
                                            Changes made:
                                        </p>
                                        <ul className="space-y-1">
                                            {changesSummary.map((change: any, idx: number) => (
                                                <li key={idx} className="text-xs text-[var(--text-primary)]">
                                                    • <span className="font-medium">{change.section}:</span>{' '}
                                                    {change.change_description}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting || !feedback.trim() || refinementAreas.length === 0}
                    className={`w-full px-6 py-3 font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 
    ${isSubmitting || !feedback.trim() || refinementAreas.length === 0
                            ? 'bg-[var(--hover-bg)] text-whitecursor-not-allowed opacity-50'
                            : 'bg-[var(--primary)] dark:bg-[var(--accent)] text-white hover:brightness-110'
                        }`}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Refining Analysis...</span>
                        </>
                    ) : (
                        <>
                            <MessageCircle className="w-5 h-5" />
                            <span>Refine Analysis</span>
                        </>
                    )}
                </button>

            </form>
        </div>
    );
};

export default RefinementForm;