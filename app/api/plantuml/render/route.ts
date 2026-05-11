export const runtime = 'edge'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'

const RENDERERS = [
  'https://kroki.io/plantuml/svg',
  'https://europa.kroki.io/plantuml/svg',
]

export async function POST(request: NextRequest) {
  let definition: string | undefined

  try {
    const body = await request.json()
    definition = body?.definition || body?.text || body?.content
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!definition?.trim()) {
    return NextResponse.json({ error: 'Definition is empty' }, { status: 400 })
  }

  let fullDefinition = definition.trim()
  if (!fullDefinition.match(/^@startuml/i)) fullDefinition = `@startuml\n${fullDefinition}`
  if (!fullDefinition.match(/@enduml\s*$/i)) fullDefinition += '\n@enduml'

  for (let i = 0; i < RENDERERS.length; i++) {
    const url = RENDERERS[i]
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'image/svg+xml' },
        body: fullDefinition,
        cache: 'no-store',
      })

      if (response.ok) {
        const svg = await response.text()
        return NextResponse.json({ svg, renderer: 'kroki' })
      }

      if (i < RENDERERS.length - 1) continue
    } catch (e) {
      if (i === RENDERERS.length - 1) {
        return NextResponse.json({
          error: 'PlantUML renderer timeout. Try a simpler diagram.',
        }, { status: 502 })
      }
    }
  }

  return NextResponse.json({ error: 'All renderers failed' }, { status: 502 })
}
