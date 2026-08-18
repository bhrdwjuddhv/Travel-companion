import { LOG } from '../constants.js';

const ms = (start) => `${Math.round(Number(process.hrtime.bigint() - start) / 1e6)}ms`;

/**
 * One-line tagged tracing, gated by LOG.verbose so production stays quiet.
 * Warnings and errors always print — a fallback firing is not a debug detail.
 */
export function logger(tag) {
  const write = (line) => LOG.verbose && console.log(`[${tag}] ${line}`);

  return {
    info: write,

    /** `const t = log.start('transport')` … `t.done()` prints the elapsed time. */
    start(step, detail = '') {
      const began = process.hrtime.bigint();
      write(`▶ ${step}${detail ? ` ${detail}` : ''}`);
      return {
        done: (extra = '') => {
          write(`✓ ${step} (${ms(began)})${extra ? ` ${extra}` : ''}`);
          return began;
        },
        fail: (e) => console.warn(`[${tag}] ✗ ${step} (${ms(began)}) ${e?.message ?? e}`),
      };
    },

    warn: (line) => console.warn(`[${tag}] ! ${line}`),
    error: (line) => console.error(`[${tag}] ✗ ${line}`),
  };
}

export const now = () => process.hrtime.bigint();
export const since = ms;
