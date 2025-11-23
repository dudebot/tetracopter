/**
 * Quaternion class for 3D rotations
 * Convention: [w, x, y, z] where w is the scalar part
 * Represents rotation from body frame to world frame
 */
export class Quaternion {
    constructor(
        public w: number = 1,
        public x: number = 0,
        public y: number = 0,
        public z: number = 0
    ) {}

    /**
     * Create quaternion from array [w, x, y, z]
     */
    static fromArray(arr: number[]): Quaternion {
        return new Quaternion(arr[0], arr[1], arr[2], arr[3]);
    }

    /**
     * Create identity quaternion (no rotation)
     */
    static identity(): Quaternion {
        return new Quaternion(1, 0, 0, 0);
    }

    /**
     * Create quaternion from axis-angle representation
     */
    static fromAxisAngle(axis: { x: number; y: number; z: number }, angle: number): Quaternion {
        const halfAngle = angle / 2;
        const s = Math.sin(halfAngle);
        const norm = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
        if (norm < 1e-10) {
            return Quaternion.identity();
        }
        const invNorm = 1 / norm;
        return new Quaternion(
            Math.cos(halfAngle),
            axis.x * invNorm * s,
            axis.y * invNorm * s,
            axis.z * invNorm * s
        );
    }

    /**
     * Create quaternion from Euler angles (ZYX convention)
     */
    static fromEuler(roll: number, pitch: number, yaw: number): Quaternion {
        const cr = Math.cos(roll / 2);
        const sr = Math.sin(roll / 2);
        const cp = Math.cos(pitch / 2);
        const sp = Math.sin(pitch / 2);
        const cy = Math.cos(yaw / 2);
        const sy = Math.sin(yaw / 2);

        return new Quaternion(
            cr * cp * cy + sr * sp * sy,
            sr * cp * cy - cr * sp * sy,
            cr * sp * cy + sr * cp * sy,
            cr * cp * sy - sr * sp * cy
        );
    }

    /**
     * Clone this quaternion
     */
    clone(): Quaternion {
        return new Quaternion(this.w, this.x, this.y, this.z);
    }

    /**
     * Copy values from another quaternion
     */
    copy(q: Quaternion): this {
        this.w = q.w;
        this.x = q.x;
        this.y = q.y;
        this.z = q.z;
        return this;
    }

    /**
     * Set quaternion values
     */
    set(w: number, x: number, y: number, z: number): this {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /**
     * Get the magnitude (norm) of the quaternion
     */
    magnitude(): number {
        return Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * Normalize the quaternion to unit length
     */
    normalize(): this {
        const mag = this.magnitude();
        if (mag < 1e-10) {
            this.w = 1;
            this.x = 0;
            this.y = 0;
            this.z = 0;
        } else {
            const invMag = 1 / mag;
            this.w *= invMag;
            this.x *= invMag;
            this.y *= invMag;
            this.z *= invMag;
        }
        return this;
    }

    /**
     * Get normalized copy without modifying this quaternion
     */
    normalized(): Quaternion {
        return this.clone().normalize();
    }

    /**
     * Get the conjugate of this quaternion
     */
    conjugate(): Quaternion {
        return new Quaternion(this.w, -this.x, -this.y, -this.z);
    }

    /**
     * Quaternion multiplication: this ⊗ q
     * Result represents rotation by this followed by rotation by q
     */
    multiply(q: Quaternion): Quaternion {
        return new Quaternion(
            this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
            this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
            this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
            this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w
        );
    }

    /**
     * Multiply and store result in this quaternion
     */
    multiplyInPlace(q: Quaternion): this {
        const w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
        const x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
        const y = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
        const z = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;

        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /**
     * Convert quaternion to 3x3 rotation matrix (row-major)
     * Matrix transforms vectors from body to world frame: v_world = R * v_body
     */
    toRotationMatrix(): number[][] {
        const xx = this.x * this.x;
        const xy = this.x * this.y;
        const xz = this.x * this.z;
        const xw = this.x * this.w;

        const yy = this.y * this.y;
        const yz = this.y * this.z;
        const yw = this.y * this.w;

        const zz = this.z * this.z;
        const zw = this.z * this.w;

        return [
            [1 - 2 * (yy + zz), 2 * (xy - zw), 2 * (xz + yw)],
            [2 * (xy + zw), 1 - 2 * (xx + zz), 2 * (yz - xw)],
            [2 * (xz - yw), 2 * (yz + xw), 1 - 2 * (xx + yy)]
        ];
    }

    /**
     * Rotate a vector by this quaternion
     * v_world = q ⊗ v ⊗ q*
     */
    rotateVector(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
        // Convert vector to pure quaternion
        const vq = new Quaternion(0, v.x, v.y, v.z);

        // q ⊗ v ⊗ q*
        const result = this.multiply(vq).multiply(this.conjugate());

        return { x: result.x, y: result.y, z: result.z };
    }

    /**
     * Integrate quaternion using angular velocity (body frame)
     * q_dot = 0.5 * q ⊗ (0, ω)
     * @param omega Angular velocity in body frame [rad/s]
     * @param dt Time step [s]
     */
    integrate(omega: { x: number; y: number; z: number }, dt: number): this {
        // Create pure quaternion from angular velocity
        const omegaQ = new Quaternion(0, omega.x, omega.y, omega.z);

        // q_dot = 0.5 * q ⊗ omega_q
        const qDot = this.multiply(omegaQ);
        qDot.w *= 0.5;
        qDot.x *= 0.5;
        qDot.y *= 0.5;
        qDot.z *= 0.5;

        // Integrate: q = q + q_dot * dt
        this.w += qDot.w * dt;
        this.x += qDot.x * dt;
        this.y += qDot.y * dt;
        this.z += qDot.z * dt;

        // Renormalize to prevent drift
        this.normalize();

        return this;
    }

    /**
     * Compute orientation error between this and target quaternion
     * Error quaternion: q_err = q_target ⊗ q_current^*
     * Returns the vector part scaled by 2 (for use in PD control)
     */
    errorTo(target: Quaternion): { x: number; y: number; z: number } {
        // q_err = q_target ⊗ q_current^*
        const qErr = target.multiply(this.conjugate());

        // Ensure shortest path (if w < 0, negate quaternion)
        if (qErr.w < 0) {
            qErr.w = -qErr.w;
            qErr.x = -qErr.x;
            qErr.y = -qErr.y;
            qErr.z = -qErr.z;
        }

        // Extract error vector (2 * vector part for small angle approximation)
        return {
            x: 2 * qErr.x,
            y: 2 * qErr.y,
            z: 2 * qErr.z
        };
    }

    /**
     * Spherical linear interpolation between two quaternions
     */
    static slerp(q1: Quaternion, q2: Quaternion, t: number): Quaternion {
        let cosHalfTheta = q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;

        // Choose shorter path
        if (cosHalfTheta < 0) {
            q2 = new Quaternion(-q2.w, -q2.x, -q2.y, -q2.z);
            cosHalfTheta = -cosHalfTheta;
        }

        // If quaternions are close, use linear interpolation
        if (cosHalfTheta > 0.99) {
            const result = new Quaternion(
                q1.w * (1 - t) + q2.w * t,
                q1.x * (1 - t) + q2.x * t,
                q1.y * (1 - t) + q2.y * t,
                q1.z * (1 - t) + q2.z * t
            );
            return result.normalize();
        }

        // Standard slerp
        const halfTheta = Math.acos(cosHalfTheta);
        const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

        const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
        const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

        return new Quaternion(
            q1.w * ratioA + q2.w * ratioB,
            q1.x * ratioA + q2.x * ratioB,
            q1.y * ratioA + q2.y * ratioB,
            q1.z * ratioA + q2.z * ratioB
        );
    }

    /**
     * Convert to string representation
     */
    toString(): string {
        return `Quaternion(${this.w.toFixed(3)}, ${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
    }
}