import { LearningEventType } from "@prisma/client";
import { ExtractedInsight } from "../learning-events";

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
 * Validate extracted insight before adding to results
 */
function validateInsight(insight: ExtractedInsight): boolean {
  // Check required fields
  if (!insight.insight || !insight.category || !insight.eventType) {
    return false;
  }

  // Validate insight text length
  if (insight.insight.trim().length < 10 || insight.insight.trim().length > 1000) {
    return false;
  }

  // Validate category
  const validCategories = [
    "business_context",
    "workflow_patterns",
    "process_optimization",
    "service_patterns",
    "risk_management",
  ];
  if (!validCategories.includes(insight.category)) {
    return false;
  }

  // Validate confidence range
  if (insight.confidence !== undefined) {
    if (insight.confidence < 0 || insight.confidence > 100) {
      return false;
    }
  }

  return true;
}

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
      const insight: ExtractedInsight = {
        insight: `Company stage identified: ${bc.company_stage}`,
        category: "business_context",
        eventType: LearningEventType.INSIGHT_GENERATED,
        confidence: 85, // High confidence - directly from analysis
        metadata: {
          sourceSection: "discovery.business_context",
          companyStage: bc.company_stage,
        },
      };
      if (validateInsight(insight)) {
        insights.push(insight);
      }
    }

    if (bc.primary_bottleneck) {
      insights.push({
        insight: `Primary bottleneck identified: ${bc.primary_bottleneck}`,
        category: "business_context",
        eventType: LearningEventType.INSIGHT_GENERATED,
        confidence: 90, // Very high confidence - critical business insight
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
        confidence: 82, // High confidence - inferred but reliable
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
        confidence: 82, // High confidence - inferred but reliable
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
          confidence: 82, // High confidence - pattern detected from task analysis
          metadata: {
            sourceSection: "discovery.task_analysis.task_clusters",
            clusterIndex: index,
            workflowType: cluster.workflow_type,
            complexityScore: cluster.complexity_score,
            estimatedHours: cluster.estimated_hours_weekly,
            clusterName: cluster.cluster_name,
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
          confidence: 75, // Medium confidence - inferred, not explicit
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
          confidence: 75, // Medium confidence - aggregated summary data
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
        confidence: 82, // High confidence - from SOP analysis
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
          confidence: 85, // High confidence - directly identified from SOP
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
          confidence: 85, // High confidence - directly identified from SOP
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
      const analysisConfidence = sta.confidence === "High" ? 85 : 
                                 sta.confidence === "Medium" ? 80 : 
                                 sta.confidence === "Low" ? 75 : 82;
      
      insights.push({
        insight: `Service type recommendation: ${sta.recommended_service} (confidence: ${sta.confidence || "unknown"})`,
        category: "service_patterns",
        eventType: LearningEventType.PATTERN_DETECTED,
        confidence: analysisConfidence,
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
          const scoreConfidence = score.score >= 8 ? 85 : 
                                  score.score >= 6 ? 80 : 
                                  75;
          
          insights.push({
            insight: `Service fit score for ${serviceType}: ${score.score}/10`,
            category: "service_patterns",
            eventType: LearningEventType.PATTERN_DETECTED,
            confidence: scoreConfidence,
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
            confidence: 90, // Very high confidence - validated high-severity risk
            metadata: {
              sourceSection: "validation.risk_analysis",
              severity: risk.severity,
              category: risk.category,
              likelihood: risk.likelihood,
              impact: risk.impact,
              risk: risk.risk,
            },
          });
        } else {
          insights.push({
            insight: `Risk identified: ${risk.risk} (${risk.severity} severity)`,
            category: "risk_management",
            eventType: LearningEventType.INSIGHT_GENERATED,
            confidence: 75, // Medium confidence - less critical risk
            metadata: {
              sourceSection: "validation.risk_analysis",
              severity: risk.severity,
              category: risk.category,
              risk: risk.risk,
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
            confidence: 85,
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
          confidence: 90,
          metadata: {
            sourceSection: "validation.red_flags",
            evidence: flag.evidence,
            recommendation: flag.recommendation,
            risk: flag.flag,
          },
        });
      });
    }
  }

  return insights;
}


function extractFromSopGeneration(sopData: any): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];

  if (!sopData) {
    return insights;
  }

  // Extract data from sopData structure
  const sopContent = sopData.sopContent || sopData.content?.markdown || "";
  const intakeData = sopData.intakeData || {};
  const organizationProfile = sopData.organizationProfile || null;

  // Helper function to validate tool names (similar to apply-learning-events)
  const isValidToolName = (name: string): boolean => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;

    const commonWords = new Set([
      "the", "this", "that", "these", "those",
      "company", "business", "organization",
      "we", "they", "our", "your", "their",
      "using", "with", "through", "via",
      "system", "process", "procedure", "step",
    ]);

    const lower = trimmed.toLowerCase();
    if (commonWords.has(lower)) return false;

    if (!/[a-zA-Z]/.test(trimmed)) return false;

    return true;
  };

  // Helper to extract tools from text (markdown or plain text)
  const extractToolsFromText = (text: string): string[] => {
    const tools: Set<string> = new Set();
    
    if (!text) return [];

    // Pattern 1: Look for "Tools & Resources" section in markdown
    const toolsSectionMatch = text.match(/##\s*(?:12|TOOLS?\s*(?:&|AND)\s*RESOURCES?)[\s\S]*?(?=##|$)/i);
    if (toolsSectionMatch) {
      const toolsSection = toolsSectionMatch[0];
      // Extract bullet points or list items
      const listItems = toolsSection.match(/[-*•]\s*(.+?)(?:\n|$)/g) || [];
      for (const item of listItems) {
        const toolName = item.replace(/[-*•]\s*/, "").trim();
        if (isValidToolName(toolName)) {
          tools.add(toolName);
        }
      }
    }

    // Pattern 2: Look for capitalized tool names (Slack, Monday.com, etc.)
    const toolPattern = /\b([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?(?:\s+[A-Z][a-zA-Z0-9]+)*)\b/g;
    const matches = text.match(toolPattern);
    if (matches) {
      for (const match of matches) {
        const trimmed = match.trim();
        if (isValidToolName(trimmed) && trimmed.length >= 3 && /^[A-Za-z]/.test(trimmed)) {
          tools.add(trimmed);
        }
      }
    }

    return Array.from(tools);
  };

  // 1. Extract tools from intakeData.toolsUsed
  if (intakeData.toolsUsed && typeof intakeData.toolsUsed === "string") {
    const toolsFromIntake = intakeData.toolsUsed
      .split(",")
      .map((tool: string) => tool.trim())
      .filter((tool: string) => tool.length > 0 && isValidToolName(tool));

    for (const tool of toolsFromIntake) {
      insights.push({
        insight: `Tool used in process: ${tool}`,
        category: "workflow_patterns",
        eventType: LearningEventType.PATTERN_DETECTED,
        confidence: 90, // High confidence - explicitly provided by user
        metadata: {
          sourceSection: "intakeData.toolsUsed",
          tools: [tool],
          newTool: tool,
        },
      });
    }
  }

  // 2. Extract tools from SOP content
  if (sopContent) {
    const toolsFromContent = extractToolsFromText(sopContent);
    for (const tool of toolsFromContent) {
      // Skip if already added from intakeData
      const alreadyAdded = insights.some(
        (insight) =>
          insight.category === "workflow_patterns" &&
          insight.metadata?.tools?.includes(tool)
      );

      if (!alreadyAdded) {
        insights.push({
          insight: `Tool mentioned in SOP: ${tool}`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          confidence: 85, // High confidence - found in generated SOP
          metadata: {
            sourceSection: "sopContent.tools",
            tools: [tool],
            newTool: tool,
          },
        });
      }
    }
  }

  // 3. Extract tools from organization profile
  if (organizationProfile?.primaryTools) {
    const orgTools = organizationProfile.primaryTools
      .split(",")
      .map((tool: string) => tool.trim())
      .filter((tool: string) => tool.length > 0 && isValidToolName(tool));

    for (const tool of orgTools) {
      const alreadyAdded = insights.some(
        (insight) =>
          insight.category === "workflow_patterns" &&
          insight.metadata?.tools?.includes(tool)
      );

      if (!alreadyAdded) {
        insights.push({
          insight: `Organization tool used: ${tool}`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          confidence: 88, // High confidence - from org profile
          metadata: {
            sourceSection: "organizationProfile.primaryTools",
            tools: [tool],
            newTool: tool,
          },
        });
      }
    }
  }

  if (organizationProfile?.primaryCRM) {
    const crmTool = organizationProfile.primaryCRM.trim();
    if (isValidToolName(crmTool)) {
      const alreadyAdded = insights.some(
        (insight) =>
          insight.category === "workflow_patterns" &&
          insight.metadata?.tools?.includes(crmTool)
      );

      if (!alreadyAdded) {
        insights.push({
          insight: `Primary CRM/Platform: ${crmTool}`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          confidence: 90, // Very high confidence - from org profile
          metadata: {
            sourceSection: "organizationProfile.primaryCRM",
            tools: [crmTool],
            newTool: crmTool,
          },
        });
      }
    }
  }

  // 4. Extract process optimization insights from common mistakes
  if (intakeData.commonMistakes && typeof intakeData.commonMistakes === "string") {
    const mistakes = intakeData.commonMistakes
      .split(/[.;\n]/)
      .map((mistake: string) => mistake.trim())
      .filter((mistake: string) => mistake.length > 10);

    for (const mistake of mistakes) {
      insights.push({
        insight: `Process pain point identified: ${mistake}`,
        category: "process_optimization",
        eventType: LearningEventType.OPTIMIZATION_FOUND,
        confidence: 85, // High confidence - explicitly identified by user
        metadata: {
          sourceSection: "intakeData.commonMistakes",
          painPoint: mistake,
        },
      });
    }
  }

  // 5. Extract process complexity from intake data
  if (intakeData.mainSteps && typeof intakeData.mainSteps === "string") {
    const stepsCount = intakeData.mainSteps.split(/\n|\./).filter((s: string) => s.trim().length > 5).length;
    if (stepsCount > 10) {
      insights.push({
        insight: `Complex process identified: ${stepsCount} main steps in SOP`,
        category: "process_optimization",
        eventType: LearningEventType.OPTIMIZATION_FOUND,
        confidence: 75, // Medium confidence - inferred from step count
        metadata: {
          sourceSection: "intakeData.mainSteps",
          processComplexity: stepsCount > 15 ? "high" : "medium",
          stepCount: stepsCount,
        },
      });
    }
  }

  // 6. Extract workflow patterns from frequency and triggers
  if (intakeData.frequency && typeof intakeData.frequency === "string" && intakeData.frequency.trim().length > 3) {
    insights.push({
      insight: `Process frequency pattern: ${intakeData.frequency}`,
      category: "workflow_patterns",
      eventType: LearningEventType.PATTERN_DETECTED,
      confidence: 80, // High confidence - explicitly provided
      metadata: {
        sourceSection: "intakeData.frequency",
        frequency: intakeData.frequency,
      },
    });
  }

  if (intakeData.trigger && typeof intakeData.trigger === "string" && intakeData.trigger.trim().length > 5) {
    insights.push({
      insight: `Process trigger pattern: ${intakeData.trigger}`,
      category: "workflow_patterns",
      eventType: LearningEventType.PATTERN_DETECTED,
      confidence: 80, // High confidence - explicitly provided
      metadata: {
        sourceSection: "intakeData.trigger",
        trigger: intakeData.trigger,
      },
    });
  }

  // 7. Extract business context from department
  if (intakeData.department && typeof intakeData.department === "string" && intakeData.department.trim().length > 2) {
    insights.push({
      insight: `Department/Team context: ${intakeData.department}`,
      category: "business_context",
      eventType: LearningEventType.INSIGHT_GENERATED,
      confidence: 85, // High confidence - explicitly provided
      metadata: {
        sourceSection: "intakeData.department",
        department: intakeData.department,
      },
    });
  }

  // 8. Extract risk management from compliance requirements
  if (intakeData.complianceRequirements && typeof intakeData.complianceRequirements === "string") {
    const complianceText = intakeData.complianceRequirements.trim();
    if (complianceText.length > 10) {
      insights.push({
        insight: `Compliance requirement identified: ${complianceText.substring(0, 200)}${complianceText.length > 200 ? "..." : ""}`,
        category: "risk_management",
        eventType: LearningEventType.INSIGHT_GENERATED,
        confidence: 90, // Very high confidence - compliance is critical
        metadata: {
          sourceSection: "intakeData.complianceRequirements",
          complianceRequirement: complianceText,
        },
      });
    }
  }

  // 9. Extract process optimization from decision points
  if (intakeData.decisionPoints && typeof intakeData.decisionPoints === "string") {
    const decisionText = intakeData.decisionPoints.trim();
    if (decisionText.length > 10) {
      insights.push({
        insight: `Process decision points identified: ${decisionText.substring(0, 150)}${decisionText.length > 150 ? "..." : ""}`,
        category: "process_optimization",
        eventType: LearningEventType.OPTIMIZATION_FOUND,
        confidence: 82, // High confidence - indicates process complexity
        metadata: {
          sourceSection: "intakeData.decisionPoints",
          decisionPoints: decisionText,
        },
      });
    }
  }

  // 10. Extract workflow patterns from required resources
  if (intakeData.requiredResources && typeof intakeData.requiredResources === "string") {
    const resourcesText = intakeData.requiredResources.trim();
    if (resourcesText.length > 10) {
      // Check if resources mention tools
      const toolsFromResources = extractToolsFromText(resourcesText);
      for (const tool of toolsFromResources) {
        const alreadyAdded = insights.some(
          (insight) =>
            insight.category === "workflow_patterns" &&
            insight.metadata?.tools?.includes(tool)
        );

        if (!alreadyAdded) {
          insights.push({
            insight: `Tool from required resources: ${tool}`,
            category: "workflow_patterns",
            eventType: LearningEventType.PATTERN_DETECTED,
            confidence: 80, // Medium-high confidence - inferred from resources
            metadata: {
              sourceSection: "intakeData.requiredResources",
              tools: [tool],
              newTool: tool,
            },
          });
        }
      }
    }
  }

  // Validate all insights before returning
  return insights.filter((insight) => validateInsight(insight));
}

function extractFromConversation(conversationData: any): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];

  if (!conversationData) {
    return insights;
  }

  const { userMessage, assistantMessage, structuredInsights } = conversationData;
  if (structuredInsights && structuredInsights.has_insights) {
    const baseConfidence = structuredInsights.confidence || 75;
    if (structuredInsights.business_context) {
      const bc = structuredInsights.business_context;
      
      if (bc.bottleneck && bc.bottleneck.length > 10) {
        insights.push({
          insight: `Bottleneck identified: ${bc.bottleneck}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: Math.min(baseConfidence + 5, 90), // Boost confidence for bottlenecks
          metadata: {
            bottleneck: bc.bottleneck,
            sourceSection: "conversation.structured_insights.business_context",
          },
        });
      }

      if (bc.pain_point && bc.pain_point.length > 10) {
        insights.push({
          insight: `Pain point identified: ${bc.pain_point}`,
          category: "process_optimization",
          eventType: LearningEventType.OPTIMIZATION_FOUND,
          confidence: Math.min(baseConfidence + 3, 88),
          metadata: {
            painPoint: bc.pain_point,
            sourceSection: "conversation.structured_insights.business_context",
          },
        });
      }

      if (bc.growth_indicator && bc.growth_indicator.length > 10) {
        insights.push({
          insight: `Growth indicator: ${bc.growth_indicator}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: baseConfidence,
          metadata: {
            growthIndicators: bc.growth_indicator,
            sourceSection: "conversation.structured_insights.business_context",
          },
        });
      }

      if (bc.company_stage && ["startup", "growth", "established"].includes(bc.company_stage.toLowerCase())) {
        insights.push({
          insight: `Company stage: ${bc.company_stage}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: Math.min(baseConfidence + 5, 90),
          metadata: {
            companyStage: bc.company_stage.toLowerCase(),
            sourceSection: "conversation.structured_insights.business_context",
          },
        });
      }
    }

    // Process Optimization insights
    if (structuredInsights.process_optimization) {
      const po = structuredInsights.process_optimization;

      if (po.new_tool && po.new_tool.length > 3) {
        insights.push({
          insight: `New tool mentioned: ${po.new_tool}`,
          category: "workflow_patterns",
          eventType: LearningEventType.PATTERN_DETECTED,
          confidence: baseConfidence,
          metadata: {
            newTool: po.new_tool,
            sourceSection: "conversation.structured_insights.process_optimization",
          },
        });
      }

      if (po.process_change && po.process_change.length > 10) {
        insights.push({
          insight: `Process change mentioned: ${po.process_change}`,
          category: "process_optimization",
          eventType: LearningEventType.OPTIMIZATION_FOUND,
          confidence: baseConfidence,
          metadata: {
            processChange: po.process_change,
            sourceSection: "conversation.structured_insights.process_optimization",
          },
        });
      }

      if (po.documentation_gap && po.documentation_gap.length > 10) {
        insights.push({
          insight: `Documentation gap: ${po.documentation_gap}`,
          category: "process_optimization",
          eventType: LearningEventType.OPTIMIZATION_FOUND,
          confidence: baseConfidence,
          metadata: {
            documentationGap: po.documentation_gap,
            sourceSection: "conversation.structured_insights.process_optimization",
          },
        });
      }
    }

    // Customer/Market insights
    if (structuredInsights.customer_market) {
      const cm = structuredInsights.customer_market;

      if (cm.new_objection && cm.new_objection.length > 10) {
        insights.push({
          insight: `New objection identified: ${cm.new_objection}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: Math.min(baseConfidence + 5, 90),
          metadata: {
            objection: cm.new_objection,
            sourceSection: "conversation.structured_insights.customer_market",
          },
        });
      }

      if (cm.customer_feedback && cm.customer_feedback.length > 10) {
        insights.push({
          insight: `Customer feedback: ${cm.customer_feedback}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: baseConfidence,
          metadata: {
            customerFeedback: cm.customer_feedback,
            sourceSection: "conversation.structured_insights.customer_market",
          },
        });
      }

      if (cm.market_insight && cm.market_insight.length > 10) {
        insights.push({
          insight: `Market insight: ${cm.market_insight}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: baseConfidence,
          metadata: {
            marketInsight: cm.market_insight,
            sourceSection: "conversation.structured_insights.customer_market",
          },
        });
      }
    }

    // Knowledge Gap insights
    if (structuredInsights.knowledge_gap) {
      const kg = structuredInsights.knowledge_gap;

      if (kg.question_asked && kg.question_asked.length > 10) {
        insights.push({
          insight: `Knowledge gap identified: ${kg.question_asked}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: Math.min(baseConfidence + 2, 85),
          metadata: {
            question: kg.question_asked,
            missingInfo: kg.missing_info || "unknown",
            sourceSection: "conversation.structured_insights.knowledge_gap",
          },
        });
      }
    }

    // Compliance insights
    if (structuredInsights.compliance) {
      const comp = structuredInsights.compliance;

      if (comp.regulatory_mention && comp.regulatory_mention.length > 10) {
        insights.push({
          insight: `Regulatory mention: ${comp.regulatory_mention}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: Math.min(baseConfidence + 5, 90),
          metadata: {
            regulatoryMention: comp.regulatory_mention,
            sourceSection: "conversation.structured_insights.compliance",
          },
        });
      }

      if (comp.forbidden_claim && comp.forbidden_claim.length > 10) {
        insights.push({
          insight: `Forbidden claim mentioned: ${comp.forbidden_claim}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: Math.min(baseConfidence + 3, 88),
          metadata: {
            forbiddenClaim: comp.forbidden_claim,
            sourceSection: "conversation.structured_insights.compliance",
          },
        });
      }
    }

    return insights; // Return early if using structured insights
  }

  // Fallback to basic keyword matching if no structured insights provided

  // Extract insights from user message (questions, requests, new information)
  if (userMessage) {
    const userMsgLower = userMessage.toLowerCase();

    // Detect questions about missing information
    const questionPatterns = [
      /(?:what|how|when|where|why|who|can you|do you know|tell me about)\s+(.+?)(?:\?|$)/gi,
    ];

    for (const pattern of questionPatterns) {
      const matches = userMessage.matchAll(pattern);
      for (const match of matches) {
        const question = match[1]?.trim();
        if (question && question.length > 10) {
          insights.push({
            insight: `User asked about: ${question}`,
            category: "business_context",
            eventType: LearningEventType.INSIGHT_GENERATED,
            confidence: 75, // Medium confidence - question might indicate missing info
            metadata: {
              sourceSection: "conversation.user_message",
              question: question,
              type: "information_request",
            },
          });
        }
      }
    }

    const painPointPatterns = [
      /(?:struggling|problem|issue|challenge|difficulty|pain|frustrated|stuck|blocked|can't|unable to)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of painPointPatterns) {
      const matches = userMessage.matchAll(pattern);
      for (const match of matches) {
        const painPoint = match[1]?.trim();
        if (painPoint && painPoint.length > 10) {
          insights.push({
            insight: `Pain point mentioned: ${painPoint}`,
            category: "process_optimization",
            eventType: LearningEventType.OPTIMIZATION_FOUND,
            confidence: 82,
            metadata: {
              sourceSection: "conversation.user_message",
              painPoint: painPoint,
            },
          });
        }
      }
    }

    if (!userMsgLower.includes("?") && userMsgLower.length > 20) {
      const isStatement = !userMsgLower.startsWith("/") && 
                          !userMsgLower.match(/^(?:help|what|how|when|where|why|who|can|do|is|are|will)/);
      
      if (isStatement) {
        insights.push({
          insight: `New information shared: ${userMessage.substring(0, 100)}${userMessage.length > 100 ? "..." : ""}`,
          category: "business_context",
          eventType: LearningEventType.INSIGHT_GENERATED,
          confidence: 78, // Medium-high confidence - user-provided information
          metadata: {
            sourceSection: "conversation.user_message",
            information: userMessage,
            type: "user_provided_info",
          },
        });
      }
    }
  }

  if (assistantMessage) {
    const assistantMsgLower = assistantMessage.toLowerCase();
    const kbFieldPatterns = [
      { pattern: /(?:brand voice|voice style|tone)/i, field: "brandVoiceStyle" },
      { pattern: /(?:ideal customer|target audience|icp)/i, field: "idealCustomer" },
      { pattern: /(?:core offer|main offer|primary offer)/i, field: "coreOffer" },
      { pattern: /(?:top objection|main objection|common objection)/i, field: "topObjection" },
      { pattern: /(?:bottleneck|blocker|challenge)/i, field: "biggestBottleNeck" },
      { pattern: /(?:tool|software|crm|platform)/i, field: "toolStack" },
    ];

    for (const { pattern, field } of kbFieldPatterns) {
      if (pattern.test(assistantMessage)) {
        insights.push({
          insight: `Conversation discussed: ${field}`,
          category: "business_context",
          eventType: LearningEventType.PATTERN_DETECTED,
          confidence: 70, // Medium confidence - indicates topic relevance
          metadata: {
            sourceSection: "conversation.assistant_message",
            discussedField: field,
            type: "topic_discussed",
          },
        });
      }
    }
  }

  return insights;
}

