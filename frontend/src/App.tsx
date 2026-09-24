import { useState } from "react";
import {
  ArrowUpRight,
  RefreshCw,
  Newspaper,
  MessageSquare,
  Radio,
  History,
} from "lucide-react";
import { useResource } from "./shared/useResource";
import { type Source, type Stats } from "./shared/types";
import { ArticlesView } from "./features/articles/ArticlesView";
import { SourcesView } from "./features/sources/SourcesView";
import { ChatView } from "./features/chat/ChatView";
import { RunsView } from "./features/runs/RunsView";
const navigation = [
  { id: "articles", label: "Dòng thông tin", icon: Newspaper },
  { id: "chat", label: "AI đọc tin", icon: MessageSquare },
  { id: "sources", label: "Nguồn dữ liệu", icon: Radio },
  { id: "runs", label: "Nhật ký thu thập", icon: History },
] as const;
type View = (typeof navigation)[number]["id"];
export default function App() {
  const [view, setView] = useState<View>("articles");
  const [revision, setRevision] = useState(0);
  const sources = useResource<Source[]>("/sources", revision, 10000);
  const stats = useResource<Stats>("/stats", revision, 10000);
  const refresh = () => setRevision((v) => v + 1);
  const today = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="publication-header">
        <div className="utility-bar">
          <span>KINH TẾ · TÀI CHÍNH · GÓC NHÌN</span>
          <span>Việt Nam & thế giới</span>
        </div>
        <div className="masthead">
          <div className="masthead-edition">
            <span className="eyebrow">BẢN TIN CỦA BẠN</span>
            <time>{today}</time>
          </div>
          <button
            className="brand"
            onClick={() => setView("articles")}
            aria-label="Finance Radar — về dòng thông tin"
          >
            <span>
              Finance<span className="brand-accent">Radar</span>
              <span className="brand-stop">.</span>
            </span>
            <small>THÔNG TIN ĐỂ HIỂU THỊ TRƯỜNG</small>
          </button>
          <button
            className="button primary masthead-cta"
            onClick={() => setView("chat")}
          >
            Khám phá cùng AI <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="navigation-bar">
          <nav aria-label="Điều hướng chính">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${view === id ? "active" : ""}`}
                aria-current={view === id ? "page" : undefined}
                onClick={() => setView(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
          <button
            className="refresh-button"
            onClick={refresh}
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
        </div>
      </header>
      <div className="overview" aria-label="Tổng quan dữ liệu">
        <div>
          <span>BÀI VIẾT</span>
          <strong>{stats.data?.articles.toLocaleString("vi-VN") ?? "—"}</strong>
        </div>
        <div>
          <span>NGUỒN ĐÃ BẬT</span>
          <strong>
            {stats.data
              ? `${stats.data.enabledSources} / ${stats.data.sources}`
              : "—"}
          </strong>
        </div>
        <div>
          <span>ĐANG XỬ LÝ</span>
          <strong>
            {stats.data?.runningSources ?? "—"}
            <small>nguồn</small>
          </strong>
        </div>
        <button onClick={() => setView("sources")}>
          <span>CẦN KIỂM TRA</span>
          <strong className={stats.data?.failingSources ? "warning-text" : ""}>
            {stats.data?.failingSources ?? "—"}
            <small>nguồn</small>
            <ArrowUpRight size={14} />
          </strong>
        </button>
      </div>
      <main id="main-content" tabIndex={-1}>
        {(sources.error || stats.error) && (
          <div className="error-box" role="alert">
            {sources.error || stats.error}{" "}
            <button className="text-button" onClick={refresh}>
              Thử lại
            </button>
          </div>
        )}
        {view === "articles" && (
          <ArticlesView
            sources={sources.data ?? []}
            revision={revision}
            openChat={() => setView("chat")}
            openSources={() => setView("sources")}
          />
        )}
        {view === "sources" && (
          <SourcesView sources={sources.data ?? []} refresh={refresh} />
        )}
        {view === "runs" && <RunsView revision={revision} />}
        <div hidden={view !== "chat"}>
          <ChatView sources={sources.data ?? []} revision={revision} />
        </div>
      </main>
      <footer className="page-footer">
        <div>
          <span className="footer-brand">
            FinanceRadar<span>.</span>
          </span>
          <p>Thông tin để hiểu thị trường.</p>
        </div>
        <p>
          Dữ liệu từ nguồn công khai.
          <br />
          Đọc, đối chiếu và luôn tham khảo bài gốc.
        </p>
        <button
          className="text-button"
          onClick={() => {
            setView("sources");
            window.scrollTo({ top: 0 });
          }}
        >
          Khám phá nguồn tin <ArrowUpRight size={15} />
        </button>
      </footer>
    </div>
  );
}
