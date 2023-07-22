
import { scale } from 'chroma-js';
import { Input } from 'components/input';
import * as F from 'fp-ts/function'
import { replicate } from 'fp-ts/lib/Array';
import { range } from 'fp-ts/lib/NonEmptyArray';
import React, { CSSProperties, useCallback, useEffect, useState } from 'react';

import * as Null from 'lib/nullable'
import { set } from 'lib/objects/set';
import { update } from 'lib/objects/update';

import { affectedCellIndices, Coords } from './brush';

let intervalHandle: any

function App() {


  const [state, setState] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, grid: generateGrid(DEFAULT_WIDTH, DEFAULT_HEIGHT), brush: DEFAULT_BRUSH })

  const [mouseDown, setMouseDown] = useState<Coords | undefined>(undefined)

  const paint = useCallback((cells: Coords[]) => {
    if (!mouseDown) return
    // @ts-expect-error cannot infer type of dynamic path
    setState(st => cells.reduce((_st, { x, y }) => update(_st, `grid[${y}][${x}].altitude`, altitude => altitude + state.brush.strength), st))
  }, [mouseDown, state.brush.strength])
  useEffect(() => {
    if (!mouseDown) return clearInterval(intervalHandle)

    clearInterval(intervalHandle)
    intervalHandle = setInterval(() => {

      const validCoords = ({ x, y }: Coords) => 0 <= x && x < state.width && 0 <= y && y < state.height
      const cells = affectedCellIndices(mouseDown, state.brush.size)
        .filter(validCoords)

      paint(cells)


    }, 100)

  }, [mouseDown, paint, state.brush.size, state.brush.strength, state.height, state.width])

  return (
    <div >
      <section >
        <form style={ sForm } >
          <fieldset style={ sFields }>
            <div>

              <label>Width</label>
              <Input type="number" onChange={ e => setState(set("width", e.target.valueAsNumber)) } value={ state.width } />
            </div>
            <div>

              <label>Height</label>
              <Input type="number" onChange={ e => setState(set("height", e.target.valueAsNumber)) } value={ state.height } />
            </div>
          </fieldset>
          <button type="button" onClick={ _ => {
            setState(set("grid", generateGrid(state.width, state.height)))
            setMouseDown(undefined)
          } }>Update Grid</button>
          <aside>This will destroy the current grid</aside>
        </form>
        <form style={ sForm } >
          <fieldset style={ sFields }>
            <div>

              <label>Brush size</label>
              <Input type="number" onChange={ e => setState(set("brush.size", e.target.valueAsNumber)) } value={ state.brush.size } />
            </div>
            <div>

              <label>Brush strength</label>
              <Input type="number" onChange={ e => setState(set("brush.strength", e.target.valueAsNumber)) } value={ state.brush.strength } />
            </div>
          </fieldset>
        </form>
      </section>

      <section>
        <div style={ sGrid } onMouseUp={ _ => setMouseDown(undefined) }>
          { state.grid.map((row, y) =>
            <div style={ sRow } >
              { row.map((column, x) =>
                <div
                  onMouseEnter={ _ => Null.map(mouseDown, _ => setMouseDown({ x, y })) }
                  onMouseDown={ _ => setMouseDown({ x, y }) }

                  style={ sCell(column) }
                >
                  { column.altitude }
                </div>
              ) }
            </div>
          ) }
        </div>
      </section>
    </div>
  );
}

export default App;


const generateGrid
  : (width: number, height: number) => Grid
  = (w, h) => replicate(h, replicate(w, { altitude: 0 }))



const sForm: CSSProperties =
{
  width: "400px"
  , margin: "auto"
}

const sFields: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1em"

}

const sGrid: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1px"
}

const sRow: CSSProperties = {
  flexGrow: 1,
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "stretch",
  gap: "1px"
};

const sCell
  : (cell: Cell) => CSSProperties
  = ({ altitude }) => ({
    width: "20px",
    height: "20px",
    fontSize: "8px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: deriveColor(altitude)
  })


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

/**  
 * `Grid`: `Array` of `Row`   
 * `Row` : `Array` of `Cell`
 * */
type Grid = Array<Array<Cell>>
type Cell = { altitude: number }

type Brush = { size: number, strength: number }

const DEFAULT_WIDTH = 50, DEFAULT_HEIGHT = 20
const DEFAULT_BRUSH: Brush = { size: 3, strength: 10 }

const CAP_DEPTH = -999
const SEA_COLORS_AMOUNT = 4
const DEPTH_INTERVAL = 250

const CAP_ELEVATION = 999
const ELEVATION_COLORS_AMOUNT = 12
const ELEVATION_INTERVAL = 80