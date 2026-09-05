import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Pencil, X, Zap, Bot, Brain, Sparkles, Plug, Globe } from 'lucide-react';
import { useSettingsStore, type ProviderConfig } from '../store/settingsStore';

const PROVIDER_DEFAULTS: Record<string, { name: string; base_url: string; icon: typeof Bot }> = {
    ollama: { name: 'Ollama (Local)', base_url: 'http://localhost:11434', icon: Zap },
    openai: { name: 'OpenAI', base_url: 'https://api.openai.com', icon: Bot },
    anthropic: { name: 'Anthropic', base_url: 'https://api.anthropic.com', icon: Brain },
    google: { name: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com', icon: Sparkles },
    other: { name: 'Custom Provider', base_url: 'https://api.example.com', icon: Globe },
};

export default function ProviderSettings() {
    // Use global store for providers
    const {
        providers,
        activeProviderId,
        addProvider,
        updateProvider,
        deleteProvider,
        setActiveProviderId,
        loadSettingsFromBackend,
        keyringAvailable
    } = useSettingsStore();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    // New provider form state
    const [newProviderType, setNewProviderType] = useState<ProviderConfig['provider_type']>('openai');
    const [newName, setNewName] = useState('');
    const [newApiKey, setNewApiKey] = useState('');
    const [newBaseUrl, setNewBaseUrl] = useState('');

    // Reload from backend on mount
    useEffect(() => {
        loadSettingsFromBackend();
    }, [loadSettingsFromBackend]);

    const handleAddProvider = async () => {
        if (!newName.trim()) {
            setError('Provider name is required');
            return;
        }

        if (newProviderType !== 'ollama' && !newApiKey.trim()) {
            setError('API key is required for cloud providers');
            return;
        }

        // Require base_url for 'other' type
        if (newProviderType === 'other' && !newBaseUrl.trim()) {
            setError('Base URL is required for custom providers');
            return;
        }

        const config: ProviderConfig = {
            id: `${newProviderType}-${Date.now()}`,
            name: newName,
            provider_type: newProviderType,
            api_key: newApiKey || undefined,
            base_url: newBaseUrl || PROVIDER_DEFAULTS[newProviderType]?.base_url,
            enabled: true,
        };

        try {
            setLoading(true);
            await addProvider(config);
            setShowAddForm(false);
            setNewName('');
            setNewApiKey('');
            setNewBaseUrl('');
            setError(null);
        } catch (e) {
            setError(`Failed to add provider: ${e}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProvider = async (config: ProviderConfig) => {
        try {
            setLoading(true);
            await updateProvider(config);
            setEditingProvider(null);
            setError(null);
        } catch (e) {
            setError(`Failed to update provider: ${e}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProvider = async (id: string) => {
        if (id === 'ollama-default') {
            setError('Cannot delete the default Ollama provider');
            return;
        }

        if (!confirm('Are you sure you want to remove this provider?')) return;

        try {
            setLoading(true);
            await deleteProvider(id);
            setError(null);
        } catch (e) {
            setError(`Failed to delete provider: ${e}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSetActive = async (id: string) => {
        try {
            // Call backend to persist
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('provider_set_active', { id });
            // Update store (which TopBar/ModelSelector use)
            setActiveProviderId(id);
            setError(null);
        } catch (e) {
            setError(`Failed to set active provider: ${e}`);
        }
    };

    const getProviderIcon = (type: string) => {
        const IconComponent = PROVIDER_DEFAULTS[type]?.icon || Plug;
        return <IconComponent size={18} />;
    };

    if (loading) {
        return <div className="py-8 text-center text-gray-500">Loading providers...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Connect to cloud LLM providers for enhanced capabilities</p>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Add Provider
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                </div>
            )}

            {!keyringAvailable && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                    No system keyring detected — API keys are stored in plaintext. Install{' '}
                    <code className="px-1 bg-amber-100 rounded">gnome-keyring</code> or{' '}
                    <code className="px-1 bg-amber-100 rounded">kwallet</code> for secure storage.
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                    {/* Provider Type Selection */}
                    <div className="flex flex-wrap p-1 bg-gray-200 rounded-lg w-max gap-1">
                        {(['openai', 'anthropic', 'google', 'other'] as const).map((type) => {
                            const Icon = PROVIDER_DEFAULTS[type].icon;
                            return (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setNewProviderType(type);
                                        setNewName(type === 'other' ? '' : PROVIDER_DEFAULTS[type].name);
                                        setNewBaseUrl('');
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${newProviderType === type
                                        ? 'bg-white shadow-sm text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    <Icon size={14} />
                                    {type === 'openai' ? 'OpenAI' : type === 'anthropic' ? 'Claude' : type === 'google' ? 'Gemini' : 'Other'}
                                </button>
                            );
                        })}
                    </div>

                    {newProviderType === 'other' && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 space-y-2">
                            <p><strong>OpenAI-compatible APIs:</strong> Works with providers using the OpenAI format.</p>
                            <div className="grid grid-cols-1 gap-1 text-xs font-mono bg-blue-100/50 p-2 rounded">
                                <div>Groq: <span className="select-all">https://api.groq.com/openai</span></div>
                                <div>OpenRouter: <span className="select-all">https://openrouter.ai/api</span></div>
                                <div>Together AI: <span className="select-all">https://api.together.xyz</span></div>
                                <div>LM Studio: <span className="select-all">http://localhost:1234</span></div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                                placeholder="My OpenAI Account"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                            <input
                                type="password"
                                value={newApiKey}
                                onChange={(e) => setNewApiKey(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                                placeholder="sk-..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Base URL (Optional)</label>
                            <input
                                type="url"
                                value={newBaseUrl}
                                onChange={(e) => setNewBaseUrl(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                                placeholder={PROVIDER_DEFAULTS[newProviderType]?.base_url}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Override for compatible APIs (Azure, vLLM, LM Studio)
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setNewApiKey('');
                                setError(null);
                            }}
                            className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddProvider}
                            disabled={!newName || !newApiKey}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >
                            Save Provider
                        </button>
                    </div>
                </div>
            )}

            {/* Provider List */}
            <div className="space-y-3">
                {providers.filter(p => p.provider_type !== 'ollama').length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                        <Plug size={24} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No cloud providers configured</p>
                        <p className="text-xs text-gray-400 mt-1">Add a provider to get started with cloud models</p>
                    </div>
                ) : (
                    providers.filter(p => p.provider_type !== 'ollama').map((provider) => (
                        <div
                            key={provider.id}
                            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                        >
                            {editingProvider?.id === provider.id ? (
                                <EditProviderForm
                                    provider={editingProvider}
                                    onSave={handleUpdateProvider}
                                    onCancel={() => setEditingProvider(null)}
                                />
                            ) : (
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${activeProviderId === provider.id ? 'bg-green-500' : 'bg-gray-300'
                                            }`} />
                                        <div className="flex items-center gap-2 text-gray-600">
                                            {getProviderIcon(provider.provider_type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium text-gray-900">{provider.name}</h3>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase font-bold tracking-wider">
                                                    {provider.provider_type}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {provider.api_key ? '••••••••' : 'No API key'} • {provider.base_url || 'Default URL'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {activeProviderId === provider.id ? (
                                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded-lg">
                                                <Check size={12} />
                                                Active
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleSetActive(provider.id)}
                                                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
                                            >
                                                Use
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setEditingProvider({ ...provider })}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        {provider.id !== 'ollama-default' && (
                                            <button
                                                onClick={() => handleDeleteProvider(provider.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

interface EditProviderFormProps {
    provider: ProviderConfig;
    onSave: (provider: ProviderConfig) => void;
    onCancel: () => void;
}

function EditProviderForm({ provider, onSave, onCancel }: EditProviderFormProps) {
    const [name, setName] = useState(provider.name);
    const [apiKey, setApiKey] = useState(provider.api_key || '');
    const [baseUrl, setBaseUrl] = useState(provider.base_url || '');

    return (
        <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                </div>
                {provider.provider_type !== 'ollama' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                        />
                    </div>
                )}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Base URL</label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X size={16} />
                </button>
                <button
                    onClick={() => onSave({ ...provider, name, api_key: apiKey || undefined, base_url: baseUrl || undefined })}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                    <Check size={16} />
                </button>
            </div>
        </div>
    );
}
