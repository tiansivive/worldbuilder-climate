// Constants
export const omega = 2 * Math.PI / (24 * 60 * 60);
export const dt = 3600 // seconds
export const convergenceThreshold = 1e-6; // Convergence threshold for equilibrium
export const g = 9.81;  // Gravity acceleration (m/s^2)
export const R = 287.05;  // Specific gas constant for dry air (J/(kg·K))
export const k_air = 2e-4;  // Diffusivity of air (W/(m·K))
export const k_water = 1e-7;  // Diffusivity of water (W/(m·K))
export const k_ice = 2.22;  // Thermal conductivity of ice (W/(m·K))
export const L_f = 334000;  // Latent heat of fusion for water (J/kg)
export const rho_air = 1.225;  // Density of air (kg/m^3)
export const rho_water = 1025;  // Density of sea water (kg/m^3)
export const rho_ice = 917;  // Density of ice (kg/m^3)
export const rho_land = 3300 // Density of land (kg/m^3) 

export const T0 = 273.15;  // Reference temperature (K)
export const beta_air = 0.0001; // thermal expansion coefficient for air, 1/K
export const beta_water = 0.0002; // thermal expansion coefficient for water, 1/K
export const lambda_base = 0.001; // base drag coefficient
export const cp_air = 1005; // specific heat capacity of air (J/kg/K)
export const cp_land = 800; // specific heat capacity of land (J/kg/K)
export const cp_water = 3993; // specific heat capacity of water (J/kg/K)
export const cp_ice = 2093; // specific heat capacity of ice (J/kg/K)
/** Stefan - Boltzmann constant (W/m^2/K^4) */
export const sigma = 5.67e-8
export const emissivity = 0.75

// Coefficients for processes

export const albedo_water = 0.3;  // Average albedo
export const albedo_atmosphere = 0.3;  // Average albedo
export const albedo_land = 0.15;  // Average albedo
export const albedo_ice = 0.85;  // Average albedo

export const beta = 0.00015;  // Thermal expansion coefficient of sea water (1/K)
export const gamma = 0.02; // parameter for the topographical forcing
export const alpha_drag = 0.01; // parameter for the drag coefficient
/** Transmission rate losses through atmosphere */
export const tau_tr_air = 0.6
export const S0 = 1361 // W/m^2 

export const h_max = 8000; // max height of the topography (m)
export const h_transfer = 30 // heat transfer coefficient

