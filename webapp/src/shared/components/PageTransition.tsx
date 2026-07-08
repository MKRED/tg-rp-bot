import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  /**
   * Опциональный дискриминатор «фазы» страницы (напр. "loading" / "ready"). Вешается ключом на
   * внутренний motion.div: при смене фазы он перемонтируется и повторно проигрывает enter-анимацию.
   * Нужен страницам со спиннером — иначе enter «тратится» на спиннер при монтировании маршрута, а
   * пришедший контент оказывается в том же инстансе motion.div (уже в конечном состоянии) и просто
   * проявляется без движения. Без пропа поведение прежнее (единый инстанс).
   */
  phase?: string;
}

/**
 * Обёртка для плавного появления/ухода страницы.
 * AnimatePresence в AnimatedRoutes координирует выход перед монтированием новой страницы.
 */
export function PageTransition({ children, phase }: PageTransitionProps) {
  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
