
import * as F from 'fp-ts/function'
import * as R from "fp-ts/Reader";
import { Local,local } from 'math/utils';

import { SimulationEnv } from '../sim';


export const Qx_ice
    : (temperature: number) => Local<number, SimulationEnv>
    = T => R.asksReader(({ fields }) =>  F.pipe(
            R.Do,
            R.bind("thickness", () => local(fields.ice.thickness)),
            R.bind("T_ice",  () => local(fields.ice.temperature)),
            R.map(({ thickness, T_ice }) => {
                const xCoefficient = 0.003 // TODO: improve
                return thickness > 0 ? xCoefficient*(T - T_ice) : 0
            } )
        )
    )