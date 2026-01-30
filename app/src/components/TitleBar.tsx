import { Minus, Square, X, Maximize2 } from 'lucide-react'
import { Window } from '@tauri-apps/api/window'
import { useState, useEffect } from 'react'

export default function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const appWindow = Window.getCurrent()

    useEffect(() => {
        const checkMaximized = async () => {
            setIsMaximized(await appWindow.isMaximized())
        }

        // Check initially
        checkMaximized()

        // Listen to resize to update UI if native snap happens
        const unlisten = appWindow.listen('tauri://resize', checkMaximized)

        return () => {
            unlisten.then(f => f())
        }
    }, [])

    const minimize = () => appWindow.minimize()
    const toggleMaximize = async () => {
        const maximized = await appWindow.isMaximized()
        if (maximized) {
            appWindow.unmaximize()
        } else {
            appWindow.maximize()
        }
        setIsMaximized(!maximized)
    }
    const close = () => appWindow.close()

    return (
        <div data-tauri-drag-region className="h-9 bg-white border-b border-gray-200 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-50">
            {/* Title / Drag Area */}
            <div className="flex-1 h-full flex items-center px-4" data-tauri-drag-region>
                <span className="text-xs font-semibold text-gray-500 pointer-events-none tracking-wide">Ollie</span>
            </div>

            {/* Window Controls */}
            <div className="flex h-full">
                <button
                    onClick={minimize}
                    className="h-full w-12 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={toggleMaximize}
                    className="h-full w-12 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                >
                    {isMaximized ? <Square size={12} fill="currentColor" className="opacity-70" /> : <Maximize2 size={12} />}
                </button>
                <button
                    onClick={close}
                    className="h-full w-12 flex items-center justify-center text-gray-500 hover:bg-red-500 hover:text-white transition-colors focus:outline-none"
                    tabIndex={-1}
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}
