import { ChevronDown, Cpu, AlertCircle, Cloud, Bot, Brain, Sparkles, Plus, Globe } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { useModelsStore } from '../store/modelsStore'
import { useSettingsStore } from '../store/settingsStore'

// Cloud provider model presets (updated Feb 2026)
const CLOUD_MODELS = {
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4' },
  ],
  google: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ],
  other: [], // Custom providers use manual model entry only
}

const PROVIDER_ICONS = {
  openai: Bot,
  anthropic: Brain,
  google: Sparkles,
  ollama: Cpu,
  other: Globe,
}

export default function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customModelId, setCustomModelId] = useState('')
  const { currentModel, setCurrentModel } = useChatStore()
  const { models, isLoading, error, fetchModels } = useModelsStore()
  const { appMode, providers, activeProviderId } = useSettingsStore()

  // Get active provider info
  const activeProvider = providers.find(p => p.id === activeProviderId)
  const providerType = activeProvider?.provider_type || 'ollama'
  const isCloudMode = appMode === 'cloud' && providerType !== 'ollama'

  // Get models based on mode
  const cloudModels = isCloudMode ? (CLOUD_MODELS[providerType as keyof typeof CLOUD_MODELS] || []) : []
  const displayModels = isCloudMode
    ? cloudModels.map(m => ({ name: m.id, displayName: m.name }))
    : models.map(m => ({ name: m.name, displayName: m.name }))

  // Check if current model is custom (not in preset list)
  const isCustomModel = isCloudMode && currentModel && !cloudModels.some(m => m.id === currentModel)

  // Get provider icon
  const ProviderIcon = PROVIDER_ICONS[providerType as keyof typeof PROVIDER_ICONS] || Cloud

  useEffect(() => {
    if (!isCloudMode) {
      fetchModels()
    }
  }, [isCloudMode])

  // Auto-select first cloud model if none selected
  useEffect(() => {
    if (isCloudMode && cloudModels.length > 0 && (!currentModel || !cloudModels.some(m => m.id === currentModel)) && !isCustomModel) {
      setCurrentModel(cloudModels[0].id)
    }
  }, [isCloudMode, activeProviderId, cloudModels])

  const handleUseCustomModel = () => {
    if (customModelId.trim()) {
      setCurrentModel(customModelId.trim())
      setCustomModelId('')
      setShowCustomInput(false)
      setIsOpen(false)
    }
  }

  const selectedModel = displayModels.find(m => m.name === currentModel)
  const displayName = selectedModel?.displayName || (isCustomModel ? currentModel : 'Select a model')

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-all duration-150 min-w-[160px]"
      >
        <ProviderIcon size={14} className="text-gray-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-800 truncate flex-1 text-left">
          {displayName}
        </span>
        {isCustomModel && (
          <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded font-medium">Custom</span>
        )}
        <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[100] max-h-80 overflow-y-auto min-w-[240px]">
          {/* Cloud Mode */}
          {isCloudMode ? (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                {activeProvider?.name || providerType} Models
              </div>
              {cloudModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => { setCurrentModel(model.id); setIsOpen(false) }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${currentModel === model.id ? 'bg-gray-100' : ''}`}
                >
                  <ProviderIcon size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-900">{model.name}</span>
                </button>
              ))}

              {/* Custom Model Section */}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Custom Model
                </div>

                {showCustomInput ? (
                  <div className="px-4 py-2 space-y-2">
                    <input
                      type="text"
                      value={customModelId}
                      onChange={(e) => setCustomModelId(e.target.value)}
                      placeholder="Enter model ID (e.g., gemini-3-flash-preview)"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleUseCustomModel()}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowCustomInput(false); setCustomModelId('') }}
                        className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUseCustomModel}
                        disabled={!customModelId.trim()}
                        className="flex-1 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                      >
                        Use Model
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-purple-600"
                  >
                    <Plus size={14} />
                    <span className="text-sm font-medium">Use Custom Model ID</span>
                  </button>
                )}

                {/* Show current custom model if active */}
                {isCustomModel && (
                  <div className="px-4 py-2 bg-purple-50 flex items-center gap-2">
                    <span className="text-xs text-purple-600">Current:</span>
                    <span className="text-xs font-mono text-purple-800">{currentModel}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Local Mode */
            isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-black rounded-full mx-auto mb-2"></div>
                Loading models...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-600">
                <AlertCircle size={20} className="mx-auto mb-2" />
                <div className="text-sm">Failed to load models</div>
                <div className="text-xs text-gray-500 mt-1">{error}</div>
                <button
                  onClick={fetchModels}
                  className="mt-2 px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded"
                >
                  Retry
                </button>
              </div>
            ) : displayModels.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No models found. Pull one in the Models tab.
              </div>
            ) : (
              <div className="py-2">
                <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Local Ollama Models
                </div>
                {displayModels.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => { setCurrentModel(model.name); setIsOpen(false) }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${currentModel === model.name ? 'bg-gray-100' : ''}`}
                  >
                    <Cpu size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-900 truncate">{model.displayName}</span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[99]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
