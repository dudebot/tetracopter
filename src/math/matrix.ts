/**
 * Matrix operations for control allocation and physics
 */
export class Matrix {
    public data: number[][];
    public rows: number;
    public cols: number;

    constructor(rows: number, cols: number, data?: number[][]) {
        this.rows = rows;
        this.cols = cols;

        if (data) {
            if (data.length !== rows || (data[0] && data[0].length !== cols)) {
                throw new Error(`Invalid data dimensions for ${rows}x${cols} matrix`);
            }
            this.data = data.map(row => [...row]); // Deep copy
        } else {
            // Initialize with zeros
            this.data = Array(rows).fill(null).map(() => Array(cols).fill(0));
        }
    }

    /**
     * Create identity matrix
     */
    static identity(size: number): Matrix {
        const data = Array(size).fill(null).map(() => Array(size).fill(0));
        for (let i = 0; i < size; i++) {
            data[i][i] = 1;
        }
        return new Matrix(size, size, data);
    }

    /**
     * Create diagonal matrix from values
     */
    static diagonal(values: number[]): Matrix {
        const size = values.length;
        const data = Array(size).fill(null).map(() => Array(size).fill(0));
        for (let i = 0; i < size; i++) {
            data[i][i] = values[i];
        }
        return new Matrix(size, size, data);
    }

    /**
     * Create matrix from 1D array (column-major)
     */
    static fromArray(arr: number[], rows: number, cols: number): Matrix {
        const data: number[][] = [];
        let idx = 0;
        for (let i = 0; i < rows; i++) {
            data[i] = [];
            for (let j = 0; j < cols; j++) {
                data[i][j] = arr[idx++];
            }
        }
        return new Matrix(rows, cols, data);
    }

    /**
     * Get element at row i, column j
     */
    get(i: number, j: number): number {
        return this.data[i][j];
    }

    /**
     * Set element at row i, column j
     */
    set(i: number, j: number, value: number): void {
        this.data[i][j] = value;
    }

    /**
     * Clone this matrix
     */
    clone(): Matrix {
        return new Matrix(this.rows, this.cols, this.data);
    }

    /**
     * Add another matrix
     */
    add(m: Matrix): Matrix {
        if (this.rows !== m.rows || this.cols !== m.cols) {
            throw new Error('Matrix dimensions must match for addition');
        }
        const result = new Matrix(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                result.data[i][j] = this.data[i][j] + m.data[i][j];
            }
        }
        return result;
    }

    /**
     * Subtract another matrix
     */
    subtract(m: Matrix): Matrix {
        if (this.rows !== m.rows || this.cols !== m.cols) {
            throw new Error('Matrix dimensions must match for subtraction');
        }
        const result = new Matrix(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                result.data[i][j] = this.data[i][j] - m.data[i][j];
            }
        }
        return result;
    }

    /**
     * Multiply by scalar
     */
    scale(scalar: number): Matrix {
        const result = new Matrix(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                result.data[i][j] = this.data[i][j] * scalar;
            }
        }
        return result;
    }

    /**
     * Matrix multiplication
     */
    multiply(m: Matrix): Matrix {
        if (this.cols !== m.rows) {
            throw new Error(`Cannot multiply ${this.rows}x${this.cols} by ${m.rows}x${m.cols}`);
        }
        const result = new Matrix(this.rows, m.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < m.cols; j++) {
                let sum = 0;
                for (let k = 0; k < this.cols; k++) {
                    sum += this.data[i][k] * m.data[k][j];
                }
                result.data[i][j] = sum;
            }
        }
        return result;
    }

    /**
     * Multiply matrix by vector (as column vector)
     */
    multiplyVector(v: number[]): number[] {
        if (this.cols !== v.length) {
            throw new Error(`Cannot multiply ${this.rows}x${this.cols} matrix by vector of length ${v.length}`);
        }
        const result: number[] = [];
        for (let i = 0; i < this.rows; i++) {
            let sum = 0;
            for (let j = 0; j < this.cols; j++) {
                sum += this.data[i][j] * v[j];
            }
            result.push(sum);
        }
        return result;
    }

    /**
     * Get transpose of this matrix
     */
    transpose(): Matrix {
        const result = new Matrix(this.cols, this.rows);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                result.data[j][i] = this.data[i][j];
            }
        }
        return result;
    }

    /**
     * Compute the Moore-Penrose pseudoinverse
     * Handles rank-deficient matrices using regularization
     */
    pseudoinverse(tolerance: number = 1e-6): Matrix {
        // Use regularized pseudoinverse: A+ = A^T * (A * A^T + λI)^-1
        // This handles rank-deficient matrices by adding small regularization

        const lambda = tolerance;

        if (this.rows <= this.cols) {
            // A+ = A^T * (A * A^T + λI)^-1
            const AAt = this.multiply(this.transpose());
            // Add regularization
            for (let i = 0; i < AAt.rows; i++) {
                AAt.data[i][i] += lambda;
            }
            const AAtInv = AAt.inverse();
            return this.transpose().multiply(AAtInv);
        } else {
            // A+ = (A^T * A + λI)^-1 * A^T
            const AtA = this.transpose().multiply(this);
            // Add regularization
            for (let i = 0; i < AtA.rows; i++) {
                AtA.data[i][i] += lambda;
            }
            const AtAInv = AtA.inverse();
            return AtAInv.multiply(this.transpose());
        }
    }

    /**
     * Compute matrix inverse (only for square matrices)
     * Using Gauss-Jordan elimination
     */
    inverse(): Matrix {
        if (this.rows !== this.cols) {
            throw new Error('Only square matrices can be inverted');
        }

        const n = this.rows;
        // Create augmented matrix [A | I]
        const aug = new Matrix(n, 2 * n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                aug.data[i][j] = this.data[i][j];
                aug.data[i][j + n] = (i === j) ? 1 : 0;
            }
        }

        // Gauss-Jordan elimination
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(aug.data[k][i]) > Math.abs(aug.data[maxRow][i])) {
                    maxRow = k;
                }
            }

            // Swap rows
            [aug.data[i], aug.data[maxRow]] = [aug.data[maxRow], aug.data[i]];

            // Check for singular matrix
            if (Math.abs(aug.data[i][i]) < 1e-10) {
                throw new Error('Matrix is singular and cannot be inverted');
            }

            // Scale pivot row
            const pivot = aug.data[i][i];
            for (let j = 0; j < 2 * n; j++) {
                aug.data[i][j] /= pivot;
            }

            // Eliminate column
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug.data[k][i];
                    for (let j = 0; j < 2 * n; j++) {
                        aug.data[k][j] -= factor * aug.data[i][j];
                    }
                }
            }
        }

        // Extract inverse from augmented matrix
        const result = new Matrix(n, n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                result.data[i][j] = aug.data[i][j + n];
            }
        }

        return result;
    }

    /**
     * Get a column as a vector
     */
    getColumn(j: number): number[] {
        const col: number[] = [];
        for (let i = 0; i < this.rows; i++) {
            col.push(this.data[i][j]);
        }
        return col;
    }

    /**
     * Set a column from a vector
     */
    setColumn(j: number, values: number[]): void {
        if (values.length !== this.rows) {
            throw new Error(`Column must have ${this.rows} elements`);
        }
        for (let i = 0; i < this.rows; i++) {
            this.data[i][j] = values[i];
        }
    }

    /**
     * Convert to string for debugging
     */
    toString(): string {
        let str = `Matrix ${this.rows}x${this.cols}:\n`;
        for (let i = 0; i < this.rows; i++) {
            str += '[';
            for (let j = 0; j < this.cols; j++) {
                str += this.data[i][j].toFixed(3).padStart(8);
                if (j < this.cols - 1) str += ', ';
            }
            str += ']\n';
        }
        return str;
    }
}