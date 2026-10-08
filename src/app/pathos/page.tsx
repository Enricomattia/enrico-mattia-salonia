export const metadata = {
  title: "Πathos — Enrico Mattia Salonia",
  description: "A personal archive of experiences and reviews.",
};

// Staging placeholder. The interactive archive is not published until
// authentication, importing, and public/private permission tests pass.
export default function PathosPage() {
  return (
    <main className="site-main">
      <h1>Πathos</h1>
      <p style={{ marginTop: 22, maxWidth: 560, lineHeight: 1.7 }}>
        A personal archive of films, books, theatre, and other experiences.
      </p>
      <p style={{ marginTop: 18, color: "#667" }}>
        The archive is being prepared. No private entries are published.
      </p>
    </main>
  );
}
