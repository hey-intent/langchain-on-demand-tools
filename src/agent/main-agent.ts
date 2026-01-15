import { ChatOpenAI } from '@langchain/openai';
import { createAgent, ReactAgent } from 'langchain';
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { Logger } from 'pino';
import { createChildLogger } from '../logger.js';
import { appConfig } from '../appConfig.js';

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to various skills.
Use the tools available to you to help answer questions and complete tasks.
Always be helpful, accurate, and funny in your responses.`;

export class MainAgent {
  private agent!: ReactAgent;
  private model!: ChatOpenAI;

  private logger: Logger;
  private chatHistory: BaseMessage[] = [];
  private tools: DynamicStructuredTool[] = [];

  constructor() {
    this.logger = createChildLogger('main-agent');
  }

  public buildExecutor(newTools?: DynamicStructuredTool[]): void {
    if (newTools?.length) {
      const newToolsName = newTools.map((tool) => tool.name);
      const existingToolsName = this.tools.map((tool) => tool.name);
      const duplicateToolsName = newToolsName.filter((name) => existingToolsName.includes(name));
      // we should deduplicate tools
      this.tools = [
        ...this.tools,
        ...newTools.filter((tool) => !duplicateToolsName.includes(tool.name)),
      ];
    }
    this.agent = createAgent({
      model: this.getModel(),
      tools: this.tools,
    });
  }

  private getModel(): ChatOpenAI {
    if (!this.model) {
      this.model = new ChatOpenAI({
        model: appConfig.chatModel,
        temperature: 0.7,
        configuration: { 
          apiKey: appConfig.apiKey,
          baseURL: appConfig.baseURL,
          defaultHeaders: appConfig.defaultHeaders,
        },
      });
    }
    return this.model;
  }

  initialize(): void {
    // Init with empty tools
    this.tools = [];
    this.buildExecutor([]);

    this.logger.info(
      {
        mainModel: appConfig.chatModel,
        skills: [],
      },
      'Agent initialized'
    );
  }

  async run(input: string): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    // Build messages array with proper LangChain message instances
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      ...this.chatHistory,
      new HumanMessage(input),
    ];

    // Execute the main agent
    const result = await this.agent.invoke({
      messages,
    });

    // Extract output from result - createAgent returns AgentState with messages array
    // The last message should be the AI's response
    const resultMessages = result.messages || [];
    const lastMessage = resultMessages[resultMessages.length - 1];

    let output = '';
    if (lastMessage instanceof AIMessage) {
      const content = lastMessage.content;
      if (typeof content === 'string') {
        output = content;
      } else if (Array.isArray(content)) {
        // Extract text from content blocks
        output = content
          .map((block) => {
            if (typeof block === 'string') return block;
            if (
              block &&
              typeof block === 'object' &&
              'text' in block &&
              typeof block.text === 'string'
            ) {
              return block.text;
            }
            return '';
          })
          .join('');
      }
    } else if (lastMessage && 'content' in lastMessage) {
      const content = lastMessage.content;
      if (typeof content === 'string') {
        output = content;
      }
    }

    // Update chat history
    this.chatHistory.push(new HumanMessage(input));
    this.chatHistory.push(new AIMessage(output));

    return output;
  }

  clearHistory(): void {
    this.chatHistory = [];
    this.logger.debug('Chat history cleared');
  }
}
