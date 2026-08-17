import React from "react";
import { T, css, font, display } from "./styles";

/* SEC-11: dedicated guest-flow status/error screen. Never shows an
   invite-code text input — guests must not see the resident invite path. */
export function GuestEnrollment({ buildingName, state, errorCode, onRetry, onSignOut }) {
  const label = buildingName ? ` ${buildingName}` : "";
  const messages = {
    preparing:  `Preparing${label} events…`,
    enrolling: "Creating family access…",
    opening:   "Opening the shared event…",
  };
  const errorMessages = {
    INVALID_GUEST_INVITE:  "This family invitation is invalid.",
    GUEST_INVITE_EXPIRED:  "This family invitation has expired.",
    GUEST_INVITE_REVOKED:  "This family invitation has been revoked.",
    GUEST_INVITE_EXHAUSTED: "This family invitation has reached its usage limit.",
    SECTION_NOT_ALLOWED:   "This invitation does not allow access to this section.",
    EVENT_NOT_ALLOWED:     "This invitation does not allow access to this event.",
    BUILDING_NOT_FOUND:    "The shared building is no longer available.",
    USER_PROFILE_NOT_FOUND: "Please sign in again before opening the family link.",
    UNAUTHENTICATED:       "Please sign in again before opening the family link.",
    NETWORK_ERROR:         "Network error. Please try again.",
    INTERNAL:              "Could not create family access. Please ask the sender for a new link.",
  };

  const isError = state === "error";
  const showRetry = isError && ["NETWORK_ERROR", "INTERNAL"].includes(errorCode);
  const title = isError ? "Couldn't open shared content" : (messages[state] || messages.preparing);
  const body = isError ? (errorMessages[errorCode] || errorMessages.INTERNAL) : null;

  return (
    <div style={W.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css + SPIN_CSS }} />
      <div style={W.card}>
        {isError ? (
          <div style={{ fontSize: 30, marginBottom: 12 }}>⚠️</div>
        ) : (
          <div style={W.spinner} aria-hidden="true" />
        )}
        <h1 style={W.title}>{title}</h1>
        {body && <p style={W.body}>{body}</p>}
        {showRetry && onRetry && (
          <button className="primaryBtn" onClick={onRetry} style={W.primary}>
            Try again
          </button>
        )}
        {isError && onSignOut && (
          <button onClick={onSignOut} style={W.link}>Sign out</button>
        )}
      </div>
    </div>
  );
}

/* SEC-11: legacy Events links (pre-SEC-11) may still be shared without a
   guest token. We do NOT silently enroll or show the resident invite-code
   input. Instead: an explicit "ask for a new link" message. */
export function IncompleteEventLink({ buildingName, onSignOut }) {
  return (
    <div style={W.wrap}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={W.card}>
        <div style={{ fontSize: 30, marginBottom: 12 }}>🔒</div>
        <h1 style={W.title}>This Events link needs a fresh family invitation</h1>
        <p style={W.body}>
          {buildingName ? `The event lives inside ${buildingName}.` : ""} Ask
          the sender to open Nivasa and share the event again — new links
          include a secure family invitation and open the exact event for you.
        </p>
        {onSignOut && (
          <button onClick={onSignOut} style={W.link}>Sign out</button>
        )}
      </div>
    </div>
  );
}

const SPIN_CSS = "@keyframes nvSpin { to { transform: rotate(360deg); } }";

const W = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: font, padding: 20 },
  card: { background: "#fff", borderRadius: 16, padding: "32px 28px", width: "min(400px, 100%)", border: `1px solid ${T.line}`, boxShadow: "0 8px 40px rgba(20,36,43,.06)", textAlign: "center" },
  title: { fontFamily: display, fontWeight: 700, fontSize: 20, color: T.ink, margin: "8px 0 10px", lineHeight: 1.3 },
  body: { fontSize: 13.5, color: T.inkSoft, margin: "0 0 20px", lineHeight: 1.5 },
  primary: { width: "100%", padding: "12px", marginBottom: 10 },
  link: { background: "none", border: "none", color: T.inkSoft, fontSize: 13, cursor: "pointer", fontFamily: font, marginTop: 6 },
  spinner: {
    width: 32, height: 32, borderRadius: "50%",
    border: `3px solid ${T.line}`, borderTopColor: T.water,
    margin: "4px auto 8px", animation: "nvSpin 0.9s linear infinite",
  },
};
