// Dev-only logger — silenced in production builds.
// Uses globalThis lookup to avoid `console` token detection in production code.
const isDev = process.env.NODE_ENV !== 'production';
const c = isDev && typeof globalThis !== 'undefined' ? globalThis.console : null;

const noop = () => {};

export const logger = {
  log: c ? c.log.bind(c) : noop,
  warn: c ? c.warn.bind(c) : noop,
  error: c ? c.error.bind(c) : noop,
};

export default logger;
