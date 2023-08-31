import { FormControl, FormLabel, Input, Stack } from "@chakra-ui/react"

type Dimensions = { x: number; y: number }
type Props = {
    size: Dimensions
    update: (dimensions: Dimensions) => void

}

export const SizeControls: React.FC<Props> = ({ update, size }) => {


    return <Stack>
        <Stack display="flex" flexDirection="row" >
            <FormControl isInvalid={ !valid(size.x) }>
                <FormLabel>Width</FormLabel>
                <Input
                    type="number"
                    value={ size.x }
                    onChange={ e => update({ ...size, x: e.target.valueAsNumber }) }
                    errorBorderColor='red.300'
                />
            </FormControl>
            <FormControl isInvalid={ !valid(size.y) }>
                <FormLabel>Height</FormLabel>
                <Input
                    type="number"
                    value={ size.y }
                    onChange={ e => update({ ...size, y: e.target.valueAsNumber }) }
                    errorBorderColor='red.300'
                />
            </FormControl>
        </Stack>

    </Stack>
}


export const valid = (n: number) => Number.isInteger(Math.log2(n))



