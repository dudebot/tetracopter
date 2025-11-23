import { Vector3 } from '../math/vector3';
import { Quaternion } from '../math/quaternion';

/**
 * Complete state representation of the tetrahedral drone
 * Total state dimension: 13 (3 pos + 3 vel + 4 quat + 3 angular vel)
 */
export class DroneState {
    // Position in world frame (m)
    public position: Vector3;

    // Velocity in world frame (m/s)
    public velocity: Vector3;

    // Orientation quaternion (body → world rotation)
    public orientation: Quaternion;

    // Angular velocity in body frame (rad/s)
    public angularVelocity: Vector3;

    // Motor states (for tracking) - single input per motor
    public motorThrusts: number[] = [0, 0, 0, 0];

    // Time since simulation start
    public time: number = 0;

    constructor(
        position?: Vector3,
        velocity?: Vector3,
        orientation?: Quaternion,
        angularVelocity?: Vector3
    ) {
        this.position = position || Vector3.zero();
        this.velocity = velocity || Vector3.zero();
        this.orientation = orientation || Quaternion.identity();
        this.angularVelocity = angularVelocity || Vector3.zero();
    }

    /**
     * Create state from arrays (useful for serialization)
     */
    static fromArrays(
        pos: number[],
        vel: number[],
        quat: number[],
        omega: number[]
    ): DroneState {
        return new DroneState(
            Vector3.fromArray(pos),
            Vector3.fromArray(vel),
            Quaternion.fromArray(quat),
            Vector3.fromArray(omega)
        );
    }

    /**
     * Clone the current state
     */
    clone(): DroneState {
        const state = new DroneState(
            this.position.clone(),
            this.velocity.clone(),
            this.orientation.clone(),
            this.angularVelocity.clone()
        );
        state.motorThrusts = [...this.motorThrusts];
        state.time = this.time;
        return state;
    }

    /**
     * Copy values from another state
     */
    copy(other: DroneState): this {
        this.position.copy(other.position);
        this.velocity.copy(other.velocity);
        this.orientation.copy(other.orientation);
        this.angularVelocity.copy(other.angularVelocity);
        this.motorThrusts = [...other.motorThrusts];
        this.time = other.time;
        return this;
    }

    /**
     * Reset to initial state
     */
    reset(
        position: Vector3 = Vector3.zero(),
        velocity: Vector3 = Vector3.zero(),
        orientation: Quaternion = Quaternion.identity(),
        angularVelocity: Vector3 = Vector3.zero()
    ): void {
        this.position.copy(position);
        this.velocity.copy(velocity);
        this.orientation.copy(orientation);
        this.angularVelocity.copy(angularVelocity);
        this.motorThrusts.fill(0);
        this.time = 0;
    }

    /**
     * Set motor inputs (single value per motor)
     */
    setMotorInputs(thrusts: number[]): void {
        if (thrusts.length !== 4) {
            throw new Error('Must provide exactly 4 thrust values');
        }
        this.motorThrusts = [...thrusts];
    }

    /**
     * Get the rotation matrix from body to world frame
     */
    getRotationMatrix(): number[][] {
        return this.orientation.toRotationMatrix();
    }

    /**
     * Transform a vector from body frame to world frame
     */
    bodyToWorld(vectorBody: Vector3): Vector3 {
        const rotated = this.orientation.rotateVector(vectorBody);
        return new Vector3(rotated.x, rotated.y, rotated.z);
    }

    /**
     * Transform a vector from world frame to body frame
     */
    worldToBody(vectorWorld: Vector3): Vector3 {
        const rotated = this.orientation.conjugate().rotateVector(vectorWorld);
        return new Vector3(rotated.x, rotated.y, rotated.z);
    }

    /**
     * Get altitude (z-position in world frame)
     */
    getAltitude(): number {
        return this.position.z;
    }

    /**
     * Get speed (magnitude of velocity)
     */
    getSpeed(): number {
        return this.velocity.magnitude();
    }

    /**
     * Get angular speed (magnitude of angular velocity)
     */
    getAngularSpeed(): number {
        return this.angularVelocity.magnitude();
    }

    /**
     * Get Euler angles (roll, pitch, yaw) from quaternion
     * Note: This can have singularities, use carefully
     */
    getEulerAngles(): { roll: number; pitch: number; yaw: number } {
        const q = this.orientation;
        const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
        const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);

        const sinp = 2 * (q.w * q.y - q.z * q.x);
        const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

        const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
        const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);

        return { roll, pitch, yaw };
    }

    /**
     * Get kinetic energy (translational + rotational)
     */
    getKineticEnergy(mass: number, inertia: number[][]): number {
        // Translational KE: 0.5 * m * v²
        const transKE = 0.5 * mass * this.velocity.magnitudeSquared();

        // Rotational KE: 0.5 * ω^T * I * ω
        const omega = this.angularVelocity;
        const Iω = [
            inertia[0][0] * omega.x + inertia[0][1] * omega.y + inertia[0][2] * omega.z,
            inertia[1][0] * omega.x + inertia[1][1] * omega.y + inertia[1][2] * omega.z,
            inertia[2][0] * omega.x + inertia[2][1] * omega.y + inertia[2][2] * omega.z
        ];
        const rotKE = 0.5 * (omega.x * Iω[0] + omega.y * Iω[1] + omega.z * Iω[2]);

        return transKE + rotKE;
    }

    /**
     * Get potential energy (gravitational)
     */
    getPotentialEnergy(mass: number, g: number = 9.81): number {
        return mass * g * this.position.z;
    }

    /**
     * Export state to arrays (for serialization/logging)
     */
    toArrays(): {
        position: number[];
        velocity: number[];
        orientation: number[];
        angularVelocity: number[];
        motorThrusts: number[];
        time: number;
    } {
        return {
            position: this.position.toArray(),
            velocity: this.velocity.toArray(),
            orientation: [this.orientation.w, this.orientation.x, this.orientation.y, this.orientation.z],
            angularVelocity: this.angularVelocity.toArray(),
            motorThrusts: [...this.motorThrusts],
            time: this.time
        };
    }

    /**
     * Debug string representation
     */
    toString(): string {
        const euler = this.getEulerAngles();
        return `DroneState(t=${this.time.toFixed(3)}s):
  Position: ${this.position.toString()}
  Velocity: ${this.velocity.toString()} (speed: ${this.getSpeed().toFixed(2)} m/s)
  Orientation: ${this.orientation.toString()}
  Euler angles: roll=${(euler.roll * 180/Math.PI).toFixed(1)}°, pitch=${(euler.pitch * 180/Math.PI).toFixed(1)}°, yaw=${(euler.yaw * 180/Math.PI).toFixed(1)}°
  Angular vel: ${this.angularVelocity.toString()} (${this.getAngularSpeed().toFixed(2)} rad/s)
  Motors: [${this.motorThrusts.map(t => t.toFixed(2)).join(', ')}] N`;
    }
}