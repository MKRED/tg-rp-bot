import { DatabaseService } from "../../database/database.service.js";
import { LlmSettingsRepository } from "../../settings/llm/llm-settings.repository.js";
import { TranslateSettingsRepository } from "../../settings/translate/translate-settings.repository.js";

/**
 * ВРЕМЕННЫЙ мост для кода вне Nest DI: llm/resolveProvider.ts (ключ DeepSeek на каждый вызов LLM —
 * из chats, stories, перевода) и legacy-эндпоинт /api/translate. Те же репозитории, что в Nest;
 * удаляется, когда эти вызывающие получат репозитории через DI (SettingsModule).
 */
const database = new DatabaseService();
const llmSettings = new LlmSettingsRepository(database);
const translateSettings = new TranslateSettingsRepository(database);

/** Расшифрованный ключ + модель DeepSeek. null — ключ не задан. */
export const getDecryptedDeepSeekCredentials = (userId: number) => llmSettings.getDecryptedCredentials(userId);

/** Настройки режима перевода PromptEditorOverlay (нет строки → дефолты). */
export const getUserTranslateSettings = (userId: number) => translateSettings.get(userId);
