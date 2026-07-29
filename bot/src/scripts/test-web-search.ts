/**
 * Прототип: DeepSeek function calling + веб-поиск через Tavily.
 *
 * Разведочный скрипт для проверки самого механизма (tool_calls → внешний поиск → финальный
 * ответ) до того, как встраивать это в chatCompletion()/BYOK-поток. Бьёт в DeepSeek и Tavily
 * напрямую по env-ключам (не через resolveProvider — там пока нет tools).
 *
 * Запуск из корня монорепо (нужны DEEPSEEK_API_KEY и TAVILY_API_KEY в bot/.env):
 *   yarn workspace bot run test-web-search "вопрос"
 */
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { config } from "../config.js";
import logger from "../logger.js";

// Импорт logger.js тянет config.js, который грузит .env (process.loadEnvFile) —
// поэтому DEEPSEEK_API_KEY/TAVILY_API_KEY из bot/.env уже доступны здесь.
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// Tavily (как и Telegram) недоступен напрямую из текущей сети — прямой запрос падает
// с голым "403 Forbidden" от awselb ещё до приложения. Переиспользуем тот же локальный
// HTTP-прокси, что и grammY-клиент для Telegram (config.telegramProxyUrl). Глобальный
// Node fetch на dispatcher из npm-пакета undici не заводится (внутри Node — свой,
// несовместимый по версии undici, падает "invalid onRequestStart method"), поэтому
// для Tavily зовём fetch из самого пакета undici вместе с его ProxyAgent.
const tavilyDispatcher = config.telegramProxyUrl ? new ProxyAgent(config.telegramProxyUrl) : undefined;

if (!DEEPSEEK_API_KEY || !TAVILY_API_KEY) {
  logger.error(
    { hasDeepseekKey: !!DEEPSEEK_API_KEY, hasTavilyKey: !!TAVILY_API_KEY },
    "Нужны DEEPSEEK_API_KEY и TAVILY_API_KEY в bot/.env",
  );
  process.exit(1);
}

const MAX_TOOL_ROUNDS = 10;

const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Ищет в интернете свежую информацию по запросу (новости, погода, курсы, факты после даты обучения модели).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос" },
        },
        required: ["query"],
      },
    },
  },
];

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

async function tavilySearch(query: string): Promise<unknown[]> {
  const t0 = Date.now();
  logger.info({ query }, "Tavily search start");
  const res = await undiciFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      max_results: 5,
      include_answer: false,
    }),
    dispatcher: tavilyDispatcher,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { results: { title: string; url: string; content: string }[] };
  const results = data.results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
  logger.info(
    { durationMs: Date.now() - t0, resultsCount: results.length, results },
    "Tavily search done",
  );
  return results;
}

async function deepseekChat(messages: ChatMessage[]): Promise<ChatMessage> {
  const t0 = Date.now();
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { choices: { message: ChatMessage }[] };
  logger.info({ durationMs: Date.now() - t0 }, "DeepSeek chat completion done");
  const message = data.choices[0]?.message;
  if (!message) {
    throw new Error("DeepSeek: пустой choices[] в ответе");
  }
  return message;
}

async function main(): Promise<void> {
  const question = process.argv[2] ?? "Какая сейчас погода в Москве и какие новости за последний час?";
  const messages: ChatMessage[] = [{ role: "user", content: question }];
  logger.info({ question }, "Test web search start");

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await deepseekChat(messages);
    messages.push(reply);

    if (!reply.tool_calls?.length) {
      logger.info({ round }, "Финальный ответ получен");
      console.log(`\n=== Ответ ===\n${reply.content}`);
      return;
    }

    for (const call of reply.tool_calls) {
      const args = JSON.parse(call.function.arguments) as { query: string };
      const results = await tavilySearch(args.query);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(results),
      });
    }
  }

  logger.warn({ maxRounds: MAX_TOOL_ROUNDS }, "Достигнут лимит раундов tool-calling без финального ответа");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Test web search failed");
    process.exit(1);
  });
