import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { AgentResultDto } from "./agent-result.dto.js";

const pipe = createValidationPipe();
const parse = (body: unknown) => pipe.transform(body, { type: "body", metatype: AgentResultDto });

describe("AgentResultDto", () => {
  it("принимает ответ ComfyUI и пустое тело", async () => {
    await expect(parse({ status: 200, contentType: "image/png", bodyBase64: "iVBORw0KGgo=" })).resolves.toMatchObject({ status: 200 });
    await expect(parse({ status: 0, contentType: null, bodyBase64: "", error: "refused" })).resolves.toMatchObject({ status: 0, error: "refused" });
  });

  it("отклоняет не-base64 и странный статус", async () => {
    await expect(parse({ status: 200, contentType: null, bodyBase64: "не base64!" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(parse({ status: -1, contentType: null, bodyBase64: "" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(parse({ status: "200", contentType: null, bodyBase64: "" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
