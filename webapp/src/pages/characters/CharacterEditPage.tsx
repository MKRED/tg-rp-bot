import { Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { CharacterForm } from "../../features/characters/CharacterForm";
import {
  createCharacter,
  removeCharacter,
  updateCharacter,
} from "../../features/characters/characters-api";
import { useCharacter } from "../../features/characters/useCharacter";
import type { Character, CharacterInput } from "../../features/characters/types";
import { confirmAction } from "../../shared/telegram/confirm";
import "./characters.css";

/** Маппинг полного персонажа в значения формы. */
function toInput(c: Character): CharacterInput {
  return {
    name: c.name,
    image: c.image,
    tags: c.tags,
    prompt: c.prompt,
    firstMessages: c.firstMessages,
  };
}

/**
 * Экран создания/редактирования персонажа. Цель маршрутов /characters/new и /characters/:id:
 * при наличии id грузим персонажа, иначе пустая форма. Нативная «Назад» (BackButtonBridge)
 * возвращает к списку.
 */
export function CharacterEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  // /characters/new → id отсутствует (создание); /characters/:id → строка с числом.
  const id = params.id ? Number(params.id) : undefined;

  const { character, loading, error } = useCharacter(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: CharacterInput) => {
    setSubmitting(true);
    const op = id === undefined ? createCharacter(input) : updateCharacter(id, input);
    op.then(() => navigate(ROUTES.characters))
      .catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    // Подтверждение перед необратимым удалением — нативный попап Telegram (см. confirmAction).
    const confirmed = await confirmAction("Удалить персонажа? Это действие необратимо.");
    if (!confirmed) return;
    setSubmitting(true);
    removeCharacter(id)
      .then(() => navigate(ROUTES.characters))
      .catch(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="characters-page__fullcenter">
        <Spinner size="m" />
      </div>
    );
  }

  if (error || (id !== undefined && !character)) {
    return <div className="characters-page__fullcenter">Персонаж не найден</div>;
  }

  return (
    <div className="characters-page">
      <CharacterForm
        initial={character ? toInput(character) : undefined}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </div>
  );
}
