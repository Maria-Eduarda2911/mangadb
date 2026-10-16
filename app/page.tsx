'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GENRES, GENRE_PT } from '@/genres';

type ThemeMode = 'light' | 'dark';
type Source = { url: string; platform: string; isFree: boolean };
type Card = {
  id: string; title: string; synopsis: string; genres: string[]; status: string;
  cover: string | null; rating: number | null; sources: Source[];
  synopsisLang?: 'pt-br' | 'pt-br-auto' | 'original';
};
type SortKey = 'relevance' | 'popular' | 'score' | 'recent';
const pt = (g: string) => GENRE_PT[g] ?? g;
type HomeData = { manga: Card[]; trending: Card[]; recent: Card[]; top: Card[]; manhwa: Card[]; manhua: Card[] };

const SECTIONS: [string, keyof HomeData][] = [
  ['Mais lidos agora', 'trending'],
  ['Novos destaques', 'recent'],
  ['Mais bem avaliados', 'top'],
  ['Mangás em alta', 'manga'],
  ['Manhwa em alta', 'manhwa'],
  ['Manhua em alta', 'manhua'],
];

function getThemePalette(theme: ThemeMode) {
  return theme === 'light'
    ? { bg: '#f4efe7', panel: '#fffdf9', soft: '#f0eadf', border: 'rgba(25,20,14,0.14)', text: '#1d1a17',
        muted: '#5c564f', accent: '#ca5c2a', strong: '#8d3d1d', dark: '#302720', onDark: '#fffaf5' }
    : { bg: '#0d1117', panel: '#141b22', soft: '#1a2330', border: 'rgba(255,255,255,0.12)', text: '#f3efe8',
        muted: '#b9c0ca', accent: '#f2a65a', strong: '#f7d9a6', dark: '#f2a65a', onDark: '#171410' };
}
type Palette = ReturnType<typeof getThemePalette>;
const sans = { fontFamily: 'Arial, sans-serif' } as const;
const box = (p: Palette) => ({ background: p.panel, border: `2px solid ${p.border}`, boxShadow: '6px 6px 0 rgba(0,0,0,0.10)' });

export default function Home() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Card[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [freeOnly, setFreeOnly] = useState(false);
  const [home, setHome] = useState<HomeData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState(false);
  const [open, setOpen] = useState<Card | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const p = getThemePalette(theme);
  const term = q.trim();
  const hasQuery = term.length >= 2;
  const active = hasQuery || genres.length > 0;
  const effSort: SortKey = !hasQuery && sort === 'relevance' ? 'popular' : sort;

  const loadHome = useCallback(async () => {
    setHomeLoading(true); setHomeError(false);
    try {
      const res = await fetch('/api/home');
      if (!res.ok) throw new Error('home');
      setHome(await res.json());
    } catch { setHomeError(true); } finally { setHomeLoading(false); }
  }, []);
  useEffect(() => { loadHome(); }, [loadHome]);

  const fetchPage = useCallback(async (pg: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(pg), sort: effSort });
      if (hasQuery) params.set('q', term);
      if (genres.length) params.set('genres', genres.join(','));
      const res = await fetch('/api/titles?' + params.toString(), { signal: ctrl.signal });
      const data = await res.json();
      if (res.status === 429) throw new Error('Muitas buscas seguidas. Aguarde alguns segundos e tente de novo.');
      if (!res.ok || !Array.isArray(data.items)) throw new Error('Não foi possível buscar agora. Tente de novo em instantes.');
      setItems((prev) => (pg === 1 ? data.items : [...prev, ...data.items.filter((c: Card) => !prev.some((x) => x.id === c.id))]));
      setHasNext(!!data.hasNext); setPage(pg);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (pg === 1) setItems([]);
      setError(e?.message || 'Erro ao buscar.');
    } finally { if (abortRef.current === ctrl) setLoading(false); }
  }, [term, hasQuery, genres, effSort]);

  useEffect(() => {
    if (!active) { abortRef.current?.abort(); setItems([]); setHasNext(false); setError(''); setLoading(false); return; }
    const t = setTimeout(() => fetchPage(1), 400);
    return () => clearTimeout(t);
  }, [active, fetchPage]);

  const keep = (l: Card[]) => (freeOnly ? l.filter((c) => c.sources.some((s) => s.isFree)) : l);

  return (
    <main style={{ minHeight: '100vh', background: p.bg, color: p.text, paddingBottom: 72, fontFamily: 'Georgia, "Times New Roman", serif' }}>
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '28px 26px 0' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, paddingBottom: 22, marginBottom: 20, borderBottom: `1px solid ${p.border}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <a href="/" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.08em', color: p.text, textDecoration: 'none' }}>MangaDB</a>
            <span style={{ ...sans, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: p.muted }}>catálogo oficial</span>
          </div>
          <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            style={{ ...sans, ...box(p), color: p.text, padding: '10px 14px', fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
        </header>

        <section style={{ ...box(p), padding: '28px 26px', marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 4vw, 4.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em' }}>
            Descubra mangás, manwhuas e manhuas<br />
            e onde lê-los legalmente
          </h1>

          <p style={{ ...sans, color: p.muted, fontSize: 17, lineHeight: 1.6, maxWidth: 640, margin: '16px 0 20px' }}>
            Títulos populares, novos e bem avaliados, com links para ler ou comprar em plataformas oficiais.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && active && fetchPage(1)}
              placeholder="Buscar mangá pelo título..." aria-label="Buscar mangá"
              style={{ ...sans, flex: 1, minWidth: 220, background: p.panel, color: p.text, border: `1px solid ${p.border}`, padding: '16px 18px', fontSize: 16 }} />
            <button onClick={() => active && fetchPage(1)}
              style={{ ...sans, border: 'none', background: p.dark, color: p.onDark, padding: '16px 22px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              Buscar
            </button>
          </div>
          <label style={{ ...sans, display: 'inline-flex', alignItems: 'center', gap: 10, color: p.muted, fontSize: 14 }}>
            <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> Mostrar só opções gratuitas
          </label>
          <FilterBar p={p} genres={genres} setGenres={setGenres} sort={effSort} setSort={setSort} hasQuery={hasQuery}
            onClear={() => { setGenres([]); setSort('relevance'); }} />
        </section>

        {loading && <div style={{ ...sans, color: p.muted, padding: '0 0 18px' }}>Buscando...</div>}
        {error && (
          <div style={{ ...sans, color: p.strong, padding: '0 0 18px' }}>
            {error}{' '}
            <button onClick={() => fetchPage(1)} style={{ ...sans, cursor: 'pointer', padding: '6px 12px', background: p.dark, color: p.onDark, border: 'none' }}>Tentar de novo</button>
          </div>
        )}

        {active ? (
          <>
            <Section p={p} title={hasQuery ? `Resultados para “${term}”` : 'Catálogo filtrado'} cards={keep(items)} onOpen={setOpen}
              empty={loading ? ' ' : items.length ? 'Nenhum resultado gratuito. Desmarque o filtro para ver todos.' : 'Nenhum resultado. Tente outro nome ou remova filtros.'} />
            {hasNext && !loading && (
              <button onClick={() => fetchPage(page + 1)}
                style={{ ...sans, ...box(p), color: p.text, padding: '12px 22px', cursor: 'pointer', fontWeight: 700 }}>Carregar mais</button>
            )}
          </>
        ) : homeLoading ? (
          <div style={{ ...sans, color: p.muted }}>Carregando catálogo...</div>
        ) : homeError || !home ? (
          <div style={{ ...sans, color: p.strong }}>
            Não foi possível carregar o catálogo agora.{' '}
            <button onClick={loadHome} style={{ ...sans, cursor: 'pointer', padding: '6px 12px', background: p.dark, color: p.onDark, border: 'none' }}>Tentar de novo</button>
          </div>
        ) : (
          SECTIONS.map(([title, key]) => (
            <Section key={key} p={p} title={title} cards={keep(home[key] ?? [])} onOpen={setOpen}
              empty={freeOnly ? 'Nenhum título gratuito nesta categoria.' : 'Sem títulos nesta categoria agora.'} />
          ))
        )}

        <Footer p={p} />
      </div>
      {open && <DetailModal key={open.id} card={open} p={p} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Section({ p, title, cards, onOpen, empty }: { p: Palette; title: string; cards: Card[]; onOpen: (c: Card) => void; empty: string }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {cards.length === 0 ? <div style={{ ...sans, color: p.muted }}>{empty}</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
          {cards.map((c) => <CatalogCard key={c.id} card={c} p={p} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}

function Cover({ src, title, p, height }: { src: string | null; title: string; p: Palette; height: number | string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{ height, background: p.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center', color: p.muted, fontWeight: 700 }}>
        {title}
      </div>
    );
  }
  return <img src={src} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
    style={{ display: 'block', width: '100%', height, objectFit: 'cover', background: p.soft }} />;
}

function CatalogCard({ card, p, onOpen }: { card: Card; p: Palette; onOpen: (c: Card) => void }) {
  const free = card.sources.some((s) => s.isFree);
  return (
    <article role="button" tabIndex={0} onClick={() => onOpen(card)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card); } }}
      style={{ ...box(p), cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ position: 'relative', borderBottom: `1px solid ${p.border}` }}>
        <Cover src={card.cover} title={card.title} p={p} height={250} />
        {card.sources.length > 0 && (
          <span style={{ ...sans, position: 'absolute', left: 10, top: 10, background: p.panel, color: p.text, border: `1px solid ${p.border}`, padding: '5px 8px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {free ? 'Grátis' : 'Oficial'}
          </span>
        )}
        {card.rating != null && (
          <span style={{ ...sans, position: 'absolute', right: 10, top: 10, background: p.dark, color: p.onDark, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
            ★ {card.rating.toFixed(1)}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 12px 14px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{card.title}</div>
        <div style={{ ...sans, color: p.muted, fontSize: 12, lineHeight: 1.5 }}>{card.genres.slice(0, 3).map(pt).join(' · ') || 'Mangá'}</div>
      </div>
    </article>
  );
}

function DetailModal({ card, p, onClose }: { card: Card; p: Palette; onClose: () => void }) {
  // abre na hora com os dados da lista; os links oficiais completos chegam depois
  const [d, setD] = useState<Card>(card);
  const [links, setLinks] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/title/${encodeURIComponent(card.id)}`, { signal: ctrl.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(); setD({ ...card, ...j }); setLinks('ok'); })
      .catch((e) => { if (e?.name !== 'AbortError') setLinks('error'); });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { ctrl.abort(); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const synNote = links === 'loading' ? '· traduzindo...' : d.synopsisLang === 'pt-br-auto' ? '· tradução automática'
    : d.synopsisLang === 'original' && d.synopsis ? '· original em inglês' : '';
  const amazon = `https://www.amazon.com.br/s?k=${encodeURIComponent(d.title + ' mangá')}`;
  const linkStyle = { ...sans, display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: `1px solid ${p.border}`, color: p.text, textDecoration: 'none', background: p.soft } as const;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-label={d.title} onClick={(e) => e.stopPropagation()}
        style={{ ...box(p), color: p.text, maxWidth: 800, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 24, position: 'relative' }}>
        <button onClick={onClose} aria-label="Fechar"
          style={{ ...sans, position: 'absolute', right: 12, top: 12, background: 'transparent', color: p.text, border: `1px solid ${p.border}`, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ width: 210, maxWidth: '100%', alignSelf: 'flex-start', border: `1px solid ${p.border}` }}>
            <Cover src={d.cover} title={d.title} p={p} height={300} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ margin: '0 36px 8px 0', lineHeight: 1.1 }}>{d.title}</h2>
            <div style={{ ...sans, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13, color: p.muted }}>
              {d.rating != null && <b style={{ background: p.dark, color: p.onDark, padding: '4px 8px' }}>★ {d.rating.toFixed(1)} / 10</b>}
              {d.status && <span>{d.status}</span>}
              {d.genres.length > 0 && <span>{d.genres.map(pt).join(' · ')}</span>}
            </div>
            <h3 style={{ ...sans, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.muted, margin: '18px 0 6px' }}>Sinopse {synNote}</h3>
            <p style={{ ...sans, lineHeight: 1.65, whiteSpace: 'pre-line', maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {d.synopsis || 'Sem sinopse disponível.'}
            </p>
            <h3 style={{ ...sans, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.muted, margin: '18px 0 8px' }}>Onde ler</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  <span>{s.platform.replace(/^(www\.|global\.)/, '')}</span>
                  <b style={{ color: p.strong }}>{s.isFree ? 'Ler grátis' : 'Comprar'} ↗</b>
                </a>
              ))}
              {links === 'loading' && <div style={{ ...sans, fontSize: 13, color: p.muted }}>Buscando mais fontes oficiais...</div>}
              {links === 'error' && <div style={{ ...sans, fontSize: 13, color: p.muted }}>Não foi possível carregar todas as fontes agora.</div>}
              {links !== 'loading' && d.sources.length === 0 && (
                <div style={{ ...sans, fontSize: 13, color: p.muted }}>Nenhuma fonte oficial cadastrada para este título.</div>
              )}
              {!d.sources.some((s) => s.platform.includes('amazon')) && <a href={amazon} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, background: 'transparent' }}>
                <span>Buscar na Amazon Brasil</span><b style={{ color: p.strong }}>Buscar ↗</b>
              </a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterBar({ p, genres, setGenres, sort, setSort, hasQuery, onClear }: {
  p: Palette; genres: string[]; setGenres: (g: string[]) => void; sort: SortKey;
  setSort: (s: SortKey) => void; hasQuery: boolean; onClear: () => void;
}) {
  const toggle = (g: string) => setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]);
  const sorts: [SortKey, string][] = [...(hasQuery ? ([['relevance', 'Relevância']] as [SortKey, string][]) : []),
    ['popular', 'Popularidade'], ['score', 'Melhor nota'], ['recent', 'Lançamento']];
  return (
    <div style={{ ...sans, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${p.border}` }}>
      <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: p.muted, marginBottom: 10 }}>
        Filtrar por gênero {genres.length > 0 && '(mostra títulos de qualquer um dos selecionados)'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {GENRES.map(([en, label]) => {
          const on = genres.includes(en);
          return (
            <button key={en} aria-pressed={on} onClick={() => toggle(en)}
              style={{ ...sans, cursor: 'pointer', padding: '7px 12px', fontSize: 13, border: `1px solid ${p.border}`,
                background: on ? p.dark : p.panel, color: on ? p.onDark : p.text, fontWeight: on ? 700 : 400 }}>
              {label}
            </button>
          );
        })}
        {(genres.length > 0 || sort !== 'popular') && (
          <button onClick={onClear} style={{ ...sans, cursor: 'pointer', padding: '7px 12px', fontSize: 13, background: 'transparent', color: p.strong, border: 'none', textDecoration: 'underline' }}>
            Limpar filtros
          </button>
        )}
        <label style={{ marginLeft: 'auto', fontSize: 13, color: p.muted, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          Ordenar por
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ ...sans, padding: '7px 10px', background: p.panel, color: p.text, border: `1px solid ${p.border}` }}>
            {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function Footer({ p }: { p: Palette }) {
  const h = { ...sans, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.muted, margin: '0 0 10px' } as const;
  const t = { ...sans, fontSize: 14, lineHeight: 1.7, margin: 0, color: p.text } as const;
  const a = { color: p.strong, fontWeight: 700 } as const;
  return (
    <footer style={{ ...box(p), marginTop: 48, padding: '28px 26px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
        <div>
          <h4 style={h}>Sobre o projeto</h4>
          <p style={t}>MangaDB é um catálogo que ajuda você a descobrir mangás e a encontrar onde lê-los ou comprá-los em plataformas
            oficiais. O projeto não hospeda nem indica sites de leitura não autorizados.</p>
        </div>
        <div>
          <h4 style={h}>Sobre a autora</h4>
          <p style={t}><b>Maria Eduarda Santos Silva</b> — desenvolvedora e estudante de Análise e Desenvolvimento de Sistemas.
            Criou o MangaDB como projeto de portfólio, com Next.js, React e TypeScript.</p>
          <p style={{ ...t, marginTop: 8 }}>
            <a href="https://github.com/Maria-Eduarda2911" target="_blank" rel="noopener noreferrer" style={a}>github.com/Maria-Eduarda2911 ↗</a>
          </p>
        </div>
        <div>
          <h4 style={h}>Fontes dos dados</h4>
          <p style={t}>Títulos, capas e notas vêm do{' '}
            <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" style={a}>AniList</a> e do{' '}
            <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" style={a}>MyAnimeList</a>; links oficiais e parte das sinopses em português vêm do{' '}
            <a href="https://mangadex.org" target="_blank" rel="noopener noreferrer" style={a}>MangaDex</a>.
            Quando não há texto em português, a sinopse é traduzida automaticamente e isso aparece indicado.</p>
        </div>
        <div>
          <h4 style={h}>Aviso</h4>
          <p style={t}>Capas, sinopses e marcas pertencem aos seus autores e editoras. Projeto independente, sem vínculo com as
            plataformas citadas. Notas (0 a 10) são das fontes e a disponibilidade dos links pode mudar.</p>
        </div>
      </div>
      <div style={{ ...sans, fontSize: 12, color: p.muted, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${p.border}` }}>
        © {new Date().getFullYear()} MangaDB · Feito com cuidado por Maria Eduarda.
      </div>
    </footer>
  );
}
