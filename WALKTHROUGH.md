# Interactive Walkthrough: Understanding the Flow

This document walks you through a complete request lifecycle with detailed explanations at each step.

---

## Scenario: User Asks About Weather

Let's trace what happens when a user asks:
> "Will the weather be nice this afternoon in New York?"

---

## Step 1: Entry Point

The user runs `npm run demo` which executes `src/run-demo.ts`:

```typescript
// run-demo.ts
const orchestrator = new Orchestrator();
await orchestrator.initialize();

const response = await orchestrator.run(
  "Will the weather be nice this afternoon in New York?"
);
```

**What happens:**
1. Orchestrator constructor creates SkillsRegistry
2. All four skills are registered (Calculator, Weather, WebSearch, DateTime)
3. `initialize()` calls `initializeAll()` on registry
4. ToolAgent and MainAgent are created

---

## Step 2: Orchestrator.run()

```typescript
// orchestrator.ts - run() method
async run(input: string): Promise<string> {
  // At this point:
  // - input = "Will the weather be nice this afternoon in New York?"
  // - this.tools = [] (no tools loaded yet)
  // - loadedSkills = {} (empty set)

  const toolAgentResponse = await this.toolAgent.run(input);
  // Continue to Step 3...
}
```

**State at this point:**
```
Orchestrator State:
+------------------------+
| tools: []              |
| loadedSkills: {}       |
+------------------------+

Registry State:
+------------------------+
| skills: {              |
|   calculator,          |
|   weather,             |
|   web-search,          |
|   datetime             |
| }                      |
| loadedSkills: {}       |
+------------------------+
```

---

## Step 3: ToolAgent Routes the Request

```typescript
// tool-agent.ts
async run(input: string): Promise<ToolAgentResult> {
  // 1. Build the skills list from metadata only
  const skillsList = this.buildSkillsList();
  // Returns:
  // "- **calculator**: Performs mathematical calculations...
  //  - **weather**: Get current weather conditions and forecasts...
  //  - **web-search**: Search the web for information...
  //  - **datetime**: Get current date/time, format dates..."

  // 2. Create the prompt
  const prompt = TOOL_AGENT_SYSTEM_PROMPT.replace('{skills_list}', skillsList);

  // 3. Call the LLM
  const response = await this.model.invoke([
    { role: 'system', content: prompt },
    { role: 'user', content: input },
  ]);
  // LLM thinks: "User is asking about weather... I should select 'weather'"

  // 4. Parse and return
  return this.extractResponse(response.content);
}
```

**LLM Response:**
```json
{
  "skills": ["weather"],
  "reasoning": "User is asking about weather conditions in New York"
}
```

**Token usage (approximate):**
- System prompt: ~150 tokens
- Skills list (metadata only): ~100 tokens
- User input: ~15 tokens
- Response: ~30 tokens
- **Total: ~295 tokens**

---

## Step 4: Handle Tools Loading

Back in Orchestrator:

```typescript
// orchestrator.ts - continuing run()
const toolAgentResponse = await this.toolAgent.run(input);
// toolAgentResponse = { skills: ["weather"], reasoning: "..." }

const needRebuild = this.handleToolsLoading(toolAgentResponse);
// Go to handleToolsLoading...
```

```typescript
// orchestrator.ts - handleToolsLoading()
handleToolsLoading(toolAgentResponse: ToolAgentResult): boolean {
  // toolAgentResponse.skills = ["weather"]

  let toolsAdded = false;
  for (const skillName of toolAgentResponse.skills) {
    // skillName = "weather"
    const loaded = this.loadSkillTools(skillName);
    // Go to loadSkillTools...
  }
  return toolsAdded;
}
```

```typescript
// orchestrator.ts - loadSkillTools()
private loadSkillTools(skillName: string): boolean {
  // skillName = "weather"

  const result = this.registry.loadSkill(skillName);
  // Go to Registry.loadSkill...
}
```

---

## Step 5: Registry Loads the Skill

```typescript
// registry.ts - loadSkill()
loadSkill(name: string): { instructions, tools } | null {
  // name = "weather"

  // 1. Check if skill exists
  const skill = this.skills.get(name);
  // skill = WeatherSkill instance

  // 2. Check if already loaded
  if (this.loadedSkills.has(name)) {
    return null; // Already loaded, skip
  }
  // loadedSkills is empty, so continue

  // 3. Mark as loaded
  this.loadedSkills.add(name);
  // loadedSkills = {"weather"}

  // 4. Return full skill content
  return {
    instructions: skill.instructions,
    // "When providing weather information:
    //  - Always include temperature, conditions, and humidity..."

    tools: skill.tools,
    // [get_weather tool, get_forecast tool]
  };
}
```

**What changed:**
```
Before loadSkill():
+------------------------+
| loadedSkills: {}       |
+------------------------+

After loadSkill():
+------------------------+
| loadedSkills:          |
|   {"weather"}          |
+------------------------+
```

---

## Step 6: Orchestrator Updates Tools

Back in Orchestrator:

```typescript
// orchestrator.ts - loadSkillTools() continuation
private loadSkillTools(skillName: string): boolean {
  const result = this.registry.loadSkill(skillName);
  // result = { instructions: "...", tools: [get_weather, get_forecast] }

  // Add tools to our collection
  this.tools.push(...result.tools);
  // this.tools = [get_weather, get_forecast]

  return true; // Tools were added
}
```

```typescript
// orchestrator.ts - handleToolsLoading() continuation
handleToolsLoading(toolAgentResponse: ToolAgentResult): boolean {
  // ...loop completes with toolsAdded = true
  return true;
}
```

```typescript
// orchestrator.ts - run() continuation
const needRebuild = this.handleToolsLoading(toolAgentResponse);
// needRebuild = true

if (needRebuild) {
  this.chatAgent.buildExecutor(this.tools);
  // Go to MainAgent.buildExecutor...
}
```

---

## Step 7: MainAgent Rebuilds Executor

```typescript
// main-agent.ts - buildExecutor()
public buildExecutor(newTools?: DynamicStructuredTool[]): void {
  // newTools = [get_weather, get_forecast]

  if (newTools?.length) {
    // 1. Get new tool names
    const newToolsName = newTools.map(tool => tool.name);
    // ["get_weather", "get_forecast"]

    // 2. Get existing tool names
    const existingToolsName = this.tools.map(tool => tool.name);
    // [] (empty, first time)

    // 3. Find duplicates
    const duplicateToolsName = newToolsName.filter(
      name => existingToolsName.includes(name)
    );
    // [] (no duplicates)

    // 4. Merge tools (excluding duplicates)
    this.tools = [
      ...this.tools,
      ...newTools.filter(tool => !duplicateToolsName.includes(tool.name)),
    ];
    // this.tools = [get_weather, get_forecast]
  }

  // 5. Create new agent with updated tools
  this.agent = createAgent({
    model: this.getModel(),
    tools: this.tools,
  });
  // Agent now has access to weather tools!
}
```

**State after rebuild:**
```
MainAgent State:
+----------------------------------+
| tools: [                         |
|   get_weather,                   |
|   get_forecast                   |
| ]                                |
| chatHistory: []                  |
| agent: ReactAgent (with tools)   |
+----------------------------------+
```

---

## Step 8: MainAgent Executes

```typescript
// orchestrator.ts - run() continuation
return await this.chatAgent.run(input);
// input = "Will the weather be nice this afternoon in New York?"
```

```typescript
// main-agent.ts - run()
async run(input: string): Promise<string> {
  // 1. Build messages
  const messages: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT),
    // "You are a helpful AI assistant with access to various skills..."

    ...this.chatHistory,
    // [] (empty, first message)

    new HumanMessage(input),
    // "Will the weather be nice this afternoon in New York?"
  ];

  // 2. Execute agent (ReAct pattern)
  const result = await this.agent.invoke({ messages });

  // The agent thinks:
  // "User wants weather in New York. I have get_weather tool. Let me use it."
  //
  // Tool call: get_weather({ location: "New York", units: "fahrenheit" })
  // Tool returns: { temperature: "72F", condition: "Partly Cloudy", humidity: "65%" }
  //
  // Agent formulates response based on tool output
}
```

---

## Step 9: Tool Execution (Inside Agent)

When the ReAct agent decides to use a tool:

```typescript
// weather.ts - get_weather tool execution
func: async ({ location, units }) => {
  // location = "New York"
  // units = "fahrenheit"

  const normalizedLocation = location.toLowerCase();
  // "new york"

  const data = mockWeatherData[normalizedLocation];
  // { temp: 72, condition: 'Partly Cloudy', humidity: 65 }

  return JSON.stringify({
    location: location,
    temperature: "72F",
    condition: "Partly Cloudy",
    humidity: "65%",
    note: "Demo data - connect to real weather API for production",
  });
}
```

---

## Step 10: Response Generation

```typescript
// main-agent.ts - run() continuation
async run(input: string): Promise<string> {
  const result = await this.agent.invoke({ messages });

  // result.messages = [
  //   SystemMessage,
  //   HumanMessage,
  //   AIMessage (tool call),
  //   ToolMessage (tool result),
  //   AIMessage (final response)
  // ]

  // 3. Extract the last message content
  const lastMessage = result.messages[result.messages.length - 1];
  // AIMessage with the final response

  let output = lastMessage.content;
  // "Based on the current weather in New York, it's 72F and partly cloudy.
  //  This afternoon should be pleasant for outdoor activities!"

  // 4. Update chat history
  this.chatHistory.push(new HumanMessage(input));
  this.chatHistory.push(new AIMessage(output));

  // 5. Return response
  return output;
}
```

---

## Step 11: Response Returned to User

```typescript
// orchestrator.ts - run() returns
return await this.chatAgent.run(input);
// "Based on the current weather in New York, it's 72F and partly cloudy.
//  This afternoon should be pleasant for outdoor activities!"
```

```typescript
// run-demo.ts - receives response
const response = await orchestrator.run(message);
log.message(color.blue('Agent: ') + response);
// Output: "Agent: Based on the current weather in New York..."
```

---

## Final State

After this request:

```
Orchestrator State:
+----------------------------------+
| tools: [get_weather, get_forecast]|
+----------------------------------+

Registry State:
+----------------------------------+
| skills: {calculator, weather,    |
|          web-search, datetime}   |
| loadedSkills: {"weather"}        |
+----------------------------------+

MainAgent State:
+----------------------------------+
| tools: [get_weather, get_forecast]|
| chatHistory: [                   |
|   HumanMessage("Will the..."),   |
|   AIMessage("Based on...")       |
| ]                                |
+----------------------------------+
```

---

## What Happens on the Next Request?

If the user then asks: "What's 15% of 80?"

1. **ToolAgent analyzes** and returns `{ skills: ["calculator"] }`
2. **Registry loads** calculator skill (weather stays loaded)
3. **MainAgent rebuilds** with [get_weather, get_forecast, calculate, percentage]
4. **Execution** uses the calculate tool
5. **Response**: "15% of 80 = 12"

The weather tools remain available in case needed again!

---

## Key Takeaways

1. **Two-phase process**: Route first (lightweight), then execute (with tools)
2. **Progressive disclosure**: Only load what's needed
3. **Session persistence**: Tools accumulate during conversation
4. **Deduplication**: Prevents duplicate tools when rebuilding
5. **Token efficiency**: Router only sees ~100 tokens per skill
