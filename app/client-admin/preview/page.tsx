import ClientAdminClient from "../ClientAdminClient";

export default function ClientAdminPreviewPage() {
  if (process.env.NODE_ENV === "production") return <main className="flex min-h-screen items-center justify-center p-8"><p>This preview is available only in local development.</p></main>;
  return <ClientAdminClient user={{ name: "Bryan Koyundi", email: "bryan@deeptrack.io", roles: ["founder"] }} />;
}
