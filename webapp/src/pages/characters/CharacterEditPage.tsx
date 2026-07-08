import { Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  CharacterForm,
  createCharacter,
  removeCharacter,
  updateCharacter,
  useCharacter,
  type Character,
  type CharacterInput,
} from "../../features/characters";
import { ApiError } from "../../shared/api/client";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import "./characters.css";

/** Маппинг полного персонажа в значения формы. */
function toInput(c: Character): CharacterInput {
  return {
    name: c.name,
    image: c.image,
    imageFull: c.imageFull,
    tags: c.tags,
    footnote: c.footnote,
    prompt: c.prompt,
    scenario: c.scenario,
    firstMessages: c.firstMessages,
  };
}

/**
 * Экран создания/редактирования персонажа. Цель маршрутов /characters/new и /characters/:id:
 * при наличии id грузим персонажа, иначе пустая форма. Нативная «Назад» (BackButtonBridge)
 * возвращает к списку.
 */
export function CharacterEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const location = useLocation();
  // /characters/new → id отсутствует (создание); /characters/:id → строка с числом.
  const id = params.id ? Number(params.id) : undefined;
  // Если открыто из настроек чата — returnTo хранит путь обратно в настройки.
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  const { character, loading, error } = useCharacter(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: CharacterInput) => {
    setSubmitting(true);
    const op = id === undefined ? createCharacter(input) : updateCharacter(id, input);
    op.then(() => navigate(returnTo ?? ROUTES.characters))
      .catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    // Подтверждение перед необратимым удалением — нативный попап Telegram (см. confirmAction).
    const confirmed = await confirmAction("Удалить персонажа? Это действие необратимо.", {
      title: "Удаление персонажа",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeCharacter(id)
      .then(() => navigate(ROUTES.characters))
      .catch(async (err) => {
        setSubmitting(false);
        // 409 — FK нарушение: персонаж привязан к чату, сервер блокирует удаление.
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Персонаж используется в чате. Сначала удалите чат.", "Нельзя удалить");
        }
      });
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="characters-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  if (error || (id !== undefined && !character)) {
    return (
      <PageTransition>
        <div className="characters-page__fullcenter">Персонаж не найден</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="characters-page">
        <CharacterForm
          initial={character ? toInput(character) : undefined}
          submitting={submitting}
          onSubmit={handleSubmit}
          onDelete={id === undefined ? undefined : handleDelete}
        />
      </div>
    </PageTransition>
  );
}
