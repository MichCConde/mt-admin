export function DataTable({ children }) {
  return (
    <div className="table-wrap">
      <table className="data-table">{children}</table>
    </div>
  );
}

export function Th({ children }) { return <th>{children}</th>; }
export function Td({ children, style }) { return <td style={style}>{children}</td>; }