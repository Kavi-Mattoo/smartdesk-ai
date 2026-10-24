import type { Priority, Status } from "../types";
import { slug } from "../utils";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge status-${slug(status)}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${slug(priority)}`}>{priority}</span>;
}
