/**
 * Имя query-параметра deep-link от web_app-кнопки бота. Согласовано с сервером
 * (bot/src/server/photoToChat.ts) — менять только синхронно.
 */
const DEEP_LINK_PARAM = "dl";
/** Разрешённые внутренние пути (та же защита, что на сервере) — без внешних URL/мусора. */
const DEEP_LINK_RE = /^\/(characters|personas)\/\d+$/;

/**
 * Чистое ядро: из query-строки вычисляет новый (search, hash) для deep-link или null, если
 * параметра нет / путь не из белого списка. Вынесено из resolveDeepLink, чтобы тестировать без DOM.
 */
export function computeDeepLinkRewrite(
  searchStr: string,
): { search: string; hash: string } | null {
  const params = new URLSearchParams(searchStr);
  const raw = params.get(DEEP_LINK_PARAM);
  if (!raw) return null;

  const path = decodeURIComponent(raw);
  if (!DEEP_LINK_RE.test(path)) return null;

  params.delete(DEEP_LINK_PARAM); // dl убираем, остальные query-параметры сохраняем
  return { search: params.toString(), hash: path };
}

/**
 * Резолвит deep-link из web_app-кнопки бота (фото персонажа в чате) ДО старта роутера.
 *
 * web_app-кнопка открывает Mini App по URL вида `…/?dl=%2Fcharacters%2F123`, а Telegram дописывает
 * launch-данные в hash. Если отдать роутеру как есть, HashRouter увидит `#tgWebAppData=…` (не маршрут)
 * и по catch-all уйдёт на главную ДО того, как мы успеем перейти. Поэтому переписываем hash на нужный
 * маршрут заранее: HashRouter стартует уже на нём, catch-all не срабатывает.
 *
 * Вызывать в main.tsx ПОСЛЕ initTelegram() — initData.restore() уже считал launch-данные из hash,
 * так что затирать его безопасно — и ДО render(). Параметр dl убираем из query, чтобы reload не повторял.
 */
export function resolveDeepLink(): void {
  const res = computeDeepLinkRewrite(window.location.search);
  if (!res) return;
  // Одним replaceState: убираем dl из query и ставим маршрут в hash (без новой записи истории).
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (res.search ? `?${res.search}` : "") + `#${res.hash}`,
  );
}
