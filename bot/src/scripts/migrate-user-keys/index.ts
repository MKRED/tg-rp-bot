/**
 * Перешифровка данных пользователей v1 → v2 после миграции 0043_users_uuid.
 *
 * v1: ключ пользователя выводился из Telegram id (users.telegram_id после миграции).
 * v2: случайный ключ пользователя в users.data_key (под мастер-ключом).
 *
 * Одна транзакция: генерирует ключи тем, у кого их нет, перешифровывает каждый токен v1 во всех
 * text/text[]/jsonb колонках таблиц из tables.ts (с проверкой обратной расшифровкой), ставит
 * users.data_key NOT NULL и проверяет, что во всей базе не осталось ни одного v1. Любая ошибка —
 * откат, база остаётся как была. Повторный запуск безопасен: v2 не трогается.
 *
 * Бот на время запуска должен быть остановлен. Запуск из корня монорепо:
 *   yarn workspace bot migrate-user-keys            — применить
 *   yarn workspace bot migrate-user-keys --dry-run  — всё то же, но в конце откатить
 */
import { isDeepStrictEqual } from "node:util";
import postgres from "postgres";
import { config } from "../../config.js";
import { decrypt, encrypt, generateDataKey, unwrapDataKey } from "../../utils/index.js";
import { decryptLegacy, legacyUserKey } from "./legacy-crypto.js";
import { reencryptValue } from "./reencrypt-value.js";
import { TABLES } from "./tables.js";

const DRY_RUN = process.argv.includes("--dry-run");

class DryRunRollback extends Error {}

interface UserKeys {
  legacy: Buffer | null;
  current: Buffer;
}

type Sql = postgres.TransactionSql;

/** Ключи всех пользователей; недостающие data_key генерируются и записываются. */
async function loadUserKeys(tx: Sql): Promise<Map<string, UserKeys>> {
  const users = await tx<{ id: string; telegram_id: string | null; data_key: string | null }[]>`
    SELECT id, telegram_id, data_key FROM users`;
  const keys = new Map<string, UserKeys>();
  let generated = 0;
  for (const u of users) {
    let current: Buffer;
    if (u.data_key) {
      current = unwrapDataKey(u.data_key);
    } else {
      const fresh = generateDataKey();
      await tx`UPDATE users SET data_key = ${fresh.wrapped} WHERE id = ${u.id}`;
      current = fresh.key;
      generated++;
    }
    keys.set(u.id, { legacy: u.telegram_id != null ? legacyUserKey(Number(u.telegram_id)) : null, current });
  }
  console.log(`users: ${users.length}, новых ключей: ${generated}`);
  return keys;
}

/** text/text[]/jsonb колонки таблицы (тип нужен, чтобы записать значение обратно с верным cast). */
async function textColumns(tx: Sql, table: string): Promise<Array<{ name: string; cast: string }>> {
  const cols = await tx<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
      AND data_type IN ('text', 'jsonb', 'ARRAY')`;
  return cols.map((c) => ({
    name: c.column_name,
    cast: c.data_type === "jsonb" ? "jsonb" : c.data_type === "ARRAY" ? "text[]" : "text",
  }));
}

async function reencryptTable(tx: Sql, spec: (typeof TABLES)[number], keys: Map<string, UserKeys>): Promise<void> {
  const cols = await textColumns(tx, spec.table);
  const select = cols.map((c) => `t."${c.name}"`).join(", ");
  const rows = await tx.unsafe<Record<string, unknown>[]>(
    `SELECT t."${spec.rowKey}" AS row_key, ${spec.owner} AS owner_id, ${select} FROM "${spec.table}" t`,
  );

  let tokens = 0;
  let rowsChanged = 0;
  for (const row of rows) {
    const changes: Array<{ name: string; cast: string; value: unknown }> = [];
    for (const col of cols) {
      const { value, swapped } = reencryptValue(row[col.name], (token) => {
        const owner = keys.get(String(row.owner_id));
        if (!owner?.legacy) {
          throw new Error(`${spec.table}.${col.name} ${String(row.row_key)}: токен v1 без ключа владельца ${String(row.owner_id)}`);
        }
        const plain = decryptLegacy(token, owner.legacy);
        const next = encrypt(plain, owner.current);
        // Обратная расшифровка — проверка, что новый токен читается тем ключом, который будет у бота.
        if (decrypt(next, owner.current) !== plain) throw new Error(`${spec.table}.${col.name}: проверка v2 не прошла`);
        return next;
      });
      if (swapped > 0) {
        tokens += swapped;
        changes.push({ name: col.name, cast: col.cast, value });
      }
    }
    if (changes.length === 0) continue;
    rowsChanged++;
    // jsonb — строкой через ::text::jsonb: параметр с типом jsonb postgres.js сериализует сам, и
    // готовый JSON.stringify закодировался бы второй раз (объект стал бы jsonb-строкой).
    const set = changes
      .map((c, i) => `"${c.name}" = $${i + 1}::${c.cast === "jsonb" ? "text::jsonb" : c.cast}`)
      .join(", ");
    const params = changes.map((c) => (c.cast === "jsonb" ? JSON.stringify(c.value) : c.value));
    const returning = changes.map((c) => `"${c.name}"`).join(", ");
    const [written] = await tx.unsafe<Record<string, unknown>[]>(
      `UPDATE "${spec.table}" SET ${set} WHERE "${spec.rowKey}" = $${changes.length + 1} RETURNING ${returning}`,
      [...(params as postgres.ParameterOrJSON<never>[]), row.row_key as never],
    );
    // Записанное должно совпасть с задуманным по структуре (объект остался объектом, массив — массивом).
    for (const c of changes) {
      if (!isDeepStrictEqual(written?.[c.name], c.value)) {
        throw new Error(`${spec.table}.${c.name} ${String(row.row_key)}: записанное значение не совпало с ожидаемым`);
      }
    }
  }
  console.log(`${spec.table}: строк ${rows.length}, изменено ${rowsChanged}, токенов ${tokens}`);
}

/** Во всей схеме public не должно остаться ни одного токена v1 — ловит и таблицы, забытые в tables.ts. */
async function assertNoLegacyTokens(tx: Sql): Promise<void> {
  const cols = await tx<{ table_name: string; column_name: string; data_type: string }[]>`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'jsonb', 'ARRAY')`;
  const leftovers: string[] = [];
  for (const c of cols) {
    const col = `"${c.column_name}"`;
    const cond =
      c.data_type === "jsonb"
        ? `${col}::text LIKE '%"v1:%'`
        : c.data_type === "ARRAY"
          ? `EXISTS (SELECT 1 FROM unnest(${col}) x WHERE x LIKE 'v1:%')`
          : `${col} LIKE 'v1:%'`;
    const [r] = await tx.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${c.table_name}" WHERE ${cond}`);
    if (r!.n > 0) leftovers.push(`${c.table_name}.${c.column_name}: ${r!.n}`);
  }
  if (leftovers.length > 0) throw new Error(`Остались токены v1: ${leftovers.join(", ")}`);
  console.log("Проверка: токенов v1 в базе нет");
}

async function main(): Promise<void> {
  const sql = postgres(config.databaseUrl, { max: 1 });
  const t0 = Date.now();
  console.log(`База: ${new URL(config.databaseUrl).pathname.slice(1)}${DRY_RUN ? " (dry-run)" : ""}`);
  try {
    await sql.begin(async (tx) => {
      const [hasKeyColumn] = await tx`
        SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'data_key'`;
      if (!hasKeyColumn) throw new Error("Нет users.data_key — сначала примените миграцию 0043_users_uuid");

      const keys = await loadUserKeys(tx);
      for (const spec of TABLES) await reencryptTable(tx, spec, keys);
      await tx`ALTER TABLE users ALTER COLUMN data_key SET NOT NULL`;
      await assertNoLegacyTokens(tx);
      if (DRY_RUN) throw new DryRunRollback();
    });
    console.log(`Готово за ${Date.now() - t0} мс`);
  } catch (err) {
    if (err instanceof DryRunRollback) {
      console.log(`Dry-run: всё прошло, изменения откачены (${Date.now() - t0} мс)`);
    } else {
      console.error("Перешифровка не удалась, транзакция откачена:", err);
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

void main();
