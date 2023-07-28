
import { blend, scale } from 'chroma-js';
import { Input } from 'components/input';
import { replicate } from 'fp-ts/lib/Array';
import { CSSProperties, useCallback, useMemo, useState } from 'react';

import { set } from 'lib/objects/set';

import { Canvas } from './canvas';
import { World } from './world'
import { System } from 'climate/sim';


const max = { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY }
const min = { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY }

function App() {


  const [state, setState] = useState<State>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    grid: generateGrid(DEFAULT_WIDTH, DEFAULT_HEIGHT),
    brush: DEFAULT_BRUSH,
  })

  const [system, setSystem] = useState<System>()


  const sim: Worker = useMemo(() => {
    const _sim = new Worker(new URL("../climate/sim.ts", import.meta.url))
    _sim.onmessage = e => {
      console.log("message", e)



      const system: System = e.data.state

      const us = data.flatMap(row => row.map(cell => cell.u))
      const vs = data.flatMap(row => row.map(cell => cell.v))

      max.u = Math.max(max.u, ...us)
      max.v = Math.max(max.v, ...vs)
      min.u = Math.min(min.u, ...us)
      min.v = Math.min(min.v, ...us)

      console.log("MAX:", max)
      console.log("MIN:", min)

      setWinds(data)

      if (e.data.type === "STEP") {
        console.log("iteration", e.data.iteration, "months elapsed:", (e.data.iteration / 60 / 60 / 24 / 30).toFixed(2))
        console.log("convergence", e.data.convergence)
      }
      if (e.data.type === "DONE") {
        console.log("DONE")
        console.log(data)
        sim.terminate()
      }
    }
    return _sim
  }, [])

  const simulateWinds = useCallback(() => {
    sim.postMessage({ type: "RUN", width: state.width, height: state.height, circumference: 30000 })
  }
    , [sim, state.height, state.width])

  return (
    <div >
      <header>
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
            <button type="button" onClick={ _ => setState(set("grid", generateGrid(state.width, state.height))) }>
              Update Grid
            </button>
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
          <button onClick={ _ => simulateWinds() }>Calculate winds</button>
        </section>
      </header>
      <section>
        { winds &&
          <div style={ uv_maps }>
            <div>
              <p>U velocity</p>
              <Canvas state={ winds.map(row => row.map(cell => cell.u)) } width={ state.width } height={ state.height } deriveColor={ deriveColor("U") as any } />
            </div>
            <div>
              <p>V velocity</p>
              <Canvas state={ winds.map(row => row.map(cell => cell.v)) } width={ state.width } height={ state.height } deriveColor={ deriveColor("V") as any } />
            </div>
            <div>
              <p>Blended velocity</p>
              <Canvas state={ winds } width={ state.width } height={ state.height }
                deriveColor={ (value: any) => {
                  const u = deriveColor("U")(value.u)
                  const v = deriveColor("V")(value.v)

                  return blend(u, v, "overlay").hex()
                } } />
            </div>
          </div >
        }
      </section>
      <section>

        <World state={ state } setState={ setState } />
      </section>
    </div>
  );
}

export default App;




const sForm: CSSProperties = {
  width: "400px"
}

const sFields: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1em"

}

const uv_maps: CSSProperties = {
  display: "flex",
  width: "100%",
  flexWrap: "wrap",
  justifyContent: "space-evenly"
}


const generateGrid
  : (width: number, height: number) => Grid
  = (w, h) => replicate(h, replicate(w, { altitude: 0 }))


const deriveColor
  : (component: "U" | "V") => (n: number) => string
  = component => n => {
    let fn
    if (component === "U") fn = scale(["cyan", "white", "magenta"]).domain([min.u, max.u]).mode("lab")
    if (component === "V") fn = scale(["yellow", "white", "red"]).domain([min.v, max.v]).mode("lab")

    return fn?.(n).hex() || "black"
  }

export type State = {
  width: number;
  height: number;
  grid: Grid;
  brush: Brush;
}


/**  
 * `Grid`: `Array` of `Row`   
 * `Row` : `Array` of `Cell`
 * */
export type Grid = Array<Array<Cell>>
export type Cell = { altitude: number }

type Brush = { size: number, strength: number }

const DEFAULT_WIDTH = 30, DEFAULT_HEIGHT = 30
const DEFAULT_BRUSH: Brush = { size: 2, strength: 10 }

