import { Avatar, Badge, Group, Text } from "@mantine/core";
import { Images } from "lucide-react";
import { useState } from "react";
import { imageCanvasPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_IMAGE_CANVASES_PER_USER, useCanvasList } from "../../features/image-canvas";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";
import { useToast } from "../../shared/toast";

const MODEL_LABEL = { qwen: "Qwen", qwen_turbo: "Turbo" } as const;

function variantsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "вариант";
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "варианта" : "вариантов";
}

/** Раздел «Картинки»: холсты — у каждого свои картинки, черновики и сохранённые варианты. */
export function ImagesListPage() {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const { items, loading, error, create } = useCanvasList();
  const [creating, setCreating] = useState(false);

  const createCanvas = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const canvas = await create();
      navigate(imageCanvasPath(canvas.id));
    } catch (err) {
      console.error("Failed to create image canvas", err);
      showToast({ type: "error", message: err instanceof Error ? err.message : "Не удалось создать холст" });
      setCreating(false);
    }
  };

  return (
    <ListPage
      title="Картинки"
      description="Правка картинок в своём ComfyUI: Qwen и Qwen Turbo"
      icon={Images}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_IMAGE_CANVASES_PER_USER}
      limitText={`Достигнут лимит в ${MAX_IMAGE_CANVASES_PER_USER} холстов`}
      createLabel="Новый холст"
      emptyTitle="Начните с холста"
      emptyDescription="Холст — работа над одной картинкой: прикрепите её, опишите, что изменить, и сохраняйте удачные варианты."
      onCreate={() => void createCanvas()}
    >
      {items.map((canvas, i) => (
        <ListRow
          key={canvas.id}
          index={i}
          leading={<Avatar src={canvas.thumb} radius="sm" size={44} color="accent"><Images size={20} /></Avatar>}
          title={canvas.name}
          description={
            <Group gap={6} wrap="nowrap">
              <Text size="sm" c="dimmed" span>
                {canvas.variantCount} {variantsWord(canvas.variantCount)} · {MODEL_LABEL[canvas.model]}
              </Text>
              {canvas.running && (
                <Badge size="xs" variant="light">
                  генерация
                </Badge>
              )}
            </Group>
          }
          meta={
            <Text size="xs" c="dimmed">
              {formatRelativeDate(canvas.updatedAt)}
            </Text>
          }
          onClick={() => navigate(imageCanvasPath(canvas.id))}
        />
      ))}
    </ListPage>
  );
}
