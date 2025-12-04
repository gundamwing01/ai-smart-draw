export const runtime = 'edge'
export const maxDuration = 60

import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'

// Default to kroki.io
const DEFAULT_RENDERER =
  process.env.KROKI_RENDER_BASE?.replace(/\/$/, '') || 'https://kroki.io'

// 支持的图表类型
const DIAGRAM_TYPES: Record<string, string> = {
  actdiag: 'actdiag',
  blockdiag: 'blockdiag',
  bpmn: 'bpmn',
  bytefield: 'bytefield',
  c4plantuml: 'c4plantuml',
  ditaa: 'ditaa',
  erd: 'erd',
  excalidraw: 'excalidraw',
  graphviz: 'graphviz',
  mermaid: 'mermaid',
  nomnoml: 'nomnoml',
  nwdiag: 'nwdiag',
  packetdiag: 'packetdiag',
  pikchr: 'pikchr',
  plantuml: 'plantuml',
  rackdiag: 'rackdiag',
  seqdiag: 'seqdiag',
  structurizr: 'structurizr',
  svgbob: 'svgbob',
  umlet: 'umlet',
  vega: 'vega',
  d2: 'd2',
  dbml: 'dbml',
  tikz: 'tikz',
  vegalite: 'vegalite',
  wavedrom: 'wavedrom',
  wireviz: 'wireviz',
  symbolator: 'symbolator',
}

// 自动检测图表类型
function detectDiagramType(definition: string): string {
  const trimmed = definition.trim().toLowerCase()

  for (const [marker, type] of Object.entries(DIAGRAM_TYPES)) {
    if (trimmed.startsWith(marker.toLowerCase())) {
      const lines = definition.trim().split('\n')
      let startIndex = 1
      while (startIndex < lines.length && lines[startIndex].trim() === '') startIndex++
      if (startIndex < lines.length) {
        return detectActualDiagramType(lines.slice(startIndex).join('\n'), type)
      }
      return type
    }
  }

  return detectActualDiagramType(definition, 'plantuml')
}

function detectActualDiagramType(definition: string, defaultType: string): string {
  const trimmed = definition.trim()
  if (!trimmed) return defaultType

  if (trimmed.includes('@startuml') || trimmed.includes('skinparam')) return 'plantuml'
  if (trimmed.includes('graph ') && (trimmed.includes('{') || trimmed.includes('->'))) return 'graphviz'
  if (/graph\s+(TD|LR|BT|RL)/i.test(trimmed)) return 'mermaid'
  if (trimmed.includes('blockdiag')) return 'blockdiag'
  if (trimmed.includes('seqdiag')) return 'seqdiag'
  if (trimmed.includes('actdiag')) return 'actdiag'
  if (trimmed.includes('nwdiag')) return 'nwdiag'
  if (trimmed.includes('packetdiag')) return 'packetdiag'
  if (trimmed.includes('rackdiag')) return 'rackdiag'
  if (trimmed.includes('bytefield')) return 'bytefield'
  if (trimmed.includes('<?xml') && trimmed.includes('semantic:definitions')) return 'bpmn'
  if (trimmed.includes('|') && trimmed.includes('--') && trimmed.includes('==')) return 'erd'
  if (trimmed.includes('d2 Parser') || trimmed.includes('shape:')) return 'd2'

  return defaultType
}

// 修复：使用 'deflate' 而非 'deflate-raw'，并添加错误处理
async function encodeDiagram(definition: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(definition)

    // 使用 'deflate' 模式（Kroki 官方推荐，避免 raw 兼容问题）
    const compressedStream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'))
    const compressed = await new Response(compressedStream).arrayBuffer()

    let encoded = Buffer.from(compressed).toString('base64')
    encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // 验证编码长度（避免 URI 太长导致 414）
    if (encoded.length > 4000) {
      throw new Error('Encoded diagram too long for Kroki URI (max ~4096 chars)')
    }

    return encoded
  } catch (error) {
    console.error('Kroki encoding error:', error)
    throw new Error(`Encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  let definition: string | undefined
  let diagramType: string | undefined

  try {
    const body = await request.json()
    definition = body?.definition
    diagramType = body?.diagramType
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body. Expected JSON with a definition field.' },
      { status: 400 }
    )
  }

  if (!definition || !definition.trim()) {
    return NextResponse.json({ error: 'Diagram definition cannot be empty.' }, { status: 400 })
  }

  const finalDiagramType =
    diagramType && diagramType !== 'auto' ? diagramType : detectDiagramType(definition)

  let encoded: string
  try {
    encoded = await encodeDiagram(definition)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Diagram encoding failed.' },
      { status: 500 }
    )
  }

  const url = `${DEFAULT_RENDERER}/${finalDiagramType}/svg/${encoded}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'image/svg+xml' },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Kroki response:', response.status, response.statusText, url) // 日志调试
      return NextResponse.json(
        {
          error: `Kroki service failed with ${response.status}: ${response.statusText}. Try a simpler diagram or check syntax.`,
          diagramType: finalDiagramType,
          url, // 返回 URL 便于调试
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') ?? 'image/svg+xml'

    if (!contentType.includes('svg')) {
      const buffer = Buffer.from(await response.arrayBuffer())
      const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`
      return NextResponse.json({
        svgDataUrl: dataUrl,
        renderer: DEFAULT_RENDERER,
      })
    }

    const svg = await response.text()
    return NextResponse.json({
      svg,
      renderer: DEFAULT_RENDERER,
    })
  } catch (error) {
    console.error('Kroki fetch error:', error, url)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch from Kroki service.',
        diagramType: finalDiagramType,
        url,
      },
      { status: 502 }
    )
  }
}
