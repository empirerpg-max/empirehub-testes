/**
 * ForumChat.tsx
 * Componente de fórum de discussão estilo Telegram.
 * Uso:
 *   <ForumChat
 *     topicId="abc123"
 *     categoria="musicas"
 *     item={playItem}
 *   />
 *
 * Props:
 *   topicId    — id_do_topico usado para filtrar comentários na planilha
 *   categoria  — 'musicas' | 'musicVideos' | 'videos'
 *   item       — PlayItem da faixa (capa, titulo, letra)
 *   nomeJogador — nome exibido nas mensagens enviadas (opcional)
 *   idJogador  — id do usuário (opcional)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, Music, FileText, MessageSquare } from 'lucide-react'
import { fetchComentarios, postComentario, type SheetRow } from '@/lib/sheetsService'
import { extractDriveId } from '@/lib/playContext'
import type { PlayItem } from '@/lib/playContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Categoria = 'musicas' | 'musicVideos' | 'videos'

interface ChatMessage {
  id: string
  nome: string
  texto: string
  timestamp: string
  /** estado local enquanto aguarda confirmação do GAS */
  _status?: 'pending' | 'error'
}

export interface ForumChatProps {
  topicId: string
  categoria: Categoria
  item: PlayItem
  nomeJogador?: string
  idJogador?: string
}

// ─── Emojis rápidos ───────────────────────────────────────────────────────────
const QUICK_EMOJIS = ['🔥', '🎵', '💯', '🎤', '🎸', '🥁', '🎹', '🎺', '👏', '❤️', '😮', '🕺', '💃', '🎧']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function driveThumb(capa: string, size = 300): string {
  if (!capa) return ''
  const id = extractDriveId(capa) ?? (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null)
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`
  return capa
}

function rowToMessage(row: SheetRow, idx: number): ChatMessage {
  return {
    id:        row['id_comentario'] ?? row['id'] ?? String(idx),
    nome:      row['nome_jogador']  ?? row['nomeJogador'] ?? row['autor'] ?? 'Anônimo',
    texto:     row['comentario']   ?? row['texto'] ?? '',
    timestamp: row['timestamp']    ?? row['data']  ?? '',
  }
}

function formatTimestamp(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ForumChat({
  topicId,
  categoria,
  item,
  nomeJogador = 'Visitante',
  idJogador   = 'anon',
}: ForumChatProps) {
  const [aba, setAba]           = useState<'chat' | 'letra'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [texto, setTexto]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)
  const pollingRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Carrega comentários ──────────────────────────────────────────────
  const carregarComentarios = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const rows = await fetchComentarios(categoria, topicId)
      setMessages(rows.map(rowToMessage))
    } catch {
      // falha silenciosa no polling
    } finally {
      if (!silent) setLoading(false)
    }
  }, [categoria, topicId])

  // Carga inicial + polling a cada 15s
  useEffect(() => {
    carregarComentarios()
    pollingRef.current = setInterval(() => carregarComentarios(true), 15_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [carregarComentarios])

  // Scroll para o final ao receber novas mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Envio ────────────────────────────────────────────────────────────
  const enviar = useCallback(async (textoFinal: string) => {
    const t = textoFinal.trim()
    if (!t || sending) return

    const tempId = `_pending_${Date.now()}`
    const tempMsg: ChatMessage = {
      id: tempId,
      nome: nomeJogador,
      texto: t,
      timestamp: new Date().toISOString(),
      _status: 'pending',
    }

    // Optimistic update
    setMessages((prev) => [...prev, tempMsg])
    setTexto('')
    setSending(true)

    try {
      await postComentario({
        action:      'novoComentario',
        categoria:   categoria === 'musicVideos' ? 'musicvideos' : categoria,
        idTopico:    topicId,
        idJogador,
        nomeJogador,
        comentario:  t,
      })
      // Confirma: remove pending e recarrega
      await carregarComentarios(true)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } catch {
      // Marca mensagem como erro
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, _status: 'error' } : m)
      )
    } finally {
      setSending(false)
    }
  }, [sending, nomeJogador, categoria, topicId, idJogador, carregarComentarios])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar(texto)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background rounded-2xl overflow-hidden border border-white/[0.06]">

      {/* Header — capa + título + abas */}
      <div className="flex-shrink-0">
        {item.capa && (
          <div className="relative w-full aspect-[3/1] overflow-hidden">
            <img
              src={driveThumb(item.capa, 600)}
              alt={item.titulo}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-xs font-black uppercase tracking-tight truncate">{item.titulo}</p>
              {item.artista && (
                <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
              )}
            </div>
          </div>
        )}

        {/* Abas Chat / Letra */}
        <div className="flex border-b border-white/[0.06]">
          {(['chat', 'letra'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                aba === a
                  ? 'text-primary border-b-2 border-primary -mb-px'
                  : 'text-muted-foreground'
              }`}
            >
              {a === 'chat'
                ? <><MessageSquare className="size-3" /> Chat</>
                : <><FileText className="size-3" /> Letra</>
              }
            </button>
          ))}
        </div>
      </div>

      {/* ── Aba Letra ── */}
      {aba === 'letra' && (
        <div className="flex-1 overflow-y-auto p-4">
          {item.letra ? (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
              {item.letra}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Music className="size-8 text-muted-foreground/20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                Letra não disponível
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Chat ── */}
      {aba === 'chat' && (
        <>
          {/* Lista de mensagens */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {loading ? (
              // Skeleton de carregamento
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`flex ${ i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className="space-y-1 max-w-[70%]">
                      <div className="h-2 w-16 rounded-full bg-white/[0.05] animate-pulse" />
                      <div className="h-8 rounded-2xl bg-white/[0.05] animate-pulse" style={{ width: `${120 + i * 20}px` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <MessageSquare className="size-8 text-muted-foreground/20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                  Seja o primeiro a comentar
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.nome === nomeJogador
                return (
                  <div key={msg.id} className={`flex ${ isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${ isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      {!isOwn && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
                          {msg.nome}
                        </span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                          msg._status === 'error'
                            ? 'bg-red-500/20 border border-red-500/30 text-red-300'
                            : isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-white/[0.06] text-foreground rounded-bl-sm'
                        } ${msg._status === 'pending' ? 'opacity-60' : ''}`}
                      >
                        {msg.texto}
                        {msg._status === 'pending' && (
                          <span className="ml-1.5 text-[9px] opacity-60">enviando…</span>
                        )}
                        {msg._status === 'error' && (
                          <span className="ml-1.5 text-[9px]">⚠ falhou</span>
                        )}
                      </div>
                      {msg.timestamp && (
                        <span className="text-[9px] text-muted-foreground/40 px-1">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Barra de emojis rápidos */}
          <div className="flex-shrink-0 px-3 py-1.5 border-t border-white/[0.04] flex gap-1 overflow-x-auto scrollbar-none">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => enviar(emoji)}
                className="text-base flex-shrink-0 active:scale-110 transition-transform"
                aria-label={`Enviar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 flex items-end gap-2 px-3 py-2 border-t border-white/[0.06]">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Comentar… (Enter para enviar)"
              rows={1}
              className="flex-1 resize-none bg-white/[0.05] border border-white/[0.08] rounded-2xl px-3 py-2 text-xs outline-none focus:border-primary/40 transition-colors max-h-28 overflow-y-auto leading-relaxed"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={() => enviar(texto)}
              disabled={!texto.trim() || sending}
              className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center flex-shrink-0 disabled:opacity-40 transition-opacity active:scale-95"
              aria-label="Enviar comentário"
            >
              <Send className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
