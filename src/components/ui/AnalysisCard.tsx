import React, { useMemo, useState } from 'react';
import {
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
    Loader2,
    MoreVertical,
} from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from './accordion';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './dropdown-menu';

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
        businessName?: string;
        companyName?: string; // Legacy field name for backward compatibility
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
    createdBy?: {
        id: string;
        firstname: string;
        lastname: string;
        email: string;
    };
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
                <p className="text-sm text-muted-foreground">{fallback}</p>
            ) : null;
        }

        return (
            <ul className="space-y-1">
                {items.map((item, idx) => (
                    <li
                        key={`${item}-${idx}`}
                        className="flex items-start gap-2 text-sm"
                    >
                        <span className="mt-1 text-primary">
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
        <div className="p-3">
            <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg flex-shrink-0 bg-muted">
                    <Icon size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {label}
                    </p>
                    <p className="text-sm font-medium truncate">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <Card className="transition-all duration-150 group hover:shadow-sm p-2 w-full max-w-full overflow-hidden">
                <CardContent className="p-2">
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-1 sm:gap-3">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0 bg-amber-500/20">
                                    <FileText size={16} className="text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <h3
                                            className="font-bold text-sm truncate"
                                            title={savedAnalysis.title}
                                        >
                                            {savedAnalysis.title}
                                        </h3>
                                        {savedAnalysis.isFinalized && (
                                            <Badge variant="default">
                                                Finalized
                                            </Badge>
                                        )}
                                        {savedAnalysis.refinementCount ? (
                                            <Badge variant="secondary">
                                                {savedAnalysis.refinementCount} Refinement{savedAnalysis.refinementCount !== 1 ? 's' : ''}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(savedAnalysis.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                        {savedAnalysis.createdBy && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    Created by {savedAnalysis.createdBy.firstname} {savedAnalysis.createdBy.lastname}
                                                </span>
                                            </>
                                        )}
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
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Analysis actions"
                                        >
                                            <MoreVertical size={16} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        {onEdit && (
                                            <DropdownMenuItem
                                                onClick={() => onEdit(savedAnalysis)}
                                            >
                                                <Edit className="h-4 w-4 mr-2" />
                                                Refine Role
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            onClick={() => setIsDownloadModalOpen(true)}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Download PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setIsDeleteModalOpen(true)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    title={isExpanded ? 'Hide details' : 'View details'}
                                    className="bg-primary/10 hover:bg-primary/20 text-primary"
                                >
                                    {isExpanded ? (
                                        <ChevronUp size={16} />
                                    ) : (
                                        <ChevronDown size={16} />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="space-y-3 border-t pt-4">
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

                                <Accordion type="multiple" className="w-full">
                                    {(savedAnalysis.intakeData.businessName || savedAnalysis.intakeData.companyName) && (
                                        <AccordionItem value="intake">
                                            <AccordionTrigger className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase size={16} className="text-primary" />
                                                    Intake Snapshot
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3 pt-2">
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                Company
                                                            </p>
                                                            <p className="text-sm font-medium">
                                                                {savedAnalysis.intakeData.businessName || savedAnalysis.intakeData.companyName}
                                                            </p>
                                                            {savedAnalysis.intakeData.website && (
                                                                <a
                                                                    href={savedAnalysis.intakeData.website}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-xs underline text-primary break-all"
                                                                >
                                                                    {savedAnalysis.intakeData.website}
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                Goal
                                                            </p>
                                                            <p className="text-sm">
                                                                {savedAnalysis.intakeData.businessGoal || '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                Top Tasks
                                                            </p>
                                                            {formatList(
                                                                savedAnalysis.intakeData.tasks?.slice(0, 3),
                                                                'No tasks captured'
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                Requirements
                                                            </p>
                                                            {formatList(
                                                                savedAnalysis.intakeData.requirements?.filter(Boolean).slice(0, 3),
                                                                'No requirements captured'
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}

                                    {(summary?.company_stage ||
                                        summary?.primary_bottleneck ||
                                        summary?.workflow_analysis) && (
                                            <AccordionItem value="summary">
                                                <AccordionTrigger className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={16} className="text-primary" />
                                                        What You Told Us
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-3 pt-2">
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <div>
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                    Company Stage
                                                                </p>
                                                                <p className="text-sm">
                                                                    {summary?.company_stage ?? '—'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                    Primary Bottleneck
                                                                </p>
                                                                <p className="text-sm">
                                                                    {summary?.primary_bottleneck ?? '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {summary?.workflow_analysis && (
                                                            <div>
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                    Workflow Analysis
                                                                </p>
                                                                <p className="text-sm leading-relaxed">
                                                                    {summary.workflow_analysis}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {summary?.sop_status && (
                                                            <Card className="p-3">
                                                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                                                                    Documentation
                                                                </p>
                                                                <p className="text-sm mb-3">
                                                                    {summary.sop_status.summary}
                                                                </p>
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    {summary.sop_status.pain_points?.length > 0 && (
                                                                        <div>
                                                                            <p className="text-xs font-medium mb-1 text-destructive">
                                                                                Pain Points
                                                                            </p>
                                                                            {formatList(summary.sop_status.pain_points)}
                                                                        </div>
                                                                    )}
                                                                    {summary.sop_status.documentation_gaps?.length > 0 && (
                                                                        <div>
                                                                            <p className="text-xs font-medium mb-1 text-amber-600 dark:text-amber-400">
                                                                                Gaps
                                                                            </p>
                                                                            {formatList(summary.sop_status.documentation_gaps)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Card>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                    <AccordionItem value="recommendation">
                                        <AccordionTrigger className="text-sm">
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={16} className="text-primary" />
                                                Recommendation Snapshot
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-3 pt-2">
                                                {preview.primary_outcome && (
                                                    <Card className="p-3 border-primary">
                                                        <div className="flex gap-2">
                                                            <Target size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                                                            <div>
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-primary">
                                                                    Primary Outcome
                                                                </p>
                                                                <p className="text-sm leading-relaxed">
                                                                    {preview.primary_outcome}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                )}
                                                {preview.service_reasoning && (
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                            Why this service
                                                        </p>
                                                        <p className="text-sm leading-relaxed">
                                                            {preview.service_reasoning}
                                                        </p>
                                                    </div>
                                                )}
                                                {keyRisks.length > 0 && (
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                            Key Risks
                                                        </p>
                                                        {formatList(keyRisks)}
                                                    </div>
                                                )}
                                                {questionsForYou.length > 0 && (
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                            Open Questions
                                                        </p>
                                                        {formatList(
                                                            questionsForYou.map((q: any) =>
                                                                typeof q === 'string' ? q : q.question
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>


                                    {primaryRole && (
                                        <AccordionItem value="role">
                                            <AccordionTrigger className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-primary" />
                                                    Core Role Overview
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3 pt-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline">{primaryRole.title}</Badge>
                                                        <Badge variant="outline">{primaryRole.hours_per_week || '—'} hrs/week</Badge>
                                                        {primaryRole.client_facing !== undefined && (
                                                            <Badge variant="outline">
                                                                {primaryRole.client_facing ? 'Client facing' : 'Internal'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {primaryRole.purpose && (
                                                        <p className="text-sm leading-relaxed">
                                                            {primaryRole.purpose}
                                                        </p>
                                                    )}
                                                    {primaryRole.responsibilities.length > 0 && (
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                Responsibilities
                                                            </p>
                                                            {formatList(primaryRole.responsibilities.slice(0, 5))}
                                                        </div>
                                                    )}
                                                    {primaryRole.skills.length > 0 && (
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide mb-2 text-muted-foreground">
                                                                Skills
                                                            </p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {primaryRole.skills.slice(0, 8).map((skill, idx) => (
                                                                    <Badge key={`${skill}-${idx}`} variant="secondary">
                                                                        {skill}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}

                                    {serviceStructure && (
                                        <AccordionItem value="service">
                                            <AccordionTrigger className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase size={16} className="text-primary" />
                                                    Service Structure
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3 pt-2">
                                                    {serviceStructure.coordination_model && (
                                                        <p className="text-sm leading-relaxed">
                                                            {serviceStructure.coordination_model}
                                                        </p>
                                                    )}
                                                    {(serviceStructure.pros?.length ||
                                                        serviceStructure.cons?.length) && (
                                                            <div className="grid gap-2 md:grid-cols-2">
                                                                {serviceStructure.pros?.length > 0 && (
                                                                    <Card className="p-3 border-green-500 bg-green-500/10">
                                                                        <p className="text-xs font-medium uppercase tracking-wide mb-1 text-green-600 dark:text-green-400">
                                                                            Pros
                                                                        </p>
                                                                        {formatList(serviceStructure.pros)}
                                                                    </Card>
                                                                )}
                                                                {serviceStructure.cons?.length > 0 && (
                                                                    <Card className="p-3 border-amber-500 bg-amber-500/10">
                                                                        <p className="text-xs font-medium uppercase tracking-wide mb-1 text-amber-600 dark:text-amber-400">
                                                                            Cons
                                                                        </p>
                                                                        {formatList(serviceStructure.cons)}
                                                                    </Card>
                                                                )}
                                                            </div>
                                                        )}
                                                    {serviceStructure.team_support_areas?.length > 0 && (
                                                        <div className="space-y-3">
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                                Team Support Areas
                                                            </p>
                                                            {serviceStructure.team_support_areas.map(
                                                                (area: any, idx: number) => (
                                                                    <Card
                                                                        key={`${area.skill_category}-${idx}`}
                                                                        className="p-4"
                                                                    >
                                                                        <p className="text-sm font-semibold mb-2">
                                                                            {area.skill_category} · {area.estimated_hours_monthly} hrs/mo
                                                                        </p>
                                                                        {area.use_cases && (
                                                                            <div>
                                                                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                                                                    Use Cases
                                                                                </p>
                                                                                {formatList(area.use_cases)}
                                                                            </div>
                                                                        )}
                                                                    </Card>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}

                                    {implementationPlan && (
                                        <AccordionItem value="implementation">
                                            <AccordionTrigger className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Target size={16} className="text-primary" />
                                                    Implementation Plan
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-2 pt-2">
                                                    {implementationPlan.immediate_next_steps?.length > 0 && (
                                                        <Accordion type="multiple" className="w-full">
                                                            {implementationPlan.immediate_next_steps.map(
                                                                (step: any, idx: number) => (
                                                                    <AccordionItem key={`${step.step}-${idx}`} value={`step-${idx}`} className="border-b">
                                                                        <AccordionTrigger className="text-xs py-2">
                                                                            <div className="flex items-center justify-between w-full pr-4">
                                                                                <span className="font-medium">{step.step}</span>
                                                                                <Badge variant="secondary" className="ml-2">{step.owner}</Badge>
                                                                            </div>
                                                                        </AccordionTrigger>
                                                                        <AccordionContent className="pb-2">
                                                                            <div className="space-y-1">
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    Timeline: {step.timeline}
                                                                                </p>
                                                                                <p className="text-sm">
                                                                                    {step.output}
                                                                                </p>
                                                                            </div>
                                                                        </AccordionContent>
                                                                    </AccordionItem>
                                                                )
                                                            )}
                                                        </Accordion>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}

                                    {(riskManagement?.risks?.length ||
                                        riskManagement?.assumptions?.length ||
                                        riskManagement?.monitoring_plan) && (
                                            <AccordionItem value="risk">
                                                <AccordionTrigger className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldAlert size={16} className="text-primary" />
                                                        Risk & Monitoring
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-3 pt-2">
                                                        {riskManagement.risks?.length > 0 && (
                                                            <div>
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
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
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
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
                                                                <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                                                                    Quality Checks
                                                                </p>
                                                                <div className="space-y-2">
                                                                    {riskManagement.monitoring_plan.quality_checks.map(
                                                                        (check: any, idx: number) => (
                                                                            <div key={`${check.checkpoint}-${idx}`} className="p-3">
                                                                                <p className="text-sm font-medium mb-1">
                                                                                    {check.checkpoint}
                                                                                </p>
                                                                                {formatList(check.assess)}
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}

                                    {validationReport?.consistency_checks && (
                                        <AccordionItem value="validation">
                                            <AccordionTrigger className="text-sm">
                                                <div className="flex items-center gap-2">
                                                    <HelpCircle size={16} className="text-primary" />
                                                    Validation Snapshot
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3 pt-2">
                                                    {validationReport.consistency_checks.hours_balance?.issues?.length >
                                                        0 && (
                                                            <Card className="p-3 border-amber-500 bg-amber-500/10">
                                                                <p className="text-xs font-medium uppercase tracking-wide mb-1 text-amber-600 dark:text-amber-400">
                                                                    Hours Balance
                                                                </p>
                                                                {formatList(
                                                                    validationReport.consistency_checks.hours_balance.issues
                                                                )}
                                                            </Card>
                                                        )}
                                                    {validationReport.consistency_checks.tool_alignment?.recommendations?.length >
                                                        0 && (
                                                            <div className="p-3 border border-blue-500 bg-blue-500/10 rounded-md">
                                                                <p className="text-xs font-medium uppercase tracking-wide mb-1 text-blue-600 dark:text-blue-400">
                                                                    Tool Alignment
                                                                </p>
                                                                {formatList(
                                                                    validationReport.consistency_checks.tool_alignment.recommendations
                                                                )}
                                                            </div>
                                                        )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}
                                </Accordion>
                            </div>
                        )}

                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={isDownloadModalOpen} onOpenChange={setIsDownloadModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Download Analysis</AlertDialogTitle>
                        <AlertDialogDescription>
                            Download this full analysis as a PDF?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDownloadConfirm}
                            disabled={isDownloading}
                        >
                            {isDownloading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Downloading...</span>
                                </>
                            ) : (
                                'Download'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. Delete this analysis?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                'Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default AnalysisCard;