/* eslint-disable no-restricted-globals */
import * as A from 'fp-ts/Array'
import * as R from 'fp-ts/Reader'

import { Matrix, Radians, Vec2D, Velocity } from 'lib/math/types';
import { add, fromVec2D, localDerivative, LocalEnv, toVec2D } from 'lib/math/utils';

import { dt, T0 } from './parameters/constants';
import * as Atmosphere from './systems/atmosphere/atmosphere';
import * as AtmosphereGPU from './systems/atmosphere/pipelines';
import * as Ice from './systems/ice';
import * as Land from './systems/land';
import * as Ocean from './systems/ocean';

export type Params = {
    type: "RUN",
    width: number,
    height: number,
    elevation: Matrix<number>
}

type Config = {
    /** Meters */
    circumference: number,
    /** Radians */
    axial_tilt: number,
    /** Degrees per second */
    angular_speed: number,
    /** seconds */
    time: number,
    step: { dx: number, dy: number },
    size: { w: number, h: number },
    elevation: Matrix<number>,

    simTotalSteps: number
}


// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<Params>) => {


    // run(e.data, (iteration, system) => self.postMessage({ type: "STEP", system, iteration }))
    //     .then(system => self.postMessage({ type: "DONE", system }))


    // eslint-disable-next-line @typescript-eslint/no-empty-function

    // runGPU(e.data, Atmosphere.temp_code, (i, grid) => self.postMessage({ type: "GPU", iteration: i, grid }))
    //     .then(() => self.postMessage({ type: "DONE" }))
    const params: Params = e.data
    const circumference = 32000
    const config: Config = {
        circumference,
        axial_tilt: 0.0,
        angular_speed: 0.004166,
        time: 0,
        size: { w: params.width, h: params.height },
        step: { dx: circumference / params.width, dy: circumference / params.height },
        elevation: params.elevation,
        simTotalSteps: 10

    }
    setupDevice()
        .then(device => multipleSystemRuns(device, config))


};


export const runGPU
    : (params: Params, code: string, emit: (iteration: number, state: Matrix<number>) => void) => Promise<void>
    = async (options, code, emit) => {
        const _chunks = A.chunksOf(options.width)

        if (!navigator.gpu) {
            throw Error("WebGPU not supported.");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw Error("Couldn't request WebGPU adapter.");
        }

        const device = await adapter.requestDevice();

        const circumference = 30000 // in KM
        const params = new Float32Array([
            circumference,
            0, //Math.PI / 16, // axial tilt in radians
            0.004166,
            // 0.004166666667, // angular speed in degrees per second
            0, // total elapsed time
            1000,
            1000,
            options.width,
            options.height,
            // circumference / options.width,
            // circumference / options.height,
        ]);
        console.log("params", params)
        const paramsBuffer = device.createBuffer({
            label: "Params uniforms",
            size: params.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Create a uniform buffer that describes the grid.


        const temperature = new Float32Array(options.width * options.height).fill(T0);
        const temperature_buffers = [
            device.createBuffer(pingPongBufferDesc("temperature_in", temperature.byteLength)),
            device.createBuffer(pingPongBufferDesc("temperature_out", temperature.byteLength))
        ]
        device.queue.writeBuffer(temperature_buffers[0], 0, temperature);


        const elevation = new Float32Array(options.elevation.flat());
        //const elevation = new Float32Array(options.width * options.height).fill(T0);
        const elevation_buffer = device.createBuffer({
            label: "elevation",
            size: elevation.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        })
        const _v = createVelocityIC(options.width, options.height)
        const velocity = new Float32Array(_v.flat(2));
        //const elevation = new Float32Array(options.width * options.height).fill(T0);
        const velocity_buffer = device.createBuffer({
            label: "velocity",
            size: velocity.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(velocity_buffer, 0, velocity);
        console.log("Velocity:", _v);

        const results_buffer = device.createBuffer({
            label: "staging",
            size: temperature.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });



        const bindGroupLayout = device.createBindGroupLayout({ label: "test-toggle", entries: bindGroupLayoutEntries });


        const shaderModule = device.createShaderModule({ code });
        const computePipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout],
            }),
            compute: {
                module: shaderModule,
                entryPoint: "main",
            },
        });

        //const numTimeSteps = 1000
        const numTimeSteps = 24 * 365 * 5
        //const numTimeSteps = 1

        for (let i = 0; i < numTimeSteps; i++) {
            params[3] = i * dt // update time
            device.queue.writeBuffer(paramsBuffer, 0, params);
            const temperatureInputBuffer = temperature_buffers[i % 2];
            const temperatureOutputBuffer = temperature_buffers[(i + 1) % 2];

            const bindGroup = device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: paramsBuffer },
                    },
                    {
                        binding: 1,
                        resource: { buffer: temperatureInputBuffer },
                    },
                    {
                        binding: 2,
                        resource: { buffer: velocity_buffer },
                    },
                    {
                        binding: 3,
                        resource: { buffer: temperatureOutputBuffer },
                    }
                ],
            });

            const commandEncoder = device.createCommandEncoder()
            const passEncoder = commandEncoder.beginComputePass()
            passEncoder.setPipeline(computePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(Math.ceil(options.width / 8), Math.ceil(options.height / 8));
            //passEncoder.dispatchWorkgroups(128, 128);
            // passEncoder.dispatchWorkgroups(4, 4)
            passEncoder.end();
            commandEncoder.copyBufferToBuffer(temperatureOutputBuffer, 0 /*Source offset */, results_buffer, 0 /* Destination offset */, temperature.byteLength);

            // End frame by passing array of command buffers to command queue for execution
            device.queue.submit([commandEncoder.finish()]);


            if (i % (24 * 15) === 0) {
                await results_buffer.mapAsync(GPUMapMode.READ, 0 /* Offset*/, temperature.byteLength);
                const copyArrayBuffer = results_buffer.getMappedRange(0, temperature.byteLength);
                const data = copyArrayBuffer.slice(0);
                results_buffer.unmap();
                const grid2d = _chunks(Array.from(new Float32Array(data)))
                emit(i, grid2d)
                //console.log("Data", grid2d)
            }
            // console.log("End:", new Float32Array(data));

        }
    }


export const multipleSystemRuns
    : (device: GPUDevice, cfg: Config) => Promise<void>
    = async (dev, cfg) => {
        const config = AtmosphereGPU.setupConfigUniforms(dev, cfg)
        const { buffers, temperature, velocity } = AtmosphereGPU.pipelines(dev, cfg)

        for (let i = 0; i < cfg.simTotalSteps; i++) {
            config.values[3] = i * dt // update time
            dev.queue.writeBuffer(config.buffer, 0, config.values);

            const temp_in = buffers.temperature[i % 2]
            const temp_out = buffers.temperature[(i + 1) % 2]
            const temp_result = buffers.temperature[2]

            const velocity_in = buffers.velocity[i % 2]
            const velocity_out = buffers.velocity[(i + 1) % 2]
            const velocity_result = buffers.velocity[2]

            const temp_cmd = setupPass(dev, cfg, {
                inputBuffers: [config.buffer, temp_in, velocity_in],
                outputBuffers: [temp_out],
                resultBuffers: [temp_result],
                layout: temperature.bindGroupLayout,
                pipeline: temperature.pipeline
            })

            const vel_cmd = setupPass(dev, cfg, {
                inputBuffers: [config.buffer, buffers.elevation, temp_in, velocity_in],
                outputBuffers: [velocity_out],
                resultBuffers: [velocity_result],
                layout: velocity.bindGroupLayout,
                pipeline: velocity.pipeline
            })

            // End frame by passing array of command buffers to command queue for execution
            dev.queue.submit([temp_cmd, vel_cmd]);

            if (i % (24 * 15) === 0) {
                const system = await reportState(temp_result, temp_in, velocity_result, velocity_in, cfg, i);
                console.log(system)
            }


        }
    }

async function reportState(temp_result: GPUBuffer, temp_in: GPUBuffer, velocity_result: GPUBuffer, velocity_in: GPUBuffer, cfg: Config, i: number) {
    await Promise.all([
        temp_result.mapAsync(GPUMapMode.READ, 0, temp_in.size),
        velocity_result.mapAsync(GPUMapMode.READ, 0, velocity_result.size),
    ]);

    const bufs = [[temp_result, temp_in.size], [velocity_result, velocity_in.size]] as const;
    const [temp_grid, vel_grid] = bufs
        .map(([buf, size]) => {
            const data = buf.getMappedRange(0, size).slice(0);
            buf.unmap();
            return Array.from(new Float32Array(data));
        })
        .map(A.chunksOf(cfg.size.w));
    const system = { temperature: temp_grid, velocity: vel_grid }
    self.postMessage({ type: "GPU_SYSTEM", iteration: i, system });

    return system
}



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



// Function to calculate the convergence between consecutive time steps
function calculateConvergence(system: System, next: System, opts: Params) {
    const totalChange = 0;

    //   for (let y = 0; y < opts.height; y++) {
    //     for (let x = 0; x < opts.width; x++) {
    //       const du = u[y][x] - newU[y][x];
    //       const dv = v[y][x] - newV[y][x];
    //       totalChange += du * du + dv * dv;
    //     }
    //   }

    return Math.sqrt(totalChange);
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






export const pingPongBufferDesc
    : (label: string, size: number) => GPUBufferDescriptor
    = (label, size) => ({
        label,
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    })

const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
    {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" } // Grid uniform buffer
    },
    {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" } // Cell state input buffer
    },
    {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" } // Cell state input buffer
    },
    {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" } // Cell state output buffer
    }

]

const createBuffer = (device: GPUDevice, label: string, content: number[], usage: GPUBufferUsageFlags) => {
    const _array = new Float32Array(content);
    const buffer = device.createBuffer({ label, usage, size: _array.byteLength })
    device.queue.writeBuffer(buffer, 0, _array);
}


const createVelocityIC = (w: number, h: number) => {
    const grid = create2DArray(h, w, [0, 0])
    // Variables for wind speed
    const uWindEquator = -0.25;   // Zonal wind speed at equator (easterly trade winds)
    const uWindMidLat = 0.25;   // Zonal wind speed at mid-latitudes (westerlies)
    const vWind = 0.1;           // Meridional wind speed

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // Northern Hemisphere
            const lat = (y / h) * 180 - 90;   // Latitude (-90 to 90)
            let u, v;

            // Define u component (zonal) based on latitude
            if (Math.abs(lat) < 30) {
                u = uWindEquator;
            } else if (Math.abs(lat) < 60) {
                u = uWindMidLat;
            } else {
                u = uWindEquator;
            }

            // Reverse direction in Southern Hemisphere
            // if (lat < 0) {
            //     u = -u;
            // }

            // Define v component (meridional) as constant, reversing direction in Southern Hemisphere
            // eslint-disable-next-line prefer-const
            v = lat >= 0 ? vWind : -vWind;

            grid[y][x] = [u, y === 0 || y === h - 1 ? 0 : v];
        }
    }
    const factor = (value: number) => (Math.random() / 4 + 0.875) * value

    return grid.map(row => row.map(uv => uv.map(factor)))


}


type RunPass = {
    /** `FIFO` order!\
     *  Buffers get sent to GPU shader in order */
    inputBuffers: GPUBuffer[]
    outputBuffers: GPUBuffer[],
    resultBuffers: GPUBuffer[],
    layout: GPUBindGroupLayout,
    pipeline: GPUComputePipeline
}

export const setupPass
    : (device: GPUDevice, config: Config, run: RunPass) => GPUCommandBuffer
    = (dev, cfg, run) => {

        const inBindings: GPUBindGroupEntry[] = run.inputBuffers.map((buffer, binding) => ({ binding, resource: { buffer } }))
        const outBindings: GPUBindGroupEntry[] = run.outputBuffers.map((buffer, binding) => ({ binding: binding + inBindings.length, resource: { buffer } }))

        const bind_group = dev.createBindGroup({
            layout: run.layout,
            entries: inBindings.concat(outBindings)
        })

        const commandEncoder = dev.createCommandEncoder()
        const passEncoder = commandEncoder.beginComputePass()
        passEncoder.setPipeline(run.pipeline)
        passEncoder.setBindGroup(0, bind_group);
        passEncoder.dispatchWorkgroups(Math.ceil(cfg.size.w / 8), Math.ceil(cfg.size.h / 8));
        passEncoder.end()
        run.resultBuffers.forEach(
            (buf, index) => commandEncoder.copyBufferToBuffer(run.outputBuffers[index], 0, buf, 0, run.outputBuffers[index].size)
        )
        return commandEncoder.finish()

    }



const setupDevice = async () => {
    if (!navigator.gpu) {
        throw Error("WebGPU not supported.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw Error("Couldn't request WebGPU adapter.");
    }

    return adapter.requestDevice();

}