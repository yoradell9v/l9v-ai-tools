# Business Brain Mental Model

## Overview
This document explains the complete flow of how a Business Brain is created, displayed, and enhanced, from initial form submission to chat interactions and enhancements.

---

## 🎯 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL SETUP FLOW                            │
│              (List Page → Setup → Individual Page)               │
└─────────────────────────────────────────────────────────────────┘

1. User fills intake form (List Page)
   ↓
2. POST /api/business-brain/setup
   ├─ Validates intake data
   ├─ Uploads files to /public/uploads/
   ├─ Creates BusinessBrain record
   └─ Returns businessBrainId
   ↓
3. POST /api/business-brain/generate-cards?profileId={id}
   ├─ Analyzes intake data + files
   ├─ Generates 5 AI cards (Brand Voice, Positioning, Style Rules, Compliance, GHL)
   ├─ Calculates confidence scores
   ├─ Saves cards to database
   └─ Invalidates enhancement cache
   ↓
4. POST /api/business-brain/{id}/synthesize-knowledge
   ├─ Normalizes intake data
   ├─ Extracts card insights
   ├─ Performs cross-analysis
   ├─ Calls OpenAI to synthesize knowledge base
   ├─ Validates schema
   ├─ Saves knowledgeBase to BusinessBrain
   └─ Invalidates enhancement cache
   ↓
5. POST /api/business-brain/calculate-completion
   ├─ Calculates completion score (Tier 1 + Tier 2)
   ├─ Analyzes card confidence (with caching)
   ├─ Generates missing contexts recommendations
   ├─ Saves completionScore & completionData
   └─ Returns enhancementAnalysis
   ↓
6. Redirect to /dashboard/ai-business-brain/{id}
```

---

## 📋 Detailed Flow Breakdown

### 1. INITIAL SETUP FLOW

**Location:** `src/app/dashboard/ai-business-brain/page.tsx`

#### Step 1: Form Submission
- User clicks "Setup New Business Brain"
- Modal opens with `BaseIntakeForm` component
- User fills out form (Quick Start + Optional sections)
- Files are selected/uploaded via drag-and-drop

#### Step 2: Setup API Call
**Route:** `POST /api/business-brain/setup`
**File:** `src/app/api/business-brain/setup/route.ts`

**What happens:**
1. Validates required intake fields
2. Processes file uploads:
   - Saves files to `/public/uploads/business-brain/{brainId}/{fieldId}/`
   - Creates file metadata objects with `{url, name, size, type}`
3. Creates `BusinessBrain` record in database:
   ```typescript
   {
     userOrganizationId: string,
     intakeData: JSON,    
     fileUploads: JSON,     
     knowledgeBase: null,  
     completionScore: null,
   }
   ```
4. Returns `{ success: true, businessBrainId: string }`

#### Step 3: Generate Cards
**Route:** `POST /api/business-brain/generate-cards?profileId={id}`
**File:** `src/app/api/business-brain/generate-cards/route.ts`

**What happens:**
1. Fetches `BusinessBrain` with intake data and files
2. Extracts content from uploaded files (PDFs, docs, text)
3. Generates 5 AI-powered cards using OpenAI:
   - **BRAND_VOICE_CARD**: Voice style, tone, vocabulary
   - **POSITIONING_CARD**: Market position, differentiation
   - **STYLE_RULES**: Content guidelines, formatting rules
   - **COMPLIANCE_RULES**: Legal disclaimers, forbidden words
   - **GHL_IMPLEMENTATION_NOTES**: GoHighLevel integration notes
4. Each card includes:
   - `title`: Card title
   - `description`: Detailed content (markdown)
   - `metadata`: Confidence score, card-specific data
   - `orderIndex`: Display order
5. Deletes old cards and saves new ones
6. **Cache Invalidation:** Deletes all `EnhancementAnalysis` records for this brain
7. Returns `{ success: true, cards: [...] }`

#### Step 4: Synthesize Knowledge Base
**Route:** `POST /api/business-brain/{id}/synthesize-knowledge`
**File:** `src/app/api/business-brain/[businessBrainId]/synthesize-knowledge/route.ts`

**What happens:**
1. Fetches `BusinessBrain` with all cards
2. Normalizes intake data (handles missing fields)
3. Extracts insights from each card
4. Performs cross-analysis:
   - Detects cross-links between cards
   - Identifies contradictions
5. Calls OpenAI to synthesize comprehensive knowledge base:
   - Combines intake data + card insights + cross-analysis
   - Generates structured knowledge base with:
     - `businessOverview`: Name, offers, pricing, CTA
     - `brandVoice`: Rules, vocabulary, patterns
     - `positioning`: Value prop, audience, objections
     - `marketingStrategy`: Channels, messaging
     - `contentFramework`: Style rules, examples
     - `compliance`: Disclaimers, forbidden claims
     - `operations`: CRM, templates
     - `knowledgeObjects`: Definitions, rules, examples
6. Validates schema structure
7. Saves `knowledgeBase` to `BusinessBrain`
8. **Cache Invalidation:** Deletes all `EnhancementAnalysis` records
9. Returns `{ success: true }`

#### Step 5: Calculate Completion
**Route:** `POST /api/business-brain/calculate-completion`
**File:** `src/app/api/business-brain/calculate-completion/route.ts`

**What happens:**
1. Fetches `BusinessBrain` with cards
2. Calculates completion score:
   - **Tier 1 (Required):** Checks all Quick Start fields
   - **Tier 2 (Optional):** Checks Compliance, Proof, Voice, Operations sections
   - Score = (Tier 1 points + Tier 2 points) / Total possible points
3. Analyzes card confidence:
   - **With Caching:** Checks if analysis exists and data hasn't changed
   - **Data Hash:** Calculates hash of cards + intakeData + fileUploads
   - **If cached:** Returns cached `EnhancementAnalysis`
   - **If not cached or forceRefresh:**
     - Calls OpenAI to analyze each card's confidence
     - Identifies missing contexts per card
     - Generates recommendations with field types (text/textarea/file)
     - Saves to `EnhancementAnalysis` table
4. Updates `BusinessBrain`:
   - `completionScore`: Number (0-100)
   - `completionData`: JSON with tier completion, quick wins
5. Returns:
   ```typescript
   {
     success: true,
     completionData: {...},
     enhancementAnalysis: {
       cardAnalysis: [...],
       overallAnalysis: {...}
     },
     lastAnalyzedAt: "ISO timestamp"
   }
   ```

#### Step 6: Redirect to Individual Page
- Router navigates to `/dashboard/ai-business-brain/{id}`
- Individual page loads (see next section)

---

### 2. INDIVIDUAL BRAIN PAGE LOADING

**Location:** `src/app/dashboard/ai-business-brain/[businessBrainId]/page.tsx`

#### Initial Load
**Route:** `GET /api/business-brain/{id}`
**File:** `src/app/api/business-brain/[businessBrainId]/route.ts`

**What happens:**
1. Verifies user access (organization membership)
2. Fetches `BusinessBrain` with:
   - `intakeData`: Form values
   - `fileUploads`: File metadata
   - `completionScore`: Completion percentage
   - `cards`: All business cards (ordered by `orderIndex`)
3. Returns:
   ```typescript
   {
     success: true,
     businessBrain: {...},
     cards: [...]
   }
   ```

**Frontend State:**
- `businessBrainData`: Stores intakeData and fileUploads
- `cards`: Array of card objects
- `status`: "cards_ready" if cards exist, "idle" otherwise
- `chatMessages`: Empty array
- `currentConversationId`: null

---

### 3. CHAT FLOW

**Location:** `src/app/dashboard/ai-business-brain/[businessBrainId]/page.tsx`

#### Step 1: User Sends Message
- User types message in chat input
- Clicks send or presses Enter

#### Step 2: Create/Get Conversation
**Route:** `POST /api/business-brain/{id}/conversation`
**File:** `src/app/api/business-brain/[businessBrainId]/conversation/route.ts`

**What happens:**
- If `currentConversationId` is null:
  - Creates new `BusinessConversation` record
  - Sets title from first 50 chars of message
  - Returns `{ conversation: { id: string } }`
- If `currentConversationId` exists:
  - Uses existing conversation ID

#### Step 3: Send Message
**Route:** `POST /api/business-brain/{id}/conversation/{convId}/message`
**File:** `src/app/api/business-brain/[businessBrainId]/conversation/[conversationId]/message/route.ts`

**What happens:**
1. Saves user message to `BusinessMessage` table
2. Retrieves `BusinessBrain` with:
   - `knowledgeBase`: Synthesized knowledge
   - `intakeData`: Form data
   - `cards`: All cards
3. Builds context for AI:
   - Knowledge base (structured)
   - Relevant cards (based on message)
   - Intake data (for context)
4. Calls OpenAI with:
   - System prompt: Instructions for business assistant
   - User message: User's question
   - Context: Knowledge base + cards
5. Generates response with:
   - Citations (which cards were referenced)
   - Confidence score
6. Saves assistant message to database
7. Returns:
   ```typescript
   {
     success: true,
     assistantMessage: {
       id: string,
       content: string,
       citations: [...],
       confidence: number
     }
   }
   ```

**Frontend Updates:**
- Adds user message to `chatMessages` state
- Adds assistant message to `chatMessages` state
- Displays citations and confidence score

---

### 4. ENHANCEMENT FLOW

**Location:** `src/app/dashboard/ai-business-brain/[businessBrainId]/page.tsx`

#### Step 1: User Clicks "Enhance" Button
- Opens enhancement modal
- Sets `isLoadingEnhancement = true`

#### Step 2: Fetch Enhancement Analysis
**Route:** `POST /api/business-brain/calculate-completion`
**Body:** `{ businessBrainId, forceRefresh: false }`

**What happens:**
1. Checks for cached analysis (unless `forceRefresh: true`)
2. If cached and data hasn't changed:
   - Returns cached `EnhancementAnalysis`
3. If not cached or data changed:
   - Analyzes card confidence with AI
   - Generates missing contexts per card
   - Saves to cache
4. Returns analysis with:
   - `cardAnalysis`: Per-card analysis with missing contexts
   - `overallAnalysis`: Summary stats

**Frontend State:**
- `enhancementAnalysis`: Stores analysis result
- `enhancementFormData`: Pre-populated with existing intake data
- `enhancementFiles`: Empty object
- `lastAnalyzedAt`: Timestamp of analysis

#### Step 3: Display Missing Fields Section
- Collects all unique missing contexts from all cards
- Calculates completion percentage:
  - `filledCount / totalMissing * 100`
- Displays:
  - Progress bar with percentage
  - All missing fields with appropriate input types:
    - **text**: Single-line input
    - **textarea**: Multi-line input
    - **file**: Drag-and-drop file upload
  - Checkmarks for filled fields

#### Step 4: User Fills Missing Fields
- User enters text/textarea values
- User uploads files via drag-and-drop
- State updates:
  - `enhancementFormData`: Text values
  - `enhancementFiles`: File objects

#### Step 5: User Clicks "Save & Regenerate"
- Sets `isSavingEnhancement = true`
- Shows loader on button

#### Step 6: Update Business Brain
**Route:** `POST /api/business-brain/{id}/update`
**File:** `src/app/api/business-brain/[businessBrainId]/update/route.ts`

**What happens:**
1. Merges new intake data with existing:
   ```typescript
   updatedIntakeData = {
     ...existingIntakeData,
     ...newIntakeData
   }
   ```
2. Processes new file uploads:
   - Saves files to `/public/uploads/business-brain/{id}/{fieldId}/`
   - Creates file metadata
   - Merges with existing `fileUploads` array
3. Updates `BusinessBrain` record
4. **Cache Invalidation:** Deletes all `EnhancementAnalysis` records
5. Returns `{ success: true }`

#### Step 7: Regenerate Cards
**Route:** `POST /api/business-brain/generate-cards?profileId={id}`

**What happens:**
- Same as Step 3 in Initial Setup
- Generates new cards with updated data
- Invalidates cache

#### Step 8: Re-synthesize Knowledge
**Route:** `POST /api/business-brain/{id}/synthesize-knowledge`

**What happens:**
- Same as Step 4 in Initial Setup
- Creates new knowledge base with updated data
- Invalidates cache

#### Step 9: Recalculate Completion
**Route:** `POST /api/business-brain/calculate-completion`
**Body:** `{ businessBrainId, forceRefresh: true }`

**What happens:**
- Forces new analysis (ignores cache)
- Updates completion score
- Returns fresh enhancement analysis

#### Step 10: Reload Brain Data
**Route:** `GET /api/business-brain/{id}`

**What happens:**
- Fetches updated brain with new cards
- Updates frontend state

**Frontend Updates:**
- `cards`: Updated with new cards
- `businessBrainData`: Updated intake data and files
- `enhancementAnalysis`: Fresh analysis
- `enhancementFormData`: Cleared
- `enhancementFiles`: Cleared
- `isSavingEnhancement`: Set to false

---

### 5. EDIT FLOW

**Location:** `src/app/dashboard/ai-business-brain/[businessBrainId]/page.tsx`

#### Step 1: User Clicks "Edit" Button
- Opens edit modal with `BaseIntakeForm`
- Pre-populates form with `businessBrainData.intakeData`

#### Step 2: User Submits Form
- Calls `onSubmit` handler
- **Route:** `POST /api/business-brain/setup`
- Creates/updates `BusinessBrain` (same as initial setup)

#### Step 3: Regenerate Everything
- Calls `generate-cards` → `synthesize-knowledge` → `calculate-completion`
- Same sequence as Initial Setup (Steps 3-5)

#### Step 4: Reload Data
- Fetches updated brain
- Updates state
- Closes modal

---

## 🔄 Cache Invalidation Strategy

The system uses a hash-based caching mechanism for enhancement analysis:

### When Cache is Invalidated:
1. **After card generation** (`generate-cards` route)
2. **After knowledge synthesis** (`synthesize-knowledge` route)
3. **After brain update** (`update` route)

### Cache Key:
- **Data Hash:** Hash of `cards` + `intakeData` + `fileUploads`
- If data changes, hash changes, cache becomes invalid

### Cache Storage:
- **Model:** `EnhancementAnalysis`
- **Fields:**
  - `brainId`: BusinessBrain ID
  - `analysis`: Full analysis JSON
  - `dataHash`: Hash of data at time of analysis
  - `cardIds`: Which cards were analyzed
  - `cardConfidences`: Confidence scores at analysis time
  - `generatedAt`: Timestamp

### Cache Retrieval:
- Checks if `dataHash` matches current data
- If match: Returns cached analysis
- If no match or `forceRefresh: true`: Generates new analysis

---

## 📊 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                 │
└─────────────────────────────────────────────────────────────┘

User Input (Form)
    ↓
BusinessBrain.intakeData (JSON)
    ↓
BusinessCard[] (5 cards with confidence scores)
    ↓
BusinessBrain.knowledgeBase (Synthesized knowledge)
    ↓
BusinessBrain.completionScore (0-100)
    ↓
EnhancementAnalysis (Cached analysis)
    ↓
User Enhancement Input
    ↓
Updated BusinessBrain
    ↓
Regenerated Cards
    ↓
Updated Knowledge Base
```

---

## 🎯 Key Components

### Frontend Components:
1. **List Page** (`page.tsx`): Shows all business brains, setup modal
2. **Individual Page** (`[businessBrainId]/page.tsx`): Chat interface, cards, enhance modal
3. **BaseIntakeForm**: Reusable form component with drag-and-drop
4. **Modal**: Reusable modal component

### API Routes:
1. **setup**: Creates business brain
2. **generate-cards**: Generates AI cards
3. **synthesize-knowledge**: Creates knowledge base
4. **calculate-completion**: Calculates scores and analysis
5. **update**: Updates brain with new data
6. **conversation**: Manages chat conversations
7. **message**: Handles chat messages

### Database Models:
1. **BusinessBrain**: Main entity
2. **BusinessCard**: AI-generated cards
3. **BusinessConversation**: Chat conversations
4. **BusinessMessage**: Chat messages
5. **EnhancementAnalysis**: Cached enhancement analysis

---

## 🔍 Important Notes

1. **File Storage:** Files are stored in `/public/uploads/business-brain/{brainId}/{fieldId}/`
2. **Cache Strategy:** Enhancement analysis is cached to reduce OpenAI calls
3. **Confidence Scores:** Each card has a confidence score (0-100)
4. **Completion Score:** Overall form completion (0-100)
5. **Missing Contexts:** AI recommends specific fields/files to improve confidence
6. **Knowledge Base:** Comprehensive structured knowledge used for chat responses
7. **Citations:** Chat responses include citations to relevant cards

---

## 🚀 Performance Optimizations

1. **Caching:** Enhancement analysis cached to avoid repeated OpenAI calls
2. **Hash-based Invalidation:** Only regenerates when data actually changes
3. **Lazy Loading:** Cards and knowledge base loaded on demand
4. **Batch Operations:** Multiple cards generated in parallel where possible

---

This mental model should help you understand the complete flow from form submission to chat interactions and enhancements.

