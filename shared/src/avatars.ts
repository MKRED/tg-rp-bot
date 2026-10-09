/** Сущности, у которых есть аватар для AvatarStack (список историй, шапка чата narrator). */
export const AVATAR_TYPES = ["character", "persona"] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

/** Дескриптор аватара. */
export interface AvatarRef {
  type: AvatarType;
  id: number;
}

/**
 * Максимум дескрипторов в одном POST /api/avatars/batch — стек в списке (top-3) × страница историй
 * + шапка (top-5) с большим запасом; страхует от намеренно раздутого запроса.
 */
export const MAX_AVATAR_BATCH_REFS = 60;

/** Тело POST /api/avatars/batch. */
export interface AvatarBatchRequest {
  refs: AvatarRef[];
}

/** Найденный аватар: картинка как data URL. */
export interface AvatarBatchResult extends AvatarRef {
  dataUrl: string;
}

/** Ответ: только найденные аватары своих сущностей с картинкой (остальные молча выпадают). */
export interface AvatarBatchResponse {
  avatars: AvatarBatchResult[];
}
