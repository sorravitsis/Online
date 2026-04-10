type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: LogLevel, message: string, payload?: LogPayload) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...payload
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    emit("info", message, payload);
  },
  warn(message: string, payload?: LogPayload) {
    emit("warn", message, payload);
  },
  error(message: string, payload?: LogPayload) {
    emit("error", message, payload);
  }
};
