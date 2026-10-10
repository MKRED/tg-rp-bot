import { Injectable, NotFoundException } from "@nestjs/common";
import type { ImpersonationVariant } from "../../db/schema.js";
import { ChatContextService } from "../chat-context.service.js";
import { ImpersonationsRepository } from "./impersonations.repository.js";

/** Сохранённые варианты реплик игрока: список для текущего момента, очистка, удаление одного. */
@Injectable()
export class ImpersonationsService {
  constructor(
    private readonly impersonations: ImpersonationsRepository,
    private readonly access: ChatContextService,
  ) {}

  /**
   * Варианты текущего момента диалога (момент = курсор чата). Курсор — из лёгкой строки без
   * самовосстановления findDetail: штатно он не «бьётся» (сообщения удаляются только через
   * MessagesRepository.removeSubtree, который переносит курсор), а webapp открывает шторку вариантов
   * уже после загрузки чата, где findDetail чинит курсор.
   */
  async list(userId: string, chatId: number): Promise<ImpersonationVariant[]> {
    const chat = await this.access.requireRow(userId, chatId);
    return this.impersonations.list(userId, chatId, chat.activeMessageId);
  }

  /** Удаляет все варианты чата; возвращает их число. */
  async clear(userId: string, chatId: number): Promise<number> {
    await this.access.requireRow(userId, chatId);
    return this.impersonations.removeAll(chatId);
  }

  async remove(userId: string, chatId: number, variantId: number): Promise<void> {
    await this.access.requireRow(userId, chatId);
    if (!(await this.impersonations.remove(chatId, variantId))) throw new NotFoundException("Variant not found");
  }
}
