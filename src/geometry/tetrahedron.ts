import { Vector3 } from '../math/vector3';

/**
 * Tetrahedral geometry configuration
 * Defines motor positions and thrust axes for a regular tetrahedron
 */
export class TetrahedronGeometry {
    public readonly L: number;
    public readonly motorPositions: Vector3[];
    public readonly thrustAxes: Vector3[];
    public readonly numMotors = 4;

    constructor(armLength: number = 1.0) {
        this.L = armLength;

        // Define motor positions in body frame
        // Regular tetrahedron vertices
        this.motorPositions = [
            new Vector3( this.L,  this.L,  this.L),  // Motor 1 (r1)
            new Vector3( this.L, -this.L, -this.L),  // Motor 2 (r2)
            new Vector3(-this.L,  this.L, -this.L),  // Motor 3 (r3)
            new Vector3(-this.L, -this.L,  this.L)   // Motor 4 (r4)
        ];

        // Compute thrust axes (radially outward from center)
        // n_i = normalize(r_i)
        this.thrustAxes = this.motorPositions.map(pos => pos.normalized());
    }

    /**
     * Get motor position by index (0-3)
     */
    getMotorPosition(index: number): Vector3 {
        if (index < 0 || index >= this.numMotors) {
            throw new Error(`Invalid motor index: ${index}`);
        }
        return this.motorPositions[index].clone();
    }

    /**
     * Get thrust axis by index (0-3)
     */
    getThrustAxis(index: number): Vector3 {
        if (index < 0 || index >= this.numMotors) {
            throw new Error(`Invalid motor index: ${index}`);
        }
        return this.thrustAxes[index].clone();
    }

    /**
     * Compute torque arm for a motor (r_i × n_i)
     */
    getTorqueArm(index: number): Vector3 {
        const r = this.getMotorPosition(index);
        const n = this.getThrustAxis(index);
        return r.cross(n);
    }

    /**
     * Get all motor positions as an array
     */
    getAllMotorPositions(): Vector3[] {
        return this.motorPositions.map(pos => pos.clone());
    }

    /**
     * Get all thrust axes as an array
     */
    getAllThrustAxes(): Vector3[] {
        return this.thrustAxes.map(axis => axis.clone());
    }

    /**
     * Compute center of mass (should be at origin for symmetric tetrahedron)
     */
    getCenterOfMass(): Vector3 {
        const sum = new Vector3();
        for (const pos of this.motorPositions) {
            sum.addInPlace(pos);
        }
        return sum.scale(1 / this.numMotors);
    }

    /**
     * Get the radius of the circumsphere (distance from center to vertices)
     */
    getCircumradius(): number {
        return this.motorPositions[0].magnitude();
    }

    /**
     * Get edges of tetrahedron for visualization
     * Returns pairs of motor indices that form edges
     */
    getEdges(): [number, number][] {
        return [
            [0, 1], [0, 2], [0, 3],  // Edges from motor 1
            [1, 2], [1, 3],          // Edges from motor 2
            [2, 3]                   // Edge between motors 3 and 4
        ];
    }

    /**
     * Get faces of tetrahedron for visualization
     * Returns triplets of motor indices that form triangular faces
     */
    getFaces(): [number, number, number][] {
        return [
            [0, 1, 2],  // Face 1
            [0, 1, 3],  // Face 2
            [0, 2, 3],  // Face 3
            [1, 2, 3]   // Face 4
        ];
    }

    /**
     * Check if geometry is valid (motors not at origin, axes normalized)
     */
    isValid(): boolean {
        for (let i = 0; i < this.numMotors; i++) {
            // Check motor position is not at origin
            if (this.motorPositions[i].magnitude() < 1e-6) {
                return false;
            }

            // Check thrust axis is normalized
            const axisNorm = this.thrustAxes[i].magnitude();
            if (Math.abs(axisNorm - 1.0) > 1e-6) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get debug string representation
     */
    toString(): string {
        let str = `TetrahedronGeometry (L=${this.L}):\n`;
        for (let i = 0; i < this.numMotors; i++) {
            str += `  Motor ${i + 1}:\n`;
            str += `    Position: ${this.motorPositions[i].toString()}\n`;
            str += `    Thrust axis: ${this.thrustAxes[i].toString()}\n`;
        }
        str += `  Center of mass: ${this.getCenterOfMass().toString()}\n`;
        str += `  Circumradius: ${this.getCircumradius().toFixed(3)}`;
        return str;
    }
}