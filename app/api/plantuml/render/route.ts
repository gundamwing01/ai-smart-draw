export const runtime = 'edge'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'

// 用官方（稳！）
const PLANTUML_BASE = 'https://kroki.io/plantuml/svg'

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

  // 自动添加 PlantUML 标签（如果用户忘了）
  let fullDefinition = definition.trim()
  if (!fullDefinition.startsWith('@startuml')) fullDefinition = `@startuml\n${fullDefinition}`
  if (!fullDefinition.endsWith('@enduml')) fullDefinition += '\n@enduml'

  try {
    // POST 原始文本（无压缩，Kroki 直接解析）
    const response = await fetch(PLANTUML_BASE, {
      method: 'POST',
      headers: { 
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'image/svg+xml',
      },
      body: fullDefinition,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('PlantUML response:', response.status, response.statusText, fullDefinition.substring(0, 100)) // 日志截断
      return NextResponse.json(
        { 
          error: `PlantUML failed: ${response.status} - Check syntax (needs @startuml/@enduml). Full def: ${fullDefinition.substring(0, 200)}...` 
        },
        { status: response.status }
      )
    }

    const svg = await response.text()
    return NextResponse.json({ svg, renderer: 'kroki.io' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Network error' },
      { status: 502 }
    )
  }
}
