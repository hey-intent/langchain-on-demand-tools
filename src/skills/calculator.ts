import { z } from 'zod';
import { BaseSkill, SkillMetadata } from './types.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { evaluate } from 'mathjs';

/**
 * Calculator Skill - Provides mathematical calculation capabilities
 */
export class CalculatorSkill extends BaseSkill {
  metadata: SkillMetadata = {
    name: 'calculator',
    description:
      'Performs mathematical calculations including basic arithmetic, percentages, and expressions',
    version: '1.0.0',
    tags: ['math', 'calculation', 'utility'],
  };

  tools: DynamicStructuredTool[] = [
    this.createTool({
      name: 'calculate',
      description:
        'Evaluate a mathematical expression. Supports +, -, *, /, ** (power), parentheses, and common math functions.',
      schema: z.object({
        expression: z
          .string()
          .describe("The mathematical expression to evaluate, e.g., '2 + 2' or '(10 * 5) / 2'"),
      }),
      func: async ({ expression }) => {
        try {
          // Sanitize and evaluate the expression safely
          const sanitized = expression.replace(/[^0-9+\-*/().%\s**]/g, '');
          const withPower = sanitized.replace(/\^/g, '**');

          const result = evaluate(withPower) as number;
          // Use Function constructor for safe evaluation (only math operations)

          if (typeof result !== 'number' || !isFinite(result)) {
            return `Error: Invalid result for expression "${expression}"`;
          }

          return Promise.resolve(`${expression} = ${result}`);
        } catch (error) {
          return `Error evaluating expression: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
        }
      },
    }),

    this.createTool({
      name: 'percentage',
      description: 'Calculate percentage of a number or percentage change between two numbers',
      schema: z.object({
        operation: z
          .enum(['of', 'change'])
          .describe("'of' to calculate X% of Y, 'change' for percentage change from X to Y"),
        value1: z
          .number()
          .describe("First number (percentage for 'of', original value for 'change')"),
        value2: z.number().describe("Second number (base number for 'of', new value for 'change')"),
      }),
      func: async ({ operation, value1, value2 }) => {
        if (operation === 'of') {
          const result = (value1 / 100) * value2;
          return `${value1}% of ${value2} = ${result}`;
        } else {
          const change = ((value2 - value1) / value1) * 100;
          return Promise.resolve(
            `Percentage change from ${value1} to ${value2} = ${change.toFixed(2)}%`
          );
        }
      },
    }),
  ];
}
