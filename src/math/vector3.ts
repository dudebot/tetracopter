/**
 * 3D Vector class for physics calculations
 */
export class Vector3 {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public z: number = 0
    ) {}

    /**
     * Create vector from array [x, y, z]
     */
    static fromArray(arr: number[]): Vector3 {
        return new Vector3(arr[0], arr[1], arr[2]);
    }

    /**
     * Create zero vector
     */
    static zero(): Vector3 {
        return new Vector3(0, 0, 0);
    }

    /**
     * Clone this vector
     */
    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    /**
     * Copy values from another vector
     */
    copy(v: Vector3): this {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    /**
     * Set vector values
     */
    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /**
     * Add another vector
     */
    add(v: Vector3): Vector3 {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    /**
     * Add in place
     */
    addInPlace(v: Vector3): this {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    /**
     * Add scaled vector: this + v * scalar
     */
    addScaled(v: Vector3, scalar: number): Vector3 {
        return new Vector3(
            this.x + v.x * scalar,
            this.y + v.y * scalar,
            this.z + v.z * scalar
        );
    }

    /**
     * Add scaled vector in place
     */
    addScaledInPlace(v: Vector3, scalar: number): this {
        this.x += v.x * scalar;
        this.y += v.y * scalar;
        this.z += v.z * scalar;
        return this;
    }

    /**
     * Subtract another vector
     */
    subtract(v: Vector3): Vector3 {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    /**
     * Subtract in place
     */
    subtractInPlace(v: Vector3): this {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    /**
     * Multiply by scalar
     */
    scale(scalar: number): Vector3 {
        return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    /**
     * Multiply by scalar in place
     */
    scaleInPlace(scalar: number): this {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    /**
     * Dot product with another vector
     */
    dot(v: Vector3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    /**
     * Cross product with another vector
     */
    cross(v: Vector3): Vector3 {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    /**
     * Get the magnitude (length) of the vector
     */
    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * Get the squared magnitude (avoids sqrt)
     */
    magnitudeSquared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    /**
     * Normalize to unit length
     */
    normalize(): this {
        const mag = this.magnitude();
        if (mag > 1e-10) {
            const invMag = 1 / mag;
            this.x *= invMag;
            this.y *= invMag;
            this.z *= invMag;
        } else {
            this.x = 0;
            this.y = 0;
            this.z = 0;
        }
        return this;
    }

    /**
     * Get normalized copy without modifying this vector
     */
    normalized(): Vector3 {
        return this.clone().normalize();
    }

    /**
     * Negate the vector
     */
    negate(): Vector3 {
        return new Vector3(-this.x, -this.y, -this.z);
    }

    /**
     * Negate in place
     */
    negateInPlace(): this {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
        return this;
    }

    /**
     * Linear interpolation to another vector
     */
    lerp(v: Vector3, t: number): Vector3 {
        return new Vector3(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t,
            this.z + (v.z - this.z) * t
        );
    }

    /**
     * Transform by a 3x3 matrix (row-major)
     */
    transform(matrix: number[][]): Vector3 {
        return new Vector3(
            matrix[0][0] * this.x + matrix[0][1] * this.y + matrix[0][2] * this.z,
            matrix[1][0] * this.x + matrix[1][1] * this.y + matrix[1][2] * this.z,
            matrix[2][0] * this.x + matrix[2][1] * this.y + matrix[2][2] * this.z
        );
    }

    /**
     * Check if approximately equal to another vector
     */
    equals(v: Vector3, epsilon: number = 1e-10): boolean {
        return (
            Math.abs(this.x - v.x) < epsilon &&
            Math.abs(this.y - v.y) < epsilon &&
            Math.abs(this.z - v.z) < epsilon
        );
    }

    /**
     * Convert to array [x, y, z]
     */
    toArray(): number[] {
        return [this.x, this.y, this.z];
    }

    /**
     * Convert to string representation
     */
    toString(): string {
        return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
    }

    /**
     * Common unit vectors
     */
    static readonly UP = new Vector3(0, 0, 1);      // Z-up convention
    static readonly DOWN = new Vector3(0, 0, -1);
    static readonly FORWARD = new Vector3(1, 0, 0);
    static readonly BACKWARD = new Vector3(-1, 0, 0);
    static readonly RIGHT = new Vector3(0, 1, 0);
    static readonly LEFT = new Vector3(0, -1, 0);
}