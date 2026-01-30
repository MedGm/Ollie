import { Settings, Database, Plus, Search, Trash2, Activity, Bot } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { invoke } from '@tauri-apps/api/core'
import { useChatStore } from '../store/chatStore'

type ChatMeta = {
  id: string
  created_at: number
  updated_at: number
  model?: string | null
  system_prompt?: string | null
  title?: string | null
  has_messages?: boolean
}

export default function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const { loadChat, createNewChat, currentChatId } = useChatStore()
  const { setView } = useUIStore()

  const refreshChats = async () => {
    try {
      const rows = await invoke<any>('db_list_chats_with_flags', { limit: 200 })
      setChats(rows as ChatMeta[])
      // Load a short preview for each chat (best-effort)
      const list = rows as ChatMeta[]
      const entries: Record<string, string> = {}
      for (const c of list) {
        try {
          if (!c.has_messages) continue
          const msgs = await invoke<any[]>('db_list_messages', { chatId: c.id, limit: 1 })
          if (Array.isArray(msgs) && msgs.length > 0) {
            const m = msgs[0] as any
            const raw = String(m.content || '')
            const oneLine = raw.replace(/\s+/g, ' ').trim()
            const trimmed = oneLine.length > 80 ? oneLine.slice(0, 80) + '…' : oneLine
            entries[c.id] = trimmed
          }
        } catch { }
      }
      setPreviews(entries)
    } catch (e) {
      console.warn('db_list_chats failed', e)
      setChats([])
    }
  }

  useEffect(() => {
    refreshChats()
    const onRefresh = () => refreshChats()
    window.addEventListener('chats-refresh', onRefresh as EventListener)
    return () => window.removeEventListener('chats-refresh', onRefresh as EventListener)
  }, [])

  // simple filter by model or id
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return chats
    return chats.filter(c => (c.model || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [searchQuery, chats])

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-sm">
      {/* Header with Ollama Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 flex items-center justify-center shadow-none">
            <img src="/ollie-logo.png" alt="Ollie" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ollie</h1>
            <p className="text-xs text-gray-500">AI Chat Interface</p>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={async () => {
            const { messages } = useChatStore.getState()
            // Prevent creating a new chat if the current chat is empty (no messages)
            if (currentChatId && messages.length === 0) {
              alert('Finish or start a conversation in the current chat before creating a new one.')
              return
            }
            // If no currentChatId, ensure the most recent chat is not empty either
            if (!currentChatId && chats.length > 0) {
              try {
                const latest = chats[0]
                const rows = await invoke<any>('db_list_messages', { chatId: latest.id, limit: 1 })
                if (Array.isArray(rows) && rows.length === 0) {
                  alert('Your most recent chat is empty. Send a message first before creating a new chat.')
                  return
                }
              } catch { }
            }
            const id = await createNewChat()
            if (id) {
              await refreshChats()
              setView('chat')
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <Plus size={20} />
          <span>New chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white text-sm transition-all duration-200"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot size={20} className="text-gray-400" />
              </div>
              <div className="text-sm font-medium">No conversations yet</div>
              <div className="text-xs text-gray-400 mt-1">Start a new chat to see it here</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center gap-3 group">
                  <button
                    onClick={async () => {
                      // If chat has a preferred model, set it
                      if (c.model) {
                        useChatStore.getState().setCurrentModel(c.model)
                      }
                      await loadChat(c.id, c.system_prompt)
                      setView('chat')
                    }}
                    className={`flex-1 min-w-0 text-left px-4 py-3 rounded-xl border transition-all duration-200 ${currentChatId === c.id
                      ? 'bg-gray-50 border-gray-200 shadow-sm'
                      : 'bg-white hover:bg-gray-50 border-transparent hover:border-gray-100 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {c.title || 'Untitled chat'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-5 mb-1.5">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {c.model || 'Unknown model'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    {previews[c.id] && (
                      <div className="text-xs text-gray-500 truncate ml-5">
                        {previews[c.id]}
                      </div>
                    )}
                  </button>
                  <button
                    title={c.has_messages ? 'Delete chat' : 'Cannot delete an empty chat'}
                    className={`p-2 rounded-lg transition-colors ${c.has_messages
                      ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                      : 'text-gray-200 cursor-not-allowed'
                      }`}
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!c.has_messages) {
                        return
                      }
                      try {
                        const confirmDelete = confirm('Delete this chat? This cannot be undone.')
                        if (!confirmDelete) return
                        const ok = await invoke<boolean>('db_delete_chat', { chatId: c.id })
                        if (ok) {
                          await refreshChats()
                          if (currentChatId === c.id) {
                            // Reset current chat if it was the one deleted
                            useChatStore.getState().clearMessages()
                            useChatStore.getState().setCurrentChatId(null)
                          }
                        }
                      } catch (err) {
                        console.error('Delete chat failed', err)
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="p-6 border-t border-gray-100">
        <div className="space-y-2">
          <button
            onClick={() => setView('monitoring')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 text-sm font-medium"
          >
            <Activity size={20} />
            <span>Monitoring</span>
          </button>
          <button
            onClick={() => setView('models')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 text-sm font-medium"
          >
            <Database size={20} />
            <span>Manage models</span>
          </button>
          <button
            onClick={() => setView('settings')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 text-sm font-medium"
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
