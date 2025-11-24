"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "@/components/ui/Navbar";
import Modal from "@/components/ui/Modal";
import IntakeForm from "@/components/forms/IntakeForm";
import { useUser } from "@/context/UserContext";
import { Briefcase, Sparkles, CheckCircle2, Flame, ShieldAlert, Flag, Activity, AlertTriangle, TrendingUp, Target, AlertCircle, Network, FileText, Lightbulb, Plus, MoreVertical, Edit, Download, Save } from "lucide-react";
import { getConfidenceValue, getConfidenceColor } from '@/utils/confidence';

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [intakeData, setIntakeData] = useState<IntakeFormData | null>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'overview' | 'roles' | 'implementation' | 'risks'>('summary');
    const tabsRef = useRef<HTMLDivElement>(null);
    const [tabContentHeight, setTabContentHeight] = useState<string>('calc(100vh)');
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

    const handleSuccess = ({ apiResult, input }: { apiResult: any; input: IntakeFormData }) => {
        setIsProcessing(true);
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
        } catch (e) {
            console.error("Failed to process API result:", e);
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
            setTimeout(() => {
                setIsProcessing(false);
            }, 1200);
        }
    };

    const handleNewAnalysis = () => {
        setAnalysisResult(null);
        setIntakeData(null);
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

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuOpen) {
                setActionsMenuOpen(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [actionsMenuOpen]);

    const handleDownload = () => {
        // TODO: Implement download functionality
        console.log("Download analysis");
        setActionsMenuOpen(false);
    };

    const handleSave = () => {
        // TODO: Implement save functionality
        console.log("Save analysis");
        setActionsMenuOpen(false);
    };

    return (
        <>
            <Navbar />
            <div
                className="transition-all duration-300 ease-in-out min-h-screen"
                style={{ marginLeft: "var(--sidebar-width, 16rem)" }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header - Always Visible */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1
                                className="text-2xl font-semibold mb-1"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Job Description Builder AI
                            </h1>
                            <p
                                className="text-sm"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Create comprehensive job descriptions with AI-powered analysis
                            </p>
                        </div>
                        {!isProcessing && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
                                style={{
                                    backgroundColor: "var(--accent)",
                                    color: "#000",
                                }}
                            >
                                <Plus size={18} />
                                <span>{analysisResult ? "New Analysis" : "Start Analysis"}</span>
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="mb-6 border-b" style={{ borderColor: "var(--border-color)" }} />

                    {/* Main Content Area - Consistent Structure */}
                    <div

                    >
                        {/* Processing State */}
                        {isProcessing && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <svg className="animate-spin h-8 w-8 mb-3" viewBox="0 0 24 24" style={{ color: "var(--accent)" }}>
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
                                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                                    Processing your analysis
                                </h3>
                                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                    This may take a moment...
                                </p>
                            </div>
                        )}

                        {/* Empty State */}
                        {!analysisResult && !isProcessing && (
                            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                <div
                                    className="p-4 rounded-xl mb-4"
                                    style={{
                                        backgroundColor: "var(--hover-bg)",
                                    }}
                                >
                                    <FileText
                                        size={40}
                                        style={{ color: "var(--text-secondary)" }}
                                    />
                                </div>
                                <h3
                                    className="text-base font-medium mb-1"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {getCurrentGreeting()}
                                </h3>
                                <p
                                    className="text-sm mb-6 max-w-sm"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Let's find your perfect virtual assistant. Start by creating a new analysis.
                                </p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
                                    style={{
                                        backgroundColor: "var(--accent)",
                                        color: "#000",
                                    }}
                                >
                                    <Plus size={16} />
                                    <span>Start New Analysis</span>
                                </button>
                            </div>
                        )}

                        {/* Results State */}
                        {analysisResult && !isProcessing && (
                            <div className="rounded-lg border" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card-bg)" }}>
                                {/* Header with Actions Menu */}
                                <div className="p-6 border-b" style={{ borderColor: "var(--border-color)" }}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                                                Analysis Results
                                            </h3>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                {analysisResult.preview.service_type || 'Your recommendations'}
                                            </p>
                                        </div>
                                        {/* Actions Dropdown */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActionsMenuOpen(!actionsMenuOpen);
                                                }}
                                                className="w-9 h-9 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--hover-bg)]"
                                                style={{
                                                    borderColor: "var(--border-color)",
                                                    backgroundColor: "var(--card-bg)",
                                                    color: "var(--text-secondary)",
                                                }}
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                            {actionsMenuOpen && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionsMenuOpen(false);
                                                        }}
                                                    />
                                                    <div
                                                        className="absolute right-0 top-full mt-2 w-48 rounded-lg border shadow-lg z-20 overflow-hidden"
                                                        style={{
                                                            borderColor: "var(--border-color)",
                                                            backgroundColor: "var(--card-bg)",
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsModalOpen(true);
                                                                setActionsMenuOpen(false);
                                                            }}
                                                            className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                            style={{ color: "var(--text-primary)" }}
                                                        >
                                                            <Edit size={16} />
                                                            <span>Edit</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownload();
                                                            }}
                                                            className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                            style={{ color: "var(--text-primary)" }}
                                                        >
                                                            <Download size={16} />
                                                            <span>Download</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSave();
                                                            }}
                                                            className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--hover-bg)] flex items-center gap-3 border-t"
                                                            style={{
                                                                color: "var(--text-primary)",
                                                                borderColor: "var(--border-color)",
                                                            }}
                                                        >
                                                            <Save size={16} />
                                                            <span>Save</span>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="mb-4 flex gap-1 border-b px-6 pt-4" style={{ borderColor: "var(--border-color)" }}>
                                    {(['summary', 'overview', 'roles', 'implementation', 'risks'] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-2 text-sm font-medium transition-all duration-200 relative capitalize ${activeTab === tab ? "" : "opacity-60 hover:opacity-100"
                                                }`}
                                            style={{
                                                color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                                            }}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5"
                                                    style={{ backgroundColor: "var(--accent)" }}
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: tabContentHeight }}>
                                    <AnimatePresence mode="wait">
                                        {activeTab === 'summary' && (
                                            <motion.div
                                                key="summary"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                            >
                                                {/* What You Told Us Section */}
                                                <div className="bg-gradient-to-br from-[var(--card-bg)] to-[var(--card-bg)]/50 rounded-2xl border border-[var(--border-color)] p-6 shadow-sm">
                                                    {/* Header with optional collapse/edit actions */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="text-lg font-semibold text-[var(--primary)] flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                                                                <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                                                            </div>
                                                            What You Told Us
                                                        </h3>
                                                        <button
                                                            onClick={() => setIsModalOpen(true)}
                                                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors flex items-center gap-1"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                            Edit
                                                        </button>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {/* Company Stage */}
                                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
                                                            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                                                <TrendingUp className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Company Stage</span>
                                                                <p className="text-sm text-[var(--text-primary)] mt-0.5 font-medium">{summary?.company_stage}</p>
                                                            </div>
                                                        </div>

                                                        {/* 90-Day Outcome */}
                                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
                                                            <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                                                                <Target className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">90-Day Outcome</span>
                                                                <p className="text-sm text-[var(--text-primary)] mt-0.5 font-medium leading-relaxed">{summary?.outcome_90d}</p>
                                                            </div>
                                                        </div>

                                                        {/* Primary Bottleneck */}
                                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
                                                            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 ring-2 ring-amber-200 dark:ring-amber-800">
                                                                <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Primary Bottleneck</span>
                                                                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full">
                                                                        High Priority
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-medium leading-relaxed text-[var(--text-primary)]">
                                                                    {summary?.primary_bottleneck}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Workflow Analysis */}
                                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
                                                            <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                                                                <Network className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">Workflow Analysis</span>
                                                                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{summary?.workflow_analysis}</p>
                                                            </div>
                                                        </div>

                                                        {/* SOP Status */}
                                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
                                                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
                                                                <FileText className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
                                                                    Documentation Status
                                                                </span>
                                                                <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-3">
                                                                    {typeof summary?.sop_status === 'string'
                                                                        ? summary.sop_status
                                                                        : summary?.sop_status?.summary}
                                                                </p>
                                                                {summary?.sop_status?.has_sops && (
                                                                    <div className="space-y-3 mt-2">
                                                                        {summary.sop_status.pain_points?.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                                                                                    <AlertCircle className="w-3 h-3" />
                                                                                    Process Pain Points
                                                                                </p>
                                                                                <ul className="space-y-1">
                                                                                    {summary.sop_status.pain_points.map((point: string, idx: number) => (
                                                                                        <li key={idx} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5 pl-2">
                                                                                            <span className="text-red-400 mt-0.5">•</span>
                                                                                            <span>{point}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        {summary.sop_status.documentation_gaps?.length > 0 && (
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                                                                                    <FileText className="w-3 h-3" />
                                                                                    Documentation Gaps
                                                                                </p>
                                                                                <ul className="space-y-1">
                                                                                    {summary.sop_status.documentation_gaps.map((gap: string, idx: number) => (
                                                                                        <li key={idx} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5 pl-2">
                                                                                            <span className="text-amber-400 mt-0.5">•</span>
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
                                                    </div>

                                                    {/* Quick stats footer */}
                                                    <div className="mt-5 pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                                        <span>Analysis generated {new Date().toLocaleDateString()}</span>
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                            Verified
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {activeTab === 'overview' && (
                                            <motion.div
                                                key="overview"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                            >
                                                {/* Service Type */}
                                                {analysisResult.preview.service_type && (
                                                    <div className="border border-[var(--border-color)] rounded-lg p-5">
                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                                                            Recommended Service Type
                                                        </p>
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                                                                <Sparkles className="w-4.5 h-4.5 text-[var(--accent)]" />
                                                            </div>
                                                            <p className="text-xl font-bold text-[var(--primary)]">
                                                                {analysisResult.preview.service_type}
                                                            </p>
                                                        </div>
                                                        {analysisResult.preview.service_reasoning && (
                                                            <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-4">
                                                                {analysisResult.preview.service_reasoning}
                                                            </p>
                                                        )}
                                                        {analysisResult.preview.service_confidence && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                                                                        Confidence
                                                                    </span>
                                                                    <span className="text-sm font-semibold text-[var(--primary)]">
                                                                        {analysisResult.preview.service_confidence}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${getConfidenceColor(analysisResult.preview.service_confidence)} transition-all duration-500 rounded-full`}
                                                                        style={{ width: `${getConfidenceValue(analysisResult.preview.service_confidence)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Role/Project Information */}
                                                {analysisResult.preview.service_type === "Dedicated VA" && analysisResult.preview.role_title && (
                                                    <div className="border border-[var(--border-color)] rounded-lg p-5">
                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                                                            Role
                                                        </p>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                                                <Briefcase className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                            <p className="text-xl font-bold text-[var(--primary)]">
                                                                {analysisResult.preview.role_title}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {analysisResult.preview.hours_per_week && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                                                                        Hours per Week:
                                                                    </span>
                                                                    <span className="text-sm text-[var(--text-primary)] ml-2">
                                                                        {analysisResult.preview.hours_per_week}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {analysisResult.preview.primary_outcome && (
                                                                <div>
                                                                    <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">
                                                                        Primary Outcome
                                                                    </p>
                                                                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                                                                        {analysisResult.preview.primary_outcome}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Unicorn VA Service */}
                                                {analysisResult.preview.service_type === "Unicorn VA Service" && analysisResult.preview.core_va_title && (
                                                    <div className="border border-[var(--border-color)] rounded-lg p-5">
                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                                                            Core Role
                                                        </p>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                                                                <Briefcase className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                                                            </div>
                                                            <p className="text-xl font-bold text-[var(--primary)]">
                                                                {analysisResult.preview.core_va_title}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {analysisResult.preview.core_va_hours && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                                                                        Hours per Week:
                                                                    </span>
                                                                    <span className="text-sm text-[var(--text-primary)] ml-2">
                                                                        {analysisResult.preview.core_va_hours}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {analysisResult.preview.team_support_areas && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                                                                        Team Support Areas:
                                                                    </span>
                                                                    <span className="text-sm text-[var(--text-primary)] ml-2">
                                                                        {analysisResult.preview.team_support_areas}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Projects on Demand */}
                                                {analysisResult.preview.service_type === "Projects on Demand" && (
                                                    <div className="border border-[var(--border-color)] rounded-lg p-5">
                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                                                            Project Overview
                                                        </p>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                                                                <Briefcase className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                                                            </div>
                                                            <p className="text-xl font-bold text-[var(--primary)]">
                                                                {analysisResult.preview.project_count || 0} Projects
                                                            </p>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {analysisResult.preview.total_hours && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                                                                        Total Hours:
                                                                    </span>
                                                                    <span className="text-sm text-[var(--text-primary)] ml-2">
                                                                        {analysisResult.preview.total_hours}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {analysisResult.preview.estimated_timeline && (
                                                                <div>
                                                                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                                                                        Estimated Timeline:
                                                                    </span>
                                                                    <span className="text-sm text-[var(--text-primary)] ml-2">
                                                                        {analysisResult.preview.estimated_timeline}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}

                                        {activeTab === 'roles' && (
                                            <motion.div
                                                key="roles"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-4"
                                            >
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
                                                                                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                                                                    <Briefcase className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
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
                                                                                                <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md">
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
                                            </motion.div>
                                        )}

                                        {activeTab === 'implementation' && (
                                            <motion.div
                                                key="implementation"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                            >
                                                {implementationPlan?.immediate_next_steps && implementationPlan.immediate_next_steps.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Immediate Next Steps</h4>
                                                        {implementationPlan.immediate_next_steps.map((item, index) => (
                                                            <div key={index} className="pb-3 border-b border-[var(--border-color)] last:border-0 last:pb-0">
                                                                <div className="flex items-start gap-3">
                                                                    <span className="text-xs font-medium text-[var(--text-secondary)] mt-0.5 min-w-[20px]">
                                                                        {index + 1}.
                                                                    </span>
                                                                    <div className="flex-1 space-y-1.5">
                                                                        <h5 className="text-sm font-medium text-[var(--text-primary)]">
                                                                            {item.step}
                                                                        </h5>
                                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                                                                            <span><span className="font-medium">Owner:</span> {item.owner}</span>
                                                                            <span><span className="font-medium">Timeline:</span> {item.timeline}</span>
                                                                        </div>
                                                                        {item.output && (
                                                                            <p className="text-xs text-[var(--text-secondary)]">
                                                                                {item.output}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}

                                        {activeTab === 'risks' && (
                                            <motion.div
                                                key="risks"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-6"
                                            >
                                                {riskManagement && (
                                                    <div>
                                                        <h4 className="text-base font-semibold text-[var(--primary)] mb-4">
                                                            Risk Management
                                                        </h4>
                                                        <div className="space-y-4">
                                                            {riskManagement.assumptions?.length > 0 && (
                                                                <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden">
                                                                    <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden transition-colors">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 ring-2 ring-amber-200 dark:ring-amber-800">
                                                                                <AlertTriangle className="w-4.5 h-4.5 text-amber-700 dark:text-amber-400" />
                                                                            </div>
                                                                            <h4 className="text-base font-semibold text-[var(--primary)]">
                                                                                Assumptions
                                                                            </h4>
                                                                        </div>
                                                                        <svg
                                                                            className="w-4 h-4 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </summary>
                                                                    <div className="p-4 space-y-4">
                                                                        {riskManagement.assumptions.map((a, i) => (
                                                                            <div key={i} className="border-l pl-3 border-[var(--border-color)]">
                                                                                <p className="text-sm font-semibold text-[var(--text-primary)]">
                                                                                    {a.assumption}
                                                                                </p>
                                                                                <p className="text-sm text-[var(--text-secondary)]">
                                                                                    <span className="font-medium">Criticality:</span> {a.criticality}
                                                                                </p>
                                                                                <p className="text-sm text-[var(--text-secondary)]">
                                                                                    <span className="font-medium">If wrong:</span> {a.if_wrong}
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            )}
                                                            {riskManagement.risks?.length > 0 && (
                                                                <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden">
                                                                    <summary className="cursor-pointer px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/80 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden transition-colors">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                                                                                <ShieldAlert className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
                                                                            </div>
                                                                            <h4 className="text-base font-semibold text-[var(--primary)]">
                                                                                Risks
                                                                            </h4>
                                                                        </div>
                                                                        <svg
                                                                            className="w-4 h-4 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </summary>
                                                                    <div className="p-4 space-y-4">
                                                                        {riskManagement.risks.map((r, i) => (
                                                                            <div key={i} className="border-l pl-3 border-[var(--border-color)]">
                                                                                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                                                                                    {r.risk}
                                                                                </p>
                                                                                <p className="text-sm text-[var(--text-secondary)] mb-1">
                                                                                    <span className="font-medium">Category:</span> {r.category}
                                                                                </p>
                                                                                <p className="text-sm text-[var(--text-secondary)]">
                                                                                    <span className="font-medium">Severity:</span> {r.severity}
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {user && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onConfirm={() => { }}
                    title=""
                    message=""
                    body={
                        <IntakeForm
                            userId={user.id}
                            onClose={() => setIsModalOpen(false)}
                            onSuccess={handleSuccess}
                        />
                    }
                    confirmText=""
                    cancelText=""
                    maxWidth="4xl"
                />
            )}
        </>
    );
}