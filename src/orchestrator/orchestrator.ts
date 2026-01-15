import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  ToolAgent,
  MainAgent,
  Logger,
  ToolAgentResult,
  createChildLogger,
} from './../agent/index.js';
import { DateTimeSkill, CalculatorSkill, WeatherSkill, WebSearchSkill } from './../skills/index.js';
import { SkillsRegistry } from '../skills/registry.js';

export class Orchestrator {
  private toolAgent?: ToolAgent;
  private chatAgent?: MainAgent;
  private tools: DynamicStructuredTool[] = [];
  private logger!: Logger;

  private registry: SkillsRegistry;

  constructor() {
    this.registry = new SkillsRegistry();
    this.logger = createChildLogger('orchestrator');

    this.registry.registerAll([
      new CalculatorSkill(),
      new WeatherSkill(),
      new WebSearchSkill(),
      new DateTimeSkill(),
    ]);
  }

  async initialize(): Promise<void> {
    // Handle available skills
    await this.registry.initializeAll();
    if (this.registry.getNames().length === 0) {
      throw new Error('No skills registered.');
    }

    // Ignite agents
    this.toolAgent = new ToolAgent(this.registry);
    this.chatAgent = new MainAgent();
    this.chatAgent.initialize();
  }

  async run(input: string): Promise<string> {
    if (!this.toolAgent || !this.chatAgent) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const toolAgentResponse = await this.toolAgent.run(input);
    const needRebuild = this.handleToolsLoading(toolAgentResponse);
    if (needRebuild) {
      this.chatAgent.buildExecutor(this.tools);
    }

    return await this.chatAgent.run(input);
  }

  handleToolsLoading(toolAgentResponse: ToolAgentResult): boolean {
    if (!toolAgentResponse?.skills?.length) {
      this.logger.debug('No skills requested');
      return false;
    }

    this.logger.info({ requestedSkills: toolAgentResponse.skills }, 'Processing skill request');

    let toolsAdded = false;
    for (const skillName of toolAgentResponse.skills) {
      const loaded = this.loadSkillTools(skillName);
      if (loaded) {
        toolsAdded = true;
      }
    }

    if (toolsAdded) {
      this.logger.info({ totalTools: this.tools.length }, 'Tools added, executor rebuild needed');
    }

    return toolsAdded;
  }

  private loadSkillTools(skillName: string): boolean {
    // Delegate to registry - single source of truth for skill loading
    const result = this.registry.loadSkill(skillName);

    if (!result) {
      // Registry returns null if skill not found or already loaded
      return false;
    }

    // Registry returned the tools, add them to our collection
    for (const tool of result.tools) {
      this.tools.push(tool as DynamicStructuredTool);
    }
    const toolNames = (result.tools as DynamicStructuredTool[]).map((t) => t.name);
    this.logger.info({ skillName, toolNames }, 'Tools received from registry');

    return true;
  }

  getLoadedSkills(): string[] {
    return this.registry.getLoadedSkillNames();
  }

  getAvailableSkills(): Array<{ name: string; description: string }> {
    return this.registry.getAllMetadata().map((skill) => ({
      name: skill.name,
      description: skill.description,
    }));
  }

  clearHistory(): void {
    // Clear chat history in MainAgent
    if (this.chatAgent) {
      this.chatAgent.clearHistory();
      // Reset tools and rebuild executor
      this.tools = [];
      this.chatAgent.buildExecutor([]);
      this.registry.resetLoadedSkills();
      this.logger.info('History cleared');
    }
  }
}
