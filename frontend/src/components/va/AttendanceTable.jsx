import { Spinner, Badge } from "../../ui/Indicators";
import { Table, Th, Td } from "../../ui/Tables";

export default function AttendanceTable({ records, loading }) {
  const safe = records ?? [];
  if (loading && !safe.length) return <Spinner />;
  if (!safe.length) return <p className="empty">No attendance records.</p>;

  const byName = safe.reduce((acc, r) => {
    (acc[r.last_name] = acc[r.last_name] || []).push(r);
    return acc;
  }, {});

  return (
    <Table>
      <thead>
        <tr><Th>Name</Th><Th>Clock In</Th><Th>Clock Out</Th><Th>Status</Th></tr>
      </thead>
      <tbody>
        {Object.entries(byName).map(([name, recs]) => {
          const inR  = recs.find(r => r.clock === "IN");
          const outR = recs.find(r => r.clock === "OUT");
          return (
            <tr key={name}>
              <Td><span className="va-cell-name" style={{ textTransform: "capitalize" }}>{name}</span></Td>
              <Td>{inR?.time  || "—"}</Td>
              <Td>{outR?.time || "—"}</Td>
              <Td><Badge variant={!inR ? "missing" : "ok"}>{!inR ? "Missing" : "Present"}</Badge></Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}