export const runtime = 'edge'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'

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

  // 自动补全 @startuml 和 @enduml
  let fullDefinition = definition.trim()
  if (!fullDefinition.match(/^@startuml/i)) {
    fullDefinition = `@startuml\n${fullDefinition}`
  }
  if (!fullDefinition.match(/@enduml\s*$/i)) {
    fullDefinition += '\n@enduml'
  }

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

    if (!response.ok) {
      // 正确写法：先 await 再 substring
      const errorText = await response.text()
      const errorBody = errorText.substring(0, 200)

      return NextResponse.json(
        {
          error: `PlantUML syntax error (${response.status}): ${errorBody || 'Unknown error'}. Check if @startuml/@enduml tags are correct.`,
          fixedDefinition: fullDefinition.substring(0, 300) + '...',
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
