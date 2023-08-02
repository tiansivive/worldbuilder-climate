
import Climate from 'climate/parameters/index'
import { SimulationEnv } from 'climate/sim'
import * as F from 'fp-ts/function'
import * as R from 'fp-ts/Reader'

import { Local,local } from 'lib/math/utils'

export const Q
    : Local<number, SimulationEnv>
    = R.asksReader(({ fields }) => F.pipe(
        R.Do,
        R.bind("diffusion", () => Climate.diffusion(fields.atmosphere.temperature, Climate.k_air)),
        R.bind("T_air", () => local(fields.atmosphere.temperature)),
        R.bind("T_ocean", () => local(fields.ocean.temperature)),
        R.bind("T_land", () => local(fields.land.temperature)),
        R.bind("Q_sol", () => Climate.Q_sol),
        R.map(({ diffusion, T_air, T_land, T_ocean, Q_sol }) => 
            (1 - Climate.albedo_land) * Q_sol + diffusion - Climate.radiative_loss(T_land) + Climate.Q_exchange(T_land, T_air) + Climate.Q_exchange(T_land, T_ocean) 
        )
    ))

export const temperature
    : Local<number, SimulationEnv>
    = R.Functor.map(Q, _Q => _Q / (Climate.rho_land * Climate.cp_land))
    
    