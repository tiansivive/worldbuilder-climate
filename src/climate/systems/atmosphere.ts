
import * as F from 'fp-ts/function'
import * as R from 'fp-ts/Reader'
import { grad, Local, local, multiply, subtract, toVec2D,Vec2D } from 'math/utils';

import { cp_air, k_air, R as airGasConstant, rho_air } from '../parameters/constants';
import { coriolis, crossDirection, diffusion, drag, Q_exchange, Q_sol, topographical_forcing } from '../parameters/variables';
import { SimulationEnv } from '../sim';
import { Qx_ice } from './ice';


export const Q
    : Local<number, SimulationEnv>
    = R.asksReader(({ fields }) => F.pipe(
        R.Do,
        R.bind("diffusion", () => diffusion(fields.atmosphere.temperature, k_air)),
        R.bind("T_air", () => local(fields.atmosphere.temperature)),
        R.bind("T_ocean", () => local(fields.ocean.temperature)),
        R.bind("T_land", () => local(fields.land.temperature)),
        R.bind("Q_sol", () => Q_sol),
        R.bind("Qx_air_ice", ({ T_air }) =>  Qx_ice(T_air)),
        R.map(({ diffusion, T_air, T_land, T_ocean, Q_sol, Qx_air_ice }) => 
             Q_sol + diffusion + Q_exchange(T_air, T_ocean) + Q_exchange(T_air, T_land) + Qx_air_ice
        )
    ))
export const motionMD
    : Local<Vec2D, SimulationEnv>
    = R.asksReader<SimulationEnv, Vec2D>(({ point, size, fields }) => F.pipe(
            R.Do,
            R.bind("temp_grad", () => grad(fields.atmosphere.temperature)),
            R.bind("drag", () => drag(fields.elevation)),
            R.bind("topography_forcing", () => topographical_forcing(fields.elevation, fields.atmosphere.velocity)),
            R.bind("v", () => R.Functor.map(local(fields.atmosphere.velocity), toVec2D)),
            R.map(({ temp_grad, drag, v, topography_forcing }) => subtract([
                multiply(coriolis(point.y, size.h), crossDirection(v)),
                multiply(airGasConstant, temp_grad),
                multiply(drag, v),
                topography_forcing
            ]))
        ))



export const temperatureMD
    : Local<number, SimulationEnv>
    = R.Functor.map(Q, _Q => _Q / (rho_air * cp_air))
    
    