import { intro, text, spinner, outro, note, log } from '@clack/prompts';
import color from 'picocolors';

import { configureLogger } from './logger.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import { appConfig } from './appConfig.js';

// Disable pino logs in CLI mode
configureLogger({ level: 'silent' });

async function main(): Promise<void> {
  console.clear();

  intro(color.bgCyan(color.black(' Skills Agent ')));

  if (!appConfig.apiKey || !appConfig.chatModel) {
    log.error('OPENROUTER_API_KEY and OPENROUTER_MODEL must be set in environment variables');
    process.exit(1);
  }

  const model = appConfig.chatModel ?? 'default';

  note(
    [
      `${color.dim('Provider:')} ${appConfig.provider}`,
      `${color.dim('Model:')}    ${model}`,
      `${color.dim('Mode:')}     Progressive Disclosure`,
    ].join('\n'),
    'Configuration'
  );

  const s = spinner();
  s.start('Initializing agent...');

  const orchestrator = new Orchestrator();
  await orchestrator.initialize();

  s.stop('Orchestrator ready!');

  // Get available skills
  const availableSkills = orchestrator.getAvailableSkills();
  const skillsList = availableSkills
    .map((sk) => `  ${color.cyan('•')} ${sk.name} - ${color.dim(sk.description)}`)
    .join('\n');

  note(skillsList, 'Available Skills');

  log.info(
    `${color.dim('Commands:')} ${color.yellow('/quit')} ${color.yellow('/skills')} ${color.yellow('/clear')}`
  );

  while (true) {
    const input = await text({
      message: 'You:',
      placeholder: 'Ask me anything...',
    });

    if (typeof input !== 'string' || input === '/quit' || input === 'quit' || input === 'exit') {
      outro(color.cyan('Bye!'));
      break;
    }

    const trimmed = input.trim().toLowerCase();

    if (!trimmed) continue;

    if (trimmed === '/skills' || trimmed === 'skills') {
      const loaded = orchestrator.getLoadedSkills();
      if (loaded.length === 0) {
        log.info('No skills loaded yet');
      } else {
        log.info(`Loaded: ${color.cyan(loaded.join(', '))}`);
      }
      continue;
    }

    if (trimmed === '/clear' || trimmed === 'clear') {
      orchestrator.clearHistory();
      log.success('History cleared');
      continue;
    }

    const responseSpinner = spinner();
    responseSpinner.start('Thinking...');

    try {
      const response = await orchestrator.run(input);
      responseSpinner.stop('Done');

      const loadedSkills = orchestrator.getLoadedSkills();
      const skillsInfo = loadedSkills.length > 0 ? color.dim(` [${loadedSkills.join(', ')}]`) : '';

      log.message(response + skillsInfo);
    } catch (error) {
      responseSpinner.stop('Error');
      const message = error instanceof Error ? error.message : String(error);
      log.error(message);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  process.exit(1);
});
