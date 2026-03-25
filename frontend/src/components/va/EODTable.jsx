import { Spinner, Badge } from "../../ui/Indicators";
import { Table, Th, Td } from "../../ui/Tables";

export default function EODTable({ reports, loading }) {
  const rows = reports ?? [];
  if (loading && !rows.length) return <Spinner />;
  if (!rows.length) return <p className="empty">No reports found.</p>;
  return (
    <Table>
      <thead>
        <tr><Th>Name</Th><Th>Time In</Th><Th>Time Out</Th><Th>Status</Th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <Td><span className="va-cell-name">{r.name}</span></Td>
            <Td>{r.time_in  || "—"}</Td>
            <Td>{r.time_out || "—"}</Td>
            <Td>
              <Badge variant={r.status?.toLowerCase() === "late" ? "late" : "teal"}>
                {r.status || "Submitted"}
              </Badge>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}