
import * as F from 'fp-ts/function'
import * as R from 'fp-ts/Reader'
import { divide, grad, Local, local, multiply, subtract, toVec2D,Vec2D } from 'math/utils';

import Climate from '../parameters';
import { albedo_water,beta_water,cp_water, g, k_air, lambda_base, rho_air, rho_ice, rho_water, tau_tr_air } from '../parameters/constants';
import { coriolis, crossDirection, diffusion, Q_exchange, Q_sol, radiative_loss } from '../parameters/variables';
import { SimulationEnv } from '../sim';


export const Q
    : Local<number, SimulationEnv>
    = R.asksReader(({ fields }) => F.pipe(
        R.Do,
        R.bind("diffusion", () => diffusion(fields.atmosphere.temperature, k_air)),
        R.bind("T_air", () => local(fields.atmosphere.temperature)),
        R.bind("T_ocean", () => local(fields.ocean.temperature)),
        R.bind("T_ice", () => local(fields.ice.temperature)),
        R.bind("T_land", () => local(fields.land.temperature)),
        R.bind("Q_sol", () => Q_sol),
        R.map(({ diffusion, T_air, T_land, T_ice, T_ocean, Q_sol }) => 
             tau_tr_air * (1 - albedo_water) * Q_sol + diffusion - radiative_loss(T_ocean) - Q_exchange(T_ocean, T_land) - Q_exchange(T_ocean, T_ice) - Q_exchange(T_ocean, T_air)
        )
    ))
export const motionMD
    : Local<Vec2D, SimulationEnv>
    = R.asksReader<SimulationEnv, Vec2D>(({ point, size, fields }) => F.pipe(
        R.Do,
        R.bind("temp_grad", () => grad(fields.atmosphere.temperature)),
        R.bind("v_air", () => R.Functor.map(local(fields.atmosphere.velocity), toVec2D)),
        R.bind("v_ice", () => R.Functor.map(local(fields.ice.velocity), toVec2D)),
        R.bind("v_water", () => R.Functor.map(local(fields.ocean.velocity), toVec2D)),
        R.bind("ice_thickness", () => local(fields.ice.thickness)),
        R.bind("wind_stress", () => Climate.stress(fields.atmosphere.velocity, rho_air, lambda_base)),
        R.bind("ice_stress", () => Climate.stress(fields.ice.velocity, rho_ice, lambda_base)),
        R.map(({ temp_grad, v_water, wind_stress, ice_thickness, ice_stress }) => 
            subtract([
                multiply(coriolis(point.y, size.h), crossDirection(v_water)),
                multiply(g * beta_water, temp_grad),
                divide(wind_stress, rho_water),
                divide(multiply(ice_thickness, ice_stress), rho_water)
        ])
       )
    ))



export const temperatureMD
    : Local<number, SimulationEnv>
    = R.Functor.map(Q, _Q => _Q / (rho_water * cp_water))
    
    