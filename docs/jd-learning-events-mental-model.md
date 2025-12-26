# Learning Events Mental Model: Job Description Analysis → Knowledge Base Enrichment

## Overview
This document explains how job description analyses in the JD Builder (`page.tsx`) automatically create learning events that enrich the organization's knowledge base through a multi-stage AI-powered pipeline.

---

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER JOB DESCRIPTION FLOW                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. User fills out JD Intake Form (page.tsx)                    │
│     - Business details, tasks, outcomes, tools, SOPs              │
│     - Form data auto-filled from organization KB (if available) │
│     - Submits to: POST /api/jd/analyze                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Multi-Stage AI Analysis Pipeline                            │
│     Route: /api/jd/analyze (route.ts)                            │
│                                                                   │
│     Stage 1: Deep Discovery                                      │
│     - Extracts business context, task clusters, SOP insights    │
│     - Identifies bottlenecks, growth indicators, complexity     │
│                                                                   │
│     Stage 1.5: Service Type Classification                       │
│     - Classifies: Dedicated VA | Projects on Demand | Unicorn   │
│                                                                   │
│     Stage 2: Role Architecture Design                            │
│     - Designs service structure based on classification         │
│                                                                   │
│     Stage 3: Detailed Specifications                            │
│     - Generates full job descriptions or project specs           │
│                                                                   │
│     Stage 4: Validation & Risk Analysis                          │
│     - Validates consistency, identifies risks                    │
│                                                                   │
│     Stage 5: Client Package Assembly                            │
│     - Assembles final analysis package                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Insight Extraction                                           │
│     Function: extractInsights("JOB_DESCRIPTION", analysisData)   │
│     Location: src/lib/analysis/extractInsights.ts                │
│                                                                   │
│     Extracts insights from:                                      │
│     • Discovery insights (business_context, task_analysis)       │
│     • SOP insights (pain_points, documentation_gaps)             │
│     • Service classification (recommended_service, fit_scores)   │
│     • Validation (risks, assumptions, red_flags)                  │
│                                                                   │
│     Returns: ExtractedInsight[] with:                           │
│     • insight: string (human-readable description)               │
│     • category: string (business_context, workflow_patterns)     │
│     • eventType: LearningEventType                              │
│     • confidence: number (75-90, based on source reliability)    │
│     • metadata: object (structured data for KB mapping)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Analysis Response with Extracted Insights                    │
│     - Returns full analysis + extractedInsights array            │
│     - Frontend receives: { preview, full_package, extractedInsights } │
│     - KB metadata included: version, snapshot, organizationId     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Save Analysis (page.tsx → /api/jd/save)                     │
│     - User saves analysis (automatic or manual)                  │
│     - Sends: analysis, intakeData, contributedInsights           │
│     - Also includes: KB version, snapshot, organizationId         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Create LearningEvents in Database                           │
│     Function: createLearningEvents()                             │
│     Location: src/lib/learning-events.ts                         │
│                                                                   │
│     - Creates one LearningEvent per ExtractedInsight            │
│     - Stores in database with:                                  │
│       • knowledgeBaseId (links to KB)                           │
│       • eventType (PATTERN_DETECTED, INSIGHT_GENERATED, etc.)   │
│       • insight (text description)                              │
│       • category (business_context, workflow_patterns, etc.)    │
│       • confidence (75-90)                                      │
│       • metadata (JSON for field mapping)                       │
│       • sourceIds: [savedAnalysisId]                           │
│       • sourceType: "JOB_DESCRIPTION"                           │
│       • applied: false (initially)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Apply LearningEvents to Knowledge Base                       │
│     Function: applyLearningEventsToKB()                          │
│     Location: src/lib/apply-learning-events.ts                   │
│                                                                   │
│     - Fetches unapplied events with confidence ≥ 80 (MVP)      │
│     - For each event:                                           │
│       1. Map insight to KB field (mapInsightToKBField)          │
│       2. Resolve conflicts (don't overwrite unless high conf)  │
│       3. Update KB field(s)                                     │
│     - Field mappings:                                           │
│       • bottleneck → biggestBottleNeck                          │
│       • company_stage → extractedKnowledge.companyStages        │
│       • growth_indicators → extractedKnowledge.growthIndicators│
│       • pain_points → extractedKnowledge.painPoints             │
│       • documentation_gaps → extractedKnowledge.documentationGaps│
│       • task_clusters → extractedKnowledge.taskClusters         │
│     - Marks events as applied: true                             │
│     - Updates KB: enrichmentVersion++, lastEnrichedAt          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Enriched Knowledge Base                                      │
│     - KB now contains insights from JD analysis                  │
│     - Future JD analyses use enriched KB context                 │
│     - Continuous learning loop: JD → insights → KB → better JD  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. User Input (page.tsx)
**Location**: `src/app/dashboard/jd-builder/page.tsx`

**Process**:
- User fills out `BaseIntakeForm` with JD requirements
- Form auto-populates from organization KB (if available)
- User submits form → triggers `/api/jd/analyze`
- Form data includes:
  - Business name, website, goals
  - Tasks (up to 5)
  - 90-day outcome
  - Weekly hours, timezone, tools
  - Existing SOPs (optional file upload)
  - Requirements, deal breakers

### 2. Analysis Pipeline (`/api/jd/analyze`)
**Location**: `src/app/api/jd/analyze/route.ts`

**Stages**:

#### Stage 1: Deep Discovery (`runDeepDiscovery`)
- **Model**: GPT-4o
- **Input**: Intake data, website content, SOP text, KB context
- **Output**: Structured JSON with:
  ```json
  {
    "business_context": {
      "company_stage": "startup|growth|established",
      "primary_bottleneck": "...",
      "hidden_complexity": "...",
      "growth_indicators": "..."
    },
    "task_analysis": {
      "task_clusters": [...],
      "skill_requirements": {...},
      "implicit_needs": [...]
    },
    "sop_insights": {
      "process_complexity": "low|medium|high",
      "pain_points": [...],
      "documentation_gaps": [...]
    }
  }
  ```

#### Stage 1.5: Service Type Classification (`classifyServiceType`)
- **Model**: GPT-4o
- **Output**: Recommended service type + fit scores
- **Options**: Dedicated VA | Projects on Demand | Unicorn VA Service

#### Stage 2: Role Architecture (`designRoleArchitecture`)
- **Model**: GPT-4o
- **Output**: Service-specific role structure
- **Varies by service type** (dedicated VA vs projects vs unicorn)

#### Stage 3: Detailed Specifications
- **For Dedicated VA**: `generateDetailedJD()` - Full JD with mission, outcomes, skills, KPIs
- **For Projects**: `generateProjectSpecs()` - Project specifications with deliverables
- **For Unicorn VA**: Both core VA JD + team support specs

#### Stage 4: Validation (`validateAndAnalyzeRisks`)
- **Model**: GPT-4o
- **Output**: Risk analysis, consistency checks, quality scores

#### Stage 5: Package Assembly (`assembleClientPackage`)
- Combines all stages into client-facing package
- Includes: executive summary, service structure, detailed specs, implementation plan, risk management

### 3. Insight Extraction (`extractInsights`)
**Location**: `src/lib/analysis/extractInsights.ts`
**Function**: `extractFromJdAnalysis()`

**Extraction Sources**:

#### From Discovery Insights:
- **Business Context**:
  - `company_stage` → Confidence: 85
  - `primary_bottleneck` → Confidence: 90 (very high)
  - `growth_indicators` → Confidence: 82
  - `hidden_complexity` → Confidence: 82

- **Task Analysis**:
  - `task_clusters` → Confidence: 82 (one per cluster)
  - `implicit_needs` → Confidence: 75 (inferred)
  - `skill_requirements` → Confidence: 75 (aggregated)

- **SOP Insights**:
  - `process_complexity` → Confidence: 82
  - `pain_points` → Confidence: 85 (one per pain point)
  - `documentation_gaps` → Confidence: 85 (one per gap)

#### From Service Classification:
- `recommended_service` → Confidence: 75-85 (based on analysis confidence)
- `service_fit_scores` → Confidence: 75-85 (based on score)

#### From Validation:
- **High-severity risks** → Confidence: 90
- **Other risks** → Confidence: 75
- **Critical assumptions** → Confidence: 85
- **Red flags** → Confidence: 90

**Example Extracted Insights**:
```typescript
[
  {
    insight: "Primary bottleneck identified: Customer onboarding takes 2 weeks",
    category: "business_context",
    eventType: LearningEventType.INSIGHT_GENERATED,
    confidence: 90,
    metadata: {
      sourceSection: "discovery.business_context",
      bottleneck: "Customer onboarding takes 2 weeks"
    }
  },
  {
    insight: "Process pain point identified: Manual data entry between systems",
    category: "process_optimization",
    eventType: LearningEventType.OPTIMIZATION_FOUND,
    confidence: 85,
    metadata: {
      sourceSection: "discovery.sop_insights.pain_points",
      painPoint: "Manual data entry between systems"
    }
  }
]
```

### 4. Analysis Save (`/api/jd/save`)
**Location**: `src/app/api/jd/save/route.ts`

**Process**:
1. **Save Analysis**:
   - Stores full analysis in `SavedAnalysis` table
   - Includes: `usedKnowledgeBaseVersion`, `knowledgeBaseSnapshot`, `contributedInsights`

2. **Create LearningEvents** (if `contributedInsights` exist):
   ```typescript
   createLearningEvents({
     knowledgeBaseId: knowledgeBase.id,
     sourceType: "JOB_DESCRIPTION",
     sourceId: savedAnalysis.id,
     insights: contributedInsights,
     triggeredBy: userOrganizationId
   })
   ```

3. **Apply to KB** (if events created):
   ```typescript
   applyLearningEventsToKB({
     knowledgeBaseId: knowledgeBase.id,
     minConfidence: 80  // MVP: only high confidence
   })
   ```

### 5. KB Enrichment (`applyLearningEventsToKB`)
**Location**: `src/lib/apply-learning-events.ts`

**Field Mapping Examples**:

| Insight Category | Metadata Key | KB Field | Type |
|-----------------|--------------|----------|------|
| `business_context` | `bottleneck` | `biggestBottleNeck` | Direct |
| `business_context` | `companyStage` | `extractedKnowledge.companyStages` | JSON array |
| `business_context` | `growthIndicators` | `extractedKnowledge.growthIndicators` | JSON array |
| `business_context` | `hiddenComplexity` | `extractedKnowledge.hiddenComplexities` | JSON array |
| `workflow_patterns` | `clusterName` | `extractedKnowledge.taskClusters` | JSON array |
| `workflow_patterns` | `implicitNeed` | `extractedKnowledge.implicitNeeds` | JSON array |
| `process_optimization` | `painPoint` | `extractedKnowledge.painPoints` | JSON array |
| `process_optimization` | `documentationGap` | `extractedKnowledge.documentationGaps` | JSON array |
| `process_optimization` | `processComplexity` | `extractedKnowledge.processComplexities` | JSON array |

**Conflict Resolution**:
- If field exists: only overwrite if confidence ≥ 90
- If field empty: apply if confidence ≥ 80
- Array fields: append new items (no overwrite)

---

## Knowledge Base Context Integration

### KB Used in Analysis
The analysis pipeline uses KB context to:
1. **Personalize analysis** - Uses business name, industry, tools, bottlenecks
2. **Auto-fill forms** - Pre-populates intake form fields
3. **Improve recommendations** - Considers existing processes and tools

### KB Snapshot Saved
When analysis is saved:
- **`usedKnowledgeBaseVersion`**: KB version number used
- **`knowledgeBaseSnapshot`**: Full snapshot of KB state (all non-JSON fields)
- **Purpose**: Audit trail - shows what KB state influenced the analysis

### KB Enriched from Analysis
After analysis saves:
- **LearningEvents created** from extracted insights
- **KB fields updated** (if confidence ≥ 80)
- **`enrichmentVersion++`** - Tracks KB evolution
- **Future analyses** use enriched KB

---

## Confidence Thresholds

- **Minimum for extraction**: 75 (medium confidence insights)
- **Minimum for KB application (MVP)**: 80
- **Override existing values**: 90
- **High confidence sources**:
  - Primary bottleneck: 90
  - Pain points from SOPs: 85
  - Documentation gaps: 85
  - High-severity risks: 90
  - Red flags: 90

---

## Data Flow Summary

```
JD Intake Form
    ↓
Multi-Stage AI Analysis (5 stages)
    ↓
Extract Insights (extractInsights)
    ↓
Save Analysis (with extractedInsights)
    ↓
Create LearningEvents (one per insight)
    ↓
Apply to KB (if confidence ≥ 80)
    ↓
Enriched Knowledge Base
    ↓
Future JD Analyses (richer context)
```

---

## Key Differences from Conversation Learning

| Aspect | Conversations | Job Descriptions |
|--------|-------------|------------------|
| **Source** | Chat messages | Structured JD analysis |
| **Extraction** | AI-powered (GPT-4o-mini) | Rule-based from analysis results |
| **Confidence** | 50-100 (AI-assigned) | 75-90 (source-based) |
| **Frequency** | Every message (if non-trivial) | Once per analysis save |
| **Volume** | 1-5 insights per exchange | 10-30 insights per analysis |
| **Categories** | business_context, customer_market | business_context, workflow_patterns, process_optimization |
| **Reliability** | Lower (inferred from text) | Higher (from structured analysis) |

---

## Key Files

1. **Frontend**: `src/app/dashboard/jd-builder/page.tsx`
2. **Analysis API**: `src/app/api/jd/analyze/route.ts`
3. **Save API**: `src/app/api/jd/save/route.ts`
4. **Insight Extraction**: `src/lib/analysis/extractInsights.ts` (extractFromJdAnalysis)
5. **Learning Events**: `src/lib/learning-events.ts`
6. **KB Enrichment**: `src/lib/apply-learning-events.ts`
7. **Database Schema**: `prisma/schema.prisma` (SavedAnalysis, LearningEvent models)

---

## Benefits

1. **Structured Learning**: JD analyses provide structured, high-quality insights
2. **High Confidence**: Insights from validated analysis (confidence 75-90)
3. **Comprehensive Coverage**: Extracts from multiple analysis stages
4. **Audit Trail**: KB snapshot saved with each analysis
5. **Continuous Improvement**: Each JD analysis enriches KB for future analyses
6. **Non-Blocking**: KB enrichment doesn't block analysis save

---

## Example Flow

### Scenario: User creates JD analysis for "Marketing Coordinator"

1. **User fills form**:
   - Business: "Acme Corp"
   - Tasks: "Social media management", "Content creation", "Email campaigns"
   - Outcome: "Increase social engagement by 50%"

2. **Analysis runs**:
   - Discovery identifies: company_stage="growth", bottleneck="Content creation bottleneck"
   - SOP analysis finds: pain_point="Manual scheduling", gap="No content calendar process"
   - Service classification: "Dedicated VA" (confidence: High)

3. **Insights extracted**:
   - "Primary bottleneck identified: Content creation bottleneck" (confidence: 90)
   - "Process pain point: Manual scheduling" (confidence: 85)
   - "Documentation gap: No content calendar process" (confidence: 85)
   - "Company stage: growth" (confidence: 85)

4. **Analysis saved**:
   - SavedAnalysis created with all insights
   - LearningEvents created (4 events)

5. **KB enriched**:
   - `biggestBottleNeck` updated: "Content creation bottleneck" (confidence 90)
   - `extractedKnowledge.painPoints` appended: ["Manual scheduling"]
   - `extractedKnowledge.documentationGaps` appended: ["No content calendar process"]
   - `extractedKnowledge.companyStages` appended: ["growth"]

6. **Future benefit**:
   - Next JD analysis uses enriched KB
   - Form auto-fills with updated bottleneck
   - Analysis considers existing pain points

---

## Future Enhancements

- Lower confidence threshold (currently 80 for MVP)
- Extract insights from detailed JD specs (skills, tools, KPIs)
- Cross-reference insights across multiple JD analyses
- Automatic KB completeness scoring updates
- User review/approval workflow for high-impact insights
- Duplicate detection across analyses

