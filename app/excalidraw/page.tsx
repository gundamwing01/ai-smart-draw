// app/excalidraw/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { Excalidraw, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'

export default function ExcalidrawPage() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // XML 转 Excalidraw 元素（简化版，够用）
  const xmlToExcalidrawElements = useCallback((xml: string): ExcalidrawElement[] => {
    const elements: ExcalidrawElement[] = []
    let id = Date.now()

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'application/xml')
      const cells = doc.querySelectorAll('mxCell[vertex="1"], mxCell[edge="1"]')

      cells.forEach((cell) => {
        const value = cell.getAttribute('value') || '未命名'
        const geom = cell.querySelector('mxGeometry')
        if (!geom) return

        const x = parseFloat(geom.getAttribute('x') || '100')
        const y = parseFloat(geom.getAttribute('y') || '100')
        const w = parseFloat(geom.getAttribute('width') || '160')
        const h = parseFloat(geom.getAttribute('height') || '80')

        if (cell.getAttribute('vertex') === '1') {
          elements.push({
            id: `shape-${id++}`,
            type: 'rectangle',
            x,
            y,
            width: w,
            height: h,
            strokeColor: '#000',
            backgroundColor: '#e0f2fe',
            fillStyle: 'solid',
            label: { text: value },
            fontSize: 20,
          } as any)
        }

        if (cell.getAttribute('edge') === '1') {
          elements.push({
            id: `arrow-${id++}`,
            type: 'arrow',
            x,
            y,
            width: 100,
            height: 100,
            endArrowhead: 'arrow',
            label: { text: value },
          } as any)
        }
      })
    } catch (e) {
      console.error('XML 解析失败', e)
    }

    return elements
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
        }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: 'assistant', content: '请求失败' }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const matches = buffer.match(/\{[\s\S]*"xml":\s*"([^"]*)"/)
        if (matches && excalidrawAPI) {
          try {
            const xml = matches[1].replace(/\\"/g, '"')
            const elements = xmlToExcalidrawElements(xml)
            excalidrawAPI.updateScene({ elements })
            excalidrawAPI.scrollToContent(elements)
            buffer = '' // 清空，防止重复解析
          } catch (e) { }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络错误' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* 左侧 AI 聊天 */}
      <div className="w-96 bg-gray-50 border-r flex flex-col">
        <div className="p-4 font-bold border-b">AI 绘图助手</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={`inline-block px-4 py-2 rounded-lg max-w-xs ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-center text-gray-500">思考中...</div>}
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="描述你想要的图表..."
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
      <div className="flex-1">
        <Excalidraw
          excalidrawAPI={api => setExcalidrawAPI(api)}
          theme="light"
          langCode="zh-CN"
        />
      </div>
    </div>
  )
}
