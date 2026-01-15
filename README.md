# A Clean implementation of Tools lazy loading (pedagogical purpose)

A pedagogical implementation demonstrating **lazy loading of tools** for AI agents. This project shows how to dynamically load and unload tools based on user requests, combining the **Skills pattern** inspired by [Anthropic's Skills](https://github.com/anthropics/skills) with a **Router Agent pattern** using LangChain, orchestrated by a **custom orchestrator implementation**. The core innovation is that tools are loaded on-demand rather than being included in the initial agent context, reducing token overhead and improving scalability.

## What is this?

This project demonstrates how to build a modular AI agent that:

1. **Uses a custom orchestrator** to coordinate tool routing and dynamic loading
2. **Dynamically loads tools** based on user requests (progressive disclosure)
3. **Uses a tool agent** to analyze requests and determine which skills are needed
4. **Rebuilds the executor on-the-fly** when new tools are required

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Custom Orchestrator                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. Tool Agent analyzes request                           │  │
│  │  2. Determines needed skills                              │  │
│  │  3. Loads tools dynamically (custom logic)                │  │
│  │  4. Rebuilds Main Agent executor if needed                │  │
│  │  5. Executes Main Agent with loaded tools                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│      Tool Agent              │  │      Skills Registry         │
│  Analyzes request            │  │  ┌──────────┐ ┌──────────┐   │
│  Return s: { skills, reason }│  │  │Calculator│ │ Weather  │   │
└──────────────────────────────┘  │  │  Skill   │ │  Skill   │   │
                                  │  └──────────┘ └──────────┘   │
                                  │  ┌──────────┐ ┌──────────┐   │
                                  │  │WebSearch │ │ DateTime │   │
                                  │  │  Skill   │ │  Skill   │   │
                                  │  └──────────┘ └──────────┘   │
                                  └──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Main Agent                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Uses LangChain createAgent() with dynamic tools          │  │
│  │  Proper message handling (SystemMessage, HumanMessage)    │  │
│  │  Tool deduplication to prevent duplicates                 │  │
│  │  Returns AI response from messages array                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Demo Conversation

The `test-conversation.ts` (run with `npm run demo`) demonstrates a multi-turn conversation where skills are loaded progressively:

```typescript
const messages = [
  "I'm wondering where I could go for a walk today, I live in New York...",
  'Will the weather be nice this afternoon?',
  'How much does the bus cost to get there?',
  'Hmm I only have $10 left... Will I have enough for a round-trip bus and a coffee?',
];
```

**Expected behavior:**

1. First message: General conversation, no skills loaded or `weather` skill
2. Second message: Tool agent detects weather-related query → loads `weather` skill
3. Third message: General question (mock data)
4. Fourth message: Tool agent detects calculation needed → loads `calculator` skill

## ⚠️ Important Note

**For this example, lazy loading is overkill.** This implementation is primarily for **pedagogical purposes** to demonstrate the pattern.

**In production scenarios**, especially when you have a small to moderate number of tools, **adding tools directly to the agent** is the recommended approach because:

- It's simpler and more straightforward
- It reduces latency (no routing step required)
- It lowers costs (single LLM call instead of two)
- It eliminates routing errors
- The token overhead from tool descriptions is usually negligible

**Lazy loading becomes valuable when:**

- You have **hundreds or thousands** of tools
- Tools have **very large schemas** that significantly impact token usage
- You need to **dynamically load tools** based on user permissions or context
- You're building a **plugin system** where tools are added at runtime

## Trade-offs

### Advantages

| Benefit                      | Description                                                            |
| ---------------------------- | ---------------------------------------------------------------------- |
| **Reduced context overhead** | Only relevant tools are loaded into the main agent's context           |
| **Less noise**               | The main LLM doesn't see irrelevant tool descriptions                  |
| **Modular design**           | Skills are self-contained units with metadata and tools                |
| **Scalability**              | Can support many skills without bloating the initial prompt            |

### Disadvantages

| Drawback            | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| **Higher latency**  | Each request requires a tool agent call before the main agent  |
| **Additional cost** | Two LLM calls per request (tool agent + main agent)            |
| **Routing errors**  | Tool agent might miss relevant skills or load unnecessary ones |

## Tool Lifecycle

Understanding when tools are loaded and unloaded is key to this architecture:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Tool Lifecycle                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. REGISTER        Skills stored in registry, tools dormant             │
│        │            Only metadata available (~100 tokens per skill)      │
│        ▼                                                                 │
│  2. INITIALIZE      skill.initialize() called if defined                 │
│        │            Establish connections, load configs                  │
│        ▼                                                                 │
│  3. LOAD ON DEMAND  Router identifies needed skill                       │
│        │            Tools added to executor                              │
│        │            Executor rebuilt with new tool set                   │
│        ▼                                                                 │
│  4. PERSIST         Loaded skills stay active within session             │
│        │            Tracked in loadedSkills Set                          │
│        ▼                                                                 │
│  5. CLEANUP         clearHistory() or cleanup() called                   │
│                     Resets loadedSkills, tools array emptied             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Points

| Aspect                  | Behavior                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| **Initial state**       | Executor starts with **zero tools** loaded                         |
| **Metadata only**       | Router sees only skill names + descriptions, not full tool schemas |
| **Lazy loading**        | Tools load only when router determines they're needed              |
| **Session persistence** | Once loaded, skills remain active until `clearHistory()`           |
| **Executor rebuild**    | Agent is recreated each time new tools are added                   |
| **Tool deduplication**  | Prevents duplicate tools when rebuilding executor                  |

### BaseSkill Class

Skills extend `BaseSkill` which provides lifecycle hooks and a helper for creating tools:

```typescript
// src/skills/types.ts
export abstract class BaseSkill implements Skill {
  abstract metadata: SkillMetadata;
  abstract tools: DynamicStructuredTool[];

  // Optional lifecycle hooks
  async initialize?(): Promise<void>; // Called once at startup
  async cleanup?(): Promise<void>; // Called on shutdown

  // Helper for creating properly typed tools
  protected createTool<T extends z.ZodObject<z.ZodRawShape>>(config: {
    name: string;
    description: string;
    schema: T;
    func: (input: z.infer<T>) => Promise<string>;
  }): DynamicStructuredTool;
}
```

## Key Features

- **Custom Orchestrator**: A custom orchestrator implementation that coordinates `ToolAgent` and `MainAgent`, manages skill lifecycle, and handles dynamic tool loading
- **Simplified Architecture**: Clean separation with `Orchestrator` coordinating `ToolAgent` and `MainAgent`
- **Proper Message Handling**: Uses LangChain message instances (`SystemMessage`, `HumanMessage`, `AIMessage`) instead of plain objects
- **Tool Deduplication**: Prevents duplicate tools when dynamically loading skills
- **Type Safety**: Full TypeScript with strict type checking
- **Progressive Disclosure**: Skills load on-demand based on user requests
- **Centralized Configuration**: Single `appConfig.ts` for all application settings

## What You Can Learn

This codebase demonstrates several patterns:

### 1. Tool Implementation with LangChain

```typescript
// src/skills/calculator.ts
this.createTool({
  name: 'calculate',
  description: 'Evaluate a mathematical expression',
  schema: z.object({
    expression: z.string().describe('The expression to evaluate'),
  }),
  func: async ({ expression }) => {
    // Tool implementation
  },
});
```

### 2. Agent Creation with LangChain

```typescript
// src/agent/main-agent.ts
import { createAgent } from 'langchain';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

// Create agent with dynamic tools
this.agent = createAgent({
  model: this.getModel(),
  tools: this.tools,
});

// Run with proper message instances
const result = await this.agent.invoke({
  messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(input), ...this.chatHistory],
});

// Extract response from messages array
const output = result.messages[result.messages.length - 1].content;
```

### 3. Tool Agent Pattern (Router)

```typescript
// src/agent/tool-agent.ts
async run(input: string): Promise<ToolAgentResult> {
  // Analyzes input and returns needed skills
  const response = await this.model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: input },
  ]);
  return this.extractResponse(response.content);
}
```

### 4. Dynamic Tool Loading with Deduplication

```typescript
// src/agent/main-agent.ts
public buildExecutor(newTools?: DynamicStructuredTool[]): void {
  if (newTools?.length) {
    // Deduplicate tools by name to prevent duplicates
    const newToolsName = newTools.map((tool) => tool.name);
    const existingToolsName = this.tools.map((tool) => tool.name);
    const duplicateToolsName = newToolsName.filter((name) =>
      existingToolsName.includes(name)
    );

    this.tools = [
      ...this.tools,
      ...newTools.filter((tool) => !duplicateToolsName.includes(tool.name)),
    ];
  }
  // Rebuild agent with updated tools
  this.agent = createAgent({
    model: this.getModel(),
    tools: this.tools,
  });
}
```

### 5. Custom Orchestrator Implementation

```typescript
// src/orchestrator/orchestrator.ts
export class Orchestrator {
  async run(input: string): Promise<string> {
    // 1. Tool agent determines needed skills
    const toolAgentResponse = await this.toolAgent.run(input);

    // 2. Load tools if needed (custom logic)
    const needRebuild = this.handleToolsLoading(toolAgentResponse);
    if (needRebuild) {
      this.chatAgent.buildExecutor(this.tools);
    }

    // 3. Execute main agent
    return await this.chatAgent.run(input);
  }

  // Custom method to handle dynamic tool loading
  handleToolsLoading(toolAgentResponse: ToolAgentResult): boolean {
    // Checks which skills are needed and loads them dynamically
    // Manages skill lifecycle and prevents duplicate tool loading
  }
}
```

## Project Structure

```
src/
├── agent/
│   ├── tool-agent.ts      # Analyzes requests, selects skills
│   ├── main-agent.ts      # Main agent with dynamic tool loading
│   └── index.ts           # Agent exports
├── orchestrator/
│   └── orchestrator.ts    # Orchestrates Tool Agent + Main Agent
├── skills/
│   ├── types.ts           # Skill interface and base class
│   ├── registry.ts        # Skills management
│   ├── calculator.ts      # Math calculations
│   ├── weather.ts         # Weather information (mock)
│   ├── web-search.ts      # Web search (mock)
│   ├── datetime.ts        # Date/time utilities
│   └── index.ts           # Skills exports
├── appConfig.ts           # Application configuration
├── logger.ts              # Pino logger configuration
├── run-agent.ts           # Interactive CLI (commented out)
└── test-conversation.ts   # Demo conversation
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
# Create a .env file with:
# OPENROUTER_API_KEY=your_key_here
# OPENROUTER_MODEL=mistralai/ministral-14b-2512  # or any OpenRouter model
# OPENROUTER_TOOL_MODEL=optional  # defaults to OPENROUTER_MODEL

# Run demo conversation
npm run demo

# Try it with your own words 
npm run agent

# Development commands
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
npm run type-check    # TypeScript type checking
npm run format        # Format code with Prettier
npm run build         # Build TypeScript to JavaScript
```

## Environment Variables

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=mistralai/ministral-14b-2512  # Main chat model
OPENROUTER_TOOL_MODEL=optional  # Tool agent model (defaults to OPENROUTER_MODEL)
```

Configuration is managed through `src/appConfig.ts` which reads from environment variables and provides a centralized config object.

## References

- [Anthropic Skills](https://github.com/anthropics/skills) - Original skills pattern
- [LangChain.js](https://js.langchain.com/) - Agent framework
- [OpenRouter](https://openrouter.ai/) - LLM API gateway
