
import { blend, scale } from 'chroma-js';
import { System } from 'climate/cpu.sim';
import { Input } from 'components/input';
import { replicate } from 'fp-ts/lib/Array';
import { CSSProperties, useCallback, useMemo, useState } from 'react';

import { Matrix, Velocity } from 'lib/math/types';
import { maxMatrix, minMatrix } from 'lib/math/utils';
import { set } from 'lib/objects/set';

import { Canvas } from './canvas';
import { World } from './world'




const max = {
  atmosphere: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY } },
  ocean: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY } },
  ice: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY }, thickness: 0 },
}
const min = {
  atmosphere: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY } },
  ocean: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY } },
  ice: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY }, thickness: Number.POSITIVE_INFINITY },
}

let gpuMax = Number.NEGATIVE_INFINITY
let gpuMin = Number.POSITIVE_INFINITY

function App() {


  const [state, setState] = useState<State>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    grid: generateGrid(DEFAULT_WIDTH, DEFAULT_HEIGHT),
    brush: DEFAULT_BRUSH,
  })

  const [system, setSystem] = useState<System>()

  const [gpuGrid, setGridGPU] = useState<Matrix<number>>()
  const [done, setDone] = useState<boolean>(false)

  const sim: Worker = useMemo(() => {
    const _sim = new Worker(new URL("../climate/sim.ts", import.meta.url))
    _sim.onmessage = e => {

      if (e.data.type === "DONE") {
        console.log("DONE")

        sim.terminate()
        setDone(true)
        return
      }

      if (e.data.type === "GPU_SYSTEM") {
        console.log("Iteration:", e.data.iteration, "Time elapsed:", (e.data.iteration / 24).toFixed(2), "days", (e.data.iteration / 24 / 30.5).toFixed(2), "months")
        gpuMax = maxMatrix(gpuMax, e.data.system.temperature)
        gpuMin = minMatrix(gpuMin, e.data.system.temperature)
        return setGridGPU(e.data.system.temperature)
      }
      // if (e.data.type === "GPU") {
      //   console.log("Iteration:", e.data.iteration, "Time elapsed:", (e.data.iteration / 24).toFixed(2), "days", (e.data.iteration / 24 / 30).toFixed(2), "months")
      //   //console.log("data", e.data.grid)
      //   gpuMax = maxMatrix(gpuMax, e.data.grid)
      //   gpuMin = minMatrix(gpuMin, e.data.grid)
      //   return setGridGPU(e.data.grid)
      // }
      // console.log("message", e)
      // const system: System = e.data.system

      // max.atmosphere.velocity = maxVelocity(max.atmosphere.velocity, system.fields.atmosphere.velocity)
      // min.atmosphere.velocity = minVelocity(min.atmosphere.velocity, system.fields.atmosphere.velocity)
      // max.atmosphere.temp = maxMatrix(max.atmosphere.temp, system.fields.atmosphere.temperature)
      // min.atmosphere.temp = minMatrix(min.atmosphere.temp, system.fields.atmosphere.temperature)

      // max.ocean.velocity = maxVelocity(max.ocean.velocity, system.fields.ocean.velocity)
      // min.ocean.velocity = minVelocity(min.ocean.velocity, system.fields.ocean.velocity)
      // max.ocean.temp = maxMatrix(max.ocean.temp, system.fields.ocean.temperature)
      // min.ocean.temp = minMatrix(min.ocean.temp, system.fields.ocean.temperature)

      // max.ice.velocity = maxVelocity(max.ice.velocity, system.fields.ice.velocity)
      // min.ice.velocity = minVelocity(min.ice.velocity, system.fields.ice.velocity)
      // max.ice.temp = maxMatrix(max.ice.temp, system.fields.ice.temperature)
      // min.ice.temp = minMatrix(min.ice.temp, system.fields.ice.temperature)
      // max.ice.thickness = maxMatrix(max.ice.thickness, system.fields.ice.thickness)
      // min.ice.thickness = minMatrix(min.ice.thickness, system.fields.ice.thickness)


      // console.log("MAX:", max)
      // console.log("MIN:", min)

      // setSystem(system)


    }
    return _sim
  }, [])

  const simulateWinds = useCallback(() => {
    sim.postMessage({ type: "RUN", width: state.width, height: state.height, elevation: toElevation(state.grid) })
  }, [sim, state.grid, state.height, state.width])

  if (done) console.log(gpuGrid)
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
      { gpuGrid &&
        <section>
          <Temperature field={ gpuGrid } size={ { h: state.height, w: state.width } } max={ gpuMax } min={ gpuMin } />
        </section> }
      <section>
        { system &&
          <div>
            <h3>Ocean</h3>
            <Velocities field={ system.fields.ocean.velocity } size={ system.size } max={ max.ocean.velocity } min={ min.ocean.velocity } />
            <Temperature field={ system.fields.ocean.temperature } size={ system.size } max={ max.ocean.temp } min={ min.ocean.temp } />
            <hr />

            <h3>Atmosphere</h3>
            <Velocities field={ system.fields.atmosphere.velocity } size={ system.size } max={ max.atmosphere.velocity } min={ min.atmosphere.velocity } />
            <Temperature field={ system.fields.atmosphere.temperature } size={ system.size } max={ max.atmosphere.temp } min={ min.atmosphere.temp } />
            <hr />

            <h3>Ice</h3>
            <Velocities field={ system.fields.ice.velocity } size={ system.size } max={ max.ice.velocity } min={ min.ice.velocity } />
            <Temperature field={ system.fields.ice.temperature } size={ system.size } max={ max.ice.temp } min={ min.ice.temp } />
            <Thickness field={ system.fields.ice.thickness } size={ system.size } max={ max.ice.thickness } min={ min.ice.thickness } />
          </div>
        }
      </section>
      <section>

        <World state={ state } setState={ setState } />
      </section>
    </div>
  );
}

export default App;


type VelocityProps = { field: Matrix<Velocity>, size: System["size"], min: Velocity, max: Velocity }
export const Velocities = ({ field, size, min, max }: VelocityProps) =>
  <div style={ uv_maps }>
    <div>
      <p>U velocity</p>
      <Canvas state={ field.map(row => row.map(cell => cell.u)) } width={ size.w } height={ size.h } deriveColor={ deriveColor("U", { min: min.u, max: max.u }) as any } />
    </div>
    <div>
      <p>V velocity</p>
      <Canvas state={ field.map(row => row.map(cell => cell.v)) } width={ size.w } height={ size.h } deriveColor={ deriveColor("V", { min: min.v, max: max.v }) as any } />
    </div>
    <div>
      <p>Blended velocity</p>
      <Canvas state={ field } width={ size.w } height={ size.h }
        deriveColor={ (value: any) => {
          const u = deriveColor("U", { min: min.u, max: max.u })(value.u)
          const v = deriveColor("V", { min: min.v, max: max.v })(value.v)

          return blend(u, v, "overlay").hex()
        } } />
    </div>
  </div >

type TemperatureProps = { field: Matrix<number>, size: System["size"], min: number, max: number }
export const Temperature = ({ field, size, min, max }: TemperatureProps) =>
  <div style={ uv_maps }>
    <p>Temperature</p>
    <Canvas state={ field } width={ size.w } height={ size.h } deriveColor={ deriveColor("T", { min, max }) as any } />
  </div >

export const Thickness = ({ field, size, min, max }: TemperatureProps) =>
  <div style={ uv_maps }>
    <p>Thickness</p>
    <Canvas state={ field } width={ size.w } height={ size.h } deriveColor={ deriveColor("I", { min, max }) as any } />
  </div >

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



const toElevation
  : (grid: Grid) => Matrix<number>
  = grid => grid.map(row => row.map(({ altitude }) => altitude < 0 ? 0 : altitude))


const maxVelocity = (current: Velocity, field: Matrix<Velocity>) => field.reduce((_max, row) => ({
  u: Math.max(_max.u, ...row.map(({ u }) => u)),
  v: Math.max(_max.u, ...row.map(({ v }) => v)),
}), current)
const minVelocity = (current: Velocity, field: Matrix<Velocity>) => field.reduce((_min, row) => ({
  u: Math.min(_min.u, ...row.map(({ u }) => u)),
  v: Math.min(_min.u, ...row.map(({ v }) => v)),
}), current)


const generateGrid
  : (width: number, height: number) => Grid
  = (w, h) => replicate(h, replicate(w, { altitude: 0 }))


const deriveColor
  : (component: "U" | "V" | "T" | "I", endpoints: { min: number, max: number }) => (n: number) => string
  = (component, { min, max }) => n => {
    let fn
    if (component === "U") fn = scale(["cyan", "white", "magenta"]).domain([min, max]).mode("lab")
    if (component === "V") fn = scale(["yellow", "white", "red"]).domain([min, max]).mode("lab")
    if (component === "T") fn = scale(["blue", "green", "red"]).domain([min, max]).mode("lab")
    if (component === "I") fn = scale(["black", "white"]).domain([min, max]).mode("lab")

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

const DEFAULT_WIDTH = 32, DEFAULT_HEIGHT = 32
const DEFAULT_BRUSH: Brush = { size: 1, strength: 10 }

