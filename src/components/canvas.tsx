
import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'
import { useCallback, useEffect, useRef } from "react"

import { Matrix } from 'lib/math/types'



export const Canvas
    : <T>(props: Props<T>) => JSX.Element
    = ({ state, width, height, deriveColor }) => {

        const ref = useRef<HTMLCanvasElement>()
        const grid = useRef<Matrix<unknown>>(state)
        const size = CELL_SIZE / (width / 32)


        useEffect(() => { grid.current = state }, [state])

        const drawInitialGrid = useCallback(() => {
            const ctx = ref.current?.getContext("2d")
            if (!ref.current || !grid || !ctx) return
            F.pipe(
                A.Do,
                A.bind("row", () => state.map((r, i) => ({ cols: r, i }))),
                A.bind("cell", ({ row }) => row.cols.map((value, i) => ({ x: i, y: row.i, value }))),
                A.map(({ cell }) => {
                    ctx.fillStyle = deriveColor(cell.value)
                    ctx.fillRect(cell.x * size + cell.x, cell.y * size + cell.y, size, size)

                })
            )

        }, [state, deriveColor, size])




        const widthWithGaps = width * size + width
        const heightWithGaps = height * size + height

        return <canvas
            id="canvas"
            ref={ _ref => {
                if (!_ref) return
                ref.current = _ref
                drawInitialGrid()

            } }
            width={ widthWithGaps }
            height={ heightWithGaps }



        />
    }



export type Props<T> = {
    state: Matrix<T>,
    height: number,
    width: number
    deriveColor: <T>(value: T) => string
}


export const CELL_SIZE = 12