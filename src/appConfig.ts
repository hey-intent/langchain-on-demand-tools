import dotenv from 'dotenv';
import { AppConfig } from './skills/types.js';
dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY ?? '';
const chatModel = process.env.OPENROUTER_MODEL ?? '';
const toolModel = process.env.OPENROUTER_TOOL_MODEL || chatModel;

export const appConfig: AppConfig = {
  provider: 'openrouter',
  temperature: 0.7,
  maxIterations: 15,
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  chatModel,
  toolModel,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/ts-skills-langchain',
    'X-Title': 'TS Skills Agent',
  },
};
