import { IsBase64, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import type { AgentResponse } from "../relay/index.js";

/** Тело POST /api/comfy-agent/agent/result/:id — ответ ComfyUI, пересланный агентом. */
export class AgentResultDto implements AgentResponse {
  /** HTTP-статус ComfyUI; 0 — до ComfyUI агент не достучался (тогда заполнен error). */
  @IsInt()
  @Min(0)
  @Max(999)
  status!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contentType!: string | null;

  // Пустая строка — тоже допустимый base64 (пустое тело).
  @IsString()
  @IsBase64()
  bodyBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;
}
