/* eslint-disable no-restricted-globals */

import * as A from 'fp-ts/Array'
import * as R from 'fp-ts/Reader'

import { Matrix, Radians, Vec2D, Velocity } from 'lib/math/types';
import { add, fromVec2D, localDerivative, LocalEnv, toVec2D } from 'lib/math/utils';

import { T0 } from './parameters/constants';
import { Params } from './sim';
import * as Atmosphere from './systems/atmosphere/atmosphere';
import * as Ice from './systems/ice';
import * as Land from './systems/land';
import * as Ocean from './systems/ocean/ocean';

export const run
    : (params: Params, emit: (iteration: number, state: System) => void) => Promise<System>
    = async (options, emit) => {





        const generateField = <T>(value: T) => create2DArray(options.height, options.width, value)
        const dt = 60
        const system: System = {
            size: { h: options.height, w: options.width },
            planet: {
                circumference: 30000,
                axial_tilt: 0, //radians
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
        let counter = 0, now = Date.now()
        // let convergence = Number.POSITIVE_INFINITY
        while (counter < 60 * 24 * 365) {
            if (counter % 60 * 12 === 0) {
                const time = (Date.now() - now) / 1000
                console.log("12h took:", time.toFixed(4), "seconds")
                emit(counter, system)
                now = Date.now()
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
    = ({ size, fields, planet }, time) => {
        const generateField = <T>(value: T) => create2DArray(size.h, size.w, value)

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



                const dT_ocean = R.Monad.chain(Ocean.temperatureMD, DT => localDerivative(fields.ocean.temperature, fields.ocean.velocity[x][y], DT))
                const dV_ocean = R.Monad.chain(Ocean.motionMD, DT => localDerivative(fields.ocean.temperature, fields.ocean.velocity[x][y], DT))
                const dT_air = R.Monad.chain(Atmosphere.temperatureMD, DT => localDerivative(fields.atmosphere.temperature, fields.atmosphere.velocity[x][y], DT))
                const dV_air = R.Monad.chain(Atmosphere.motionMD, DT => localDerivative(fields.atmosphere.temperature, fields.atmosphere.velocity[x][y], DT))
                const dT_ice = R.Monad.chain(Ice.temperatureMD, DT => localDerivative(fields.ice.temperature, fields.ice.velocity[x][y], DT))
                const dV_ice = R.Monad.chain(Ice.motionMD, DT => localDerivative(fields.ice.temperature, fields.ice.velocity[x][y], DT))
                const dI_ice = R.Monad.chain(Ice.thicknessMD, DT => localDerivative(fields.ice.temperature, fields.ice.velocity[x][y], DT))

                const dT_land = Land.temperature(env)

                nextFields.land.temperature[y][x] = fields.land.temperature[y][x] + dT_land
                nextFields.atmosphere.temperature[y][x] = fields.atmosphere.temperature[y][x] + dT_air(env)
                nextFields.atmosphere.velocity[y][x] = fromVec2D(add([toVec2D(fields.atmosphere.velocity[y][x]), dV_air(env)]))
                nextFields.ocean.temperature[y][x] = fields.ocean.temperature[y][x] + dT_ocean(env)
                nextFields.ocean.velocity[y][x] = fromVec2D(add([toVec2D(fields.ocean.velocity[y][x]), dV_ocean(env)]))
                nextFields.ice.temperature[y][x] = fields.ice.temperature[y][x] + dT_ice(env)
                nextFields.ice.velocity[y][x] = fromVec2D(add([toVec2D(fields.ice.velocity[y][x]), dV_ice(env)]))
                nextFields.ice.thickness[y][x] = fields.ice.thickness[y][x] + dI_ice(env)

            }
        }

        // Update the wind arrays with the new values
        return nextFields
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
        land: { temperature: Matrix<number> }


    }
}

