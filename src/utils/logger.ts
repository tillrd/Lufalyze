/**
 * Conditional logging utility for development vs production
 * In production builds, these calls will be tree-shaken out by the bundler
 */

const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

// Create logger functions that are conditionally enabled
export const logger = {
  /**
   * Development-only logging - will be removed in production builds
   */
  debug: isDevelopment ? console.log.bind(console) : (() => {}),
  
  /**
   * Info logging - will be removed in production builds
   */
  info: isDevelopment ? console.info.bind(console) : (() => {}),
  
  /**
   * Warning logging - always enabled as warnings are important in production
   */
  warn: console.warn.bind(console),
  
  /**
   * Error logging - always enabled as errors need to be tracked in production
   */
  error: console.error.bind(console),
  
  /**
   * Group logging for development debugging
   */
  group: isDevelopment ? console.group.bind(console) : (() => {}),
  groupEnd: isDevelopment ? console.groupEnd.bind(console) : (() => {}),
  
  /**
   * Table logging for development debugging
   */
  table: isDevelopment ? console.table?.bind(console) || console.log.bind(console) : (() => {})
};

/**
 * Helper function to log with emoji prefixes for better readability in development
 */
export const createLogger = (prefix: string) => ({
  debug: (message: string, ...args: any[]) => logger.debug(`${prefix} ${message}`, ...args),
  info: (message: string, ...args: any[]) => logger.info(`${prefix} ${message}`, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(`${prefix} ${message}`, ...args),
  error: (message: string, ...args: any[]) => logger.error(`${prefix} ${message}`, ...args),
}); 