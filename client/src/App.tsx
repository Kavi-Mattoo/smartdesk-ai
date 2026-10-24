import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, Plus, Sparkles } from "lucide-react";
import { CreateTicketModal } from "./components/CreateTicketModal";
import { Sidebar } from "./components/Sidebar";
import { useToast } from "./components/Toasts";
import { ticketHref, useRoute } from "./hooks/useRoute";
import type { Route } from "./hooks/useRoute";
import { useHealth } from "./hooks/useHealth";
import DashboardPage from "./pages/DashboardPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import TicketsPage from "./pages/TicketsPage";
import type { Ticket } from "./types";

function pageTitle(route: Route): string {
  switch (route.name) {
    case "dashboard": return "Dashboard";
    case "tickets": return "Tickets";
    case "ticket": return `Ticket ${route.id}`;
    default: return "Page not found";
  }
}

export default function App() {
  const route = useRoute();
  const { notify } = useToast();
  const { status: apiStatus, health } = useHealth();
  const [version, setVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const title = pageTitle(route);

  useEffect(() => {
    document.title = `${title} | SmartDesk AI`;
    setNavOpen(false);
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [route, title]);

  function handleCreated(ticket: Ticket) {
    setCreateOpen(false);
    bump();
    notify({ kind: "success", message: `Ticket ${ticket.id} created.`, href: ticketHref(ticket.id), linkLabel: "View ticket" });
  }

  return (
    <div className="app">
      <button type="button" className="skip-link" onClick={() => mainRef.current?.focus()}>Skip to main content</button>

      <Sidebar route={route} open={navOpen} onNewTicket={() => setCreateOpen(true)} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="app-body">
        <header className="topbar">
          <button type="button" className="icon-button menu-button" aria-label="Open navigation" aria-expanded={navOpen} aria-controls="sidebar" onClick={() => setNavOpen((o) => !o)}>
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-actions">
            <span className={`pill pill-${apiStatus}`} role="status">
              <span className="pill-dot" aria-hidden="true" />
              {apiStatus === "online" ? "API online" : apiStatus === "offline" ? "API offline" : "Checking API"}
            </span>
            {health && (
              <span className={`pill pill-ai${health.aiEnabled ? " on" : ""} hide-small`} title={health.aiEnabled ? "Server-side AI replies are configured" : "No API key configured; replies use rule-based templates"}>
                <Sparkles size={13} aria-hidden="true" /> {health.aiEnabled ? "AI replies on" : "Rule-based replies"}
              </span>
            )}
            <button type="button" className="btn btn-primary" aria-label="New ticket" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" /> <span className="hide-small" aria-hidden="true">New ticket</span>
            </button>
          </div>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="main">
          {apiStatus === "offline" && (
            <div className="alert alert-error" role="alert">
              The API server is not reachable. Start it with <code>npm run dev</code> from the project root, then refresh.
            </div>
          )}
          {route.name === "dashboard" && <DashboardPage version={version} onCreate={() => setCreateOpen(true)} />}
          {route.name === "tickets" && <TicketsPage version={version} search={route.search} onCreate={() => setCreateOpen(true)} />}
          {route.name === "ticket" && <TicketDetailPage id={route.id} aiEnabled={health ? health.aiEnabled : null} onChanged={bump} />}
          {route.name === "notfound" && (
            <div className="state">
              <strong>Page not found</strong>
              <a className="btn btn-secondary" href="#/">Go to dashboard</a>
            </div>
          )}
        </main>
      </div>

      {createOpen && <CreateTicketModal onClose={() => setCreateOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}
