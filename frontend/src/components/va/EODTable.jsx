import { Spinner, Badge } from "../../ui/Indicators";
import { DataTable, Th, Td } from "../../ui/Tables";

export default function EODTable({ reports, loading, label = "EOD Reports" }) {
  const safe = reports ?? [];
  if (loading && !safe.length) return <Spinner />;
  if (!safe.length) return <p className="empty">No reports found.</p>;
  return (
    <>
      <DataTable>
        <thead>
          <tr><Th>Name</Th><Th>Time In</Th><Th>Time Out</Th><Th>Status</Th></tr>
        </thead>
        <tbody>
          {safe.map(r => (
            <tr key={r.id}>
              <Td>{r.name}</Td>
              <Td>{r.time_in || "—"}</Td>
              <Td>{r.time_out || "—"}</Td>
              <Td><Badge type={r.status?.toLowerCase() || "default"}>{r.status || "Submitted"}</Badge></Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}