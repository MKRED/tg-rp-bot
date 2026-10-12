import { Button, Loader, Stack, Text } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { RpText } from "../../../../shared/components/RpText";
import { ResponsiveSheet } from "../../../../shared/components/ResponsiveSheet";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import { useImpersonate } from "../../hooks/useImpersonate";
import { ImpersonateVariantCard } from "./ImpersonateVariantCard";
import styles from "./ImpersonateSheet.module.css";

interface ImpersonateSheetProps {
  opened: boolean;
  chatId: number;
  /** Язык перевода из настроек чата (кнопка перевода на вариантах). */
  targetLang: string;
  onPick: (text: string) => void;
  onClose: () => void;
}

/** Шторка вариантов реплики от вашего лица. Содержимое монтируется при открытии — тогда и грузятся варианты. */
export function ImpersonateSheet({ opened, chatId, targetLang, onPick, onClose }: ImpersonateSheetProps) {
  return (
    <ResponsiveSheet opened={opened} onClose={onClose} title="Ответ от вашего лица">
      <ImpersonateBody chatId={chatId} targetLang={targetLang} onPick={onPick} />
    </ResponsiveSheet>
  );
}

function ImpersonateBody({ chatId, targetLang, onPick }: Pick<ImpersonateSheetProps, "chatId" | "targetLang" | "onPick">) {
  const { variants, loading, generating, streamingText, load, generate, remove } = useImpersonate(chatId);
  const endRef = useRef<HTMLDivElement>(null);
  // Первый автоскролл (после загрузки) — мгновенный: шторка не «проматывает» все варианты сверху вниз.
  const didInitialScroll = useRef(false);

  // load стабилен (deps [chatId]) — один раз за открытие шторки.
  useEffect(() => {
    load().catch((err) => console.error("Failed to load impersonation variants", err));
  }, [load]);

  // Держим прокрутку у низа: новые варианты и текущая генерация — снизу.
  useEffect(() => {
    if (loading) return;
    endRef.current?.scrollIntoView({ behavior: didInitialScroll.current ? "smooth" : "auto", block: "end" });
    didInitialScroll.current = true;
  }, [loading, variants.length, streamingText, generating]);

  return (
    <Stack gap="sm">
      {loading ? (
        <div className={styles.center}>
          <Loader size="sm" />
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {variants.map((v) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={MOTION_TRANSITION}
              >
                <ImpersonateVariantCard
                  chatId={chatId}
                  text={v.content}
                  targetLang={targetLang}
                  onPick={onPick}
                  onDelete={() => void remove(v.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {/* Текущая генерация — снизу, как самый новый вариант. */}
          {generating && (
            <div className={styles.streaming} aria-live="polite">
              {streamingText ? (
                <Text component="div" className={styles.text}>
                  <RpText text={streamingText} />
                </Text>
              ) : (
                <Loader type="dots" size="sm" aria-label="Генерация варианта" />
              )}
            </div>
          )}
          {!generating && variants.length === 0 && (
            <Text c="dimmed" ta="center" py="md">
              Вариантов нет
            </Text>
          )}
        </>
      )}
      <div ref={endRef} />
      <Button fullWidth leftSection={<Sparkles size={18} />} loading={generating} disabled={loading} onClick={() => void generate()}>
        Сгенерировать ещё
      </Button>
    </Stack>
  );
}
