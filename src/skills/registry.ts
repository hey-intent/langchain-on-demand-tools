import type { Logger } from 'pino';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { Skill, SkillMetadata } from './types.js';
import { createChildLogger } from '../logger.js';

/**
 * SkillsRegistry manages the loading and access of skills
 * Supports progressive disclosure - metadata first, full load on demand
 */
export class SkillsRegistry {
  private skills: Map<string, Skill> = new Map();
  private initialized: Set<string> = new Set();
  private loadedSkills: Set<string> = new Set();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createChildLogger('registry');
  }

  /**
   * Register a skill with the registry
   */
  register(skill: Skill): void {
    const { name } = skill.metadata;

    if (this.skills.has(name)) {
      this.logger.warn({ skillName: name }, 'Skill already registered, overwriting');
    }

    this.skills.set(name, skill);
    this.logger.debug({ skillName: name }, 'Skill registered');
  }

  /**
   * Register multiple skills at once
   */
  registerAll(skills: Skill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get skill names
   */
  getNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get metadata for all skills (lightweight, ~100 tokens per skill)
   * Used for progressive disclosure - only metadata loads initially
   */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }

  /**
   * Load a skill fully - returns tools, marks as loaded
   * Called when the orchestrator determines a skill is relevant
   */
  loadSkill(name: string): { tools: DynamicStructuredTool[] } | null {
    const skill = this.skills.get(name);
    if (!skill) {
      this.logger.warn({ skillName: name }, 'Skill not found in registry');
      return null;
    }

    if (this.loadedSkills.has(name)) {
      this.logger.debug({ skillName: name }, 'Skill already loaded, skipping');
      return null;
    }

    this.loadedSkills.add(name);
    const toolNames = skill.tools.map((t) => t.name);
    this.logger.info({ skillName: name, toolNames }, 'Skill loaded from registry');

    return {
      tools: skill.tools,
    };
  }

  /**
   * Check if a skill has been loaded
   */
  isSkillLoaded(name: string): boolean {
    return this.loadedSkills.has(name);
  }

  /**
   * Get names of loaded skills
   */
  getLoadedSkillNames(): string[] {
    return Array.from(this.loadedSkills);
  }

  /**
   * Initialize a specific skill
   */
  async initializeSkill(name: string): Promise<void> {
    const skill = this.skills.get(name);

    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    if (this.initialized.has(name)) {
      return;
    }

    if (skill.initialize) {
      await skill.initialize();
    }

    this.initialized.add(name);
    this.logger.debug({ skillName: name }, 'Skill initialized');
  }

  /**
   * Initialize all registered skills
   */
  async initializeAll(): Promise<void> {
    for (const name of this.skills.keys()) {
      await this.initializeSkill(name);
    }
    this.logger.info({ count: this.skills.size }, 'All skills initialized');
  }

  /**
   * Reset loaded skills (without cleanup)
   */
  resetLoadedSkills(): void {
    this.loadedSkills.clear();
  }
}

// Singleton instance for convenience
export const globalRegistry = new SkillsRegistry();
