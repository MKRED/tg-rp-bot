import { Loader } from "@mantine/core";
import { Images } from "lucide-react";
import { useParams } from "react-router-dom";
import { CanvasWorkspace, useCanvas } from "../../features/image-canvas";
import { EmptyState } from "../../shared/components/EmptyState";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import styles from "./ImageCanvasPage.module.css";

/** Экран холста раздела «Картинки». */
export function ImageCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const actions = useCanvas(Number(id));
  const { canvas, loading, error } = actions;

  return (
    <FullHeightPage title={canvas?.name ?? "Холст"} phase={loading ? "loading" : "ready"} floatingBack={!canvas}>
      {canvas ? (
        <CanvasWorkspace canvas={canvas} actions={actions} />
      ) : (
        <div className={styles.center}>
          {loading ? (
            <Loader />
          ) : (
            <EmptyState
              icon={Images}
              title={error ? "Не удалось открыть холст" : "Холст не найден"}
              description="Проверьте соединение или вернитесь к списку."
            />
          )}
        </div>
      )}
    </FullHeightPage>
  );
}
