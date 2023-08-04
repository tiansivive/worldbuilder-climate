import { scale } from "chroma-js"
import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'
import { useCallback, useEffect, useRef } from "react"

import { set } from "lib/objects/set"
import { update } from "lib/objects/update"

import { affectedCellIndices, Coords } from "./brush"
import { Grid, State } from "./Grid"



export const World
    : React.FC<Props>
    = ({ state, setState }) => {

        const ref = useRef<HTMLCanvasElement>()
        const grid = useRef<Grid>(state.grid)
        const cursor = useRef<{ pos: Coords, indices: Coords }>()
        const interval = useRef<NodeJS.Timer>()
        const ctx = ref.current?.getContext("2d")

        const cell_size = CELL_SIZE / (state.width / 64)

        useEffect(() => { grid.current = state.grid }, [state.grid])

        const drawInitialGrid = useCallback(() => {
            if (!ref.current || !grid || !ctx) return
            F.pipe(
                A.Do,
                A.bind("row", () => state.grid.map((r, i) => ({ cols: r, i }))),
                A.bind("cell", ({ row }) => row.cols.map((value, i) => ({ x: i, y: row.i, value }))),
                A.map(({ cell }) => {
                    ctx.fillStyle = deriveColor(cell.value.altitude)
                    ctx.fillRect(cell.x * cell_size + cell.x, cell.y * cell_size + cell.y, cell_size, cell_size)

                })
            )

        }, [ctx, state.grid, cell_size])


        const validCoords = useCallback(({ x, y }: Coords) => 0 <= x && x < state.width && 0 <= y && y < state.height, [state.height, state.width])

        const updateCursor = useCallback((e: MouseEvent) => {
            const pos = { x: e.offsetX, y: e.offsetY }
            const indices = { x: Math.floor(e.offsetX / (cell_size + 1)), y: Math.floor(e.offsetY / (cell_size + 1)) }
            cursor.current = { pos, indices }

        }, [cell_size])

        const startPainting = useCallback((e: MouseEvent) => {

            updateCursor(e)
            interval.current = setInterval(() => {
                if (!cursor.current) return

                const coords = affectedCellIndices(cursor.current.indices, state.brush.size)
                    .filter(validCoords)
                coords.forEach(({ x, y }) => {
                    if (!ref.current || !grid || !ctx || !grid.current?.[y][x]) return


                    //@ts-expect-error no support for dynamic paths
                    grid.current = update(grid.current, `[${y}][${x}].altitude`, altitude => altitude + state.brush.strength)
                    ctx.fillStyle = deriveColor(grid.current?.[y][x].altitude)
                    ctx.fillRect(x * cell_size + x, y * cell_size + y, cell_size, cell_size)

                })
            }, 50)

        }, [cell_size, ctx, state.brush.size, state.brush.strength, updateCursor, validCoords])


        const widthWithGaps = state.width * cell_size + state.width
        const heightWithGaps = state.height * cell_size + state.height

        const finishPainting = useCallback(() => {

            clearInterval(interval.current)
            interval.current = undefined
            cursor.current = undefined

            setState(set("grid", grid.current))
        }, [setState])


        return <canvas
            id="canvas"
            ref={ _ref => {
                if (!_ref) return
                ref.current = _ref
                drawInitialGrid()

            } }
            width={ widthWithGaps }
            height={ heightWithGaps }
            onMouseUp={ _ => finishPainting() }
            onMouseLeave={ _ => finishPainting() }
            onMouseMove={ e => updateCursor(e.nativeEvent) }
            onMouseDown={ e => startPainting(e.nativeEvent) }


        />
    }



export type Props = {
    state: State,
    setState: React.Dispatch<React.SetStateAction<State>>

}




const deriveColor
    : (value: number) => string
    = n => {
        if (n <= 0) {

            const capped = Math.max(n, CAP_DEPTH)
            const colors = scale(["deepskyblue", "navy"]).domain([CAP_DEPTH, 0]).mode("lab").colors(SEA_COLORS_AMOUNT)

            const index = Math.floor(Math.abs(capped / DEPTH_INTERVAL))
            return colors[index]
        }

        const capped = Math.min(n, CAP_ELEVATION)
        const colors = scale(["forestgreen", "gold", "maroon"]).domain([0, CAP_ELEVATION]).mode("lab").colors(ELEVATION_COLORS_AMOUNT)

        const index = Math.floor(Math.abs(capped / ELEVATION_INTERVAL))
        return colors[index]
    }

const CAP_DEPTH = -9999
const SEA_COLORS_AMOUNT = 4
const DEPTH_INTERVAL = 250

const CAP_ELEVATION = 9999
const ELEVATION_COLORS_AMOUNT = 99
const ELEVATION_INTERVAL = 100

export const CELL_SIZE = 12