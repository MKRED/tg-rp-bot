/** Имя LLM-провайдера. */
export type LlmProviderName = "deepseek";

/**
 * Описание провайдера: куда и с каким ключом ходить. Протоколо-специфичное (поля reasoning в теле
 * запроса) живёт в сборщиках тела каждого протокола — chat-completions/request.ts, responses/request.ts.
 */
export interface LlmProvider {
  name: LlmProviderName;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}
