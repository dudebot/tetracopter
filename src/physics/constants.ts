import { Vector3 } from '../math/vector3';
import { Matrix } from '../math/matrix';

/**
 * Physical constants and parameters for the simulation
 */

// Gravitational acceleration (m/s²)
// Z-up convention: gravity points downward (-z)
export const GRAVITY = new Vector3(0, 0, -9.81);

// Drone physical parameters
export const DRONE_MASS = 1.0;  // kg

// Inertia tensor in body frame (kg⋅m²)
// Diagonal matrix for simplicity (symmetric tetrahedron)
export const DRONE_INERTIA = Matrix.diagonal([0.02, 0.02, 0.02]);

// Inverse inertia tensor (precomputed for efficiency)
export const DRONE_INERTIA_INV = Matrix.diagonal([1/0.02, 1/0.02, 1/0.02]);

// Arm length for tetrahedral geometry
export const ARM_LENGTH = 1.0;  // meters

// Motor parameters
export const MAX_THRUST = 10.0;      // Maximum thrust per motor (N)
export const MIN_THRUST = -10.0;     // Minimum thrust (reverse) (N)
export const MAX_SPIN_TORQUE = 1.0;  // Maximum spin torque (N⋅m)
export const MIN_SPIN_TORQUE = -1.0; // Minimum spin torque (N⋅m)

// Simulation parameters
export const DEFAULT_TIME_STEP = 0.001;  // 1 ms (1000 Hz simulation)
export const MAX_TIME_STEP = 0.01;       // 10 ms maximum

// Numerical tolerances
export const EPSILON = 1e-10;
export const QUATERNION_NORM_TOLERANCE = 1e-6;

// Initial conditions (can be overridden)
export const DEFAULT_INITIAL_POSITION = new Vector3(0, 0, 1);  // Start 1m above ground
export const DEFAULT_INITIAL_VELOCITY = new Vector3(0, 0, 0);
export const DEFAULT_INITIAL_ANGULAR_VEL = new Vector3(0, 0, 0);

// Environment parameters
export const AIR_DENSITY = 1.225;  // kg/m³ at sea level (for future drag modeling)