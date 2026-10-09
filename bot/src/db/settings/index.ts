import { DatabaseService } from "../../database/database.service.js";
import { LlmSettingsRepository } from "../../settings/llm/llm-settings.repository.js";

/**
 * ВРЕМЕННЫЙ мост для кода вне Nest DI: llm/resolveProvider.ts (ключ DeepSeek на каждый вызов LLM —
 * из chats, stories, перевода). Тот же репозиторий, что в Nest; удаляется, когда вызов LLM получит
 * его через DI (SettingsModule).
 */
const database = new DatabaseService();
const llmSettings = new LlmSettingsRepository(database);

/** Расшифрованный ключ + модель DeepSeek. null — ключ не задан. */
export const getDecryptedDeepSeekCredentials = (userId: number) => llmSettings.getDecryptedCredentials(userId);
