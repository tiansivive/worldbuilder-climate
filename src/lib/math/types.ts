import * as A from 'fp-ts/Array'
import { Functor1 } from 'fp-ts/Functor'



// Calculate gradient of a scalar field at a given point
export type Matrix<T> = T[][]

export type Vec2D = { x: number, y: number }
export type Derivatives2D = { dx: number, dy: number }

export type Velocity = { u: number, v: number }

export type Radians = number 
export type Seconds = number 


// Utils
export const URI = 'Matrix'
export type URI = typeof URI

declare module 'fp-ts/HKT' {
  interface URItoKind<A> {
    readonly Matrix: Matrix<A>
  }
}

export const Functor: Functor1<URI> = {
  URI,
  map: (ma, f) => A.Functor.map(ma, A.map(f))
}


