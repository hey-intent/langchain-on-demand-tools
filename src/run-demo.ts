import { intro, spinner, outro, log } from '@clack/prompts';
import color from 'picocolors';

import { configureLogger } from './logger.js';

import { Orchestrator } from './orchestrator/orchestrator.js';
import { appConfig } from './appConfig.js';

// Disable pino logs for clean output
configureLogger({ level: 'error' });

async function testConversation() {
  if (!appConfig.apiKey || !appConfig.chatModel) throw new Error('OPENROUTER  not defined ');

  intro(color.bgCyan(color.black(' Test Conversation ')));

  const s = spinner();
  s.start('Initializing agent...');

  const orchestrator = new Orchestrator();
  await orchestrator.initialize();

  s.stop('Orchestrator ready!');

  const messages = [
    "I'm wondering where I could go for a walk today, I live in New York...",
    'Will the weather be nice this afternoon?',
    'How much does the bus cost to get there?',
    'Hmm I only have $10 left but I owe $3.50 to Marcel & $2.10 to Jacques... Will I have enough for a round-trip bus and a coffee?',
  ];

  for (const message of messages) {
    log.step(color.green('User: ') + message);

    const responseSpinner = spinner();
    responseSpinner.start('Thinking...');

    try {
      const response = await orchestrator.run(message);
      responseSpinner.stop('Done');

      const loadedSkills = orchestrator.getLoadedSkills();
      const skillsInfo = loadedSkills.length > 0 ? color.dim(`[${loadedSkills.join(', ')}]`) : '';

      log.message(color.blue('Agent: ') + response);
      if (skillsInfo) log.info(skillsInfo);
    } catch (error) {
      responseSpinner.stop('Error');
      const msg = error instanceof Error ? error.message : String(error);
      log.error(msg);
    }
  }

  log.success(`Skills used: ${orchestrator.getLoadedSkills().join(', ')}`);

  outro(color.cyan('Test completed!'));
}

testConversation().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  process.exit(1);
});
