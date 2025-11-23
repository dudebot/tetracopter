import { Vector3 } from '../math/vector3';
import { Quaternion } from '../math/quaternion';
import { Matrix } from '../math/matrix';
import { DroneState } from './DroneState';
import { TetrahedronGeometry } from '../geometry/tetrahedron';
import { AllocationMatrix } from '../geometry/allocation';
import * as Constants from './constants';

/**
 * Main physics simulation class for the tetrahedral drone
 * Implements rigid body dynamics with gravity and motor forces/torques
 */
export class TetraDrone {
    // State
    public state: DroneState;

    // Geometry and allocation
    private geometry: TetrahedronGeometry;
    private allocation: AllocationMatrix;

    // Physical properties
    private mass: number;
    private inertia: Matrix;
    private inertiaInv: Matrix;

    // Forces and torques (for debugging/visualization)
    public lastBodyForce: Vector3 = Vector3.zero();
    public lastBodyTorque: Vector3 = Vector3.zero();
    public lastWorldForce: Vector3 = Vector3.zero();

    constructor(
        initialState?: DroneState,
        mass: number = Constants.DRONE_MASS,
        inertia?: Matrix,
        armLength: number = Constants.ARM_LENGTH
    ) {
        // Initialize state
        this.state = initialState || new DroneState(
            Constants.DEFAULT_INITIAL_POSITION.clone(),
            Constants.DEFAULT_INITIAL_VELOCITY.clone(),
            Quaternion.identity(),
            Constants.DEFAULT_INITIAL_ANGULAR_VEL.clone()
        );

        // Set physical properties
        this.mass = mass;
        this.inertia = inertia || Constants.DRONE_INERTIA;
        this.inertiaInv = this.inertia.inverse();

        // Initialize geometry and allocation
        this.geometry = new TetrahedronGeometry(armLength);
        this.allocation = new AllocationMatrix(this.geometry);
    }

    /**
     * Set motor inputs (single value per motor)
     */
    setMotorInputs(thrusts: number[]): void {
        this.state.setMotorInputs(thrusts);
    }

    /**
     * Set motor inputs from a desired wrench (least-squares for underactuated system)
     */
    setMotorInputsFromWrench(desiredForce: Vector3, desiredTorque: Vector3): boolean {
        const result = this.allocation.computeMotorInputs(desiredForce, desiredTorque);
        this.state.setMotorInputs(result.thrusts);
        return !result.saturated;
    }

    /**
     * Perform one physics integration step
     * @param dt Time step in seconds
     */
    step(dt: number): void {
        // Compute forces and torques from motors
        const { force: bodyForce, torque: bodyTorque } = this.computeMotorWrench();

        // Store for debugging
        this.lastBodyForce = bodyForce;
        this.lastBodyTorque = bodyTorque;

        // Convert body force to world frame
        const worldForce = this.state.bodyToWorld(bodyForce);

        // Add gravity (world frame)
        worldForce.addInPlace(Constants.GRAVITY.scale(this.mass));

        // Store for debugging
        this.lastWorldForce = worldForce;

        // Compute accelerations
        const linearAccel = worldForce.scale(1 / this.mass);
        const angularAccel = this.computeAngularAcceleration(bodyTorque);

        // Semi-implicit Euler integration
        // Update velocities first (implicit)
        this.state.velocity.addScaledInPlace(linearAccel, dt);
        this.state.angularVelocity.addScaledInPlace(angularAccel, dt);

        // Update positions (explicit)
        this.state.position.addScaledInPlace(this.state.velocity, dt);

        // Update orientation
        this.state.orientation.integrate(this.state.angularVelocity, dt);

        // Update time
        this.state.time += dt;
    }

    /**
     * Compute forces and torques from motor inputs
     */
    private computeMotorWrench(): { force: Vector3; torque: Vector3 } {
        return this.allocation.computeWrench(this.state.motorThrusts);
    }

    /**
     * Compute angular acceleration from torque
     * α = I^-1 * (τ - ω × (I * ω))
     */
    private computeAngularAcceleration(torque: Vector3): Vector3 {
        const omega = this.state.angularVelocity;

        // Compute I * ω
        const Iomega = new Vector3(
            this.inertia.data[0][0] * omega.x,
            this.inertia.data[1][1] * omega.y,
            this.inertia.data[2][2] * omega.z
        );

        // Compute ω × (I * ω)
        const gyroscopicTorque = omega.cross(Iomega);

        // Net torque: τ - ω × (I * ω)
        const netTorque = torque.subtract(gyroscopicTorque);

        // Angular acceleration: I^-1 * netTorque
        return new Vector3(
            this.inertiaInv.data[0][0] * netTorque.x,
            this.inertiaInv.data[1][1] * netTorque.y,
            this.inertiaInv.data[2][2] * netTorque.z
        );
    }

    /**
     * Reset the drone to a specific state
     */
    reset(
        position?: Vector3,
        velocity?: Vector3,
        orientation?: Quaternion,
        angularVelocity?: Vector3
    ): void {
        this.state.reset(
            position || Constants.DEFAULT_INITIAL_POSITION.clone(),
            velocity || Constants.DEFAULT_INITIAL_VELOCITY.clone(),
            orientation || Quaternion.identity(),
            angularVelocity || Constants.DEFAULT_INITIAL_ANGULAR_VEL.clone()
        );
    }

    /**
     * Apply an external force (world frame) for one time step
     */
    applyExternalForce(force: Vector3, dt: number): void {
        const accel = force.scale(1 / this.mass);
        this.state.velocity.addScaledInPlace(accel, dt);
    }

    /**
     * Apply an external torque (body frame) for one time step
     */
    applyExternalTorque(torque: Vector3, dt: number): void {
        const angAccel = this.computeAngularAcceleration(torque);
        this.state.angularVelocity.addScaledInPlace(angAccel, dt);
    }

    /**
     * Get total thrust magnitude
     */
    getTotalThrust(): number {
        return this.state.motorThrusts.reduce((sum, thrust) => sum + Math.abs(thrust), 0);
    }

    /**
     * Get center of mass position (same as position for point mass model)
     */
    getCenterOfMass(): Vector3 {
        return this.state.position.clone();
    }

    /**
     * Get motor positions in world frame
     */
    getMotorPositionsWorld(): Vector3[] {
        const R = this.state.getRotationMatrix();
        return this.geometry.getAllMotorPositions().map(pos => {
            const worldPos = pos.transform(R);
            worldPos.addInPlace(this.state.position);
            return worldPos;
        });
    }

    /**
     * Get thrust vectors in world frame (for visualization)
     */
    getThrustVectorsWorld(): Vector3[] {
        const R = this.state.getRotationMatrix();
        const thrustVectors: Vector3[] = [];

        for (let i = 0; i < 4; i++) {
            const thrustAxis = this.geometry.getThrustAxis(i);
            const thrustMag = this.state.motorThrusts[i];
            const thrustVec = thrustAxis.scale(thrustMag);
            thrustVectors.push(thrustVec.transform(R));
        }

        return thrustVectors;
    }

    /**
     * Get energy state
     */
    getEnergy(): { kinetic: number; potential: number; total: number } {
        const ke = this.state.getKineticEnergy(this.mass, this.inertia.data);
        const pe = this.state.getPotentialEnergy(this.mass, Math.abs(Constants.GRAVITY.z));
        return {
            kinetic: ke,
            potential: pe,
            total: ke + pe
        };
    }

    /**
     * Check if drone has crashed (hit ground)
     */
    hasCrashed(groundLevel: number = 0): boolean {
        return this.state.position.z <= groundLevel;
    }

    /**
     * Get geometry reference
     */
    getGeometry(): TetrahedronGeometry {
        return this.geometry;
    }

    /**
     * Get allocation matrix reference
     */
    getAllocation(): AllocationMatrix {
        return this.allocation;
    }

    /**
     * Debug info string
     */
    getDebugInfo(): string {
        const energy = this.getEnergy();
        return `${this.state.toString()}
  Total thrust: ${this.getTotalThrust().toFixed(2)} N
  Body force: ${this.lastBodyForce.toString()}
  Body torque: ${this.lastBodyTorque.toString()}
  World force: ${this.lastWorldForce.toString()}
  Energy: KE=${energy.kinetic.toFixed(2)} PE=${energy.potential.toFixed(2)} Total=${energy.total.toFixed(2)} J`;
    }
}