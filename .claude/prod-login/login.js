// Вход Claude на прод (https://miniapp.aoshi.ru) — сниппет для Playwright MCP browser_run_code_unsafe
// (параметр filename). Логин и пароль берёт у serve-creds.mjs, запущенного заранее; в чат они не попадают.
async (page) => {
  const res = await page.context().request.get("http://127.0.0.1:47811/");
  const { login, password } = await res.json();
  await page.goto("https://miniapp.aoshi.ru/");
  await page.getByPlaceholder("login").fill(login);
  await page.locator("input[type='password']").fill(password);
  await page.locator("button[type='submit']").click();
  await page.getByText(`логин: ${login}`).waitFor({ timeout: 10000 });
  return `logged in as ${login}`;
}
