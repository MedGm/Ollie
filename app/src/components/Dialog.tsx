import { AlertTriangle, Info } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DialogProps {
    isOpen: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'info'
    type?: 'confirm' | 'alert'
    onConfirm: () => void
    onCancel: () => void
}

export default function Dialog({
    isOpen,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'info',
    type = 'confirm',
    onConfirm,
    onCancel
}: DialogProps) {
    const [show, setShow] = useState(false)

    useEffect(() => {
        let timer: NodeJS.Timeout
        if (isOpen) {
            setShow(true)
        } else {
            timer = setTimeout(() => setShow(false), 200)
        }
        return () => clearTimeout(timer)
    }, [isOpen])

    if (!show && !isOpen) return null

    return (
        <div
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-200 ${isOpen ? 'bg-black/40 backdrop-blur-sm opacity-100' : 'bg-black/0 backdrop-blur-0 opacity-0 pointer-events-none'
                }`}
        >
            <div
                className={`bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transition-all duration-200 transform ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
                    }`}
            >
                <div className="p-6 pb-2">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl flex-shrink-0 ${variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                            {variant === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {description}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-gray-50/50 border-t border-gray-100 mt-4">
                    {type === 'confirm' && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-xl shadow-sm transition-all duration-200 ${variant === 'danger'
                            ? 'bg-red-600 hover:bg-red-700 hover:shadow-red-500/20'
                            : 'bg-gray-900 hover:bg-gray-800 hover:shadow-gray-900/20'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
