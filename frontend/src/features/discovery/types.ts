export interface Topic {
  id: string;
  name: string;
  kind: "ENTITY" | "TOPIC";
  articles: number;
}
export interface ArticleFilter {
  q?: string;
  location?: string;
  category?: string;
  days?: number;
  topicIds?: string[];
  watchedSourceIds?: string[];
  keywords?: string[];
  articleIds?: string[];
  collectedAfter?: string;
  storyId?: string;
}
export interface ReadingScope {
  sourceId: string;
  language: string;
  days: number;
  filter?: ArticleFilter;
  label?: string;
}
export interface SavedSearch {
  id: string;
  name: string;
  scope: ReadingScope;
}
export interface Watchlist {
  id: string;
  name: string;
  topicIds: string[];
  watchedSourceIds: string[];
  keywords: string[];
  seenAt: string;
}
export function watchScope(watch: Watchlist, onlyNew = false): ReadingScope {
  return {
    sourceId: "",
    language: "",
    days: 0,
    label: watch.name,
    filter: {
      topicIds: watch.topicIds,
      watchedSourceIds: watch.watchedSourceIds,
      keywords: watch.keywords,
      ...(onlyNew ? { collectedAfter: watch.seenAt } : {}),
    },
  };
}
export function scopeParams(scope: ReadingScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.sourceId) params.set("sourceId", scope.sourceId);
  if (scope.language) params.set("language", scope.language);
  for (const [key, value] of Object.entries({
    ...scope.filter,
    days: scope.days,
  })) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined && value !== "")
      params.set(key, String(value));
  }
  return params;
}
export function describeScope(scope: ReadingScope): string {
  const f = scope.filter;
  return [
    scope.label,
    f?.q,
    f?.location,
    scope.days ? `${scope.days} ngày gần nhất` : "Mọi thời điểm",
    f?.topicIds?.join(", "),
    f?.keywords?.join(", "),
    f?.watchedSourceIds?.length
      ? `${f.watchedSourceIds.length} nguồn theo dõi`
      : "",
    f?.articleIds?.length ? `${f.articleIds.length} bài đã chọn` : "",
    f?.storyId ? "Story đã chọn" : "",
    f?.category,
    scope.language,
    scope.sourceId ? "Nguồn đã chọn" : "",
    f?.collectedAfter ? "Tin thu thập mới" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface Story {
  id: string;
  lead: import("../../shared/types").Article;
  matchingArticles: number;
  totalArticles: number;
  sources: number;
  lastCollectedAt: string;
  clustered: boolean;
}
