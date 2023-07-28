 
import * as F from 'fp-ts/function'
import * as R from "fp-ts/Reader";
import { dot, grad, laplacian, Local, local, Matrix, multiply, norm,Radians,Seconds,toVec2D,unit,Vec2D, Velocity } from "math/utils";

import { SimulationEnv } from '../sim';
import { albedo_atmosphere,alpha_drag,gamma, h_max, h_transfer,lambda_base,omega, R as airGasConstant, S0, sigma } from "./constants";

export const latitude
    : (y: number, grid_height: number) => number
    = (y, h)    => ((h - 1 - y) / (h - 1)) * 180 - 90
export const coriolis
    : (y: number, grid_height: number) => number
    = (y, h) => 2 * omega * Math.sin(latitude(y, h));
 
export const crossDirection
    : (vec: Vec2D) => Vec2D
    = v => ({ x: -v.y, y: v.x })
    

//Topographical forcing function
export const topographical_forcing
    : (Elevation: Matrix<number>, Air_Velocity: Matrix<Velocity>) => Local<Vec2D>
    = (E, V) => F.pipe(
        R.Do,
        R.bind("n", () => normal(E)),
        R.bind("h", () => local(E)),
        R.bind("v", () => R.Functor.map(local(V), toVec2D)),
        R.map(({ h, v, n }) => multiply(- gamma * h / h_max * dot(v, n), n))   
    )


// Drag coefficient function
export const drag
    : (elevation: Matrix<number>) => Local<number>
    = h => R.Functor.map(grad(h), _h => lambda_base + alpha_drag * Math.abs(norm(_h)))
 
// Compute stress
export const stress
    : (field: Matrix<Velocity>, density: number, dragCoefficient: number) => Local<Vec2D> 
    = (f, rho, drag) => F.pipe(
        R.Do, 
        R.bind("v", () => R.Functor.map(local(f), toVec2D)),
        R.map(({ v }) =>  multiply(- drag * rho * Math.pow(norm(v), 2), unit(v))  )
    )
        

export const boussinesqPressure
    : (temperature: Matrix<number>) => Local<Vec2D>
    = T => R.Functor.map(grad(T), gT => multiply(airGasConstant, gT))


export const normal
    : (field: Matrix<number>) => Local<Vec2D>
    = f => 
            R.Functor.map(grad(f), gradient  => {
                const length = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y)
                const nx = -gradient.y / length;
                const ny =  gradient.x / length;
                return { x: nx, y: ny };
            })
  
export const diffusion
    : (field: Matrix<number>, diffusivity_constant: number) => Local<number>
    = (f, k) => R.Functor.map(laplacian(f), l => l * k)           

/** Givens the current time of day angle, defined as 15 degrees per hour */
export const hour_omega
    : (speed: Radians, time: Seconds) => number
    = (w, t) => (w * t * (180/Math.PI) % 360) - 180



export const Q_sol
    : Local<number, SimulationEnv>
    = R.asks(({ planet, size, point, time }) => {
        const lat = latitude(point.y, size.h)
        const w = hour_omega(planet.rotation_speed, time)
        return S0 * (1 - albedo_atmosphere) * (Math.cos(lat) * Math.cos(planet.axial_tilt) * Math.cos(w) + Math.sin(lat) * Math.sin(planet.axial_tilt))
    })


export const Q_exchange
    : (tempField1: number, tempField2: number) => number
    = (t1, t2) => h_transfer * (t1 - t2)
    


export const radiative_loss
    : (temperature: number) => number 
    = t => sigma * Math.pow(t, 4)