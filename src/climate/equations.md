**Atmosphere**

$$
\frac{D\mathbf{v}_{air}}{Dt} = -f_c \mathbf{v}_{air}\times\hat{k} -R \nabla T_{air} - \lambda_{drag}\mathbf{v}_{air} - f_{topo}
$$

$$
\frac{DT_{air}}{Dt} = \frac{1}{\rho_{air}c_{p_{air}}}(Q_{air} + \nabla^2 (k_{air}T_{air}))
$$

**Ocean**

$$
\frac{D\mathbf{v}_{water}}{Dt} = -f_c \mathbf{v}_{water}\times\hat{k} - g\beta_{water}\nabla T_{water} + \tau_{wind}/\rho_{water} - I\tau_{ice}/\rho_{water}
$$

$$
\frac{DT_{water}}{Dt} = \frac{1}{\rho_{water}c_{p_{water}}}(Q_{water} + \nabla^2 (k_{water}T_{water}))
$$

**Land temperature**

$$
\frac{DT_{land}}{Dt} = \frac{1}{\rho_{land}c_{p_{land}}}(Q_{land} + \nabla^2 (k_{land}T_{land}))
$$

**Ice**

$$
\frac{DT_{ice}}{Dt} = \frac{1}{\rho_{ice}c_{p_{ice}}}(Q_{ice} + \nabla^2 (k_{ice}T_{ice}))
$$

$$
\frac{DI}{Dt} = P_{snow} + P_{freeze} - P_{melt} - P_{sublim} + \frac{Q_{ice}}{L_f \rho_{ice}}
$$

$$
m_{ice} \frac{D\mathbf{v}_{ice}}{Dt} = -f_c \mathbf{v}_{ice}\times\hat{k} - \frac{1}{\rho_{ice}}\nabla p_{ice} + \tau_{air} - \tau_{water} - \lambda_{drag}\mathbf{v}_{ice}
$$

**Heat budget for each system:**

$$ Q_{air} = Q_{sol} -\sigma{T}_{air}^4 + (k_{air}\nabla^2 T_{air}) + Q_{exchange}^{air-land} + Q_{exchange}^{air-water} + Q_{exchange}^{air-ice} $$

$$ Q_{water} = TR_{atm}(1−\alpha_{water}(I_{sea}))*Q_{sol} -\sigma{T}_{water}^4 + (k_{water}\nabla^2 T_{water}) + Q_{exchange}^{water-land} + Q_{exchange}^{water-air} + Q_{exchange}^{water-ice} $$

$$ Q_{land} = TR_{atm}(1−\alpha_{land})*Q_{sol} -\sigma{T}_{land}^4 + (k_{land}\nabla^2 T_{land}) + Q_{exchange}^{land-air} + Q_{exchange}^{land-water} $$

$$ Q_{ice} = TR_{atm}(1−\alpha(I_{sea}))*Q_{sol} -\sigma{T}_{ice}^4 − Q_{penetration}−Q_{exchange}^{water-ice} − Q_{exchange}^{air-ice}  $$


**Stress** 

$$ \tau_{wind} = \rho_{air} C_d \|v_{air}\|^2 $$
$$ \tau_{water} = \rho_{water} C_d \|v_{water}\|^2 $$
$$ \tau_{ice} = \rho_{ice} C_d \|v_{ice}\|^2 I $$

Definitions:

$$ f_{topo}(h, \mathbf{v}_{air}) = −γ (h/h_{max})(\mathbf{v}_{air} \cdot \mathbf{\hat{n}}) \mathbf{\hat{n}} $$
$$ \lambda(h) = \lambda_{base} + \alpha \|\nabla h\| $$

$$
Q_{sol}(\phi, \delta, \omega) = S_0 (1 - \alpha) \cos(\phi) \cos(\delta) \cos(\omega) + \sin(\phi) \sin(\delta)
$$

Where:
- $D/Dt$ represents the material derivative.
- $\mathbf{v}_{air}$, $\mathbf{v}_{water}$, and $\mathbf{v}_{ice}$ represent the velocities of air, water, and ice respectively.
- $T_{air}$, $T_{water}$, $T_{land}$, and $T_{ice}$ represent the temperatures of the air, water, land, and ice respectively.
- $p_{air}$, $p_{water}$, and $p_{ice}$ represent the pressures in the air, water, and ice respectively.
- $Q_{air}$, $Q_{water}$, $Q_{land}$, and $Q_{ice}$ represent the heat budgets of the air, water, land, and ice respectively.
- $f_c$, $\Omega$, and $\phi$ are the Coriolis parameter, Earth's angular velocity, and latitude respectively.
- $g$ is the acceleration due to gravity.
- $\beta_{water}$ is the thermal expansion coefficient of water respectively.
- $T_{0}$ is a reference temperature.
- $\lambda_{drag}$ is the drag coefficient.
- $f_{topo}(h, \mathbf{v}_{air})$ is the topographical forcing.
- $\rho_{air}$, $\rho_{water}$, $\rho_{land}$, $\rho_{ice}$ are the densities of air, water, land, and ice respectively.
- $c_{p_{air}}$, $c_{p_{water}}$, $c_{p_{land}}$, $c_{p_{ice}}$ are the specific heat capacities of air, water, land, and ice respectively.
- $k_{air}$, $k_{water}$, $k_{land}$, $k_{ice}$ are the thermal diffusivities of air, water, land, and ice respectively.
- $P_{snow}$, $P_{freeze}$, $P_{melt}$, $P_{sublim}$ represent the accumulation, formation, melting, and sublim
- $R$ is the gas constant
- $Q_{exchange}^{X-Y}$ denotes the heat exchange between systems X and Y
- $\alpha_{land}$, $\alpha_{air}$, $\alpha_{water}$ are the respective albedo values for land, air, and water. 
- $C_{wind}$, $C_{water}$, and $C_{ice}$ are coefficients characterizing the relative drag between the air, water, and ice. 
- $\phi$ is the latitude of the point of interest.
- $\delta$ is the axial tilt of the planet.
- $\omega$ is the hour angle, which represents the time of day. It is zero at solar noon, and varies by 15° per hour (for an Earth-like planet with a 24-hour day), and is positive in the morning, and negative in the afternoon/evening.
- $\alpha$ is the albedo, the reflectivity of the planet's surface.






The coefficients are subject to fine-tuning based on empirical observations or other available data. A starting point could be:

- $C_d$: Drag coefficient, typically in the range of 0.001 to 0.003 for water and air over a smooth surface.
- $h_{water-air}$: Heat transfer coefficient for water and air, roughly 20 W/(m^2*K)
- $h_{land-air}$: Heat transfer coefficient for land and air, roughly 30 W/(m^2*K)
- $h_{ice-air}$: Heat transfer coefficient for ice and air, roughly 10 W/(m^2*K)
- $h_{ice-water}$: Heat transfer coefficient for ice and water, roughly 100 W/(m^2*K)
- $T_{atm}$: Atmospheric transmission ratio, typically around 0.6 to 0.8 depending on cloud cover and other factors.
- $\alpha_{air}$, $\alpha_{water}$, $\alpha_{land}$, $\alpha_{ice}$: Albedo values for air, water, land, and ice. Varies

, but typically around 0.3 for water, 0.1-0.2 for land, and 0.8-0.9 for ice.  
- $k_{air}$, $k_{water}$, $k_{land}$, $k_{ice}$: Thermal diffusivities of air, water, land, and ice. These values vary but can be looked up in a materials property database.
