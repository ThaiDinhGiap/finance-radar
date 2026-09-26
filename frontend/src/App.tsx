import { PersonalFeedView } from "./features/discovery/PersonalFeedView";
import { EntityGraphView } from "./features/discovery/EntityGraphView";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  RefreshCw,
  Newspaper,
  MessageSquare,
  Radio,
  History,
  Radar,
  Activity,
  Database,
  ChevronRight,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { useResource } from "./shared/useResource";
import { type Source, type Stats } from "./shared/types";
import { ArticlesView } from "./features/articles/ArticlesView";
import { SourcesView } from "./features/sources/SourcesView";
import { ChatView } from "./features/chat/ChatView";
import { RunsView } from "./features/runs/RunsView";
import { TimelineView } from "./features/insights/TimelineView";
import { DigestView } from "./features/insights/DigestView";
import { OperationsView } from "./features/insights/OperationsView";
import { AlertsView } from "./features/insights/AlertsView";
import { useAlerts } from "./features/insights/useAlerts";
import { useLibrary } from "./features/discovery/useLibrary";
import type { ReadingScope } from "./features/discovery/types";
const navigation = [
  { id: "articles", label: "Dòng thông tin", icon: Newspaper },
  { id: "personal", label: "Dành cho bạn", icon: Newspaper },
  { id: "entities", label: "Entity Graph", icon: Activity },
  { id: "chat", label: "AI đọc tin", icon: MessageSquare },
  { id: "timeline", label: "Timeline", icon: History },
  { id: "digest", label: "Daily Digest", icon: Newspaper },
  { id: "alerts", label: "Thông báo", icon: Activity },
  { id: "operations", label: "Vận hành", icon: Database },
  { id: "sources", label: "Nguồn dữ liệu", icon: Radio },
  { id: "runs", label: "Nhật ký thu thập", icon: History },
] as const;
type View = (typeof navigation)[number]["id"];
function currentView(): View {
  return (
    navigation.find((item) => `#${item.id}` === window.location.hash)?.id ??
    "articles"
  );
}
export default function App() {
  const library = useLibrary();
  const alerts = useAlerts(library.watches);
  const [timelineScope, setTimelineScope] = useState<{
    value?: ReadingScope;
    version: number;
  }>({ version: 0 });
  const [view, setView] = useState<View>(currentView);
  const [chatScope, setChatScope] = useState<{
    value?: ReadingScope;
    version: number;
  }>({ version: 0 });
  const [revision, setRevision] = useState(0);
  const sources = useResource<Source[]>("/sources", revision, 10000);
  const stats = useResource<Stats>("/stats", revision, 10000);
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    const navigate = () => {
      const next = navigation.find(
        (item) => `#${item.id}` === window.location.hash,
      );
      if (next) {
        setView(next.id);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  function navigate(next: View) {
    window.location.hash = next;
    setView(next);
    window.scrollTo({ top: 0 });
  }
  function openTimeline(scope: ReadingScope) {
    setTimelineScope((v) => ({ value: scope, version: v.version + 1 }));
    navigate("timeline");
  }
  function openChat(scope: ReadingScope) {
    setChatScope((v) => ({ value: scope, version: v.version + 1 }));
    navigate("chat");
  }
  const active = navigation.find((item) => item.id === view)!;
  useEffect(() => {
    document.title = `${active.label} · Finance Radar`;
  }, [active.label]);
  const today = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <aside className="app-sidebar" aria-label="Không gian Finance Radar">
        <a
          className="brand"
          href="#articles"
          aria-label="Finance Radar — dòng thông tin"
        >
          <span className="brand-symbol">
            <Radar size={25} />
          </span>
          <span>
            Finance Radar<small>KHÔNG GIAN ĐỌC TIN</small>
          </span>
        </a>
        <nav aria-label="Điều hướng chính">
          <span className="nav-caption">KHÁM PHÁ</span>
          {navigation.map(({ id, label, icon: Icon }) => (
            <div key={id}>
              {id === "operations" && (
                <span className="nav-caption operations-label">QUẢN LÝ</span>
              )}
              <a
                className={`nav-item ${view === id ? "active" : ""}`}
                aria-current={view === id ? "page" : undefined}
                href={`#${id}`}
              >
                <Icon size={18} />
                <span>
                  {label}
                  {id === "alerts" && alerts.notices.some((n) => !n.read)
                    ? ` (${alerts.notices.filter((n) => !n.read).length})`
                    : ""}
                </span>
                {view === id && <ChevronRight size={14} />}
              </a>
            </div>
          ))}
        </nav>
        <div className="sidebar-note">
          <Radar size={22} aria-hidden="true" />
          <strong>Mỗi nguồn, một góc nhìn.</strong>
          <p>Đọc và đối chiếu bài gốc để hiểu đầy đủ bối cảnh.</p>
        </div>
        <div className="sidebar-footer">
          <span className="workspace-avatar">FR</span>
          <div>
            <strong>Không gian cá nhân</strong>
            <small>Việt Nam & quốc tế</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div className="breadcrumb">
            <span>Không gian làm việc</span>
            <ChevronRight size={14} />
            <strong>{active.label}</strong>
          </div>
          <div className="header-actions">
            <time>{today}</time>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={sources.loading || stats.loading}
              className="refresh-button"
            >
              <RefreshCw
                size={15}
                className={sources.loading || stats.loading ? "spin" : ""}
              />
              <span>Làm mới</span>
            </Button>
          </div>
        </header>
        <div className="workspace-body">
          <div
            className="overview"
            hidden={view !== "articles" && view !== "sources"}
            aria-label="Tổng quan dữ liệu"
          >
            <div>
              <span>
                <Newspaper size={16} />
                Bài viết trong kho
              </span>
              <strong>
                {stats.data?.articles.toLocaleString("vi-VN") ?? "—"}
              </strong>
              <small>Toàn bộ tin đã thu thập</small>
            </div>
            <div>
              <span>
                <Radio size={16} />
                Nguồn đã bật
              </span>
              <strong>
                {stats.data?.enabledSources ?? "—"}
                <small>/ {stats.data?.sources ?? "—"}</small>
              </strong>
              <small>Thu thập theo lịch riêng</small>
            </div>
            <div>
              <span>
                <Activity size={16} />
                Đang xử lý
              </span>
              <strong>
                {stats.data?.runningSources ?? "—"}
                <small>nguồn</small>
              </strong>
              <small>Đang chờ hoặc đang chạy</small>
            </div>
            <button onClick={() => navigate("sources")}>
              <span>
                <Database size={16} />
                Cần kiểm tra
                <ArrowUpRight size={14} />
              </span>
              <strong
                className={stats.data?.failingSources ? "warning-text" : ""}
              >
                {stats.data?.failingSources ?? "—"}
                <small>nguồn</small>
              </strong>
              <small>Xem trạng thái nguồn</small>
            </button>
          </div>
          <main id="main-content" tabIndex={-1}>
            {(sources.error || stats.error) && (
              <div className="error-box" role="alert">
                {sources.error || stats.error}{" "}
                <button className="link-button" onClick={refresh}>
                  Thử lại
                </button>
              </div>
            )}
            {view === "articles" && (
              <ArticlesView
                sources={sources.data ?? []}
                revision={revision}
                openChat={(scope) => {
                  if (scope)
                    setChatScope((c) => ({
                      value: scope,
                      version: c.version + 1,
                    }));
                  navigate("chat");
                }}
                openTimeline={openTimeline}
                openSources={() => navigate("sources")}
              />
            )}
            {view === "sources" && (
              <SourcesView
                sources={sources.data ?? []}
                loading={sources.loading}
                error={sources.error}
                refresh={refresh}
              />
            )}
            {view === "timeline" && (
              <TimelineView
                key={timelineScope.version}
                initialScope={timelineScope.value}
                revision={revision}
              />
            )}
            {view === "digest" && (
              <DigestView
                revision={revision}
                openTimeline={openTimeline}
                openChat={openChat}
              />
            )}
            {view === "alerts" && (
              <AlertsView watches={library.watches} alerts={alerts} />
            )}
            {view === "personal" && (
              <PersonalFeedView
                revision={revision}
                openChat={openChat}
                openTimeline={openTimeline}
              />
            )}
            {view === "entities" && <EntityGraphView revision={revision} />}
            {view === "operations" && <OperationsView revision={revision} />}
            {view === "runs" && <RunsView revision={revision} />}
            <div hidden={view !== "chat"}>
              <ChatView
                key={chatScope.version}
                initialScope={chatScope.value}
                sources={sources.data ?? []}
                revision={revision}
              />
            </div>
          </main>
          <footer className="page-footer">
            <span>Finance Radar</span>
            <p>Dữ liệu công khai · Luôn đối chiếu bài gốc</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
