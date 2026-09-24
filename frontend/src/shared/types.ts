export type Kind = "RSS" | "HTML" | "MASTODON";
export type Category = "NEWS" | "INSTITUTION" | "FORUM" | "SOCIAL";
export interface Source {
  id: string;
  name: string;
  url: string;
  kind: Kind;
  category: Category;
  language: string;
  region: string;
  enabled: boolean;
  intervalMinutes: number;
  itemSelector: string | null;
  titleSelector: string | null;
  linkSelector: string | null;
  summarySelector: string | null;
  activeRunId: string | null;
  nextRunAt: string;
  lastSuccessAt: string | null;
  failures: number;
}
export interface Article {
  id: string;
  sourceId: string;
  sourceName: string;
  language: string;
  region: string;
  category: Category;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  collectedAt: string;
}
export interface CrawlRun {
  id: string;
  sourceId: string;
  sourceName: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  fetched: number;
  inserted: number;
  rejected: number;
  message: string | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
export interface Stats {
  articles: number;
  sources: number;
  enabledSources: number;
  runningSources: number;
  failingSources: number;
}
export const categories: Record<Category, string> = {
  NEWS: "Báo chí",
  INSTITUTION: "Tổ chức kinh tế",
  FORUM: "Diễn đàn",
  SOCIAL: "Mạng xã hội",
};
export const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Chưa có";
