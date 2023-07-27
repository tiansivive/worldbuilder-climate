import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'
import { replicate, zipWith } from "fp-ts/lib/Array";
import * as R from 'fp-ts/Reader'
import { divide, grad, laplacian, Local, local, LocalEnv, Matrix, multiply, Radians, subtract, toVec2D,Vec2D, Velocity } from 'math/utils';

import { albedo_atmosphere,beta_air, convergenceThreshold, cp_air, g, k_air, R as airGasConstant, rho_air, S0, T0 } from './parameters/constants';
import { boussinesqPressure, coriolis, crossDirection, diffusion, drag, hour_omega, latitude, normal, topographical_forcing } from './parameters/variables';
type Params = {
    type: "RUN",
    width: number,
    height: number,
    circumference: number
}



// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<Params>) => {
    
    // eslint-disable-next-line no-restricted-globals
    const m = run(e.data, (iteration, convergence, matrix) => self.postMessage({ type: "STEP", matrix, iteration, convergence }))
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ type: "DONE", matrix: m });
  
};

export const run
    : (params: Params, emit: (iteration: number, convergence: number, result: Matrix<{ u: number; v: number; }>) => void) => Matrix<{ u: number; v: number; }>
    = (options, emit) => {

        let u = create2DArray(options.height, options.width, 0)
        let v = create2DArray(options.height, options.width, 0)
        const dT = 30 / (options.height/2) // linear gradient of 30C from pole to equator
        const T = create2DArray(options.height, options.width, T0 + 5).map((row, y) => row.map(_T => {
            if (y < options.height / 2) return _T + y * dT
            if (y === options.height / 2) return _T + 30
            if (y > options.height / 2) return _T + (options.height - y) * dT
            return _T
        }))

        console.log("Temperature:", T)
        //initializeWind();
        
        // Time loop until convergence
                let counter = 0
                let convergence = Number.POSITIVE_INFINITY
                while (counter < 60 * 60 * 24 * 365 && convergence > convergenceThreshold) {
                    if (counter % 60 * 60 * 12 === 0) {
                        //emit(counter, convergence, build(u, v))
                    }
                    
                    const { nextU, nextV } = updateWind(u, v, options, T);
                    convergence = calculateConvergence(u, v, nextU, nextV, options);
                    u = nextU; v = nextV
                    
                    
                    ++counter
                }
                
        
                return build(u, v)
      
  
      
}
 
const build
    : (u: Matrix<number>, v: Matrix<number>) => Matrix<{ u: number; v: number; }>
    = (u, v) => zipWith(u, v, (rowsU, rowsV) => zipWith(rowsU, rowsV, (colU, colV) => ({ u: colU, v: colV })))






// Function to update the wind components using the simplified Navier-Stokes equations
function updateWind(u: Matrix<number>, v: Matrix<number>, options: Params, T: Matrix<number>) {
    const nextU = create2DArray(options.height, options.width, 0)
    const nextV = create2DArray(options.height, options.width, 0)
    
    const dx = options.circumference / options.width, dy = options.circumference / options.height
    const T_avg = T[0].reduce((sum, _T) => _T + sum, 0) / options.height

    for (let y = 0; y < options.height; y++) {
        for (let x = 0; x < options.width; x++) {
        
          
          
        console.log()

    
    }
  }

  // Update the wind arrays with the new values
  return { nextU, nextV }
}

// Function to calculate the convergence between consecutive time steps
function calculateConvergence(u: Matrix<number>, v: Matrix<number>, newU: Matrix<number>, newV: Matrix<number>, opts: Params) {
  let totalChange = 0;

  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      const du = u[y][x] - newU[y][x];
      const dv = v[y][x] - newV[y][x];
      totalChange += du * du + dv * dv;
    }
  }

  return Math.sqrt(totalChange);
}



const create2DArray
    : (rows: number, cols: number, initialVal?: number) => Matrix<number>
    // small perturbation to break symmetry
    = (r: number, c: number, ini = Math.random() * 0.01) => A.replicate(r, 0).map(_ => A.replicate(c, ini))

export type SimulationEnv = LocalEnv & Parameters
type Parameters = {
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