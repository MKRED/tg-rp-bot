import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";

export function usePersonaImage(id: number, hasImage: boolean): string | undefined {
  const [dataUrl, setDataUrl] = useState<string>();

  useEffect(() => {
    if (!hasImage) return;
    let cancelled = false;
    apiFetch<{ dataUrl: string | null }>(`/personas/${id}/image`)
      .then((res) => {
        if (!cancelled && res.dataUrl) setDataUrl(res.dataUrl);
      })
      .catch(() => {
        // тихо: заглушка с инициалами
      });
    return () => {
      cancelled = true;
    };
  }, [id, hasImage]);

  return dataUrl;
}
