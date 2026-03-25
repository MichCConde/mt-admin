import VACard from "./VACard";
import { Spinner } from "../../ui/Indicators";

export default function VAList({ vas, loading, filter = "" }) {
  if (loading) return <Spinner fullPage />;
  const filtered = vas.filter(v =>
    v.name.toLowerCase().includes(filter.toLowerCase()) ||
    (v.client || "").toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) return <p className="empty">No VAs found.</p>;
  return (
    <div className="va-grid">
      {filtered.map(v => <VACard key={v.id} va={v} />)}
    </div>
  );
}