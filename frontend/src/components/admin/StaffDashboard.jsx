import { useState, useEffect } from "react";
import {
  Users, UserPlus, Pencil, Trash2, KeyRound, X,
  Shield, AlertTriangle, Eye, EyeOff, RefreshCw, Copy, CheckCircle2,
} from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { apiFetch } from "../../api";
import { Card, PageHeader, StatRow } from "../ui/Structure";
import { StatCard, StatusBox } from "../ui/Indicators";
import Button from "../ui/Button";
import { getRoleLabel } from "../../utils/roles";
import { cacheGet, cacheSet, cacheClear, CACHE_KEYS } from "../../utils/reportCache";

const CACHE_KEY = CACHE_KEYS.STAFF;

const ROLE_OPTIONS = [
  { value: "admin",       label: "Admin" },
  { value: "recruitment", label: "Recruitment" },
  { value: "sme",         label: "SME" },
];

const ROLE_ORDER = ["admin", "recruitment", "sme"];

const ROLE_GROUP_CONFIG = {
  admin:       { label: "Administrators", color: colors.danger,       bg: colors.dangerLight,  border: colors.dangerBorder },
  recruitment: { label: "Recruitment",    color: colors.communityMain, bg: colors.infoLight,    border: colors.infoBorder },
  sme:         { label: "SME",            color: colors.communitySM,   bg: "#F5F3FF",           border: "#DDD6FE" },
};

function StatusBadge({ disabled }) {
  const active = !disabled;
  return (
    <span style={{ fontSize: font.xs, fontWeight: 700, color: active ? colors.success : colors.danger }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ActionBtn({ icon: Icon, title, color, onClick }) {
  return (
    <button
      title={title} onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: radius.sm,
        border: `1px solid ${colors.border}`, background: colors.surface,
        cursor: "pointer", transition: "all .12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color + "18"; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.background = colors.surface; e.currentTarget.style.borderColor = colors.border; }}
    >
      <Icon size={14} color={color} />
    </button>
  );
}

// ── Role group section ────────────────────────────────────────────
function RoleGroup({ role, members, onEdit, onDelete, onReset }) {
  const cfg = ROLE_GROUP_CONFIG[role] || ROLE_GROUP_CONFIG.sme;
  if (members.length === 0) return null;

  const th = {
    padding: "8px 14px", textAlign: "left",
    fontSize: font.xs, fontWeight: 700, color: cfg.color,
    textTransform: "uppercase", letterSpacing: "0.04em",
    background: cfg.bg,
  };
  const colWidths = { name: "25%", email: "35%", status: "15%", actions: "25%" };
  const td = {
    padding: "12px 14px", fontSize: font.sm, color: colors.textBody,
    borderTop: `1px solid ${colors.border}`,
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: `${radius.lg} ${radius.lg} 0 0`,
      }}>
        <Shield size={14} color={cfg.color} />
        <span style={{ fontSize: font.base, fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
        <span style={{
          fontSize: font.xs, fontWeight: 700, color: cfg.color,
          background: cfg.border, borderRadius: 99, padding: "1px 8px",
        }}>
          {members.length}
        </span>
      </div>

      <Card noPadding style={{ borderRadius: `0 0 ${radius.lg} ${radius.lg}`, borderTop: "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: colWidths.name }}>Name</th>
              <th style={{ ...th, width: colWidths.email }}>Email</th>
              <th style={{ ...th, width: colWidths.status }}>Status</th>
              <th style={{ ...th, width: colWidths.actions, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((s, i) => (
              <tr key={s.doc_id} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
                <td style={td}>
                  <span style={{ fontWeight: 600, color: colors.textPrimary }}>{s.name}</span>
                </td>
                <td style={{ ...td, color: colors.textMuted }}>{s.email}</td>
                <td style={td}><StatusBadge disabled={s.disabled} /></td>
                <td style={{ ...td, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <ActionBtn icon={Pencil}   title="Edit"           color={colors.teal}    onClick={() => onEdit(s)} />
                    <ActionBtn icon={KeyRound}  title="Reset Password" color={colors.warning} onClick={() => onReset(s)} />
                    <ActionBtn icon={Trash2}    title="Remove"         color={colors.danger}  onClick={() => onDelete(s)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────
function StaffModal({ staff: existing, onClose, onSaved }) {
  const isEdit = !!existing;
  const [name,     setName]     = useState(existing?.name || "");
  const [email,    setEmail]    = useState(existing?.email || "");
  const [role,     setRole]     = useState(existing?.role || "sme");
  const [disabled, setDisabled] = useState(existing?.disabled ?? false);
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit() {
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!isEdit && !email.trim()) { setError("Email is required."); return; }
    if (!isEdit && password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/staff/${existing.doc_id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), role, disabled }),
        });
      } else {
        await apiFetch("/api/staff", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password }),
        });
      }
      onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const inputStyle = {
    width: "100%", padding: "10px 14px", boxSizing: "border-box",
    border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
    fontSize: font.base, fontFamily: font.family, outline: "none",
    color: colors.textPrimary, background: colors.surface,
  };
  const labelStyle = {
    display: "block", fontSize: font.sm, fontWeight: 700,
    color: colors.textBody, marginBottom: 6,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.45)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: colors.surface, borderRadius: radius.xl, padding: "28px 32px",
        width: "100%", maxWidth: 440, boxShadow: shadow.lg, zIndex: 101,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>
            {isEdit ? "Edit Staff" : "Add Staff Member"}
          </div>
          <button onClick={onClose} style={{
            background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
            borderRadius: radius.md, padding: "6px 8px", cursor: "pointer",
          }}>
            <X size={16} color={colors.textMuted} />
          </button>
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
            background: colors.dangerLight, border: `1px solid ${colors.dangerBorder}`,
            borderRadius: radius.md, padding: "10px 14px",
          }}>
            <AlertTriangle size={14} color={colors.danger} />
            <span style={{ fontSize: font.sm, color: colors.danger }}>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" style={inputStyle}
              onFocus={e => e.target.style.borderColor = colors.teal}
              onBlur={e => e.target.style.borderColor = colors.border}
            />
          </div>

          {!isEdit && (
            <div>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="john@monstertask.com" style={inputStyle}
                onFocus={e => e.target.style.borderColor = colors.teal}
                onBlur={e => e.target.style.borderColor = colors.border}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {isEdit && (
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { value: false, label: "Active",   color: colors.success, bg: colors.successLight, border: colors.successBorder },
                  { value: true,  label: "Inactive", color: colors.danger,  bg: colors.dangerLight,  border: colors.dangerBorder },
                ].map(opt => {
                  const selected = disabled === opt.value;
                  return (
                    <button
                      key={opt.label} type="button"
                      onClick={() => setDisabled(opt.value)}
                      style={{
                        flex: 1, padding: "10px 14px",
                        border: `2px solid ${selected ? opt.color : colors.border}`,
                        borderRadius: radius.md, cursor: "pointer",
                        background: selected ? opt.bg : colors.surface,
                        fontFamily: font.family, fontSize: font.sm, fontWeight: 700,
                        color: selected ? opt.color : colors.textMuted,
                        transition: "all .12s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      {selected && <CheckCircle2 size={14} />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {disabled && (
                <div style={{ fontSize: font.xs, color: colors.danger, marginTop: 6 }}>
                  Inactive staff cannot sign in to MT Admin.
                </div>
              )}
            </div>
          )}

          {!isEdit && (
            <div>
              <label style={labelStyle}>Temporary Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={e => e.target.style.borderColor = colors.teal}
                  onBlur={e => e.target.style.borderColor = colors.border}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                }}>
                  {showPw ? <EyeOff size={16} color={colors.textFaint} /> : <Eye size={16} color={colors.textFaint} />}
                </button>
              </div>
              <div style={{ fontSize: font.xs, color: colors.textFaint, marginTop: 4 }}>
                The user should change this after their first sign-in.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Staff"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Delete Confirmation ───────────────────────────────────────────
function DeleteConfirm({ staff, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true); setError("");
    try {
      await apiFetch(`/api/staff/${staff.doc_id}`, { method: "DELETE" });
      onDeleted();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.45)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: colors.surface, borderRadius: radius.xl, padding: "28px 32px",
        width: "100%", maxWidth: 400, boxShadow: shadow.lg, zIndex: 101,
      }}>
        <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.danger, marginBottom: 12 }}>
          Remove Staff Member
        </div>
        <div style={{ fontSize: font.base, color: colors.textBody, lineHeight: 1.6, marginBottom: 8 }}>
          Are you sure you want to remove <strong>{staff.name}</strong> ({staff.email})?
        </div>
        <div style={{ fontSize: font.sm, color: colors.textMuted, marginBottom: 20 }}>
          Their account will be disabled and they will no longer be able to sign in.
        </div>
        {error && <StatusBox variant="danger" style={{ marginBottom: 12 }}>{error}</StatusBox>}
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleDelete} disabled={loading}
            style={{ flex: 1, background: colors.danger, borderColor: colors.danger }}>
            {loading ? "Removing…" : "Remove"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Password Reset ────────────────────────────────────────────────
function ResetPasswordModal({ staff, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);

  async function handleReset() {
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/staff/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: staff.email }),
      });
      setResult(res);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function copyLink() {
    if (result?.link) {
      navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.45)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: colors.surface, borderRadius: radius.xl, padding: "28px 32px",
        width: "100%", maxWidth: 440, boxShadow: shadow.lg, zIndex: 101,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>Reset Password</div>
          <button onClick={onClose} style={{
            background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
            borderRadius: radius.md, padding: "6px 8px", cursor: "pointer",
          }}>
            <X size={16} color={colors.textMuted} />
          </button>
        </div>

        {!result ? (
          <>
            <div style={{ fontSize: font.base, color: colors.textBody, marginBottom: 20, lineHeight: 1.6 }}>
              Generate a password reset link for <strong>{staff.name}</strong> ({staff.email}).
            </div>
            {error && <StatusBox variant="danger" style={{ marginBottom: 12 }}>{error}</StatusBox>}
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
              <Button icon={KeyRound} onClick={handleReset} disabled={loading} style={{ flex: 1 }}>
                {loading ? "Generating…" : "Generate Link"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <StatusBox variant="success" style={{ marginBottom: 12 }}>
              Reset link generated. Share this with {staff.name}.
            </StatusBox>
            <div style={{
              background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
              borderRadius: radius.md, padding: "10px 14px", marginBottom: 16,
              fontSize: font.xs, color: colors.textBody, wordBreak: "break-all",
              fontFamily: "monospace", lineHeight: 1.5,
            }}>
              {result.link}
            </div>
            <Button icon={copied ? CheckCircle2 : Copy} onClick={copyLink} style={{ width: "100%" }}>
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

// ── Main Staff Dashboard ──────────────────────────────────────────
export default function StaffDashboard() {
  const [staffList, setStaffList] = useState(() => cacheGet(CACHE_KEY) ?? []);
  const [loading,   setLoading]   = useState(!cacheGet(CACHE_KEY));
  const [error,     setError]     = useState("");

  const [showAdd,    setShowAdd]    = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [resetItem,  setResetItem]  = useState(null);

  function fetchStaff() {
    cacheClear(CACHE_KEY);
    setLoading(true); setError("");
    apiFetch("/api/staff")
      .then(d => {
        const list = d.staff ?? [];
        cacheSet(CACHE_KEY, list);
        setStaffList(list);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (cacheGet(CACHE_KEY)) return;
    fetchStaff();
  }, []);

  const grouped = {};
  for (const role of ROLE_ORDER) {
    grouped[role] = staffList
      .filter(s => s.role === role)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="Staff Management"
        subtitle="Add, edit, and manage staff accounts and their roles."
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <Button icon={UserPlus} onClick={() => setShowAdd(true)}>Add Staff</Button>
        <Button variant="ghost" icon={RefreshCw} onClick={fetchStaff} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <StatRow style={{ marginBottom: 24 }}>
        <StatCard icon={Users}  label="Total Staff"  value={staffList.length} />
        <StatCard icon={Shield} label="Admins"       value={grouped.admin?.length ?? 0}       highlight="danger" />
        <StatCard icon={Users}  label="Recruitment"   value={grouped.recruitment?.length ?? 0} highlight="teal" />
        <StatCard icon={Users}  label="SME"           value={grouped.sme?.length ?? 0}         highlight="info" />
      </StatRow>

      {error && <StatusBox variant="danger" style={{ marginBottom: 16 }}>{error}</StatusBox>}

      {!loading && ROLE_ORDER.map(role => (
        <RoleGroup
          key={role}
          role={role}
          members={grouped[role]}
          onEdit={setEditItem}
          onDelete={setDeleteItem}
          onReset={setResetItem}
        />
      ))}

      {!loading && staffList.length === 0 && !error && (
        <StatusBox variant="info">No staff members found.</StatusBox>
      )}

      {showAdd && <StaffModal onClose={() => setShowAdd(false)} onSaved={fetchStaff} />}
      {editItem && <StaffModal staff={editItem} onClose={() => setEditItem(null)} onSaved={fetchStaff} />}
      {deleteItem && <DeleteConfirm staff={deleteItem} onClose={() => setDeleteItem(null)} onDeleted={fetchStaff} />}
      {resetItem && <ResetPasswordModal staff={resetItem} onClose={() => setResetItem(null)} />}
    </div>
  );
}