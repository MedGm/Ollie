import { useState } from 'react'
import { Sliders } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'

interface ParametersPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function ParametersPanel({ isOpen, onClose }: ParametersPanelProps) {
  const {
    defaultParams,
    setDefaultParams,
    systemPrompt,
    setSystemPrompt,
    saveSettingsToBackend
  } = useSettingsStore()

  const [localParams, setLocalParams] = useState(defaultParams)
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt)
  const [hasChanges, setHasChanges] = useState(false)

  const handleParamChange = (param: string, value: number) => {
    const newParams = { ...localParams, [param]: value }
    setLocalParams(newParams)
    setHasChanges(true)
  }

  const handleSystemPromptChange = (value: string) => {
    setLocalSystemPrompt(value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    setDefaultParams(localParams)
    setSystemPrompt(localSystemPrompt)
    await saveSettingsToBackend()
    setHasChanges(false)
  }

  const handleReset = () => {
    setLocalParams(defaultParams)
    setLocalSystemPrompt(systemPrompt)
    setHasChanges(false)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Transparent backdrop for click-outside */}
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} />

      {/* Floating Panel */}
      <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <Sliders size={16} className="text-gray-900" />
            <h2 className="text-sm font-semibold text-gray-900">Parameters</h2>
          </div>
          <button
            onClick={handleReset}
            className="text-[10px] uppercase font-bold tracking-wider text-gray-400 hover:text-blue-600 transition-colors"
            title="Reset to defaults"
            disabled={!hasChanges}
          >
            Reset
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* System Prompt */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              System Prompt
            </label>
            <textarea
              value={localSystemPrompt}
              onChange={(e) => handleSystemPromptChange(e.target.value)}
              placeholder="e.g. You are a helpful assistant..."
              className="w-full h-20 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-300 text-xs resize-none placeholder:text-gray-400"
            />
          </div>

          <div className="h-px bg-gray-100" />

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Temperature</label>
              <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                {localParams.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localParams.temperature}
              onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Top K */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Top K</label>
              <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                {localParams.topK}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={localParams.topK}
              onChange={(e) => handleParamChange('topK', parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
          </div>

          {/* Top P */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Top P</label>
              <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                {localParams.topP.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={localParams.topP}
              onChange={(e) => handleParamChange('topP', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">Max Tokens</label>
              <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                {localParams.maxTokens}
              </span>
            </div>
            <input
              type="range"
              min="256"
              max="8192"
              step="256"
              value={localParams.maxTokens}
              onChange={(e) => handleParamChange('maxTokens', parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${hasChanges
              ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            Save
          </button>
        </div>
      </div>
    </>
  )
}
