import { albedo_atmosphere, cp_air, emissivity, k_air, rho_air, S0, sigma } from "climate/parameters/constants"

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

@group(0) @binding(1) var<storage>             temperature  : array<f32>;
@group(0) @binding(2) var<storage>             velocity     : array<vec2f>; 

@group(0) @binding(3) var<storage, read_write> result       : array<f32>;
@group(0) @binding(4) var<storage, read_write> debug       : array<f32>;


        
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


fn grad_temp(p: vec2u) -> vec2f {
    let indices = neighbourIndices(p);

    let gradX = (temperature[indices.y] - temperature[indices.x]) / (2.0 * params.dx);   
    let gradY = (temperature[indices.w] - temperature[indices.z]) / (2.0 * params.dy);

    return vec2f(gradX, gradY);
}


fn laplacian_T(p: vec2u) -> f32 {
    let indices = neighbourIndices(p);
    let i = index(p.xy);

    let lap = (temperature[indices.y] - 2 * temperature[i] + temperature[indices.x]) / (params.dx * params.dx) 
        + (temperature[indices.w] - 2 * temperature[i] + temperature[indices.z]) / (params.dy * params.dy);

    return lap;

}

fn latitude(uy: u32) -> vec2f {
    let y = f32(uy);
    let lat_step_degrees = 180.0 / params.height;
    let lat_max = 90.0 - y * lat_step_degrees;
    let lat_min = 90.0 - (y + 1.0) * lat_step_degrees;

    // let degrees = (params.height - f32(y) -1) / (params.height - 1.0) * 180.0 - 90.0;
    return radians(vec2f(lat_max, lat_min));
}

fn hour_omega(p: vec2u) -> f32 {
    let period = 360.0 / params.rotation_speed;
    let omega = -f32(p.x) * f32(360/u32(params.width)) + params.time * (360.0/period);
    if (omega > 180.0) {
        return radians(omega - 360.0);
    }
    if (omega < -180.0) {
        return radians(omega + 360.0);
    }
    return radians(omega);
}

fn seasonal_tilt_adjustment() -> f32 {
    let year_angle = (2.0 * ${Math.PI}/params.orbit_period) * params.day_of_year;
    return params.tilt * cos(year_angle);
}

fn Q_sol(p: vec2u) -> f32 {

    let w = hour_omega(p);
    let lat = latitude(p.y);
    let lat_mid = 0.5 * (lat.x + lat.y); // x = max, y = min
    let tilt = seasonal_tilt_adjustment();

    let projection = cos(lat_mid) * cos(tilt) * cos(w) + sin(lat_mid) * sin(tilt);
    
    if (projection < 0.0){
        return 0.0;
    }
    let Q = cos(lat_mid) * (${S0} * (1 - ${albedo_atmosphere}) * projection);
    return Q;
}

fn Q_air(p: vec2u, temp: f32) -> f32 {
    let solar_radiance = Q_sol(p);
    let radiative_loss = ${sigma} * pow(temp, 4);
    let diffusion = ${k_air} * laplacian_T(p) * temp;

    return solar_radiance - ${emissivity} * radiative_loss + diffusion;

}

@compute @workgroup_size(8,8)
fn main(
    @builtin(global_invocation_id) cell: vec3u, 
    @builtin(local_invocation_id) local_id : vec3u
) {
    let i = index(cell.xy);
    let T = temperature[i];
    let gradT = grad_temp(cell.xy);
    
    let DT = Q_air(cell.xy, T) / (${rho_air}*${cp_air});
    let advection = dot(velocity[i], gradT);
    
    result[i] = T + DT - advection;

    
    let diffusion = ${k_air} * laplacian_T(cell.xy) * T;
    debug[i] = diffusion;

    //let lat = latitude(cell.y);
    //result[i] = ${k_air} * laplacian_T(cell.xy) * T;

}
`