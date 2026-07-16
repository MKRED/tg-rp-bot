// Публичные типы батч-эндпоинта аватаров.

export type AvatarBatchRef = { type: "character" | "persona"; id: number };

export type AvatarBatchResult = {
  type: "character" | "persona";
  id: number;
  dataUrl: string;
};
