
import { albedo_ice, cp_ice, g, h_transfer, k_air, lambda_base, rho_air, rho_ice, rho_water, tau_tr_air } from 'climate/parameters/constants';
import { coriolis, crossDirection, diffusion, drag, Q_exchange,Q_sol, radiative_loss } from 'climate/parameters/variables';
import * as F from 'fp-ts/function'
import * as R from "fp-ts/Reader";

import { Vec2D } from 'lib/math/types';
import { add, divide, grad, Local,local, multiply, subtract, toVec2D } from 'lib/math/utils';

import Climate from '../parameters';
import { SimulationEnv } from '../sim';


export const Qx_ice
    : (temperature: number) => Local<number, SimulationEnv>
    = T => R.asksReader(({ fields }) =>  F.pipe(
            R.Do,
            R.bind("thickness", () => local(fields.ice.thickness)),
            R.bind("T_ice",  () => local(fields.ice.temperature)),
            R.map(({ thickness, T_ice }) => thickness > 0 ? h_transfer*(T - T_ice) : 0)
        )
    )


export const Q
    : Local<number, SimulationEnv>
    = R.asksReader(({ fields }) => F.pipe(
        R.Do,
        R.bind("diffusion", () => diffusion(fields.atmosphere.temperature, k_air)),
        R.bind("thickness", () => local(fields.ice.thickness)),
        R.bind("T_air", () => local(fields.atmosphere.temperature)),
        R.bind("T_ocean", () => local(fields.ocean.temperature)),
        R.bind("T_ice", () => local(fields.ice.temperature)),
        R.bind("T_land", () => local(fields.land.temperature)),
        R.bind("Q_sol", () => Q_sol),
        R.map(({ diffusion, T_air, thickness, T_ice, T_ocean, T_land, Q_sol }) => {
            if (thickness <= 0) return 0
            return tau_tr_air * (1 - albedo_ice) * Q_sol + diffusion - radiative_loss(T_ocean) - Q_exchange(T_ice, T_ocean) - Q_exchange(T_ice, T_air) - Q_exchange(T_ice, T_land)
        }
        )
    ))

export const motionMD
    : Local<Vec2D, SimulationEnv>
    = R.asksReader<SimulationEnv, Vec2D>(({ point, size, fields }) => F.pipe(
        R.Do,

        R.bind("v_ice", () => R.Functor.map(local(fields.ice.velocity), toVec2D)),
        R.bind("v_water", () => R.Functor.map(local(fields.ocean.velocity), toVec2D)),
        R.bind("drag", () => drag(fields.elevation)),
        R.bind("thickness", () => local(fields.ice.thickness)),
        R.bind("grad_I", () => grad(fields.ice.thickness)),
        R.bind("wind_stress", () => Climate.stress(fields.atmosphere.velocity, rho_air, lambda_base)),
        R.bind("water_stress", () => Climate.stress(fields.ocean.velocity, rho_water, lambda_base)),
        R.map(({ v_ice, drag, wind_stress, water_stress, grad_I, thickness }) => {
            if (thickness <= 0) return { x: 0, y: 0 }
            
            const mass = rho_ice * thickness
            const grad_pressure = multiply(-rho_ice * g, grad_I)
            const v = subtract([
                multiply(coriolis(point.y, size.h), crossDirection(v_ice)),
                divide(grad_pressure, rho_ice),
                water_stress,
                multiply(drag, v_ice),
            
            ])
            const total = add([v, wind_stress])
            return divide(total, mass)
        }
       )
    ))


export const thicknessMD
    : Local<number, SimulationEnv>
    = R.asksReader(({ fields }) => F.pipe(
        R.Do,
        R.bind("_Q", () => Q),
        R.map(({ _Q }) => 0)
    ))

export const temperatureMD
    : Local<number, SimulationEnv>
    = R.asksReader(({ fields }) => F.pipe(
        R.Do,
        R.bind("thickness", () => local(fields.ice.thickness)),
        R.bind("_Q", () => Q),
        R.map(({_Q, thickness}) => thickness <= 0 ? 0 : _Q / (rho_ice * cp_ice))
    ))
    
    