/* eslint-disable no-restricted-globals */
import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'

import { Matrix } from 'lib/math/types';

import { dt } from './parameters/constants';
import * as AtmosphereGPU from './systems/atmosphere/pipelines';

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
    const circumference = 32000 * 1000
    const config: Config = {
        circumference,
        axial_tilt: 0, //Math.PI / 32,
        angular_speed: 0.004166,
        time: 0,
        size: { w: params.width, h: params.height },
        step: { dx: circumference / params.width, dy: circumference / params.height },
        elevation: params.elevation,
        simTotalSteps: 24 * 365 * 100

    }
    setupDevice()
        .then(device => multipleSystemRuns(device, config))


};


export const multipleSystemRuns
    : (device: GPUDevice, cfg: Config) => Promise<void>
    = async (dev, cfg) => {
        const config = AtmosphereGPU.setupConfigUniforms(dev, cfg)
        const { buffers, temperature, velocity } = AtmosphereGPU.pipelines(dev, cfg)

        for (let i = 0; i < cfg.simTotalSteps; i++) {
            config.values[3] = (i % (24 * 365)) * dt // update time
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
                pipeline: temperature.pipeline,
                labels: { bindGroup: "temperature" }
            })

            const vel_cmd = setupPass(dev, cfg, {
                inputBuffers: [config.buffer, buffers.elevation, temp_in, velocity_in],
                outputBuffers: [velocity_out],
                resultBuffers: [velocity_result],
                layout: velocity.bindGroupLayout,
                pipeline: velocity.pipeline,
                labels: { bindGroup: "velocity" }
            })

            // End frame by passing array of command buffers to command queue for execution
            dev.queue.submit([temp_cmd, vel_cmd]);

            if (i % (24 * 265) === 0) {
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

    const system = {
        temperature: F.pipe(temp_grid, A.chunksOf(cfg.size.w)),
        velocity: F.pipe(vel_grid, A.chunksOf(cfg.size.w * 2), A.map(A.chunksOf(2))),
    }
    self.postMessage({ type: "GPU_SYSTEM", iteration: i, system });

    return system
}







export const pingPongBufferDesc
    : (label: string, size: number) => GPUBufferDescriptor
    = (label, size) => ({
        label,
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    })



type RunPass = {
    /** `FIFO` order!\
     *  Buffers get sent to GPU shader in order */
    inputBuffers: GPUBuffer[]
    outputBuffers: GPUBuffer[],
    resultBuffers: GPUBuffer[],
    layout: GPUBindGroupLayout,
    pipeline: GPUComputePipeline,
    labels?: {
        bindGroup?: string
    }
}

export const setupPass
    : (device: GPUDevice, config: Config, run: RunPass) => GPUCommandBuffer
    = (dev, cfg, run) => {

        const inBindings: GPUBindGroupEntry[] = run.inputBuffers.map((buffer, binding) => ({ binding, resource: { buffer } }))
        const outBindings: GPUBindGroupEntry[] = run.outputBuffers.map((buffer, binding) => ({ binding: binding + inBindings.length, resource: { buffer } }))

        const bind_group = dev.createBindGroup({
            label: run.labels?.bindGroup,
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