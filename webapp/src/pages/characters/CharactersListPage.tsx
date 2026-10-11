import { Users } from "lucide-react";
import { ROUTES, characterEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { CharacterAvatar, MAX_CHARACTERS_PER_USER, useCharacters } from "../../features/characters";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";

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

/** Хаб «Персонажи»: все персонажи пользователя и создание нового. */
export function CharactersListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useCharacters();

  return (
    <ListPage
      title="Персонажи"
      description="Действующие лица для режима «Режиссёр истории» и обычных чатов"
      icon={Users}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_CHARACTERS_PER_USER}
      limitText={`Достигнут лимит в ${MAX_CHARACTERS_PER_USER} персонажей`}
      createLabel="Создать персонажа"
      emptyTitle="Пока нет персонажей"
      emptyDescription="Персонаж — тот, с кем вы играете: внешность, описание для нейросети, сценарий и первые сообщения."
      onCreate={() => navigate(ROUTES.characterNew)}
    >
      {items.map((c, i) => (
        <ListRow
          key={c.id}
          index={i}
          // Аватар с фото — своя кнопка (лайтбокс), тап по остальной строке открывает персонажа.
          leading={<CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} size={48} enlargeable />}
          title={c.name}
          // Заполненное примечание заменяет строку тегов/приветствий (как у персоны).
          description={c.footnote || subtitleOf(c.tags, c.firstMessageCount)}
          onClick={() => navigate(characterEditPath(c.id))}
        />
      ))}
    </ListPage>
  );
}
