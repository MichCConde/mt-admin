export function Page({ children })              { return <div className="page">{children}</div>; }
export function PageHeader({ children })        { return <div className="page-header">{children}</div>; }
export function Section({ children })           { return <section className="section">{children}</section>; }
export function SectionTitle({ children })      { return <h2 className="section-title">{children}</h2>; }
export function TwoCol({ children })            { return <div className="two-col">{children}</div>; }
export function ColLabel({ children })          { return <p className="col-label">{children}</p>; }
export function Card({ children, className="" }) {
  return <div className={`card ${className}`}>{children}</div>;
}