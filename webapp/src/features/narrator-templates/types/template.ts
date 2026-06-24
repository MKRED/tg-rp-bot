/** Типы фичи «narrator-шаблоны» — источник системного промпта narrator-режима. */

export type NarratorTemplateListItem = {
  id: number;
  name: string;
};

export type NarratorTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  postHistoryInstruction: string;
};

export type NarratorTemplateInput = {
  name: string;
  systemPrompt: string;
  postHistoryInstruction: string;
};

export const MAX_TEMPLATES_PER_USER = 50;
