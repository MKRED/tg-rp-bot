import { ActionIcon, Button, Menu, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { EllipsisVertical } from "lucide-react";
import { useState } from "react";
import { ROUTES } from "../../../../app/routes";
import { useTransitionNavigate } from "../../../../app/useTransitionNavigate";
import { ResponsiveSheet } from "../../../../shared/components/ResponsiveSheet";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useToast } from "../../../../shared/toast";
import { useComfyAgentStatus } from "../../../comfy-agent";
import { deleteCanvas } from "../../api/image-canvas-api";
import type { CanvasState } from "../../hooks/useCanvas";
import type { ImageCanvas } from "../../types/imageCanvas";
import { CanvasStage } from "./CanvasStage";
import { Composer } from "./Composer";
import { VariantsGallery } from "./VariantsGallery";
import styles from "./CanvasWorkspace.module.css";

type CanvasTab = "canvas" | "variants";

interface CanvasWorkspaceProps {
  canvas: ImageCanvas;
  actions: CanvasState;
}

/**
 * Экран холста. Вкладка «Холст» — цикл правки: картинка (черновики свайпом) и панель снизу (на ПК —
 * справа). Вкладка «Варианты» — галерея сохранённого: туда вынесено всё, что нужно реже.
 */
export function CanvasWorkspace({ canvas, actions }: CanvasWorkspaceProps) {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const agent = useComfyAgentStatus();
  const [tab, setTab] = useState<CanvasTab>("canvas");
  const [repeatPrompt, setRepeatPrompt] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(canvas.name);

  const remove = async () => {
    const confirmed = await confirmAction("Холст удалится вместе с картинками, черновиками и вариантами.", { title: "Удалить холст?" });
    if (!confirmed) return;
    try {
      await deleteCanvas(canvas.id);
      navigate(ROUTES.images, { replace: true });
    } catch (err) {
      console.error("Failed to delete image canvas", err);
      showToast({ type: "error", message: "Не удалось удалить холст" });
    }
  };

  const rename = async () => {
    if (!name.trim()) return;
    await actions.patch({ name: name.trim() });
    setRenaming(false);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerTitle}>
            <Text fw={600} truncate>
              {canvas.name}
            </Text>
            <Text size="xs" c="dimmed">
              Холст
            </Text>
          </div>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="xl" aria-label="Действия с холстом">
                <EllipsisVertical size={22} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={() => {
                  setName(canvas.name);
                  setRenaming(true);
                }}
              >
                Переименовать
              </Menu.Item>
              <Menu.Item color="red" onClick={() => void remove()}>
                Удалить холст
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
        <SegmentedControl
          className={styles.tabs}
          fullWidth
          value={tab}
          onChange={(value) => setTab(value as CanvasTab)}
          data={[
            { value: "canvas", label: "Холст" },
            { value: "variants", label: `Варианты · ${canvas.variants.length}` },
          ]}
        />
      </header>

      {tab === "canvas" ? (
        <div className={styles.canvasBody}>
          <CanvasStage canvas={canvas} actions={actions} />
          <Composer
            canvas={canvas}
            actions={actions}
            agent={agent}
            draftPrompt={repeatPrompt}
            onDraftPromptApplied={() => setRepeatPrompt(null)}
          />
        </div>
      ) : (
        <VariantsGallery
          canvas={canvas}
          actions={actions}
          onToCanvas={() => setTab("canvas")}
          onRepeat={(variant) => {
            if (variant.model !== canvas.model) void actions.patch({ model: variant.model });
            setRepeatPrompt(variant.prompt);
            setTab("canvas");
          }}
        />
      )}

      <ResponsiveSheet opened={renaming} onClose={() => setRenaming(false)} title="Название холста">
        <Stack gap="sm">
          <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={200} data-autofocus />
          <Button disabled={!name.trim()} onClick={() => void rename()}>
            Сохранить
          </Button>
        </Stack>
      </ResponsiveSheet>
    </>
  );
}
