export function Table({ children }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">{children}</table>
    </div>
  );
}

export function Th({ children, style }) {
  return <th style={style}>{children}</th>;
}

export function Td({ children, style }) {
  return <td style={style}>{children}</td>;
}