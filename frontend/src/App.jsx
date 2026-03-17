import Layout from "./components/pages/Layout";

// Auth will be added later.
// When Firebase is ready, this becomes:
//   const { user, loading } = useAuthState()
//   return loading ? <Spinner /> : user ? <Layout /> : <Login />

export default function App() {
  return <Layout />;
}