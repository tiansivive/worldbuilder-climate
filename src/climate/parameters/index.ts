
import { mapValues, memoize } from "lodash/fp"

import * as C from "./constants"
import * as V from "./variables"


export default {
    ...mapValues(val => typeof val === "function" ? memoize(val) : val, V) as unknown as typeof V,
    ...mapValues(val => typeof val === "function" ? memoize(val) : val, C) as unknown as typeof C,
}


