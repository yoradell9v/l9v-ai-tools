import { NextResponse } from "next/server";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
  RGB,
} from "pdf-lib";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Extract preview and full_package from the new structure
    const preview = data.preview || {};
    const fullPackage = data.full_package || {};
    const metadata = data.metadata || {};

    // Get role/project title for filename based on service type
    const serviceType = preview.service_type || fullPackage?.service_structure?.service_type || "";
    let roleTitle = "Job Analysis";
    
    if (serviceType === "Dedicated VA") {
      roleTitle = preview.role_title || 
                  fullPackage?.service_structure?.dedicated_va_role?.title || 
                  fullPackage?.detailed_specifications?.title || 
                  "Dedicated VA Role";
    } else if (serviceType === "Unicorn VA Service") {
      roleTitle = preview.core_va_title || 
                  fullPackage?.service_structure?.core_va_role?.title || 
                  fullPackage?.detailed_specifications?.core_va_jd?.title || 
                  "Unicorn VA Service";
    } else if (serviceType === "Projects on Demand") {
      roleTitle = `Projects_On_Demand_${preview.project_count || 0}_Projects`;
    }
    
    // Title with role title + timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const title = `${roleTitle.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.pdf`;

    // Create a PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = height - margin;

    // Utility to draw text and move y
    interface DrawLineOptions {
      size?: number;
      bold?: boolean;
      color?: RGB;
    }

    const drawLine = (text: string, opts: DrawLineOptions = {}) => {
      const { size = 12, bold = false, color = rgb(0, 0, 0) } = opts;
      const fontToUse = bold ? fontBold : font;
      const lines = splitTextIntoLines(
        text,
        width - margin * 2,
        size,
        fontToUse
      );
      for (const line of lines) {
        if (y < margin) {
          // new page if we run out of space
          const newPage = pdfDoc.addPage();
          y = height - margin;
          page = newPage;
        }
        page.drawText(line, { x: margin, y, size, font: fontToUse, color });
        y -= size + 4;
      }
    };

    const drawSection = (title: string) => {
      y -= 10;
      drawLine(title, { size: 14, bold: true, color: rgb(0.1, 0.1, 0.5) });
      y -= 5;
    };

    // Draw the header
    drawLine(roleTitle, {
      size: 20,
      bold: true,
      color: rgb(0.1, 0.1, 0.5),
    });
    y -= 10;
    drawLine("Job Description Analysis Report", { size: 12 });
    drawLine(`Generated: ${new Date().toLocaleDateString()}`, { size: 10 });
    y -= 20;

    // EXECUTIVE SUMMARY
    drawSection("EXECUTIVE SUMMARY");
    
    if (preview.service_type) {
      drawLine("Service Type", { size: 12, bold: true });
      drawLine(preview.service_type, { size: 11 });
      y -= 5;
    }

    if (preview.service_confidence) {
      drawLine("Confidence", { size: 12, bold: true });
      drawLine(preview.service_confidence, { size: 11 });
      y -= 5;
    }

    if (preview.service_reasoning) {
      drawLine("Service Reasoning", { size: 12, bold: true });
      drawLine(preview.service_reasoning, { size: 11 });
      y -= 5;
    }

    if (preview.primary_outcome) {
      drawLine("Primary Outcome", { size: 12, bold: true });
      drawLine(preview.primary_outcome, { size: 11 });
      y -= 5;
    }

    // SUMMARY SECTION
    if (preview.summary) {
      const summary = preview.summary;
      drawSection("SUMMARY");
      
      if (summary.company_stage) {
        drawLine("Company Stage", { size: 12, bold: true });
        drawLine(summary.company_stage, { size: 11 });
        y -= 5;
      }

      if (summary.outcome_90d) {
        drawLine("90-Day Outcome", { size: 12, bold: true });
        drawLine(summary.outcome_90d, { size: 11 });
        y -= 5;
      }

      if (summary.primary_bottleneck) {
        drawLine("Primary Bottleneck", { size: 12, bold: true });
        drawLine(summary.primary_bottleneck, { size: 11 });
        y -= 5;
      }

      if (summary.workflow_analysis) {
        drawLine("Workflow Analysis", { size: 12, bold: true });
        drawLine(summary.workflow_analysis, { size: 11 });
        y -= 5;
      }
    }

    // ROLE/PROJECT DETAILS - Service Type Specific
    if (serviceType === "Dedicated VA") {
      drawSection("ROLE DETAILS");
      
      const dedicatedRole = fullPackage?.service_structure?.dedicated_va_role;
      const detailedJd = fullPackage?.detailed_specifications;

      if (dedicatedRole?.title || detailedJd?.title) {
        drawLine("Role Title", { size: 12, bold: true });
        drawLine(dedicatedRole?.title || detailedJd?.title || "", { size: 11 });
        y -= 5;
      }

      if (dedicatedRole?.hours_per_week || detailedJd?.hours_per_week) {
        drawLine("Hours Per Week", { size: 12, bold: true });
        drawLine(String(dedicatedRole?.hours_per_week || detailedJd?.hours_per_week || ""), { size: 11 });
        y -= 5;
      }

      if (detailedJd?.mission_statement || dedicatedRole?.core_responsibility) {
        drawLine("Mission Statement", { size: 12, bold: true });
        drawLine(detailedJd?.mission_statement || dedicatedRole?.core_responsibility || "", { size: 11 });
        y -= 5;
      }

      // Primary Outcome
      if (detailedJd?.primary_outcome) {
        drawLine("Primary Outcome (90 Days)", { size: 12, bold: true });
        drawLine(detailedJd.primary_outcome, { size: 11 });
        y -= 5;
      }

      // Core Outcomes
      if (detailedJd?.core_outcomes && detailedJd.core_outcomes.length > 0) {
        drawLine("90-Day Core Outcomes", { size: 12, bold: true });
        for (const outcome of detailedJd.core_outcomes) {
          drawLine(`• ${outcome}`, { size: 11 });
        }
        y -= 5;
      }

      // Responsibilities
      if (detailedJd?.responsibilities && detailedJd.responsibilities.length > 0) {
        drawLine("Key Responsibilities", { size: 12, bold: true });
        for (const resp of detailedJd.responsibilities) {
          if (typeof resp === "string") {
            drawLine(`• ${resp}`, { size: 11 });
          } else if (resp?.details && Array.isArray(resp.details)) {
            if (resp.category) {
              drawLine(`${resp.category}:`, { size: 11, bold: true });
            }
            for (const detail of resp.details) {
              drawLine(`  • ${detail}`, { size: 11 });
            }
          }
        }
        y -= 5;
      } else if (dedicatedRole?.task_allocation?.from_intake && dedicatedRole.task_allocation.from_intake.length > 0) {
        drawLine("Tasks", { size: 12, bold: true });
        for (const task of dedicatedRole.task_allocation.from_intake) {
          drawLine(`• ${task}`, { size: 11 });
        }
        y -= 5;
      }

      // Skills
      if (dedicatedRole?.skill_requirements || detailedJd?.skills_required) {
        const skills = dedicatedRole?.skill_requirements || detailedJd?.skills_required;
        if (skills && typeof skills === "object") {
          if (skills.required && Array.isArray(skills.required) && skills.required.length > 0) {
            drawLine("Required Skills", { size: 12, bold: true });
            for (const skill of skills.required) {
              if (typeof skill === "string") {
                drawLine(`• ${skill}`, { size: 11 });
              } else if (skill?.skill) {
                drawLine(`• ${skill.skill}`, { size: 11 });
              }
            }
            y -= 5;
          }
          if (skills.nice_to_have && Array.isArray(skills.nice_to_have) && skills.nice_to_have.length > 0) {
            drawLine("Nice to Have Skills", { size: 12, bold: true });
            for (const skill of skills.nice_to_have) {
              if (typeof skill === "string") {
                drawLine(`• ${skill}`, { size: 11 });
              } else if (skill?.skill) {
                drawLine(`• ${skill.skill}`, { size: 11 });
              }
            }
            y -= 5;
          }
        }
      }

      // Tools
      if (detailedJd?.tools && detailedJd.tools.length > 0) {
        drawLine("Tools Required", { size: 12, bold: true });
        for (const tool of detailedJd.tools) {
          if (typeof tool === "string") {
            drawLine(`• ${tool}`, { size: 11 });
          } else if (tool?.tool) {
            drawLine(`• ${tool.tool}`, { size: 11 });
          }
        }
        y -= 5;
      }

      // KPIs
      if (detailedJd?.kpis && detailedJd.kpis.length > 0) {
        drawLine("Key Performance Indicators", { size: 12, bold: true });
        for (const kpi of detailedJd.kpis) {
          if (typeof kpi === "string") {
            drawLine(`• ${kpi}`, { size: 11 });
          } else if (kpi?.metric) {
            const kpiText = kpi.target ? `${kpi.metric} — ${kpi.target}` : kpi.metric;
            drawLine(`• ${kpiText}`, { size: 11 });
          }
        }
        y -= 5;
      }

      // Workflow Ownership
      if (dedicatedRole?.workflow_ownership && dedicatedRole.workflow_ownership.length > 0) {
        drawLine("Workflow Ownership", { size: 12, bold: true });
        for (const workflow of dedicatedRole.workflow_ownership) {
          drawLine(`• ${workflow}`, { size: 11 });
        }
        y -= 5;
      }

      // Interaction Model
      if (dedicatedRole?.interaction_model) {
        const interaction = dedicatedRole.interaction_model;
        drawLine("Interaction Model", { size: 12, bold: true });
        if (interaction.reports_to) {
          drawLine(`Reports to: ${interaction.reports_to}`, { size: 11 });
        }
        if (interaction.sync_needs) {
          drawLine(`Sync needs: ${interaction.sync_needs}`, { size: 11 });
        }
        if (interaction.timezone_criticality) {
          drawLine(`Timezone criticality: ${interaction.timezone_criticality}`, { size: 11 });
        }
        y -= 5;
      }

    } else if (serviceType === "Unicorn VA Service") {
      drawSection("CORE VA ROLE DETAILS");
      
      const coreRole = fullPackage?.service_structure?.core_va_role;
      const detailedJd = fullPackage?.detailed_specifications?.core_va_jd;

      if (coreRole?.title || detailedJd?.title) {
        drawLine("Role Title", { size: 12, bold: true });
        drawLine(coreRole?.title || detailedJd?.title || "", { size: 11 });
        y -= 5;
      }

      if (coreRole?.hours_per_week || detailedJd?.hours_per_week) {
        drawLine("Hours Per Week", { size: 12, bold: true });
        drawLine(String(coreRole?.hours_per_week || detailedJd?.hours_per_week || ""), { size: 11 });
        y -= 5;
      }

      if (detailedJd?.mission_statement || coreRole?.core_responsibility) {
        drawLine("Mission Statement", { size: 12, bold: true });
        drawLine(detailedJd?.mission_statement || coreRole?.core_responsibility || "", { size: 11 });
        y -= 5;
      }

      // Core Outcomes
      if (detailedJd?.core_outcomes && detailedJd.core_outcomes.length > 0) {
        drawLine("90-Day Core Outcomes", { size: 12, bold: true });
        for (const outcome of detailedJd.core_outcomes) {
          drawLine(`• ${outcome}`, { size: 11 });
        }
        y -= 5;
      }

      // Responsibilities
      if (detailedJd?.responsibilities && detailedJd.responsibilities.length > 0) {
        drawLine("Key Responsibilities", { size: 12, bold: true });
        for (const resp of detailedJd.responsibilities) {
          if (typeof resp === "string") {
            drawLine(`• ${resp}`, { size: 11 });
          } else if (resp?.details && Array.isArray(resp.details)) {
            if (resp.category) {
              drawLine(`${resp.category}:`, { size: 11, bold: true });
            }
            for (const detail of resp.details) {
              drawLine(`  • ${detail}`, { size: 11 });
            }
          }
        }
        y -= 5;
      } else if (coreRole?.recurring_tasks && coreRole.recurring_tasks.length > 0) {
        drawLine("Recurring Tasks", { size: 12, bold: true });
        for (const task of coreRole.recurring_tasks) {
          drawLine(`• ${task}`, { size: 11 });
        }
        y -= 5;
      }

      // Skills
      if (coreRole?.skill_requirements || detailedJd?.skills_required) {
        const skills = coreRole?.skill_requirements || detailedJd?.skills_required;
        if (skills && typeof skills === "object") {
          if (skills.required && Array.isArray(skills.required) && skills.required.length > 0) {
            drawLine("Required Skills", { size: 12, bold: true });
            for (const skill of skills.required) {
              if (typeof skill === "string") {
                drawLine(`• ${skill}`, { size: 11 });
              } else if (skill?.skill) {
                drawLine(`• ${skill.skill}`, { size: 11 });
              }
            }
            y -= 5;
          }
          if (skills.nice_to_have && Array.isArray(skills.nice_to_have) && skills.nice_to_have.length > 0) {
            drawLine("Nice to Have Skills", { size: 12, bold: true });
            for (const skill of skills.nice_to_have) {
              if (typeof skill === "string") {
                drawLine(`• ${skill}`, { size: 11 });
              } else if (skill?.skill) {
                drawLine(`• ${skill.skill}`, { size: 11 });
              }
            }
            y -= 5;
          }
        }
      }

      // Tools
      if (detailedJd?.tools && detailedJd.tools.length > 0) {
        drawLine("Tools Required", { size: 12, bold: true });
        for (const tool of detailedJd.tools) {
          if (typeof tool === "string") {
            drawLine(`• ${tool}`, { size: 11 });
          } else if (tool?.tool) {
            drawLine(`• ${tool.tool}`, { size: 11 });
          }
        }
        y -= 5;
      }

      // KPIs
      if (detailedJd?.kpis && detailedJd.kpis.length > 0) {
        drawLine("Key Performance Indicators", { size: 12, bold: true });
        for (const kpi of detailedJd.kpis) {
          if (typeof kpi === "string") {
            drawLine(`• ${kpi}`, { size: 11 });
          } else if (kpi?.metric) {
            const kpiText = kpi.target ? `${kpi.metric} — ${kpi.target}` : kpi.metric;
            drawLine(`• ${kpiText}`, { size: 11 });
          }
        }
        y -= 5;
      }

      // Workflow Ownership
      if (coreRole?.workflow_ownership && coreRole.workflow_ownership.length > 0) {
        drawLine("Workflow Ownership", { size: 12, bold: true });
        for (const workflow of coreRole.workflow_ownership) {
          drawLine(`• ${workflow}`, { size: 11 });
        }
        y -= 5;
      }

      // Interaction Model
      if (coreRole?.interaction_model) {
        const interaction = coreRole.interaction_model;
        drawLine("Interaction Model", { size: 12, bold: true });
        if (interaction.reports_to) {
          drawLine(`Reports to: ${interaction.reports_to}`, { size: 11 });
        }
        if (interaction.client_facing !== undefined) {
          drawLine(`Client-facing: ${interaction.client_facing ? "Yes" : "No"}`, { size: 11 });
        }
        if (interaction.sync_needs) {
          drawLine(`Sync needs: ${interaction.sync_needs}`, { size: 11 });
        }
        if (interaction.timezone_criticality) {
          drawLine(`Timezone criticality: ${interaction.timezone_criticality}`, { size: 11 });
        }
        y -= 5;
      }

    } else if (serviceType === "Projects on Demand") {
      drawSection("PROJECT DETAILS");
      
      const projects = fullPackage?.detailed_specifications?.projects || fullPackage?.service_structure?.projects || [];
      
      if (preview.total_hours) {
        drawLine("Total Hours", { size: 12, bold: true });
        drawLine(String(preview.total_hours), { size: 11 });
        y -= 5;
      }

      if (preview.estimated_timeline) {
        drawLine("Estimated Timeline", { size: 12, bold: true });
        drawLine(preview.estimated_timeline, { size: 11 });
        y -= 5;
      }

      if (projects.length > 0) {
        for (let i = 0; i < projects.length; i++) {
          const project = projects[i];
          drawLine(`Project ${i + 1}: ${project.project_name || "Unnamed Project"}`, { size: 12, bold: true });
          y -= 3;

          if (project.overview) {
            drawLine("Overview", { size: 11, bold: true });
            drawLine(project.overview, { size: 10 });
            y -= 5;
          }

          if (project.objective) {
            drawLine("Objective", { size: 11, bold: true });
            drawLine(project.objective, { size: 10 });
            y -= 5;
          }

          if (project.objectives && Array.isArray(project.objectives) && project.objectives.length > 0) {
            drawLine("Objectives", { size: 11, bold: true });
            for (const obj of project.objectives) {
              drawLine(`• ${obj}`, { size: 10 });
            }
            y -= 5;
          }

          // Timeline
          const timelineHours = project.estimated_hours || project.timeline?.estimated_hours;
          const timelineDuration = typeof project.timeline === "string" ? project.timeline : project.timeline?.duration;
          if (timelineHours || timelineDuration) {
            drawLine("Timeline", { size: 11, bold: true });
            const timelineText = timelineHours && timelineDuration 
              ? `${timelineHours} hrs • ${timelineDuration}`
              : timelineHours || timelineDuration || "";
            drawLine(timelineText, { size: 10 });
            y -= 5;
          }

          // Deliverables
          if (project.deliverables && project.deliverables.length > 0) {
            drawLine("Deliverables", { size: 11, bold: true });
            for (const del of project.deliverables) {
              if (typeof del === "string") {
                drawLine(`• ${del}`, { size: 10 });
              } else if (del?.item) {
                drawLine(`• ${del.item}`, { size: 10 });
                if (del.description) {
                  drawLine(`  ${del.description}`, { size: 9 });
                }
              }
            }
            y -= 5;
          }

          // Skills Required
          const skills = project.skills_required || project.requirements?.skills_needed || [];
          if (skills.length > 0) {
            drawLine("Skills Required", { size: 11, bold: true });
            for (const skill of skills) {
              drawLine(`• ${skill}`, { size: 10 });
            }
            y -= 5;
          }

          // Success Criteria/Metrics
          if (project.success_criteria) {
            drawLine("Success Criteria", { size: 11, bold: true });
            drawLine(project.success_criteria, { size: 10 });
            y -= 5;
          }

          if (project.success_metrics && Array.isArray(project.success_metrics) && project.success_metrics.length > 0) {
            drawLine("Success Metrics", { size: 11, bold: true });
            for (const metric of project.success_metrics) {
              drawLine(`• ${metric}`, { size: 10 });
            }
            y -= 5;
          }

          y -= 10; // Space between projects
        }
      }
    }

    // Team Support Areas (for Unicorn VA Service)
    if (fullPackage?.service_structure?.team_support_areas && Array.isArray(fullPackage.service_structure.team_support_areas) && fullPackage.service_structure.team_support_areas.length > 0) {
      drawSection("TEAM SUPPORT AREAS");
      for (const area of fullPackage.service_structure.team_support_areas) {
        if (area.skill_category) {
          drawLine(area.skill_category, { size: 12, bold: true });
          if (area.estimated_hours_monthly) {
            drawLine(`Estimated hours/month: ${area.estimated_hours_monthly}`, { size: 11 });
          }
          if (area.use_cases && Array.isArray(area.use_cases) && area.use_cases.length > 0) {
            drawLine("Use Cases:", { size: 11, bold: true });
            for (const useCase of area.use_cases) {
              drawLine(`• ${useCase}`, { size: 11 });
            }
          }
          if (area.deliverables && Array.isArray(area.deliverables) && area.deliverables.length > 0) {
            drawLine("Deliverables:", { size: 11, bold: true });
            for (const deliverable of area.deliverables) {
              drawLine(`• ${deliverable}`, { size: 11 });
            }
          }
          y -= 5;
        }
      }
    }

    // Coordination Model
    if (fullPackage?.service_structure?.coordination_model) {
      drawSection("COORDINATION MODEL");
      drawLine(fullPackage.service_structure.coordination_model, { size: 11 });
      y -= 5;
    }

    // Pros and Cons
    if (fullPackage?.service_structure?.pros && fullPackage.service_structure.pros.length > 0) {
      drawSection("PROS");
      for (const pro of fullPackage.service_structure.pros) {
        drawLine(`• ${pro}`, { size: 11 });
      }
      y -= 5;
    }

    if (fullPackage?.service_structure?.cons && fullPackage.service_structure.cons.length > 0) {
      drawSection("CONS");
      for (const con of fullPackage.service_structure.cons) {
        drawLine(`• ${con}`, { size: 11 });
      }
      y -= 5;
    }

    // Scaling Path
    if (fullPackage?.service_structure?.scaling_path) {
      drawSection("SCALING PATH");
      drawLine(fullPackage.service_structure.scaling_path, { size: 11 });
      y -= 5;
    }

    // KEY RISKS (Brief summary only)
    if (preview.key_risks && preview.key_risks.length > 0) {
      drawSection("KEY CONSIDERATIONS");
      for (const risk of preview.key_risks.slice(0, 3)) {
        drawLine(`• ${risk}`, { size: 11 });
      }
      y -= 5;
    }

    // IMPLEMENTATION PLAN
    if (fullPackage?.implementation_plan) {
      const implPlan = fullPackage.implementation_plan;
      
      if (implPlan.immediate_next_steps && implPlan.immediate_next_steps.length > 0) {
        drawSection("IMMEDIATE NEXT STEPS");
        for (const step of implPlan.immediate_next_steps) {
          drawLine(`${step.step || step}`, { size: 11, bold: true });
          if (typeof step === "object" && step.owner) {
            drawLine(`Owner: ${step.owner} | Timeline: ${step.timeline}`, { size: 10 });
            if (step.output) {
              drawLine(`Output: ${step.output}`, { size: 10 });
            }
          }
          y -= 3;
        }
        y -= 5;
      }

      // Onboarding Roadmap - Service Type Specific
      if (implPlan.onboarding_roadmap) {
        const roadmap = implPlan.onboarding_roadmap;
        const hasContent = 
          (roadmap.week_1 && Array.isArray(roadmap.week_1) && roadmap.week_1.length > 0) ||
          (roadmap.week_2 && Array.isArray(roadmap.week_2) && roadmap.week_2.length > 0) ||
          (roadmap.week_3_4 && Array.isArray(roadmap.week_3_4) && roadmap.week_3_4.length > 0) ||
          (roadmap.project_kickoff && typeof roadmap.project_kickoff === "object") ||
          (roadmap.execution_phase && typeof roadmap.execution_phase === "object") ||
          (roadmap.completion && typeof roadmap.completion === "object");

        if (hasContent) {
          drawSection("ONBOARDING ROADMAP");
          
          // For Dedicated VA / Unicorn VA Service
          if (serviceType === "Dedicated VA" || serviceType === "Unicorn VA Service") {
            if (roadmap.week_1 && Array.isArray(roadmap.week_1) && roadmap.week_1.length > 0) {
              drawLine("Week 1", { size: 12, bold: true });
              for (const item of roadmap.week_1) {
                drawLine(`• ${item}`, { size: 11 });
              }
              y -= 5;
            }
            if (roadmap.week_2 && Array.isArray(roadmap.week_2) && roadmap.week_2.length > 0) {
              drawLine("Week 2", { size: 12, bold: true });
              for (const item of roadmap.week_2) {
                drawLine(`• ${item}`, { size: 11 });
              }
              y -= 5;
            }
            if (roadmap.week_3_4 && Array.isArray(roadmap.week_3_4) && roadmap.week_3_4.length > 0) {
              drawLine("Weeks 3-4", { size: 12, bold: true });
              for (const item of roadmap.week_3_4) {
                drawLine(`• ${item}`, { size: 11 });
              }
              y -= 5;
            }
          }
          
          // For Projects on Demand
          if (serviceType === "Projects on Demand") {
            if (roadmap.project_kickoff && typeof roadmap.project_kickoff === "object") {
              drawLine("Project Kickoff", { size: 12, bold: true });
              for (const [key, value] of Object.entries(roadmap.project_kickoff)) {
                if (Array.isArray(value) && value.length > 0) {
                  if (key !== "All Projects") {
                    drawLine(key, { size: 11, bold: true });
                  }
                  for (const item of value) {
                    drawLine(`• ${item}`, { size: 11 });
                  }
                }
              }
              y -= 5;
            }
            if (roadmap.execution_phase && typeof roadmap.execution_phase === "object") {
              drawLine("Execution Phase", { size: 12, bold: true });
              for (const [key, value] of Object.entries(roadmap.execution_phase)) {
                if (Array.isArray(value) && value.length > 0) {
                  if (key !== "All Projects") {
                    drawLine(key, { size: 11, bold: true });
                  }
                  for (const item of value) {
                    drawLine(`• ${item}`, { size: 11 });
                  }
                }
              }
              y -= 5;
            }
            if (roadmap.completion && typeof roadmap.completion === "object") {
              drawLine("Completion", { size: 12, bold: true });
              for (const [key, value] of Object.entries(roadmap.completion)) {
                if (Array.isArray(value) && value.length > 0) {
                  if (key !== "All Projects") {
                    drawLine(key, { size: 11, bold: true });
                  }
                  for (const item of value) {
                    drawLine(`• ${item}`, { size: 11 });
                  }
                }
              }
              y -= 5;
            }
          }
        }
      }

      // Success Milestones - Service Type Specific
      if (implPlan.success_milestones) {
        const milestones = implPlan.success_milestones;
        const hasContent = 
          milestones.week_2 || milestones.week_4 || milestones.week_8 || milestones.week_12 ||
          Object.keys(milestones).some(key => key.startsWith("project_"));

        if (hasContent) {
          drawSection("SUCCESS MILESTONES");
          
          // For Dedicated VA / Unicorn VA Service
          if (serviceType === "Dedicated VA" || serviceType === "Unicorn VA Service") {
            if (milestones.week_2) {
              drawLine("Week 2:", { size: 11, bold: true });
              drawLine(milestones.week_2, { size: 11 });
              y -= 5;
            }
            if (milestones.week_4) {
              drawLine("Week 4:", { size: 11, bold: true });
              drawLine(milestones.week_4, { size: 11 });
              y -= 5;
            }
            if (milestones.week_8) {
              drawLine("Week 8:", { size: 11, bold: true });
              drawLine(milestones.week_8, { size: 11 });
              y -= 5;
            }
            if (milestones.week_12) {
              drawLine("Week 12:", { size: 11, bold: true });
              drawLine(milestones.week_12, { size: 11 });
              y -= 5;
            }
          }
          
          // For Projects on Demand
          if (serviceType === "Projects on Demand") {
            const projectMilestones = Object.entries(milestones)
              .filter(([key]) => key.startsWith("project_"))
              .sort(([keyA], [keyB]) => {
                // Sort by project number and type (kickoff before completion)
                const matchA = keyA.match(/project_(\d+)_(kickoff|completion)/);
                const matchB = keyB.match(/project_(\d+)_(kickoff|completion)/);
                if (matchA && matchB) {
                  const numA = parseInt(matchA[1]);
                  const numB = parseInt(matchB[1]);
                  if (numA !== numB) return numA - numB;
                  return matchA[2] === "kickoff" ? -1 : 1;
                }
                return 0;
              });

            for (const [key, value] of projectMilestones) {
              const match = key.match(/project_(\d+)_(kickoff|completion)/);
              if (match) {
                const projectNum = match[1];
                const milestoneType = match[2] === "kickoff" ? "Kickoff" : "Completion";
                drawLine(`Project ${projectNum} ${milestoneType}:`, { size: 11, bold: true });
                drawLine(String(value), { size: 11 });
                y -= 5;
              }
            }
          }
        }
      }
    }


    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${title}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse("Failed to generate PDF", { status: 500 });
  }
}

// Helper function to wrap long lines
function splitTextIntoLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const width = font.widthOfTextAtSize(line + word, fontSize);
    if (width > maxWidth && line !== "") {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line += word + " ";
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}
