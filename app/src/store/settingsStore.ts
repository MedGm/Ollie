import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface ProviderConfig {
  id: string
  name: string
  provider_type: 'ollama' | 'openai' | 'anthropic' | 'google' | 'other'
  api_key?: string
  base_url?: string
  enabled: boolean
}

interface SettingsState {
  // Connection settings
  serverUrl: string
  serverPort: number
  defaultModel: string
  systemPrompt: string
  defaultParams: {
    temperature: number
    topK: number
    topP: number
    maxTokens: number
  }
  theme: 'light' | 'dark' | 'system'

  // Mode selection
  appMode: 'local' | 'cloud'
  setupCompleted: boolean
  keyringAvailable: boolean

  // Provider management
  providers: ProviderConfig[]
  activeProviderId: string

  // Actions - Basic settings
  setServerUrl: (url: string) => void
  setServerPort: (port: number) => void
  setDefaultModel: (model: string) => void
  setSystemPrompt: (prompt: string) => void
  setDefaultParams: (params: Partial<SettingsState['defaultParams']>) => void
  setTheme: (theme: SettingsState['theme']) => void

  // Actions - Mode
  setAppMode: (mode: 'local' | 'cloud') => Promise<void>
  setSetupCompleted: (completed: boolean) => void

  // Actions - Providers
  setProviders: (providers: ProviderConfig[]) => void
  setActiveProviderId: (id: string) => void
  addProvider: (provider: ProviderConfig) => Promise<void>
  updateProvider: (provider: ProviderConfig) => Promise<void>
  deleteProvider: (id: string) => Promise<void>

  // Backend sync
  loadSettingsFromBackend: () => Promise<void>
  saveSettingsToBackend: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
      // Defaults
      serverUrl: 'http://localhost',
      serverPort: 11434,
      defaultModel: '',
      systemPrompt: '',
      defaultParams: {
        temperature: 0.8,
        topK: 40,
        topP: 0.9,
        maxTokens: 2048,
      },
      theme: 'light',
      appMode: 'local',
      setupCompleted: false,
      keyringAvailable: true,
      providers: [],
      activeProviderId: 'ollama-default',

      // Basic settings actions
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setServerPort: (serverPort) => set({ serverPort }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setDefaultParams: (params) =>
        set((state) => ({
          defaultParams: { ...state.defaultParams, ...params }
        })),
      setTheme: (theme) => set({ theme }),

      // Mode actions
      setAppMode: async (appMode) => {
        let newActiveProviderId = ''

        // Update local state first to get the new provider ID
        set((state) => {
          console.log('Switching App Mode to:', appMode)
          newActiveProviderId = state.activeProviderId

          try {
            const currentProviders = state.providers || []

            if (appMode === 'local') {
              const local = currentProviders.find(p => p.provider_type === 'ollama')
              if (local) {
                newActiveProviderId = local.id
                console.log('Switched to Local Provider:', local.id)
              } else {
                console.warn('No Ollama provider found when switching to local mode')
              }
            } else {
              // Cloud Mode
              const currentId = state.activeProviderId || ''
              const isOllama = (id: string) => {
                const p = currentProviders.find(cp => cp.id === id)
                return p?.provider_type === 'ollama' || id.includes('ollama')
              }

              if (isOllama(currentId)) {
                const cloud = currentProviders.find(p => p.provider_type !== 'ollama')
                if (cloud) {
                  newActiveProviderId = cloud.id
                  console.log('Switched to Cloud Provider:', cloud.id)
                } else {
                  console.warn('No managed cloud providers found.')
                  newActiveProviderId = 'cloud-placeholder'
                }
              }
            }
          } catch (e) {
            console.error('Error switching provider mode:', e)
          }

          return { appMode, activeProviderId: newActiveProviderId }
        })

        // Persist to backend immediately
        try {
          const s = get()
          const server_url = `${s.serverUrl}:${s.serverPort}`
          const payload = {
            server_url,
            default_model: s.defaultModel || undefined,
            system_prompt: s.systemPrompt || undefined,
            default_params: {
              temperature: s.defaultParams.temperature,
              top_k: s.defaultParams.topK,
              top_p: s.defaultParams.topP,
              max_tokens: s.defaultParams.maxTokens,
            },
            theme: s.theme,
            app_mode: appMode, // Use the new mode directly
            setup_completed: s.setupCompleted,
            providers: s.providers,
            active_provider_id: newActiveProviderId, // Use the newly computed ID
          }
          await invoke('settings_set', { settings: payload })
          console.log('Settings persisted to backend after mode change')
        } catch (e) {
          console.error('Failed to persist settings after mode change:', e)
        }
      },
      setSetupCompleted: (setupCompleted) => set({ setupCompleted }),

      // Provider actions
      setProviders: (providers) => set({ providers }),
      setActiveProviderId: (activeProviderId) => set({ activeProviderId }),

      addProvider: async (provider) => {
        try {
          const updated = await invoke<ProviderConfig[]>('provider_add', { config: provider })
          set({ providers: updated })
        } catch (e) {
          console.error('Failed to add provider:', e)
          throw e
        }
      },

      updateProvider: async (provider) => {
        try {
          const updated = await invoke<ProviderConfig[]>('provider_update', { config: provider })
          set({ providers: updated })
        } catch (e) {
          console.error('Failed to update provider:', e)
          throw e
        }
      },

      deleteProvider: async (id) => {
        try {
          const updated = await invoke<ProviderConfig[]>('provider_delete', { id })
          set({ providers: updated })
        } catch (e) {
          console.error('Failed to delete provider:', e)
          throw e
        }
      },

      // Backend sync
      loadSettingsFromBackend: async () => {
        try {
          interface BackendSettings {
            server_url?: string
            default_model?: string
            system_prompt?: string
            default_params?: { temperature?: number; top_k?: number; top_p?: number; max_tokens?: number }
            theme?: string
            app_mode?: string
            setup_completed?: boolean
            providers?: ProviderConfig[]
            active_provider_id?: string
            keyring_available?: boolean
          }
          const s = await invoke<BackendSettings>('settings_get')

          // Parse server URL
          const url: string = s.server_url || 'http://localhost:11434'
          let serverUrl = url
          let serverPort = 11434
          try {
            const u = new URL(url)
            serverUrl = `${u.protocol}//${u.hostname}`
            serverPort = Number(u.port) || 11434
          } catch {
            // Keep existing if not a valid URL
          }

          set({
            serverUrl,
            serverPort,
            defaultModel: s.default_model || '',
            systemPrompt: s.system_prompt || '',
            defaultParams: {
              temperature: s.default_params?.temperature ?? 0.8,
              topK: s.default_params?.top_k ?? 40,
              topP: s.default_params?.top_p ?? 0.9,
              maxTokens: s.default_params?.max_tokens ?? 2048,
            },
            theme: (s.theme as SettingsState['theme']) || 'light',
            appMode: (s.app_mode as 'local' | 'cloud') || 'local',
            setupCompleted: s.setup_completed ?? false,
            providers: s.providers || [],
            activeProviderId: s.active_provider_id || 'ollama-default',
            keyringAvailable: s.keyring_available ?? true,
          })
        } catch (e) {
          console.warn('settings_get failed; using local settings', e)
        }
      },

      saveSettingsToBackend: async () => {
        const s = get()
        const server_url = `${s.serverUrl}:${s.serverPort}`
        const payload = {
          server_url,
          default_model: s.defaultModel || undefined,
          system_prompt: s.systemPrompt || undefined,
          default_params: {
            temperature: s.defaultParams.temperature,
            top_k: s.defaultParams.topK,
            top_p: s.defaultParams.topP,
            max_tokens: s.defaultParams.maxTokens,
          },
          theme: s.theme,
          app_mode: s.appMode,
          setup_completed: s.setupCompleted,
          providers: s.providers,
          active_provider_id: s.activeProviderId,
        }
        try {
          await invoke('settings_set', { settings: payload })
        } catch (e) {
          console.error('settings_set failed', e)
          throw e
        }
      },
}))