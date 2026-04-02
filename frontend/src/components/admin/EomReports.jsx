import { useState, useRef } from "react";
import {
  FileText, Calendar, ClipboardList, RefreshCw, Download,
  Sparkles, Clock, UserCheck, UserX, Upload, X,
} from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { Card, PageHeader, StatRow } from "../ui/Structure";
import { CommunityBadge, StatCard, StatusBox } from "../ui/Indicators";
import Button from "../ui/Button";

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const LOGO_URL = "https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png";

// ── CSV Parser ───────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [], community: "Unknown" };

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^"|"$/g, ""); });
    return obj;
  });

  const hLower = headers.map(h => h.toLowerCase());
  const community = hLower.some(h =>
    h.includes("new leads") || h.includes("email app") || h.includes("follow up")
  ) ? "CBA" : "Main";

  return { headers, rows, community };
}

// ── AI Prompt builder ────────────────────────────────────────────

function buildPrompt(rows, community, vaName, month, year, clients) {
  const entries = rows.map(r => {
    const parts = Object.entries(r)
      .filter(([k, v]) => v && k.toLowerCase() !== "name")
      .map(([k, v]) => `${k}: ${v}`);
    return parts.join(" | ");
  }).join("\n");

  const kpiBlock = community === "CBA" ? `

## KPI Summary
Structured breakdown of total leads sourced, email applications, website applications, follow-ups with totals and daily averages. Present as a clean list.` : "";

  return `You are an HR assistant at Monster Task. Generate a professional End-of-Month performance report.

VA Name: ${vaName}
Community: ${community}
Month: ${month} ${year}
Client(s): ${clients || "N/A"}
Total Reports: ${rows.length}

Daily EOD Entries:
${entries}

Generate the report with these EXACT section headers. Respond ONLY with the content, no markdown code fences:

## Overview
2-3 sentence summary of overall performance this month.${kpiBlock}

## Tasks Completed
Categorized summary of all tasks and responsibilities handled. Group similar work together. Be specific but concise.

## Key Achievements
Notable accomplishments or standout work. If nothing exceptional, note consistent reliability.

## Attendance & Punctuality
Summary based on the data — days reported, any gaps, submission patterns.

## Notes
Observations, recommendations, or flags for the manager.`;
}

// ── Editable report renderer ─────────────────────────────────────

function RenderReport({ text, onChange }) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onChange(e.currentTarget.innerText)}
      style={{
        outline: "none", minHeight: 200, lineHeight: 1.7,
        fontSize: font.sm, color: colors.textPrimary, whiteSpace: "pre-wrap",
      }}
      dangerouslySetInnerHTML={{
        __html: text
          .replace(/^## (.+)$/gm,
            `<h3 style="font-size:16px;font-weight:800;color:${colors.textPrimary};margin:20px 0 6px;border-bottom:2px solid ${colors.teal};padding-bottom:4px;">$1</h3>`)
          .replace(/^- (.+)$/gm,
            '<div style="padding-left:16px;margin:2px 0;">• $1</div>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n\n/g, '<br/><br/>')
      }}
    />
  );
}

// ── Copy helper ──────────────────────────────────────────────────

function copyReport(text, vaName, month, year) {
  const header = `Monster Task — End-of-Month Report\n${vaName} · ${month} ${year}\n${"─".repeat(44)}\n\n`;
  navigator.clipboard.writeText(header + text);
}

// ── Root ──────────────────────────────────────────────────────────

export default function EomReports() {
  const [parsed,   setParsed]   = useState(null);
  const [vaName,   setVaName]   = useState("");
  const [month,    setMonth]    = useState("");
  const [year,     setYear]     = useState(new Date().getFullYear().toString());
  const [clients,  setClients]  = useState("");
  const [report,   setReport]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [copied,   setCopied]   = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      const p = parseCSV(text);
      setParsed(p);

      const nameCol = p.headers.find(h => h.toLowerCase() === "name");
      if (nameCol && p.rows[0]) setVaName(p.rows[0][nameCol]);

      const clientCol = p.headers.find(h => h.toLowerCase() === "client");
      if (clientCol) {
        const unique = [...new Set(p.rows.map(r => r[clientCol]).filter(Boolean))];
        setClients(unique.join(", "));
      }
      setReport(""); setErr("");
    };
    reader.readAsText(file);
  }

  function reset() {
    setParsed(null); setVaName(""); setClients("");
    setReport(""); setErr(""); setMonth("");
  }

  async function generate() {
    if (!parsed || !vaName || !month) return;
    setLoading(true); setErr(""); setReport("");
    try {
      const prompt = buildPrompt(parsed.rows, parsed.community, vaName, month, year, clients);
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.map(c => c.text || "").join("\n") || "";
      if (!text) throw new Error("Empty response from AI");
      setReport(text);
    } catch (e) {
      setErr(e.message || "Failed to generate report");
    } finally { setLoading(false); }
  }

  function handleCopy() {
    copyReport(report, vaName, month, year);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Input styles ───────────────────────────────────────────────
  const inputStyle = {
    width: "100%", padding: "8px 12px", boxSizing: "border-box",
    border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
    fontSize: font.sm, fontFamily: font.family, outline: "none",
    color: colors.textPrimary, background: colors.surface,
  };
  const labelStyle = {
    fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
    display: "block", marginBottom: 4,
  };

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="EOM Reports"
        subtitle="Upload a VA's EOD CSV export and generate an AI-powered monthly performance report."
      />

      {/* ── Step 1: Upload ────────────────────────────────────── */}
      {!parsed && (
        <div
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${colors.teal}`, borderRadius: radius.lg,
            padding: "56px 32px", textAlign: "center", cursor: "pointer",
            background: colors.surface, transition: "background .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = colors.tealLight}
          onMouseLeave={e => e.currentTarget.style.background = colors.surface}
        >
          <input
            ref={fileRef} type="file" accept=".csv"
            onChange={e => handleFile(e.target.files?.[0])}
            style={{ display: "none" }}
          />
          <Upload size={36} color={colors.teal} strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: font.lg, fontWeight: 700, color: colors.textPrimary }}>
            Drop a CSV here or click to upload
          </div>
          <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 6 }}>
            Export the VA's EOD reports from Notion as CSV
          </div>
        </div>
      )}

      {/* ── Step 2: Configure + preview ───────────────────────── */}
      {parsed && !report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: font.base, fontWeight: 700, color: colors.textPrimary }}>
                  {parsed.rows.length} reports loaded
                </span>
                <CommunityBadge community={parsed.community} />
              </div>
              <Button variant="ghost" icon={X} onClick={reset} size="sm">
                Change CSV
              </Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>VA Name</label>
                <input value={vaName} onChange={e => setVaName(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = colors.teal}
                  onBlur={e => e.target.style.borderColor = colors.border}
                />
              </div>
              <div>
                <label style={labelStyle}>Client(s)</label>
                <input value={clients} onChange={e => setClients(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = colors.teal}
                  onBlur={e => e.target.style.borderColor = colors.border}
                />
              </div>
              <div>
                <label style={labelStyle}>Month</label>
                <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, background: colors.surface }}>
                  <option value="">Select month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Year</label>
                <input value={year} onChange={e => setYear(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = colors.teal}
                  onBlur={e => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            {/* Data preview */}
            <div style={{
              marginTop: 16, maxHeight: 180, overflowY: "auto",
              border: `1px solid ${colors.border}`, borderRadius: radius.md,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: colors.surfaceAlt }}>
                    {parsed.headers.slice(0, 6).map(h => (
                      <th key={h} style={{
                        padding: "6px 8px", textAlign: "left", fontWeight: 700,
                        color: colors.textMuted, borderBottom: `1px solid ${colors.border}`,
                        whiteSpace: "nowrap", fontSize: font.xs,
                      }}>
                        {h.length > 20 ? h.slice(0, 18) + "…" : h}
                      </th>
                    ))}
                    {parsed.headers.length > 6 && (
                      <th style={{ padding: "6px 8px", color: colors.textFaint, borderBottom: `1px solid ${colors.border}`, fontSize: font.xs }}>
                        +{parsed.headers.length - 6} cols
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {parsed.headers.slice(0, 6).map(h => (
                        <td key={h} style={{
                          padding: "5px 8px", borderBottom: `1px solid ${colors.border}`,
                          color: colors.textBody, maxWidth: 140, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {r[h] || "—"}
                        </td>
                      ))}
                      {parsed.headers.length > 6 && (
                        <td style={{ padding: "5px 8px", borderBottom: `1px solid ${colors.border}`, color: colors.textFaint }}>…</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 5 && (
                <div style={{ padding: "6px 8px", fontSize: 11, color: colors.textMuted, textAlign: "center" }}>
                  + {parsed.rows.length - 5} more rows
                </div>
              )}
            </div>

            {/* Generate */}
            <div style={{ marginTop: 16 }}>
              <Button
                icon={Sparkles}
                onClick={generate}
                disabled={loading || !vaName || !month}
                style={{ width: "100%", height: 44, justifyContent: "center", fontSize: font.base }}
              >
                {loading ? "Generating report…" : "Generate EOM Report"}
              </Button>
            </div>
            {err && <StatusBox variant="danger" style={{ marginTop: 12 }}>{err}</StatusBox>}
          </Card>
        </div>
      )}

      {/* ── Step 3: Generated report (editable + branded) ─────── */}
      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Toolbar */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button variant="ghost" icon={X} onClick={() => setReport("")} size="sm">
              Back to data
            </Button>
            <Button variant="ghost" icon={Sparkles} onClick={generate} disabled={loading} size="sm">
              {loading ? "Generating…" : "Regenerate"}
            </Button>
            <Button icon={copied ? ClipboardList : Download} onClick={handleCopy} size="sm">
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>

          {/* Branded report document */}
          <div style={{
            background: colors.surface, borderRadius: radius.lg, overflow: "hidden",
            border: `1px solid ${colors.border}`, boxShadow: shadow.card,
          }}>
            {/* Navy header */}
            <div style={{ background: "#0D1F3C", padding: "24px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <img src={LOGO_URL} alt="MT" style={{ height: 32 }} />
                <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Monster Task</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>End-of-Month Report</div>
              <div style={{ fontSize: 13, color: "#4A6080", marginTop: 2 }}>{month} {year}</div>
            </div>

            {/* Teal VA bar */}
            <div style={{
              background: colors.teal, padding: "12px 32px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{vaName}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 4,
                  color: colors.teal, background: "rgba(255,255,255,0.9)",
                }}>
                  {parsed?.community}
                </span>
              </div>
              {clients && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{clients}</span>
              )}
            </div>

            {/* Stat pills */}
            <div style={{ display: "flex", gap: 10, padding: "20px 32px", flexWrap: "wrap" }}>
              {[
                { label: "REPORTS",   value: parsed?.rows.length,    color: colors.teal },
                { label: "COMMUNITY", value: parsed?.community,       color: parsed?.community === "CBA" ? "#C2410C" : "#1D4ED8" },
                { label: "PERIOD",    value: `${month} ${year}`,     color: colors.textPrimary },
              ].map((s, i) => (
                <div key={i} style={{
                  background: colors.surfaceAlt, borderRadius: radius.md,
                  padding: "10px 18px", textAlign: "center", minWidth: 90,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Editable content */}
            <div style={{ padding: "8px 32px 32px" }}>
              <div style={{
                fontSize: font.xs, color: colors.teal, marginBottom: 12,
                background: colors.tealLight, padding: "6px 12px", borderRadius: radius.sm,
                fontWeight: 600,
              }}>
                ✏️ Click anywhere in the report below to edit directly
              </div>
              <RenderReport text={report} onChange={setReport} />
            </div>

            {/* Footer */}
            <div style={{
              background: colors.surfaceAlt, padding: "14px 32px",
              borderTop: `1px solid ${colors.border}`,
            }}>
              <div style={{ fontSize: 11, color: colors.textFaint }}>
                This report was generated by MT Admin · Monster Task © {year}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}