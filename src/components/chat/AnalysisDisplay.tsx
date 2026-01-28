"use client";

import * as React from "react";
import { Briefcase, Target, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Wrench, BarChart3, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface AnalysisDisplayProps {
  analysis: {
    preview?: {
      service_type?: string;
      service_confidence?: string;
      service_reasoning?: string;
      primary_outcome?: string;
      role_title?: string;
      hours_per_week?: number | string;
      key_risks?: string[];
      critical_questions?: Array<{ question?: string; why_it_matters?: string } | string>;
    };
    full_package?: {
      service_structure?: {
        service_type?: string;
        dedicated_va_role?: {
          title?: string;
          hours_per_week?: number | string;
          core_responsibility?: string;
          skill_requirements?: {
            required?: string[];
            nice_to_have?: string[];
            growth_areas?: string[];
          };
          workflow_ownership?: string[];
        };
        core_va_role?: {
          title?: string;
          hours_per_week?: number | string;
          core_responsibility?: string;
          skill_requirements?: {
            required?: string[];
            nice_to_have?: string[];
          };
        };
      };
      detailed_specifications?: {
        title?: string;
        primary_outcome?: string;
        mission_statement?: string;
        core_outcomes?: string[];
        responsibilities?: Array<{
          category?: string;
          details?: string[];
        }>;
        skills_required?: {
          technical?: Array<{
            skill?: string;
            proficiency?: string;
            application?: string;
            example?: string;
          } | string>;
          soft?: Array<{
            skill?: string;
            why_critical?: string;
            demonstration?: string;
          } | string>;
          domain?: string[];
        };
        tools?: Array<{
          tool?: string;
          use_case?: string;
          proficiency?: string;
          training_available?: string;
        } | string>;
        kpis?: Array<{
          metric?: string;
          target?: string;
          frequency?: string;
          measurement_method?: string;
        } | string>;
      };
    };
  };
  onApply?: () => void;
  className?: string;
}

export function AnalysisDisplay({ analysis, onApply, className }: AnalysisDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const preview = analysis.preview || {};
  const detailedSpecs = analysis.full_package?.detailed_specifications || {};
  const serviceStructure = analysis.full_package?.service_structure || {};

  const roleTitle = preview.role_title ||
    serviceStructure.dedicated_va_role?.title ||
    serviceStructure.core_va_role?.title ||
    detailedSpecs.title ||
    "Role";

  const serviceType = preview.service_type || serviceStructure.service_type || "Job Description";
  const hours = preview.hours_per_week ||
    serviceStructure.dedicated_va_role?.hours_per_week ||
    serviceStructure.core_va_role?.hours_per_week ||
    "";
  const primaryOutcome = preview.primary_outcome || detailedSpecs.primary_outcome || "";
  const missionStatement = detailedSpecs.mission_statement || "";
  const coreOutcomes = detailedSpecs.core_outcomes || [];
  const responsibilities = detailedSpecs.responsibilities || [];
  const skills = detailedSpecs.skills_required || {};
  const tools = detailedSpecs.tools || [];
  const kpis = detailedSpecs.kpis || [];
  const keyRisks = preview.key_risks || [];
  const criticalQuestions = preview.critical_questions || [];

  // Get skill requirements from service structure if detailed specs don't have them
  const skillRequirements = serviceStructure.dedicated_va_role?.skill_requirements ||
    serviceStructure.core_va_role?.skill_requirements || null;

  return (
    <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground space-y-4", className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="font-semibold text-base">{roleTitle}</span>
          {preview.service_confidence && (
            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
              {preview.service_confidence} Confidence
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {serviceType}
          </span>
          {hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {hours} hrs/week
            </span>
          )}
        </div>
      </div>

      {/* Primary Outcome */}
      {primaryOutcome && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs uppercase tracking-wide">90-Day Outcome</span>
          </div>
          <p className="text-sm leading-relaxed">{primaryOutcome}</p>
        </div>
      )}

      {/* Mission Statement */}
      {missionStatement && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs uppercase tracking-wide">Mission</span>
          </div>
          <p className="text-sm leading-relaxed">{missionStatement}</p>
        </div>
      )}

      {/* Core Outcomes */}
      {coreOutcomes.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="font-semibold text-xs uppercase tracking-wide">Core Outcomes</span>
          </div>
          <ul className="space-y-1.5 pl-1">
            {coreOutcomes.map((outcome, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Responsibilities */}
      {responsibilities.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs uppercase tracking-wide">Responsibilities</span>
          </div>
          <div className="space-y-3">
            {responsibilities.map((resp, idx) => (
              <div key={idx}>
                {resp.category && (
                  <p className="font-medium text-sm mb-1.5">{resp.category}</p>
                )}
                {resp.details && resp.details.length > 0 && (
                  <ul className="space-y-1 pl-1">
                    {resp.details.map((detail, detailIdx) => (
                      <li key={detailIdx} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground mt-1">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills Required */}
      {((skills.technical?.length || 0) > 0 || (skills.soft?.length || 0) > 0 || (skills.domain?.length || 0) > 0 || skillRequirements) && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs uppercase tracking-wide">Skills Required</span>
          </div>
          <div className="space-y-3">
            {/* Technical Skills */}
            {skills.technical && skills.technical.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-1.5 text-primary">Technical</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.technical.map((skill, idx) => {
                    const skillName = typeof skill === 'string' ? skill : skill.skill || '';
                    return skillName ? (
                      <span key={idx} className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        {skillName}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Soft Skills */}
            {skills.soft && skills.soft.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-1.5 text-primary">Soft Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.soft.map((skill, idx) => {
                    const skillName = typeof skill === 'string' ? skill : skill.skill || '';
                    return skillName ? (
                      <span key={idx} className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {skillName}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Domain Knowledge */}
            {skills.domain && skills.domain.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-1.5 text-primary">Domain Knowledge</p>
                <ul className="space-y-1 pl-1">
                  {skills.domain.map((domain, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground mt-1">•</span>
                      <span>{domain}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skill Requirements from Service Structure */}
            {skillRequirements && (
              <>
                {skillRequirements.required && skillRequirements.required.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-1.5 text-primary">Required</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillRequirements.required.map((skill, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {skillRequirements.nice_to_have && skillRequirements.nice_to_have.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-1.5 text-primary">Nice to Have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillRequirements.nice_to_have.map((skill, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs uppercase tracking-wide">Tools</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool, idx) => {
              const toolName = typeof tool === 'string' ? tool : tool.tool || '';
              return toolName ? (
                <span key={idx} className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  {toolName}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* KPIs */}
      {kpis.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs uppercase tracking-wide">KPIs</span>
          </div>
          <ul className="space-y-1.5 pl-1">
            {kpis.map((kpi, idx) => {
              const metric = typeof kpi === 'string' ? kpi : kpi.metric || '';
              const target = typeof kpi === 'object' && kpi.target ? ` - ${kpi.target}` : '';
              return metric ? (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{metric}{target}</span>
                </li>
              ) : null;
            })}
          </ul>
        </div>
      )}

      {/* Key Risks */}
      {keyRisks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-semibold text-xs uppercase tracking-wide">Key Risks</span>
          </div>
          <ul className="space-y-1 pl-1">
            {keyRisks.map((risk, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span>{typeof risk === 'string' ? risk : risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable Section for Additional Details */}
      {(criticalQuestions.length > 0 || preview.service_reasoning) && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>{isExpanded ? "Hide" : "Show"} Additional Details</span>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          {isExpanded && (
            <div className="space-y-3 pt-2 border-t">
              {/* Service Reasoning */}
              {preview.service_reasoning && (
                <div>
                  <span className="font-semibold text-xs uppercase tracking-wide">Recommendation</span>
                  <p className="text-sm mt-1">{preview.service_reasoning}</p>
                </div>
              )}

              {/* Critical Questions */}
              {criticalQuestions.length > 0 && (
                <div>
                  <span className="font-semibold text-xs uppercase tracking-wide mb-2 block">Questions to Consider</span>
                  <ul className="space-y-1.5">
                    {criticalQuestions.map((q, idx) => {
                      const question = typeof q === 'string' ? q : (q as any).question || "";
                      const why = typeof q === 'object' && (q as any).why_it_matters ? (q as any).why_it_matters : "";
                      return question ? (
                        <li key={idx} className="text-sm">
                          <p className="font-medium">{question}</p>
                          {why && (
                            <p className="text-muted-foreground text-xs mt-0.5">{why}</p>
                          )}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* View on Page Button */}
      {onApply && (
        <div className="pt-2 border-t">
          <Button
            onClick={onApply}
            className="w-full"
            size="sm"
          >
            View on Page
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            This will display the analysis on the main page. You can continue chatting to make edits.
          </p>
        </div>
      )}
    </div>
  );
}
