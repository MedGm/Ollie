import { useState } from 'react'
import { useModelsStore } from '../store/modelsStore'
import { Download, Trash2, Info, Check, X } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { useSettingsStore } from '../store/settingsStore'
import ProgressBar from './ProgressBar'
import ModelInfoModal from './ModelInfoModal'
import type { ModelInfo } from '../store/modelsStore'

const RECOMMENDED_MODELS = [
	{ name: 'llama3.2', description: 'Meta\'s latest lightweight model, great for speed.', size: '2.0 GB', tags: ['Fast', 'General'] },
	{ name: 'deepseek-r1:1.5b', description: 'Excellent reasoning capabilities, distilled from R1.', size: '1.2 GB', tags: ['Reasoning', 'Smart'] },
	{ name: 'mistral', description: 'Strong all-rounder with good reasoning.', size: '4.1 GB', tags: ['Balanced'] },
	{ name: 'gemma2:2b', description: 'Google\'s open model with high performance.', size: '1.6 GB', tags: ['General'] },
	{ name: 'qwen2.5-coder:1.5b', description: 'Specialized for code generation and analysis.', size: '1.0 GB', tags: ['Coding'] },
]

const RECOMMENDED_VISION_MODELS = [
	{ name: 'moondream', description: 'Tiny but mighty vision model. Runs fast on any device.', size: '1.7 GB', tags: ['Vision', 'Fast'] },
	{ name: 'llava', description: 'The classic open vision assistant. Reliable performance.', size: '4.5 GB', tags: ['Vision', 'Balanced'] },
	{ name: 'qwen2.5-vl:3b', description: 'State-of-the-art visual understanding from Qwen.', size: '3.2 GB', tags: ['Vision', 'Smart'] },
]

export default function ModelPicker() {
	const { models, fetchModels, pullModel, deleteModel, showModel, pulls } = useModelsStore()
	const { setCurrentModel, currentModel } = useChatStore()
	const { setDefaultModel, saveSettingsToBackend, defaultModel } = useSettingsStore()
	const [newModel, setNewModel] = useState('')
	const [selectedModelInfo, setSelectedModelInfo] = useState<{ name: string, info: ModelInfo } | null>(null)

	return (
		<div className="space-y-6">
			<div className="flex gap-3">
				<input
					value={newModel}
					onChange={(e) => setNewModel(e.target.value)}
					placeholder="llama3:instruct"
					className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
				/>
				<button
					onClick={() => newModel.trim() && pullModel(newModel.trim())}
					className="px-6 py-3 bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white rounded-xl font-medium shadow-sm hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
				>
					Pull
				</button>
				<button
					onClick={fetchModels}
					className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200 transform hover:-translate-y-0.5"
				>
					Refresh
				</button>
			</div>

			<div className="flex justify-end -mt-3 mb-2">
				<button
					onClick={() => import('@tauri-apps/plugin-shell').then(({ open }) => open('https://ollama.com/library'))}
					className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
				>
					Browse available models on Ollama Library
				</button>
			</div>

			{/* Active pulls moved to top for visibility */}
			{Object.entries(pulls).length > 0 && (
				<div className="space-y-3 mb-6">
					<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
						<Download size={16} className="text-gray-900" />
						Active Downloads
					</h3>
					{Object.entries(pulls).map(([id, p]: any) => (
						<div key={id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm border-l-4 border-l-gray-900">
							<div className="flex items-center justify-between mb-3">
								<div className="text-md font-medium text-gray-900">{p.name}</div>
								<div className="flex items-center gap-2">
									<div className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
										{p.status}
									</div>
									{p.status !== 'complete' && p.status !== 'error' && (
										<button
											onClick={() => useModelsStore.getState().cancelPull(id)}
											className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors"
											title="Stop download"
										>
											<X size={14} />
										</button>
									)}
								</div>
							</div>
							{p.progress && (
								<div className="space-y-2">
									{(() => {
										const prog = p.progress || {}
										const completed = Number(prog.completed ?? prog.downloaded ?? 0)
										const total = Number(prog.total ?? prog.size ?? 0)
										const percent = total > 0 ? Math.floor((completed / total) * 100) : 0
										return <ProgressBar value={percent} />
									})()}
									<div className="flex justify-between text-xs text-gray-500 font-mono">
										<span>
											{(() => {
												const prog = p.progress || {}
												const completed = Number(prog.completed ?? prog.downloaded ?? 0)
												const total = Number(prog.total ?? prog.size ?? 0)
												return total > 0 ? `${(completed / 1e6).toFixed(1)}MB / ${(total / 1e6).toFixed(1)}MB` : p.status
											})()}
										</span>
										<span>
											{(() => {
												const prog = p.progress || {}
												const completed = Number(prog.completed ?? prog.downloaded ?? 0)
												const total = Number(prog.total ?? prog.size ?? 0)
												return total > 0 ? `${Math.floor((completed / total) * 100)}%` : ''
											})()}
										</span>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			)}


			{/* Recommended Models */}
			<div className="space-y-3">
				<h3 className="text-sm font-semibold text-gray-900">Recommended Models</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{RECOMMENDED_MODELS.filter(rm => !models.some(m => m.name.startsWith(rm.name.split(':')[0]))).map((rm) => (
						<div key={rm.name} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
							<div className="flex justify-between items-start mb-2">
								<div className="font-semibold text-gray-900">{rm.name}</div>
								<div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{rm.size}</div>
							</div>
							<p className="text-sm text-gray-600 mb-4 flex-1">{rm.description}</p>
							<div className="flex items-center justify-between mt-auto">
								<div className="flex gap-2">
									{rm.tags.map(tag => (
										<span key={tag} className="text-[10px] font-medium px-2 py-1 bg-gray-50 text-gray-600 rounded-md border border-gray-100">
											{tag}
										</span>
									))}
								</div>
								<button
									onClick={() => pullModel(rm.name)}
									className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
									title={`Download ${rm.name}`}
								>
									<Download size={16} />
								</button>
							</div>
						</div>
					))}
					{RECOMMENDED_MODELS.every(rm => models.some(m => m.name.startsWith(rm.name.split(':')[0]))) && (
						<div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
							All recommended chat models are installed! 🎉
						</div>
					)}
				</div>
			</div>

			{/* Recommended Vision Models */}
			<div className="space-y-3">
				<h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
					<span>Recommended Vision Models</span>
					<span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">For images</span>
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{RECOMMENDED_VISION_MODELS.filter(rm => !models.some(m => m.name.startsWith(rm.name.split(':')[0]))).map((rm) => (
						<div key={rm.name} className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
							<div className="flex justify-between items-start mb-2">
								<div className="font-semibold text-gray-900">{rm.name}</div>
								<div className="text-xs text-gray-500 bg-white/50 px-2 py-1 rounded-lg">{rm.size}</div>
							</div>
							<p className="text-sm text-gray-600 mb-4 flex-1">{rm.description}</p>
							<div className="flex items-center justify-between mt-auto">
								<div className="flex gap-2">
									{rm.tags.map(tag => (
										<span key={tag} className="text-[10px] font-medium px-2 py-1 bg-white/50 text-purple-700 rounded-md border border-purple-100">
											{tag}
										</span>
									))}
								</div>
								<button
									onClick={() => pullModel(rm.name)}
									className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
									title={`Download ${rm.name}`}
								>
									<Download size={16} />
								</button>
							</div>
						</div>
					))}
					{RECOMMENDED_VISION_MODELS.every(rm => models.some(m => m.name.startsWith(rm.name.split(':')[0]))) && (
						<div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
							All recommended vision models are installed! 👁️
						</div>
					)}
				</div>
			</div>

			<div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
				{models.map((m, index) => (
					<div key={m.name} className={`p-4 flex items-center justify-between gap-4 group transition-all duration-200 hover:bg-gray-50 ${index !== models.length - 1 ? 'border-b border-gray-100' : ''}`}>
						<div className="min-w-0 flex-1">
							<div className="text-sm font-semibold text-gray-900 truncate mb-1">{m.name}</div>
							<div className="text-xs text-gray-500 truncate">{(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB</div>
						</div>
						<div className="flex items-center gap-2 flex-shrink-0">
							<button className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 ${currentModel === m.name
								? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-sm'
								: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
								}`}
								onClick={() => setCurrentModel(m.name)}
							>
								{currentModel === m.name ? 'In use' : 'Use'}
							</button>
							<button
								className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700"
								onClick={async () => {
									const info = await showModel(m.name)
									if (info) setSelectedModelInfo({ name: m.name, info })
								}}
								title="Model Info"
							>
								<Info size={16} />
							</button>
							<button className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700" onClick={() => pullModel(m.name)} title="Update Model">
								<Download size={16} />
							</button>
							<button className="p-2.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-xl transition-all duration-200" onClick={() => deleteModel(m.name)} title="Delete Model">
								<Trash2 size={16} />
							</button>
							<button
								className={`p-2.5 rounded-xl transition-all duration-200 ${defaultModel === m.name
									? 'text-green-600 bg-green-50'
									: 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
									}`}
								title={defaultModel === m.name ? 'Default model' : 'Set as default'}
								onClick={async () => { setDefaultModel(m.name); await saveSettingsToBackend(); }}
							>
								<Check size={16} />
							</button>
						</div>
					</div>
				))}
			</div>



			{selectedModelInfo && (
				<ModelInfoModal
					modelName={selectedModelInfo.name}
					info={selectedModelInfo.info}
					onClose={() => setSelectedModelInfo(null)}
				/>
			)}
		</div>
	)
}
