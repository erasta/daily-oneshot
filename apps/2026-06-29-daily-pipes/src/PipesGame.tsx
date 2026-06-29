import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Rectangle } from 'pixi.js'
import {
  generateBoard,
  isSolved,
  poweredCells,
  type Board,
  N,
  E,
  S,
  W,
} from './pipes'

export type Stats = { moves: number; solved: boolean }

const LIT = 0x4be3ff
const LIT_CORE = 0xffffff
const DIM = 0x2c3a55
const DIM_CORE = 0x3a4c6e
const SOURCE = 0xffd36e

type Tile = {
  container: Container
  pipes: Graphics
  cell: Board['cells'][number]
  index: number
  targetAngle: number
}

function drawTile(
  g: Graphics,
  mask: number,
  size: number,
  powered: boolean,
  isSource: boolean,
) {
  g.clear()
  const half = size / 2
  const th = size * 0.15
  const color = powered ? LIT : DIM
  const ends: Array<[number, number]> = []
  if (mask & N) ends.push([0, -half])
  if (mask & S) ends.push([0, half])
  if (mask & E) ends.push([half, 0])
  if (mask & W) ends.push([-half, 0])

  // Stacked translucent strokes fake a neon glow without per-tile filters.
  const layers = [
    { w: th * 2.4, a: powered ? 0.16 : 0.0 },
    { w: th * 1.5, a: powered ? 0.4 : 0.22 },
    { w: th * 0.78, a: 1 },
  ]
  for (const layer of layers) {
    if (layer.a <= 0) continue
    for (const [ex, ey] of ends) {
      g.moveTo(0, 0)
      g.lineTo(ex, ey)
    }
    g.stroke({ width: layer.w, color, alpha: layer.a, cap: 'round', join: 'round' })
  }

  const coreR = isSource ? th * 1.15 : th * 0.62
  if (powered) {
    g.circle(0, 0, coreR * 1.9).fill({ color, alpha: 0.22 })
  }
  g.circle(0, 0, coreR).fill({ color: isSource ? SOURCE : powered ? LIT_CORE : DIM_CORE })
}

export const PipesGame = ({
  date,
  cols,
  rows,
  onStats,
}: {
  date: string
  cols: number
  rows: number
  onStats: (s: Stats) => void
}) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const onStatsRef = useRef(onStats)
  onStatsRef.current = onStats

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let inited = false
    const app = new Application()
    let tiles: Tile[] = []
    let tileSize = 0
    let movesCount = 0
    const gridLayer = new Container()

    const board = generateBoard(date, cols, rows)

    const refreshPower = () => {
      const powered = poweredCells(board)
      for (const t of tiles) {
        // Draw the pipe in its base orientation; the container's rotation
        // supplies the visible turn, so the openings the player sees always
        // match where the tile is logically connected.
        drawTile(
          t.pipes,
          t.cell.sol,
          tileSize,
          powered[t.index],
          t.index === board.source,
        )
      }
      onStatsRef.current({ moves: movesCount, solved: isSolved(board) })
    }

    const layout = () => {
      if (!inited) return
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      app.renderer.resize(w, h)
      tileSize = Math.floor(Math.min(w / cols, h / rows))
      const gridW = tileSize * cols
      const gridH = tileSize * rows
      gridLayer.position.set((w - gridW) / 2, (h - gridH) / 2)
      for (const t of tiles) {
        const x = (t.index % cols) * tileSize + tileSize / 2
        const y = Math.floor(t.index / cols) * tileSize + tileSize / 2
        t.container.position.set(x, y)
        t.container.hitArea = new Rectangle(
          -tileSize / 2,
          -tileSize / 2,
          tileSize,
          tileSize,
        )
      }
      refreshPower()
    }

    const init = async () => {
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        width: host.clientWidth || 300,
        height: host.clientHeight || 300,
      })
      if (cancelled) {
        app.destroy(true)
        return
      }
      inited = true
      host.appendChild(app.canvas)
      app.stage.addChild(gridLayer)

      tiles = board.cells.map((cell, index) => {
        const container = new Container()
        const pipes = new Graphics()
        container.addChild(pipes)
        container.eventMode = 'static'
        container.cursor = 'pointer'
        const startAngle = (cell.rot * Math.PI) / 2
        container.rotation = startAngle
        const tile: Tile = { container, pipes, cell, index, targetAngle: startAngle }
        container.on('pointertap', () => {
          cell.rot = (cell.rot + 1) % 4
          tile.targetAngle += Math.PI / 2
          movesCount += 1
          refreshPower()
        })
        gridLayer.addChild(container)
        return tile
      })

      app.ticker.add(() => {
        for (const t of tiles) {
          const diff = t.targetAngle - t.container.rotation
          if (Math.abs(diff) > 0.001) {
            t.container.rotation += diff * 0.25
          } else {
            t.container.rotation = t.targetAngle
          }
        }
      })

      layout()
    }

    void init()

    const ro = new ResizeObserver(() => layout())
    ro.observe(host)

    return () => {
      cancelled = true
      ro.disconnect()
      // Only destroy once init has actually finished; if it's still pending,
      // the `cancelled` check inside init() will tear the app down instead.
      if (inited) app.destroy(true, { children: true })
    }
  }, [date, cols, rows])

  return <div ref={hostRef} className="pipes-canvas" />
}
