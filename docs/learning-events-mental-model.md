# Learning Events Mental Model: Conversation → Knowledge Base Enrichment

## Overview
This document explains how conversations in the AI Business Brain (`page.tsx`) automatically create learning events that enrich the organization's knowledge base through a multi-stage AI-powered pipeline.

---
` 
## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER CONVERSATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. User sends message in AI Business Brain (page.tsx)          │
│     - Message sent to:                                           │
│       POST /api/organization-knowledge-base/                     │
│       conversation/[conversationId]/message                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. AI Response Generation                                       │
│     - OpenAI generates assistant response                        │
│     - Uses knowledge base context + conversation history        │
│     - Response saved to database                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. AI-Powered Insight Extraction                                │
│     Function: extractStructuredInsightsFromConversation()       │
│     - Uses GPT-4o-mini (cheaper model)                          │
│     - Analyzes: userMessage + assistantMessage + history        │
│     - Filters out trivial messages (< 20 chars, "thanks", etc.)  │
│     - Extracts structured JSON with categories:                 │
│       • business_context (bottlenecks, pain points, growth)     │
│       • process_optimization (tools, process changes)            │
│       • customer_market (objections, feedback, insights)         │
│       • knowledge_gap (missing info questions)                   │
│       • compliance (regulatory mentions)                        │
│     - Returns: { has_insights: true/false, confidence: 0-100 }   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────┴─────────┐
                    │  Has Insights?   │
                    │  Confidence ≥50?  │
                    └─────────┬─────────┘
                              │ YES
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Convert Insights to ExtractedInsight Format                 │
│     Function: extractInsights("CHAT_CONVERSATION", data)         │
│     - Maps structured insights to ExtractedInsight[]            │
│     - Each insight gets:                                        │
│       • insight: string (human-readable description)           │
│       • category: string (business_context, workflow_patterns) │
│       • eventType: LearningEventType (INSIGHT_GENERATED, etc.)  │
│       • confidence: number (0-100, boosted for important items)│
│       • metadata: object (structured data for KB mapping)      │
│     - Example outputs:                                           │
│       • "Bottleneck identified: Customer onboarding takes 2 weeks"│
│       • "New tool mentioned: Notion"                            │
│       • "New objection identified: Price is too high"            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Create LearningEvents in Database                            │
│     Function: createLearningEvents()                             │
│     - Creates one LearningEvent per ExtractedInsight           │
│     - Stores in database with:                                  │
│       • knowledgeBaseId (links to KB)                           │
│       • eventType (PATTERN_DETECTED, INSIGHT_GENERATED, etc.)   │
│       • insight (text description)                              │
│       • category (business_context, workflow_patterns, etc.)   │
│       • confidence (0-100)                                      │
│       • metadata (JSON for field mapping)                       │
│       • sourceIds: [conversationId]                            │
│       • applied: false (initially)                              │
│     - Returns: { success, eventsCreated, eventIds }             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Apply LearningEvents to Knowledge Base                       │
│     Function: applyLearningEventsToKB()                         │
│     - Fetches unapplied events with confidence ≥ 80 (MVP)      │
│     - For each event:                                           │
│       1. Map insight to KB field (mapInsightToKBField)          │
│       2. Resolve conflicts (don't overwrite unless high conf)  │
│       3. Update KB field(s)                                     │
│     - Field mappings:                                           │
│       • bottleneck → biggestBottleNeck                         │
│       • new_tool → toolStack (array append)                    │
│       • objection → topObjection (if higher confidence)        │
│       • pain_point → extractedKnowledge.painPoints              │
│       • company_stage → extractedKnowledge.companyStages       │
│     - Marks events as applied: true                             │
│     - Updates KB: enrichmentVersion++, lastEnrichedAt          │
│     - Returns: { eventsApplied, fieldsUpdated, errors }        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Enriched Knowledge Base                                      │
│     - KB now contains new insights from conversation            │
│     - Future conversations use enriched KB context              │
│     - Continuous learning loop: conversations → insights → KB   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. User Input (page.tsx)
**Location**: `src/app/dashboard/ai-business-brain/page.tsx`

- User types message in chat interface
- `handleSendMessage()` sends POST request to message API
- Message includes conversationId (or creates new conversation)

### 2. Message Processing (route.ts)
**Location**: `src/app/api/organization-knowledge-base/conversation/[conversationId]/message/route.ts`

**Key Functions**:
- `extractStructuredInsightsFromConversation()` - AI extraction
- `extractInsights()` - Format conversion
- `createLearningEvents()` - Database storage
- `applyLearningEventsToKB()` - KB enrichment

**Process**:
1. Save user message to database
2. Generate AI response using KB context
3. Save assistant response
4. **Extract insights** (if message is non-trivial)
5. **Create learning events** (if insights found)
6. **Apply to KB** (if confidence ≥ 80)

### 3. Insight Extraction Pipeline

#### Step 3a: AI Extraction (`extractStructuredInsightsFromConversation`)
- **Model**: GPT-4o-mini (cost-effective)
- **Input**: 
  - Current user message
  - Current assistant response
  - Last 5 messages (context)
  - Current KB state (to avoid duplicates)
- **Output**: Structured JSON with categories:
  ```json
  {
    "business_context": {
      "bottleneck": "...",
      "pain_point": "...",
      "growth_indicator": "...",
      "company_stage": "startup|growth|established"
    },
    "process_optimization": {
      "new_tool": "...",
      "process_change": "...",
      "documentation_gap": "..."
    },
    "customer_market": {
      "new_objection": "...",
      "customer_feedback": "...",
      "market_insight": "..."
    },
    "confidence": 75,
    "has_insights": true
  }
  ```

#### Step 3b: Format Conversion (`extractInsights`)
- Converts structured JSON to `ExtractedInsight[]`
- Each insight becomes:
  ```typescript
  {
    insight: "Bottleneck identified: Customer onboarding",
    category: "business_context",
    eventType: LearningEventType.INSIGHT_GENERATED,
    confidence: 80,
    metadata: {
      bottleneck: "Customer onboarding",
      sourceSection: "conversation.structured_insights.business_context"
    }
  }
  ```

### 4. LearningEvent Creation (`createLearningEvents`)
**Location**: `src/lib/learning-events.ts`

- Creates database records in `LearningEvent` table
- One event per insight
- Fields:
  - `applied: false` (initially)
  - `confidence` (used for filtering)
  - `metadata` (used for KB field mapping)

### 5. KB Enrichment (`applyLearningEventsToKB`)
**Location**: `src/lib/apply-learning-events.ts`

**Process**:
1. **Fetch unapplied events** with `confidence >= 80` (MVP threshold)
2. **Map to KB fields** using `mapInsightToKBField()`:
   - `category` + `metadata` → KB field name
   - Example: `business_context.bottleneck` → `biggestBottleNeck`
3. **Resolve conflicts**:
   - If field exists: only overwrite if confidence ≥ 90
   - If field empty: apply if confidence ≥ 80
4. **Update KB**:
   - Direct fields: `biggestBottleNeck`, `topObjection`, etc.
   - Array fields: `toolStack` (append new tools)
   - JSON fields: `extractedKnowledge` (structured data)
5. **Mark as applied**:
   - `applied: true`
   - `appliedAt: now()`
   - `appliedToFields: ["biggestBottleNeck"]`
6. **Update KB versioning**:
   - `enrichmentVersion++`
   - `lastEnrichedAt: now()`

---

## Field Mapping Examples

| Insight Category | Metadata Key | KB Field | Type |
|-----------------|--------------|----------|------|
| `business_context` | `bottleneck` | `biggestBottleNeck` | Direct |
| `business_context` | `companyStage` | `extractedKnowledge.companyStages` | JSON array |
| `business_context` | `growthIndicators` | `extractedKnowledge.growthIndicators` | JSON array |
| `workflow_patterns` | `newTool` | `toolStack` | Array append |
| `customer_market` | `objection` | `topObjection` | Direct (if higher conf) |
| `process_optimization` | `painPoint` | `extractedKnowledge.painPoints` | JSON array |
| `process_optimization` | `documentationGap` | `extractedKnowledge.documentationGaps` | JSON array |

---

## Confidence Thresholds

- **Minimum for extraction**: 50 (AI extraction confidence)
- **Minimum for KB application (MVP)**: 80
- **Override existing values**: 90
- **Default confidence**: 70 (if not provided)

---

## Error Handling

- **Insight extraction fails**: Non-blocking, conversation continues
- **LearningEvent creation fails**: Logged, doesn't block response
- **KB enrichment fails**: Logged, events remain unapplied for retry

---

## Data Flow Summary

```
Conversation Message
    ↓
AI Response (GPT-4o)
    ↓
AI Insight Extraction (GPT-4o-mini)
    ↓
ExtractedInsight[] (structured)
    ↓
LearningEvent[] (database records)
    ↓
KB Field Updates (if confidence ≥ 80)
    ↓
Enriched Knowledge Base
    ↓
Future Conversations (richer context)
```

---

## Key Files

1. **Frontend**: `src/app/dashboard/ai-business-brain/page.tsx`
2. **Message API**: `src/app/api/organization-knowledge-base/conversation/[conversationId]/message/route.ts`
3. **Insight Extraction**: `src/lib/analysis/extractInsights.ts`
4. **Learning Events**: `src/lib/learning-events.ts`
5. **KB Enrichment**: `src/lib/apply-learning-events.ts`
6. **Database Schema**: `prisma/schema.prisma` (LearningEvent model)

---

## Benefits

1. **Automatic Learning**: No manual data entry needed
2. **Continuous Improvement**: KB gets smarter with each conversation
3. **Context Preservation**: Insights captured from natural conversations
4. **High Confidence Only**: MVP only applies high-confidence insights (≥80)
5. **Non-Blocking**: Failures don't interrupt user experience
6. **Traceable**: Each enrichment linked to source conversation

---

## Future Enhancements

- Lower confidence threshold (currently 80 for MVP)
- Batch processing of unapplied events
- User review/approval workflow
- Insight quality scoring
- Duplicate detection across conversations
- Automatic KB completeness scoring updates

