import VACard from "./VACard";
import { Spinner } from "../../ui/Indicators";

export default function VAList({ vas, loading }) {
  if (loading) return <Spinner fullPage />;
  if (!vas.length) return <p className="empty">No VAs found.</p>;
  return (
    <div className="va-grid">
      {vas.map(v => <VACard key={v.id} va={v} />)}
    </div>
  );
}