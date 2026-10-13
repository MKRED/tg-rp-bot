import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import { BranchGraph } from "../../shared/graph/BranchGraph";
import { switchBranch, useStoryTree, type StoryTreeNode } from "../../features/narrator";

// Подпись узла по его роли в дереве (kind, а не role — у рассказчика ход пользователя бывает двух видов).
const KIND_LABEL: Record<StoryTreeNode["kind"], string> = {
  beat: "Бит",
  directive: "Режиссёр",
  continue: "Дальше",
};

// «Дальше» хранит служебный маркер, а не прозу — вместо него показываем ярлык.
const describe = (n: StoryTreeNode) => ({
  label: KIND_LABEL[n.kind],
  text: n.kind === "continue" ? "▸ продолжение" : n.content,
  compacted: n.isCompacted,
});

/**
 * Граф веток истории: всё дерево битов, директив и «Дальше». Нажатие переключает ветку: по биту
 * курсор встаёт ровно на узел, по директиве или «Дальше» — на её бит (история заканчивается битом),
 * так можно ответвиться из середины.
 */
export function StoryGraphPage() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const navigate = useTransitionNavigate();
  const { nodes, loading, error } = useStoryTree(storyId);

  const handleSelect = useCallback(
    async (nodeId: number) => {
      await switchBranch(storyId, nodeId);
      navigate(storyViewPath(storyId));
    },
    [storyId, navigate],
  );

  return (
    <FullHeightPage title="Граф веток истории" phase={loading ? "loading" : "ready"}>
      <BranchGraph
        nodes={nodes}
        loading={loading}
        error={error}
        describe={describe}
        onSelect={handleSelect}
        emptyDescription="Ветки появятся, когда история продвинется."
      />
    </FullHeightPage>
  );
}
