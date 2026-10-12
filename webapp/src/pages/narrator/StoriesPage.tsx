import { Clapperboard } from "lucide-react";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { InfiniteSentinel } from "../../shared/components/InfiniteSentinel";
import { ListPage } from "../../shared/components/ListPage";
import { StoryRow, useStories } from "../../features/narrator";

/**
 * Хаб «Режиссёр истории»: все истории и создание новой. Лимита на пользователя нет — список
 * подгружается страницами по мере прокрутки (по 10: у каждой строки догружаются аватары книги).
 */
export function StoriesPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, loadingMore, error, loadMoreError, hasMore, loadMore } = useStories();

  return (
    <ListPage
      title="Режиссёр истории"
      description="ИИ ведёт историю, вы направляете её директивами"
      icon={Clapperboard}
      loading={loading}
      error={error}
      count={items.length}
      createLabel="Новая история"
      emptyTitle="Историй пока нет"
      emptyDescription="Выберите книгу знаний, шаблон рассказчика и пресет — и задайте начало истории."
      onCreate={() => navigate(ROUTES.storyNew)}
      footer={<InfiniteSentinel hasMore={hasMore} loading={loadingMore} error={loadMoreError} onLoadMore={loadMore} />}
    >
      {items.map((story, i) => (
        <StoryRow key={story.id} story={story} index={i} onClick={() => navigate(storyViewPath(story.id))} />
      ))}
    </ListPage>
  );
}
