import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("hashPassword / verifyPassword", () => {
  it("верный пароль сверяется, неверный — нет", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("correct horsE", hash)).toBe(false);
  });

  it("формат scrypt$N$r$p$salt$hash; соль случайная — одинаковые пароли дают разные хэши", async () => {
    const a = await hashPassword("пароль-123");
    const b = await hashPassword("пароль-123");
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(a).not.toBe(b);
  });

  it("юникод нормализуется: одинаковый на вид пароль в разной форме сверяется", async () => {
    // é одной кодовой точкой (U+00E9) и как e + комбинируемое ударение (U+0301)
    const hash = await hashPassword("caf\u00e9-pass");
    expect(await verifyPassword("cafe\u0301-pass", hash)).toBe(true);
  });

  it("нераспознанный хэш — false, не исключение", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$foo")).toBe(false);
  });
});
