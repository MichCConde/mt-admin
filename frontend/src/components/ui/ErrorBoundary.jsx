import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";

/**
 * ErrorBoundary — catches unhandled render errors in any child tree.
 *
 * Two usage modes:
 *
 *  1. App-level (full-screen fallback, navy background):
 *     <ErrorBoundary level="app">
 *       <Layout />
 *     </ErrorBoundary>
 *
 *  2. Page-level (inline fallback, keeps sidebar alive):
 *     <ErrorBoundary level="page" pageName="Dashboard">
 *       <Dashboard />
 *     </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; swap for a real logger (Sentry etc.) later
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { level = "page", pageName } = this.props;
    const msg = this.state.error?.message ?? "An unexpected error occurred.";

    // ── App-level: full-screen, matches the login/loading screen ──
    if (level === "app") {
      return (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          height: "100vh", background: colors.navy,
          fontFamily: font.family, gap: 24, padding: 32,
        }}>
          <img
            src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
            alt="Monster Task"
            style={{ width: 120, opacity: 0.5 }}
          />
          <div style={{
            background: "rgba(220,38,38,0.12)",
            border: "1.5px solid rgba(220,38,38,0.4)",
            borderRadius: radius.lg, padding: "24px 32px",
            textAlign: "center", maxWidth: 420,
          }}>
            <AlertTriangle size={32} color="#F87171" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 800, color: "#F87171", fontSize: font.lg, marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: font.sm, color: "#94A3B8", lineHeight: 1.6, marginBottom: 20 }}>
              The application encountered an unexpected error. Try reloading the page.
            </div>
            <div style={{
              background: "rgba(0,0,0,0.3)", borderRadius: radius.md,
              padding: "8px 12px", marginBottom: 20,
              fontFamily: "monospace", fontSize: 12, color: "#F87171",
              textAlign: "left", wordBreak: "break-word",
            }}>
              {msg}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: colors.teal, color: "#fff",
                border: "none", borderRadius: radius.md,
                padding: "10px 20px", fontSize: font.base,
                fontWeight: 700, cursor: "pointer",
                fontFamily: font.family,
              }}
            >
              <RefreshCw size={15} />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    // ── Page-level: inline, sidebar stays visible ──────────────────
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        minHeight: 400, padding: 40,
      }}>
        <div style={{
          background: colors.dangerLight,
          border: `1.5px solid ${colors.dangerBorder}`,
          borderRadius: radius.lg, padding: "28px 36px",
          textAlign: "center", maxWidth: 480,
          boxShadow: shadow.card,
        }}>
          <AlertTriangle size={28} color={colors.danger} style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 800, color: colors.danger, fontSize: font.lg, marginBottom: 6 }}>
            {pageName ? `${pageName} failed to load` : "This page crashed"}
          </div>
          <div style={{ fontSize: font.sm, color: colors.textBody, lineHeight: 1.6, marginBottom: 16 }}>
            An unexpected error occurred on this page. The rest of the app is still working.
          </div>
          <div style={{
            background: colors.surfaceAlt, border: `1px solid ${colors.dangerBorder}`,
            borderRadius: radius.md, padding: "8px 12px", marginBottom: 20,
            fontFamily: "monospace", fontSize: 12, color: colors.danger,
            textAlign: "left", wordBreak: "break-word",
          }}>
            {msg}
          </div>
          <button
            onClick={() => this.handleReset()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: colors.danger, color: "#fff",
              border: "none", borderRadius: radius.md,
              padding: "10px 20px", fontSize: font.base,
              fontWeight: 700, cursor: "pointer",
              fontFamily: font.family,
            }}
          >
            <RefreshCw size={15} />
            Try Again
          </button>
        </div>
      </div>
    );
  }
}