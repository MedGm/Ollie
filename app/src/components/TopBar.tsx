import { Square, Settings2, AlertCircle, Cloud, Zap } from 'lucide-react'
import { useState } from 'react'
import ModelSelector from './ModelSelector'
import ParametersPanel from './ParametersPanel'
import { useOllamaHealth } from '../lib/hooks'
import { useSettingsStore } from '../store/settingsStore'
import { useChatStore } from '../store/chatStore'

export default function TopBar() {
  const { serverUrl, serverPort, appMode, providers, activeProviderId } = useSettingsStore()
  const { isStreaming, stopStreaming } = useChatStore()
  const [parametersOpen, setParametersOpen] = useState(false)

  // Get active provider info
  const activeProvider = providers.find(p => p.id === activeProviderId)
  const providerType = activeProvider?.provider_type || 'ollama'
  const isCloudMode = appMode === 'cloud' && providerType !== 'ollama'

  // Only check Ollama health in local mode
  const fullServerUrl = `${serverUrl}:${serverPort}`
  const { health, isLoading } = useOllamaHealth(isCloudMode ? '' : fullServerUrl)

  return (
    <div className="h-12 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 flex items-center justify-between px-4 gap-4 relative z-10">
      {/* Left Side - Model Selector */}
      <div className="flex items-center gap-3">
        <ModelSelector />

        {/* Parameters Button & Panel Container */}
        <div className="relative">
          <button
            onClick={() => setParametersOpen(!parametersOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-150 border ${parametersOpen
              ? 'bg-gray-100 text-gray-900 border-gray-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-transparent hover:border-gray-200'
              }`}
          >
            <Settings2 size={14} />
            <span className="text-xs font-medium">Parameters</span>
          </button>

          <ParametersPanel
            isOpen={parametersOpen}
            onClose={() => setParametersOpen(false)}
          />
        </div>
      </div>

      {/* Center - Connection Status */}
      <div className="flex items-center gap-3">
        {isCloudMode ? (
          /* Cloud Mode Status */
          <div className="flex items-center gap-2 px-2.5 py-1 bg-purple-50/80 rounded-md">
            <Cloud size={12} className="text-purple-500" />
            <span className="text-xs font-medium text-purple-600">
              {activeProvider?.name || 'Cloud'}
            </span>
            {activeProvider?.api_key ? (
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" title="API key configured" />
            ) : (
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" title="No API key" />
            )}
          </div>
        ) : (
          /* Local Mode Status */
          <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-100/80 rounded-md">
            <Zap size={12} className="text-blue-500" />
            {isLoading ? (
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full ${health.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            )}
            <span className="text-xs font-medium text-gray-600">
              {isLoading ? 'Connecting...' : health.connected ? 'Connected' : 'Disconnected'}
            </span>
            {health.error && (
              <div className="group relative">
                <AlertCircle size={12} className="text-red-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-xs">
                  {health.error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side - Controls */}
      <div className="flex items-center gap-3">
        {isStreaming && (
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-all duration-150 text-xs font-medium"
            onClick={stopStreaming}
          >
            <Square size={12} />
            <span>Stop</span>
          </button>
        )}

        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
          <span>Ready</span>
        </div>
      </div>

    </div>
  )
}
