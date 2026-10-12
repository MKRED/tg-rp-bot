import { createCharacter, getCharacter, updateCharacter } from "../../../features/characters";
import { createPersona, getPersona, updatePersona } from "../../../features/personas";

export type ExportTargetMode = "create" | "update";

/** Одна цель выгрузки: создать новую запись или обновить промпт существующей (targetId). */
export interface ExportTarget {
  mode: ExportTargetMode;
  targetId: number | null;
}

export interface ExportRequest {
  /** Имя и примечание — только для создаваемых записей. */
  name: string;
  footnote: string | null;
  prompt: string;
  character: ExportTarget | null;
  persona: ExportTarget | null;
}

export interface ExportResult {
  /** Что получилось — тексты для тоста успеха. */
  done: string[];
  /** Что не получилось — тексты для тоста ошибки. */
  failed: string[];
}

/**
 * Выгрузка карточки в персонажа и/или персону. Стороны независимы: успех одной не блокируется
 * отказом другой (например, исчерпан лимит персон, а персонаж создаётся), поэтому каждая ловит свою
 * ошибку, а не падает через Promise.all. Обновление меняет ТОЛЬКО промпт: имя, примечание, теги,
 * сценарий, первые сообщения и фото берутся из существующей записи (get*), иначе PUT (полная
 * замена) затёр бы их значениями формы и заглушками создания.
 */
export async function exportCard(req: ExportRequest): Promise<ExportResult> {
  const done: string[] = [];
  const failed: string[] = [];

  if (req.character) {
    const { mode, targetId } = req.character;
    try {
      if (mode === "update" && targetId !== null) {
        const { character: existing } = await getCharacter(targetId);
        await updateCharacter(targetId, {
          name: existing.name,
          tags: existing.tags,
          footnote: existing.footnote,
          prompt: req.prompt,
          scenario: existing.scenario,
          firstMessages: existing.firstMessages,
          image: existing.image,
          imageFull: existing.imageFull,
        });
        done.push("Промпт персонажа обновлён");
      } else {
        await createCharacter({
          name: req.name,
          tags: [],
          footnote: req.footnote,
          prompt: req.prompt,
          scenario: "",
          firstMessages: [],
          image: null,
          imageFull: null,
        });
        done.push("Персонаж создан");
      }
    } catch (err) {
      console.error("Не удалось сохранить персонажа из карточки", err);
      failed.push(mode === "update" ? "Не удалось обновить промпт персонажа" : "Не удалось создать персонажа");
    }
  }

  if (req.persona) {
    const { mode, targetId } = req.persona;
    try {
      if (mode === "update" && targetId !== null) {
        const { persona: existing } = await getPersona(targetId);
        await updatePersona(targetId, {
          name: existing.name,
          footnote: existing.footnote,
          prompt: req.prompt,
          image: existing.image,
          imageFull: existing.imageFull,
        });
        done.push("Промпт персоны обновлён");
      } else {
        await createPersona({ name: req.name, footnote: req.footnote, prompt: req.prompt, image: null, imageFull: null });
        done.push("Персона создана");
      }
    } catch (err) {
      console.error("Не удалось сохранить персону из карточки", err);
      failed.push(mode === "update" ? "Не удалось обновить промпт персоны" : "Не удалось создать персону");
    }
  }

  return { done, failed };
}
