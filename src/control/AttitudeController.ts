import { Vector3 } from '../math/vector3';
import { Quaternion } from '../math/quaternion';
import { DroneState } from '../physics/DroneState';

/**
 * PD controller for attitude (orientation) control
 * Uses quaternion error for rotation tracking
 */
export class AttitudeController {
    // PD gains for attitude control
    public Kp: Vector3;  // Proportional gain (per axis)
    public Kd: Vector3;  // Derivative gain (per axis)

    // Target orientation
    private targetOrientation: Quaternion;

    // Computed values for debugging
    public lastError: Vector3 = Vector3.zero();
    public lastTorque: Vector3 = Vector3.zero();

    constructor(
        Kp: Vector3 = new Vector3(5, 5, 5),
        Kd: Vector3 = new Vector3(2, 2, 2)
    ) {
        this.Kp = Kp;
        this.Kd = Kd;
        this.targetOrientation = Quaternion.identity();
    }

    /**
     * Set target orientation
     */
    setTargetOrientation(target: Quaternion): void {
        this.targetOrientation = target.normalized();
    }

    /**
     * Set target orientation from Euler angles (roll, pitch, yaw in radians)
     */
    setTargetFromEuler(roll: number, pitch: number, yaw: number): void {
        this.targetOrientation = Quaternion.fromEuler(roll, pitch, yaw);
    }

    /**
     * Set target orientation from axis-angle
     */
    setTargetFromAxisAngle(axis: Vector3, angle: number): void {
        this.targetOrientation = Quaternion.fromAxisAngle(axis, angle);
    }

    /**
     * Compute desired torque to reach target orientation
     * @param state Current drone state
     * @returns Desired body-frame torque
     */
    computeTorque(state: DroneState): Vector3 {
        // Get current orientation and angular velocity
        const q = state.orientation;
        const omega = state.angularVelocity;

        // Compute orientation error: q_err = q_target ⊗ q_current^*
        // This gives us how much we need to rotate to reach the target
        const errorVec = q.errorTo(this.targetOrientation);

        // Store for debugging
        this.lastError = new Vector3(errorVec.x, errorVec.y, errorVec.z);

        // PD control law:
        // τ = Kp * e_rot - Kd * ω
        //
        // The error vector is in the world frame (approximately),
        // but we need torque in body frame. For small errors, this is okay.
        // For larger errors, we should transform the error to body frame.

        // Transform error to body frame for more accurate control
        const errorBody = state.worldToBody(this.lastError);

        // Compute torque (PD law)
        const torque = new Vector3(
            this.Kp.x * errorBody.x - this.Kd.x * omega.x,
            this.Kp.y * errorBody.y - this.Kd.y * omega.y,
            this.Kp.z * errorBody.z - this.Kd.z * omega.z
        );

        this.lastTorque = torque;
        return torque;
    }

    /**
     * Set PD gains
     */
    setGains(Kp: Vector3, Kd: Vector3): void {
        this.Kp = Kp;
        this.Kd = Kd;
    }

    /**
     * Set uniform gains (same for all axes)
     */
    setUniformGains(kp: number, kd: number): void {
        this.Kp = new Vector3(kp, kp, kp);
        this.Kd = new Vector3(kd, kd, kd);
    }

    /**
     * Get current target orientation
     */
    getTargetOrientation(): Quaternion {
        return this.targetOrientation.clone();
    }

    /**
     * Check if drone is near target orientation
     */
    isAtTarget(tolerance: number = 0.1): boolean {
        return this.lastError.magnitude() < tolerance;
    }

    /**
     * Get orientation error magnitude in radians (approximately)
     */
    getErrorMagnitude(): number {
        return this.lastError.magnitude();
    }

    /**
     * Debug info
     */
    toString(): string {
        return `AttitudeController:
  Target: ${this.targetOrientation.toString()}
  Error: ${this.lastError.toString()} (${(this.getErrorMagnitude() * 180 / Math.PI).toFixed(1)}°)
  Torque: ${this.lastTorque.toString()}
  Kp: ${this.Kp.toString()}, Kd: ${this.Kd.toString()}`;
    }
}