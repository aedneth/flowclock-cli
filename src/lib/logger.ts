/**
 * Diagnostics go to stderr so stdout stays clean for piping/--json.
 * `quiet` suppresses info; errors always print.
 */
export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function createLogger(opts: { quiet?: boolean } = {}): Logger {
  return {
    info(msg) {
      if (!opts.quiet) process.stderr.write(msg + "\n");
    },
    warn(msg) {
      process.stderr.write(msg + "\n");
    },
    error(msg) {
      process.stderr.write(msg + "\n");
    },
  };
}
