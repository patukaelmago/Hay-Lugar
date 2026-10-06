export function getServerSideProps({ params }) {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(params.tenantId)) return { notFound: true };
  return { redirect: { destination: `/guestcenter/${params.tenantId}`, permanent: false } };
}
export default function ReservationsRedirect() { return null; }
