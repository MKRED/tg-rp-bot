import { Spinner, Text } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
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
import { useToast } from "../../shared/toast";
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
  const { showToast } = useToast();
  // /characters/new → id отсутствует (создание); /characters/:id → строка с числом.
  const routeId = params.id ? Number(params.id) : undefined;

  const { character, loading, error } = useCharacter(routeId);
  const [submitting, setSubmitting] = useState(false);
  // После первого успешного сохранения нового персонажа держим его id локально: «Сохранить»
  // больше не покидает экран (маршрут остаётся /characters/new), поэтому без этого повторное
  // сохранение продолжило бы создавать дубликаты вместо обновления уже созданного.
  const [createdId, setCreatedId] = useState<number>();
  const id = routeId ?? createdId;

  const handleSubmit = (input: CharacterInput) => {
    setSubmitting(true);
    const op = id === undefined ? createCharacter(input) : updateCharacter(id, input);
    return op
      .then(({ character: saved }) => {
        if (id === undefined) setCreatedId(saved.id);
        showToast({ type: "success", message: "Персонаж сохранён" });
      })
      .catch((err) => {
        showToast({ type: "error", message: "Не удалось сохранить персонажа" });
        throw err;
      })
      .finally(() => setSubmitting(false));
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

  if (error || (routeId !== undefined && !character)) {
    return (
      <PageTransition>
        <Text Component="div" className="characters-page__fullcenter">Персонаж не найден</Text>
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
