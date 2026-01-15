import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

/**
 * Schema for skill metadata (similar to SKILL.md frontmatter)
 */
export const SkillMetadataSchema = z.object({
  name: z.string().describe('Unique identifier for the skill (lowercase, hyphens for spaces)'),
  description: z.string().describe('What this skill does and when to use it'),
  version: z.string().nullable().default('1.0.0'),
  author: z.string().nullable(),
  tags: z.array(z.string()).nullable().default([]),
});

/** Skill metadata - only name and description are required */
export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
}

/**
 * A Skill is a self-contained unit that provides:
 * - Metadata (name, description)
 * - One or more tools the agent can use
 */
export interface Skill {
  /** Skill metadata */
  metadata: SkillMetadata;

  /** Tools provided by this skill */
  tools: DynamicStructuredTool[];

  /** Optional initialization logic */
  initialize?(): Promise<void>;

  /** Optional cleanup logic */
  cleanup?(): Promise<void>;
}

/**
 * Base class for creating skills with common functionality
 */
export abstract class BaseSkill implements Skill {
  abstract metadata: SkillMetadata;
  abstract tools: DynamicStructuredTool[];

  async initialize(): Promise<void> {
    // Override in subclasses if needed
  }

  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Helper to create a tool with proper typing
   */
  protected createTool<T extends z.ZodObject<z.ZodRawShape>>(config: {
    name: string;
    description: string;
    schema: T;
    func: (input: z.infer<T>) => Promise<string>;
  }): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: config.name,
      description: config.description,
      schema: config.schema,
      func: config.func,
    });
  }
}

export type AgentConfig = {
  model: string;
  temperature: number;
  maxIterations: number;
};

export type AppConfig = {
  provider: string;
  temperature: number;
  maxIterations: number;
  apiKey: string;
  baseURL: string;
  chatModel: string;
  toolModel: string;
  defaultHeaders: {
    'HTTP-Referer': string;
    'X-Title': string;
  };
};
