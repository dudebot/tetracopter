import { Matrix } from '../math/matrix';
import { Vector3 } from '../math/vector3';
import { TetrahedronGeometry } from './tetrahedron';

/**
 * Motor allocation matrix for tetrahedral drone
 *
 * Each motor has a SINGLE scalar input u_i that creates:
 * - Force:  F_i = u_i * n_i  (along radial axis)
 * - Torque: τ_i = k * u_i * n_i  (reaction torque, same axis)
 *
 * This is an underactuated system (4 inputs, 6DOF output).
 * We use least-squares (pseudoinverse) to approximate desired wrenches.
 */
export class AllocationMatrix {
    private geometry: TetrahedronGeometry;
    private M!: Matrix;           // 6x4 allocation matrix
    private MPseudoInv!: Matrix;  // 4x6 pseudoinverse of M

    // Thrust-torque coupling constant
    // τ = k * u (torque per unit thrust)
    // Higher k = more torque authority for attitude control
    public k: number = 0.3;

    // Handedness array - determines motor spin directions
    // Symmetric [1,1,1,1]: all same direction, creates unavoidable yaw torque during hover
    // Alternating [1,-1,-1,1]: torque cancellation possible, more stable hover
    private handedness: number[] = [1, 1, 1, 1];

    // Motor limits
    public maxThrust: number = 15.0;      // Maximum thrust per motor (N)
    public minThrust: number = -15.0;     // Minimum thrust (reverse)

    constructor(geometry: TetrahedronGeometry, k: number = 0.1) {
        this.geometry = geometry;
        this.k = k;
        this.buildAllocationMatrix();
        this.computePseudoinverse();
    }

    /**
     * Build the 6x4 allocation matrix M
     * Maps u = [u1, u2, u3, u4]^T to w_b = [F_b; τ_b]
     *
     * Column i: [n_i; k * n_i]
     *
     * Handedness determines torque direction per motor:
     * - Symmetric [1,1,1,1]: unavoidable yaw torque during hover
     * - Alternating [1,-1,-1,1]: torque cancellation possible
     */
    private buildAllocationMatrix(): void {
        this.M = new Matrix(6, 4);

        for (let i = 0; i < 4; i++) {
            const n = this.geometry.getThrustAxis(i);
            const ki = this.k * this.handedness[i];

            // Top 3 rows: force contribution (n_i)
            this.M.set(0, i, n.x);
            this.M.set(1, i, n.y);
            this.M.set(2, i, n.z);

            // Bottom 3 rows: torque contribution (k_i * n_i)
            this.M.set(3, i, ki * n.x);
            this.M.set(4, i, ki * n.y);
            this.M.set(5, i, ki * n.z);
        }

        const handednessType = this.handedness.every(h => h === 1) ? 'SYMMETRIC' : 'ALTERNATING';
        console.log(`Allocation matrix M (6x4) with ${handednessType} handedness [${this.handedness.join(',')}]:`);
        console.log(this.M.toString());
    }

    /**
     * Compute the Moore-Penrose pseudoinverse of M
     * For underactuated system: u = M+ * w_desired gives least-squares solution
     */
    private computePseudoinverse(): void {
        this.MPseudoInv = this.M.pseudoinverse();
        console.log('Pseudoinverse M+ (4x6):');
        console.log(this.MPseudoInv.toString());
    }

    /**
     * Compute body-frame wrench from motor inputs
     * @param thrusts Array of 4 thrust values [u1, u2, u3, u4] in Newtons
     * @returns Object with force (Vector3) and torque (Vector3) in body frame
     */
    computeWrench(thrusts: number[]): { force: Vector3; torque: Vector3 } {
        if (thrusts.length !== 4) {
            throw new Error('Must provide exactly 4 thrust values');
        }

        // Compute wrench: w_b = M * u
        const wrench = this.M.multiplyVector(thrusts);

        return {
            force: new Vector3(wrench[0], wrench[1], wrench[2]),
            torque: new Vector3(wrench[3], wrench[4], wrench[5])
        };
    }

    /**
     * Compute motor inputs from desired body-frame wrench (least-squares)
     * @param desiredForce Desired force in body frame (Vector3)
     * @param desiredTorque Desired torque in body frame (Vector3)
     * @returns Object with thrust array and saturation flag
     */
    computeMotorInputs(
        desiredForce: Vector3,
        desiredTorque: Vector3
    ): {
        thrusts: number[];
        saturated: boolean;
        achievedForce: Vector3;
        achievedTorque: Vector3;
    } {
        // Construct desired wrench vector
        const wDesired = [
            desiredForce.x, desiredForce.y, desiredForce.z,
            desiredTorque.x, desiredTorque.y, desiredTorque.z
        ];

        // Compute motor inputs using pseudoinverse: u = M+ * w_desired
        // This gives least-squares best approximation for underactuated system
        const thrusts = this.MPseudoInv.multiplyVector(wDesired);

        // Apply saturation limits
        let saturated = false;
        for (let i = 0; i < 4; i++) {
            if (thrusts[i] > this.maxThrust) {
                thrusts[i] = this.maxThrust;
                saturated = true;
            } else if (thrusts[i] < this.minThrust) {
                thrusts[i] = this.minThrust;
                saturated = true;
            }
        }

        // Compute what wrench we actually achieve
        const achieved = this.computeWrench(thrusts);

        return {
            thrusts,
            saturated,
            achievedForce: achieved.force,
            achievedTorque: achieved.torque
        };
    }

    /**
     * Set the thrust-torque coupling constant
     */
    setK(k: number): void {
        this.k = k;
        this.buildAllocationMatrix();
        this.computePseudoinverse();
    }

    /**
     * Set motor limits
     */
    setMotorLimits(maxThrust: number, minThrust: number): void {
        this.maxThrust = maxThrust;
        this.minThrust = minThrust;
    }

    /**
     * Set the handedness configuration for motor torque directions.
     * @param symmetric If true, uses [1,1,1,1] (all same direction, creates yaw torque).
     *                  If false, uses [1,-1,-1,1] (alternating, allows torque cancellation).
     */
    setHandedness(symmetric: boolean): void {
        this.handedness = symmetric ? [1, 1, 1, 1] : [1, -1, -1, 1];
        this.buildAllocationMatrix();
        this.computePseudoinverse();
    }

    /**
     * Check if current handedness is symmetric
     */
    isSymmetricHandedness(): boolean {
        return this.handedness.every(h => h === 1);
    }

    /**
     * Get the allocation matrix
     */
    getAllocationMatrix(): Matrix {
        return this.M.clone();
    }

    /**
     * Get the pseudoinverse matrix
     */
    getPseudoinverse(): Matrix {
        return this.MPseudoInv.clone();
    }

    /**
     * Compute the expected yaw torque from a given set of motor thrusts.
     * With symmetric handedness, any net thrust produces a net yaw torque.
     * This is used to predict the spin rate for the spinning reference frame.
     */
    computeExpectedYawTorque(thrusts: number[]): number {
        const wrench = this.computeWrench(thrusts);
        // For a tetrahedral config with radial thrust axes,
        // the "yaw" is roughly the component along the body Z axis
        // But actually the torque is distributed - let's use the magnitude
        // projected onto the average thrust direction
        return wrench.torque.z;  // Simplified - actual yaw component
    }

    /**
     * Estimate the steady-state yaw rate for hover thrust.
     * τ = I * α, at steady state τ_external = damping * ω
     * Without damping, ω grows without bound.
     * Returns the torque magnitude that would be applied during hover.
     */
    getHoverYawTorque(hoverThrust: number): number {
        // During hover, all motors produce roughly equal thrust
        const perMotor = hoverThrust / 4;
        return this.computeExpectedYawTorque([perMotor, perMotor, perMotor, perMotor]);
    }

    /**
     * Debug string representation
     */
    toString(): string {
        let str = `Allocation Matrix (k=${this.k}):\n`;
        str += this.M.toString();
        str += `\nMotor limits: [${this.minThrust}, ${this.maxThrust}] N`;
        return str;
    }
}