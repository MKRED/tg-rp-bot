/**
 * Стек асинхронных гардов ухода с экрана (кнопка «Назад»).
 *
 * В отличие от pushBackInterceptor (оверлеи — синхронно «съедают» клик и сами решают, что
 * делать), гард может ТОЛЬКО заблокировать уход (напр. форма с несохранёнными правками), но не
 * решает, куда навигировать — это остаётся в BackButtonBridge (parentPath/returnTo), чтобы
 * решение о цели ухода жило в одном месте и не дублировалось.
 */
type NavigationGuard = () => Promise<boolean>;

const guards: NavigationGuard[] = [];

/** Регистрирует гард (верх стека). Возвращает функцию снятия — вызывать при размонтировании. */
export function pushNavigationGuard(guard: NavigationGuard): () => void {
  guards.push(guard);
  return () => {
    const i = guards.lastIndexOf(guard);
    if (i !== -1) guards.splice(i, 1);
  };
}

/** Спрашивает верхний гард (если есть). Нет гардов — уходить можно (true). */
export function checkNavigationGuards(): Promise<boolean> {
  const guard = guards[guards.length - 1];
  if (!guard) return Promise.resolve(true);
  return guard();
}
