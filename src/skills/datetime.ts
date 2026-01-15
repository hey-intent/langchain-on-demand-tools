import { z } from 'zod';
import { BaseSkill, SkillMetadata } from './types.js';
import { DynamicStructuredTool } from '@langchain/core/tools';

/**
 * DateTime Skill - Provides date and time utilities
 */
export class DateTimeSkill extends BaseSkill {
  metadata: SkillMetadata = {
    name: 'datetime',
    description: 'Get current date/time, format dates, and calculate date differences',
    version: '1.0.0',
    tags: ['date', 'time', 'utility'],
  };

  tools: DynamicStructuredTool[] = [
    this.createTool({
      name: 'get_current_time',
      description: 'Get the current date and time',
      schema: z.object({}),
      func: async () => {
        return Promise.resolve(`Current time (UTC): ${new Date().toISOString()}`);
      },
    }),

    this.createTool({
      name: 'format_date',
      description: 'Format a date string into a different format',
      schema: z.object({
        date: z
          .string()
          .describe("Date to format (ISO string or natural language like '2024-01-15')"),
        format: z
          .enum(['short', 'long', 'iso', 'relative'])
          .describe(
            'Output format: short (1/15/24), long (January 15, 2024), iso (2024-01-15T00:00:00.000Z), relative (3 days ago)'
          ),
      }),
      func: async ({ date, format }) => {
        const parsed = new Date(date);

        if (isNaN(parsed.getTime())) {
          return `Error: Could not parse date "${date}"`;
        }

        let result: string | undefined;
        switch (format) {
          case 'short':
            result = parsed.toLocaleDateString('en-US');
            break;
          case 'long':
            result = parsed.toLocaleDateString('en-US', { dateStyle: 'long' });
            break;
          case 'iso':
            result = parsed.toISOString();
            break;
          case 'relative': {
            const diff = Date.now() - parsed.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return 'today';
            if (days === 1) return 'yesterday';
            if (days > 0) return `${days} days ago`;
            result = `in ${Math.abs(days)} days`;
            break;
          }
        }
        return Promise.resolve(result);
      },
    }),

    this.createTool({
      name: 'date_diff',
      description: 'Calculate the difference between two dates',
      schema: z.object({
        date1: z.string().describe('First date'),
        date2: z.string().describe('Second date'),
        unit: z
          .enum(['days', 'weeks', 'months', 'years'])
          .nullable()
          .default('days')
          .describe('Unit for the difference'),
      }),
      func: async ({ date1, date2, unit }) => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);

        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
          return 'Error: Could not parse one or both dates';
        }

        const diffMs = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        let result: number | undefined;
        switch (unit) {
          case 'days':
            result = diffDays;
            break;
          case 'weeks':
            result = diffDays / 7;
            break;
          case 'months':
            result = diffDays / 30.44;
            break;
          case 'years':
            result = diffDays / 365.25;
            break;
        }

        return Promise.resolve(`Difference: ${result?.toFixed(2) ?? '0.00'} ${unit}`);
      },
    }),
  ];
}
