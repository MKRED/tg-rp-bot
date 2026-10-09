import { Injectable } from "@nestjs/common";
import type { StorySettings } from "@tg-rp-bot/shared";
import { PresetsRepository } from "../../presets/presets.repository.js";
import { clampStoredCompactFloor } from "../compaction/compact-gate.js";
import { StoryContextService } from "../story-context.service.js";
import { StorySettingsRepository } from "./story-settings.repository.js";

/** Настройки истории: перевод, сжатие, кнопки тулбара сообщения. */
@Injectable()
export class StorySettingsService {
  constructor(
    private readonly settings: StorySettingsRepository,
    private readonly access: StoryContextService,
    private readonly presets: PresetsRepository,
  ) {}

  async get(userId: number, storyId: number): Promise<StorySettings> {
    await this.access.requireRow(userId, storyId);
    return this.settings.get(storyId);
  }

  /**
   * Сохраняет только корректные переданные поля (DTO обнулил невалидные). «Пол» сжатия клампится по
   * окну контекста пресета истории. Пустой патч — без записи: upsert с пустым SET — невалидный SQL.
   */
  async update(userId: number, storyId: number, input: Partial<StorySettings>): Promise<StorySettings> {
    const story = await this.access.requireRow(userId, storyId);
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<StorySettings>;
    if (patch.compactFloorTokens !== undefined) {
      const preset = story.presetId ? await this.presets.findOne(userId, story.presetId) : undefined;
      patch.compactFloorTokens = clampStoredCompactFloor(patch.compactFloorTokens, preset);
    }
    if (Object.keys(patch).length === 0) return this.settings.get(storyId);
    return this.settings.upsert(storyId, patch);
  }
}
