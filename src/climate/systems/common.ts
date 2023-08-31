
import { Config } from "climate/sim";
import * as A from "fp-ts/Array";

import { maxMatrix } from "lib/math/utils";

export type PROPERTY = "temperature" | "velocity" | "thickness"
export type SYSTEM = "atmosphere" | "ocean" | "ice" | "land"


export const mkPipeline
    : (device: GPUDevice, shader: GPUShaderModuleDescriptor["code"], system: SYSTEM, property: PROPERTY, counts: { uniforms: number, inputs: number, outputs: number }) => { pipeline: GPUComputePipeline; layout: GPUBindGroupLayout; }
    = (dev, shader, sys, prop, { uniforms, inputs, outputs }) => {

        const id = `${sys}:${prop}`
        const mkBindings = (offset: number, type: GPUBufferBindingType) => A.mapWithIndex<unknown, GPUBindGroupLayoutEntry>(i => ({
            binding: i + offset,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type }
        }))

        const entries = [
            mkBindings(0, "uniform")(A.replicate(uniforms, 0)),
            mkBindings(uniforms, "read-only-storage")(A.replicate(inputs, 0)),
            mkBindings(uniforms + inputs, "storage")(A.replicate(outputs, 0)),
        ].flat()

        const layout = dev.createBindGroupLayout({ label: `${id}:bind_group_layout`, entries })
        const pipeline = dev.createComputePipeline({
            label: `${id}:pipeline`,
            layout: dev.createPipelineLayout({
                label: `${id}:layout`,
                bindGroupLayouts: [layout]
            }),
            compute: {
                entryPoint: "main",
                module: dev.createShaderModule({ code: shader })
            }
        })
        return { pipeline, layout }
    }


export const setupConfigUniforms
    : (device: GPUDevice, options: Config) => { buffer: GPUBuffer, values: Float32Array }
    = (dev, cfg) => {

        const values = new Float32Array([
            cfg.circumference,
            cfg.axial_tilt,
            cfg.orbit_period,
            cfg.day_of_year,
            cfg.angular_speed,
            cfg.time,
            maxMatrix(0, cfg.elevation),
            cfg.step.dx,
            cfg.step.dy,
            cfg.size.w,
            cfg.size.h
        ]);

        const buffer = dev.createBuffer({
            label: "Config uniforms",
            size: values.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        return { buffer, values }
    }

export const setupBuffers
    : (device: GPUDevice, config: Config, system: SYSTEM, property: PROPERTY, vectorSize: 1 | 2 | 3 | 4, initialValue: (i: number, size: number) => number) => BufferSet
    = (dev, cfg, system, property, size, ini) => {
        const buf = new Float32Array(cfg.size.w * cfg.size.h * size).map((_, i) => ini(Math.floor(i / (cfg.size.w * size)), cfg.size.h));
        const buffers: BufferSet = [
            dev.createBuffer(pingPongBufferDesc(`${system}:${property}:input`, buf.byteLength)),
            dev.createBuffer(pingPongBufferDesc(`${system}:${property}:output`, buf.byteLength)),
            dev.createBuffer(pingPongBufferDesc(`${system}:${property}:debug`, buf.byteLength)),
            dev.createBuffer(stagingBufferDesc(`${system}:${property}:staging`, buf.byteLength)),
            dev.createBuffer(stagingBufferDesc(`${system}:${property}:debug:staging`, buf.byteLength)),

        ]
        dev.queue.writeBuffer(buffers[0], 0, buf);
        return buffers
    }


export const setupElevationBuffer
    : (device: GPUDevice, options: Config) => GPUBuffer
    = (dev, cfg) => {
        const elevation = new Float32Array(cfg.elevation.flat())
        const buffer = dev.createBuffer({
            label: "Elevation",
            size: elevation.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        dev.queue.writeBuffer(buffer, 0, elevation);
        return buffer
    }


export const pingPongBufferDesc
    : (label: string, size: number) => GPUBufferDescriptor
    = (label, size) => ({
        label,
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    })

export const stagingBufferDesc
    : (label: string, size: number) => GPUBufferDescriptor
    = (label, size) => ({
        label,
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })


export const steppedIncrement = (baseValue: number, range: number) => (i: number, size: number) => {
    const step = range / (size / 2)
    const factor = i < size / 2 ? i : size - i

    return baseValue + factor * step;
}

/** 
 * Set of buffers for a ping pong approach\
 * Starting order is `[In, Out, Debug, Staging, DebugStaging]`, where `In` `Out` get swapped on each pass
 */
export type BufferSet = [GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer, GPUBuffer]

export type ID = `${SYSTEM}:${PROPERTY}`


export type Deps<P extends ID> = {
    [K in P]: BufferSet
}



export type PassConfig<P extends ID> = (
    i: number,
    dev: GPUDevice, cfg: Config,
    pipeline: GPUComputePipeline, layout: GPUBindGroupLayout,
    /** [params, elevation] */
    uniforms: [GPUBuffer, GPUBuffer],
    buffers: Deps<P>) => GPUCommandBuffer