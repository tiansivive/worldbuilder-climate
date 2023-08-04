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


type Config = AtmosphereGPU.Config & {
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
        axial_tilt: Math.PI / 8,
        orbit_period: 360,
        day_of_year: 0,
        angular_speed: 0.004166,
        time: 0,
        size: { w: params.width, h: params.height },
        step: { dx: circumference / params.width, dy: circumference / params.height },
        elevation: params.elevation,
        simTotalSteps: 24 * 360 * 100

    }
    setupDevice()
        .then(device => multipleSystemRuns(device, config))


};


export const multipleSystemRuns
    : (device: GPUDevice, cfg: Config) => Promise<void>
    = async (dev, cfg) => {
        const config = AtmosphereGPU.setupConfigUniforms(dev, cfg)
        const [temp_debug, temp_debug_result] = setupDebugBuffer(dev, cfg)
        const [vel_debug, vel_debug_result] = setupDebugBuffer(dev, cfg, 2)
        const { buffers, temperature, velocity } = AtmosphereGPU.pipelines(dev, cfg)

        for (let i = 0; i < cfg.simTotalSteps; i++) {
            config.values[3] = Math.floor(i / 24) % cfg.orbit_period
            config.values[5] = (i % (24 * cfg.orbit_period)) * dt // update time
            dev.queue.writeBuffer(config.buffer, 0, config.values);

            const temp_in = buffers.temperature[i % 2]
            const temp_out = buffers.temperature[(i + 1) % 2]
            const temp_result = buffers.temperature[2]

            const velocity_in = buffers.velocity[i % 2]
            const velocity_out = buffers.velocity[(i + 1) % 2]
            const velocity_result = buffers.velocity[2]

            const temp_cmd = setupPass(dev, cfg, {
                inputBuffers: [config.buffer, temp_in, velocity_in],
                outputBuffers: [temp_out, temp_debug],
                resultBuffers: [temp_result, temp_debug_result],
                layout: temperature.bindGroupLayout,
                pipeline: temperature.pipeline,
                labels: { bindGroup: "temperature" }
            })

            const vel_cmd = setupPass(dev, cfg, {
                inputBuffers: [config.buffer, buffers.elevation, temp_in, velocity_in],
                outputBuffers: [velocity_out, vel_debug],
                resultBuffers: [velocity_result, vel_debug_result],
                layout: velocity.bindGroupLayout,
                pipeline: velocity.pipeline,
                labels: { bindGroup: "velocity" }
            })

            // End frame by passing array of command buffers to command queue for execution
            dev.queue.submit([temp_cmd, vel_cmd]);

            if (i % (24 * 10) === 0) {
                const system = await reportState(
                    cfg, i,
                    [temp_result, temp_debug_result],
                    [velocity_result, vel_debug_result]
                );
                console.log(system)
            }


        }
    }

const reportState
    : (cfg: Config, i: number, temp_buffers: [GPUBuffer, GPUBuffer], velocity_buffers: [GPUBuffer, GPUBuffer]) => unknown
    = async (cfg, iteration, [t_out, t_debug], [v_out, v_debug]) => {
        await Promise.all([
            t_out.mapAsync(GPUMapMode.READ, 0, t_out.size),
            t_debug.mapAsync(GPUMapMode.READ, 0, t_debug.size),
            v_out.mapAsync(GPUMapMode.READ, 0, v_out.size),
            v_debug.mapAsync(GPUMapMode.READ, 0, v_debug.size),
        ]);

        const bufs = [t_out, t_debug, v_out, v_debug] as const;
        const [temp_grid, temp_debug_grid, vel_grid, vel_debug_grid] = bufs
            .map(buf => {
                const data = buf.getMappedRange(0, buf.size).slice(0);
                buf.unmap();
                return Array.from(new Float32Array(data))
            })

        const system = {
            temperature: F.pipe(temp_grid, A.chunksOf(cfg.size.w)),
            velocity: F.pipe(vel_grid, A.chunksOf(cfg.size.w * 2), A.map(A.chunksOf(2))),
            debug: {
                temp: F.pipe(temp_debug_grid, A.chunksOf(cfg.size.w)),
                vel: F.pipe(vel_debug_grid, A.chunksOf(cfg.size.w * 2), A.map(A.chunksOf(2))),
            }

        }


        self.postMessage({ type: "GPU_SYSTEM", iteration, system });

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

const setupDebugBuffer
    : (device: GPUDevice, options: Config, vectorLength?: number) => [GPUBuffer, GPUBuffer]
    = (dev, cfg, n = 1) => {
        const debug = new Float32Array(cfg.size.w * cfg.size.h * n)
        const buffer = dev.createBuffer({
            label: "debug",
            size: debug.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        })
        const staging = dev.createBuffer({
            label: "debug_staging",
            size: debug.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        })


        return [buffer, staging]
    }

