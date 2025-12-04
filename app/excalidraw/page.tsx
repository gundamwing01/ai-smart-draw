// app/excalidraw/page.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import Excalidraw, {
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'

export default function ExcalidrawPage() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 把 draw.io XML 转成 Excalidraw 元素（核心转换函数）
  const xmlToExcalidrawElements = useCallback((xml: string): ExcalidrawElement[] => {
    const elements: ExcalidrawElement[] = []
    let idCounter = Date.now()

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'application/xml')

      // 解析 mxCell（draw.io 的核心元素）
      const cells = doc.querySelectorAll('mxCell[vertex="1"], mxCell[edge="1"]')

      cells.forEach((cell) => {
        const value = cell.getAttribute('value') || ''
        const geometry = cell.querySelector('mxGeometry')
        const x = parseFloat(geometry?.getAttribute('x') || '0')
        const y = parseFloat(geometry?.getAttribute('y') || '0')
        const width = parseFloat(geometry?.getAttribute('width') || '120')
        const height = parseFloat(geometry?.getAttribute('height') || '60')

        // 矩形（最常见）
        if (cell.getAttribute('vertex') === '1') {
          elements.push({
            id: `rect-${idCounter++}`,
            type: 'rectangle',
            x,
            y,
            width,
            height,
            strokeColor: '#000000',
            backgroundColor: '#ffd8b1',
            fillStyle: 'hachure',
            roughness: 1,
            opacity: 100,
            label: { text: value || '未命名' },
            textAlign: 'center',
            verticalAlign: 'middle',
            fontSize: 20,
            fontFamily: 1,
          } as any)
        }

        // 连线
        if (cell.getAttribute('edge') === '1') {
          const source = cell.getAttribute('source')
          const target = cell.getAttribute('target')
          if (source && target) {
            elements.push({
              id: `arrow-${idCounter++}`,
              type: 'arrow',
              strokeColor: '#000000',
              strokeWidth: 2,
              roughness: 1,
              startArrowhead: null,
              endArrowhead: 'arrow',
              label: { text: value },
              points: [[x, y], [x + width, y + height / 2]],
            } as any)
          }
        }
      })
    } catch (e) {
      console.error('XML 解析失败', e)
    }

    return elements
  }, [])

  // 发送 AI 请求并实时解析工具调用
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          modelConfig: { model: 'grok-beta' }, // 根据你实际的模型配置
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '请求失败，请重试' }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 实时提取工具调用（display_diagram）
        const toolCallMatches = buffer.match(/\{[\s\S]*"tool":"display_diagram"[\s\S]*\}/g)
        if (toolCallMatches && excalidrawAPI) {
          try {
            const lastCall = toolCallMatches[toolCallMatches.length - 1]
            const parsed = JSON.parse(lastCall)
            if (parsed.xml) {
              const newElements = xmlToExcalidrawElements(parsed.xml)
              excalidrawAPI.updateScene({ elements: newElements })
              excalidrawAPI.scrollToContent(newElements)
            }
          } catch (e) {
            // 解析失败继续等完整 JSON
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '网络错误' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* 左侧聊天区 */}
      <div className="w-96 bg-gray-50 border-r flex flex-col">
        <div className="p-4 font-bold text-lg border-b">AI 绘图助手</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`inline-block px-4 py-2 rounded-lg max-w-xs ${
                  msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-center text-gray-500">AI 正在思考...</div>}
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="描述你想要的图表，例如：画一个用户登录流程"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 右侧 Excalidraw 画布 */}
      <div className="flex-1 relative">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme="light"
          langCode="zh-CN"
          viewModeEnabled={false}
        />
      </div>
    </div>
  )
}
