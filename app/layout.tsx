export const metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'MangaDB | Catálogo de mangás legais',
  description:
    'Catálogo de mangás com fontes oficiais, títulos em alta, novidades e lançamentos no Brasil.',
  openGraph: {
    title: 'MangaDB',
    description: 'Descubra onde ler mangás legalmente.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#090b10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: '#090b10',
          color: '#f5f3ef',
        }}
      >
        {children}
      </body>
    </html>
  );
}
