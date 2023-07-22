import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'
import { range } from "fp-ts/lib/NonEmptyArray";

export type Coords = {x: number, y: number}
export const affectedCellIndices
    : (center: Coords, brushSize: number) => Coords[]
    = (center, size) => {
 
        const radiusSquared = size * size;
        const r = range(-size, size)
        return F.pipe(
            A.Do,
            A.apS("row", r.map(_r => _r + center.y)),
            A.apS("col", r.map(_r => _r + center.x)),
            A.map(({ row, col }) =>  ({ x: col, y: row })),
            A.filter(isWithinCircle(center, radiusSquared))
        )
    }
     

const isWithinCircle
    : (center: Coords, radiusSquared: number) => (cell: Coords) => boolean
    = ({x, y}, rs) => ({ x:i, y:j }) => (i - x) * (i - x) + (j - y) * (j - y) <= rs;
