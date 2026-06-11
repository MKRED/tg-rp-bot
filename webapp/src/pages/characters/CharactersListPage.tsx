import { Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { ROUTES, characterEditPath } from "../../app/routes";
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

/** Экран «Персонажи»: список созданных персонажей + кнопка создания. */
export function CharactersListPage() {
  const navigate = useNavigate();
  const { items, loading, error } = useCharacters();

  const atLimit = items.length >= MAX_CHARACTERS_PER_USER;

  return (
    <div className="characters-page">
      <List>
        <Section header="Персонажи">
          {loading && (
            <div className="characters-page__center">
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
            items.map((c) => (
              <Cell
                key={c.id}
                before={<CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} enlargeable />}
                subtitle={subtitleOf(c.tags, c.firstMessageCount)}
                onClick={() => navigate(characterEditPath(c.id))}
              >
                {c.name}
              </Cell>
            ))}
        </Section>

        <div className="characters-page__create">
          <Button
            size="l"
            stretched
            disabled={atLimit}
            onClick={() => navigate(ROUTES.characterNew)}
          >
            + Создать персонажа
          </Button>
          {atLimit && (
            <Caption level="1" className="characters-page__limit">
              Достигнут лимит в {MAX_CHARACTERS_PER_USER} персонажей
            </Caption>
          )}
        </div>
      </List>
    </div>
  );
}
