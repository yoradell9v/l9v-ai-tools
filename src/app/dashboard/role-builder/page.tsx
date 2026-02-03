"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaseIntakeForm, { BaseIntakeFormRef } from "@/components/forms/BaseIntakeForm";
import { jdFormConfig, getJDFormConfigWithKB } from "@/components/forms/configs/jdFormConfig";
import { ToolChatDialog } from "@/components/chat/ToolChatDialog";
import { useUser } from "@/context/UserContext";
import { OrganizationKnowledgeBase } from "@/lib/knowledge-base/organization-knowledge-base";
import { mapOrgKBToJDForm, resolveJDFormWithOrgKB, resolvedJDFormToIntakePayload } from "@/lib/jd-analysis/field-mapping";
import { Briefcase, Sparkles, CheckCircle2, ShieldAlert, AlertTriangle, TrendingUp, Target, AlertCircle, Network, FileText, Plus, MoreVertical, Edit, Download, Save, History, Loader2, Clock, Calendar, Zap, ArrowRight, X, Check, AlertCircle as AlertCircleIcon, ChevronDown, Copy } from "lucide-react";
import { SparklesIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import { getConfidenceValue, getConfidenceColor } from '@/utils/confidence';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserIcon, ClockIcon, ChartPieIcon } from "@heroicons/react/24/outline";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { isRateLimitError, parseRateLimitError, getRateLimitErrorMessage } from "@/lib/rate-limiting/rate-limit-client";
import { toast } from "sonner";
import { ToolChat } from "@/components/chat/ToolChat";
import { getToolChatConfig } from "@/lib/tool-chat/registry";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils/copy-to-clipboard";

interface AnalysisResult {
    preview: {
        summary: {
            company_stage: string;
            outcome_90d: string;
            primary_bottleneck: string;
            role_recommendation: string;
            sop_status: {
                has_sops: boolean;
                pain_points: string[];
                documentation_gaps: string[];
                summary: string;
            };
            workflow_analysis: string;
        };
        primary_outcome: string;
        service_type: string;
        service_confidence: string;
        service_reasoning: string;
        confidence: string;
        key_risks: string[];
        critical_questions: string[];
        role_title?: string;
        hours_per_week?: number;
        core_va_title?: string;
        core_va_hours?: string | number;
        team_support_areas?: number;
        project_count?: number;
        total_hours?: string | number;
        estimated_timeline?: string;
    };
    full_package: {
        service_structure: {
            service_type: string;
            dedicated_va_role?: {
                title: string;
                craft_family?: string;
                hours_per_week: string | number;
                core_responsibility: string;
                recurring_tasks?: string[];
                task_allocation?: {
                    from_intake?: string[];
                    estimated_breakdown?: string;
                };
                skill_requirements: {
                    required: string[];
                    nice_to_have: string[];
                    growth_areas?: string[];
                };
                workflow_ownership: string[];
                interaction_model?: {
                    reports_to?: string;
                    collaborates_with?: string[];
                    client_facing?: boolean;
                    sync_needs?: string;
                    timezone_criticality?: string;
                };
            };
            core_va_role?: {
                title: string;
                craft_family?: string;
                hours_per_week: string | number;
                core_responsibility: string;
                recurring_tasks: string[];
                skill_requirements: {
                    required: string[];
                    nice_to_have: string[];
                };
                workflow_ownership: string[];
                interaction_model?: {
                    reports_to?: string;
                    collaborates_with?: string[];
                    client_facing?: boolean;
                    sync_needs?: string;
                    timezone_criticality?: string;
                };
            };
            team_support_areas?: any;
            coordination_model?: string;
            projects?: Array<{
                project_name: string;
                category?: string;
                objective: string;
                deliverables: string[] | Array<{
                    item: string;
                    description?: string;
                    acceptance_criteria?: string[];
                    file_format?: string;
                }>;
                estimated_hours: string | number;
                timeline: string;
                skills_required: string[];
                dependencies?: string[];
                success_criteria?: string;
            }>;
            recommended_sequence?: string;
            total_investment?: {
                hours: string | number;
                timeline: string;
            };
            pros: string[];
            cons: string[];
            scaling_path: string;
            alternative_structure?: any;
            alternative_consideration?: any;
        }
        executive_summary: {
            what_you_told_us: {
                company_stage: string;
                outcome_90d: string;
                primary_bottleneck: string;
                role_recommendation: string;
                sop_status: {
                    has_sops: boolean;
                    pain_points: string[];
                    documentation_gaps: string[];
                    summary: string;
                };
                workflow_analysis: string;
            };
            service_recommendation: {
                type: string;
                confidence: string;
                reasoning: string;
                why_not_other: string;
            }
            key_insights: string[];
        };
        detailed_specifications: {
            title?: string;
            hours_per_week?: string | number;
            mission_statement?: string;
            primary_outcome?: string;
            core_outcomes?: string[];
            responsibilities?: any[];
            skills_required?: {
                technical: any[];
                soft: any[];
                domain: string[];
            };
            tools?: any[];
            kpis?: any[];
            personality_fit?: any[];
            sample_week?: any;
            communication_structure?: any;
            timezone_requirements?: any;
            success_indicators?: any;
            core_va_jd?: {
                title: string;
                hours_per_week: string;
                mission_statement: string;
                primary_outcome: string;
                core_outcomes: string[];
                responsibilities: any[];
                skills_required: {
                    technical: string[];
                    soft: string[];
                    domain: string[];
                };
                tools: any[];
                kpis: any[];
                personality_fit: any[];
                sample_week: any;
                communication_structure: any;
                timezone_requirements?: any;
                success_indicators: any;
            };
            team_support_specs?: any;
            projects?: Array<{
                project_name: string;
                overview?: string;
                objectives?: string[];
                deliverables: Array<{
                    item: string;
                    description?: string;
                    acceptance_criteria?: string[];
                    file_format?: string;
                }>;
                scope?: {
                    in_scope?: string[];
                    out_of_scope?: string[];
                    assumptions?: string[];
                };
                timeline?: {
                    estimated_hours: string | number;
                    duration: string;
                    milestones?: Array<{
                        milestone: string;
                        timing: string;
                        deliverable: string;
                    }>;
                };
                requirements?: {
                    from_client?: string[];
                    skills_needed?: string[];
                    tools_needed?: string[];
                };
                success_metrics?: string[];
                risks?: Array<{
                    risk: string;
                    mitigation: string;
                }>;
            }>;
        };
        role_architecture: {
            recommended_structure: {
                scenario_name: string;
                service_type: string;
                total_cost_estimate: string;
                roles: Array<{
                    title: string;
                    craft_family: string;
                    hours_per_week: number;
                    percentage_of_outcome: string;
                    core_responsibility: string;
                    task_allocation: {
                        from_intake: string[];
                        from_discovery: string[];
                        estimated_breakdown: string;
                    };
                    skill_fit: {
                        required_skills: string[];
                        nice_to_have: string[];
                        red_flags: string[];
                    };
                    workflow_ownership: string[];
                    interaction_model: {
                        reports_to: string;
                        collaborates_with: string[];
                        client_facing: boolean;
                        sync_needs: string;
                        timezone_criticality: string;
                    };
                }>;
                pros: string[];
                cons: string[];
                best_for: string;
                scaling_path: string;
            };
            alternative_scenarios: any[];
            comparison_table: Array<{
                option: string;
                service: string;
                roles: string;
                total_hours: number;
                cost_range: string;
                best_for: string;
                key_tradeoff: string;
            }>;
        };
        implementation_plan: {
            immediate_next_steps: Array<{
                step: string;
                owner: string;
                timeline: string;
                output: string;
            }>;
            onboarding_roadmap: {
                week_1: string[] | Record<string, any>;
                week_2: string[] | Record<string, any>;
                week_3_4: string[] | Record<string, any>;
            };
            success_milestones: {
                week_2: string;
                week_4: string;
                week_8: string;
                week_12: string;
            };
        };
        risk_management: {
            risks: Array<{
                risk: string;
                category: string;
                severity: string;
                likelihood: string;
                impact: string;
                mitigation: string;
                early_warning_signs: string[];
            }>;
            assumptions: Array<{
                assumption: string;
                criticality: string;
                validation_method: string;
                if_wrong: string;
            }>;
            red_flags: Array<{
                flag: string;
                evidence: string;
                recommendation: string;
            }>;
            monitoring_plan: {
                high_priority_risks: Array<{
                    risk: string;
                    check_in: string;
                    watch_for: string[];
                }>;
                quality_checks: Array<{
                    checkpoint: string;
                    assess: string[];
                }>;
                adjustment_triggers: Array<{
                    trigger: string;
                    action: string;
                }>;
            };
        };
        questions_for_you: Array<{
            question: string;
            why_it_matters: string;
            assumption_if_unanswered: string;
        }>;
        validation_report: {
            consistency_checks: {
                hours_balance: {
                    stated_hours: number;
                    allocated_hours: number;
                    sample_week_hours: number;
                    issues: any[];
                };
                tool_alignment: {
                    tools_in_intake: string[];
                    tools_in_jd: string[];
                    missing_from_jd: string[];
                    not_in_intake: string[];
                    recommendations: string[];
                };
                outcome_mapping: {
                    client_goal: string;
                    role_outcomes: string[];
                    coverage: string;
                    gaps: any[];
                };
                kpi_feasibility: Array<{
                    kpi: string;
                    measurable: boolean;
                    instrumentation_exists: boolean;
                    issue: string;
                    recommendation: string;
                }>;
            };
            quality_scores: {
                jd_specificity: number;
                role_clarity: number;
                outcome_alignment: number;
                personality_depth: number;
                kpi_quality: number;
                overall_confidence: string;
                areas_to_strengthen: string[];
            };
            areas_needing_clarification: string[];
        };
        appendix: {
            discovery_insights: {
                business_context: {
                    company_stage: string;
                    primary_bottleneck: string;
                    hidden_complexity: string;
                    growth_indicators: string;
                };
                task_analysis: {
                    task_clusters: Array<{
                        cluster_name: string;
                        tasks: string[];
                        workflow_type: string;
                        interdependencies: string[];
                        complexity_score: number;
                        estimated_hours_weekly: number;
                    }>;
                    skill_requirements: {
                        technical: string[];
                        soft: string[];
                        domain: string[];
                    };
                    implicit_needs: string[];
                };
                sop_insights: {
                    process_complexity: string;
                    documented_workflows: any[];
                    documentation_gaps: string[];
                    handoff_points: string[];
                    pain_points: string[];
                    tools_mentioned: any[];
                    implicit_requirements: string[];
                };
                context_gaps: Array<{
                    question: string;
                    why_it_matters: string;
                    assumption_if_unanswered: string;
                }>;
                measurement_capability: {
                    current_tracking: string[];
                    tools_available: string[];
                    tracking_gaps: string[];
                    recommendations: string[];
                };
            };
            alternative_architectures: any[];
            measurement_recommendations: {
                current_tracking: string[];
                tools_available: string[];
                tracking_gaps: string[];
                recommendations: string[];
            };
        };
    };
    metadata?: {
        stages_completed: string[];
        sop_processed: boolean;
        discovery_insights_count: number;
        scenarios_evaluated: number;
        risks_identified: number;
        quality_scores: {
            jd_specificity: number;
            role_clarity: number;
            outcome_alignment: number;
            personality_depth: number;
            kpi_quality: number;
            overall_confidence: string;
            areas_to_strengthen: string[];
        };
    };
}

interface IntakeFormData {
    businessName: string;
    website: string;
    businessGoal: string;
    tasks: string[];
    outcome90Day: string;
    weeklyHours: string;
    timezone: string;
    dailyOverlap: string;
    clientFacing: string;
    tools: string;
    englishLevel: string;
    budgetBand: string;
    requirements: string[];
    existingSOPs: string;
    examplesURL: string;
    reportingExpectations: string;
    managementStyle: string;
    securityNeeds: string;
    dealBreakers: string;
    roleSplit: string;
    niceToHaveSkills: string;
}

export default function JdBuilderPage() {
    const { user } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [intakeData, setIntakeData] = useState<IntakeFormData | null>(null);
    const [analysisSource, setAnalysisSource] = useState<'form' | 'chat' | null>(null);
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
    const [isCreateProcessDialogOpen, setIsCreateProcessDialogOpen] = useState(false);
    const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
    const [currentStage, setCurrentStage] = useState<string>("");
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [isLoadingLatest, setIsLoadingLatest] = useState(false);
    const [hasNoSavedAnalyses, setHasNoSavedAnalyses] = useState(false);
    const [organizationKB, setOrganizationKB] = useState<OrganizationKnowledgeBase | null>(null);
    const [isLoadingOrgKB, setIsLoadingOrgKB] = useState(false);

    const [isToolChatOpen, setIsToolChatOpen] = useState(false);
    const [kbMetadata, setKbMetadata] = useState<{
        usedKnowledgeBaseVersion: number | null;
        knowledgeBaseSnapshot: any | null;
        organizationId: string | null;
        contributedInsights: any[] | null;
    } | null>(null);
    const intakeFormRef = useRef<BaseIntakeFormRef>(null);
    const hasAttemptedLoadRef = useRef(false);
    const lastLoadedUserIdRef = useRef<string | null>(null);

    const dynamicFormConfig = useMemo(
        () => getJDFormConfigWithKB(organizationKB !== null),
        [organizationKB]
    );

    const handleSuccess = async ({ apiResult, input }: { apiResult: any; input: IntakeFormData }) => {
        setCurrentStage("");
        setAnalysisError(null);
        setIsProcessing(false);
        try {
            const result: AnalysisResult = {
                preview: apiResult.preview ?? {
                    summary: {
                        company_stage: "",
                        outcome_90d: "",
                        primary_bottleneck: "",
                        role_recommendation: "",
                        sop_status: {
                            has_sops: false,
                            pain_points: [],
                            documentation_gaps: [],
                            summary: "",
                        },
                        workflow_analysis: "",
                    },
                    primary_outcome: "",
                    service_type: "",
                    service_confidence: "",
                    service_reasoning: "",
                    confidence: "",
                    key_risks: [],
                    critical_questions: [],
                },
                full_package: apiResult.full_package,
                metadata: apiResult.metadata,
            };
            setAnalysisResult(result);
            setIntakeData(input);
            setAnalysisSource('form'); 

            const usedKnowledgeBaseVersion = apiResult.knowledgeBase?.version ?? null;
            const knowledgeBaseSnapshot = apiResult.knowledgeBase?.snapshot ?? null;
            const organizationId = apiResult.knowledgeBase?.organizationId ?? null;
            const contributedInsights = apiResult.extractedInsights ?? null;

            setKbMetadata({
                usedKnowledgeBaseVersion,
                knowledgeBaseSnapshot,
                organizationId,
                contributedInsights,
            });

            try {
                const title = `${input.businessName} - ${apiResult.preview?.service_type || apiResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

                const saveResponse = await fetch("/api/jd/save", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        title,
                        intakeData: input,
                        analysis: result,
                        isFinalized: false,
                        organizationId: organizationId,
                        usedKnowledgeBaseVersion: usedKnowledgeBaseVersion,
                        knowledgeBaseSnapshot: knowledgeBaseSnapshot,
                        contributedInsights: contributedInsights,
                    }),
                });

                const saveData = await saveResponse.json();

                if (!saveResponse.ok) {
                    console.error("Failed to save analysis:", saveData.error);
                } else {
                    console.log("Analysis saved successfully:", saveData.savedAnalysis);
                    if (saveData.savedAnalysis?.id) {
                        setSavedAnalysisId(saveData.savedAnalysis.id);
                    }
                }
            } catch (saveError) {
                console.error("Error saving analysis:", saveError);
            }
        } catch (e) {
            console.error("Failed to process API result:", e);
            setAnalysisError(e instanceof Error ? e.message : "Failed to process analysis results");
            setAnalysisResult({
                preview: apiResult.preview ?? {
                    summary: {
                        company_stage: "",
                        outcome_90d: "",
                        primary_bottleneck: "",
                        role_recommendation: "",
                        sop_status: {
                            has_sops: false,
                            pain_points: [],
                            documentation_gaps: [],
                            summary: "",
                        },
                        workflow_analysis: "",
                    },
                    primary_outcome: "",
                    service_type: "",
                    service_confidence: "",
                    service_reasoning: "",
                    confidence: "",
                    key_risks: [],
                    critical_questions: [],
                },
                full_package: apiResult.full_package,
                metadata: apiResult.metadata,
            } as AnalysisResult);
            setIntakeData(input);
            setAnalysisSource('form');
        } finally {
            setIsProcessing(false);
            setCurrentStage("");
        }
    };

    const summary = analysisResult?.preview?.summary || analysisResult?.full_package?.executive_summary?.what_you_told_us;
    const implementationPlan = analysisResult?.full_package?.implementation_plan;
    const riskManagement = analysisResult?.full_package?.risk_management;
    const monitoringPlan = riskManagement?.monitoring_plan;
    const serviceStructure = analysisResult?.full_package?.service_structure;
    const executiveSummary = analysisResult?.full_package?.executive_summary;

    const getPrimaryRoleTitle = () => {
        if (analysisResult?.preview?.service_type === "Dedicated VA") {
            return analysisResult?.preview?.role_title || serviceStructure?.dedicated_va_role?.title || "Dedicated VA";
        } else if (analysisResult?.preview?.service_type === "Unicorn VA Service") {
            return serviceStructure?.core_va_role?.title || analysisResult?.preview?.core_va_title || "Core VA";
        } else if (analysisResult?.preview?.service_type === "Projects on Demand") {
            return `${analysisResult?.preview?.project_count || 0} Projects`;
        }
        return "Virtual Assistant";
    };

    const getTotalHours = () => {
        if (analysisResult?.preview?.service_type === "Dedicated VA") {
            return analysisResult?.preview?.hours_per_week || serviceStructure?.dedicated_va_role?.hours_per_week || "40";
        } else if (analysisResult?.preview?.service_type === "Unicorn VA Service") {
            return serviceStructure?.core_va_role?.hours_per_week || analysisResult?.preview?.core_va_hours || "40";
        } else if (analysisResult?.preview?.service_type === "Projects on Demand") {
            return analysisResult?.preview?.total_hours || "N/A";
        }
        return "40";
    };

    const handleRefineClick = async () => {
        setActionsMenuOpen(false);
        if (!savedAnalysisId && analysisResult && intakeData && user) {
            try {
                const title = `${intakeData.businessName} - ${analysisResult.preview?.service_type || analysisResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

                const saveResponse = await fetch("/api/jd/save", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        title,
                        intakeData,
                        analysis: analysisResult,
                        isFinalized: false,
                        organizationId: kbMetadata?.organizationId ?? null,
                        usedKnowledgeBaseVersion: kbMetadata?.usedKnowledgeBaseVersion ?? null,
                        knowledgeBaseSnapshot: kbMetadata?.knowledgeBaseSnapshot ?? null,
                        contributedInsights: kbMetadata?.contributedInsights ?? null,
                    }),
                });

                const saveData = await saveResponse.json();
                if (saveResponse.ok && saveData.savedAnalysis?.id) {
                    setSavedAnalysisId(saveData.savedAnalysis.id);
                    setIsRefinementModalOpen(true);
                } else {
                    alert("Please save your analysis first before refining.");
                }
            } catch (error) {
                console.error("Error saving analysis:", error);
                alert("Failed to save analysis. Please try again.");
            }
        } else if (savedAnalysisId) {
            setIsRefinementModalOpen(true);
        } else {
            alert("Please save your analysis first before refining.");
        }
    };

    const getCurrentGreeting = () => {
        if (!user) return "Welcome";
        const hour = new Date().getHours();
        if (hour < 12) return `Good morning, ${user.firstname}`;
        if (hour < 18) return `Good afternoon, ${user.firstname}`;
        return `Good evening, ${user.firstname}`;
    };

    useEffect(() => {
        const loadAnalysis = async () => {
            if (!user || analysisResult || isLoadingLatest) return;

            const analysisId = searchParams?.get('analysisId');
            const shouldRefine = searchParams?.get('refine') === 'true';

            const currentUserId = user.id;
            if (lastLoadedUserIdRef.current !== currentUserId) {
                hasAttemptedLoadRef.current = false;
            }
            if (hasAttemptedLoadRef.current && !analysisId) return; 

            hasAttemptedLoadRef.current = true;
            lastLoadedUserIdRef.current = currentUserId;
            setIsLoadingLatest(true);
            try {
                let response;
                let analysis;

                if (analysisId) {
                    response = await fetch("/api/jd/saved?page=1&limit=100", {
                        method: "GET",
                        credentials: "include",
                    });

                    if (!response.ok) {
                        throw new Error("Failed to fetch analyses");
                    }

                    const data = await response.json();
                    if (data.success && data.data?.analyses) {
                        analysis = data.data.analyses.find((a: any) => a.id === analysisId);
                        if (!analysis) {
                            throw new Error("Analysis not found");
                        }
                    } else {
                        throw new Error("Analysis not found");
                    }
                } else {
                    response = await fetch("/api/jd/saved?page=1&limit=1", {
                        method: "GET",
                        credentials: "include",
                    });

                    if (!response.ok) {
                        throw new Error("Failed to fetch saved analyses");
                    }

                    const data = await response.json();
                    if (data.success && data.data?.analyses && data.data.analyses.length > 0) {
                        analysis = data.data.analyses[0];
                    } else {
                        setHasNoSavedAnalyses(true);
                        return;
                    }
                }

                setAnalysisResult(analysis.analysis as AnalysisResult);
                setIntakeData(analysis.intakeData as IntakeFormData);
                setSavedAnalysisId(analysis.id);
                setHasNoSavedAnalyses(false);
                setAnalysisSource(analysis.intakeData ? 'form' : null);
                setKbMetadata({
                    usedKnowledgeBaseVersion: analysis.usedKnowledgeBaseVersion ?? null,
                    knowledgeBaseSnapshot: analysis.knowledgeBaseSnapshot ?? null,
                    organizationId: analysis.organizationId ?? null,
                    contributedInsights: analysis.contributedInsights ?? null,
                });

                if (shouldRefine) {
                    setIsRefinementModalOpen(true);
                }
            } catch (error) {
                console.error("Error loading analysis:", error);
                setHasNoSavedAnalyses(true);
            } finally {
                setIsLoadingLatest(false);
            }
        };

        loadAnalysis();
    }, [user, analysisResult, searchParams]);

    useEffect(() => {
        const fetchOrgKB = async () => {
            if (!user || isLoadingOrgKB) return;

            setIsLoadingOrgKB(true);
            try {
                const response = await fetch("/api/organization-knowledge-base", {
                    method: "GET",
                    credentials: "include",
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.organizationProfile) {
                        setOrganizationKB(data.organizationProfile as OrganizationKnowledgeBase);
                    }
                }
            } catch (error) {
                console.error("Error fetching organization knowledge base:", error);
            } finally {
                setIsLoadingOrgKB(false);
            }
        };

        fetchOrgKB();
    }, [user]);

    const handleDownload = async () => {
        if (!analysisResult) {
            console.error("No analysis to download");
            setActionsMenuOpen(false);
            return;
        }

        setIsDownloading(true);
        setActionsMenuOpen(false);

        try {
            const response = await fetch('/api/jd/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(analysisResult),
            });

            if (!response.ok) {
                throw new Error('Failed to download PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition
                ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'job-description-analysis.pdf'
                : 'job-description-analysis.pdf';

            a.download = filename;
            a.setAttribute('data-download', 'true');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setIsDownloading(false);
            }, 100);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download job description. Please try again.');
            setIsDownloading(false);
        }
    };

    const handleSave = async () => {
        if (!analysisResult || !intakeData) {
            console.error("No analysis to save");
            setActionsMenuOpen(false);
            return;
        }

        try {
            const title = `${intakeData.businessName} - ${analysisResult.preview?.service_type || analysisResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

            const saveResponse = await fetch("/api/jd/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    title,
                    intakeData,
                    analysis: analysisResult,
                    isFinalized: false,
                    organizationId: kbMetadata?.organizationId ?? null,
                    usedKnowledgeBaseVersion: kbMetadata?.usedKnowledgeBaseVersion ?? null,
                    knowledgeBaseSnapshot: kbMetadata?.knowledgeBaseSnapshot ?? null,
                    contributedInsights: kbMetadata?.contributedInsights ?? null,
                }),
            });

            const saveData = await saveResponse.json();

            if (!saveResponse.ok) {
                console.error("Failed to save analysis:", saveData.error);
            } else {
                console.log("Analysis saved successfully:", saveData.savedAnalysis);
                if (saveData.savedAnalysis?.id) {
                    setSavedAnalysisId(saveData.savedAnalysis.id);
                }
            }
        } catch (error) {
            console.error("Error saving analysis:", error);
        } finally {
            setActionsMenuOpen(false);
        }
    };

    return (
        <>
            <div className="w-full max-w-screen overflow-x-hidden h-screen flex flex-col">
                <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                    <SidebarTrigger />
                </div>
                <div
                    className="transition-all duration-300 ease-in-out flex-1 min-h-0 flex flex-col overflow-hidden overflow-x-hidden w-full max-w-full"
                >
                    <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0">
                        <div className="flex-shrink-0 p-2">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-semibold mb-1">
                                        Role Builder
                                    </h1>
                                    <p className="text-base text-muted-foreground">
                                        Create comprehensive job descriptions with AI-powered analysis
                                    </p>
                                </div>
                                <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-4 mt-1 md:mt-0">
                                    {!isProcessing && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white">
                                                    <Plus className="h-4 w-4" />
                                                    <span>{analysisResult ? "New Analysis" : "Start Analysis"}</span>
                                                    <ChevronDown className="h-4 w-4 ml-2" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setIsModalOpen(true)}>
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    Fill Out Form
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setIsToolChatOpen(true)}>
                                                    <SparklesIcon className="h-4 w-4 mr-2" />
                                                    Generate with AI
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push("/dashboard/role-builder/history")}
                                        className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                    >
                                        <History className="h-4 w-4" />
                                        History
                                    </Button>
                                </div>
                            </div>
                            <Separator />
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden">
                            {analysisError && !isProcessing && (
                                <div className="flex flex-col items-center justify-center py-16 px-6">
                                    <div className="max-w-md w-full">
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Analysis Failed</AlertTitle>
                                            <AlertDescription className="mb-4">
                                                {analysisError}
                                            </AlertDescription>
                                            <div className="flex gap-3 mt-4">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setAnalysisError(null);
                                                        setIsModalOpen(true);
                                                    }}
                                                >
                                                    Try Again
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setAnalysisError(null)}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </Alert>
                                    </div>
                                </div>
                            )}

                            {isProcessing && !analysisError && !isDownloading && (
                                <div className="flex flex-col items-center justify-center py-16 px-4">
                                    <Loader2 className="h-8 w-8 mb-3 animate-spin text-primary" />
                                    <h3 className="text-lg font-semibold mb-1 text-center">
                                        {currentStage || "Processing your analysis"}
                                    </h3>
                                    <p className="text-base text-muted-foreground text-center mb-6">
                                        This usually takes 1–2 minutes. We&apos;re analyzing your role and building recommendations.
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[
                                            "Deep discovery",
                                            "Service type",
                                            "Role architecture",
                                            "Specifications",
                                            "Validation & insights",
                                        ].map((label, i) => {
                                            const stageNum = currentStage?.match(/Stage (\d+(?:\.\d+)?)/)?.[1];
                                            const isExtracting = currentStage?.toLowerCase().includes("extracting");
                                            const current =
                                                (stageNum === "1" && i === 0) ||
                                                (stageNum === "1.5" && i === 1) ||
                                                (stageNum === "2" && i === 2) ||
                                                (stageNum === "3" && i === 3) ||
                                                ((stageNum === "4" || stageNum === "5" || isExtracting) && i === 4);
                                            return (
                                                <span
                                                    key={label}
                                                    className={cn(
                                                        "text-xs px-2 py-1 rounded-md border",
                                                        current
                                                            ? "border-primary bg-primary/10 text-primary font-medium"
                                                            : "border-muted bg-muted/50 text-muted-foreground",
                                                    )}
                                                >
                                                    {i + 1}. {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {isDownloading && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 className="h-8 w-8 mb-3 animate-spin" />
                                    <h3 className="text-lg font-semibold mb-1">
                                        Preparing download...
                                    </h3>
                                    <p className="text-base text-muted-foreground">
                                        Generating PDF file
                                    </p>
                                </div>
                            )}

                            {isLoadingLatest && !analysisResult && !isProcessing && !isDownloading && (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 className="h-8 w-8 mb-3 animate-spin" />
                                    <p className="text-base text-muted-foreground">
                                        Loading your latest analysis...
                                    </p>
                                </div>
                            )}

                            {!analysisResult && !isProcessing && !isDownloading && !isLoadingLatest && hasNoSavedAnalyses && (
                                <div className="py-16 space-y-6 text-center">
                                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                                        <BriefcaseIcon className="h-12 w-12 text-[color:var(--accent-strong)]" />
                                    </div>
                                    <div className="space-y-3 max-w-2xl mx-auto">
                                        <h3 className="text-2xl font-semibold">
                                            {getCurrentGreeting()}
                                        </h3>
                                        <p className="text-base text-muted-foreground">
                                            Let's find your perfect virtual assistant. Start by creating a new analysis.
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                        <Button
                                            onClick={() => setIsModalOpen(true)}
                                            size="lg"
                                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            <span>Create New Role</span>
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {analysisResult && !isProcessing && !isDownloading && (
                                <div className="w-full max-w-full flex flex-col h-full overflow-hidden">
                                   
                                    <div id="analysis-display" className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 mb-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <h2 className="text-2xl font-semibold mb-1">
                                                        {analysisResult.preview.service_type || 'Your Recommendations'}
                                                    </h2>
                                                    {analysisResult.preview.service_reasoning && (
                                                        <p className="text-base text-muted-foreground mt-1">
                                                            {analysisResult.preview.service_reasoning}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    
                                                    {(analysisResult.preview.service_type === "Dedicated VA" && analysisResult.preview.role_title) ||
                                                        (analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.preview.core_va_title) ||
                                                        (analysisResult.preview.service_type === "Projects on Demand" && analysisResult.preview.project_count) ? (
                                                        <div className="flex items-center gap-3">
                                                            <UserIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                                            <div>
                                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                                                    {analysisResult.preview.service_type === "Projects on Demand" ? "Projects" : "Role"}
                                                                </p>
                                                                <p className="text-lg font-bold">
                                                                    {analysisResult.preview.service_type === "Dedicated VA"
                                                                        ? analysisResult.preview.role_title
                                                                        : analysisResult.preview.service_type === "Unicorn VA Service"
                                                                            ? analysisResult.preview.core_va_title
                                                                            : `${analysisResult.preview.project_count || 0} Projects`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {(analysisResult.preview.hours_per_week ||
                                                        analysisResult.preview.core_va_hours ||
                                                        analysisResult.preview.total_hours ||
                                                        analysisResult.preview.estimated_timeline) ? (
                                                        <div className="flex items-center gap-3">
                                                            <ClockIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                                            <div>
                                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                                                    {analysisResult.preview.service_type === "Projects on Demand" ? "Timeline" : "Hours/Week"}
                                                                </p>
                                                                <p className="text-lg font-bold">
                                                                    {analysisResult.preview.service_type === "Projects on Demand"
                                                                        ? (analysisResult.preview.estimated_timeline || analysisResult.preview.total_hours || "N/A")
                                                                        : (analysisResult.preview.hours_per_week || analysisResult.preview.core_va_hours || "N/A")}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {analysisResult.preview.service_confidence && (() => {
                                                        const confidenceValue = getConfidenceValue(analysisResult.preview.service_confidence);
                                                        const radius = 20;
                                                        const circumference = 2 * Math.PI * radius;
                                                        const offset = circumference - (confidenceValue / 100) * circumference;
                                                        return (
                                                            <div className="flex items-center gap-3">
                                                                <ChartPieIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                                                <div className="flex items-center gap-3">
                                                                    <div className="relative w-12 h-12">
                                                                        <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 44 44">
                                                                            <defs>
                                                                                <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                                    <stop offset="0%" stopColor="#f0b214" />
                                                                                    <stop offset="100%" stopColor="#1374B4" />
                                                                                </linearGradient>
                                                                            </defs>
                                                                            <circle
                                                                                cx="22"
                                                                                cy="22"
                                                                                r={radius}
                                                                                stroke="currentColor"
                                                                                strokeWidth="4"
                                                                                fill="none"
                                                                                className="text-muted"
                                                                            />
                                                                            <circle
                                                                                cx="22"
                                                                                cy="22"
                                                                                r={radius}
                                                                                stroke="url(#confidenceGradient)"
                                                                                strokeWidth="4"
                                                                                fill="none"
                                                                                strokeDasharray={circumference}
                                                                                strokeDashoffset={offset}
                                                                                className="transition-all duration-500"
                                                                                strokeLinecap="round"
                                                                            />
                                                                        </svg>
                                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                                            <span className="text-xs font-bold">{confidenceValue}%</span>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Confidence</p>
                                                                        <p className="text-lg font-bold">{analysisResult.preview.service_confidence}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.preview.team_support_areas && (
                                                    <div className="mt-2">
                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Supporting Roles</p>
                                                        <p className="text-base font-medium">{analysisResult.preview.team_support_areas} team support areas</p>
                                                    </div>
                                                )}
                                            </div>
                                            <DropdownMenu open={actionsMenuOpen} onOpenChange={setActionsMenuOpen}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon" className="flex-shrink-0 border-[var(--accent-strong)] text-[var(--accent-strong)] hover:bg-[var(--accent-strong)]/10">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={async () => {
                                                        setActionsMenuOpen(false);
                                                        if (analysisResult) {
                                                            const summary = [
                                                                `Service Type: ${analysisResult.preview?.service_type || 'N/A'}`,
                                                                `Service Reasoning: ${analysisResult.preview?.service_reasoning || 'N/A'}`,
                                                                `Confidence: ${analysisResult.preview?.service_confidence || 'N/A'}`,
                                                                '',
                                                                'Role Details:',
                                                                analysisResult.full_package?.service_structure?.dedicated_va_role?.title ||
                                                                analysisResult.full_package?.service_structure?.core_va_role?.title ||
                                                                'N/A',
                                                                '',
                                                                'Key Requirements:',
                                                                ...(analysisResult.full_package?.service_structure?.dedicated_va_role?.skill_requirements?.required ||
                                                                    analysisResult.full_package?.service_structure?.core_va_role?.skill_requirements?.required ||
                                                                    []),
                                                            ].join('\n');

                                                            const success = await copyToClipboard(
                                                                summary,
                                                                () => toast.success("Analysis summary copied to clipboard"),
                                                                (error) => toast.error("Failed to copy", { description: error.message })
                                                            );
                                                        } else {
                                                            toast.error("No analysis to copy");
                                                        }
                                                    }}>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        Copy to Clipboard
                                                    </DropdownMenuItem>
                                                    <Separator />
                                                    <DropdownMenuItem
                                                        onClick={async () => {
                                                            setActionsMenuOpen(false);
                                                            if (!savedAnalysisId && analysisResult && intakeData && user) {
                                                                try {
                                                                    const title = `${intakeData.businessName} - ${analysisResult.preview?.service_type || analysisResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

                                                                    const saveResponse = await fetch("/api/jd/save", {
                                                                        method: "POST",
                                                                        headers: {
                                                                            "Content-Type": "application/json",
                                                                        },
                                                                        credentials: "include",
                                                                        body: JSON.stringify({
                                                                            title,
                                                                            intakeData,
                                                                            analysis: analysisResult,
                                                                            isFinalized: false,
                                                                            organizationId: kbMetadata?.organizationId ?? null,
                                                                            usedKnowledgeBaseVersion: kbMetadata?.usedKnowledgeBaseVersion ?? null,
                                                                            knowledgeBaseSnapshot: kbMetadata?.knowledgeBaseSnapshot ?? null,
                                                                            contributedInsights: kbMetadata?.contributedInsights ?? null,
                                                                        }),
                                                                    });

                                                                    const saveData = await saveResponse.json();
                                                                    if (saveResponse.ok && saveData.savedAnalysis?.id) {
                                                                        setSavedAnalysisId(saveData.savedAnalysis.id);
                                                                        setIsRefinementModalOpen(true);
                                                                    } else {
                                                                        toast.error("Please save your analysis first before refining.");
                                                                    }
                                                                } catch (error) {
                                                                    console.error("Error saving analysis:", error);
                                                                    toast.error("Failed to save analysis. Please try again.");
                                                                }
                                                            } else if (analysisResult) {
                                                                setIsRefinementModalOpen(true);
                                                            } else {
                                                                toast.error("Please save your analysis first before refining.");
                                                            }
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Refine Analysis
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={handleDownload}>
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download
                                                    </DropdownMenuItem>
                                                    <Separator />
                                                    <DropdownMenuItem onClick={handleSave}>
                                                        <Save className="h-4 w-4 mr-2" />
                                                        Save
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    <ScrollArea className="flex-1 min-h-0">
                                        <div className="pr-4">
                                            <Accordion type="multiple" defaultValue={["role-details", "skills-requirements", "what-you-told-us"]} className="w-full space-y-4">
                                               
                                                <AccordionItem value="role-details" className="rounded-lg px-4 bg-card">
                                                    <AccordionTrigger className="hover:no-underline">
                                                        <div className="flex items-center gap-3">
                                                            <Briefcase className="w-5 h-5 text-primary" />
                                                            <div className="text-left">
                                                                <h3 className="text-lg font-semibold">
                                                                    {analysisResult.preview.service_type === "Projects on Demand" ? "Project Details" : "Role Details"}
                                                                </h3>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {analysisResult.preview.service_type === "Projects on Demand"
                                                                        ? "View all project specifications"
                                                                        : "View role responsibilities, tasks, and requirements"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-4 pb-6">
                                                        <div className="space-y-6">
                                                            {analysisResult.full_package?.service_structure && (
                                                                <div className="space-y-4">
                                                                    {analysisResult.preview.service_type === "Dedicated VA" && analysisResult.full_package.service_structure.dedicated_va_role && (
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
                                                                                    <Briefcase className="w-4 h-4 text-primary" />
                                                                                    {analysisResult.full_package.service_structure.dedicated_va_role.title}
                                                                                </h4>
                                                                                <p className="text-sm text-muted-foreground mb-3">
                                                                                    {analysisResult.full_package.service_structure.dedicated_va_role.hours_per_week} hrs/week
                                                                                </p>
                                                                                {analysisResult.full_package.service_structure.dedicated_va_role.core_responsibility && (
                                                                                    <p className="text-base leading-relaxed mb-4">
                                                                                        {analysisResult.full_package.service_structure.dedicated_va_role.core_responsibility}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            {analysisResult.full_package.service_structure.dedicated_va_role.task_allocation?.from_intake && analysisResult.full_package.service_structure.dedicated_va_role.task_allocation.from_intake.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Tasks</p>
                                                                                    <ul className="list-disc pl-5 space-y-1 text-base">
                                                                                        {analysisResult.full_package.service_structure.dedicated_va_role.task_allocation.from_intake.map((task: string, i: number) => (
                                                                                            <li key={i}>{task}</li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.core_va_role && (
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
                                                                                    <Briefcase className="w-4 h-4 text-primary" />
                                                                                    {analysisResult.full_package.service_structure.core_va_role.title}
                                                                                </h4>
                                                                                <p className="text-sm text-muted-foreground mb-3">
                                                                                    {analysisResult.full_package.service_structure.core_va_role.hours_per_week} hrs/week
                                                                                </p>
                                                                                {analysisResult.full_package.service_structure.core_va_role.core_responsibility && (
                                                                                    <p className="text-base leading-relaxed mb-4">
                                                                                        {analysisResult.full_package.service_structure.core_va_role.core_responsibility}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            {analysisResult.full_package.service_structure.core_va_role.recurring_tasks && analysisResult.full_package.service_structure.core_va_role.recurring_tasks.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Recurring Tasks</p>
                                                                                    <ul className="list-disc pl-5 space-y-1 text-base">
                                                                                        {analysisResult.full_package.service_structure.core_va_role.recurring_tasks.map((task: string, i: number) => (
                                                                                            <li key={i}>{task}</li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {analysisResult.preview.service_type === "Projects on Demand" && (
                                                                        <div className="space-y-4">
                                                                            {(analysisResult.full_package.detailed_specifications?.projects || analysisResult.full_package.service_structure.projects || []).map((project: any, idx: number) => (
                                                                                <div key={idx} className="border-l-2 border-primary/20 pl-4 py-2">
                                                                                    <h4 className="text-base font-semibold mb-1">{project.project_name}</h4>
                                                                                    <p className="text-sm text-muted-foreground mb-2">
                                                                                        {project.estimated_hours || project.timeline?.estimated_hours} hrs • {typeof project.timeline === "string" ? project.timeline : project.timeline?.duration || "N/A"}
                                                                                    </p>
                                                                                    {project.objective && (
                                                                                        <p className="text-base leading-relaxed mb-2">{project.objective}</p>
                                                                                    )}
                                                                                    {project.deliverables?.length > 0 && (
                                                                                        <div>
                                                                                            <p className="text-sm font-semibold text-muted-foreground uppercase mb-1">Deliverables</p>
                                                                                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                                                                                {project.deliverables.map((del: any, i: number) => (
                                                                                                    <li key={i}>{typeof del === "string" ? del : del.item || del}</li>
                                                                                                ))}
                                                                                            </ul>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.team_support_areas && Array.isArray(analysisResult.full_package.service_structure.team_support_areas) && analysisResult.full_package.service_structure.team_support_areas.length > 0 && (
                                                                        <div className="space-y-3 mt-4">
                                                                            <h4 className="text-base font-semibold">Supporting Roles</h4>
                                                                            {analysisResult.full_package.service_structure.team_support_areas.map((support: any, idx: number) => (
                                                                                <div key={idx} className="border-l-2 border-primary/20 pl-4 py-2">
                                                                                    <h5 className="text-sm font-semibold">{support.skill_category}</h5>
                                                                                    <p className="text-xs text-muted-foreground">{support.estimated_hours_monthly} hrs/month</p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>

                                                <AccordionItem value="skills-requirements" className="rounded-lg px-4 bg-card">
                                                    <AccordionTrigger className="hover:no-underline">
                                                        <div className="flex items-center gap-3">
                                                            <Target className="w-5 h-5 text-primary" />
                                                            <div className="text-left">
                                                                <h3 className="text-lg font-semibold">Skills & Requirements</h3>
                                                                <p className="text-sm text-muted-foreground">Required and nice-to-have skills</p>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-4 pb-6">
                                                        <div className="space-y-4">
                                                            {analysisResult.preview.service_type === "Dedicated VA" && analysisResult.full_package?.service_structure?.dedicated_va_role?.skill_requirements && (
                                                                <div className="space-y-3">
                                                                    {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.required?.length > 0 && (
                                                                        <div>
                                                                            <p className="text-base font-semibold mb-2">Required Skills</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.required.map((skill: string, i: number) => (
                                                                                    <Badge key={i} variant="default" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-base">
                                                                                        {skill}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.nice_to_have?.length > 0 && (
                                                                        <div>
                                                                            <p className="text-base font-semibold mb-2">Nice to Have</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.nice_to_have.map((skill: string, i: number) => (
                                                                                    <Badge key={i} variant="outline" className="text-base">{skill}</Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package?.service_structure?.core_va_role?.skill_requirements && (
                                                                <div className="space-y-3">
                                                                    {analysisResult.full_package.service_structure.core_va_role.skill_requirements.required?.length > 0 && (
                                                                        <div>
                                                                            <p className="text-base font-semibold mb-2">Required Skills</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {analysisResult.full_package.service_structure.core_va_role.skill_requirements.required.map((skill: string, i: number) => (
                                                                                    <Badge key={i} variant="default" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-base">
                                                                                        {skill}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {analysisResult.full_package.service_structure.core_va_role.skill_requirements.nice_to_have?.length > 0 && (
                                                                        <div>
                                                                            <p className="text-base font-semibold mb-2">Nice to Have</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {analysisResult.full_package.service_structure.core_va_role.skill_requirements.nice_to_have.map((skill: string, i: number) => (
                                                                                    <Badge key={i} variant="outline" className="text-base">{skill}</Badge>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {analysisResult.preview.service_type === "Projects on Demand" && analysisResult.full_package?.service_structure?.projects && (
                                                                <div className="space-y-4">
                                                                    {analysisResult.full_package.service_structure.projects.map((project: any, idx: number) => (
                                                                        project.skills_required && project.skills_required.length > 0 ? (
                                                                            <div key={idx}>
                                                                                <p className="text-base font-semibold mb-2">{project.project_name}</p>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {project.skills_required.map((skill: string, i: number) => (
                                                                                        <Badge key={i} variant="default" className="text-base">{skill}</Badge>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>

                                                {summary && (
                                                    <AccordionItem value="what-you-told-us" className="rounded-lg px-4 bg-card">
                                                        <AccordionTrigger className="hover:no-underline">
                                                            <div className="flex items-center gap-3">
                                                                <Sparkles className="w-5 h-5 text-primary" />
                                                                <div className="text-left">
                                                                    <h3 className="text-lg font-semibold">What You Told Us</h3>
                                                                    <p className="text-sm text-muted-foreground">Company stage, outcomes, and bottlenecks</p>
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pt-4 pb-6">
                                                            <div className="space-y-4">
                                                               
                                                                <div className="flex items-start gap-3">
                                                                    <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company Stage</span>
                                                                        <p className="text-base mt-0.5 font-medium">{summary?.company_stage}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex items-start gap-3">
                                                                    <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">90-Day Outcome</span>
                                                                        <p className="text-base mt-0.5 font-medium leading-relaxed">{summary?.outcome_90d}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-start gap-3">
                                                                    <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Primary Bottleneck</span>
                                                                            <Badge variant="destructive" className="text-xs">High Priority</Badge>
                                                                        </div>
                                                                        <p className="text-base font-medium leading-relaxed">{summary?.primary_bottleneck}</p>
                                                                    </div>
                                                                </div>

                                                                {analysisResult.preview.key_risks && analysisResult.preview.key_risks.length > 0 && (
                                                                    <div className="pt-4 border-t">
                                                                        <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
                                                                            <ShieldAlert className="w-4 h-4 text-destructive" />
                                                                            Key Risks
                                                                        </h4>
                                                                        <ul className="space-y-2">
                                                                            {analysisResult.preview.key_risks.map((risk: string, idx: number) => (
                                                                                <li key={idx} className="flex items-start gap-2 text-base">
                                                                                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                                                                    <span className="leading-relaxed">{risk}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}

                                                                {analysisResult.preview.critical_questions && analysisResult.preview.critical_questions.length > 0 && (
                                                                    <div className="pt-4 border-t">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h4 className="text-base font-semibold flex items-center gap-2">
                                                                                <AlertCircle className="w-4 h-4 text-primary" />
                                                                                Critical Questions
                                                                            </h4>
                                                                            <Button
                                                                                variant="default"
                                                                                size="sm"
                                                                                disabled
                                                                                className="gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                                                            >
                                                                                <SparklesIcon className="h-4 w-4" />
                                                                                Answer with AI
                                                                            </Button>
                                                                        </div>
                                                                        <ul className="space-y-3">
                                                                            {analysisResult.preview.critical_questions.map((question: string, idx: number) => (
                                                                                <li key={idx} className="flex items-start gap-2 text-base">
                                                                                    <span className="font-semibold text-primary mt-0.5 flex-shrink-0">Q{idx + 1}:</span>
                                                                                    <span className="leading-relaxed">{question}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )}

                                                {implementationPlan && (
                                                    <AccordionItem value="implementation" className="rounded-lg px-4 bg-card">
                                                        <AccordionTrigger className="hover:no-underline">
                                                            <div className="flex items-center gap-3">
                                                                <FileText className="w-5 h-5 text-primary" />
                                                                <div className="text-left">
                                                                    <h3 className="text-lg font-semibold">Implementation</h3>
                                                                    <p className="text-sm text-muted-foreground">Next steps and onboarding roadmap</p>
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pt-4 pb-6">
                                                            <div className="space-y-6">
                                                                {implementationPlan?.immediate_next_steps && implementationPlan.immediate_next_steps.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-base font-semibold mb-3">Immediate Next Steps</h4>
                                                                        <div className="space-y-3">
                                                                            {implementationPlan.immediate_next_steps.map((item, index) => (
                                                                                <div key={index} className="pb-3 border-b border-border last:border-0 last:pb-0">
                                                                                    <div className="flex items-start gap-3">
                                                                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                                            <span className="text-xs font-semibold text-primary">{index + 1}</span>
                                                                                        </div>
                                                                                        <div className="flex-1 space-y-1">
                                                                                            <h5 className="text-sm font-semibold">{item.step}</h5>
                                                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                                                <span><span className="font-medium">Owner:</span> {item.owner}</span>
                                                                                                <span><span className="font-medium">Timeline:</span> {item.timeline}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {savedAnalysisId && analysisResult && (
                                                                    <div className="pt-4 border-t">
                                                                        <Button
                                                                            onClick={async () => {
                                                                                if (!savedAnalysisId && analysisResult && intakeData && user) {
                                                                                    try {
                                                                                        const title = `${intakeData.businessName} - ${analysisResult.preview?.service_type || analysisResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;
                                                                                        const saveResponse = await fetch("/api/jd/save", {
                                                                                            method: "POST",
                                                                                            headers: {
                                                                                                "Content-Type": "application/json",
                                                                                            },
                                                                                            credentials: "include",
                                                                                            body: JSON.stringify({
                                                                                                title,
                                                                                                intakeData,
                                                                                                analysis: analysisResult,
                                                                                                isFinalized: false,
                                                                                                organizationId: kbMetadata?.organizationId ?? null,
                                                                                                usedKnowledgeBaseVersion: kbMetadata?.usedKnowledgeBaseVersion ?? null,
                                                                                                knowledgeBaseSnapshot: kbMetadata?.knowledgeBaseSnapshot ?? null,
                                                                                                contributedInsights: kbMetadata?.contributedInsights ?? null,
                                                                                            }),
                                                                                        });
                                                                                        const saveData = await saveResponse.json();
                                                                                        if (saveResponse.ok && saveData.savedAnalysis?.id) {
                                                                                            setSavedAnalysisId(saveData.savedAnalysis.id);
                                                                                            setIsCreateProcessDialogOpen(true);
                                                                                        } else {
                                                                                            toast.error("Please save your analysis first before creating a process.");
                                                                                        }
                                                                                    } catch (error) {
                                                                                        console.error("Error saving analysis:", error);
                                                                                        toast.error("Failed to save analysis. Please try again.");
                                                                                    }
                                                                                } else {
                                                                                    setIsCreateProcessDialogOpen(true);
                                                                                }
                                                                            }}
                                                                            className="w-full bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                                                            size="lg"
                                                                        >
                                                                            <FileText className="h-4 w-4 mr-2" />
                                                                            Create Process
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )}
                                            </Accordion>
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {user && (
                    <>
                        <Dialog open={isModalOpen} onOpenChange={(open) => {
                            if (!isProcessing) {
                                setIsModalOpen(open);
                                if (!open) setCurrentStage("");
                            }
                        }}>
                            <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2 flex flex-col">
                                <DialogHeader className="sr-only flex-shrink-0">
                                    <DialogTitle>Job Description Analysis</DialogTitle>
                                </DialogHeader>
                                <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
                                    {!isLoadingOrgKB && !organizationKB && (
                                        <Alert className="mb-4">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Organization Knowledge Base Not Set Up</AlertTitle>
                                            <AlertDescription>
                                                Set up your Organization Knowledge Base to use defaults across roles.
                                                <Button
                                                    variant="link"
                                                    className="p-0 h-auto ml-1 text-primary"
                                                    onClick={() => {
                                                        setIsModalOpen(false);
                                                        router.push("/dashboard/organization-profile");
                                                    }}
                                                >
                                                    Set it up now
                                                </Button>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <BaseIntakeForm
                                        ref={intakeFormRef}
                                        userId={user.id}
                                        config={dynamicFormConfig}
                                        hideClearButton={true}
                                        initialData={mapOrgKBToJDForm(organizationKB)}
                                        onClose={() => {
                                            if (!isProcessing) {
                                                setIsModalOpen(false);
                                                setCurrentStage("");
                                            }
                                        }}
                                        onSuccess={async (data) => {
                                            setIsModalOpen(false);
                                            await handleSuccess(data);
                                        }}
                                        onProgress={(stage) => {
                                            setCurrentStage(stage);
                                            setIsProcessing(true);
                                            setAnalysisError(null);
                                            setIsModalOpen(false);
                                        }}
                                        onError={(errorMessage) => {
                                            setAnalysisError(errorMessage);
                                            setIsProcessing(false);
                                            setCurrentStage("");
                                        }}
                                        onSubmit={async (formData, files) => {
                                            setAnalysisError(null);

                                            try {
                                                const resolvedData = resolveJDFormWithOrgKB(formData, organizationKB);

                                                if (!resolvedData.businessName || !resolvedData.businessName.trim()) {
                                                    throw new Error("Company name is required");
                                                }

                                                const tasksArray = Array.isArray(resolvedData.tasks)
                                                    ? resolvedData.tasks.filter((task: string) => task && task.trim()).slice(0, 5)
                                                    : [];

                                                if (tasksArray.length === 0) {
                                                    throw new Error("At least one task is required");
                                                }

                                                const intakePayload = resolvedJDFormToIntakePayload({
                                                    ...resolvedData,
                                                    tasks: tasksArray,
                                                    requirements: Array.isArray(resolvedData.requirements)
                                                        ? resolvedData.requirements.filter((req: string) => req && req.trim())
                                                        : [],
                                                    existingSOPs: formData.existingSOPs || "No",
                                                    sop_filename: files.sopFile && files.sopFile.length > 0
                                                        ? files.sopFile.map(f => f.name).join(", ")
                                                        : null,
                                                });

                                                const requestBody: any = {
                                                    intake_json: intakePayload,
                                                };

                                                if (files.sopFile && Array.isArray(files.sopFile) && files.sopFile.length > 0) {
                                                    const sopFile = files.sopFile[0];
                                                    console.log("SOP file data being sent:", {
                                                        url: sopFile.url,
                                                        urlType: typeof sopFile.url,
                                                        urlLength: sopFile.url?.length,
                                                        urlStartsWith: sopFile.url?.substring(0, 50),
                                                        name: sopFile.name,
                                                        key: sopFile.key,
                                                        type: sopFile.type,
                                                    });

                                                    if (!sopFile.url || (!sopFile.url.startsWith("http://") && !sopFile.url.startsWith("https://"))) {
                                                        console.error("Invalid SOP file URL format:", sopFile.url);
                                                        throw new Error(`Invalid SOP file URL format. Expected HTTP/HTTPS URL, got: ${sopFile.url}`);
                                                    }

                                                    requestBody.sopFileUrl = sopFile.url;
                                                    requestBody.sopFileName = sopFile.name;
                                                    requestBody.sopFileType = sopFile.type;
                                                    requestBody.sopFileKey = sopFile.key; // Pass the S3 key for generating GET presigned URL
                                                }

                                                const response = await fetch('/api/jd/analyze', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                    },
                                                    body: JSON.stringify(requestBody),
                                                });
                                                if (isRateLimitError(response)) {
                                                    const rateLimitError = await parseRateLimitError(response);
                                                    const errorMessage = getRateLimitErrorMessage(rateLimitError);
                                                    toast.error("Rate limit exceeded", {
                                                        description: errorMessage,
                                                        duration: 10000,
                                                    });
                                                    const error = new Error(errorMessage);
                                                    (error as any).userMessage = errorMessage;
                                                    throw error;
                                                }

                                                if (!response.ok) {
                                                    let message = 'Analysis failed';
                                                    let userMessage = 'An error occurred during analysis';
                                                    try {
                                                        const errorPayload = await response.json();
                                                        if (errorPayload?.userMessage) {
                                                            userMessage = errorPayload.userMessage;
                                                            message = errorPayload.error || errorPayload.details || message;
                                                        } else if (errorPayload?.error) {
                                                            message = errorPayload.error;
                                                        }
                                                    } catch {
                                                    }
                                                    const error = new Error(message);
                                                    (error as any).userMessage = userMessage;
                                                    throw error;
                                                }

                                                const reader = response.body?.getReader();
                                                const decoder = new TextDecoder();
                                                let buffer = '';
                                                let finalData: any = null;
                                                let streamError: Error | null = null;

                                                if (!reader) {
                                                    throw new Error('No response body');
                                                }

                                                try {
                                                    while (true) {
                                                        const { done, value } = await reader.read();
                                                        if (done) break;

                                                        buffer += decoder.decode(value, { stream: true });
                                                        const lines = buffer.split('\n');
                                                        buffer = lines.pop() || '';

                                                        for (const line of lines) {
                                                            if (!line.trim()) continue;
                                                            try {
                                                                const parsed = JSON.parse(line);
                                                                if (parsed.type === 'progress' && parsed.stage) {
                                                                    setCurrentStage(parsed.stage);
                                                                    setIsProcessing(true);
                                                                    setIsModalOpen(false);
                                                                } else if (parsed.type === 'result' && parsed.data) {
                                                                    finalData = parsed.data;
                                                                } else if (parsed.type === 'error') {
                                                                    const error = new Error(parsed.error || parsed.details || 'Analysis failed');
                                                                    (error as any).userMessage = parsed.userMessage || parsed.error || parsed.details || 'Analysis failed';
                                                                    streamError = error;
                                                                    break;
                                                                }
                                                            } catch (parseError) {
                                                                if (parseError instanceof SyntaxError) {
                                                                    console.error('Failed to parse stream chunk (JSON syntax error):', parseError);
                                                                    continue;
                                                                } else {
                                                                    streamError = parseError as Error;
                                                                    break;
                                                                }
                                                            }
                                                        }

                                                        if (streamError) break;
                                                    }
                                                } finally {
                                                    reader.releaseLock();
                                                }

                                                if (streamError) {
                                                    throw streamError;
                                                }

                                                if (!streamError && buffer.trim()) {
                                                    try {
                                                        const parsed = JSON.parse(buffer);
                                                        if (parsed.type === 'result' && parsed.data) {
                                                            finalData = parsed.data;
                                                        } else if (parsed.type === 'error') {
                                                            const error = new Error(parsed.error || parsed.details || 'Analysis failed');
                                                            (error as any).userMessage = parsed.userMessage || parsed.error || parsed.details || 'Analysis failed';
                                                            throw error;
                                                        }
                                                    } catch (parseError) {
                                                        if (parseError instanceof SyntaxError) {
                                                            console.error('Failed to parse final buffer (JSON syntax error):', parseError);
                                                        } else {
                                                            throw parseError;
                                                        }
                                                    }
                                                }

                                                if (!streamError && !finalData) {
                                                    throw new Error('No data received from analysis');
                                                }

                                                return finalData;
                                            } catch (error) {
                                                const errorMessage = error instanceof Error
                                                    ? ((error as any).userMessage || error.message)
                                                    : 'An unexpected error occurred';
                                                setAnalysisError(errorMessage);
                                                setIsProcessing(false);
                                                setCurrentStage("");

                                                throw error;
                                            }
                                        }}
                                        secondaryButton={
                                            <Button
                                                variant="outline"
                                                className="w-full !border-[var(--primary-dark)] !text-[var(--primary-dark)] hover:!bg-[var(--primary-dark)]/10 hover:!text-[var(--primary-dark)]"
                                                onClick={() => intakeFormRef.current?.triggerClearForm()}
                                            >
                                                Clear Form
                                            </Button>
                                        }
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                        {analysisResult && (
                            <ToolChatDialog
                                toolId="role-builder"
                                mode="both"
                                open={isRefinementModalOpen}
                                onOpenChange={setIsRefinementModalOpen}
                                buttonLabel=""
                                initialContext={{
                                    existingAnalysis: analysisResult,
                                    existingIntakeData: intakeData,
                                }}
                                showAnalysisBadge={true}
                                analysisBadgeData={{
                                    analysis: analysisResult,
                                    businessName: intakeData?.businessName,
                                }}
                                onViewAnalysis={() => {
                                    setIsRefinementModalOpen(false);
                                    setTimeout(() => {
                                        const analysisElement = document.getElementById('analysis-display');
                                        if (analysisElement) {
                                            analysisElement.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'start'
                                            });
                                        } else {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }, 100);
                                }}
                                onApplyAction={async (action: any) => {
                                    try {
                                        const refinedAnalysis = action?.refinedAnalysis || action?.analysis;

                                        if (refinedAnalysis) {
                                            setAnalysisResult(refinedAnalysis);

                                            if (savedAnalysisId || intakeData) {
                                                try {
                                                    await fetch("/api/jd/save", {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                        },
                                                        credentials: "include",
                                                        body: JSON.stringify({
                                                            title: `${intakeData?.businessName || 'Analysis'} - ${refinedAnalysis?.preview?.service_type || refinedAnalysis?.full_package?.service_structure?.service_type || 'Job Description Analysis'}`,
                                                            intakeData,
                                                            analysis: refinedAnalysis,
                                                            isFinalized: false,
                                                            organizationId: kbMetadata?.organizationId ?? null,
                                                            usedKnowledgeBaseVersion: kbMetadata?.usedKnowledgeBaseVersion ?? null,
                                                            knowledgeBaseSnapshot: kbMetadata?.knowledgeBaseSnapshot ?? null,
                                                            contributedInsights: kbMetadata?.contributedInsights ?? null,
                                                        }),
                                                    });

                                                    toast.success("Analysis refined and saved", {
                                                        description: action?.changeSummary?.summary || "Your changes have been applied.",
                                                    });
                                                } catch (error) {
                                                    console.error("Error saving refined analysis:", error);
                                                    toast.error("Failed to save refined analysis");
                                                }
                                            }

                                            setIsRefinementModalOpen(false);
                                        }
                                    } catch (error) {
                                        console.error("Error applying refinement:", error);
                                        toast.error("Failed to apply refinement");
                                    }
                                }}
                                parseAction={(raw: unknown) => {
                                    if (typeof raw === 'object' && raw !== null) {
                                        const action = raw as any;
                                        if (action.refinedAnalysis) {
                                            return {
                                                ...action,
                                                analysis: action.refinedAnalysis, 
                                                refinedAnalysis: action.refinedAnalysis,
                                            };
                                        }
                                    }
                                    return raw;
                                }}
                            />
                        )}

                        {savedAnalysisId && analysisResult && (
                            <ToolChatDialog
                                toolId="process-builder"
                                open={isCreateProcessDialogOpen}
                                onOpenChange={setIsCreateProcessDialogOpen}
                                buttonLabel=""
                                initialContext={{
                                    jobAnalysisId: savedAnalysisId,
                                    linkedJobAnalysis: {
                                        analysis: analysisResult,
                                        intakeData: intakeData,
                                        businessName: intakeData?.businessName,
                                        serviceType: analysisResult?.preview?.service_type || analysisResult?.full_package?.service_structure?.service_type,
                                        roleTitle: getPrimaryRoleTitle(),
                                    },
                                }}
                                showAnalysisBadge={true}
                                analysisBadgeData={{
                                    analysis: analysisResult,
                                    businessName: intakeData?.businessName,
                                }}
                                onViewAnalysis={() => {
                                    setIsCreateProcessDialogOpen(false);
                                    setTimeout(() => {
                                        const analysisElement = document.getElementById('analysis-display');
                                        if (analysisElement) {
                                            analysisElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        } else {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }, 100);
                                }}
                                onApplyAction={async (action: any) => {
                                    try {
                                        const generatedSOP = action?.sop || action?.refinedSOP;
                                        const formData = action?.formData;

                                        if (generatedSOP) {
                                            try {
                                                sessionStorage.setItem('pending-sop', JSON.stringify({
                                                    sop: generatedSOP,
                                                    formData: formData,
                                                    fromJobAnalysis: true,
                                                    jobAnalysisId: savedAnalysisId,
                                                }));
                                            } catch (e) {
                                                console.warn("Failed to store SOP in sessionStorage:", e);
                                            }

                                            router.push("/dashboard/process-builder");
                                            toast.success("Process created successfully!", {
                                                description: "Your SOP has been generated. You can view it on the Process Builder page.",
                                            });
                                            setIsCreateProcessDialogOpen(false);
                                        }
                                    } catch (error) {
                                        console.error("Error applying process creation:", error);
                                        toast.error("Failed to create process");
                                    }
                                }}
                                parseAction={(raw: unknown) => {
                                    if (typeof raw === 'object' && raw !== null) {
                                        const action = raw as any;
                                        if (action.sop) {
                                            return {
                                                ...action,
                                                sop: action.sop,
                                            };
                                        }
                                    }
                                    return raw;
                                }}
                            />
                        )}
                    </>
                )}

                <Dialog open={isToolChatOpen} onOpenChange={setIsToolChatOpen}>
                    <DialogContent className="w-[min(900px,95vw)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 sm:p-2">
                        <DialogHeader className="px-4 pt-4 pb-2">
                            <DialogTitle>{getToolChatConfig("role-builder").title}</DialogTitle>
                            <DialogDescription>
                                {getToolChatConfig("role-builder").description ?? "Use chat to describe what you want to build."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-4 pb-4 h-[calc(90vh-140px)]">
                            <ToolChat
                                toolId="role-builder"
                                mode="both"
                                className="h-full"
                                onApplyAction={async (action: any) => {
                                    try {
                                        const formData = action?.formData || {};
                                        const analysis = action?.analysis || {};

                                        const intakeData: IntakeFormData = {
                                            businessName: formData.businessName || organizationKB?.businessName || "",
                                            website: organizationKB?.website || "",
                                            businessGoal: formData.businessGoal === "__ORG_DEFAULT__"
                                                ? organizationKB?.primaryGoal || "Growth & Scale"
                                                : formData.businessGoal || "Growth & Scale",
                                            tasks: Array.isArray(formData.tasks) ? formData.tasks : [],
                                            outcome90Day: formData.outcome90Day || "",
                                            weeklyHours: formData.weeklyHours || organizationKB?.defaultWeeklyHours || "40",
                                            timezone: organizationKB?.defaultTimeZone || "",
                                            dailyOverlap: "",
                                            clientFacing: formData.clientFacing || "Yes",
                                            tools: formData.tools || "",
                                            englishLevel: formData.englishLevel === "__ORG_DEFAULT__"
                                                ? organizationKB?.defaultEnglishLevel || "Excellent"
                                                : formData.englishLevel || "Excellent",
                                            budgetBand: "",
                                            requirements: Array.isArray(formData.requirements) ? formData.requirements : [],
                                            existingSOPs: formData.existingSOPs || "No",
                                            examplesURL: "",
                                            reportingExpectations: formData.reportingExpectations || "",
                                            managementStyle: formData.managementStyle === "__ORG_DEFAULT__"
                                                ? organizationKB?.defaultManagementStyle || "Async"
                                                : formData.managementStyle || "Async",
                                            securityNeeds: formData.securityNeeds || "",
                                            dealBreakers: formData.dealBreakers || "",
                                            roleSplit: "",
                                            niceToHaveSkills: formData.niceToHaveSkills || "",
                                        };

                                        if (intakeFormRef.current) {
                                            intakeFormRef.current.setFormData(intakeData);
                                        }

                                        if (analysis && Object.keys(analysis).length > 0) {
                                            const result: AnalysisResult = {
                                                preview: analysis.preview ?? {
                                                    summary: {
                                                        company_stage: "",
                                                        outcome_90d: "",
                                                        primary_bottleneck: "",
                                                        role_recommendation: "",
                                                        sop_status: {
                                                            has_sops: false,
                                                            pain_points: [],
                                                            documentation_gaps: [],
                                                            summary: "",
                                                        },
                                                        workflow_analysis: "",
                                                    },
                                                    primary_outcome: "",
                                                    service_type: "",
                                                    service_confidence: "",
                                                    service_reasoning: "",
                                                    confidence: "",
                                                    key_risks: [],
                                                    critical_questions: [],
                                                },
                                                full_package: analysis.full_package,
                                                metadata: analysis.metadata,
                                            };

                                            setAnalysisResult(result);
                                            setIntakeData(intakeData);
                                            setAnalysisSource('chat');
                                            setHasNoSavedAnalyses(false);
                                            setSavedAnalysisId(null);

                                            const usedKnowledgeBaseVersion = analysis.knowledgeBase?.version ?? action?.kbDefaultsUsed?.length > 0 ? organizationKB?.version ?? null : null;
                                            const knowledgeBaseSnapshot = analysis.knowledgeBase?.snapshot ?? null;
                                            const organizationId = analysis.knowledgeBase?.organizationId ?? organizationKB?.organizationId ?? null;
                                            const contributedInsights = analysis.extractedInsights ?? null;

                                            const nextKbMetadata = {
                                                usedKnowledgeBaseVersion,
                                                knowledgeBaseSnapshot,
                                                organizationId,
                                                contributedInsights,
                                            };

                                            setKbMetadata(nextKbMetadata);

                                            setAnalysisError(null);
                                            setIsProcessing(false);

                                            try {
                                                const serviceType =
                                                    result.preview?.service_type ||
                                                    result.full_package?.service_structure?.service_type ||
                                                    "Job Description Analysis";
                                                const title = `${intakeData.businessName || "Analysis"} - ${serviceType}`;

                                                const saveResponse = await fetch("/api/jd/save", {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    credentials: "include",
                                                    body: JSON.stringify({
                                                        title,
                                                        intakeData,
                                                        analysis: result,
                                                        isFinalized: false,
                                                        organizationId: nextKbMetadata.organizationId ?? null,
                                                        usedKnowledgeBaseVersion: nextKbMetadata.usedKnowledgeBaseVersion ?? null,
                                                        knowledgeBaseSnapshot: nextKbMetadata.knowledgeBaseSnapshot ?? null,
                                                        contributedInsights: nextKbMetadata.contributedInsights ?? null,
                                                    }),
                                                });

                                                const saveData = await saveResponse.json().catch(() => ({}));
                                                if (saveResponse.ok && (saveData as any)?.savedAnalysis?.id) {
                                                    setSavedAnalysisId((saveData as any).savedAnalysis.id);
                                                } else if (!saveResponse.ok) {
                                                    console.error("Failed to auto-save analysis:", (saveData as any)?.error || saveData);
                                                    toast.error("Auto-save failed", {
                                                        description: "Your analysis is shown on the page, but it wasn’t saved. You can click Save to retry.",
                                                    });
                                                }
                                            } catch (e) {
                                                console.error("Error auto-saving analysis:", e);
                                                toast.error("Auto-save failed", {
                                                    description: "Your analysis is shown on the page, but it wasn’t saved. You can click Save to retry.",
                                                });
                                            }
                                        }

                                        setIsToolChatOpen(false);
                                    } catch (error) {
                                        console.error("Error applying chat action:", error);
                                        toast.error("Failed to display analysis", {
                                            description: error instanceof Error ? error.message : "An error occurred",
                                        });
                                    }
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
