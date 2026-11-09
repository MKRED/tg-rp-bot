import { describe, expect, it } from "vitest";
import { isAllowedComfyRequest } from "./comfy-paths.js";

describe("isAllowedComfyRequest", () => {
  it("пропускает нужные эндпоинты", () => {
    expect(isAllowedComfyRequest("GET", "/api/system_stats")).toBe(true);
    expect(isAllowedComfyRequest("GET", "/api/object_info/TextEncodeQwenImage21")).toBe(true);
    expect(isAllowedComfyRequest("GET", "/api/history/387fc069-f177-4119-a5a6-e1506a0ffb4b")).toBe(true);
    expect(isAllowedComfyRequest("POST", "/api/prompt")).toBe(true);
  });

  it("отвергает чужой метод, путь и обход через ..", () => {
    expect(isAllowedComfyRequest("POST", "/api/system_stats")).toBe(false);
    expect(isAllowedComfyRequest("GET", "/api/userdata/workflows")).toBe(false);
    expect(isAllowedComfyRequest("POST", "/api/manager/install")).toBe(false);
    expect(isAllowedComfyRequest("GET", "/api/history/../userdata")).toBe(false);
    expect(isAllowedComfyRequest("DELETE", "/api/queue")).toBe(false);
  });
});
