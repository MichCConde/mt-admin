import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Spinner } from "./ui/Indicators";
import Layout from "./components/common/Layout";

import Dashboard         from "./pages/Dashboard";
import VirtualAssistants from "./pages/VirtualAssistants";
import Schedule          from "./pages/Schedule";
import EOWReports        from "./pages/EowReports";   // ← matches actual filename
import ActivityLogs      from "./pages/ActivityLogs";
import Login             from "./pages/Login";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index              element={<Dashboard />} />
          <Route path="vas"         element={<VirtualAssistants />} />
          <Route path="schedule"    element={<Schedule />} />
          <Route path="eow"         element={<EOWReports />} />
          <Route path="activity"    element={<ActivityLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}