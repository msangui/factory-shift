/** Minimal structured logger. Stays quiet under `LOG_SILENT=1` (tests). */
type Level = "debug" | "info" | "warn" | "error";

const silent = process.env.LOG_SILENT === "1";

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (silent) return;
  const line = { t: new Date().toISOString(), level, msg, ...meta };
  const stream = level === "error" || level === "warn" ? console.error : console.log;
  stream(JSON.stringify(line));
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
