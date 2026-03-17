import { useState } from "react";
import {
  Search, Copy, Check, Clock, ClipboardList,
  Users, FileCheck, UserX, CheckCircle2, AlertTriangle, Timer,
} from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";
import Button from "../ui/Button";
import StatCard from "../ui/StatCard";
import DataTable from "../ui/DataTable";
import StatusBox from "../ui/StatusBox";
import Card, { SectionLabel } from "../ui/Card";
import { CommunityBadge, StatusBadge } from "../ui/Badge";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

const fmtDateLong = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

// ── Root ─────────────────────────────────────────────────────────
export default function VAReports() {
  const [activeTab, setActiveTab] = useState("eod");

  const TABS = [
    { id: "eod",        Icon: ClipboardList, label: "EOD Reports" },
    { id: "attendance", Icon: Clock,         label: "Attendance"  },
  ];

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: font.h2, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
          VA Reports
        </h2>
        <p style={{ fontSize: font.base, color: colors.textMuted, marginTop: 6 }}>
          Monitor daily EOD submissions and attendance records.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: `2px solid ${colors.border}`, marginBottom: 32 }}>
        {TABS.map(({ id, Icon, label }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", border: "none", background: "transparent",
              fontSize: font.base, fontWeight: active ? 700 : 500,
              color: active ? colors.teal : colors.textMuted,
              cursor: "pointer",
              borderBottom: `2px solid ${active ? colors.teal : "transparent"}`,
              marginBottom: -2, fontFamily: font.family,
            }}>
              <Icon size={14} strokeWidth={active ? 2.5 : 2} />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "eod"        && <EODChecker />}
      {activeTab === "attendance" && <AttendanceChecker />}
    </div>
  );
}

// ── EOD Checker ───────────────────────────────────────────────────
function EODChecker() {
  const [date,    setDate]    = useState(yesterday());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);

  async function runCheck() {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch(`${API}/api/eod?date=${date}`);
      if (!res.ok) throw new Error((await res.json()).detail ?? "Request failed");
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copyNotification() {
    if (!data?.missing?.length) return;
    const lines = [
      `Hi team — EOD reminder for ${fmtDateLong(date)}:`,
      "",
      `The following VA${data.missing.length !== 1 ? "s have" : " has"} not yet submitted their EOD report:`,
      "",
      ...data.missing.map((va) => {
        const client = va.missing_client ? ` — Client: ${va.missing_client}` : "";
        return `- ${va.name} [${va.community ?? "?"}]${client}`;
      }),
      "",
      "Please submit as soon as possible. Thank you.",
    ].join("\n");
    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DateBar date={date} setDate={setDate} onCheck={runCheck} loading={loading} />
      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard icon={Users}      label="Active VAs"    value={data.active_va_count}  />
            <StatCard icon={Clock}      label="Clocked In"    value={data.clocked_in_count} />
            <StatCard icon={FileCheck}  label="EOD Submitted" value={data.submitted_count}  />
            <StatCard
              icon={data.missing_count > 0 ? UserX : CheckCircle2}
              label="Missing"
              value={data.missing_count}
              highlight={data.missing_count > 0 ? "danger" : "success"}
            />
            <StatCard
              icon={Timer}
              label="Late Submissions"
              value={data.late_count}
              highlight={data.late_count > 0 ? "warning" : "success"}
            />
          </div>

          {/* Missing reports */}
          {data.missing.length > 0 ? (
            <Card
              title={`${data.missing.length} Missing EOD Report${data.missing.length !== 1 ? "s" : ""}`}
              action={
                <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyNotification}>
                  {copied ? "Copied" : "Copy Notification"}
                </Button>
              }
              noPadding
            >
              {data.missing.map((va, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.dangerBorder}` : "none",
                  background: i % 2 === 0 ? colors.dangerLight : "#FFF8F8",
                }}>
                  <CommunityBadge community={va.community} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                      {va.name}
                    </span>
                    {va.missing_client && (
                      <span style={{ fontSize: font.sm, color: colors.textMuted, marginLeft: 8 }}>
                        Client: {va.missing_client}
                      </span>
                    )}
                  </div>
                  <StatusBadge variant={va.clocked_in ? "warning" : "neutral"}>
                    {va.clocked_in ? "Clocked in, no EOD" : "No clock-in or EOD"}
                  </StatusBadge>
                </div>
              ))}
            </Card>
          ) : (
            <StatusBox variant="success">All VAs submitted their EOD reports.</StatusBox>
          )}

          {/* Late submissions */}
          {data.late_submissions?.length > 0 && (
            <Card title={`Late Submissions (${data.late_submissions.length})`} noPadding>
              {data.late_submissions.map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.warningBorder}` : "none",
                  background: i % 2 === 0 ? colors.warningLight : "#FFFDF0",
                }}>
                  <CommunityBadge community={r.community} />
                  <span style={{ fontWeight: 600, flex: 1, fontSize: font.base }}>{r.name}</span>
                  {r.client && (
                    <span style={{ fontSize: font.sm, color: colors.textMuted }}>
                      {r.client}
                    </span>
                  )}
                  <StatusBadge variant="warning">
                    {r.punctuality.submitted_est} — {r.punctuality.minutes_late}m late
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {/* Submissions table */}
          {data.eod_submissions.length > 0 && (
            <div>
              <SectionLabel>Submitted ({data.eod_submissions.length})</SectionLabel>
              <DataTable
                columns={[
                  { label: "Name",      flex: 2 },
                  { label: "Community", flex: 1 },
                  { label: "Client",    flex: 2 },
                  { label: "Submitted", flex: 1 },
                  { label: "Status",    flex: 1 },
                ]}
                rows={data.eod_submissions.map((r) => [
                  <span style={{ fontWeight: 600, color: colors.textPrimary }}>{r.name}</span>,
                  <CommunityBadge community={r.community} />,
                  <span style={{ color: colors.textMuted }}>{r.client || "—"}</span>,
                  <span style={{ color: colors.textMuted, fontSize: font.sm }}>
                    {r.punctuality?.submitted_est ?? "—"}
                  </span>,
                  r.punctuality?.on_time
                    ? <StatusBadge variant="success">On Time</StatusBadge>
                    : <StatusBadge variant="warning">{r.punctuality?.minutes_late}m Late</StatusBadge>,
                ])}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Attendance Checker ────────────────────────────────────────────
function AttendanceChecker() {
  const [date,    setDate]    = useState(yesterday());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function runCheck() {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch(`${API}/api/attendance?date=${date}`);
      if (!res.ok) throw new Error((await res.json()).detail ?? "Request failed");
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DateBar date={date} setDate={setDate} onCheck={runCheck} loading={loading} />
      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard icon={Users}        label="Active VAs"  value={data.vas.length}        />
            <StatCard icon={Clock}        label="Clocked In"  value={data.clock_ins.length}  />
            <StatCard icon={CheckCircle2} label="Clocked Out" value={data.clock_outs.length} />
            <StatCard
              icon={data.no_record.length > 0 ? UserX : CheckCircle2}
              label="No Record"
              value={data.no_record.length}
              highlight={data.no_record.length > 0 ? "danger" : "success"}
            />
            <StatCard
              icon={Timer}
              label="Late Clock-Ins"
              value={data.late_count}
              highlight={data.late_count > 0 ? "warning" : "success"}
            />
          </div>

          {/* No record */}
          {data.no_record.length > 0 ? (
            <Card title={`${data.no_record.length} VA${data.no_record.length !== 1 ? "s" : ""} with No Clock-In`} noPadding>
              {data.no_record.map((va, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.dangerBorder}` : "none",
                  background: i % 2 === 0 ? colors.dangerLight : "#FFF8F8",
                }}>
                  <CommunityBadge community={va.community} />
                  <span style={{ fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    {va.name}
                  </span>
                </div>
              ))}
            </Card>
          ) : (
            <StatusBox variant="success">All active VAs have a clock-in record.</StatusBox>
          )}

          {/* Late clock-ins */}
          {data.late_clock_ins?.length > 0 && (
            <Card title={`Late Clock-Ins (${data.late_clock_ins.length})`} noPadding>
              {data.late_clock_ins.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.warningBorder}` : "none",
                  background: i % 2 === 0 ? colors.warningLight : "#FFFDF0",
                }}>
                  <span style={{ fontWeight: 600, flex: 1, fontSize: font.base }}>{c.raw_name}</span>
                  <StatusBadge variant="warning">
                    {c.punctuality.clocked_in_est} — {c.punctuality.minutes_late}m late
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {/* Clock-ins table */}
          {data.clock_ins.length > 0 && (
            <div>
              <SectionLabel>Clock-In Records ({data.clock_ins.length})</SectionLabel>
              <DataTable
                columns={[
                  { label: "Name",       flex: 2 },
                  { label: "Time (EST)", flex: 1 },
                  { label: "Punctuality",flex: 1 },
                  { label: "Notes",      flex: 2 },
                ]}
                rows={data.clock_ins.map((c) => [
                  <span style={{ fontWeight: 600, color: colors.textPrimary }}>{c.raw_name}</span>,
                  <span style={{ color: colors.textMuted }}>{c.punctuality?.clocked_in_est ?? "—"}</span>,
                  c.punctuality?.on_time
                    ? <StatusBadge variant="success">On Time</StatusBadge>
                    : <StatusBadge variant="warning">{c.punctuality?.minutes_late}m Late</StatusBadge>,
                  <span style={{
                    color: c.notes ? colors.textBody : colors.textFaint,
                    fontStyle: c.notes ? "normal" : "italic",
                  }}>
                    {c.notes || "No notes"}
                  </span>,
                ])}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared: DateBar ───────────────────────────────────────────────
function DateBar({ date, setDate, onCheck, loading }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{
          border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
          padding: "9px 14px", fontSize: font.base, outline: "none",
          fontFamily: font.family, background: colors.surface,
          color: colors.textPrimary, height: 38,
        }}
      />
      <Button icon={Search} onClick={onCheck} disabled={loading}>
        {loading ? "Loading…" : "Run Check"}
      </Button>
    </div>
  );
}