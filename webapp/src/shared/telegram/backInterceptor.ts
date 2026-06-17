/**
 * Стек перехватчиков нативной кнопки «Назад» Telegram.
 *
 * Полноэкранные оверлеи (редактор кропа, лайтбокс) рендерятся через portal в body и НЕ являются
 * отдельным маршрутом роутера. Без перехвата нажатие «Назад» уводило бы со страницы (BackButtonBridge
 * навигирует к родителю), выкидывая из редактирования вместо закрытия оверлея.
 *
 * Оверлей на время жизни регистрирует свой обработчик закрытия (pushBackInterceptor), а BackButtonBridge
 * перед навигацией спрашивает consumeBackInterceptor(): если сверху стека есть обработчик — вызывает его
 * и навигацию не делает. Стек (а не одиночный колбэк) корректно обрабатывает вложенность оверлеев.
 */
type BackHandler = () => void;

const stack: BackHandler[] = [];

/** Регистрирует обработчик «Назад» (верх стека). Возвращает функцию снятия — вызывать при размонтировании. */
export function pushBackInterceptor(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i !== -1) stack.splice(i, 1);
  };
}

/**
 * Если есть активный перехватчик — вызывает верхний и возвращает true (нажатие «съедено»).
 * Иначе false — вызывающий (BackButtonBridge) делает обычную навигацию.
 */
export function consumeBackInterceptor(): boolean {
  const handler = stack[stack.length - 1];
  if (!handler) return false;
  handler();
  return true;
}
