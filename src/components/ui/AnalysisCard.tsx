import React, { useMemo, useState } from 'react';
import {
    Activity,
    Briefcase,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Edit,
    FileText,
    HelpCircle,
    ShieldAlert,
    Sparkles,
    Target,
    Trash2,
} from 'lucide-react';
import Modal from './Modal';

export interface AnalysisResult {
    preview: {
        summary?: any;
        service_type?: string;
        service_reasoning?: string;
        service_confidence?: string;
        core_va_title?: string;
        core_va_hours?: number | string;
        primary_outcome?: string;
        key_risks?: string[];
        critical_questions?: string[];
        team_support_areas?: number;
    };
    full_package?: any;
    metadata?: any;
}

export interface SavedAnalysis {
    id: string;
    userId: string;
    title: string;
    intakeData: {
        tasks: [],
        tools: string;
        website: string;
        timezone: string;
        companyName: string;
        weeklyHours: string;
        businessGoal: string;
        clientFacing: string;
        dealBreakers: string;
        englishLevel: string;
        existingSOPs: string;
        outcome90Day: string;
        requirements: [];
        securityNeeds: string;
        managementStyle: string;
        niceToHaveSkills: string;
        reportingExpectations: string;
    };
    analysis: {
        preview: any;
        metadata: any;
        full_package: any;
    }
    isFinalized: boolean;
    finalizedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    refinementCount?: number;
}

interface AnalysisCardProps {
    savedAnalysis: SavedAnalysis;
    onDelete?: (id: string) => void;
    onEdit?: (analysis: SavedAnalysis) => void;
}

interface PrimaryRoleSnapshot {
    title: string;
    hours_per_week: number;
    responsibilities: string[];
    skills: string[];
    tools: string[];
    kpis: string[];
    purpose: string;
    core_outcomes: string[];
    client_facing?: boolean;
    communication_norms?: string;
    overlap_requirements?: string;
}

const AnalysisCard = ({ savedAnalysis, onDelete, onEdit }: AnalysisCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const { analysis } = savedAnalysis;
    console.log('Saved Analysis:', savedAnalysis);
    const preview = analysis?.preview ?? {};
    const fullPackage = analysis?.full_package ?? {};
    const summary =
        preview.summary ??
        fullPackage?.executive_summary?.what_you_told_us ??
        {};
    const serviceStructure = fullPackage?.service_structure ?? {};
    const implementationPlan = fullPackage?.implementation_plan ?? {};
    const riskManagement = fullPackage?.risk_management ?? {};
    const validationReport = fullPackage?.validation_report ?? {};
    const metadata = analysis?.metadata ?? {};

    const questionsForYou =
        fullPackage?.questions_for_you ??
        preview.critical_questions ??
        [];

    const keyRisks =
        preview.key_risks ??
        riskManagement?.risks?.map((r: any) => r.risk) ??
        [];

    const primaryRole = useMemo<PrimaryRoleSnapshot | null>(() => {
        if (!analysis) return null;
        const structureRole = serviceStructure?.core_va_role;
        const detailedJD =
            fullPackage?.detailed_specifications?.core_va_jd;

        if (!structureRole && !detailedJD) return null;

        const responsibilities: string[] = [];
        if (detailedJD?.responsibilities) {
            detailedJD.responsibilities.forEach((section: any) => {
                if (Array.isArray(section?.details)) {
                    section.details.forEach((detail: string) =>
                        responsibilities.push(detail)
                    );
                } else if (typeof section === 'string') {
                    responsibilities.push(section);
                }
            });
        } else if (Array.isArray(structureRole?.recurring_tasks)) {
            responsibilities.push(...structureRole.recurring_tasks);
        }

        return {
            title:
                structureRole?.title ??
                detailedJD?.title ??
                preview?.core_va_title ??
                'Core Role',
            hours_per_week:
                typeof structureRole?.hours_per_week === 'string'
                    ? parseInt(structureRole.hours_per_week, 10) || 0
                    : structureRole?.hours_per_week ??
                    (typeof detailedJD?.hours_per_week === 'string'
                        ? parseInt(detailedJD.hours_per_week, 10) || 0
                        : detailedJD?.hours_per_week ?? 0),
            responsibilities,
            skills: [
                ...(structureRole?.skill_requirements?.required ?? []),
                ...(structureRole?.skill_requirements?.nice_to_have ?? []),
            ],
            tools:
                detailedJD?.tools?.map((t: any) =>
                    typeof t === 'string' ? t : t.tool
                ) ?? [],
            kpis:
                detailedJD?.kpis?.map((k: any) =>
                    typeof k === 'string'
                        ? k
                        : `${k.metric}${k.target ? ` — ${k.target}` : ''}`
                ) ?? [],
            purpose:
                detailedJD?.mission_statement ??
                structureRole?.core_responsibility ??
                preview?.primary_outcome ??
                '',
            core_outcomes:
                detailedJD?.core_outcomes ??
                structureRole?.workflow_ownership ??
                [],
            client_facing:
                structureRole?.interaction_model?.client_facing ??
                undefined,
            communication_norms:
                structureRole?.interaction_model?.sync_needs ??
                detailedJD?.communication_structure?.weekly_sync ??
                undefined,
            overlap_requirements:
                structureRole?.interaction_model?.timezone_criticality ??
                detailedJD?.timezone_requirements?.overlap_needed ??
                undefined,
        };
    }, [analysis, fullPackage, preview, serviceStructure]);

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

    const formatList = (items?: string[], fallback?: string) => {
        if (!items || items.length === 0) {
            return fallback ? (
                <p className="text-sm text-[var(--text-secondary)]">{fallback}</p>
            ) : null;
        }

        return (
            <ul className="space-y-1">
                {items.map((item, idx) => (
                    <li
                        key={`${item}-${idx}`}
                        className="flex items-start gap-2 text-sm text-[var(--text-primary)]"
                    >
                        <span className="mt-1 text-[var(--primary)] dark:text-[var(--accent)]">
                            •
                        </span>
                        <span className="flex-1">{item}</span>
                    </li>
                ))}
            </ul>
        );
    };

    const handleDeleteConfirm = async () => {
        try {
            setIsDeleting(true);

            const response = await fetch(`/api/jd/analysis/${savedAnalysis.id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to delete');

            onDelete?.(savedAnalysis.id);
            setIsDeleteModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Failed to delete analysis. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadConfirm = async () => {
        try {
            setIsDownloading(true);

            const response = await fetch('/api/jd/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(savedAnalysis.analysis),
            });

            if (!response.ok) {
                throw new Error('Failed to download PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const contentDisposition =
                response.headers.get('Content-Disposition');
            const filename = contentDisposition
                ? contentDisposition
                    .split('filename=')[1]
                    ?.replace(/"/g, '') ||
                'job-description-analysis.pdf'
                : 'job-description-analysis.pdf';

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setIsDownloadModalOpen(false);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download job description. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const StatCard = ({
        icon: Icon,
        label,
        value,
    }: {
        icon: React.ElementType;
        label: string;
        value: React.ReactNode;
    }) => (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
            <div className="p-1.5 rounded-lg flex-shrink-0 bg-[var(--hover-bg)]">
                <Icon size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                    {label}
                </p>
                <p className="text-sm font-medium truncate text-[var(--text-primary)]">
                    {value}
                </p>
            </div>
        </div>
    );

    return (
        <div
            className="p-4 rounded-lg border transition-all duration-150 group hover:shadow-sm border border-[var(--border-color)] bg-[var(--card-bg)]"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div
                            className="p-2 rounded-lg flex-shrink-0 bg-[var(--accent)]/20"
                        >
                            <FileText
                                size={18}
                                className="text-amber-500"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3
                                    className="font-bold text-sm truncate text-[var(--text-primary)]"
                                    title={savedAnalysis.title}
                                >
                                    {savedAnalysis.title}
                                </h3>
                                {savedAnalysis.isFinalized && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-[var(--accent-bg)] text-[var(--accent)]"
                                    >
                                        Finalized
                                    </span>
                                )}
                                {savedAnalysis.refinementCount ? (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-[var(--hover-bg)] text-[var(--text-secondary)]"
                                    >
                                        {savedAnalysis.refinementCount} Refinement{savedAnalysis.refinementCount !== 1 ? 's' : ''}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    {new Date(savedAnalysis.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </span>
                                {savedAnalysis.finalizedAt && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(savedAnalysis.finalizedAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(savedAnalysis)}
                                className="p-1.5 rounded hover:bg-[var(--hover-bg)] transition-colors text-[var(--text-secondary)]"
                                title="Edit analysis"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="p-1.5 rounded hover:bg-[var(--hover-bg)] transition-colors text-[var(--text-secondary)]"
                            title="Download analysis as PDF"
                        >
                            <Download size={16} />
                        </button>
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-[rgb(239,68,68)]"
                            title="Delete analysis"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1.5 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 hover:bg-[var(--primary)]/20 dark:hover:bg-[var(--accent)]/30 transition-colors text-[var(--primary)] dark:text-[var(--accent)]"
                            title={isExpanded ? 'Hide details' : 'View details'}
                        >
                            {isExpanded ? (
                                <ChevronUp size={16} />
                            ) : (
                                <ChevronDown size={16} />
                            )}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="space-y-4 border-t pt-4 border-[var(--border-color)]">
                        <div className="grid gap-2 md:grid-cols-3">
                            <StatCard
                                icon={Sparkles}
                                label="Service Type"
                                value={preview.service_type ?? metadata?.service_type ?? 'Unspecified'}
                            />
                            <StatCard
                                icon={CheckCircle2}
                                label="Confidence"
                                value={
                                    preview.service_confidence ??
                                    metadata?.quality_scores?.overall_confidence ??
                                    '—'
                                }
                            />
                            <StatCard
                                icon={Target}
                                label="Hours/Week"
                                value={
                                    preview.core_va_hours ??
                                    primaryRole?.hours_per_week ??
                                    savedAnalysis.intakeData.weeklyHours ??
                                    '—'
                                }
                            />
                        </div>

                        {savedAnalysis.intakeData.companyName && (
                            <section className="rounded-lg border p-4 space-y-3 border border-[var(--border-color)] bg-[var(--hover-bg)]">
                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                    <Briefcase size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                    Intake Snapshot
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                            Company
                                        </p>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {savedAnalysis.intakeData.companyName}
                                        </p>
                                        {savedAnalysis.intakeData.website && (
                                            <a
                                                href={savedAnalysis.intakeData.website}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs underline text-[var(--primary)] dark:text-[var(--accent)]"
                                            >
                                                {savedAnalysis.intakeData.website}
                                            </a>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                            Goal
                                        </p>
                                        <p className="text-sm text-[var(--text-primary)]">
                                            {savedAnalysis.intakeData.businessGoal || '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                            Top Tasks
                                        </p>
                                        {formatList(
                                            savedAnalysis.intakeData.tasks?.slice(0, 3),
                                            'No tasks captured'
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                            Requirements
                                        </p>
                                        {formatList(
                                            savedAnalysis.intakeData.requirements?.filter(Boolean).slice(0, 3),
                                            'No requirements captured'
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {(summary?.company_stage ||
                            summary?.primary_bottleneck ||
                            summary?.workflow_analysis) && (
                                <section className="rounded-lg border p-4 space-y-3 border border-[var(--border-color)]">
                                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                        <FileText size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                        What You Told Us
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                                Company Stage
                                            </p>
                                            <p className="text-sm text-[var(--text-primary)]">
                                                {summary?.company_stage ?? '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                                Primary Bottleneck
                                            </p>
                                            <p className="text-sm text-[var(--text-primary)]">
                                                {summary?.primary_bottleneck ?? '—'}
                                            </p>
                                        </div>
                                    </div>
                                    {summary?.workflow_analysis && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                                Workflow Analysis
                                            </p>
                                            <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                                                {summary.workflow_analysis}
                                            </p>
                                        </div>
                                    )}
                                    {summary?.sop_status && (
                                        <div className="rounded-lg border p-3 space-y-2 border-[var(--border-color)]">
                                            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                                                Documentation
                                            </p>
                                            <p className="text-sm text-[var(--text-primary)]">
                                                {summary.sop_status.summary}
                                            </p>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                {summary.sop_status.pain_points?.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-medium mb-1 text-[rgb(239, 68, 68)]">
                                                            Pain Points
                                                        </p>
                                                        {formatList(summary.sop_status.pain_points)}
                                                    </div>
                                                )}
                                                {summary.sop_status.documentation_gaps?.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-medium mb-1 text-[rgb(245, 158, 11)]">
                                                            Gaps
                                                        </p>
                                                        {formatList(summary.sop_status.documentation_gaps)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                        <section className="rounded-lg border p-4 space-y-3 border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                <Sparkles size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                Recommendation Snapshot
                            </div>
                            {preview.primary_outcome && (
                                <div className="rounded-lg border p-3 flex gap-2 border-[var(--primary)] dark:border-[var(--accent)] ">
                                    <Target size={16} className="mt-0.5 flex-shrink-0 text-[var(--primary)] dark:text-[var(--accent)]" />
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1 text-[var(--primary)] dark:text-[var(--accent)] ">
                                            Primary Outcome
                                        </p>
                                        <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                                            {preview.primary_outcome}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {preview.service_reasoning && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                        Why this service
                                    </p>
                                    <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                                        {preview.service_reasoning}
                                    </p>
                                </div>
                            )}
                            {keyRisks.length > 0 && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                        Key Risks
                                    </p>
                                    {formatList(keyRisks)}
                                </div>
                            )}
                            {questionsForYou.length > 0 && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                        Open Questions
                                    </p>
                                    {formatList(
                                        questionsForYou.map((q: any) =>
                                            typeof q === 'string' ? q : q.question
                                        )
                                    )}
                                </div>
                            )}
                        </section>

                        {primaryRole && (
                            <section className="rounded-lg border p-4 space-y-3 border border-[var(--border-color)] bg-[var(--hover-bg)]">
                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                    <FileText size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                    Core Role Overview
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-0.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)]">
                                        {primaryRole.title}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)]">
                                        {primaryRole.hours_per_week || '—'} hrs/week
                                    </span>
                                    {primaryRole.client_facing !== undefined && (
                                        <span className="px-2 py-0.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)]">
                                            {primaryRole.client_facing ? 'Client facing' : 'Internal'}
                                        </span>
                                    )}
                                </div>
                                {primaryRole.purpose && (
                                    <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                                        {primaryRole.purpose}
                                    </p>
                                )}
                                {primaryRole.responsibilities.length > 0 && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                            Responsibilities
                                        </p>
                                        {formatList(primaryRole.responsibilities.slice(0, 5))}
                                    </div>
                                )}
                                {primaryRole.skills.length > 0 && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-2 text-[var(--text-secondary)]">
                                            Skills
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {primaryRole.skills.slice(0, 8).map((skill, idx) => (
                                                <span
                                                    key={`${skill}-${idx}`}
                                                    className="px-2 py-0.5 text-xs rounded border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-primary)]"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {serviceStructure && (
                            <section className="rounded-lg border p-4 space-y-3 border-[var(--border-color)] bg-[var(--hover-bg)]">
                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                    <Briefcase size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                    Service Structure
                                </div>
                                {serviceStructure.coordination_model && (
                                    <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                                        {serviceStructure.coordination_model}
                                    </p>
                                )}
                                {(serviceStructure.pros?.length ||
                                    serviceStructure.cons?.length) && (
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {serviceStructure.pros?.length > 0 && (
                                                <div className="rounded-lg border p-3 border-green-500 bg-green-500/10">
                                                    <p className="text-xs font-medium uppercase tracking-wide mb-1 text-green-600 dark:text-green-400">
                                                        Pros
                                                    </p>
                                                    {formatList(serviceStructure.pros)}
                                                </div>
                                            )}
                                            {serviceStructure.cons?.length > 0 && (
                                                <div className="rounded-lg border p-3 border-amber-500 bg-amber-500/10">
                                                    <p className="text-xs font-medium uppercase tracking-wide mb-1 text-amber-600 dark:text-amber-400">
                                                        Cons
                                                    </p>
                                                    {formatList(serviceStructure.cons)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                {serviceStructure.team_support_areas?.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            Team Support Areas
                                        </p>
                                        {serviceStructure.team_support_areas.map(
                                            (area: any, idx: number) => (
                                                <div
                                                    key={`${area.skill_category}-${idx}`}
                                                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2"
                                                >
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                        {area.skill_category} · {area.estimated_hours_monthly} hrs/mo
                                                    </p>
                                                    {area.use_cases && (
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                                Use Cases
                                                            </p>
                                                            {formatList(area.use_cases)}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        {implementationPlan && (
                            <section className="rounded-lg border p-4 space-y-3 border-[var(--border-color)] bg-[var(--hover-bg)]">
                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                    <Target size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                    Implementation Plan
                                </div>
                                {implementationPlan.immediate_next_steps?.length > 0 && (
                                    <div className="space-y-2">
                                        {implementationPlan.immediate_next_steps.map(
                                            (step: any, idx: number) => (
                                                <div
                                                    key={`${step.step}-${idx}`}
                                                    className="rounded-lg border p-3 border-[var(--border-color)]"
                                                >
                                                    <div className="flex items-center justify-between text-sm font-medium mb-1 text-[var(--text-primary)]">
                                                        <span>{step.step}</span>
                                                        <span className="text-xs text-[var(--text-secondary)]">
                                                            {step.owner}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs mb-1 text-[var(--text-secondary)]">
                                                        Timeline: {step.timeline}
                                                    </p>
                                                    <p className="text-sm mt-2 text-[var(--text-primary)]">
                                                        {step.output}
                                                    </p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                                {/* {implementationPlan.onboarding_roadmap && (
                                    <div className="space-y-3">
                                        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            Onboarding Roadmap
                                        </p>
                                        {Object.entries(implementationPlan.onboarding_roadmap).map(
                                            ([week, roles]: [string, any]) => (
                                                <div
                                                    key={week}
                                                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2"
                                                >
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                        {week.replace(/_/g, ' ').toUpperCase()}
                                                    </p>
                                                    {Object.entries(roles).map(
                                                        ([roleName, tasks]: [string, string[]]) => (
                                                            <div key={roleName} className="space-y-1">
                                                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                                                    {roleName}
                                                                </p>
                                                                {formatList(tasks)}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )} */}
                            </section>
                        )}

                        {(riskManagement?.risks?.length ||
                            riskManagement?.assumptions?.length ||
                            riskManagement?.monitoring_plan) && (
                                <section className="rounded-lg border p-4 space-y-3 border-[var(--border-color)] bg-[var(--hover-bg)]">
                                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                        <ShieldAlert size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                        Risk & Monitoring
                                    </div>
                                    {riskManagement.risks?.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                                Risks
                                            </p>
                                            {formatList(
                                                riskManagement.risks.map(
                                                    (risk: any) =>
                                                        `${risk.risk} · Impact: ${risk.impact} · Mitigation: ${risk.mitigation}`
                                                )
                                            )}
                                        </div>
                                    )}
                                    {riskManagement.assumptions?.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                                Assumptions
                                            </p>
                                            {formatList(
                                                riskManagement.assumptions.map(
                                                    (assumption: any) =>
                                                        `${assumption.assumption} (Criticality: ${assumption.criticality})`
                                                )
                                            )}
                                        </div>
                                    )}
                                    {riskManagement.monitoring_plan?.quality_checks?.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                                                Quality Checks
                                            </p>
                                            <div className="space-y-2">
                                                {riskManagement.monitoring_plan.quality_checks.map(
                                                    (check: any, idx: number) => (
                                                        <div
                                                            key={`${check.checkpoint}-${idx}`}
                                                            className="rounded-lg border p-3 border-[var(--border-color)]"
                                                        >
                                                            <p className="text-sm font-medium mb-1 text-[var(--text-primary)]">
                                                                {check.checkpoint}
                                                            </p>
                                                            {formatList(check.assess)}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                        {validationReport?.consistency_checks && (
                            <section className="rounded-lg border p-4 space-y-3 border-[var(--border-color)] bg-[var(--hover-bg)]">
                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                    <HelpCircle size={16} className="text-[var(--primary)] dark:text-[var(--accent)]" />
                                    Validation Snapshot
                                </div>
                                {validationReport.consistency_checks.hours_balance?.issues?.length >
                                    0 && (
                                        <div className="rounded-lg border p-3 border-amber-500 bg-amber-500/10">
                                            <p className="text-xs font-medium uppercase tracking-wide mb-1 text-amber-600 dark:text-amber-400">
                                                Hours Balance
                                            </p>
                                            {formatList(
                                                validationReport.consistency_checks.hours_balance.issues
                                            )}
                                        </div>
                                    )}
                                {validationReport.consistency_checks.tool_alignment?.recommendations?.length >
                                    0 && (
                                        <div className="rounded-lg border p-3 border-blue-500 bg-blue-500/10">
                                            <p className="text-xs font-medium uppercase tracking-wide mb-1 text-blue-600 dark:text-blue-400">
                                                Tool Alignment
                                            </p>
                                            {formatList(
                                                validationReport.consistency_checks.tool_alignment.recommendations
                                            )}
                                        </div>
                                    )}
                            </section>
                        )}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                onConfirm={handleDownloadConfirm}
                title="Download Analysis"
                message="Download this full analysis as a PDF?"
                confirmVariant="primary"
                confirmText={
                    isDownloading ? (
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
                            <span>Downloading...</span>
                        </div>
                    ) : (
                        'Download'
                    )
                }
                cancelText="Cancel"
            />

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Analysis"
                message="This action cannot be undone. Delete this analysis?"
                confirmVariant="danger"
                confirmText={
                    isDeleting ? (
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
                            <span>Deleting...</span>
                        </div>
                    ) : (
                        'Delete'
                    )
                }
                cancelText="Cancel"
            />
        </div>
    );
};

export default AnalysisCard;