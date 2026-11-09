import { describe, expect, it } from "vitest";
import { parseHistory, promptRejection, queuePosition } from "./comfy-responses.js";

const ID = "7d80795a-8716-4c00-b6c5-8d167df1ea03";

describe("parseHistory", () => {
  it("пустой ответ — задание ещё идёт", () => {
    expect(parseHistory({}, ID)).toEqual({ state: "pending" });
  });

  it("готово — картинки из outputs", () => {
    const body = {
      [ID]: {
        status: { status_str: "success", completed: true, messages: [] },
        outputs: { save: { images: [{ filename: "canvas_00001_.png", subfolder: "tg-rp-bot", type: "output", metadata: {} }] } },
      },
    };
    expect(parseHistory(body, ID)).toEqual({ state: "done", images: [{ filename: "canvas_00001_.png", subfolder: "tg-rp-bot", type: "output" }] });
  });

  it("ошибка ноды — тип ноды и текст", () => {
    const body = {
      [ID]: {
        status: {
          status_str: "error",
          completed: false,
          messages: [["execution_error", { node_type: "KSampler", exception_message: "CUDA out of memory\n" }]],
        },
      },
    };
    expect(parseHistory(body, ID)).toEqual({ state: "error", message: "KSampler: CUDA out of memory", interrupted: false });
  });

  it("остановка — interrupted", () => {
    const body = { [ID]: { status: { status_str: "error", completed: false, messages: [["execution_interrupted", {}]] } } };
    expect(parseHistory(body, ID)).toMatchObject({ state: "error", interrupted: true });
  });
});

describe("queuePosition", () => {
  it("находит задание в выполняемых и ожидающих", () => {
    expect(queuePosition({ queue_running: [[1, ID, {}]], queue_pending: [] }, ID)).toBe("running");
    expect(queuePosition({ queue_running: [[1, "other"]], queue_pending: [[2, ID]] }, ID)).toBe("pending");
    expect(queuePosition({ queue_running: [], queue_pending: [] }, ID)).toBe("absent");
    expect(queuePosition(null, ID)).toBe("absent");
  });
});

describe("promptRejection", () => {
  it("первая ошибка ноды", () => {
    const body = {
      error: { message: "Prompt outputs failed validation" },
      node_errors: { unet: { class_type: "UNETLoader", errors: [{ message: "Value not in list", details: "unet_name: 'x' not in [...]" }] } },
    };
    expect(promptRejection(body)).toBe("UNETLoader: Value not in list — unet_name: 'x' not in [...]");
  });

  it("без node_errors — общий текст", () => {
    expect(promptRejection({ error: { message: "invalid prompt" } })).toBe("invalid prompt");
    expect(promptRejection(null)).toBe("ComfyUI отклонил задание");
  });
});
