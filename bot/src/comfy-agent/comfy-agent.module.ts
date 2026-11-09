import { Module } from "@nestjs/common";
import { AgentLinkController } from "./agent-link.controller.js";
import { INSTALL_CODE_TTL_MS, RELAY_OPTIONS } from "./comfy-agent.constants.js";
import { ComfyAgentController } from "./comfy-agent.controller.js";
import { ComfyAgentRepository } from "./comfy-agent.repository.js";
import { ComfyAgentService } from "./comfy-agent.service.js";
import { InstallCodes } from "./install/index.js";
import { ComfyReadinessService } from "./readiness/index.js";
import { RelayHub } from "./relay/index.js";

/**
 * /api/comfy-agent — свой ComfyUI пользователя через агента на ПК (docs/plan/image-generation.md).
 * RelayHub и InstallCodes — по одному на процесс: очередь заданий, ожидающие ответы и коды установки
 * живут в памяти.
 */
@Module({
  controllers: [ComfyAgentController, AgentLinkController],
  providers: [
    ComfyAgentService,
    ComfyAgentRepository,
    ComfyReadinessService,
    { provide: RelayHub, useFactory: () => new RelayHub(RELAY_OPTIONS) },
    { provide: InstallCodes, useFactory: () => new InstallCodes(INSTALL_CODE_TTL_MS) },
  ],
  exports: [ComfyAgentService],
})
export class ComfyAgentModule {}
