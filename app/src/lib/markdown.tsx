import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain, FileText } from 'lucide-react'

type Props = {
  content: string
}

function ThoughtDropdown({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!content.trim()) return null

  return (
    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
        <Brain size={16} className="text-violet-500" />
        <span className="text-sm font-medium text-gray-700">Thought Process</span>
      </button>

      {isOpen && (
        <div className="p-4 bg-gray-50/50 border-t border-gray-200 text-sm text-gray-600 leading-relaxed font-mono whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  )
}

function FileDropdown({ name, content }: { name: string, content: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
        <FileText size={16} className="text-blue-500" />
        <span className="text-sm font-medium text-gray-700">File Context: {name}</span>
        <span className="ml-auto text-xs text-gray-400">{content.length} chars</span>
      </button>

      {isOpen && (
        <div className="p-4 bg-gray-50/50 border-t border-gray-200 text-sm text-gray-600 leading-relaxed font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  )
}

export default function Markdown({ content }: Props) {
  // Simple parser for <think> blocks
  // Note: This handles the standard <think>... content ...</think> format

  let thoughtContent = ''
  let mainContent = content
  const files: { name: string, content: string }[] = []

  // Extract File Blocks
  // Pattern: --- File: {name} ---\n{content}\n---------------------
  const fileRegex = /--- File: (.*?) ---\n([\s\S]*?)\n---------------------/g
  let match;
  while ((match = fileRegex.exec(mainContent)) !== null) {
    files.push({ name: match[1], content: match[2].trim() })
  }
  // Remove files from main content for display
  mainContent = mainContent.replace(fileRegex, '')

  const thinkStart = mainContent.indexOf('<think>')
  if (thinkStart !== -1) {
    const thinkEnd = mainContent.indexOf('</think>')

    if (thinkEnd !== -1) {
      // Completed thought block
      thoughtContent = mainContent.substring(thinkStart + 7, thinkEnd)
      mainContent = mainContent.substring(0, thinkStart) + mainContent.substring(thinkEnd + 8)
    } else {
      // Stream is potentially still inside the think block
      thoughtContent = mainContent.substring(thinkStart + 7)
      mainContent = mainContent.substring(0, thinkStart) // Hide partial think tag from main content
    }
  }

  // Pre-process LaTeX delimiters for standard compatibility
  // Replace \[ ... \] with $$ ... $$
  // Replace \( ... \) with $ ... $
  mainContent = mainContent
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$') // \[ ... \] -> $$ ... $$
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')     // \( ... \) -> $ ... $

  return (
    <div className="markdown-body w-full max-w-none">
      {thoughtContent && <ThoughtDropdown content={thoughtContent} />}
      {files.map((f, i) => (
        <FileDropdown key={i} name={f.name} content={f.content} />
      ))}

      <div className="prose prose-base max-w-none text-gray-900 leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }], rehypeKatex]}
          components={{
            code(codeProps) {
              const { inline, className, children, ...props } = codeProps as any
              if (inline) {
                return (
                  <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-900 font-mono text-sm" {...props}>
                    {children}
                  </code>
                )
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
            pre(preProps) {
              const child: any = Array.isArray(preProps.children) ? preProps.children[0] : preProps.children
              let lang = ''
              let codeText = ''
              if (child && child.props) {
                const cls = child.props.className || ''
                const match = /language-(\w+)/.exec(cls)
                lang = match?.[1] || ''
                const inner = child.props.children
                codeText = Array.isArray(inner) ? inner.join('') : String(inner ?? '')
              }
              return (
                <div className="my-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-[#0a0a0a]">
                  <div className="px-3 py-2 text-xs text-gray-300 bg-[#111] border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                      </div>
                      <span className="ml-3 font-mono text-gray-400">{lang || 'text'}</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(codeText)
                          // Ideally show a toast here
                        } catch { /* noop */ }
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                      <span className="text-xs">Copy</span>
                    </button>
                  </div>
                  <div className="relative">
                    <pre className="overflow-x-auto p-4 text-sm leading-6 text-gray-300 font-mono bg-[#0a0a0a] scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                      {preProps.children}
                    </pre>
                  </div>
                </div>
              )
            },
            a({ children, ...props }) {
              return (
                <a className="text-blue-600 hover:text-blue-700 hover:underline" target="_blank" rel="noreferrer" {...(props as any)}>
                  {children}
                </a>
              )
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-6 border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    {children}
                  </table>
                </div>
              )
            },
            thead({ children }) {
              return <thead className="bg-gray-50">{children}</thead>
            },
            th({ children }) {
              return <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">{children}</th>
            },
            td({ children }) {
              return <td className="px-6 py-4 whitespace-nowrap text-gray-500 border-t border-gray-100">{children}</td>
            },
            blockquote({ children }) {
              return <blockquote className="border-l-4 border-gray-200 pl-4 py-1 my-4 italic text-gray-600">{children}</blockquote>
            }
          }}
        >
          {mainContent || (thoughtContent ? '' : ' ')}
        </ReactMarkdown>
      </div>
    </div>
  )
}
