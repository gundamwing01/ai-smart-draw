export const runtime = 'edge'
export const maxDuration = 60

import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'

// Default to kroki.io
const DEFAULT_RENDERER =
  process.env.KROKI_RENDER_BASE?.replace(/\/$/, '') || 'http://vg.007988.xyz:8000'

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

// 关键：使用浏览器原生 CompressionStream 替代 zlib（Edge Runtime 支持）
async function encodeDiagram(definition: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(definition)

  const compressed = await new Response(
    new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  ).arrayBuffer()

  return Buffer.from(compressed)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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

  // 修复变量名：你之前写成了 diagramDefinition，这里要用 definition
  const encoded = await encodeDiagram(definition)

  const url = `${DEFAULT_RENDERER}/${finalDiagramType}/svg/${encoded}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'image/svg+xml' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Kroki service responded with ${response.status} ${response.statusText || ''}`.trim() },
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error contacting Kroki service.' },
      { status: 502 }
    )
  }
}
