import { dt, T0 } from "climate/parameters/constants";
import { pingPongBufferDesc } from "climate/sim";

import { Matrix } from "lib/math/types";
import { maxMatrix } from "lib/math/utils";

import * as ShaderT from './temperature.wgsl'
import * as ShaderV from './velocity.wgsl'

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
}

/** 
 * Set of buffers for a ping pong approach\
 * Starting order is `[In, Out, Staging]`, where `In` `Out` get swapped on each pass
 */
type BufferSet = [GPUBuffer, GPUBuffer, GPUBuffer]






export const pipelines
    = (device: GPUDevice, cfg: Config) => {

        const buffers = {
            temperature: setupTemperatureBuffers(device, cfg),
            elevation: setupElevationBuffer(device, cfg),
            velocity: setupVelocityBuffers(device, cfg)
        }

        return {
            buffers,
            temperature: pipeline_T(device),
            velocity: pipeline_V(device)

        }
    }


const pipeline_T
    : (device: GPUDevice) => { pipeline: GPUComputePipeline, bindGroupLayout: GPUBindGroupLayout }
    = dev => {
        const entries: GPUBindGroupLayoutEntry[] = [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" } // config uniforms
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" } // temperature state input buffer
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" } // velocity state input buffer
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" } // temperature state output buffer
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" } // debug state output buffer
            }
        ]
        const bindGroupLayout = dev.createBindGroupLayout({ label: "temperature_group", entries })
        const pipeline = dev.createComputePipeline({
            label: "Atmosphere temperature pipeline",
            layout: dev.createPipelineLayout({
                label: "temperature_layout",
                bindGroupLayouts: [bindGroupLayout]
            }),
            compute: {
                entryPoint: "main",
                module: dev.createShaderModule({ code: ShaderT.code })
            }
        })

        return { pipeline, bindGroupLayout }
    }

const pipeline_V
    : (device: GPUDevice) => { pipeline: GPUComputePipeline, bindGroupLayout: GPUBindGroupLayout }
    = dev => {
        const entries: GPUBindGroupLayoutEntry[] = [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" } // config uniforms
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" } // elevation input buffer
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" } // temperature state input buffer
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" } // velocity state input buffer
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" } // velocity state output buffer
            },
            {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" } // debug state output buffer
            },

        ]

        const bindGroupLayout = dev.createBindGroupLayout({ label: "velocity_group", entries })
        const pipeline = dev.createComputePipeline({
            label: "Atmosphere velocity pipeline",
            layout: dev.createPipelineLayout({
                label: "velocity_layout",
                bindGroupLayouts: [bindGroupLayout]
            }),
            compute: {
                entryPoint: "main",
                module: dev.createShaderModule({ code: ShaderV.code })
            }
        })

        return { pipeline, bindGroupLayout }
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

const setupTemperatureBuffers
    : (device: GPUDevice, options: Config) => BufferSet
    = (dev, cfg) => {
        const temperature = new Float32Array(cfg.size.w * cfg.size.h).fill(T0);
        const buffers: BufferSet = [
            dev.createBuffer(pingPongBufferDesc("temperature_in", temperature.byteLength)),
            dev.createBuffer(pingPongBufferDesc("temperature_out", temperature.byteLength)),
            dev.createBuffer({
                label: "temperature_staging",
                size: temperature.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            })
        ]
        dev.queue.writeBuffer(buffers[0], 0, temperature);

        return buffers
    }


const setupElevationBuffer
    : (device: GPUDevice, options: Config) => GPUBuffer
    = (dev, cfg) => {
        const elevation = new Float32Array(cfg.elevation.flat())
        const buffer = dev.createBuffer({
            label: "Elevation",
            size: elevation.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        dev.queue.writeBuffer(buffer, 0, elevation);

        return buffer
    }

const setupVelocityBuffers
    : (device: GPUDevice, options: Config) => BufferSet
    = (dev, cfg) => {
        const uv_velocity = new Float32Array(cfg.size.w * cfg.size.h * 2).fill(0.0);
        const buffers: BufferSet = [
            dev.createBuffer(pingPongBufferDesc("velocity_in", uv_velocity.byteLength)),
            dev.createBuffer(pingPongBufferDesc("velocity_out", uv_velocity.byteLength)),
            dev.createBuffer({
                label: "velocity_staging",
                size: uv_velocity.byteLength,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            })
        ]
        dev.queue.writeBuffer(buffers[0], 0, uv_velocity);

        return buffers
    }