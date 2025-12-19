import { LearningEventType } from "@prisma/client";
import { ExtractedInsight } from "../learning-events";

/**
 * Generic function to extract insights from any source type.
 * Routes to source-specific extractors based on sourceType.
 * 
 * @param sourceType - Type of source (JD, SOP, Conversation, etc.)
 * @param sourceData - The source data to extract insights from
 * @returns Array of extracted insights
 */
export function extractInsights(
  sourceType: "JOB_DESCRIPTION" | "SOP_GENERATION" | "CHAT_CONVERSATION",
  sourceData: any
): ExtractedInsight[] {
  switch (sourceType) {
    case "JOB_DESCRIPTION":
      return extractFromJdAnalysis(sourceData);
    case "SOP_GENERATION":
      return extractFromSopGeneration(sourceData);
    case "CHAT_CONVERSATION":
      return extractFromConversation(sourceData);
    default:
      console.warn(`Unknown source type: ${sourceType}`);
      return [];
  }
}

/**
 * Extracts insights from JD Analysis result.
 * Extracts from: discovery, serviceClassification, validation, architecture
 */
function extractFromJdAnalysis(analysisData: any): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];

  if (!analysisData) {
    return insights;
  }

  const fullPackage = analysisData.full_package || analysisData;
  const discovery = fullPackage.appendix?.discovery_insights || fullPackage.discovery_insights;
  const serviceClassification = fullPackage.appendix?.service_classification_details || fullPackage.service_classification_details;
  const validation = fullPackage.validation_report || fullPackage.validation;
  const architecture = fullPackage.service_structure || fullPackage.architecture;

  if (discovery?.business_context) {
    const bc = discovery.business_context;
    
    if (bc.company_stage) {
      insights.push({
        insight: `Company stage identified: ${bc.company_stage}`,
        category: "business_context",
        eventType: LearningEventType.INSIGHT_GENERATED,
        metadata: {
          sourceSection: "discovery.business_context",
          companyStage: bc.company_stage,
        },
      });
    }

    if (bc.primary_bottleneck) {
      insights.push({
        insight: `Primary bottleneck identified: ${bc.primary_bottleneck}`,
        category: "business_context",
        eventType: LearningEventType.INSIGHT_GENERATED,
        metadata: {
          sourceSection: "discovery.business_context",
          bottleneck: bc.primary_bottleneck,
        },
      });
    }

    if (bc.growth_indicators) {
      insights.push({
        insight: `Growth indicators: ${bc.growth_indicators}`,
        category: "business_context",
        eventType: LearningEventType.INSIGHT_GENERATED,
        metadata: {
          sourceSection: "discovery.business_context",
          growthIndicators: bc.growth_indicators,
        },
      });
    }

    if (bc.hidden_complexity) {
      insights.push({
        insight: `Hidden complexity identified: ${bc.hidden_complexity}`,
        category: "business_context",
        eventType: LearningEventType.INSIGHT_GENERATED,
        metadata: {
          sourceSection: "discovery.business_context",
          hiddenComplexity: bc.hidden_complexity,
        },
      });
    }
  }

  if (discovery?.task_analysis) {
    const ta = discovery.task_analysis;

    if (ta.task_clusters && Array.isArray(ta.task_clusters)) {
      ta.task_clusters.forEach((cluster: any, index: number) => {
        insights.push({
          insight: `Task cluster identified: ${cluster.cluster_name} (${cluster.tasks?.length || 0} tasks, ${cluster.workflow_type} workflow)`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          metadata: {
            sourceSection: "discovery.task_analysis.task_clusters",
            clusterIndex: index,
            workflowType: cluster.workflow_type,
            complexityScore: cluster.complexity_score,
            estimatedHours: cluster.estimated_hours_weekly,
          },
        });
      });
    }

    if (ta.implicit_needs && Array.isArray(ta.implicit_needs) && ta.implicit_needs.length > 0) {
      ta.implicit_needs.forEach((need: string) => {
        insights.push({
          insight: `Implicit need identified: ${need}`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          metadata: {
            sourceSection: "discovery.task_analysis.implicit_needs",
            implicitNeed: need,
          },
        });
      });
    }

    if (ta.skill_requirements) {
      const skills = ta.skill_requirements;
      const allSkills = [
        ...(skills.technical || []),
        ...(skills.soft || []),
        ...(skills.domain || []),
      ];
      
      if (allSkills.length > 0) {
        insights.push({
          insight: `Skill requirements identified: ${allSkills.length} total skills (${skills.technical?.length || 0} technical, ${skills.soft?.length || 0} soft, ${skills.domain?.length || 0} domain)`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          metadata: {
            sourceSection: "discovery.task_analysis.skill_requirements",
            skillCounts: {
              technical: skills.technical?.length || 0,
              soft: skills.soft?.length || 0,
              domain: skills.domain?.length || 0,
            },
          },
        });
      }
    }
  }

  if (discovery?.sop_insights) {
    const sop = discovery.sop_insights;

    if (sop.process_complexity) {
      insights.push({
        insight: `SOP process complexity: ${sop.process_complexity}`,
        category: "process_optimization",
        eventType: LearningEventType.OPTIMIZATION_FOUND,
        metadata: {
          sourceSection: "discovery.sop_insights",
          processComplexity: sop.process_complexity,
        },
      });
    }

    if (sop.pain_points && Array.isArray(sop.pain_points) && sop.pain_points.length > 0) {
      sop.pain_points.forEach((painPoint: string) => {
        insights.push({
          insight: `Process pain point identified: ${painPoint}`,
          category: "process_optimization",
          eventType: LearningEventType.OPTIMIZATION_FOUND,
          metadata: {
            sourceSection: "discovery.sop_insights.pain_points",
            painPoint: painPoint,
          },
        });
      });
    }

    if (sop.documentation_gaps && Array.isArray(sop.documentation_gaps) && sop.documentation_gaps.length > 0) {
      sop.documentation_gaps.forEach((gap: string) => {
        insights.push({
          insight: `Documentation gap identified: ${gap}`,
          category: "process_optimization",
          eventType: LearningEventType.OPTIMIZATION_FOUND,
          metadata: {
            sourceSection: "discovery.sop_insights.documentation_gaps",
            documentationGap: gap,
          },
        });
      });
    }
  }

  if (serviceClassification?.service_type_analysis) {
    const sta = serviceClassification.service_type_analysis;

    if (sta.recommended_service) {
      insights.push({
        insight: `Service type recommendation: ${sta.recommended_service} (confidence: ${sta.confidence || "unknown"})`,
        category: "service_patterns",
        eventType: LearningEventType.PATTERN_DETECTED,
        metadata: {
          sourceSection: "service_type_analysis",
          recommendedService: sta.recommended_service,
          confidence: sta.confidence,
          decisionLogic: sta.decision_logic,
        },
      });
    }

    if (sta.service_fit_scores) {
      const scores = sta.service_fit_scores;
      Object.keys(scores).forEach((serviceType: string) => {
        const score = scores[serviceType];
        if (score?.score) {
          insights.push({
            insight: `Service fit score for ${serviceType}: ${score.score}/10`,
            category: "service_patterns",
            eventType: LearningEventType.PATTERN_DETECTED,
            metadata: {
              sourceSection: "service_type_analysis.service_fit_scores",
              serviceType: serviceType,
              score: score.score,
            },
          });
        }
      });
    }
  }

  if (validation) {
    if (validation.risk_analysis && Array.isArray(validation.risk_analysis)) {
      validation.risk_analysis.forEach((risk: any) => {
        if (risk.severity === "high") {
          insights.push({
            insight: `High-severity risk identified: ${risk.risk} (category: ${risk.category})`,
            category: "risk_management",
            eventType: LearningEventType.INCONSISTENCY_FIXED,
            metadata: {
              sourceSection: "validation.risk_analysis",
              severity: risk.severity,
              category: risk.category,
              likelihood: risk.likelihood,
              impact: risk.impact,
            },
          });
        } else {
          insights.push({
            insight: `Risk identified: ${risk.risk} (${risk.severity} severity)`,
            category: "risk_management",
            eventType: LearningEventType.INSIGHT_GENERATED,
            metadata: {
              sourceSection: "validation.risk_analysis",
              severity: risk.severity,
              category: risk.category,
            },
          });
        }
      });
    }

    if (validation.assumptions_to_validate && Array.isArray(validation.assumptions_to_validate)) {
      validation.assumptions_to_validate
        .filter((a: any) => a.criticality === "high")
        .forEach((assumption: any) => {
          insights.push({
            insight: `Critical assumption requiring validation: ${assumption.assumption}`,
            category: "risk_management",
            eventType: LearningEventType.INSIGHT_GENERATED,
            metadata: {
              sourceSection: "validation.assumptions_to_validate",
              criticality: assumption.criticality,
              validationMethod: assumption.validation_method,
            },
          });
        });
    }

    if (validation.red_flags && Array.isArray(validation.red_flags)) {
      validation.red_flags.forEach((flag: any) => {
        insights.push({
          insight: `Red flag identified: ${flag.flag}`,
          category: "risk_management",
          eventType: LearningEventType.INCONSISTENCY_FIXED,
          metadata: {
            sourceSection: "validation.red_flags",
            evidence: flag.evidence,
            recommendation: flag.recommendation,
          },
        });
      });
    }
  }

  return insights;
}

/**
 * Extracts insights from SOP Generation result.
 * TODO: Implement when SOP generation structure is finalized
 */
function extractFromSopGeneration(sopData: any): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];

  // TODO: Implement SOP insight extraction
  // Extract from: sop content, intakeData, process patterns, tool usage, etc.

  return insights;
}

/**
 * Extracts insights from Business Conversation.
 * TODO: Implement when conversation structure is finalized
 */
function extractFromConversation(conversationData: any): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];

  // TODO: Implement conversation insight extraction
  // Extract from: messages, activeTopics, contextSummary, contributedInsights, etc.

  return insights;
}

