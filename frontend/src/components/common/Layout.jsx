import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { colors } from "../../styles/tokens";

export default function Layout() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={styles.layout}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.topBar}>
          <span style={styles.dateLabel}>{today}</span>
        </div>
        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: colors.pageBg,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  topBar: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "14px 28px",
    borderBottom: `1px solid ${colors.border}`,
    background: colors.cardBg,
  },
  dateLabel: {
    fontSize: "13px",
    color: colors.textSecondary,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    padding: "28px",
    overflowY: "auto",
  },
};