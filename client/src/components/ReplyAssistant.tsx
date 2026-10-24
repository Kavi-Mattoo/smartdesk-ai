import { useState } from "react";
import { Bot, Check, Copy, LoaderCircle, Mail, Sparkles } from "lucide-react";
import { errorMessage, suggestReply } from "../api";
import type { ReplySuggestion, Ticket } from "../types";
import { copyText } from "../utils";
import { useToast } from "./Toasts";

export function ReplyAssistant({ ticket, aiEnabled }: { ticket: Ticket; aiEnabled: boolean | null }) {
  const { notify } = useToast();
  const [suggestion, setSuggestion] = useState<ReplySuggestion | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const edited = suggestion !== null && text !== suggestion.reply;

  async function generate() {
    if (edited && !window.confirm("Replace your edits with a new suggestion?")) return;
    setLoading(true);
    setError("");
    try {
      const result = await suggestReply(ticket.id);
      setSuggestion(result);
      setText(result.reply);
    } catch (e) {
      setError(errorMessage(e, "Could not generate a suggestion."));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      notify({ kind: "success", message: "Reply copied to clipboard." });
    } else {
      notify({ kind: "error", message: "Copy failed. Select the text and copy it manually." });
    }
  }

  const mailto = `mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject}`)}&body=${encodeURIComponent(text)}`;

  return (
    <section className="card" aria-labelledby="reply-heading">
      <div className="card-header">
        <h2 id="reply-heading" className="card-title"><Bot size={18} aria-hidden="true" /> Suggested reply</h2>
        {suggestion && (
          <span className={`source-tag ${suggestion.source === "ai" ? "source-ai" : "source-rule"}`}>
            {suggestion.source === "ai" ? <Sparkles size={13} aria-hidden="true" /> : null} {suggestion.label}
          </span>
        )}
      </div>

      {!suggestion && (
        <p className="muted">
          {aiEnabled
            ? "Generate a draft with the server-side AI integration. If the AI provider fails, a rule-based template is used and labelled as such."
            : "AI replies are not configured on this server, so suggestions come from simple rule-based templates (not AI)."}{" "}
          You can edit the draft before using it.
        </p>
      )}

      {suggestion?.fallbackMessage && suggestion.fallbackReason !== "no_api_key" && (
        <div className="alert alert-warning" role="status">{suggestion.fallbackMessage}</div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {suggestion && (
        <div className="field">
          <label htmlFor="reply-text">Draft reply {edited && <span className="edited-tag">edited</span>}</label>
          <textarea id="reply-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="field-hint">Review before sending. SmartDesk does not send emails itself.</p>
        </div>
      )}

      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
          {loading ? "Generating..." : suggestion ? "Regenerate" : "Generate suggested reply"}
        </button>
        {suggestion && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => void copy()} disabled={!text.trim()}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </button>
            <a className="btn btn-secondary" href={mailto}>
              <Mail size={16} aria-hidden="true" /> Open in email app
            </a>
          </>
        )}
      </div>
    </section>
  );
}
