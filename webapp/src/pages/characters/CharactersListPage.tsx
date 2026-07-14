import { Banner, Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { ROUTES, characterEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  CharacterAvatar,
  useCharacters,
  MAX_CHARACTERS_PER_USER,
} from "../../features/characters";
import "./characters.css";

/** Русское склонение слова «приветствие» по числу (1 приветствие, 2 приветствия, 5 приветствий). */
function pluralGreetings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "приветствие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "приветствия";
  return "приветствий";
}

/** Подпись строки списка: теги через запятую + число вариантов первого сообщения. */
function subtitleOf(tags: string[], firstMessageCount: number): string {
  const parts: string[] = [];
  if (tags.length > 0) parts.push(tags.join(", "));
  parts.push(`${firstMessageCount} ${pluralGreetings(firstMessageCount)}`);
  return parts.join(" · ");
}

/**
 * Экран «Персонажи»: все персонажи + кнопка создания. Страница НЕ скроллится целиком — две
 * секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её карточки),
 * секция кнопки докнута к нижней кромке (тот же приём, что в хабе «Книги знаний»).
 */
export function CharactersListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useCharacters();

  const atLimit = items.length >= MAX_CHARACTERS_PER_USER;

  return (
    <PageTransition>
      <div className="characters-hub">
        <Banner
          type="section"
          before={<Users size={28} className="characters-hub__banner-icon" />}
          header="Персонажи"
          description="Действующие лица для режима «Режиссёр истории» и обычных чатов"
        />

        <List className="characters-hub__list">
          <Section className="characters-hub__list-section">
            {loading && (
              <div className="characters-hub__center">
                <Spinner size="m" />
              </div>
            )}

            {!loading && error && (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            )}

            {!loading && !error && items.length === 0 && (
              <Cell subtitle="Пока нет персонажей — создайте первого">Пусто</Cell>
            )}

            {!loading &&
              !error &&
              items.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <Cell
                    before={<CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} size={48} enlargeable />}
                    // заполненное примечание заменяет строку тегов/приветствий (как у персоны)
                    subtitle={c.footnote || subtitleOf(c.tags, c.firstMessageCount)}
                    onClick={() => navigate(characterEditPath(c.id))}
                  >
                    {c.name}
                  </Cell>
                </motion.div>
              ))}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="characters-hub__actions-section">
            <div className="characters-hub__create">
              <Button
                size="l"
                stretched
                disabled={atLimit}
                onClick={() => navigate(ROUTES.characterNew)}
              >
                + Создать персонажа
              </Button>
              {atLimit && (
                <Caption level="1" className="characters-hub__limit">
                  Достигнут лимит в {MAX_CHARACTERS_PER_USER} персонажей
                </Caption>
              )}
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
