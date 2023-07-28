import * as F from 'fp-ts/function'
import * as R from "fp-ts/Reader";
import { Reader } from "fp-ts/Reader";

// Calculate gradient of a scalar field at a given point
export type Matrix<T> = T[][]

export type Vec2D = { x: number, y: number }
export type Derivatives2D = { dx: number, dy: number }

export type Velocity = { u: number, v: number }

export type Radians = number 
export type Seconds = number 

export const toVec2D = (v: Velocity): Vec2D =>({ x: v.u, y: v.v})
export const fromVec2D = (v: Vec2D): Velocity =>({ u: v.x, v: v.y})

export function add(scalar: number, vec1: Vec2D): Vec2D
export function add(vecs: Vec2D[]): Vec2D 
export function add(...args: [number, Vec2D] | [Vec2D[]]): Vec2D {
    
    if (args.length === 1) {
        const [vec1, ...rest] = args[0]
        return rest.reduce((sum, vec) => ({ x: sum.x + vec.x, y: sum.y + vec.y }), vec1)
    } 
    const [scalar, vec1] = args
    return { x: vec1.x + scalar, y: vec1.y + scalar }
}

export function subtract(scalar: number, vec1: Vec2D): Vec2D
export function subtract(vecs: Vec2D[]): Vec2D 
export function subtract(...args: [number, Vec2D] | [Vec2D[]]): Vec2D {
    
    if (args.length === 1) {
        const [vec1, ...rest] = args[0]
        return rest.reduce((sum, vec) => ({ x: sum.x - vec.x, y: sum.y - vec.y }), vec1)
    } 
    const [scalar, vec1] = args
    return { x: vec1.x - scalar, y: vec1.y - scalar }
}
export function multiply(scalar: number, vec1: Vec2D): Vec2D {
    return { x: vec1.x * scalar, y: vec1.y * scalar}
}
export function divide(vec1: Vec2D, scalar: number): Vec2D {
    return { x: vec1.x / scalar, y: vec1.y / scalar}
}

// Dot product function
export function dot(vec1: Vec2D , vec2: Vec2D) {
    return vec1.x * vec2.x + vec1.y * vec2.y;
}
export function cross(vec1: Vec2D , vec2: Vec2D) {
    return vec1.x * vec2.y - vec1.y * vec2.x;
}


// Compute norm of a vector
export function norm(vector: Vec2D) {
    return Math.sqrt(dot(vector, vector));
}

export const unit = (vec: Vec2D) => divide(vec, norm(vec))

export type LocalEnv = { point: Vec2D, step: Vec2D, time: number }
export type Local<A, T extends LocalEnv = LocalEnv> = Reader<T, A> 



export const grad
    : (field: Matrix<number>) => Local<Vec2D>
    = f => ({ point: { x, y }, step }) =>  {
    const x_minus = x === 0            ? f[y][ f.length - 1 ] : f[y][x - 1] ;
    const x_plus  = x === f.length - 1 ? f[y][ 0 ]            : f[y][x + 1] ;
    
    const y_minus = y === 0               ? f[y][x] : f[y - 1][x] ;
    const y_plus  = y === f[0].length - 1 ? f[y][x] : f[y + 1][x] ;

    const gradX = (x_plus - x_minus) / (2 * step.x);   
    const gradY = (y_plus - y_minus) / (2 * step.y);

    return { x: gradX, y: gradY };
}


// Calculate Laplacian of a 2D scalar field at a specific point (x, y)
export const laplacian
    : (field: Matrix<number>) => Local<number>
    = f => ({ point: { x, y }, step }) =>  {
  
    const lap = (f[x+1][y] - 2*f[x][y] + f[x-1][y]) / (step.x * step.x)
            + (f[x][y+1] - 2*f[x][y] + f[x][y-1]) / (step.y * step.y);

    return lap;
    }


export function localDerivative(field: Matrix<number>, velocity: Velocity, materialDerivative: number): Local<number>
export function localDerivative(field: Matrix<number>, velocity: Velocity, materialDerivative: Vec2D): Local<Vec2D>
export function localDerivative(...args: [Matrix<number>, Velocity, number] | [Matrix<number>, Velocity, Vec2D]) {
 
    const [f, vel, Df] = args
    const v = toVec2D(vel)
    if (typeof Df === "number") {
        return F.pipe(
            grad(f),
            R.map(gf => dot(v, gf)),
            R.map(advection => Df - advection)
        )
    }
    
    return  F.pipe(
            grad(f),
            R.map(gf => dot(v, gf)),
            R.map(advection => subtract(advection, Df))
        )
}

        

export const local = <F, O>(f: Matrix<F>) => R.asks<{ point: Vec2D } & O, F>(({ point }) => f[point.y][point.x])
