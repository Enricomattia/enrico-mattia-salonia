export const metadata = {
  title: 'Πathos — Enrico Mattia Salonia',
  description: 'Books, films, theatre, games, reviews and saved passages.',
  robots: { index: false, follow: false },
};

// Staging: a same-origin iframe preserves the existing Πathos interface.
// This route contains no personal archive data or credentials.
export default function PathosPage() {
  return (
    <main style={{ width: '100%', flex: 1, minHeight: '100dvh' }}>
      <iframe
        src="/pathos/app.html"
        title="Πathos"
        style={{ display: 'block', width: '100%', height: '100dvh', border: 'none' }}
      />
    </main>
  );
}
