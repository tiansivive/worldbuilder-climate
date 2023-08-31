
import { Box, Button, Container, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import { scale } from 'chroma-js';
import { System } from 'climate/cpu.sim';
import { ID } from 'climate/systems/common';
import { replicate } from 'fp-ts/lib/Array';
import _ from "lodash"
import { CSSProperties, useCallback, useMemo, useState } from 'react';

import { Matrix, Velocity } from 'lib/math/types';
import { maxMatrix, minMatrix } from 'lib/math/utils';
import { set } from 'lib/objects/set';

import { Canvas } from '../components/canvas';
import { World } from '../components/world'
import { Brush, BrushControls } from './Brush';
import { SizeControls, valid } from './Form';




const max = {
  atmosphere: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY } },
  ocean: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY } },
  ice: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY }, thickness: 0 },
  debug: { temp: Number.NEGATIVE_INFINITY, velocity: { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY } },
}
const min = {
  atmosphere: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY } },
  ocean: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY } },
  ice: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY }, thickness: Number.POSITIVE_INFINITY },
  debug: { temp: Number.POSITIVE_INFINITY, velocity: { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY } },
}




function App() {


  const [state, setState] = useState<State>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    size: { x: DEFAULT_WIDTH, y: DEFAULT_HEIGHT },
    grid: generateGrid(DEFAULT_WIDTH, DEFAULT_HEIGHT),
    brush: DEFAULT_BRUSH,
  })



  const [gpuGrids, setGPUGrids] = useState<Record<string, Matrix<number | Velocity>>>()
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
        const _sys: Record<ID, { values: any[], debug: any[] }> = e.data.system
        console.log("Iteration:", e.data.iteration, "Time elapsed:", (e.data.iteration / 24).toFixed(2), "days", (e.data.iteration / 24 / 30).toFixed(2), "months")


        max.atmosphere.temp = maxMatrix(max.atmosphere.temp, _sys["atmosphere:temperature"].values)
        min.atmosphere.temp = minMatrix(min.atmosphere.temp, _sys["atmosphere:temperature"].values)

        const atmosphere_uv = (e.data.system["atmosphere:velocity"].values as Matrix<[number, number]>).map(row => row.map(([u, v]) => ({ u, v })))
        max.atmosphere.velocity = maxVelocity(max.atmosphere.velocity, atmosphere_uv)
        min.atmosphere.velocity = minVelocity(min.atmosphere.velocity, atmosphere_uv)

        max.ocean.temp = maxMatrix(max.ocean.temp, _sys["ocean:temperature"].values)
        min.ocean.temp = minMatrix(min.ocean.temp, _sys["ocean:temperature"].values)

        const ocean_uv = (e.data.system["ocean:velocity"].values as Matrix<[number, number]>).map(row => row.map(([u, v]) => ({ u, v })))
        max.ocean.velocity = maxVelocity(max.ocean.velocity, ocean_uv)
        min.ocean.velocity = minVelocity(min.ocean.velocity, ocean_uv)

        // const debug_uv = (e.data.system.debug.vel as Matrix<[number, number]>).map(row => row.map(([u, v]) => ({ u, v })))
        // max.debug.velocity = maxVelocity(max.debug.velocity, debug_uv)
        // min.debug.velocity = minVelocity(min.debug.velocity, debug_uv)

        return setGPUGrids({
          "atmosphere:temperature": e.data.system["atmosphere:temperature"].values,
          "atmosphere:temperature:debug": e.data.system["atmosphere:temperature"].debug,
          "atmosphere:velocity": atmosphere_uv,
          "atmosphere:velocity:debug": e.data.system["atmosphere:velocity"].debug,
          "ocean:temperature": e.data.system["ocean:temperature"].values,
          "ocean:temperature:debug": e.data.system["ocean:temperature"].debug,
          "ocean:velocity": ocean_uv,
          "ocean:velocity:debug": e.data.system["ocean:velocity"].debug,
        })
      }



    }
    return _sim
  }, [])

  const simulateWinds = useCallback(() => {
    sim.postMessage({ type: "RUN", width: state.size.x, height: state.size.y, elevation: toElevation(state.grid) })
  }, [sim, state.grid, state.size.x, state.size.y])

  if (done) console.log(gpuGrids)

  return (
    <Container >
      <Box>
        <SizeControls update={ size => setState(set("size", size)) } size={ state.size } />
        <BrushControls update={ brush => setState(set("brush", brush)) } brush={ state.brush } />
        <Button maxW="10em" disabled={ !valid(state.size.x) || !valid(state.size.y) } onClick={ () => simulateWinds() }>Run</Button>

      </Box>
      { !gpuGrids && <World state={ state } setState={ setState } /> }
      { gpuGrids &&
        <Tabs>
          <TabList>
            <Tab>Map</Tab>
            <Tab>Air</Tab>
            <Tab>Ocean</Tab>



          </TabList>
          <TabPanels>
            <TabPanel>
              <World state={ state } setState={ setState } />
            </TabPanel>

            <TabPanel>
              <Temperature field={ gpuGrids["atmosphere:temperature"] as Matrix<number> } size={ { h: state.size.y, w: state.size.x } } max={ max.atmosphere.temp } min={ min.atmosphere.temp } />
              <Velocities field={ gpuGrids["atmosphere:velocity"] as Matrix<Velocity> } size={ { h: state.size.y, w: state.size.x } } max={ max.atmosphere.velocity } min={ min.atmosphere.velocity } />
            </TabPanel>
            <TabPanel>
              <Temperature field={ gpuGrids["ocean:temperature"] as Matrix<number> } size={ { h: state.size.y, w: state.size.x } } max={ max.ocean.temp } min={ min.ocean.temp } />
              <Velocities field={ gpuGrids["ocean:velocity"] as Matrix<Velocity> } size={ { h: state.size.y, w: state.size.x } } max={ max.ocean.velocity } min={ min.ocean.velocity } />

            </TabPanel>
            {/* <Velocities field={ gpuGrids.debug } size={ { h: state.size.y, w: state.size.x  } } max={ max.debug.velocity } min={ min.debug.velocity } /> */ }
            {/* <Thickness field={ system.fields.ice.thickness } size={ system.size } max={ max.ice.thickness } min={ min.ice.thickness } /> */ }

          </TabPanels>


        </Tabs>
      }

    </Container>
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
    {/* <div>
      <p>Blended velocity</p>
      <Canvas state={ field } width={ size.w } height={ size.h }
        deriveColor={ (value: any) => {
          const u = deriveColor("U", { min: min.u, max: max.u })(value.u)
          const v = deriveColor("V", { min: min.v, max: max.v })(value.v)

          return blend(u, v, "overlay").hex()
        } } />
    </div> */}
  </div >

type TemperatureProps = { field: Matrix<number>, size: System["size"], min: number, max: number }
export const Temperature = ({ field, size, min, max }: TemperatureProps) =>
  <div style={ temp_maps }>
    <p>Temperature</p>
    <Canvas state={ field } width={ size.w } height={ size.h } deriveColor={ deriveColor("T", { min, max }) as any } />
  </div >

export const Thickness = ({ field, size, min, max }: TemperatureProps) =>
  <div style={ uv_maps }>
    <p>Thickness</p>
    <Canvas state={ field } width={ size.w } height={ size.h } deriveColor={ deriveColor("I", { min, max }) as any } />
  </div >



const uv_maps: CSSProperties = {
  display: "flex",
  width: "100%",
  flexWrap: "wrap",
  justifyContent: "flex-start",
  gap: "2em"
}
const temp_maps: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-evenly",
  alignItems: "flex-start"
}

const grids: CSSProperties = {
  padding: "0 5em"

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
    if (component === "U") fn = scale(["cyan", "black", "magenta"]).domain([min, 0, max]).mode("lab")
    if (component === "V") fn = scale(["gold", "black", "red"]).domain([min, 0, max]).mode("lab")
    if (component === "T") fn = scale(["blue", "green", "red"]).domain([min, max]).mode("lab")
    if (component === "I") fn = scale(["black", "white"]).domain([min, max]).mode("lab")

    return fn?.(n).hex() || "black"
  }

export type State = {
  width: number;
  height: number;
  size: Dimensions;
  grid: Grid;
  brush: Brush;
}

type Dimensions = { x: number; y: number }

/**  
 * `Grid`: `Array` of `Row`   
 * `Row` : `Array` of `Cell`
 * */
export type Grid = Array<Array<Cell>>
export type Cell = { altitude: number }



const DEFAULT_WIDTH = 64, DEFAULT_HEIGHT = 64
const DEFAULT_BRUSH: Brush = { size: 2, strength: 50 }

