import { alpha_drag, gamma, lambda_base, omega, R } from "climate/parameters/constants"

export const code = `
struct Params {
    circumference: f32,
    tilt: f32,
    rotation_speed: f32,
    time: f32,
    h_max: f32,
    step: vec2f,
    size: vec2f
}

@group(0) @binding(0) var<uniform>             params       : Params;

@group(0) @binding(1) var<storage>             elevation    : array<f32>;
@group(0) @binding(2) var<storage>             temperature  : array<f32>;
@group(0) @binding(3) var<storage>             velocity     : array<vec2f>; 

@group(0) @binding(4) var<storage, read_write> result       : array<vec2f>;


        
fn index(p: vec2u) -> u32 {
    return p.y * u32(params.size.x) + p.x;
}

fn neighbourIndices(p: vec2u) -> vec4u {
    var left: u32;
    if (p.x == 0) {
        left = index(vec2(u32(params.size.x) - 1, p.y));
    } else {
        left = index(vec2(p.x - 1, p.y));
    }
    var right: u32;
    if (p.x == u32(params.size.x) - 1) {
        right = index(vec2(0, p.y));
    } else {
        right = index(vec2(p.x + 1, p.y));
    }
    var up: u32;
    if (p.y == 0) {
        up = index(vec2(p.x, p.y));
    } else {
        up = index(vec2(p.x, p.y - 1));
    }
    var down: u32;
    if (p.y == u32(params.size.y) - 1) {
        left = index(vec2(p.x, p.y));
    } else {
        left = index(vec2(p.x, p.y + 1));
    }

    return vec4(left, right, up, down);
}


fn grad_temp(p: vec2u) -> vec2f {
    let indices = neighbourIndices(p);

    let gradX = (temperature[indices.y] - temperature[indices.x]) / (2.0 * params.step.x);   
    let gradY = (temperature[indices.w] - temperature[indices.z]) / (2.0 * params.step.y);

    return vec2f(gradX, gradY);
}
fn grad_elevation(p: vec2u) -> vec2f {
    let indices = neighbourIndices(p);

    let gradX = (elevation[indices.y] - elevation[indices.x]) / (2.0 * params.step.x);   
    let gradY = (elevation[indices.w] - elevation[indices.z]) / (2.0 * params.step.y);

    return vec2f(gradX, gradY);
}

fn grad_velocity(p: vec2u) -> vec2<vec2f> {
    let indices = neighbourIndices(p);

    let gradX = (velocity[indices.y] - velocity[indices.x]) / (2.0 * params.step.x);   
    let gradY = (velocity[indices.w] - velocity[indices.z]) / (2.0 * params.step.y);

    return vec2(gradX, gradY);
}

fn laplacian_T(p: vec2u) -> f32 {
    let indices = neighbourIndices(p);
    let i = index(p.xy);

    let lap = (temperature[indices.y] - 2 * temperature[i] + temperature[indices.x]) / (params.step.x * params.step.x) 
        + (temperature[indices.w] - 2 * temperature[i] + temperature[indices.z]) / (params.step.y * params.step.y);

    return lap;

}

fn latitude(uy: u32) -> vec2f {
    let y = f32(uy);
    let lat_step_degrees = 180.0 / params.size.y;
    let lat_max = 90.0 - y * lat_step_degrees;
    let lat_min = 90.0 - (y + 1.0) * lat_step_degrees;

    // let degrees = (params.size.y - f32(y) -1) / (params.size.y - 1.0) * 180.0 - 90.0;
    return radians(vec2f(lat_max, lat_min));
}


fn coriolis(p: vec2u) -> f32 {
    let lat = latitude(p.y);
    let lat_mid = 0.5 * (lat.x + lat.y); // x = max, y = min

    return 2.0 * ${omega} * sin(mid_lat);
}

fn crossK(vec: vec2f) -> vec2f {
    return vec2f(-vec.y, vec.x);
}

fn normal2D(vec: vec2f) -> vec2f {
    return sqrt(dot(vec, vec));
}
fn normal(p: vec2f) -> vec2f {
    let g = grad_elevation(p);
    let len = length(g);

    if(len == 0){
        return vec2f(0.0, 0.0);
    }
    
    // minus due to rotating clockwise, as y = 0 means the top row of the grid
    return vec2f(g.y, -g.x) / len; 
}


fn drag(p: vec2u) -> f32 {
    let g = grad_elevation(p);

    return ${lambda_base} + ${alpha_drag} * abs(normal2D(g));
}

fn topographical_forcing(p: vec2u) -> vec2f {
    let i = index(p);
    let n = normal(p);
    return -${gamma} * (elevation[i] / params.h_max) * dot(velocity[i], n) * n;
}

@compute @workgroup_size(8,8)
fn main(
    @builtin(global_invocation_id) cell: vec3u, 
    @builtin(local_invocation_id) local_id : vec3u
) {
    let i = index(cell.xy);
    let T = temperature[i];
    let gradT = grad_temp(cell.xy);
    let gradV = grad_velocity(cell.xy);

    let DT = - coriolis(cell.xy) * crossK(velocity[i]) - ${R} * gradT - drag(cell.xy) * velocity[i] - topographical_forcing(cell.xy) ;
    let advection = dot(velocity[i], gradV);

    result[i] = velocity[i] + DT - advection;
    
    //let lat = latitude(cell.y);
    //result[i] = abs(lat.x - lat.y);

}
`