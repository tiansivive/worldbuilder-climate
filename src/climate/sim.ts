import * as A from 'fp-ts/Array'
import * as R from 'fp-ts/Reader'
import { fromVec2D, localDerivative,LocalEnv, Matrix, Radians, Vec2D, Velocity } from 'math/utils';

import { dt, T0 } from './parameters/constants';
import * as Atmosphere from './systems/atmosphere';
import * as Ice from './systems/ice';
import * as Land from './systems/land';
import * as Ocean from './systems/ocean';

type Params = {
    type: "RUN",
    width: number,
    height: number,
    circumference: number,
    elevation: Matrix<number>
}



// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<Params>) => {
    
    // eslint-disable-next-line no-restricted-globals
    const m = run(e.data, (iteration, state) => self.postMessage({ type: "STEP", state, iteration }))
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ type: "DONE", matrix: m });
  
};

export const run
    : (params: Params, emit: (iteration: number, state: System) => void) => System
    = (options, emit) => {

        const generateField = <T>(value: T) =>  create2DArray(options.height, options.width, value)
        const system: System = {
            size: { h: options.height, w: options.width },
            planet: {
                circumference: 40000,
                axial_tilt: 0.410, //radians
                rotation_speed: 7.27e-5 // radians/s
            },
            fields: {
                elevation: options.elevation,
                land: { temperature: generateField(T0) },
                atmosphere: {
                    temperature: generateField(T0),
                    velocity: generateField({ u: 0, v: 0 })
                },
                ocean: {
                    temperature: generateField(T0),
                    velocity: generateField({ u: 0, v: 0 })
                },
                ice: {
                    temperature: generateField(T0),
                    velocity: generateField({ u: 0, v: 0 }),
                    thickness: generateField(0)
                }
            }
        }

        console.log("system:", system)
    
        // Time loop until convergence
        let counter = 0
        // let convergence = Number.POSITIVE_INFINITY
        while (counter < 60 * 60 * 24 * 365) {
            if (counter % 60 * 60 * 12 === 0) {
                emit(counter, system)
            }

            const next = update(system, counter * dt);
            // convergence = calculateConvergence(system, next, options);
            system.fields = next


            ++counter
        }

        return system
      
}
 



// Function to update the wind components using the simplified Navier-Stokes equations
const update
    : (system: System, time: number) => System["fields"]
    = ({ size, fields, planet }, time)   => {
    const generateField = <T>(value: T) =>  create2DArray(size.h, size.w, value)
 
    const nextFields: System["fields"] = {
        elevation: fields.elevation,
        land: { temperature: generateField(0) },
        atmosphere: {
            temperature: generateField(0),
            velocity: generateField({ u: 0, v: 0 })
        },
        ocean: {
            temperature: generateField(0),
            velocity: generateField({ u: 0, v: 0 })
        },
        ice: {
            temperature: generateField(0),
            velocity: generateField({ u: 0, v: 0 }),
            thickness: generateField(0)
        }
    }
    
    const dx = planet.circumference / size.w, dy = planet.circumference / size.h
    // const T_avg = T[0].reduce((sum, _T) => _T + sum, 0) / options.height

    
    for (let y = 0; y < size.h; y++) {
        for (let x = 0; x < size.w; x++) {
            const point: Vec2D = { x, y }
            const step: Vec2D = { x: dx, y: dy }
            const env = { point, size, step, fields, planet, time }



            const dT_ocean = R.Monad.chain(Ocean.temperatureMD,      DT => localDerivative(fields.ocean.temperature,      fields.ocean.velocity[x][y],      DT))
            const dV_ocean = R.Monad.chain(Ocean.motionMD,           DT => localDerivative(fields.ocean.temperature,      fields.ocean.velocity[x][y],      DT))
            const dT_air   = R.Monad.chain(Atmosphere.temperatureMD, DT => localDerivative(fields.atmosphere.temperature, fields.atmosphere.velocity[x][y], DT))
            const dV_air   = R.Monad.chain(Atmosphere.motionMD,      DT => localDerivative(fields.atmosphere.temperature, fields.atmosphere.velocity[x][y], DT))
            const dT_ice   = R.Monad.chain(Ice.temperatureMD,        DT => localDerivative(fields.ice.temperature,        fields.ice.velocity[x][y],        DT))
            const dV_ice   = R.Monad.chain(Ice.motionMD,             DT => localDerivative(fields.ice.temperature,        fields.ice.velocity[x][y],        DT))
            const dI_ice   = R.Monad.chain(Ice.thicknessMD,          DT => localDerivative(fields.ice.temperature,        fields.ice.velocity[x][y],        DT))

            const dT_land = Land.temperature(env)

            nextFields.land.temperature[y][x] = dT_land
            nextFields.atmosphere.temperature[y][x] = dT_air(env)
            nextFields.atmosphere.velocity[y][x] = fromVec2D(dV_air(env))
            nextFields.ocean.temperature[y][x] = dT_ocean(env)
            nextFields.ocean.velocity[y][x] = fromVec2D(dV_ocean(env))
            nextFields.ice.temperature[y][x] = dT_ice(env)
            nextFields.ice.velocity[y][x] = fromVec2D(dV_ice(env))
            nextFields.ice.thickness[y][x] = dI_ice(env)
        
    }
  }

  // Update the wind arrays with the new values
  return nextFields
}

// Function to calculate the convergence between consecutive time steps
function calculateConvergence(system: System, next: System, opts: Params) {
  const totalChange = 0;

//   for (let y = 0; y < opts.height; y++) {
//     for (let x = 0; x < opts.width; x++) {
//       const du = u[y][x] - newU[y][x];
//       const dv = v[y][x] - newV[y][x];
//       totalChange += du * du + dv * dv;
//     }
//   }

  return Math.sqrt(totalChange);
}



const create2DArray
    : <T = number>(rows: number, cols: number, initialVal: T) => Matrix<T>
    // small perturbation to break symmetry
    = (r: number, c: number, ini) => A.replicate(r, 0).map(_ => A.replicate(c, ini))

export type SimulationEnv = LocalEnv & System
export type System = {
    size: { w: number, h: number },
    planet: {
        axial_tilt: Radians,
        rotation_speed: Radians,
        circumference: number
    }
    fields: {
        elevation: Matrix<number>,
        atmosphere: {
            velocity: Matrix<Velocity>
            temperature: Matrix<number>,
        },
        ocean: {
            velocity: Matrix<Velocity>
            temperature: Matrix<number>,
        },
        ice: {
            velocity: Matrix<Velocity>
            temperature: Matrix<number>,
            thickness: Matrix<number>
        }
        land: { temperature: Matrix<number>}
        
     
    }   
 }
    





// Initial values for variables
const v_air = {x: 0, y: 0};  // Air velocity (m/s)
const v_water = {x: 0, y: 0};  // Ocean velocity (m/s)
const v_ice = {x: 0, y: 0};  // Ice velocity (m/s)
const T_air = 288;  // Air temperature (K)
const T_water = 288;  // Ocean temperature (K)
const T_ice = 273;  // Ice temperature (K)
const T_land = 288;  // Land temperature (K)
const I = 0;  // Ice thickness (m)