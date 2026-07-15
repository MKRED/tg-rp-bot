import { getChatTokenStats } from "../../db/chats/index.js";
import { countVariantsForChat } from "../../db/impersonations/index.js";
import logger from "../../logger.js";
import { countTokens } from "../../utils/index.js";
import { buildMessages, DEFAULT_RP_PROMPT_ORDER } from "../prompt/promptBuilder.js";
import { loadChatContext } from "./messages.handlers.js";
import type { Ctx } from "./chats.types.js";

/**
 * GET /:id/stats — статистика чата для экрана настроек:
 *   tokensTotal        — токены сообщений во всех ветках дерева,
 *   tokensActiveBranch — токены сообщений активной ветки,
 *   tokensPrompt       — полный запрос к LLM по активной ветке (система + персонаж + персона +
 *                        aux + история + post-history), ровно как его собирает buildMessages,
 *   contextLimit       — лимит контекста из пресета (null = безграничный/не задан),
 *   impersonationCount — число сохранённых вариантов реплик игрока.
 */
export async function handleChatStats(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  try {
    const ctx = await loadChatContext(userId, chatId);
    if (!ctx) return c.json({ error: "Chat not found" }, 404);
    const { chat, character, persona, template, preset } = ctx;

    // Полный контекст запроса к модели по активной ветке. userMessage пуст: считаем текущий
    // объём, без ещё не введённой реплики игрока. Промпты/порядок — из RP-шаблона, лимиты
    // контекста — из пресета (как в генерации, см. buildCompletionInput в messages.handlers.ts).
    // trim:false — намеренно НЕ урезаем: бар должен показать «желаемый» объём, чтобы пользователь
    // видел переполнение окна (used > limit → красный), хотя сама генерация историю урежет.
    const promptMessages = buildMessages(
      {
        systemPrompt: template?.systemPrompt ?? "",
        auxiliarySystemPrompt: template?.auxiliarySystemPrompt ?? "",
        postHistoryInstruction: template?.postHistoryInstruction ?? "",
        promptOrder: template?.promptOrder ?? DEFAULT_RP_PROMPT_ORDER,
        contextUnlimited: preset?.contextUnlimited,
        contextSize: preset?.contextSize,
        maxTokens: preset?.maxTokens,
        character: { name: character.name, prompt: character.prompt, scenario: character.scenario },
        persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
        history: chat.messages,
        userMessage: "",
      },
      { trim: false },
    );
    // Только токены контента (без PER_MESSAGE_OVERHEAD, который resolveHistory добавляет в бюджет
    // обрезки): бар показывает «вес» текста, а ~4 токена/сообщение служебной разметки — внутренняя
    // деталь учёта бюджета, не показываемая пользователю.
    const tokensPrompt = promptMessages.reduce((sum, m) => sum + countTokens(m.content), 0);

    // Лимит контекста для полосы загрузки на экране настроек. Безграничный контекст или незаданный
    // размер → null (полоса покажет «∞»). В генерации этот лимит теперь РЕАЛЬНО урезает историю
    // (resolveHistory в promptBuilder); здесь показываем сам размер окна как знаменатель полосы.
    const contextLimit = preset?.contextUnlimited ? null : (preset?.contextSize ?? null);

    // getChatTokenStats независимо считает активный путь (через queryActivePathIds) — это второй
    // проход по тому же пути, что уже построил loadChatContext. Осознанное упрощение: экран настроек
    // не на горячем пути, а DAO остаётся самодостаточным (total по всем веткам ему нужен в любом случае).
    const [tokens, impersonationCount] = await Promise.all([
      getChatTokenStats(userId, chatId),
      countVariantsForChat(chatId),
    ]);

    return c.json({ stats: { ...tokens, tokensPrompt, contextLimit, impersonationCount } });
  } catch (err) {
    logger.error({ err, userId, chatId }, "Failed to compute chat stats");
    return c.json({ error: "Internal error" }, 500);
  }
}
