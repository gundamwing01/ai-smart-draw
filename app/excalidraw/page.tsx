// app/excalidraw/page.tsx
'use client'

import { useState, useCallback } from 'react'
import Excalidraw from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'
import type { AppState } from '@excalidraw/excalidraw/types/types'

export default function ExcalidrawPage() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
  const [sceneData, setSceneData] = useState<any>({
    elements: [],
    appState: { viewBackgroundColor: '#a5d8ff' },
  })

  // 实时监听画布变化 → 发送给 AI（可选）
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) => {
    if (!excalidrawAPI) return
    // 你可以在这里把场景数据发给 AI 分析
    console.log('Excalidraw changed:', { elements, appState })
  }, [excalidrawAPI])

  return (
    <div className="h-screen w-full">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        initialData={sceneData}
        theme="light"
        langCode="zh-CN"
      />
    </div>
  )
}
