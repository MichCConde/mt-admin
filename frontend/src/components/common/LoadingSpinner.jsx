import { Spinner } from "../../ui/Indicators";
export default function LoadingSpinner({ fullPage = false }) {
  return <Spinner fullPage={fullPage} />;
}