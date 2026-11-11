import { ActionIcon } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { useGoBack } from "../../../app/useGoBack";
import { isInsideTelegram } from "../../telegram/initData";
import styles from "./BackNavButton.module.css";

/**
 * Кнопка «Назад» в шапке экрана — только в браузере. В Telegram её роль играет нативная BackButton
 * (BackButtonBridge), обе ведут вверх по иерархии через useGoBack. На корневых экранах (главная,
 * вход) ничего не рисует, поэтому её можно ставить в любую шапку без условий.
 */
interface BackNavButtonProps {
  /** Круглая кнопка поверх контента в левом верхнем углу — для экранов без шапки (граф веток, ошибка). */
  floating?: boolean;
  /** Доп. класс от шапки-владельца (выравнивание под её заголовок). */
  className?: string;
}

export function BackNavButton({ floating, className }: BackNavButtonProps) {
  const { canGoBack, goBack } = useGoBack();
  if (!canGoBack || isInsideTelegram()) return null;
  return (
    <ActionIcon
      variant={floating ? "default" : "subtle"}
      color="gray"
      size="xl"
      radius={floating ? "xl" : undefined}
      onClick={goBack}
      aria-label="Назад"
      className={`${floating ? styles.floating : styles.button} ${className ?? ""}`}
    >
      <ArrowLeft size={22} />
    </ActionIcon>
  );
}
