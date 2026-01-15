import { z } from 'zod';
import { BaseSkill, SkillMetadata } from './types.js';
import { DynamicStructuredTool } from '@langchain/core/tools';

// Mock search results for demonstration
const mockSearchResults: Record<string, Array<{ title: string; url: string; snippet: string }>> = {
  typescript: [
    {
      title: 'TypeScript: JavaScript With Syntax For Types',
      url: 'https://www.typescriptlang.org/',
      snippet: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
    },
    {
      title: 'TypeScript Documentation',
      url: 'https://www.typescriptlang.org/docs/',
      snippet: 'Get started with TypeScript, explore the handbook, and learn about advanced types.',
    },
  ],
  langchain: [
    {
      title: 'LangChain - Build context-aware reasoning applications',
      url: 'https://www.langchain.com/',
      snippet: 'LangChain is a framework for developing applications powered by language models.',
    },
    {
      title: 'LangChain.js Documentation',
      url: 'https://js.langchain.com/docs/',
      snippet: 'Build powerful AI applications with JavaScript and TypeScript using LangChain.',
    },
  ],
  default: [
    {
      title: 'Search Result 1',
      url: 'https://example.com/1',
      snippet: 'This is a placeholder search result for demonstration purposes.',
    },
    {
      title: 'Search Result 2',
      url: 'https://example.com/2',
      snippet: 'Another placeholder result showing the search functionality.',
    },
  ],
};

/**
 * Web Search Skill - Provides web search capabilities
 */
export class WebSearchSkill extends BaseSkill {
  metadata: SkillMetadata = {
    name: 'web-search',
    description: 'Search the web for information, articles, and documentation',
    version: '1.0.0',
    tags: ['search', 'web', 'research'],
  };

  tools: DynamicStructuredTool[] = [
    this.createTool({
      name: 'web_search',
      description: 'Search the web for information on any topic',
      schema: z.object({
        query: z.string().describe('The search query'),
        maxResults: z
          .number()
          .min(1)
          .max(10)
          .nullable()
          .default(5)
          .describe('Maximum number of results to return'),
      }),
      func: async ({ query, maxResults }) => {
        // Find matching mock results or use default
        const lowerQuery = query.toLowerCase();
        let results = mockSearchResults['default'];

        for (const [key, value] of Object.entries(mockSearchResults)) {
          if (lowerQuery.includes(key)) {
            results = value;
            break;
          }
        }

        const limitedResults = results.slice(0, maxResults ?? 5);

        return Promise.resolve(
          JSON.stringify(
            {
              query: query,
              results: limitedResults,
              totalResults: limitedResults.length,
              note: 'Demo data - connect to real search API for production',
            },
            null,
            2
          )
        );
      },
    }),

    this.createTool({
      name: 'fetch_url',
      description: 'Fetch and extract text content from a URL',
      schema: z.object({
        url: z.string().url().describe('The URL to fetch content from'),
      }),
      func: async ({ url }) => {
        // Mock URL fetching
        return Promise.resolve(
          JSON.stringify(
            {
              url: url,
              status: 'success',
              content: `This is simulated content from ${url}. In production, this would fetch and parse the actual webpage content.`,
              note: 'Demo data - implement real URL fetching for production',
            },
            null,
            2
          )
        );
      },
    }),
  ];
}
