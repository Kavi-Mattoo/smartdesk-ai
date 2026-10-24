import type { ReactNode } from "react";
import { CheckCircle2, Clock3, Headphones, Inbox, LayoutDashboard, Plus, Ticket } from "lucide-react";
import type { Route } from "../hooks/useRoute";

interface LinkDef {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}

export function Sidebar({ route, open, onNewTicket, onNavigate }: { route: Route; open: boolean; onNewTicket: () => void; onNavigate: () => void }) {
  const search = route.name === "tickets" ? new URLSearchParams(route.search) : null;
  const onTickets = route.name === "tickets";
  const hasFilters = Boolean(search && (search.get("status") || search.get("priority") || search.get("category") || search.get("q")));
  const quickStatus = search?.get("status");

  const main: LinkDef[] = [
    { href: "#/", label: "Dashboard", icon: <LayoutDashboard size={18} aria-hidden="true" />, active: route.name === "dashboard" },
    { href: "#/tickets", label: "All tickets", icon: <Ticket size={18} aria-hidden="true" />, active: (onTickets && !hasFilters) || route.name === "ticket" }
  ];
  const quick: LinkDef[] = [
    { href: "#/tickets?status=Open", label: "Open", icon: <Inbox size={18} aria-hidden="true" />, active: quickStatus === "Open" },
    { href: "#/tickets?status=In%20Progress", label: "In progress", icon: <Clock3 size={18} aria-hidden="true" />, active: quickStatus === "In Progress" },
    { href: "#/tickets?status=Resolved", label: "Resolved", icon: <CheckCircle2 size={18} aria-hidden="true" />, active: quickStatus === "Resolved" }
  ];

  const renderLink = (link: LinkDef) => (
    <li key={link.href}>
      <a href={link.href} className={`nav-link${link.active ? " active" : ""}`} aria-current={link.active ? "page" : undefined} onClick={onNavigate}>
        {link.icon} {link.label}
      </a>
    </li>
  );

  return (
    <aside id="sidebar" className={`sidebar${open ? " open" : ""}`} aria-label="Primary">
      <a href="#/" className="brand" onClick={onNavigate}>
        <span className="brand-mark"><Headphones size={20} aria-hidden="true" /></span>
        <span className="brand-text">SmartDesk <span>AI</span></span>
      </a>
      <button type="button" className="btn btn-primary sidebar-cta" onClick={() => { onNavigate(); onNewTicket(); }}>
        <Plus size={16} aria-hidden="true" /> New ticket
      </button>
      <nav aria-label="Main navigation">
        <ul className="nav-list">{main.map(renderLink)}</ul>
        <p className="nav-heading">Quick views</p>
        <ul className="nav-list">{quick.map(renderLink)}</ul>
      </nav>
      <p className="sidebar-footer">Demo workspace. Data is stored in a local JSON file.</p>
    </aside>
  );
}
