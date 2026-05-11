import { RefreshCw } from "lucide-react";
import { colors, font } from "../../styles/tokens";
import { cacheTimeLeft } from "../../utils/reportCache";
import TopBarPortal from "./TopBarPortal";

export default function TopBarCachedBanner({ cacheKey, onRefresh, loading }) {
  const mins = cacheTimeLeft(cacheKey);
  if (!mins) return null;

  return (
    <TopBarPortal>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        fontFamily: font.family,
      }}>
        <span style={{
          fontSize: font.sm,
          color: colors.textMuted,
          fontWeight: 500,
        }}>
          Cached · expires in {mins}m
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: colors.surfaceAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: "3px 10px",
            cursor: loading ? "default" : "pointer",
            color: colors.textBody,
            fontWeight: 600,
            fontSize: 12,
            display: "inline-flex", alignItems: "center", gap: 5,
            opacity: loading ? 0.5 : 1,
            transition: "background .12s, border-color .12s",
            fontFamily: font.family,
          }}
          onMouseEnter={e => {
            if (!loading) {
              e.currentTarget.style.background = colors.border;
              e.currentTarget.style.borderColor = colors.textFaint;
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = colors.surfaceAlt;
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <RefreshCw size={11} />
          Refresh
        </button>
      </div>
    </TopBarPortal>
  );
}