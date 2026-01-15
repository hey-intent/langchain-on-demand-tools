import type { Logger } from 'pino';
import { SkillsRegistry } from '../skills/registry.js';
import { createChildLogger } from '../logger.js';
import { ChatOpenAI } from '@langchain/openai';
import { appConfig } from '../appConfig.js';
const TOOL_AGENT_SYSTEM_PROMPT = `You are a skill router. Your job is to analyze user requests and determine which skills are needed.

Available skills:
{skills_list}

Respond with a JSON object:
{
  "skills": ["skill1", "skill2"],
  "reasoning": "brief explanation"
}

Rules:
- Return empty array if no skills needed (general conversation)
- Only select skills that are clearly relevant
- Prefer fewer skills when possible
- If unclear, select the most likely skill`;

interface RouterResult {
  skills: string[];
  reasoning: string;
}

export interface ToolAgentConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  logger?: Logger;
}

export interface ToolAgentResult {
  skills: string[];
  reasoning: string;
}

export class ToolAgent {
  private model: ChatOpenAI;
  private registry: SkillsRegistry;
  private logger: Logger;

  constructor(registry: SkillsRegistry) {
    this.registry = registry;
    this.logger = createChildLogger('tool-agent');

    this.model = new ChatOpenAI({
      model: appConfig.toolModel,
      temperature: 0.3,
      configuration: {
        apiKey: appConfig.apiKey,
        baseURL: appConfig.baseURL,
        defaultHeaders: appConfig.defaultHeaders,
      },
    });
  }

  private buildSkillsList(): string {
    const skills = this.registry.getAllMetadata();
    return skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n');
  }

  async run(input: string): Promise<ToolAgentResult> {
    const skillsList = this.buildSkillsList();
    const prompt = TOOL_AGENT_SYSTEM_PROMPT.replace('{skills_list}', skillsList);

    // No chat history needed here; keeping token usage low
    try {
      const response = await this.model.invoke([
        { role: 'system', content: prompt },
        { role: 'user', content: input },
      ]);

      const content = response.content as string;
      return this.extractResponse(content);
    } catch (error) {
      this.logger.error(error, 'Routing error');
      return { skills: [], reasoning: 'Error during routing' };
    }
  }
  private extractResponse(content: string) {
    // Parse JSON (with fallback)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch || !jsonMatch[0]) {
      this.logger.warn('No JSON found, skipping skill loading');
      return { skills: [], reasoning: 'No JSON response' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as RouterResult;
    const skills = parsed.skills || [];
    const reasoning = parsed.reasoning || 'n/a';

    this.logger.info({ skills, reasoning }, 'Route completed');
    return { skills, reasoning };
  }
}
