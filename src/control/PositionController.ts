import { Vector3 } from '../math/vector3';
import { Quaternion } from '../math/quaternion';
import { DroneState } from '../physics/DroneState';
import * as Constants from '../physics/constants';

/**
 * PD controller for position control in world frame
 * Computes desired thrust and orientation to track position
 */
export class PositionController {
    // PD gains for position control
    public Kp: Vector3;  // Proportional gain (per axis)
    public Kd: Vector3;  // Derivative gain (per axis)

    // Target position and velocity
    private targetPosition: Vector3;
    private targetVelocity: Vector3;

    // Physical parameters
    private mass: number;

    // Computed values for debugging
    public lastPositionError: Vector3 = Vector3.zero();
    public lastVelocityError: Vector3 = Vector3.zero();
    public lastDesiredAccel: Vector3 = Vector3.zero();
    public lastDesiredForceWorld: Vector3 = Vector3.zero();

    constructor(
        mass: number = Constants.DRONE_MASS,
        Kp: Vector3 = new Vector3(4, 4, 8),  // Higher z gain for altitude
        Kd: Vector3 = new Vector3(3, 3, 4)
    ) {
        this.mass = mass;
        this.Kp = Kp;
        this.Kd = Kd;
        this.targetPosition = new Vector3(0, 0, 1);  // Default: hover 1m above ground
        this.targetVelocity = Vector3.zero();
    }

    /**
     * Set target position
     */
    setTargetPosition(position: Vector3): void {
        this.targetPosition = position.clone();
    }

    /**
     * Set target velocity (for feedforward)
     */
    setTargetVelocity(velocity: Vector3): void {
        this.targetVelocity = velocity.clone();
    }

    /**
     * Set target position and velocity
     */
    setTarget(position: Vector3, velocity?: Vector3): void {
        this.targetPosition = position.clone();
        this.targetVelocity = velocity ? velocity.clone() : Vector3.zero();
    }

    /**
     * Compute desired world-frame force to reach target position
     * @param state Current drone state
     * @returns Desired force in world frame
     */
    computeDesiredForce(state: DroneState): Vector3 {
        // Position error: e_p = p_target - p
        const posError = this.targetPosition.subtract(state.position);

        // Velocity error: e_v = v_target - v
        const velError = this.targetVelocity.subtract(state.velocity);

        // Store for debugging
        this.lastPositionError = posError;
        this.lastVelocityError = velError;

        // PD control law for acceleration:
        // a_desired = Kp * e_p + Kd * e_v
        const desiredAccel = new Vector3(
            this.Kp.x * posError.x + this.Kd.x * velError.x,
            this.Kp.y * posError.y + this.Kd.y * velError.y,
            this.Kp.z * posError.z + this.Kd.z * velError.z
        );

        this.lastDesiredAccel = desiredAccel;

        // Convert to force: F = m * (a_desired - g)
        // Note: gravity is negative z, so we subtract it (which adds upward force)
        const desiredForce = new Vector3(
            this.mass * desiredAccel.x,
            this.mass * desiredAccel.y,
            this.mass * (desiredAccel.z - Constants.GRAVITY.z)  // Gravity compensation
        );

        this.lastDesiredForceWorld = desiredForce;
        return desiredForce;
    }

    /**
     * Compute desired body-frame force
     * @param state Current drone state
     * @returns Desired force in body frame
     */
    computeBodyForce(state: DroneState): Vector3 {
        const worldForce = this.computeDesiredForce(state);
        return state.worldToBody(worldForce);
    }

    /**
     * Compute desired orientation to align thrust with desired force direction
     * Assumes the drone's "up" direction (body +Z or thrust average) should point
     * along the desired force direction for efficient flight.
     *
     * @param desiredForceWorld Desired force in world frame
     * @param currentYaw Current yaw angle (to preserve yaw)
     * @returns Target quaternion for attitude controller
     */
    computeDesiredOrientation(desiredForceWorld: Vector3, currentYaw: number = 0): Quaternion {
        // For a tetrahedral drone, we want the thrust to align with the desired force
        // The "average thrust direction" in body frame depends on motor configuration

        // Simplified approach: align body Z axis with desired force direction
        // This works well when all motors thrust roughly "upward" in body frame

        const forceMag = desiredForceWorld.magnitude();
        if (forceMag < 0.1) {
            // No significant force needed, maintain current orientation
            return Quaternion.fromEuler(0, 0, currentYaw);
        }

        // Normalize force direction
        const thrustDir = desiredForceWorld.normalized();

        // World Z axis
        const worldUp = new Vector3(0, 0, 1);

        // Check if thrust is nearly vertical (avoid gimbal lock)
        const dotUp = thrustDir.dot(worldUp);
        if (Math.abs(dotUp) > 0.999) {
            // Nearly vertical thrust, just use yaw
            const roll = 0;
            const pitch = 0;
            return Quaternion.fromEuler(roll, pitch, currentYaw);
        }

        // Compute rotation from world Z to thrust direction
        // Using the cross product to get rotation axis
        const rotAxis = worldUp.cross(thrustDir);
        const rotAxisMag = rotAxis.magnitude();

        if (rotAxisMag < 1e-6) {
            // Thrust is along Z axis
            return Quaternion.fromEuler(0, 0, currentYaw);
        }

        rotAxis.normalize();
        const rotAngle = Math.acos(Math.max(-1, Math.min(1, dotUp)));

        // Create quaternion from axis-angle
        const qTilt = Quaternion.fromAxisAngle(rotAxis, rotAngle);

        // Apply yaw rotation
        const qYaw = Quaternion.fromAxisAngle(new Vector3(0, 0, 1), currentYaw);

        // Combine: first yaw, then tilt
        return qTilt.multiply(qYaw);
    }

    /**
     * Set PD gains
     */
    setGains(Kp: Vector3, Kd: Vector3): void {
        this.Kp = Kp;
        this.Kd = Kd;
    }

    /**
     * Set uniform horizontal gains and separate vertical gain
     */
    setGainsXYZ(kpXY: number, kdXY: number, kpZ: number, kdZ: number): void {
        this.Kp = new Vector3(kpXY, kpXY, kpZ);
        this.Kd = new Vector3(kdXY, kdXY, kdZ);
    }

    /**
     * Get current target position
     */
    getTargetPosition(): Vector3 {
        return this.targetPosition.clone();
    }

    /**
     * Check if drone is near target position
     */
    isAtTarget(positionTolerance: number = 0.1, velocityTolerance: number = 0.1): boolean {
        return this.lastPositionError.magnitude() < positionTolerance &&
               this.lastVelocityError.magnitude() < velocityTolerance;
    }

    /**
     * Get position error magnitude
     */
    getPositionError(): number {
        return this.lastPositionError.magnitude();
    }

    /**
     * Debug info
     */
    toString(): string {
        return `PositionController:
  Target pos: ${this.targetPosition.toString()}
  Target vel: ${this.targetVelocity.toString()}
  Pos error: ${this.lastPositionError.toString()} (${this.getPositionError().toFixed(3)} m)
  Vel error: ${this.lastVelocityError.toString()}
  Desired accel: ${this.lastDesiredAccel.toString()}
  Desired force (world): ${this.lastDesiredForceWorld.toString()}
  Kp: ${this.Kp.toString()}, Kd: ${this.Kd.toString()}`;
    }
}