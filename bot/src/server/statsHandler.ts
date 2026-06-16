import type { Context } from "hono";
import { getChatTokenStats } from "../db/chats/index.js";
import { countVariantsForChat } from "../db/impersonations.js";
import { countTokens } from "../utils/index.js";
import type { AppVariables } from "./initData.js";
import { loadChatContext } from "./messageHandlers.js";
import { buildMessages, makeDefaultPreset } from "./promptBuilder.js";

type Ctx = Context<{ Variables: AppVariables }>;

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

  const ctx = await loadChatContext(userId, chatId);
  if (!ctx) return c.json({ error: "Chat not found" }, 404);
  const { chat, character, persona, preset } = ctx;

  const effectivePreset = preset ?? makeDefaultPreset(userId);

  // Полный контекст запроса к модели по активной ветке. userMessage пуст: считаем текущий
  // объём, без ещё не введённой реплики игрока. Учитываем promptOrder пресета (как в генерации).
  // trim:false — намеренно НЕ урезаем: бар должен показать «желаемый» объём, чтобы пользователь
  // видел переполнение окна (used > limit → красный), хотя сама генерация историю урежет.
  const promptMessages = buildMessages(
    {
      preset: effectivePreset,
      character: { name: character.name, prompt: character.prompt },
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
  const contextLimit = effectivePreset.contextUnlimited ? null : effectivePreset.contextSize;

  // getChatTokenStats независимо считает активный путь (через queryActivePathIds) — это второй
  // проход по тому же пути, что уже построил loadChatContext. Осознанное упрощение: экран настроек
  // не на горячем пути, а DAO остаётся самодостаточным (total по всем веткам ему нужен в любом случае).
  const [tokens, impersonationCount] = await Promise.all([
    getChatTokenStats(userId, chatId),
    countVariantsForChat(chatId),
  ]);

  return c.json({ stats: { ...tokens, tokensPrompt, contextLimit, impersonationCount } });
}
