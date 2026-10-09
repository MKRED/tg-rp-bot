import type { MessageEvent } from "@nestjs/common";
import { Observable } from "rxjs";
import logger from "../logger.js";
import type { SseSink } from "./stream-completion.js";

/**
 * Поток для Nest @Sse из async-функции, пишущей события в SseSink: run стартует при подписке,
 * поток завершается, когда run закончит. run сам ловит и отдаёт ошибки событием error — сюда
 * доходит только непредвиденный сбой (логируем, поток закрываем). Ошибку в Observable не пробрасываем:
 * Nest записал бы её своим форматом, а клиент ждёт { message }.
 *
 * Отписка (клиент ушёл) НЕ прерывает run: генерация доходит до конца и сохраняется, запись в
 * закрытый подписчик — no-op. Так же работала Hono-версия.
 */
export function sseObservable(label: string, run: (sink: SseSink) => Promise<void>): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    const sink: SseSink = {
      writeSSE: ({ event, data }) => {
        subscriber.next({ type: event, data });
        return Promise.resolve();
      },
    };
    run(sink)
      .catch((err: unknown) => logger.error({ err, label }, "SSE stream failed unexpectedly"))
      .finally(() => subscriber.complete());
  });
}
