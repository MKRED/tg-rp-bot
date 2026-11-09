import { randomUUID } from "node:crypto";
import type { AgentJob, AgentJobRequest, AgentResponse, RelayHubOptions } from "./relay.types.js";

export class AgentOfflineError extends Error {
  constructor() {
    super("ComfyUI agent is offline");
  }
}

export class AgentTimeoutError extends Error {
  constructor(readonly jobId: string) {
    super("ComfyUI agent did not answer in time");
  }
}

interface AgentState {
  lastSeen: number;
  queue: AgentJob[];
  /** Ждущий long-poll агента: отдаём ему задания сразу, как они появятся. */
  waiter?: { deliver: (jobs: AgentJob[]) => void; timer: NodeJS.Timeout };
}

interface PendingJob {
  userId: string;
  resolve: (res: AgentResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Очередь заданий к агентам ComfyUI в памяти процесса (прод — один контейнер). Сервер не может
 * обратиться к ПК сам, поэтому задание ждёт, пока агент заберёт его long-poll'ом, а ответ агент
 * присылает отдельным запросом. Без Nest и логгера — чистая логика с тестами.
 */
export class RelayHub {
  private readonly agents = new Map<string, AgentState>();
  private readonly pending = new Map<string, PendingJob>();
  private readonly now: () => number;

  constructor(private readonly opts: RelayHubOptions) {
    this.now = opts.now ?? Date.now;
  }

  /** Агент держит long-poll или выходил на связь в пределах окна. */
  isOnline(userId: string): boolean {
    const state = this.agents.get(userId);
    if (!state) return false;
    return Boolean(state.waiter) || this.now() - state.lastSeen <= this.opts.onlineWindowMs;
  }

  lastSeen(userId: string): number | null {
    return this.agents.get(userId)?.lastSeen ?? null;
  }

  /** Передаёт запрос агенту и ждёт ответ. Агент офлайн — AgentOfflineError сразу, без очереди. */
  request(userId: string, job: AgentJobRequest, timeoutMs = this.opts.jobTimeoutMs): Promise<AgentResponse> {
    if (!this.isOnline(userId)) return Promise.reject(new AgentOfflineError());
    const state = this.agents.get(userId)!;
    const full: AgentJob = { ...job, id: randomUUID() };

    return new Promise<AgentResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(full.id);
        // Агент так и не забрал задание — убираем, чтобы он не выполнил его, когда ответ уже никому не нужен.
        state.queue = state.queue.filter((j) => j.id !== full.id);
        reject(new AgentTimeoutError(full.id));
      }, timeoutMs);
      this.pending.set(full.id, { userId, resolve, reject, timer });
      state.queue.push(full);
      this.flush(state);
    });
  }

  /**
   * Long-poll агента: задания из очереди сразу или пустой список через pollHoldMs. Новый poll того же
   * пользователя заменяет прежний (агент один; старое соединение, скорее всего, уже мёртвое).
   * signal — обрыв HTTP-соединения: задания не должны уйти в закрытый сокет.
   */
  poll(userId: string, signal?: AbortSignal): Promise<AgentJob[]> {
    const state = this.touch(userId);
    if (state.waiter) this.releaseWaiter(state, []);
    if (state.queue.length > 0) return Promise.resolve(this.take(state));

    return new Promise<AgentJob[]>((resolve) => {
      const timer = setTimeout(() => this.releaseWaiter(state, []), this.opts.pollHoldMs);
      const waiter = { deliver: resolve, timer };
      state.waiter = waiter;
      signal?.addEventListener("abort", () => {
        if (state.waiter === waiter) this.releaseWaiter(state, []);
      });
    });
  }

  /** Ответ агента на задание. false — задание неизвестно (истекло) или чужое. */
  complete(userId: string, jobId: string, res: AgentResponse): boolean {
    const job = this.pending.get(jobId);
    if (!job || job.userId !== userId) return false;
    this.touch(userId);
    clearTimeout(job.timer);
    this.pending.delete(jobId);
    job.resolve(res);
    return true;
  }

  /** Токен отозван: отпускаем агента и отклоняем всё, что он ещё должен. */
  drop(userId: string): void {
    const state = this.agents.get(userId);
    if (state?.waiter) this.releaseWaiter(state, []);
    this.agents.delete(userId);
    for (const [id, job] of this.pending) {
      if (job.userId !== userId) continue;
      clearTimeout(job.timer);
      this.pending.delete(id);
      job.reject(new AgentOfflineError());
    }
  }

  private touch(userId: string): AgentState {
    let state = this.agents.get(userId);
    if (!state) {
      state = { lastSeen: this.now(), queue: [] };
      this.agents.set(userId, state);
    }
    state.lastSeen = this.now();
    return state;
  }

  private flush(state: AgentState): void {
    if (state.waiter && state.queue.length > 0) this.releaseWaiter(state, this.take(state));
  }

  private take(state: AgentState): AgentJob[] {
    const jobs = state.queue;
    state.queue = [];
    return jobs;
  }

  private releaseWaiter(state: AgentState, jobs: AgentJob[]): void {
    const waiter = state.waiter;
    if (!waiter) return;
    clearTimeout(waiter.timer);
    state.waiter = undefined;
    // Конец удержания тоже «выход на связь»: агент сразу придёт снова.
    state.lastSeen = this.now();
    waiter.deliver(jobs);
  }
}
