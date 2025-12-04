export const runtime = 'edge'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'

// 用官方 Kroki PlantUML 端点（最稳）
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

  // 智能修复：自动添加 @startuml / @enduml（如果缺失）
  let fullDefinition = definition.trim()
  fullDefinition = fullDefinition.replace(/^\s*@startuml\s*/i, '').replace(/\s*@enduml\s*$/i, '') // 清理多余
  if (!fullDefinition.startsWith('@startuml')) fullDefinition = `@startuml\n${fullDefinition}`
  if (!fullDefinition.endsWith('@enduml')) fullDefinition += '\n@enduml'

  // 基本语法校验（可选，防止明显错误）
  if (!fullDefinition.includes('rectangle') && !fullDefinition.includes('class') && !fullDefinition.includes('actor')) {
    return NextResponse.json(
      { 
        error: 'Invalid PlantUML: Add elements like "rectangle Main { ... }" or "Alice -> Bob". Full example: @startuml Alice -> Bob: Hi @enduml',
        suggestedDefinition: `@startuml\n${fullDefinition}\n@enduml` // 返回建议
      },
      { status: 400 }
    )
  }

  try {
    // POST 原始文本（Kroki 直接解析，无压缩问题）
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
      // 增强错误提示：返回修复后的 definition 片段
      const errorBody = await response.text().substring(0, 200) // Kroki 错误详情
      return NextResponse.json(
        { 
          error: `PlantUML syntax error (${response.status}): ${errorBody}. Check tags (@startuml/@enduml) and add relationships (e.g., Alice -> Main).`,
          fixedDefinition: fullDefinition.substring(0, 300) + '...', // 帮助调试
          renderer: 'kroki.io'
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
