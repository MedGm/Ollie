import { ArrowUp, Square, ArrowDown, Paperclip, X, FileText, Search, Brain } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import Message from './Message'
import { extractPdfText } from '../lib/pdf'

export default function MainPanel() {
  const [message, setMessage] = useState('')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file', name: string, content: string, preview?: string }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Subscribe to relevant state
  const {
    messages,
    sendMessage,
    currentModel,
    isStreaming,
    stopStreaming
  } = useChatStore()

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior })
    })
    setShouldAutoScroll(true)
    setShowScrollButton(false)
  }

  // Check scroll position to toggle auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    setShouldAutoScroll(isNearBottom)
    setShowScrollButton(!isNearBottom)
  }

  // Scroll when new messages are added (not on every streaming chunk)
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom('smooth')
    }
  }, [messages.length, shouldAutoScroll])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const newAttachments = [...attachments]

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Read as Base64 for Vision
          const reader = new FileReader()
          reader.onload = (e) => {
            if (typeof e.target?.result === 'string') {
              newAttachments.push({ type: 'image', name: file.name, content: e.target.result, preview: e.target.result })
              setAttachments([...newAttachments])
            }
          }
          reader.readAsDataURL(file)
        } else if (file.type === 'application/pdf') {
          // Handle PDF
          try {
            const text = await extractPdfText(file)
            newAttachments.push({ type: 'file', name: file.name, content: text })
            setAttachments([...newAttachments])
          } catch (err) {
            console.error('Failed to parse PDF', err)
            alert(`Failed to parse PDF: ${file.name}`)
          }
        } else {
          // Read as Text for context
          const reader = new FileReader()
          reader.onload = (e) => {
            if (typeof e.target?.result === 'string') {
              newAttachments.push({ type: 'file', name: file.name, content: e.target.result })
              setAttachments([...newAttachments])
            }
          }
          reader.readAsText(file)
        }
      }
    }
  }

  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments]
    newAttachments.splice(index, 1)
    setAttachments(newAttachments)
  }

  const handleSendMessage = async () => {
    if ((!message.trim() && attachments.length === 0) || isStreaming || !currentModel) return

    let finalContent = message.trim()
    const images: string[] = []

    // Process attachments
    for (const att of attachments) {
      if (att.type === 'file') {
        const fileContent = `\n\n--- File: ${att.name} ---\n${att.content}\n---------------------\n`
        finalContent += fileContent
      } else if (att.type === 'image') {
        // Strip the Data URL header mainly for API, but let's see what chatStore expects
        // Ollie expects base64 string. 
        // "data:image/png;base64,..." -> split(',')[1]
        const base64 = att.content.split(',')[1]
        if (base64) images.push(base64)
      }
    }

    setMessage('')
    setAttachments([])
    setShouldAutoScroll(true)

    // Reset textarea height
    const textarea = document.querySelector('textarea')
    if (textarea) {
      textarea.style.height = 'auto'
    }

    await sendMessage(finalContent, undefined, images.length > 0 ? images : undefined)
  }

  const handleStopStreaming = async () => {
    await stopStreaming()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return
      handleSendMessage()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    target.style.height = 'auto'
    target.style.height = `${target.scrollHeight}px`
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white relative">
      {/* Chat Messages Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto scroll-smooth"
      >
        {!hasMessages ? (
          /* Welcome Message */
          <div className="flex flex-col items-center justify-center h-full p-8 max-w-4xl mx-auto">
            <div className="text-center w-full">
              {/* Ollie Logo */}
              <div className="w-20 h-20 flex items-center justify-center mx-auto mb-8 shadow-none">
                <img src="/ollie-logo.png" alt="Ollie Logo" className="w-full h-full object-contain" />
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                How can I help you today?
              </h1>

              <p className="text-gray-600 mb-12 text-lg max-w-2xl mx-auto">
                {currentModel
                  ? `I'm ready to chat using ${currentModel}. Ask me anything, and I'll do my best to help!`
                  : 'Select a model from the dropdown above to start chatting'
                }
              </p>

              {/* Quick Start Examples - Minimalist Design */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                <button
                  onClick={() => setMessage('Explain how this code works')}
                  className="p-5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all duration-200 group hover:shadow-md"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Explain code</h3>
                      <p className="text-sm text-gray-500">Understand functions & algorithms</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMessage('Write a professional email')}
                  className="p-5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all duration-200 group hover:shadow-md"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Write content</h3>
                      <p className="text-sm text-gray-500">Draft emails & documents</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMessage('Help me analyze this data')}
                  className="p-5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all duration-200 group hover:shadow-md"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
                      <Search size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Analyze data</h3>
                      <p className="text-sm text-gray-500">Find patterns & insights</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMessage('What is machine learning?')}
                  className="p-5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all duration-200 group hover:shadow-md"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Brain size={20} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Answer questions</h3>
                      <p className="text-sm text-gray-500">Detailed explanations</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="w-full px-6 sm:px-8 lg:px-12 py-6 overflow-x-hidden">
            <div className="max-w-4xl mx-auto">
              {messages.map((msg) => (
                <Message key={msg.id} message={msg} />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Scroll Button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-full p-2 shadow-lg transition-all z-10 flex items-center gap-2 px-4"
        >
          <ArrowDown size={16} />
          <span className="text-sm font-medium">Scroll to bottom</span>
        </button>
      )}

      {/* Input Area - constrained to max 40% of height */}
      <div className="border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm flex-shrink-0 max-h-[40vh] overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto p-4 sm:p-6">
          <div className="relative">
            {/* Attachment Preview Area */}
            {attachments.length > 0 && (
              <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {att.type === 'image' ? (
                        <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={24} className="text-gray-400" />
                      )}
                    </div>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-white rounded-full shadow-md border border-gray-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white px-1 truncate">
                      {att.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Enhanced Floating Input Bar */}
            <div className="flex items-end gap-2 bg-white border border-gray-200/60 rounded-[26px] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] focus-within:ring-2 focus-within:ring-gray-900/5 focus-within:border-gray-300 transition-all duration-300">
              <button
                className="p-2 mb-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                title="Attach image or file"
                onClick={() => fileInputRef.current?.click()}
                disabled={!currentModel || isStreaming}
              >
                <Paperclip size={20} className="stroke-[2]" />
              </button>
              <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />

              <div className="flex-1 py-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onInput={handleInput}
                  placeholder={currentModel ? "Message Ollie..." : "Select a model to start chatting"}
                  className="w-full resize-none bg-transparent focus:outline-none text-gray-900 placeholder-gray-400 text-[15px] leading-6 max-h-[200px]"
                  style={{ minHeight: '24px' }}
                  rows={1}
                  disabled={!currentModel || isStreaming}
                />
              </div>
              <button
                className={`p-2 mb-1 rounded-full transition-all duration-200 ${isStreaming
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                  : (message.trim() || attachments.length > 0) && currentModel
                    ? 'bg-gray-900 hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                disabled={!currentModel && !isStreaming}
                onClick={isStreaming ? handleStopStreaming : handleSendMessage}
              >
                {isStreaming ? (
                  <Square size={20} />
                ) : (
                  <ArrowUp size={20} />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-center mt-3 mb-2">
            <p className="text-[11px] text-gray-400 font-medium tracking-wide">
              {currentModel
                ? 'Ollie can make mistakes. Consider checking important information.'
                : 'Select a model to start chatting'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
