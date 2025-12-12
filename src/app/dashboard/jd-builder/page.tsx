"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import BaseIntakeForm, { BaseIntakeFormRef } from "@/components/forms/BaseIntakeForm";
import { jdFormConfig } from "@/components/forms/configs/jdFormConfig";
import RefinementForm from "@/components/forms/RefinementForm";
import { useUser } from "@/context/UserContext";
import { Briefcase, Sparkles, CheckCircle2, ShieldAlert, AlertTriangle, TrendingUp, Target, AlertCircle, Network, FileText, Plus, MoreVertical, Edit, Download, Save, History, Loader2 } from "lucide-react";
import { getConfidenceValue, getConfidenceColor } from '@/utils/confidence';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
        // Dedicated VA fields
        role_title?: string;
        hours_per_week?: number;
        // Unicorn VA fields
        core_va_title?: string;
        core_va_hours?: string | number;
        team_support_areas?: number;
        // Projects on Demand fields
        project_count?: number;
        total_hours?: string | number;
        estimated_timeline?: string;
    };
    full_package: {
        service_structure: {
            service_type: string;
            // Dedicated VA
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
            // Unicorn VA Service
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
            // Projects on Demand
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
            // Dedicated VA - flat structure
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
            // Unicorn VA Service
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
            // Projects on Demand
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
                week_1: string[];
                week_2: string[];
                week_3_4: string[];
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
    companyName: string;
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [intakeData, setIntakeData] = useState<IntakeFormData | null>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'overview' | 'roles' | 'implementation' | 'risks'>('summary');
    const tabsRef = useRef<HTMLDivElement>(null);
    const [tabContentHeight, setTabContentHeight] = useState<string>('calc(100vh)');
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
    const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
    const [currentStage, setCurrentStage] = useState<string>("");
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [isLoadingLatest, setIsLoadingLatest] = useState(false);
    const [hasNoSavedAnalyses, setHasNoSavedAnalyses] = useState(false);
    const intakeFormRef = useRef<BaseIntakeFormRef>(null);

    const handleSuccess = async ({ apiResult, input }: { apiResult: any; input: IntakeFormData }) => {
        setCurrentStage(""); // Reset stage when analysis completes
        setAnalysisError(null); // Clear any previous errors
        // Analysis is complete, so processing should be false
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

            // Automatically save the analysis
            try {
                // Generate a title from the analysis
                const title = `${input.companyName} - ${apiResult.preview?.service_type || apiResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

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
                    }),
                });

                const saveData = await saveResponse.json();

                if (!saveResponse.ok) {
                    console.error("Failed to save analysis:", saveData.error);
                    // Don't show error to user, just log it - analysis is still displayed
                } else {
                    console.log("Analysis saved successfully:", saveData.savedAnalysis);
                    // Store the saved analysis ID for refinement
                    if (saveData.savedAnalysis?.id) {
                        setSavedAnalysisId(saveData.savedAnalysis.id);
                    }
                }
            } catch (saveError) {
                console.error("Error saving analysis:", saveError);
                // Don't show error to user, just log it - analysis is still displayed
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
        } finally {
            // Ensure processing is false after handling results
            setIsProcessing(false);
            setCurrentStage(""); // Clear stage when done
        }
    };

    const handleNewAnalysis = () => {
        setAnalysisResult(null);
        setIntakeData(null);
        setAnalysisError(null);
        setIsModalOpen(true);
    };

    const summary = analysisResult?.preview?.summary || analysisResult?.full_package?.executive_summary?.what_you_told_us;
    const implementationPlan = analysisResult?.full_package?.implementation_plan;
    const riskManagement = analysisResult?.full_package?.risk_management;
    const monitoringPlan = riskManagement?.monitoring_plan;

    // Greeting based on time of day
    const getCurrentGreeting = () => {
        if (!user) return "Welcome";
        const hour = new Date().getHours();
        if (hour < 12) return `Good morning, ${user.firstname}`;
        if (hour < 18) return `Good afternoon, ${user.firstname}`;
        return `Good evening, ${user.firstname}`;
    };

    // Load latest saved analysis on mount if no analysis result
    useEffect(() => {
        const loadLatestAnalysis = async () => {
            if (!user || analysisResult || isLoadingLatest) return;

            setIsLoadingLatest(true);
            try {
                const response = await fetch("/api/jd/saved?page=1&limit=1", {
                    method: "GET",
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch saved analyses");
                }

                const data = await response.json();
                if (data.success && data.data?.analyses && data.data.analyses.length > 0) {
                    const latestAnalysis = data.data.analyses[0];
                    
                    // Map the saved analysis to the component's state
                    setAnalysisResult(latestAnalysis.analysis as AnalysisResult);
                    setIntakeData(latestAnalysis.intakeData as IntakeFormData);
                    setSavedAnalysisId(latestAnalysis.id);
                    setHasNoSavedAnalyses(false);
                } else {
                    // No saved analyses found
                    setHasNoSavedAnalyses(true);
                }
            } catch (error) {
                console.error("Error loading latest analysis:", error);
                // Don't show error to user, just mark as no saved analyses
                setHasNoSavedAnalyses(true);
            } finally {
                setIsLoadingLatest(false);
            }
        };

        loadLatestAnalysis();
    }, [user, analysisResult, isLoadingLatest]);

    // Calculate dynamic height for tab content
    useEffect(() => {
        const calculateHeight = () => {
            if (tabsRef.current) {
                const tabsTop = tabsRef.current.getBoundingClientRect().top;
                const viewportHeight = window.innerHeight;
                const padding = 32; // py-8 = 2rem top + 2rem bottom
                const headerHeight = 80; // Approximate header height
                const tabsHeight = 50; // Tabs height
                const calculatedHeight = viewportHeight - tabsTop - padding - tabsHeight;
                setTabContentHeight(`${Math.max(400, calculatedHeight)}px`);
            }
        };

        if (analysisResult && !isProcessing) {
            calculateHeight();
            window.addEventListener('resize', calculateHeight);
            return () => window.removeEventListener('resize', calculateHeight);
        }
    }, [analysisResult, isProcessing, activeTab]);

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
            // Mark as download to prevent NavigationLoader from intercepting
            a.setAttribute('data-download', 'true');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // Small delay to ensure download starts before cleanup
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
            // Generate a title from the analysis
            const title = `${intakeData.companyName} - ${analysisResult.preview?.service_type || analysisResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

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
                }),
            });

            const saveData = await saveResponse.json();

            if (!saveResponse.ok) {
                console.error("Failed to save analysis:", saveData.error);
                // TODO: Show error message to user
            } else {
                console.log("Analysis saved successfully:", saveData.savedAnalysis);
                // Store the saved analysis ID for refinement
                if (saveData.savedAnalysis?.id) {
                    setSavedAnalysisId(saveData.savedAnalysis.id);
                }
                // TODO: Show success message to user
            }
        } catch (error) {
            console.error("Error saving analysis:", error);
            // TODO: Show error message to user
        } finally {
            setActionsMenuOpen(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-2 p-4 border-b">
                <SidebarTrigger />
            </div>
            <div
                className="transition-all duration-300 ease-in-out h-screen flex flex-col overflow-hidden"
            >
                <div className="w-full p-4 md:p-8 pt-6 flex flex-col h-full">
                    {/* Header - Always Visible */}
                    <div className="flex-shrink-0 p-2">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-2xl font-semibold mb-1">
                                    Job Description Builder AI
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Create comprehensive job descriptions with AI-powered analysis
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {!isProcessing && (
                                    <Button
                                        onClick={() => setIsModalOpen(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>{analysisResult ? "New Analysis" : "Start Analysis"}</span>
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => router.push("/dashboard/jd-builder/history")}
                                >
                                    <History className="h-4 w-4" />
                                    History
                                </Button>
                            </div>
                        </div>

                        {/* Divider */}
                        <Separator />
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto ">
                        {/* Error State */}
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

                        {/* Processing State */}
                        {isProcessing && !analysisError && !isDownloading && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 mb-3 animate-spin" />
                                <h3 className="text-lg font-semibold mb-1">
                                    {currentStage || "Processing your analysis"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {currentStage ? "Please wait..." : "This may take a moment..."}
                                </p>
                            </div>
                        )}

                        {/* Downloading State */}
                        {isDownloading && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 mb-3 animate-spin" />
                                <h3 className="text-lg font-semibold mb-1">
                                    Preparing download...
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Generating PDF file
                                </p>
                            </div>
                        )}

                        {/* Loading Latest Analysis */}
                        {isLoadingLatest && !analysisResult && !isProcessing && !isDownloading && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 mb-3 animate-spin" />
                                <p className="text-sm text-muted-foreground">
                                    Loading your latest analysis...
                                </p>
                            </div>
                        )}

                        {/* Empty State - Only show if no saved analyses */}
                        {!analysisResult && !isProcessing && !isDownloading && !isLoadingLatest && hasNoSavedAnalyses && (
                            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                <div className="p-4 rounded-xl mb-4 bg-muted">
                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-base font-medium mb-1">
                                    {getCurrentGreeting()}
                                </h3>
                                <p className="text-sm mb-6 max-w-sm text-muted-foreground">
                                    Let's find your perfect virtual assistant. Start by creating a new analysis.
                                </p>
                                <Button
                                    onClick={() => setIsModalOpen(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Start New Analysis</span>
                                </Button>
                            </div>
                        )}

                        {/* Results State */}
                        {analysisResult && !isProcessing && !isDownloading && (
                            <Card className="flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                                {/* Header with Actions Menu */}
                                <CardHeader className="flex-shrink-0">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-xl mb-1">
                                                Analysis Results
                                            </CardTitle>
                                            <CardDescription>
                                                {analysisResult.preview.service_type || 'Your recommendations'}
                                            </CardDescription>
                                        </div>
                                        {/* Actions Dropdown */}
                                        <DropdownMenu open={actionsMenuOpen} onOpenChange={setActionsMenuOpen}>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem
                                                    onClick={async () => {
                                                        setActionsMenuOpen(false);
                                                        // Ensure analysis is saved before refining
                                                        if (!savedAnalysisId && analysisResult && intakeData && user) {
                                                            try {
                                                                const title = `${intakeData.companyName} - ${analysisResult.preview?.service_type || analysisResult.full_package?.service_structure?.service_type || 'Job Description Analysis'}`;

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
                                </CardHeader>

                                {/* Tabs */}
                                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
                                    <TabsList className="mx-6 mb-4">
                                        {(['summary', 'overview', 'roles', 'implementation', 'risks'] as const).map((tab) => (
                                            <TabsTrigger key={tab} value={tab} className="capitalize">
                                                {tab}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
                                        <TabsContent value="summary" className="mt-0 space-y-6">
                                            {/* What You Told Us Section */}
                                            <Card>
                                                <CardHeader>
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-lg flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                                <Sparkles className="w-4 h-4 text-primary" />
                                                            </div>
                                                            What You Told Us
                                                        </CardTitle>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setIsModalOpen(true)}
                                                        >
                                                            <Edit className="h-3.5 w-3.5 mr-1" />
                                                            Edit
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>

                                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                                        {/* Company Stage */}
                                                        <Card className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                    <TrendingUp className="w-4.5 h-4.5 text-primary" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company Stage</span>
                                                                    <p className="text-sm mt-0.5 font-medium">{summary?.company_stage}</p>
                                                                </div>
                                                            </div>
                                                        </Card>

                                                        {/* 90-Day Outcome */}
                                                        <Card className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                    <Target className="w-4.5 h-4.5 text-primary" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">90-Day Outcome</span>
                                                                    <p className="text-sm mt-0.5 font-medium leading-relaxed">{summary?.outcome_90d}</p>
                                                                </div>
                                                            </div>
                                                        </Card>

                                                        {/* Primary Bottleneck */}
                                                        <Card className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                    <AlertCircle className="w-4.5 h-4.5 text-primary" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Primary Bottleneck</span>
                                                                        <Badge variant="destructive">High Priority</Badge>
                                                                    </div>
                                                                    <p className="text-sm font-medium leading-relaxed">
                                                                        {summary?.primary_bottleneck}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </Card>

                                                        {/* Workflow Analysis */}
                                                        <Card className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                    <Network className="w-4.5 h-4.5 text-primary" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Workflow Analysis</span>
                                                                    <p className="text-sm leading-relaxed">{summary?.workflow_analysis}</p>
                                                                </div>
                                                            </div>
                                                        </Card>

                                                        {/* SOP Status */}
                                                        <Card className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                    <FileText className="w-4.5 h-4.5 text-primary" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                                                                        Documentation Status
                                                                    </span>
                                                                    <p className="text-sm leading-relaxed mb-3">
                                                                        {typeof summary?.sop_status === 'string'
                                                                            ? summary.sop_status
                                                                            : summary?.sop_status?.summary}
                                                                    </p>
                                                                    {summary?.sop_status?.has_sops && (
                                                                        <div className="space-y-3 mt-2">
                                                                            {summary.sop_status.pain_points?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        Process Pain Points
                                                                                    </p>
                                                                                    <ul className="space-y-1">
                                                                                        {summary.sop_status.pain_points.map((point: string, idx: number) => (
                                                                                            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5 pl-2">
                                                                                                <span className="text-destructive mt-0.5">•</span>
                                                                                                <span>{point}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                            {summary.sop_status.documentation_gaps?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                                                                                        <FileText className="w-3 h-3" />
                                                                                        Documentation Gaps
                                                                                    </p>
                                                                                    <ul className="space-y-1">
                                                                                        {summary.sop_status.documentation_gaps.map((gap: string, idx: number) => (
                                                                                            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5 pl-2">
                                                                                                <span className="text-amber-500 mt-0.5">•</span>
                                                                                                <span>{gap}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Card>

                                                        {/* Role Recommendation */}
                                                        {summary?.role_recommendation && (
                                                            <Card className="p-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <Target className="w-4.5 h-4.5 text-primary" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Role Recommendation</span>
                                                                        <p className="text-sm leading-relaxed">{summary.role_recommendation}</p>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        )}

                                                        {/* Key Insights */}
                                                        {analysisResult.full_package?.executive_summary?.key_insights && analysisResult.full_package.executive_summary.key_insights.length > 0 && (
                                                            <Card className="p-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <Sparkles className="w-4.5 h-4.5 text-primary" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Key Insights</span>
                                                                        <ul className="space-y-2">
                                                                            {analysisResult.full_package.executive_summary.key_insights.map((insight: string, idx: number) => (
                                                                                <li key={idx} className="text-sm leading-relaxed flex items-start gap-2">
                                                                                    <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                                                                    <span>{insight}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        )}
                                                    </div>

                                                    {/* Quick stats footer */}
                                                    <Separator className="mt-5" />
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>Analysis generated {new Date().toLocaleDateString()}</span>
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                            Verified
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="overview" className="mt-0 space-y-6">
                                            {/* Service Type */}
                                            {analysisResult.preview.service_type && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                                                            Recommended Service Type
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                <Sparkles className="w-4.5 h-4.5 text-primary" />
                                                            </div>
                                                            <CardTitle className="text-xl">
                                                                {analysisResult.preview.service_type}
                                                            </CardTitle>
                                                        </div>
                                                        {analysisResult.preview.service_reasoning && (
                                                            <p className="text-sm leading-relaxed mb-4">
                                                                {analysisResult.preview.service_reasoning}
                                                            </p>
                                                        )}
                                                        {analysisResult.preview.service_confidence && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                        Confidence
                                                                    </span>
                                                                    <span className="text-sm font-semibold">
                                                                        {analysisResult.preview.service_confidence}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${getConfidenceColor(analysisResult.preview.service_confidence)} transition-all duration-500 rounded-full`}
                                                                        style={{ width: `${getConfidenceValue(analysisResult.preview.service_confidence)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Key Risks */}
                                            {analysisResult.preview.key_risks && analysisResult.preview.key_risks.length > 0 && (
                                                <Card>
                                                    <CardHeader>
                                                        <div className="flex items-center gap-2">
                                                            <ShieldAlert className="w-4 h-4 text-destructive" />
                                                            <CardTitle className="text-lg">Key Risks</CardTitle>
                                                        </div>
                                                        <CardDescription>
                                                            Important risks to be aware of
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <ul className="space-y-2">
                                                            {analysisResult.preview.key_risks.map((risk: string, idx: number) => (
                                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                                                    <span className="leading-relaxed">{risk}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Critical Questions */}
                                            {analysisResult.preview.critical_questions && analysisResult.preview.critical_questions.length > 0 && (
                                                <Card>
                                                    <CardHeader>
                                                        <div className="flex items-center gap-2">
                                                            <AlertCircle className="w-4 h-4 text-primary" />
                                                            <CardTitle className="text-lg">Critical Questions</CardTitle>
                                                        </div>
                                                        <CardDescription>
                                                            Questions that need clarification
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <ul className="space-y-3">
                                                            {analysisResult.preview.critical_questions.map((question: string, idx: number) => (
                                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                                    <span className="font-semibold text-primary mt-0.5 flex-shrink-0">Q{idx + 1}:</span>
                                                                    <span className="leading-relaxed">{question}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Role/Project Information */}
                                            {analysisResult.preview.service_type === "Dedicated VA" && analysisResult.preview.role_title && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                                                            Role
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                <Briefcase className="w-4.5 h-4.5 text-primary" />
                                                            </div>
                                                            <CardTitle className="text-xl">
                                                                {analysisResult.preview.role_title}
                                                            </CardTitle>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {analysisResult.preview.hours_per_week && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                        Hours per Week:
                                                                    </span>
                                                                    <span className="text-sm ml-2">
                                                                        {analysisResult.preview.hours_per_week}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {analysisResult.preview.primary_outcome && (
                                                                <div>
                                                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                                                        Primary Outcome
                                                                    </p>
                                                                    <p className="text-sm leading-relaxed">
                                                                        {analysisResult.preview.primary_outcome}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Unicorn VA Service */}
                                            {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.preview.core_va_title && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                                                            Core Role
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                <Briefcase className="w-4.5 h-4.5 text-primary" />
                                                            </div>
                                                            <CardTitle className="text-xl">
                                                                {analysisResult.preview.core_va_title}
                                                            </CardTitle>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {analysisResult.preview.core_va_hours && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                        Hours per Week:
                                                                    </span>
                                                                    <span className="text-sm ml-2">
                                                                        {analysisResult.preview.core_va_hours}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {analysisResult.preview.team_support_areas && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                        Team Support Areas:
                                                                    </span>
                                                                    <span className="text-sm ml-2">
                                                                        {analysisResult.preview.team_support_areas}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Projects on Demand */}
                                            {analysisResult.preview.service_type === "Projects on Demand" && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                                                            Project Overview
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                <Briefcase className="w-4.5 h-4.5 text-primary" />
                                                            </div>
                                                            <CardTitle className="text-xl">
                                                                {analysisResult.preview.project_count || 0} Projects
                                                            </CardTitle>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {analysisResult.preview.total_hours && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                        Total Hours:
                                                                    </span>
                                                                    <span className="text-sm ml-2">
                                                                        {analysisResult.preview.total_hours}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {analysisResult.preview.estimated_timeline && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                                                        Estimated Timeline:
                                                                    </span>
                                                                    <span className="text-sm ml-2">
                                                                        {analysisResult.preview.estimated_timeline}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="roles" className="mt-0 space-y-4">
                                            {analysisResult.full_package?.service_structure && (
                                                <div className="space-y-4">
                                                    {/* Dedicated VA Role */}
                                                    {analysisResult.preview.service_type === "Dedicated VA" && analysisResult.full_package.service_structure.dedicated_va_role && (
                                                        <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden">
                                                            <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Dedicated VA Role
                                                                        </p>
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
                                                                                <Briefcase className="w-4.5 h-4.5 text-[var(--primary)] dark:text-[var(--accent)]" />
                                                                            </div>
                                                                            <h4 className="text-lg font-bold text-[var(--primary)]">
                                                                                {analysisResult.full_package.service_structure.dedicated_va_role.title}
                                                                            </h4>
                                                                        </div>
                                                                        <p className="text-sm text-[var(--text-secondary)]">
                                                                            {analysisResult.full_package.service_structure.dedicated_va_role.hours_per_week} hrs/week
                                                                        </p>
                                                                    </div>
                                                                    <svg
                                                                        className="w-5 h-5 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </div>
                                                            </summary>
                                                            <div className="p-4 space-y-4">
                                                                {analysisResult.full_package.service_structure.dedicated_va_role.core_responsibility && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Core Responsibility
                                                                        </p>
                                                                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                            {analysisResult.full_package.service_structure.dedicated_va_role.core_responsibility}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.service_structure.dedicated_va_role.task_allocation?.from_intake && analysisResult.full_package.service_structure.dedicated_va_role.task_allocation.from_intake.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Tasks
                                                                        </p>
                                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                            {analysisResult.full_package.service_structure.dedicated_va_role.task_allocation.from_intake.map((task: string, i: number) => (
                                                                                <li key={i}>{task}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Skill Requirements
                                                                        </p>
                                                                        <div className="space-y-3">
                                                                            {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.required?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Required
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.required.map((skill: string, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-md">
                                                                                                {skill}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.nice_to_have?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Nice to Have
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.service_structure.dedicated_va_role.skill_requirements.nice_to_have.map((skill: string, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 text-[var(--primary)] dark:text-[var(--accent)] text-xs rounded-md">
                                                                                                {skill}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </details>
                                                    )}

                                                    {/* Detailed JD for Dedicated VA */}
                                                    {analysisResult.preview.service_type === "Dedicated VA" && analysisResult.full_package.detailed_specifications && (
                                                        <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden mt-4">
                                                            <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <h4 className="text-base font-semibold text-[var(--primary)]">
                                                                            {analysisResult.full_package.detailed_specifications.title || "Full Job Description"}
                                                                        </h4>
                                                                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                                            Mission, Outcomes, Responsibilities, Skills, KPIs & More
                                                                        </p>
                                                                    </div>
                                                                    <svg
                                                                        className="w-5 h-5 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </div>
                                                            </summary>
                                                            <div className="p-4 space-y-4">
                                                                {analysisResult.full_package.detailed_specifications.mission_statement && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Mission Statement
                                                                        </p>
                                                                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                            {analysisResult.full_package.detailed_specifications.mission_statement}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.core_outcomes && analysisResult.full_package.detailed_specifications.core_outcomes.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Core Outcomes
                                                                        </p>
                                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                            {analysisResult.full_package.detailed_specifications.core_outcomes.map((outcome: string, i: number) => (
                                                                                <li key={i}>{outcome}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.skills_required && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Skills Required
                                                                        </p>
                                                                        <div className="space-y-3">
                                                                            {analysisResult.full_package.detailed_specifications.skills_required.technical?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Technical
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.detailed_specifications.skills_required.technical.map((skill: any, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-md">
                                                                                                {typeof skill === "string" ? skill : skill.skill || ""}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </details>
                                                    )}

                                                    {/* Unicorn VA Service - Core VA Role */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.core_va_role && (
                                                        <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden">
                                                            <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Core VA Role
                                                                        </p>
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
                                                                                <Briefcase className="w-4.5 h-4.5 text-[var(--primary)] dark:text-[var(--accent)]" />
                                                                            </div>
                                                                            <h4 className="text-lg font-bold text-[var(--primary)]">
                                                                                {analysisResult.full_package.service_structure.core_va_role.title}
                                                                            </h4>
                                                                        </div>
                                                                        <p className="text-sm text-[var(--text-secondary)]">
                                                                            {analysisResult.full_package.service_structure.core_va_role.hours_per_week} hrs/week
                                                                        </p>
                                                                    </div>
                                                                    <svg
                                                                        className="w-5 h-5 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </div>
                                                            </summary>
                                                            <div className="p-4 space-y-4">
                                                                {analysisResult.full_package.service_structure.core_va_role.core_responsibility && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Core Responsibility
                                                                        </p>
                                                                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                            {analysisResult.full_package.service_structure.core_va_role.core_responsibility}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.service_structure.core_va_role.recurring_tasks && analysisResult.full_package.service_structure.core_va_role.recurring_tasks.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Recurring Tasks
                                                                        </p>
                                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                            {analysisResult.full_package.service_structure.core_va_role.recurring_tasks.map((task: string, i: number) => (
                                                                                <li key={i}>{task}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.service_structure.core_va_role.skill_requirements && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Skill Requirements
                                                                        </p>
                                                                        <div className="space-y-3">
                                                                            {analysisResult.full_package.service_structure.core_va_role.skill_requirements.required?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Required
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.service_structure.core_va_role.skill_requirements.required.map((skill: string, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-md">
                                                                                                {skill}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {analysisResult.full_package.service_structure.core_va_role.skill_requirements.nice_to_have?.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Nice to Have
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.service_structure.core_va_role.skill_requirements.nice_to_have.map((skill: string, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-[var(--primary)]/10 dark:bg-[var(--accent)]/20 text-[var(--primary)] dark:text-[var(--accent)] text-xs rounded-md">
                                                                                                {skill}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.service_structure.core_va_role.workflow_ownership && analysisResult.full_package.service_structure.core_va_role.workflow_ownership.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Workflow Ownership
                                                                        </p>
                                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                            {analysisResult.full_package.service_structure.core_va_role.workflow_ownership.map((workflow: string, i: number) => (
                                                                                <li key={i}>{workflow}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </details>
                                                    )}

                                                    {/* Unicorn VA Service - Coordination Model */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.coordination_model && (
                                                        <Card>
                                                            <CardHeader>
                                                                <CardTitle className="text-lg flex items-center gap-2">
                                                                    <Network className="w-4 h-4" />
                                                                    Coordination Model
                                                                </CardTitle>
                                                                <CardDescription>
                                                                    How the core VA and team specialists work together
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <p className="text-sm leading-relaxed">{analysisResult.full_package.service_structure.coordination_model}</p>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Unicorn VA Service - Pros and Cons */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && (analysisResult.full_package.service_structure.pros || analysisResult.full_package.service_structure.cons) && (
                                                        <div className="grid md:grid-cols-2 gap-4">
                                                            {analysisResult.full_package.service_structure.pros && Array.isArray(analysisResult.full_package.service_structure.pros) && analysisResult.full_package.service_structure.pros.length > 0 && (
                                                                <Card>
                                                                    <CardHeader>
                                                                        <CardTitle className="text-lg flex items-center gap-2">
                                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                            Advantages
                                                                        </CardTitle>
                                                                    </CardHeader>
                                                                    <CardContent>
                                                                        <ul className="space-y-2">
                                                                            {analysisResult.full_package.service_structure.pros.map((pro: string, i: number) => (
                                                                                <li key={i} className="text-sm flex items-start gap-2">
                                                                                    <span className="text-green-500 mt-0.5">•</span>
                                                                                    <span>{pro}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </CardContent>
                                                                </Card>
                                                            )}
                                                            {analysisResult.full_package.service_structure.cons && Array.isArray(analysisResult.full_package.service_structure.cons) && analysisResult.full_package.service_structure.cons.length > 0 && (
                                                                <Card>
                                                                    <CardHeader>
                                                                        <CardTitle className="text-lg flex items-center gap-2">
                                                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                                            Considerations
                                                                        </CardTitle>
                                                                    </CardHeader>
                                                                    <CardContent>
                                                                        <ul className="space-y-2">
                                                                            {analysisResult.full_package.service_structure.cons.map((con: string, i: number) => (
                                                                                <li key={i} className="text-sm flex items-start gap-2">
                                                                                    <span className="text-amber-500 mt-0.5">•</span>
                                                                                    <span>{con}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </CardContent>
                                                                </Card>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Unicorn VA Service - Scaling Path */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.scaling_path && (
                                                        <Card>
                                                            <CardHeader>
                                                                <CardTitle className="text-lg flex items-center gap-2">
                                                                    <TrendingUp className="w-4 h-4" />
                                                                    Scaling Path
                                                                </CardTitle>
                                                                <CardDescription>
                                                                    How this structure evolves as needs grow
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <p className="text-sm leading-relaxed">{analysisResult.full_package.service_structure.scaling_path}</p>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Unicorn VA Service - Alternative Consideration */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.alternative_consideration && (
                                                        <Card>
                                                            <CardHeader>
                                                                <CardTitle className="text-lg flex items-center gap-2">
                                                                    <AlertCircle className="w-4 h-4" />
                                                                    Alternative Consideration
                                                                </CardTitle>
                                                                <CardDescription>
                                                                    When to consider a different service type
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <p className="text-sm leading-relaxed">{analysisResult.full_package.service_structure.alternative_consideration}</p>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Unicorn VA Service - Team Support Areas */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.service_structure.team_support_areas && Array.isArray(analysisResult.full_package.service_structure.team_support_areas) && analysisResult.full_package.service_structure.team_support_areas.length > 0 && (
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                                                                Team Support Areas
                                                            </h4>
                                                            {analysisResult.full_package.service_structure.team_support_areas.map((support: any, idx: number) => (
                                                                <details key={idx} className="group border border-[var(--border-color)] rounded-lg overflow-hidden">
                                                                    <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex-1">
                                                                                <h5 className="text-base font-semibold text-[var(--primary)]">
                                                                                    {support.skill_category}
                                                                                </h5>
                                                                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                                                    {support.estimated_hours_monthly} hrs/month
                                                                                </p>
                                                                            </div>
                                                                            <svg
                                                                                className="w-5 h-5 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                                fill="none"
                                                                                stroke="currentColor"
                                                                                viewBox="0 0 24 24"
                                                                            >
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                            </svg>
                                                                        </div>
                                                                    </summary>
                                                                    <div className="p-4 space-y-3">
                                                                        {support.why_team_not_va && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                                    Why Team Support
                                                                                </p>
                                                                                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                                    {support.why_team_not_va}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {support.use_cases && Array.isArray(support.use_cases) && support.use_cases.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                                    Use Cases
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                                    {support.use_cases.map((useCase: string, i: number) => (
                                                                                        <li key={i}>{useCase}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        {support.deliverables && Array.isArray(support.deliverables) && support.deliverables.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                                    Deliverables
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                                    {support.deliverables.map((deliverable: string, i: number) => (
                                                                                        <li key={i}>{deliverable}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        {support.example_requests && Array.isArray(support.example_requests) && support.example_requests.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                                    Example Requests
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                                    {support.example_requests.map((request: string, i: number) => (
                                                                                        <li key={i}>{request}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </details>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Unicorn VA Service - Team Support Specs (from detailed_specifications) */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.detailed_specifications?.team_support_specs && Array.isArray(analysisResult.full_package.detailed_specifications.team_support_specs) && analysisResult.full_package.detailed_specifications.team_support_specs.length > 0 && (
                                                        <div className="space-y-4 mt-4">
                                                            <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                                                                Team Support Specifications
                                                            </h4>
                                                            {analysisResult.full_package.detailed_specifications.team_support_specs.map((support: any, idx: number) => (
                                                                <Card key={idx}>
                                                                    <CardHeader>
                                                                        <CardTitle className="text-lg">{support.skill_category}</CardTitle>
                                                                        <CardDescription>
                                                                            {support.estimated_hours_monthly} hrs/month
                                                                        </CardDescription>
                                                                    </CardHeader>
                                                                    <CardContent className="space-y-3">
                                                                        {support.why_team_not_va && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                                                                    Why Team Support
                                                                                </p>
                                                                                <p className="text-sm leading-relaxed">
                                                                                    {support.why_team_not_va}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {support.use_cases && Array.isArray(support.use_cases) && support.use_cases.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                                                                    Use Cases
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                                                    {support.use_cases.map((useCase: string, i: number) => (
                                                                                        <li key={i}>{useCase}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        {support.deliverables && Array.isArray(support.deliverables) && support.deliverables.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                                                                    Deliverables
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                                                    {support.deliverables.map((deliverable: string, i: number) => (
                                                                                        <li key={i}>{deliverable}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        {support.example_requests && Array.isArray(support.example_requests) && support.example_requests.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                                                                    Example Requests
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                                                    {support.example_requests.map((request: string, i: number) => (
                                                                                        <li key={i}>{request}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Detailed JD for Unicorn VA Service - Core VA JD */}
                                                    {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.full_package.detailed_specifications?.core_va_jd && (
                                                        <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden mt-4">
                                                            <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <h4 className="text-base font-semibold text-[var(--primary)]">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.title || "Full Job Description - Core VA"}
                                                                        </h4>
                                                                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                                            Mission, Outcomes, Responsibilities, Skills, KPIs & More
                                                                        </p>
                                                                    </div>
                                                                    <svg
                                                                        className="w-5 h-5 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </div>
                                                            </summary>
                                                            <div className="p-4 space-y-4">
                                                                {analysisResult.full_package.detailed_specifications.core_va_jd.mission_statement && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Mission Statement
                                                                        </p>
                                                                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.mission_statement}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.core_va_jd.primary_outcome && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Primary Outcome
                                                                        </p>
                                                                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.primary_outcome}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.core_va_jd.core_outcomes && analysisResult.full_package.detailed_specifications.core_va_jd.core_outcomes.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Core Outcomes
                                                                        </p>
                                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.core_outcomes.map((outcome: string, i: number) => (
                                                                                <li key={i}>{outcome}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.core_va_jd.responsibilities && Array.isArray(analysisResult.full_package.detailed_specifications.core_va_jd.responsibilities) && analysisResult.full_package.detailed_specifications.core_va_jd.responsibilities.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Responsibilities
                                                                        </p>
                                                                        <div className="space-y-3">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.responsibilities.map((resp: any, i: number) => (
                                                                                <div key={i} className="border-l-2 pl-3 border-primary/20">
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        {resp.category}
                                                                                    </p>
                                                                                    {Array.isArray(resp.details) && (
                                                                                        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                                            {resp.details.map((detail: string, j: number) => (
                                                                                                <li key={j}>{detail}</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            Skills Required
                                                                        </p>
                                                                        <div className="space-y-3">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.technical && Array.isArray(analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.technical) && analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.technical.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Technical
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.technical.map((skill: any, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-md">
                                                                                                {typeof skill === "string" ? skill : skill.skill || ""}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.soft && Array.isArray(analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.soft) && analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.soft.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Soft Skills
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.soft.map((skill: any, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                                                                                                {typeof skill === "string" ? skill : skill.skill || ""}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.domain && Array.isArray(analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.domain) && analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.domain.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-sm font-medium text-[var(--primary)] mb-1">
                                                                                        Domain Knowledge
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {analysisResult.full_package.detailed_specifications.core_va_jd.skills_required.domain.map((skill: string, i: number) => (
                                                                                            <span key={i} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-md">
                                                                                                {skill}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {analysisResult.full_package.detailed_specifications.core_va_jd.kpis && Array.isArray(analysisResult.full_package.detailed_specifications.core_va_jd.kpis) && analysisResult.full_package.detailed_specifications.core_va_jd.kpis.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                            KPIs
                                                                        </p>
                                                                        <div className="space-y-2">
                                                                            {analysisResult.full_package.detailed_specifications.core_va_jd.kpis.map((kpi: any, i: number) => (
                                                                                <div key={i} className="p-3 rounded-lg bg-muted/50">
                                                                                    <p className="text-sm font-medium mb-1">{kpi.metric}</p>
                                                                                    {kpi.target && <p className="text-xs text-muted-foreground"><span className="font-medium">Target:</span> {kpi.target}</p>}
                                                                                    {kpi.frequency && <p className="text-xs text-muted-foreground"><span className="font-medium">Frequency:</span> {kpi.frequency}</p>}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </details>
                                                    )}

                                                    {/* Projects on Demand */}
                                                    {analysisResult.preview.service_type === "Projects on Demand" && (
                                                        <div className="space-y-4">
                                                            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                                                                Projects
                                                            </p>
                                                            {(analysisResult.full_package.detailed_specifications?.projects || analysisResult.full_package.service_structure.projects || []).map((project: any, idx: number) => (
                                                                <details key={idx} className="group border border-[var(--border-color)] rounded-lg overflow-hidden">
                                                                    <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex-1">
                                                                                <h5 className="text-base font-semibold text-[var(--primary)]">
                                                                                    {project.project_name}
                                                                                </h5>
                                                                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                                                    {project.estimated_hours || project.timeline?.estimated_hours} hrs • {typeof project.timeline === "string" ? project.timeline : project.timeline?.duration || "N/A"}
                                                                                </p>
                                                                            </div>
                                                                            <svg
                                                                                className="w-5 h-5 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                                fill="none"
                                                                                stroke="currentColor"
                                                                                viewBox="0 0 24 24"
                                                                            >
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                            </svg>
                                                                        </div>
                                                                    </summary>
                                                                    <div className="p-4 space-y-3">
                                                                        {project.objective && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                                    Objective
                                                                                </p>
                                                                                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                                    {project.objective}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {project.deliverables?.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                                                                                    Deliverables
                                                                                </p>
                                                                                <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                                                                                    {project.deliverables.map((del: any, i: number) => (
                                                                                        <li key={i}>
                                                                                            {typeof del === "string" ? del : del.item || del}
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </details>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="implementation" className="mt-0 space-y-6">
                                            {implementationPlan?.immediate_next_steps && implementationPlan.immediate_next_steps.length > 0 && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className="text-lg">Immediate Next Steps</CardTitle>
                                                        <CardDescription>
                                                            Action items to get started
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-4">
                                                            {implementationPlan.immediate_next_steps.map((item, index) => (
                                                                <div key={index} className="pb-4 border-b border-border last:border-0 last:pb-0">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                            <span className="text-xs font-semibold text-primary">{index + 1}</span>
                                                                        </div>
                                                                        <div className="flex-1 space-y-2">
                                                                            <h5 className="text-sm font-semibold">
                                                                                {item.step}
                                                                            </h5>
                                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                                <span><span className="font-medium">Owner:</span> {item.owner}</span>
                                                                                <span><span className="font-medium">Timeline:</span> {item.timeline}</span>
                                                                            </div>
                                                                            {item.output && (
                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                            <span className="font-medium">Output:</span> {item.output}
                                                                        </p>
                                                                    )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Onboarding Roadmap */}
                                            {implementationPlan?.onboarding_roadmap && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className="text-lg">Onboarding Roadmap</CardTitle>
                                                        <CardDescription>
                                                            Week-by-week onboarding plan
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-4">
                                                            {implementationPlan.onboarding_roadmap.week_1 && (
                                                                <div>
                                                                    <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                                        Week 1
                                                                    </h5>
                                                                    {typeof implementationPlan.onboarding_roadmap.week_1 === 'object' ? (
                                                                        Object.entries(implementationPlan.onboarding_roadmap.week_1).map(([key, value]: [string, any]) => (
                                                                            <div key={key} className="ml-4 mb-3">
                                                                                <p className="text-xs font-medium text-muted-foreground mb-1">{key}</p>
                                                                                {Array.isArray(value) ? (
                                                                                    <ul className="space-y-1">
                                                                                        {value.map((item: string, idx: number) => (
                                                                                            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                                <span className="text-primary mt-0.5">•</span>
                                                                                                <span>{item}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                ) : (
                                                                                    <p className="text-xs text-muted-foreground">{String(value)}</p>
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <ul className="space-y-1 ml-4">
                                                                            {Array.isArray(implementationPlan.onboarding_roadmap.week_1) && implementationPlan.onboarding_roadmap.week_1.map((item: string, idx: number) => (
                                                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                    <span className="text-primary mt-0.5">•</span>
                                                                                    <span>{item}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {implementationPlan.onboarding_roadmap.week_2 && (
                                                                <div>
                                                                    <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                                        Week 2
                                                                    </h5>
                                                                    {typeof implementationPlan.onboarding_roadmap.week_2 === 'object' ? (
                                                                        Object.entries(implementationPlan.onboarding_roadmap.week_2).map(([key, value]: [string, any]) => (
                                                                            <div key={key} className="ml-4 mb-3">
                                                                                <p className="text-xs font-medium text-muted-foreground mb-1">{key}</p>
                                                                                {Array.isArray(value) ? (
                                                                                    <ul className="space-y-1">
                                                                                        {value.map((item: string, idx: number) => (
                                                                                            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                                <span className="text-primary mt-0.5">•</span>
                                                                                                <span>{item}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                ) : (
                                                                                    <p className="text-xs text-muted-foreground">{String(value)}</p>
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <ul className="space-y-1 ml-4">
                                                                            {Array.isArray(implementationPlan.onboarding_roadmap.week_2) && implementationPlan.onboarding_roadmap.week_2.map((item: string, idx: number) => (
                                                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                    <span className="text-primary mt-0.5">•</span>
                                                                                    <span>{item}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {implementationPlan.onboarding_roadmap.week_3_4 && (
                                                                <div>
                                                                    <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                                        Weeks 3-4
                                                                    </h5>
                                                                    {typeof implementationPlan.onboarding_roadmap.week_3_4 === 'object' ? (
                                                                        Object.entries(implementationPlan.onboarding_roadmap.week_3_4).map(([key, value]: [string, any]) => (
                                                                            <div key={key} className="ml-4 mb-3">
                                                                                <p className="text-xs font-medium text-muted-foreground mb-1">{key}</p>
                                                                                {Array.isArray(value) ? (
                                                                                    <ul className="space-y-1">
                                                                                        {value.map((item: string, idx: number) => (
                                                                                            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                                <span className="text-primary mt-0.5">•</span>
                                                                                                <span>{item}</span>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                ) : (
                                                                                    <p className="text-xs text-muted-foreground">{String(value)}</p>
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <ul className="space-y-1 ml-4">
                                                                            {Array.isArray(implementationPlan.onboarding_roadmap.week_3_4) && implementationPlan.onboarding_roadmap.week_3_4.map((item: string, idx: number) => (
                                                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                    <span className="text-primary mt-0.5">•</span>
                                                                                    <span>{item}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Success Milestones */}
                                            {implementationPlan?.success_milestones && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className="text-lg">Success Milestones</CardTitle>
                                                        <CardDescription>
                                                            Key milestones to track progress
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-3">
                                                            {implementationPlan.success_milestones.week_2 && (
                                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <span className="text-xs font-semibold text-primary">2</span>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Week 2</p>
                                                                        <p className="text-sm">{implementationPlan.success_milestones.week_2}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {implementationPlan.success_milestones.week_4 && (
                                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <span className="text-xs font-semibold text-primary">4</span>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Week 4</p>
                                                                        <p className="text-sm">{implementationPlan.success_milestones.week_4}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {implementationPlan.success_milestones.week_8 && (
                                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <span className="text-xs font-semibold text-primary">8</span>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Week 8</p>
                                                                        <p className="text-sm">{implementationPlan.success_milestones.week_8}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {implementationPlan.success_milestones.week_12 && (
                                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <span className="text-xs font-semibold text-primary">12</span>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Week 12</p>
                                                                        <p className="text-sm">{implementationPlan.success_milestones.week_12}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="risks" className="mt-0 space-y-6">
                                            {riskManagement && (
                                                <div className="space-y-6">
                                                    {/* Risks */}
                                                    {riskManagement.risks?.length > 0 && (
                                                        <Card>
                                                            <CardHeader>
                                                                <div className="flex items-center gap-2">
                                                                    <ShieldAlert className="w-4 h-4 text-destructive" />
                                                                    <CardTitle className="text-lg">Risks</CardTitle>
                                                                </div>
                                                                <CardDescription>
                                                                    Potential risks and their mitigation strategies
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="space-y-4">
                                                                    {riskManagement.risks.map((r: any, i: number) => (
                                                                        <div key={i} className="border-l-2 pl-4 border-destructive/20">
                                                                            <div className="flex items-start justify-between mb-2">
                                                                                <p className="text-sm font-semibold">
                                                                                    {r.risk}
                                                                                </p>
                                                                                <div className="flex items-center gap-2">
                                                                                    {r.severity && (
                                                                                        <Badge variant={r.severity === 'high' ? 'destructive' : r.severity === 'medium' ? 'default' : 'secondary'}>
                                                                                            {r.severity}
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                                                {r.category && (
                                                                                    <p><span className="font-medium">Category:</span> {r.category}</p>
                                                                                )}
                                                                                {r.likelihood && (
                                                                                    <p><span className="font-medium">Likelihood:</span> {r.likelihood}</p>
                                                                                )}
                                                                                {r.impact && (
                                                                                    <p><span className="font-medium">Impact:</span> {r.impact}</p>
                                                                                )}
                                                                                {r.mitigation && (
                                                                                    <p className="mt-2 pt-2 border-t border-border">
                                                                                        <span className="font-medium text-primary">Mitigation:</span> {r.mitigation}
                                                                                    </p>
                                                                                )}
                                                                                {r.early_warning_signs && Array.isArray(r.early_warning_signs) && r.early_warning_signs.length > 0 && (
                                                                                    <div className="mt-2 pt-2 border-t border-border">
                                                                                        <p className="font-medium mb-1">Early Warning Signs:</p>
                                                                                        <ul className="space-y-1">
                                                                                            {r.early_warning_signs.map((sign: string, idx: number) => (
                                                                                                <li key={idx} className="flex items-start gap-2">
                                                                                                    <span className="text-amber-500 mt-0.5">•</span>
                                                                                                    <span>{sign}</span>
                                                                                                </li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Assumptions */}
                                                    {riskManagement.assumptions?.length > 0 && (
                                                        <Card>
                                                            <CardHeader>
                                                                <div className="flex items-center gap-2">
                                                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                                    <CardTitle className="text-lg">Assumptions</CardTitle>
                                                                </div>
                                                                <CardDescription>
                                                                    Key assumptions that need validation
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="space-y-4">
                                                                    {riskManagement.assumptions.map((a: any, i: number) => (
                                                                        <div key={i} className="border-l-2 pl-4 border-amber-500/20">
                                                                            <p className="text-sm font-semibold mb-2">
                                                                                {a.assumption}
                                                                            </p>
                                                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                                                {a.criticality && (
                                                                                    <p>
                                                                                        <span className="font-medium">Criticality:</span> 
                                                                                        <Badge variant={a.criticality === 'high' ? 'destructive' : a.criticality === 'medium' ? 'default' : 'secondary'} className="ml-2">
                                                                                            {a.criticality}
                                                                                        </Badge>
                                                                                    </p>
                                                                                )}
                                                                                {a.validation_method && (
                                                                                    <p><span className="font-medium">Validation Method:</span> {a.validation_method}</p>
                                                                                )}
                                                                                {a.if_wrong && (
                                                                                    <p className="mt-2 pt-2 border-t border-border">
                                                                                        <span className="font-medium text-destructive">If Wrong:</span> {a.if_wrong}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Red Flags */}
                                                    {riskManagement.red_flags?.length > 0 && (
                                                        <Card>
                                                            <CardHeader>
                                                                <div className="flex items-center gap-2">
                                                                    <AlertCircle className="w-4 h-4 text-destructive" />
                                                                    <CardTitle className="text-lg">Red Flags</CardTitle>
                                                                </div>
                                                                <CardDescription>
                                                                    Critical concerns that require immediate attention
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="space-y-4">
                                                                    {riskManagement.red_flags.map((flag: any, i: number) => (
                                                                        <div key={i} className="border-l-2 pl-4 border-destructive">
                                                                            <p className="text-sm font-semibold text-destructive mb-2">
                                                                                {flag.flag}
                                                                            </p>
                                                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                                                {flag.evidence && (
                                                                                    <p><span className="font-medium">Evidence:</span> {flag.evidence}</p>
                                                                                )}
                                                                                {flag.recommendation && (
                                                                                    <p className="mt-2 pt-2 border-t border-border">
                                                                                        <span className="font-medium text-primary">Recommendation:</span> {flag.recommendation}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                                    {/* Monitoring Plan */}
                                                    {monitoringPlan && (
                                                        <Card>
                                                            <CardHeader>
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                                                    <CardTitle className="text-lg">Monitoring Plan</CardTitle>
                                                                </div>
                                                                <CardDescription>
                                                                    Ongoing monitoring and quality checks
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="space-y-4">
                                                                    {monitoringPlan.high_priority_risks && monitoringPlan.high_priority_risks.length > 0 && (
                                                                        <div>
                                                                            <h5 className="text-sm font-semibold mb-3">High Priority Risks</h5>
                                                                            <div className="space-y-3">
                                                                                {monitoringPlan.high_priority_risks.map((risk: any, i: number) => (
                                                                                    <div key={i} className="p-3 rounded-lg bg-muted/50">
                                                                                        <p className="text-sm font-medium mb-2">{risk.risk}</p>
                                                                                        <p className="text-xs text-muted-foreground mb-2">
                                                                                            <span className="font-medium">Check-in:</span> {risk.check_in}
                                                                                        </p>
                                                                                        {risk.watch_for && Array.isArray(risk.watch_for) && risk.watch_for.length > 0 && (
                                                                                            <div>
                                                                                                <p className="text-xs font-medium text-muted-foreground mb-1">Watch For:</p>
                                                                                                <ul className="space-y-1">
                                                                                                    {risk.watch_for.map((item: string, idx: number) => (
                                                                                                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                                            <span className="text-primary mt-0.5">•</span>
                                                                                                            <span>{item}</span>
                                                                                                        </li>
                                                                                                    ))}
                                                                                                </ul>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {monitoringPlan.quality_checks && monitoringPlan.quality_checks.length > 0 && (
                                                                        <div>
                                                                            <h5 className="text-sm font-semibold mb-3">Quality Checkpoints</h5>
                                                                            <div className="space-y-3">
                                                                                {monitoringPlan.quality_checks.map((check: any, i: number) => (
                                                                                    <div key={i} className="p-3 rounded-lg bg-muted/50">
                                                                                        <p className="text-sm font-medium mb-2">{check.checkpoint}</p>
                                                                                        {check.assess && Array.isArray(check.assess) && (
                                                                                            <ul className="space-y-1">
                                                                                                {check.assess.map((item: string, idx: number) => (
                                                                                                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                                                        <span className="text-primary mt-0.5">•</span>
                                                                                                        <span>{item}</span>
                                                                                                    </li>
                                                                                                ))}
                                                                                            </ul>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {monitoringPlan.adjustment_triggers && monitoringPlan.adjustment_triggers.length > 0 && (
                                                                        <div>
                                                                            <h5 className="text-sm font-semibold mb-3">Adjustment Triggers</h5>
                                                                            <div className="space-y-2">
                                                                                {monitoringPlan.adjustment_triggers.map((trigger: any, i: number) => (
                                                                                    <div key={i} className="p-3 rounded-lg border border-border">
                                                                                        <p className="text-sm font-medium mb-1">{trigger.trigger}</p>
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            <span className="font-medium">Action:</span> {trigger.action}
                                                                                        </p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )}
                                                </div>
                                            )}
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </Card>
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
                        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                            <DialogHeader className="sr-only">
                                <DialogTitle>Job Description Analysis</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden p-4">
                                <BaseIntakeForm
                                    ref={intakeFormRef}
                                    userId={user.id}
                                    config={jdFormConfig}
                                    hideClearButton={true}
                                    onClose={() => {
                                        if (!isProcessing) {
                                            setIsModalOpen(false);
                                            setCurrentStage("");
                                        }
                                    }}
                                    onSuccess={async (data) => {
                                        // Close modal first, then handle success
                                        setIsModalOpen(false);
                                        await handleSuccess(data);
                                    }}
                                    onProgress={(stage) => {
                                        setCurrentStage(stage);
                                        setIsProcessing(true);
                                        setAnalysisError(null); // Clear errors when starting new analysis
                                        // Close modal when analysis starts so user can see progress
                                        setIsModalOpen(false);
                                    }}
                                    onError={(errorMessage) => {
                                        setAnalysisError(errorMessage);
                                        setIsProcessing(false);
                                        setCurrentStage("");
                                    }}
                                    onSubmit={async (formData, files) => {
                                        // Clear any previous errors
                                        setAnalysisError(null);

                                        try {
                                            // Transform form data to match API expected format
                                            const toolsArray = formData.tools
                                                ? formData.tools
                                                    .split(",")
                                                    .map((tool: string) => tool.trim())
                                                    .filter(Boolean)
                                                : [];

                                            const tasksArray = Array.isArray(formData.tasks)
                                                ? formData.tasks.filter((task: string) => task && task.trim()).slice(0, 5)
                                                : [];

                                            // Validate required fields
                                            if (!formData.companyName || !formData.companyName.trim()) {
                                                throw new Error("Company name is required");
                                            }
                                            if (tasksArray.length === 0) {
                                                throw new Error("At least one task is required");
                                            }

                                            const intakePayload = {
                                                brand: {
                                                    name: formData.companyName.trim(),
                                                },
                                                website: formData.website || "",
                                                business_goal: formData.businessGoal || "",
                                                outcome_90d: formData.outcome90Day || "",
                                                tasks_top5: tasksArray,
                                                requirements: Array.isArray(formData.requirements)
                                                    ? formData.requirements.filter((req: string) => req && req.trim())
                                                    : [],
                                                weekly_hours: parseInt(formData.weeklyHours || "0", 10) || 0,
                                                timezone: formData.timezone || "",
                                                client_facing: formData.clientFacing === "Yes",
                                                tools: toolsArray,
                                                tools_raw: formData.tools || "",
                                                english_level: formData.englishLevel || "",
                                                management_style: formData.managementStyle || "",
                                                reporting_expectations: formData.reportingExpectations || "",
                                                security_needs: formData.securityNeeds || "",
                                                deal_breakers: formData.dealBreakers || "",
                                                nice_to_have_skills: formData.niceToHaveSkills || "",
                                                existing_sops: formData.existingSOPs === "Yes",
                                                sop_filename: files.sopFile && files.sopFile.length > 0
                                                    ? files.sopFile.map(f => f.name).join(", ")
                                                    : null,
                                            };

                                            const payload = new FormData();
                                            payload.append("intake_json", JSON.stringify(intakePayload));

                                            // Handle SOP file upload (field id is 'sopFile')
                                            if (files.sopFile && Array.isArray(files.sopFile)) {
                                                files.sopFile.forEach((file) => {
                                                    payload.append("sopFile", file);
                                                });
                                            }

                                            const response = await fetch('/api/jd/analyze', {
                                                method: 'POST',
                                                body: payload,
                                            });

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
                                                    // Ignore JSON parse errors
                                                }
                                                const error = new Error(message);
                                                (error as any).userMessage = userMessage;
                                                throw error;
                                            }

                                            // Handle streaming response
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
                                                                // Store the error and break out of loops
                                                                const error = new Error(parsed.error || parsed.details || 'Analysis failed');
                                                                (error as any).userMessage = parsed.userMessage || parsed.error || parsed.details || 'Analysis failed';
                                                                streamError = error;
                                                                break; // Break out of for loop
                                                            }
                                                        } catch (parseError) {
                                                            // Only catch JSON parsing errors (SyntaxError), not API errors
                                                            if (parseError instanceof SyntaxError) {
                                                                // This is a JSON parse error, log and continue
                                                                console.error('Failed to parse stream chunk (JSON syntax error):', parseError);
                                                                continue;
                                                            } else {
                                                                // This is an API error, store it and break
                                                                streamError = parseError as Error;
                                                                break; // Break out of for loop
                                                            }
                                                        }
                                                    }

                                                    // If we got an error, break out of while loop
                                                    if (streamError) break;
                                                }
                                            } finally {
                                                reader.releaseLock();
                                            }

                                            // If we got an error from the stream, throw it
                                            if (streamError) {
                                                throw streamError;
                                            }

                                            // Process any remaining buffer (only if we didn't get an error)
                                            if (!streamError && buffer.trim()) {
                                                try {
                                                    const parsed = JSON.parse(buffer);
                                                    if (parsed.type === 'result' && parsed.data) {
                                                        finalData = parsed.data;
                                                    } else if (parsed.type === 'error') {
                                                        const error = new Error(parsed.error || parsed.details || 'Analysis failed');
                                                        (error as any).userMessage = parsed.userMessage || parsed.error || parsed.details || 'Analysis failed';
                                                        throw error; // This will be caught by outer catch
                                                    }
                                                } catch (parseError) {
                                                    // Only catch JSON parsing errors, not API errors
                                                    if (parseError instanceof SyntaxError) {
                                                        // This is a JSON parse error, log and continue
                                                        console.error('Failed to parse final buffer (JSON syntax error):', parseError);
                                                    } else {
                                                        // This is an API error (thrown from parsed.type === 'error'), re-throw it
                                                        throw parseError;
                                                    }
                                                }
                                            }

                                            // Only throw "No data received" if we didn't get an error from the API and no data
                                            if (!streamError && !finalData) {
                                                throw new Error('No data received from analysis');
                                            }

                                            return finalData;
                                        } catch (error) {
                                            // Set error state and stop processing
                                            const errorMessage = error instanceof Error
                                                ? ((error as any).userMessage || error.message)
                                                : 'An unexpected error occurred';
                                            setAnalysisError(errorMessage);
                                            setIsProcessing(false);
                                            setCurrentStage("");

                                            // Re-throw to prevent success handler from running
                                            throw error;
                                        }
                                    }}
                                    secondaryButton={
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => intakeFormRef.current?.triggerClearForm()}
                                        >
                                            Clear Form
                                        </Button>
                                    }
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isRefinementModalOpen} onOpenChange={setIsRefinementModalOpen}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
                            <DialogHeader>
                                <DialogTitle>Refine Analysis</DialogTitle>
                                <DialogDescription>
                                    Provide feedback on what you'd like to change in your analysis.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden">
                                {savedAnalysisId && user ? (
                                    <RefinementForm
                                        analysisId={savedAnalysisId}
                                        userId={user.id}
                                        serviceType={analysisResult?.preview?.service_type || analysisResult?.full_package?.service_structure?.service_type}
                                        onRefinementComplete={async (refinedPackage) => {
                                            // Update the analysis result with refined package
                                            if (analysisResult) {
                                                setAnalysisResult({
                                                    ...analysisResult,
                                                    full_package: refinedPackage,
                                                });
                                            }

                                            // Update the saved analysis in the database
                                            try {
                                                await fetch(`/api/jd/save`, {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                    },
                                                    credentials: "include",
                                                    body: JSON.stringify({
                                                        title: `${intakeData?.companyName || 'Analysis'} - ${analysisResult?.preview?.service_type || 'Job Description Analysis'}`,
                                                        intakeData,
                                                        analysis: {
                                                            ...analysisResult,
                                                            full_package: refinedPackage,
                                                        },
                                                        isFinalized: false,
                                                    }),
                                                });
                                            } catch (error) {
                                                console.error("Error updating saved analysis:", error);
                                            }

                                            setIsRefinementModalOpen(false);
                                        }}
                                    />
                                ) : (
                                    <div className="p-4 text-center text-muted-foreground">
                                        <p className="text-sm">Please save your analysis first before refining.</p>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </>
    );
}