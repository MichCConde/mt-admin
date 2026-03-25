import { Spinner, Badge } from "../../ui/Indicators";
import { DataTable, Th, Td } from "../../ui/Tables";

export default function AttendanceTable({ records, loading }) {
  const safe = records ?? [];
  if (loading && !safe.length) return <Spinner />;
  if (!safe.length) return <p className="empty">No attendance records.</p>;

  const byName = safe.reduce((acc, r) => {
    acc[r.last_name] = acc[r.last_name] || [];
    acc[r.last_name].push(r);
    return acc;
  }, {});

  return (
    <DataTable>
      <thead>
        <tr><Th>Name</Th><Th>Clock In</Th><Th>Clock Out</Th><Th>Status</Th></tr>
      </thead>
      <tbody>
        {Object.entries(byName).map(([name, recs]) => {
          const inRec  = recs.find(r => r.clock === "IN");
          const outRec = recs.find(r => r.clock === "OUT");
          return (
            <tr key={name}>
              <Td><span style={{ textTransform: "capitalize" }}>{name}</span></Td>
              <Td>{inRec?.time  || "—"}</Td>
              <Td>{outRec?.time || "—"}</Td>
              <Td><Badge type={!inRec ? "missing" : "ok"}>{!inRec ? "Missing" : "Present"}</Badge></Td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}