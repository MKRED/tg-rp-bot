import pino from "pino";
import { config } from "./config.js";

// Набор транспортов: файл с ежедневной ротацией всегда + читаемый вывод.
const targets: pino.TransportTargetOptions[] = [
  {
    target: "pino-roll",
    level: config.logLevel,
    options: {
      file: "logs/bot",
      frequency: "daily",
      dateFormat: "yyyy-MM-dd",
      extension: ".log",
      mkdir: true,
    },
  },
];

// В интерактивном терминале — pino-pretty; иначе сырой JSON в stdout (для прода/докера).
if (process.stdout.isTTY) {
  targets.push({
    target: "pino-pretty",
    level: config.logLevel,
    options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
  });
} else {
  targets.push({ target: "pino/file", level: config.logLevel, options: { destination: 1 } });
}

const logger = pino({ level: config.logLevel }, pino.transport({ targets }));

export default logger;
