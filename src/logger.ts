import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

export interface LoggerConfig {
  level?: LogLevel;
  pretty?: boolean;
  name?: string;
}

const isDev = process.env.NODE_ENV !== 'production';

function createLogger(config: LoggerConfig = {}): pino.Logger {
  const level = config.level ?? (isDev ? 'debug' : 'info');
  const pretty = config.pretty ?? isDev;

  const options: pino.LoggerOptions = {
    level,
    name: config.name,
  };

  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

// Global application logger
export const logger = createLogger({ name: 'skills-agent' });

// Factory to create child loggers with context
export function createChildLogger(context: string): pino.Logger {
  return logger.child({ context });
}

// Function to reconfigure the global logger
export function configureLogger(config: LoggerConfig): void {
  const newLogger = createLogger({ ...config, name: config.name ?? 'skills-agent' });
  Object.assign(logger, newLogger);
}

export type { Logger } from 'pino';
