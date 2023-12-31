import { beta_water, g, lambda_base, rho_air, rho_water } from "climate/parameters/constants"

export const code = `
struct Params {
    circumference: f32,
    tilt: f32,
    orbit_period: f32,
    day_of_year: f32,
    rotation_speed: f32,
    time: f32,
    h_max: f32,
    dx: f32,
    dy: f32,
    width: f32,
    height: f32
}

@group(0) @binding(0) var<uniform>             params       : Params;
@group(0) @binding(1) var<storage>             elevation    : array<f32>;

@group(0) @binding(2) var<storage>             water_temp   : array<f32>;
@group(0) @binding(3) var<storage>             water_vel    : array<vec2f>; 
@group(0) @binding(4) var<storage>             air_vel      : array<vec2f>; 

@group(0) @binding(5) var<storage, read_write> result       : array<vec2f>;
@group(0) @binding(6) var<storage, read_write> debug        : array<vec2f>;


        
fn index(p: vec2u) -> u32 {
    return p.y * u32(params.width) + p.x;
}

fn neighbourIndices(p: vec2u) -> vec4u {
    var left: u32;
    if (p.x == 0) {
        left = index(vec2(u32(params.width) - 1, p.y));
    } else {
        left = index(vec2(p.x - 1, p.y));
    }
    var right: u32;
    if (p.x == u32(params.width) - 1) {
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
    if (p.y == u32(params.height) - 1) {
        down = index(vec2(p.x, p.y));
    } else {
        down = index(vec2(p.x, p.y + 1));
    }

    return vec4(left, right, up, down);
}

fn water_velocity(i: u32) -> vec2f {
    if(elevation[i] > 0) {
        return vec2f(0.0);
    }
    
    return water_vel[i];
}


fn grad_temp(p: vec2u) -> vec2f {
    let indices = neighbourIndices(p);

    let gradX = (water_temp[indices.y] - water_temp[indices.x]) / (2.0 * params.dx);   
    let gradY = (water_temp[indices.w] - water_temp[indices.z]) / (2.0 * params.dy);

    return vec2f(gradX, gradY);
}
fn grad_elevation(p: vec2u) -> vec2f {
    let indices = neighbourIndices(p);

    let gradX = (elevation[indices.y] - elevation[indices.x]) / (2.0 * params.dx);   
    let gradY = (elevation[indices.w] - elevation[indices.z]) / (2.0 * params.dy);

    return vec2f(gradX, gradY);
}

fn grad_velocity(p: vec2u) -> vec4f {
    let indices = neighbourIndices(p);

    let gradX = (water_velocity(indices.y) - water_velocity(indices.x)) / (2.0 * params.dx);   
    let gradY = (water_velocity(indices.w) - water_velocity(indices.z)) / (2.0 * params.dy);

    // vec4(du_dx, dv_dx, du_dy, dv_dy)
    return vec4f(gradX.x, gradX.y, gradY.x, gradY.y);
}


fn latitude(uy: u32) -> vec2f {
    let y = f32(uy);
    let lat_step_degrees = 180.0 / params.height;
    let lat_max = 90.0 - y * lat_step_degrees;
    let lat_min = 90.0 - (y + 1.0) * lat_step_degrees;

    // let degrees = (params.height - f32(y) -1) / (params.height - 1.0) * 180.0 - 90.0;
    return radians(vec2f(lat_max, lat_min));
}


fn coriolis(p: vec2u) -> f32 {
    let lat = latitude(p.y);
    let lat_mid = 0.5 * (lat.x + lat.y); // x = max, y = min

    return 2.0 * radians(params.rotation_speed) * sin(lat_mid);
}

fn crossK(vec: vec2f) -> vec2f {
    return vec2f(-vec.y, vec.x);
}


fn normal(p: vec2u) -> vec2f {
    let g = grad_elevation(p);
    let len = length(g);

    if(len == 0){
        return vec2f(0.0, 0.0);
    }
    
    // minus due to rotating clockwise, as y = 0 means the top row of the grid
    return vec2f(g.y, g.x) / len; 
}

fn wind_stress(i: u32) -> vec2f {

    return ${rho_air} * ${lambda_base} * pow(length(air_vel[i]), 2) * air_vel[i];
}

@compute @workgroup_size(8,8)
fn main(
    @builtin(global_invocation_id) cell: vec3u, 
    @builtin(local_invocation_id) local_id : vec3u
) {
    let i = index(cell.xy);

    if(elevation[i] > 0){
        result[i] = vec2f(0.0);
        return;
    }

    let T = water_temp[i];
    let V = water_velocity(i);
    let gradT = grad_temp(cell.xy);
    let gradV = grad_velocity(cell.xy);

    let fc = - coriolis(cell.xy) * crossK(V);
    let pressure = - ${g} * ${beta_water} * gradT;
    let stress = - wind_stress(i)/${rho_water};


    let DT = fc + pressure + stress;
   
    // advection is dot product of vel and nabla times v
    // We compute gradV as the xy derivatives for uv, so grad.xy is uv_dx, grad.zw is uv_dy
    let advection = V.x * gradV.xy + V.y * gradV.zw;

    result[i] = V + DT - advection;
    debug[i] = stress;
    
    //result[i] = normal(cell.xy);
   

}
`