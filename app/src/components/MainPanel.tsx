import { Bot, ArrowUp, Square, ArrowDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import Message from './Message'

export default function MainPanel() {
  const [message, setMessage] = useState('')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Subscribe to all relevant state to force re-renders
  const {
    messages,
    sendMessage,
    currentModel,
    isStreaming,
    updateCounter,
    lastUpdate,
    stopStreaming
  } = useChatStore()

  // Add debugging for re-renders
  console.log('🎨 MainPanel render - message count:', messages.length, 'updateCounter:', updateCounter, 'lastUpdate:', lastUpdate)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
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

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom('smooth')
    }
  }, [messages, updateCounter, shouldAutoScroll]) // Depend on messages AND updateCounter (for streaming)

  const handleSendMessage = async () => {
    if (!message.trim() || isStreaming || !currentModel) return

    const messageContent = message.trim()
    setMessage('')
    setShouldAutoScroll(true) // Always scroll to bottom on new message

    // Reset textarea height
    const textarea = document.querySelector('textarea')
    if (textarea) {
      textarea.style.height = 'auto'
    }

    await sendMessage(messageContent)
  }

  const handleStopStreaming = async () => {
    await stopStreaming()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
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
              {/* Ollama Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                <Bot size={40} className="text-white" />
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

              {/* Quick Start Examples */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <button
                  onClick={() => setMessage('Explain how this code works')}
                  className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-2xl text-left transition-all duration-200 group hover:shadow-lg hover:-translate-y-1"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">Explain code</h3>
                      <p className="text-sm text-gray-600">Help me understand how a function or algorithm works</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMessage('Write a professional email')}
                  className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 rounded-2xl text-left transition-all duration-200 group hover:shadow-lg hover:-translate-y-1"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">Write content</h3>
                      <p className="text-sm text-gray-600">Create professional emails, articles, or documents</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMessage('Help me analyze this data')}
                  className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border border-purple-200 rounded-2xl text-left transition-all duration-200 group hover:shadow-lg hover:-translate-y-1"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">Analyze data</h3>
                      <p className="text-sm text-gray-600">Help me find patterns and insights in datasets</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMessage('What is machine learning?')}
                  className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200 rounded-2xl text-left transition-all duration-200 group hover:shadow-lg hover:-translate-y-1"
                  disabled={!currentModel}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-orange-500 rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">Answer questions</h3>
                      <p className="text-sm text-gray-600">Get detailed explanations on any topic</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="w-full px-6 sm:px-8 lg:px-12 py-6">
            <div className=" max-w-4xl mx-auto">
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

      {/* Input Area */}
      <div className="border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm">
        <div className="w-full max-w-4xl mx-auto p-6 sm:p-8">
          <div className="relative">
            <div className="flex items-end gap-4 bg-white border border-gray-200 rounded-3xl p-4 focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent shadow-sm transition-all duration-200">
              <div className="flex-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onInput={handleInput}
                  placeholder={currentModel ? "Message Ollama..." : "Select a model to start chatting"}
                  className="w-full resize-none bg-transparent focus:outline-none text-gray-900 placeholder-gray-500 text-base leading-7"
                  style={{ minHeight: '28px', maxHeight: '200px' }}
                  rows={1}
                  disabled={!currentModel || isStreaming}
                />
              </div>
              <button
                className={`p-3 rounded-2xl transition-all duration-200 ${isStreaming
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                    : message.trim() && currentModel
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

          <div className="flex justify-center mt-4">
            <p className="text-xs text-gray-500">
              {currentModel
                ? 'Ollama can make mistakes. Consider checking important information.'
                : 'Select a model from the dropdown above to start chatting'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
