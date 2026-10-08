export const metadata = {
  title: 'Πathos — Enrico Mattia Salonia',
  description: 'Books, films, theatre, games, reviews and saved passages.',
};

// Staging: a same-origin iframe preserves the existing Πathos interface.
// This route contains no personal archive data or credentials.
export default function PathosPage() {
  return (
    <main style={{ width: '100%', flex: 1, minHeight: '85vh' }}>
      <iframe
        src="/pathos/app.html"
        title="Πathos"
        style={{ display: 'block', width: '100%', height: 'calc(100vh - 110px)', minHeight: 700, border: 'none' }}
      />
    </main>
  );
}
