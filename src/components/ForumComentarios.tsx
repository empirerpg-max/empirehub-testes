// src/components/ForumComentarios.tsx
// Fórum de discussões estilo Telegram — consome GAS via api.ts
import { useEffect, useRef, useState } from 'react';
import { adicionarComentario, getComentarios } from '../services/api';

const EMOJIS = ['👍','❤️','🔥','😂','😮','🎵','🎶','💯','🤩','😭','🎤','🥁','🎸','🎹','✨'];

export type Comentario = {
  topico_id: string;
  autor: string;
  texto: string;
  emoji: string;
  timestamp: string;
};

export type Props = {
  /** 'musicas' | 'mv' | 'videos' | 'albuns' */
  tipo: string;
  topicoId: string;
  capa?: string;
  titulo: string;
};

export default function ForumComentarios({ tipo, topicoId, capa, titulo }: Props) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [texto,    setTexto]    = useState('');
  const [emoji,    setEmoji]    = useState('');
  const [autor,    setAutor]    = useState(() => localStorage.getItem('ep_autor') || '');
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFetching(true);
    getComentarios(tipo, topicoId)
      .then(data => setComentarios(data as Comentario[]))
      .catch(() => setComentarios([]))
      .finally(() => setFetching(false));
  }, [tipo, topicoId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comentarios]);

  const salvarAutor = (nome: string) => {
    setAutor(nome);
    try { localStorage.setItem('ep_autor', nome); } catch {}
  };

  async function enviar() {
    if (!texto.trim() || !autor.trim()) return;
    setLoading(true);
    try {
      await adicionarComentario(tipo, topicoId, autor, texto, emoji);
      setComentarios(prev => [
        ...prev,
        { topico_id: topicoId, autor, texto, emoji, timestamp: new Date().toISOString() },
      ]);
      setTexto('');
      setEmoji('');
    } finally {
      setLoading(false);
    }
  }

  // ── Estilos inline (sem dependência de Tailwind aqui para portabilidade) ──
  const s = {
    root: {
      background: '#0d1117',
      borderRadius: '14px',
      padding: '16px',
      color: '#e6edf3',
      fontFamily: 'system-ui, sans-serif',
      width: '100%',
      maxWidth: '600px',
      boxSizing: 'border-box' as const,
    },
    header: {
      display: 'flex', alignItems: 'center', gap: '12px',
      marginBottom: '16px', borderBottom: '1px solid #21262d', paddingBottom: '12px',
    },
    capa: { width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' as const },
    capaPlaceholder: {
      width: '52px', height: '52px', borderRadius: '10px',
      background: '#161b22', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '24px', flexShrink: 0,
    },
    msgList: {
      maxHeight: '340px', overflowY: 'auto' as const,
      marginBottom: '14px', display: 'flex', flexDirection: 'column' as const, gap: '8px',
      scrollbarWidth: 'thin' as const,
    },
    bubble: {
      background: '#161b22', borderRadius: '12px 12px 12px 2px',
      padding: '10px 14px', maxWidth: '85%', alignSelf: 'flex-start' as const,
      wordBreak: 'break-word' as const,
    },
    bubbleMine: {
      background: '#1f3d5c', borderRadius: '12px 12px 2px 12px',
      alignSelf: 'flex-end' as const,
    },
    emojiBar: { display: 'flex', flexWrap: 'wrap' as const, gap: '5px', marginBottom: '10px' },
    emojiBtn: (active: boolean): React.CSSProperties => ({
      background: active ? '#1f6feb' : '#21262d',
      border: 'none', borderRadius: '6px', padding: '4px 7px',
      cursor: 'pointer', fontSize: '16px', transition: 'background 0.15s',
    }),
    input: {
      width: '100%', background: '#161b22', border: '1px solid #30363d',
      borderRadius: '10px', color: '#e6edf3', padding: '9px 13px',
      fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box' as const,
      outline: 'none',
    },
    sendRow: { display: 'flex', gap: '8px' },
    sendBtn: (disabled: boolean): React.CSSProperties => ({
      background: '#1f6feb', color: '#fff', border: 'none',
      borderRadius: '10px', padding: '9px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 700, fontSize: '15px', opacity: disabled ? 0.55 : 1, transition: 'opacity 0.15s',
    }),
  };

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        {capa
          ? <img src={capa} alt={titulo} style={s.capa} />
          : <div style={s.capaPlaceholder}>🎵</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{titulo}</div>
          <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
            {fetching ? 'Carregando...' : `${comentarios.length} comentários`}
          </div>
        </div>
      </div>

      {/* Lista de mensagens */}
      <div style={s.msgList}>
        {fetching && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
            ⏳ Carregando comentários...
          </div>
        )}
        {!fetching && comentarios.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Seja o primeiro a comentar!</div>
          </div>
        )}
        {comentarios.map((c, i) => {
          const isMe = c.autor === autor;
          return (
            <div key={i} style={{ ...s.bubble, ...(isMe ? s.bubbleMine : {}) }}>
              {!isMe && (
                <div style={{ fontSize: '12px', color: '#58a6ff', fontWeight: 600, marginBottom: '4px' }}>
                  {c.autor}
                </div>
              )}
              <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                {c.emoji && <span style={{ marginRight: '4px' }}>{c.emoji}</span>}
                {c.texto}
              </div>
              <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '5px', textAlign: 'right' }}>
                {new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Painel de emojis */}
      <div style={s.emojiBar}>
        {EMOJIS.map(e => (
          <button key={e} style={s.emojiBtn(emoji === e)} onClick={() => setEmoji(prev => prev === e ? '' : e)}>
            {e}
          </button>
        ))}
      </div>

      {/* Nome do usuário */}
      <input
        value={autor}
        onChange={ev => salvarAutor(ev.target.value)}
        placeholder="Seu nome ou apelido"
        style={s.input}
      />

      {/* Mensagem + botão enviar */}
      <div style={s.sendRow}>
        <input
          value={texto}
          onChange={ev => setTexto(ev.target.value)}
          onKeyDown={ev => ev.key === 'Enter' && !ev.shiftKey && enviar()}
          placeholder="Escreva um comentário... (Enter para enviar)"
          style={{ ...s.input, marginBottom: 0, flex: 1 }}
        />
        <button
          onClick={enviar}
          disabled={loading || !texto.trim() || !autor.trim()}
          style={s.sendBtn(loading || !texto.trim() || !autor.trim())}
          title="Enviar"
        >
          {loading ? '⌛' : '➤'}
        </button>
      </div>
    </div>
  );
}
