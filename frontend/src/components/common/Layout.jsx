import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <div className="app-topbar">
          <span className="app-topbar-date">{today}</span>
        </div>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}