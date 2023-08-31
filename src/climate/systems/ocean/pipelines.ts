import { T0 } from "climate/parameters/constants"
import { Config, setupPass } from "climate/sim"

import { BufferSet, mkPipeline, PassConfig, PROPERTY, setupBuffers, steppedIncrement } from "../common"
import * as ShaderT from './temperature.wgsl'
import * as ShaderV from './velocity.wgsl'


type Deps = {
    pipeline: GPUComputePipeline,
    layout: GPUBindGroupLayout,
    buffers: BufferSet
}

export const setup
    : (device: GPUDevice, config: Config) => Record<Extract<PROPERTY, "temperature" | "velocity">, Deps>
    = (dev, cfg) => {
        return {
            temperature: {
                buffers: setupBuffers(dev, cfg, "ocean", "temperature", 1, steppedIncrement(T0 + 5, 25)),
                ...mkPipeline(dev, ShaderT.code, "ocean", "temperature", { uniforms: 1, inputs: 4, outputs: 2 }),
            },
            velocity: {
                buffers: setupBuffers(dev, cfg, "ocean", "velocity", 2, () => 0.0),
                ...mkPipeline(dev, ShaderV.code, "ocean", "velocity", { uniforms: 1, inputs: 4, outputs: 2 })
            }
        }
    }






const temperature
    : PassConfig<"atmosphere:temperature" | "atmosphere:velocity" | "ocean:temperature" | "ocean:velocity">
    = (i, dev, cfg, pipeline, layout, uniforms, buffers) => setupPass(dev, cfg, {
        inputBuffers: [uniforms[0], buffers["ocean:temperature"][i % 2], buffers["atmosphere:temperature"][i % 2], buffers["ocean:velocity"][i % 2], buffers["atmosphere:velocity"][i % 2]],
        outputBuffers: [buffers["ocean:temperature"][(i + 1) % 2], buffers["ocean:temperature"][2]],
        resultBuffers: [buffers["ocean:temperature"][3], buffers["ocean:temperature"][4]],
        layout,
        pipeline,
        labels: { bindGroup: `ocean:temperature:pass` }
    })

const velocity
    : PassConfig<"atmosphere:velocity" | "ocean:temperature" | "ocean:velocity">
    = (i, dev, cfg, pipeline, layout, uniforms, buffers) => setupPass(dev, cfg, {
        inputBuffers: [uniforms[0], uniforms[1], buffers["ocean:temperature"][i % 2], buffers["ocean:velocity"][i % 2], buffers["atmosphere:velocity"][i % 2]],
        outputBuffers: [buffers["ocean:velocity"][(i + 1) % 2], buffers["ocean:velocity"][2]],
        resultBuffers: [buffers["ocean:velocity"][3], buffers["ocean:velocity"][4]],
        layout,
        pipeline,
        labels: { bindGroup: `ocean:velocity:pass` }
    })



export const pass = { temperature, velocity }


