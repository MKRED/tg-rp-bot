import { randomBytes } from "node:crypto";

export interface MultipartFile {
  field: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

/**
 * Тело multipart/form-data для `POST /api/upload/image` ComfyUI. Собираем сами: агент пересылает
 * готовые байты как есть, а FormData из Node отдаёт поток, который пришлось бы вычитывать.
 */
export function buildMultipart(fields: Record<string, string>, files: MultipartFile[]): { body: Buffer; contentType: string } {
  const boundary = `----tgrpbot${randomBytes(12).toString("hex")}`;
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const file of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      ),
      file.data,
      Buffer.from("\r\n"),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}
