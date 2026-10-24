import { useEffect, useState } from "react";

export type Route =
  | { name: "dashboard" }
  | { name: "tickets"; search: string }
  | { name: "ticket"; id: string }
  | { name: "notfound" };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const questionMark = raw.indexOf("?");
  const pathPart = questionMark === -1 ? raw : raw.slice(0, questionMark);
  const search = questionMark === -1 ? "" : raw.slice(questionMark + 1);
  const parts = pathPart.split("/").filter(Boolean);

  if (parts.length === 0) return { name: "dashboard" };
  if (parts[0] === "tickets" && parts.length === 1) return { name: "tickets", search };
  if (parts[0] === "tickets" && parts.length === 2) {
    try {
      return { name: "ticket", id: decodeURIComponent(parts[1]) };
    } catch {
      return { name: "notfound" };
    }
  }
  return { name: "notfound" };
}

export const ticketHref = (id: string) => `#/tickets/${encodeURIComponent(id)}`;

export function navigate(hash: string) {
  window.location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
