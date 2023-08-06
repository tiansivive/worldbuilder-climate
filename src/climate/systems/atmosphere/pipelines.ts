import { T0 } from "climate/parameters/constants";
import { Config, setupPass } from "climate/sim";

import { BufferSet, mkPipeline, PassConfig, PROPERTY, setupBuffers } from "../common";
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
                buffers: setupBuffers(dev, cfg, "atmosphere", "temperature", 1, T0),
                ...mkPipeline(dev, ShaderT.code, "atmosphere", "temperature", { uniforms: 1, inputs: 3, outputs: 2 }),
            },
            velocity: {
                buffers: setupBuffers(dev, cfg, "atmosphere", "velocity", 2, 0.0),
                ...mkPipeline(dev, ShaderV.code, "atmosphere", "velocity", { uniforms: 1, inputs: 3, outputs: 2 })
            }
        }
    }






const temperature
    : PassConfig<"atmosphere:temperature" | "atmosphere:velocity" | "ocean:temperature">
    = (i, dev, cfg, pipeline, layout, uniforms, buffers) => setupPass(dev, cfg, {
        inputBuffers: [uniforms[0], buffers["atmosphere:temperature"][i % 2], buffers["ocean:temperature"][i % 2], buffers["atmosphere:velocity"][i % 2]],
        outputBuffers: [buffers["atmosphere:temperature"][(i + 1) % 2], buffers["atmosphere:temperature"][2]],
        resultBuffers: [buffers["atmosphere:temperature"][3], buffers["atmosphere:temperature"][4]],
        layout,
        pipeline,
        labels: { bindGroup: `atmosphere:temperature:pass` }
    })

const velocity
    : PassConfig<"atmosphere:temperature" | "atmosphere:velocity">
    = (i, dev, cfg, pipeline, layout, uniforms, buffers) => setupPass(dev, cfg, {
        inputBuffers: [uniforms[0], uniforms[1], buffers["atmosphere:temperature"][i % 2], buffers["atmosphere:velocity"][i % 2]],
        outputBuffers: [buffers["atmosphere:velocity"][(i + 1) % 2], buffers["atmosphere:velocity"][2]],
        resultBuffers: [buffers["atmosphere:velocity"][3], buffers["atmosphere:velocity"][4]],
        layout,
        pipeline,
        labels: { bindGroup: `atmosphere:velocity:pass` }
    })



export const pass = { temperature, velocity }


