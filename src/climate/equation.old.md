
**Atmosphere:**

Motion:

$$ \frac{Dv_{air}}{Dt} = -f_c v_{air}\times\hat{k} - \frac{1}{\rho_{air}}\nabla p_{air} - g\beta_{air}(T_{air}-T_0) \hat{k} - \lambda(h) v_{air} + f_{topo}(h, v_{air}) $$

Temperature:

$$ \frac{DT_{air}}{Dt} = \frac{1}{\rho_{air}c_{p_{air}}} Q_{air} + \kappa_{air}\nabla^2 T_{air} $$

**Ocean:**

Motion:

$$ \frac{Dv_{water}}{Dt} = -f_c v_{water}\times\hat{k} - \frac{1}{\rho_{water}}\nabla p_{water} - g\beta_{water}(T_{water}-T_0) \hat{k} - \lambda(h) v_{water} + \tau_{wind} / \rho_{water} $$

Temperature:

$$ \frac{DT_{water}}{Dt} = \frac{1}{\rho_{water}c_{p_{water}}} Q_{water} + \kappa_{water}\nabla^2 T_{water} $$

**Land:**

Temperature:

$$ \frac{DT_{land}}{Dt} = \frac{1}{\rho_{land}c_{p_{land}}} Q_{land} + \kappa_{land}\nabla^2 T_{land} $$

Definitions:

$$ f_{topo}(h, v_{air}) = -\gamma \left( \frac{h}{h_{max}} \right) (v_{air} \cdot \hat{n}) $$
$$ \lambda(h) = \lambda_{base} + \alpha \|\nabla h\| $$
$$ \tau_{wind} = \rho_{air} C_d \|v_{air}\|^2 $$

Heat Budgets:

$$ Q_{air} = Q_{in_{air}} - \lambda_{H}(T_{water}-T_{air}) - \lambda_{H}(T_{land}-T_{air}) - \sigma_{SB} T_{air}^4 (1-\epsilon_{air}) $$
$$ Q_{water} = Q_{in_{water}} - \lambda_{H}(T_{air}-T_{water}) - \sigma_{SB} T_{water}^4 (1-\alpha_{water}) $$
$$ Q_{land} = Q_{in_{land}} - \lambda_{H}(T_{land}-T_{air}) - \sigma_{SB} T_{land}^4 (1-\alpha_{land}) $$

Where:
- $f_c = 2\Omega \sin(\phi)$ is the Coriolis parameter.
- $T_0$ is a reference temperature.
- $\beta_{air}$, $\beta_{water}$ are the thermal expansion coefficients for air and water.
- $Q_{in_{air}}$, $Q_{in_{water}}$, and $Q_{in_{land}}$ are the incoming solar radiation for air, water, and land respectively, which should be calculated based on the specific properties of the simulated planet and its distance from the star.
- $\sigma_{SB}$ is the Stefan-Boltzmann constant.
- $\epsilon_{air}$ is the greenhouse gas effect.
- $\alpha_{water}$, $\alpha_{land}$ are the albedos of water and land.
- $\kappa_{air}$, $\kappa_{water}$, and $\kappa_{land}$ are the diffusivities of air, water, and land, respectively.