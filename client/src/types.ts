export const STATUSES = ["Open", "In Progress", "Resolved"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const CATEGORIES = ["Account", "Billing", "Technical", "Feature Request", "Other"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];

export interface Ticket {
  id: string;
  subject: string;
  customer: string;
  email: string;
  category: Category;
  priority: Priority;
  status: Status;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewTicket {
  subject: string;
  customer: string;
  email: string;
  category: Category;
  priority: Priority;
  description: string;
}

export type TicketPatch = Partial<Pick<Ticket, "status" | "priority" | "category">>;

export interface TicketFilters {
  q: string;
  status: Status | "All";
  priority: Priority | "All";
  category: Category | "All";
}

export interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  urgentUnresolved: number;
  recent: Ticket[];
}

export interface Health {
  ok: boolean;
  service: string;
  aiEnabled: boolean;
}

export interface ReplySuggestion {
  ticketId: string;
  reply: string;
  source: "ai" | "rule-based";
  label: string;
  model?: string;
  fallbackReason?: string;
  fallbackMessage?: string;
}
