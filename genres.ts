// [nome no AniList, rótulo em português]
export const GENRES: [string, string][] = [
  ['Action', 'Ação'], ['Adventure', 'Aventura'], ['Comedy', 'Comédia'], ['Drama', 'Drama'],
  ['Fantasy', 'Fantasia'], ['Romance', 'Romance'], ['Supernatural', 'Sobrenatural'],
  ['Slice of Life', 'Slice of Life'], ['Sports', 'Esporte'], ['Mystery', 'Mistério'],
  ['Horror', 'Terror'], ['Sci-Fi', 'Ficção científica'], ['Psychological', 'Psicológico'],
  ['Thriller', 'Suspense'], ['Mecha', 'Mecha'], ['Music', 'Música'],
];
export const ALLOWED_GENRES = new Set(GENRES.map(([en]) => en));
// tradução para exibição (inclui gêneros que não aparecem como filtro)
export const GENRE_PT: Record<string, string> = {
  ...Object.fromEntries(GENRES),
  Ecchi: 'Ecchi', 'Mahou Shoujo': 'Garota mágica', Suspense: 'Suspense', Gourmet: 'Gastronomia', 'Award Winning': 'Premiado',
};
