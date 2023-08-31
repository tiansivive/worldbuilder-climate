import { FormControl, FormLabel, Input, Stack } from '@chakra-ui/react';
import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'
import { range } from "fp-ts/lib/NonEmptyArray";



type Props = {
    brush: Brush,
    update: (brush: Brush) => void
}

export const BrushControls: React.FC<Props> = ({ brush, update }) => {


    return <Stack>
        <Stack display="flex" flexDirection="row" >
            <FormControl>
                <FormLabel>Size</FormLabel>
                <Input
                    type="number"
                    value={ brush.size }
                    onChange={ e => update({ ...brush, size: e.target.valueAsNumber }) }
                    errorBorderColor='red.300'
                />
            </FormControl>
            <FormControl>
                <FormLabel>Strength</FormLabel>
                <Input
                    type="number"
                    value={ brush.strength }
                    onChange={ e => update({ ...brush, strength: e.target.valueAsNumber }) }
                    errorBorderColor='red.300'
                />
            </FormControl>
        </Stack>

    </Stack>
}

export type Coords = { x: number, y: number }
export const affectedCellIndices
    : (centerIndices: Coords, brushSize: number) => Coords[]
    = (center, size) => {

        const radiusSquared = size * size;
        const r = range(-size, size)
        return F.pipe(
            A.Do,
            A.apS("row", r.map(_r => _r + center.y)),
            A.apS("col", r.map(_r => _r + center.x)),
            A.map(({ row, col }) => ({ x: col, y: row })),
            A.filter(isWithinCircle(center, radiusSquared))
        )
    }


const isWithinCircle
    : (center: Coords, radiusSquared: number) => (cell: Coords) => boolean
    = ({ x, y }, rs) => ({ x: i, y: j }) => (i - x) * (i - x) + (j - y) * (j - y) <= rs;

export type Brush = { size: number, strength: number }