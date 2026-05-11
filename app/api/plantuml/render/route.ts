export const runtime = 'edge'
export const maxDuration = 90   // 提高超时上限，解决504

import { NextRequest, NextResponse } from 'next/server'

// 优先使用官方Kroki（最稳定）
const PLANTUML_BASE = 'https://kroki.io/plantuml/svg'
// 备用镜像（可选）：'https://europa.kroki.io/plantuml/svg'

export async function POST(request: NextRequest) {
  let definition: string | undefined

  try {
    const body = await request.json()
    definition = body?.definition
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!definition || !definition.trim()) {
    return NextResponse.json({ error: 'Definition cannot be empty' }, { status: 400 })
  }

  // 自动补全 PlantUML 标签
  let fullDefinition = definition.trim()
  if (!fullDefinition.match(/^@startuml/i)) {
    fullDefinition = `@startuml\n${fullDefinition}`
  }
  if (!fullDefinition.match(/@enduml\s*$/i)) {
    fullDefinition += '\n@enduml'
  }

  // 重试机制（最关键！）
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(PLANTUML_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Accept': 'image/svg+xml',
        },
        body: fullDefinition,
        cache: 'no-store',
      })

      if (response.ok) {
        const svg = await response.text()
        return NextResponse.json({ 
          svg, 
          renderer: 'kroki.io' 
        })
      }

      // 非最后一次重试时，等待后继续
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 800 * attempt))
        continue
      }

      // 最后一次失败，返回详细错误
      const errorText = await response.text().catch(() => '')
      return NextResponse.json({
        error: `PlantUML rendering failed (${response.status}). The diagram may be too complex or the service is busy. Try simplifying it.`,
        details: errorText.substring(0, 300),
        attempt: attempt,
      }, { status: response.status })

    } catch (error) {
      if (attempt === maxRetries) {
        return NextResponse.json({
          error: 'Network timeout connecting to PlantUML renderer. Please try again later.',
          details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 502 })
      }
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}
