import type { Context } from "hono";
import type { AppVariables } from "../middleware/initData.types.js";

/** Контекст Hono narrator-роутов (после requireInitData). */
export type Ctx = Context<{ Variables: AppVariables }>;
