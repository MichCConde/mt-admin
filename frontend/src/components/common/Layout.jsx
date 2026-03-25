import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const DATE = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-body">
        <header className="app-topbar">
          <span className="app-topbar-date">{DATE}</span>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}