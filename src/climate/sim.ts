/* eslint-disable no-restricted-globals */
import * as A from 'fp-ts/Array'
import * as F from 'fp-ts/function'
import * as R from 'fp-ts/Record'
import _ from 'lodash/fp';

import { Matrix } from 'lib/math/types';

import { dt } from './parameters/constants';
import * as AtmosphereGPU from './systems/atmosphere/pipelines';
import { BufferSet, ID, PROPERTY, setupConfigUniforms, setupElevationBuffer, SYSTEM } from './systems/common';
import * as OceanGPU from './systems/ocean/pipelines';

export type Params = {
    type: "RUN",
    width: number,
    height: number,
    elevation: Matrix<number>
}


export type Config = {
    /** Meters */
    circumference: number,
    /** Radians */
    axial_tilt: number,
    /** In days */
    orbit_period: number,

    /** current day of the year */
    day_of_year: number,
    /** Degrees per second */
    angular_speed: number,
    /** seconds */
    time: number,
    step: { dx: number, dy: number },
    size: { w: number, h: number },
    elevation: Matrix<number>
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
        const config = setupConfigUniforms(dev, cfg)
        const elevation = setupElevationBuffer(dev, cfg)

        const atmosphere = AtmosphereGPU.setup(dev, cfg)
        const ocean = OceanGPU.setup(dev, cfg)


        for (let i = 0; i < cfg.simTotalSteps; i++) {
            config.values[3] = Math.floor(i / 24) % cfg.orbit_period
            config.values[5] = (i % (24 * cfg.orbit_period)) * dt // update time
            dev.queue.writeBuffer(config.buffer, 0, config.values);


            const cms = [
                AtmosphereGPU.pass.temperature(i, dev, cfg, atmosphere.temperature.pipeline, atmosphere.temperature.layout, [config.buffer, elevation], {
                    "atmosphere:temperature": atmosphere.temperature.buffers,
                    "atmosphere:velocity": atmosphere.velocity.buffers,
                    "ocean:temperature": ocean.temperature.buffers
                }),
                AtmosphereGPU.pass.velocity(i, dev, cfg, atmosphere.velocity.pipeline, atmosphere.velocity.layout, [config.buffer, elevation], {
                    "atmosphere:temperature": atmosphere.temperature.buffers,
                    "atmosphere:velocity": atmosphere.velocity.buffers,
                }),
                OceanGPU.pass.temperature(i, dev, cfg, ocean.temperature.pipeline, ocean.temperature.layout, [config.buffer, elevation], {
                    "ocean:temperature": ocean.temperature.buffers,
                    "ocean:velocity": ocean.velocity.buffers,
                    "atmosphere:temperature": atmosphere.temperature.buffers,
                    "atmosphere:velocity": atmosphere.velocity.buffers
                }),
                OceanGPU.pass.velocity(i, dev, cfg, ocean.velocity.pipeline, ocean.velocity.layout, [config.buffer, elevation], {
                    "ocean:temperature": ocean.temperature.buffers,
                    "ocean:velocity": ocean.velocity.buffers,
                    "atmosphere:velocity": atmosphere.velocity.buffers
                }),
            ]



            // End frame by passing array of command buffers to command queue for execution
            dev.queue.submit(cms);

            if (i % (24 * 10) === 0) {
                const system = await reportState(
                    cfg, i,
                    {
                        "atmosphere:temperature": atmosphere.temperature.buffers.slice(3, 5) as [GPUBuffer, GPUBuffer],
                        "atmosphere:velocity": atmosphere.velocity.buffers.slice(3, 5) as [GPUBuffer, GPUBuffer],
                        "ocean:temperature": ocean.temperature.buffers.slice(3, 5) as [GPUBuffer, GPUBuffer],
                        "ocean:velocity": ocean.velocity.buffers.slice(3, 5) as [GPUBuffer, GPUBuffer],
                    }
                );
                console.log(system)
            }


        }
    }


const reportState
    : <K extends ID>(cfg: Config, i: number, buffers: Record<K, [GPUBuffer, GPUBuffer]>) => unknown
    = async (cfg, iteration, buffers) => {


        const reads = Object.values<[GPUBuffer, GPUBuffer]>(buffers).flat().map(b => b.mapAsync(GPUMapMode.READ, 0, b.size))
        await Promise.all(reads)

        const extract = (buf: GPUBuffer) => {
            const data = buf.getMappedRange(0, buf.size).slice(0);
            buf.unmap();
            return Array.from(new Float32Array(data))
        }

        const system = R.FunctorWithIndex.mapWithIndex(buffers, (k, bufs) => {
            if (k.match("temperature")) return {
                values: F.pipe(bufs[0], extract, A.chunksOf(cfg.size.w)),
                debug: F.pipe(bufs[1], extract, A.chunksOf(cfg.size.w)),
            }
            if (k.match("velocity")) return {
                values: F.pipe(bufs[0], extract, A.chunksOf(cfg.size.w * 2), A.map(A.chunksOf(2))),
                debug: F.pipe(bufs[1], extract, A.chunksOf(cfg.size.w * 2), A.map(A.chunksOf(2))),
            }

        })



        self.postMessage({ type: "GPU_SYSTEM", iteration, system });

        return system
    }









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


