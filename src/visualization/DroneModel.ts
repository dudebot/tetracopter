import * as THREE from 'three';
import { TetraDrone } from '../physics/TetraDrone';
import { Vector3 } from '../math/vector3';

/**
 * Three.js visualization model for the tetrahedral drone
 */
export class DroneModel extends THREE.Group {
    private drone: TetraDrone;

    // Mesh components
    private motorMeshes: THREE.Mesh[] = [];
    private armLines!: THREE.LineSegments;
    private centerSphere!: THREE.Mesh;
    private thrustArrows: THREE.ArrowHelper[] = [];

    // Colors
    private readonly motorColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
    private readonly armColor = 0xcccccc;
    private readonly centerColor = 0xffffff;

    // Visualization options
    public showThrust = true;
    public showTrail = false;
    private trail: THREE.Points | null = null;
    private trailPositions!: Float32Array;
    private trailIndex = 0;
    private readonly maxTrailPoints = 500;

    constructor(drone: TetraDrone) {
        super();
        this.drone = drone;
        this.createGeometry();
        this.castShadow = true;
        this.receiveShadow = false;
    }

    private createGeometry(): void {
        const geometry = this.drone.getGeometry();

        // Create center sphere
        const centerGeometry = new THREE.SphereGeometry(0.05);
        const centerMaterial = new THREE.MeshPhongMaterial({
            color: this.centerColor,
            emissive: this.centerColor,
            emissiveIntensity: 0.2
        });
        this.centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
        this.centerSphere.castShadow = true;
        this.add(this.centerSphere);

        // Create motor spheres
        const motorGeometry = new THREE.ConeGeometry(0.1, 0.2, 8);
        motorGeometry.rotateX(Math.PI); // Point cones downward

        for (let i = 0; i < 4; i++) {
            const material = new THREE.MeshPhongMaterial({
                color: this.motorColors[i],
                emissive: this.motorColors[i],
                emissiveIntensity: 0.1
            });

            const mesh = new THREE.Mesh(motorGeometry, material);
            const pos = geometry.getMotorPosition(i);
            mesh.position.set(pos.x, pos.y, pos.z);
            mesh.castShadow = true;

            // Orient cone along thrust axis
            const axis = geometry.getThrustAxis(i);
            const up = new THREE.Vector3(0, 0, 1);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, new THREE.Vector3(axis.x, axis.y, axis.z));
            mesh.setRotationFromQuaternion(quaternion);

            this.motorMeshes.push(mesh);
            this.add(mesh);
        }

        // Create arm lines (tetrahedron edges)
        const edges = geometry.getEdges();
        const linePositions: number[] = [];

        for (const [i, j] of edges) {
            const p1 = geometry.getMotorPosition(i);
            const p2 = geometry.getMotorPosition(j);
            linePositions.push(p1.x, p1.y, p1.z);
            linePositions.push(p2.x, p2.y, p2.z);
        }

        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

        const lineMaterial = new THREE.LineBasicMaterial({
            color: this.armColor,
            linewidth: 2
        });

        this.armLines = new THREE.LineSegments(lineGeometry, lineMaterial);
        this.add(this.armLines);

        // Create thrust visualization arrows
        for (let i = 0; i < 4; i++) {
            const dir = new THREE.Vector3(0, 0, 1);
            const origin = new THREE.Vector3(0, 0, 0);
            const arrow = new THREE.ArrowHelper(dir, origin, 1, this.motorColors[i], 0.3, 0.2);
            arrow.visible = false;
            this.thrustArrows.push(arrow);
            this.add(arrow);
        }

        // Initialize trail
        this.initTrail();
    }

    private initTrail(): void {
        // Create trail point cloud
        this.trailPositions = new Float32Array(this.maxTrailPoints * 3);
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));

        const trailMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.05,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.6
        });

        this.trail = new THREE.Points(trailGeometry, trailMaterial);
        this.trail.visible = false;

        // Add to parent scene, not to drone group
        if (this.parent) {
            this.parent.add(this.trail);
        }
    }

    /**
     * Update the visual model from physics state
     */
    update(): void {
        const state = this.drone.state;

        // Update position
        this.position.set(
            state.position.x,
            state.position.y,
            state.position.z
        );

        // Update orientation
        const q = state.orientation;
        this.quaternion.set(q.x, q.y, q.z, q.w);

        // Update thrust arrows
        if (this.showThrust) {
            this.updateThrustArrows();
        }

        // Update trail
        if (this.showTrail && this.trail) {
            this.updateTrail();
        }

        // Update motor glow based on thrust
        this.updateMotorGlow();
    }

    private updateThrustArrows(): void {
        const geometry = this.drone.getGeometry();

        for (let i = 0; i < 4; i++) {
            const arrow = this.thrustArrows[i];
            const thrust = this.drone.state.motorThrusts[i];

            if (Math.abs(thrust) > 0.01) {
                const motorPos = geometry.getMotorPosition(i);
                const thrustAxis = geometry.getThrustAxis(i);

                // Position arrow at motor
                arrow.position.set(motorPos.x, motorPos.y, motorPos.z);

                // Set direction (opposite of thrust axis for visual clarity)
                const dir = new THREE.Vector3(
                    -thrustAxis.x * Math.sign(thrust),
                    -thrustAxis.y * Math.sign(thrust),
                    -thrustAxis.z * Math.sign(thrust)
                );
                arrow.setDirection(dir);

                // Set length proportional to thrust magnitude
                arrow.setLength(Math.abs(thrust) * 0.3, Math.abs(thrust) * 0.1, Math.abs(thrust) * 0.05);

                // Set color based on thrust direction
                arrow.setColor(thrust > 0 ? this.motorColors[i] : 0xff00ff);

                arrow.visible = true;
            } else {
                arrow.visible = false;
            }
        }
    }

    private updateMotorGlow(): void {
        for (let i = 0; i < 4; i++) {
            const thrust = Math.abs(this.drone.state.motorThrusts[i]);
            const material = this.motorMeshes[i].material as THREE.MeshPhongMaterial;

            // Update emissive intensity based on thrust
            material.emissiveIntensity = Math.min(0.1 + thrust * 0.1, 1.0);
        }
    }

    private updateTrail(): void {
        if (!this.trail) return;

        // Add current position to trail
        const pos = this.drone.state.position;
        const idx = this.trailIndex * 3;
        this.trailPositions[idx] = pos.x;
        this.trailPositions[idx + 1] = pos.y;
        this.trailPositions[idx + 2] = pos.z;

        // Update index
        this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;

        // Update geometry
        const geometry = this.trail.geometry;
        geometry.attributes.position.needsUpdate = true;
        geometry.computeBoundingSphere();

        this.trail.visible = true;
    }

    /**
     * Toggle thrust visualization
     */
    toggleThrust(): void {
        this.showThrust = !this.showThrust;
        this.thrustArrows.forEach(arrow => {
            arrow.visible = this.showThrust && arrow.visible;
        });
    }

    /**
     * Toggle trail visualization
     */
    toggleTrail(): void {
        this.showTrail = !this.showTrail;
        if (this.trail) {
            this.trail.visible = this.showTrail;
        }
    }

    /**
     * Clear trail
     */
    clearTrail(): void {
        this.trailPositions.fill(0);
        this.trailIndex = 0;
        if (this.trail) {
            this.trail.geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * Set motor color
     */
    setMotorColor(index: number, color: number): void {
        if (index >= 0 && index < 4) {
            const material = this.motorMeshes[index].material as THREE.MeshPhongMaterial;
            material.color.setHex(color);
            material.emissive.setHex(color);
        }
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        // Dispose geometries and materials
        this.motorMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });

        this.centerSphere.geometry.dispose();
        (this.centerSphere.material as THREE.Material).dispose();

        this.armLines.geometry.dispose();
        (this.armLines.material as THREE.Material).dispose();

        if (this.trail) {
            this.trail.geometry.dispose();
            (this.trail.material as THREE.Material).dispose();
            if (this.trail.parent) {
                this.trail.parent.remove(this.trail);
            }
        }

        // Remove from parent
        if (this.parent) {
            this.parent.remove(this);
        }
    }
}