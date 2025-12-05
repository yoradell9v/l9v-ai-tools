# Mental Model: Message Route Flow

## Overview
This route handles POST requests to create a new message in a business conversation. It analyzes user intent, loads relevant knowledge cards, generates an AI response, and tracks citations.

---

## Main Flow Diagram

```
POST Request
    │
    ├─► Authentication & Validation
    │   ├─► Check accessToken
    │   ├─► Verify user organizations
    │   └─► Validate message content
    │
    ├─► Load Data
    │   ├─► Fetch conversation (parallel)
    │   └─► Fetch businessBrain with cards (parallel)
    │
    ├─► Analyze Intent
    │   └─► analyzeUserIntent()
    │       ├─► Try AI analysis (gpt-4o-mini)
    │       └─► Fallback to keyword matching
    │
    ├─► Load Cards by Relevance
    │   └─► loadCardsByRelevance()
    │       └─► Returns: loadedCards + cardRelevance map
    │
    ├─► Manage Active Cards
    │   └─► Merge new relevant cards with existing active cards
    │
    ├─► Context Summary (async, fire-and-forget)
    │   └─► generateContextSummary() [if threshold met]
    │       └─► Uses OpenAI to summarize conversation
    │
    ├─► Build System Prompt
    │   └─► buildSystemPrompt()
    │       ├─► Includes knowledge base
    │       ├─► Includes loaded cards (by relevance)
    │       ├─► Includes behavioral rules
    │       └─► Includes context summary (if available)
    │
    ├─► Prepare Messages Array
    │   ├─► System prompt
    │   ├─► Conversation history (last 10 messages)
    │   └─► Current user message
    │
    ├─► Save User Message
    │   └─► Create in database with intent metadata
    │
    ├─► Call OpenAI API
    │   └─► Generate AI response (gpt-4o)
    │
    ├─► Analyze Response
    │   ├─► extractCardCitations()
    │   │   └─► Finds which cards were referenced in response
    │   │
    │   └─► calculateResponseConfidence()
    │       └─► Calculates confidence score based on citations
    │
    └─► Save & Return
        ├─► Save assistant message (in transaction)
        ├─► Update conversation (activeCardIds, messageCount)
        └─► Return JSON response
```

---

## Function Call Hierarchy

### Level 1: Entry Point
- **`POST()`** - Main request handler (line 47)

### Level 2: Called by POST (in order)
1. **`analyzeUserIntent()`** (line 163)
   - Called with: `userMessage`, `businessBrain.cards`
   - Returns: `{ category, relevantCards, confidence, reasoning }`
   - May call OpenAI internally (gpt-4o-mini)

2. **`loadCardsByRelevance()`** (line 165)
   - Called with: `businessBrain.cards`, `intent`
   - Returns: `{ loadedCards, cardRelevance }`
   - Uses intent to calculate relevance scores

3. **`generateContextSummary()`** (line 193) - **ASYNC/FIRE-AND-FORGET**
   - Called conditionally (if messageCount >= threshold)
   - Runs in background, doesn't block main flow
   - May call OpenAI internally (gpt-4o-mini)

4. **`buildSystemPrompt()`** (line 229)
   - Called with: `businessBrain`, `cardData.loadedCards`, `conversation.contextSummary`
   - Returns: `string` (the system prompt)
   - Pure function, no external calls

5. **`extractCardCitations()`** (line 312)
   - Called with: `aiResponse`, `cardData.loadedCards`, `businessBrain.cards`
   - Returns: `CardCitation[]`
   - Analyzes AI response text to find card references

6. **`calculateResponseConfidence()`** (line 319)
   - Called with: `citations`, `cardData.cardRelevance`, `businessBrain.cards`, `hasKnowledgeBase`
   - Returns: `number` (confidence score 0-100)
   - Pure function, calculates weighted average

---

## Detailed Function Descriptions

### 1. `analyzeUserIntent(userMessage, cards)`
**Purpose**: Determine what the user is asking for and which cards are relevant.

**Flow**:
```
analyzeUserIntent()
    │
    ├─► Try AI Analysis (if OpenAI available)
    │   ├─► Call OpenAI (gpt-4o-mini)
    │   ├─► Parse JSON response
    │   └─► Map card types → card IDs
    │
    └─► Fallback: Keyword Matching
        ├─► Count keyword matches per category
        ├─► Find highest scoring category
        └─► Map category → card types → card IDs
```

**Returns**:
- `category`: "content_generation" | "business_info" | "compliance" | "technical_setup" | "general"
- `relevantCards`: Array of card IDs
- `confidence`: 0-100
- `reasoning`: Explanation string

---

### 2. `loadCardsByRelevance(cards, intent)`
**Purpose**: Load card content based on relevance score. Higher relevance = more content loaded.

**Flow**:
```
loadCardsByRelevance()
    │
    ├─► For each card:
    │   ├─► Calculate relevance score:
    │   │   ├─► High (80-100): Card in intent.relevantCards
    │   │   ├─► Medium (40-79): Card type matches intent.category
    │   │   └─► Low (0-39): Other cards
    │   │
    │   └─► Determine content to load:
    │       ├─► ≥80%: Full description + metadata + priority
    │       ├─► 40-79%: First 500 chars of description only
    │       └─► <40%: Title only
    │
    └─► Return: { loadedCards, cardRelevance }
```

**Returns**:
- `loadedCards`: Array with type, title, relevance, content
- `cardRelevance`: Map of cardId → relevance score

---

### 3. `buildSystemPrompt(businessBrain, loadedCards, contextSummary)`
**Purpose**: Build the system prompt that instructs the AI how to respond.

**Structure**:
```
System Prompt =
    Role Definition (business name)
    + Knowledge Base (full JSON)
    + Knowledge Cards (loaded by relevance)
    + Behavioral Rules (5 rules)
    + Context Summary (if available)
```

**No external calls** - pure string building function.

---

### 4. `extractCardCitations(aiResponse, loadedCards, allCards)`
**Purpose**: Analyze the AI's response to find which cards it referenced.

**Flow**:
```
extractCardCitations()
    │
    ├─► For each loaded card:
    │   ├─► Check for direct name mentions (title/type in response)
    │   │   └─► If found: +30 citation strength
    │   │
    │   ├─► If relevance ≥80%:
    │   │   ├─► Check for forbidden words avoidance
    │   │   └─► Check for style pattern matches
    │   │
    │   └─► If citation strength ≥30:
    │       └─► Add to citations array
    │
    └─► Return: CardCitation[]
```

**Returns**: Array of citations with cardId, cardType, excerpts, confidence

---

### 5. `calculateResponseConfidence(citations, cardRelevance, allCards, hasKnowledgeBase)`
**Purpose**: Calculate overall confidence score for the AI response.

**Formula**:
```
If no citations:
    → 65 (if KB exists) or 50 (if no KB)

If citations exist:
    For each citation:
        weighted = (cardConfidence × 0.5) + (relevanceScore × 0.3) + (citationStrength × 0.2)
    
    overall = average of all weighted confidences
```

**Returns**: Number 0-100

---

### 6. `generateContextSummary(conversationId, messageCount)`
**Purpose**: Generate a summary of conversation context (runs async, doesn't block).

**Flow**:
```
generateContextSummary()
    │
    ├─► Fetch last 20 messages
    ├─► Call OpenAI (gpt-4o-mini) to summarize
    └─► Save summary to conversation (async)
```

**Called conditionally**: Only if `messageCount >= 10` and `messageCount % 5 === 0`

**Note**: This runs asynchronously and doesn't block the main request flow.

---

## Data Flow

### Input → Processing → Output

```
1. Request Body
   └─► { content: string, attachments?: any }
       │
       └─► POST() receives it

2. Database Queries
   ├─► User organizations
   ├─► Conversation
   ├─► BusinessBrain (with cards)
   └─► Conversation history (last 10 messages)

3. Intent Analysis
   userMessage → analyzeUserIntent() → intent object
   │
   └─► Used by loadCardsByRelevance()

4. Card Loading
   cards + intent → loadCardsByRelevance() → cardData
   │
   ├─► loadedCards (filtered by relevance)
   └─► cardRelevance (map of scores)

5. System Prompt Building
   businessBrain + loadedCards + contextSummary → buildSystemPrompt() → systemPrompt string

6. OpenAI Call
   messages array → OpenAI API → aiResponse

7. Citation Extraction
   aiResponse + loadedCards → extractCardCitations() → citations[]

8. Confidence Calculation
   citations + cardRelevance → calculateResponseConfidence() → confidence number

9. Database Writes
   ├─► User message (saved early)
   └─► Assistant message + conversation update (in transaction)

10. Response
    All collected data → NextResponse.json()
```

---

## Key Concepts

### Active Cards Management
- **Purpose**: Track which cards are currently "active" in the conversation
- **Mechanism**: 
  - New relevant cards are added
  - Cards decay if not used in recent messages
  - High-relevance cards stay active longer

### Relevance-Based Loading
- **≥80% relevance**: Full card content (description + metadata + priority)
- **40-79% relevance**: Excerpt only (first 500 chars)
- **<40% relevance**: Title only

### Citation System
- Analyzes AI response text to find card references
- Looks for:
  - Direct card name mentions
  - Style pattern matches
  - Forbidden word avoidance (for brand voice cards)

### Confidence Scoring
- Weighted formula considers:
  - Card's own confidence (50%)
  - Relevance score (30%)
  - Citation strength (20%)

---

## Execution Order (Step-by-Step)

1. **Authentication** (lines 54-115)
   - Check token, verify user, validate content

2. **Data Loading** (lines 117-159)
   - Fetch conversation and businessBrain in parallel

3. **Intent Analysis** (line 163)
   - `analyzeUserIntent()` - determines what user wants

4. **Card Loading** (line 165)
   - `loadCardsByRelevance()` - loads cards based on intent

5. **Active Cards** (lines 167-185)
   - Merge new relevant cards with existing active cards

6. **Context Summary** (lines 187-208)
   - Conditionally trigger `generateContextSummary()` (async)

7. **History Loading** (lines 211-226)
   - Fetch last 10 messages for context

8. **Prompt Building** (line 229)
   - `buildSystemPrompt()` - creates system prompt

9. **Message Preparation** (lines 241-260)
   - Build messages array for OpenAI

10. **Save User Message** (lines 263-276)
    - Create user message in database

11. **OpenAI Call** (lines 285-309)
    - Generate AI response

12. **Citation Extraction** (line 312)
    - `extractCardCitations()` - find which cards were used

13. **Confidence Calculation** (line 319)
    - `calculateResponseConfidence()` - calculate score

14. **Save Assistant Message** (lines 328-405)
    - Transaction: save message + update conversation

15. **Return Response** (lines 420-438)
    - Return JSON with all data

---

## Dependencies

### External Services
- **OpenAI API**: Used in 3 places
  1. `analyzeUserIntent()` - intent classification (gpt-4o-mini)
  2. Main response generation (gpt-4o)
  3. `generateContextSummary()` - summary generation (gpt-4o-mini)

### Database (Prisma)
- `businessConversation` - conversation state
- `businessMessage` - message history
- `businessBrain` - brain configuration and cards
- `userOrganization` - user permissions

### Internal Functions
- `verifyAccessToken()` - from `@/lib/auth`
- `prisma` - from `@/lib/prisma`

---

## Error Handling

- **Authentication errors**: Return 401
- **Validation errors**: Return 400
- **Not found errors**: Return 404
- **OpenAI errors**: Log and throw (user message still saved)
- **General errors**: Catch-all returns 500

---

## Async Operations

1. **Main flow**: All await operations are sequential
2. **Context summary**: Fire-and-forget (doesn't block response)
3. **Database transaction**: Quick operations only (no OpenAI calls inside)

---

## Key Data Structures

### Intent Object
```typescript
{
  category: "content_generation" | "business_info" | "compliance" | "technical_setup" | "general",
  relevantCards: string[],  // Array of card IDs
  confidence: number,       // 0-100
  reasoning: string
}
```

### CardData Object
```typescript
{
  loadedCards: Array<{
    type: string,
    title: string,
    relevance: number,  // 0-100
    content: string     // Varies by relevance
  }>,
  cardRelevance: Record<string, number>  // cardId → relevance score
}
```

### CardCitation Object
```typescript
{
  cardId: string,
  cardType: string,
  excerpts: string[],  // Context snippets from response
  confidence: number   // Citation strength 0-100
}
```

