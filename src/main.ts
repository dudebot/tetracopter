import { Scene } from './visualization/Scene';
import { DroneModel } from './visualization/DroneModel';
import { TetraDrone } from './physics/TetraDrone';
import { DroneState } from './physics/DroneState';
import { Vector3 } from './math/vector3';
import { Quaternion } from './math/quaternion';
import { AttitudeController } from './control/AttitudeController';
import { PositionController } from './control/PositionController';
import * as Constants from './physics/constants';

/**
 * Control mode enum
 */
enum ControlMode {
    MANUAL = 'manual',
    ATTITUDE = 'attitude',
    POSITION = 'position',
    HOVER = 'hover'
}

/**
 * Main application class
 */
class TetraCopterApp {
    private scene!: Scene;
    private drone!: TetraDrone;
    private droneModel!: DroneModel;

    // Controllers
    private attitudeController!: AttitudeController;
    private positionController!: PositionController;
    private controlMode: ControlMode = ControlMode.HOVER;  // Start in hover mode

    // Simulation state
    private isRunning = true;
    private isPaused = false;
    private lastTime = 0;
    private simulationTime = 0;
    private frameCount = 0;
    private fps = 0;
    private lastFpsUpdate = 0;

    // UI elements
    private uiElements!: {
        position: HTMLElement;
        velocity: HTMLElement;
        orientation: HTMLElement;
        angularVel: HTMLElement;
        motorSliders: HTMLInputElement[];
        motorValues: HTMLElement[];
    };

    // Motor control (for manual mode) - single input per motor
    private motorThrusts = [0, 0, 0, 0];

    constructor() {
        this.initPhysics();
        this.initControllers();
        this.initVisualization();
        this.initUI();
        this.initEventHandlers();
        this.animate();
    }

    private initPhysics(): void {
        // Create initial state (start 4m above ground)
        const initialState = new DroneState(
            new Vector3(0, 0, 4),
            Vector3.zero(),
            Quaternion.identity(),
            Vector3.zero()
        );

        // Create drone with default parameters
        this.drone = new TetraDrone(initialState);
    }

    private initControllers(): void {
        // Attitude controller - high damping to reduce oscillation
        this.attitudeController = new AttitudeController(
            new Vector3(4, 4, 4),   // Kp - proportional
            new Vector3(3, 3, 3)    // Kd - derivative (more damping!)
        );

        // Position controller - also more damping
        this.positionController = new PositionController(
            Constants.DRONE_MASS,
            new Vector3(3, 3, 5),   // Kp - position
            new Vector3(4, 4, 5)    // Kd - damping (higher than Kp for stability)
        );

        // Default target: hover at starting position
        this.positionController.setTargetPosition(new Vector3(0, 0, 3));
        this.attitudeController.setTargetOrientation(Quaternion.identity());
    }

    private initVisualization(): void {
        // Create Three.js scene
        this.scene = new Scene();

        // Create drone model
        this.droneModel = new DroneModel(this.drone);
        this.scene.add(this.droneModel);

        // Set camera to look at drone
        this.scene.setCameraTarget(0, 0, 2);
        this.scene.setCameraPosition(8, 8, 6);
    }

    private initUI(): void {
        this.uiElements = {
            position: document.getElementById('position')!,
            velocity: document.getElementById('velocity')!,
            orientation: document.getElementById('orientation')!,
            angularVel: document.getElementById('angularVel')!,
            motorSliders: [],
            motorValues: []
        };

        // Initialize motor controls
        for (let i = 1; i <= 4; i++) {
            const slider = document.getElementById(`motor${i}`) as HTMLInputElement;
            const value = document.getElementById(`motor${i}val`) as HTMLElement;

            this.uiElements.motorSliders.push(slider);
            this.uiElements.motorValues.push(value);

            // Add slider event listener
            slider.addEventListener('input', () => {
                const thrust = parseFloat(slider.value);
                this.motorThrusts[i - 1] = thrust;
                value.textContent = thrust.toFixed(1);

                // Only apply manual control in manual mode
                if (this.controlMode === ControlMode.MANUAL) {
                    this.drone.setMotorInputs(this.motorThrusts);
                }
            });
        }
    }

    private initEventHandlers(): void {
        // Reset button
        document.getElementById('resetBtn')?.addEventListener('click', () => {
            this.reset();
        });

        // Hover button - now enables PID hover mode
        document.getElementById('hoverBtn')?.addEventListener('click', () => {
            this.enableHoverMode();
        });

        // Spin button
        document.getElementById('spinBtn')?.addEventListener('click', () => {
            this.startSpin();
        });

        // Flip button - switch to manual
        document.getElementById('flipBtn')?.addEventListener('click', () => {
            this.setManualMode();
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case ' ':
                    this.isPaused = !this.isPaused;
                    break;
                case 'r':
                case 'R':
                    this.reset();
                    break;
                case 't':
                case 'T':
                    this.droneModel.toggleThrust();
                    break;
                case 'l':
                case 'L':
                    this.droneModel.toggleTrail();
                    break;
                case 'c':
                case 'C':
                    this.droneModel.clearTrail();
                    break;
                case 'h':
                case 'H':
                    this.enableHoverMode();
                    break;
                case 'm':
                case 'M':
                    this.setManualMode();
                    break;
                // Arrow keys to nudge target position
                case 'ArrowUp':
                    this.nudgeTarget(0.5, 0, 0);
                    break;
                case 'ArrowDown':
                    this.nudgeTarget(-0.5, 0, 0);
                    break;
                case 'ArrowLeft':
                    this.nudgeTarget(0, 0.5, 0);
                    break;
                case 'ArrowRight':
                    this.nudgeTarget(0, -0.5, 0);
                    break;
                case 'PageUp':
                    this.nudgeTarget(0, 0, 0.5);
                    break;
                case 'PageDown':
                    this.nudgeTarget(0, 0, -0.5);
                    break;
            }
        });
    }

    private animate(time: number = 0): void {
        if (!this.isRunning) return;

        requestAnimationFrame((t) => this.animate(t));

        // Calculate delta time
        const dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;
        this.lastTime = time;

        // Update FPS counter
        this.frameCount++;
        if (time - this.lastFpsUpdate > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = time;
        }

        // Update physics (multiple substeps for stability)
        if (!this.isPaused && dt > 0 && dt < 0.1) {
            const substeps = 10;  // More substeps for controller stability
            const subDt = Math.min(dt / substeps, Constants.MAX_TIME_STEP);

            for (let i = 0; i < substeps; i++) {
                // Run controller if not in manual mode
                if (this.controlMode !== ControlMode.MANUAL) {
                    this.runController();
                }

                this.drone.step(subDt);
                this.simulationTime += subDt;

                // Check for ground collision - clamp to ground instead of crashing
                if (this.drone.state.position.z < 0.1) {
                    this.drone.state.position.z = 0.1;
                    // Zero out downward velocity
                    if (this.drone.state.velocity.z < 0) {
                        this.drone.state.velocity.z = 0;
                    }
                }
            }
        }

        // Update visualization
        this.droneModel.update();
        this.updateUI();

        // Update camera to follow drone (optional)
        const dronePos = this.drone.state.position;
        if (dronePos.magnitude() > 20) {
            this.scene.setCameraTarget(dronePos.x, dronePos.y, dronePos.z);
        }

        // Render
        this.scene.update();
        this.scene.render();
    }

    /**
     * Run the active controller and apply motor commands
     */
    private runController(): void {
        const state = this.drone.state;

        if (this.controlMode === ControlMode.HOVER || this.controlMode === ControlMode.POSITION) {
            // Position control mode: compute desired force and orientation
            const desiredForceWorld = this.positionController.computeDesiredForce(state);
            const desiredForceBody = state.worldToBody(desiredForceWorld);

            // For this underactuated system, keep orientation upright (identity)
            // Don't try to tilt - the coupling makes it unstable
            this.attitudeController.setTargetOrientation(Quaternion.identity());

            // Attitude control: compute torque to reach desired orientation
            const desiredTorque = this.attitudeController.computeTorque(state);

            // Apply through allocation matrix (least-squares for underactuated)
            this.drone.setMotorInputsFromWrench(desiredForceBody, desiredTorque);

            // Update UI to show actual motor values
            this.updateMotorUI();

        } else if (this.controlMode === ControlMode.ATTITUDE) {
            // Attitude-only mode: fixed upward thrust + attitude control
            const hoverForce = Constants.DRONE_MASS * Math.abs(Constants.GRAVITY.z);
            const bodyForce = new Vector3(0, 0, hoverForce / Math.sqrt(3));

            const desiredTorque = this.attitudeController.computeTorque(state);

            this.drone.setMotorInputsFromWrench(bodyForce, desiredTorque);
            this.updateMotorUI();
        }
    }

    private updateMotorUI(): void {
        const thrusts = this.drone.state.motorThrusts;
        thrusts.forEach((thrust, i) => {
            this.uiElements.motorSliders[i].value = thrust.toString();
            this.uiElements.motorValues[i].textContent = thrust.toFixed(1);
        });
    }

    private updateUI(): void {
        const state = this.drone.state;

        // Update state display
        this.uiElements.position.textContent = `${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)}`;
        this.uiElements.velocity.textContent = `${state.velocity.x.toFixed(2)}, ${state.velocity.y.toFixed(2)}, ${state.velocity.z.toFixed(2)}`;
        this.uiElements.orientation.textContent = `${state.orientation.w.toFixed(2)}, ${state.orientation.x.toFixed(2)}, ${state.orientation.y.toFixed(2)}, ${state.orientation.z.toFixed(2)}`;
        this.uiElements.angularVel.textContent = `${state.angularVelocity.x.toFixed(2)}, ${state.angularVelocity.y.toFixed(2)}, ${state.angularVelocity.z.toFixed(2)}`;
    }

    private reset(): void {
        // Reset drone state
        this.drone.reset(
            new Vector3(0, 0, 3),
            Vector3.zero(),
            Quaternion.identity(),
            Vector3.zero()
        );

        // Stay in hover mode (more useful default)
        this.controlMode = ControlMode.HOVER;

        // Reset motor controls
        this.motorThrusts.fill(0);
        this.drone.setMotorInputs(this.motorThrusts);

        // Reset UI sliders
        this.uiElements.motorSliders.forEach((slider, i) => {
            slider.value = '0';
            this.uiElements.motorValues[i].textContent = '0.0';
        });

        // Reset controller targets
        this.positionController.setTargetPosition(new Vector3(0, 0, 3));
        this.attitudeController.setTargetOrientation(Quaternion.identity());

        // Clear trail
        this.droneModel.clearTrail();

        // Reset simulation time
        this.simulationTime = 0;
        this.isPaused = false;

        console.log('Reset - hover mode active');
    }

    private enableHoverMode(): void {
        // Set target to current position (or slightly above if near ground)
        const currentPos = this.drone.state.position;
        const targetZ = Math.max(currentPos.z, 1.0);
        this.positionController.setTargetPosition(new Vector3(currentPos.x, currentPos.y, targetZ));

        this.controlMode = ControlMode.HOVER;
        console.log(`Hover mode enabled. Target: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${targetZ.toFixed(2)})`);
    }

    private setManualMode(): void {
        this.controlMode = ControlMode.MANUAL;
        // Keep current motor values
        this.motorThrusts = [...this.drone.state.motorThrusts];
        console.log('Manual mode enabled');
    }

    private nudgeTarget(dx: number, dy: number, dz: number): void {
        if (this.controlMode === ControlMode.HOVER || this.controlMode === ControlMode.POSITION) {
            const current = this.positionController.getTargetPosition();
            const newTarget = new Vector3(
                current.x + dx,
                current.y + dy,
                Math.max(0.5, current.z + dz)  // Don't go below 0.5m
            );
            this.positionController.setTargetPosition(newTarget);
            console.log(`Target moved to: (${newTarget.x.toFixed(2)}, ${newTarget.y.toFixed(2)}, ${newTarget.z.toFixed(2)})`);
        }
    }

    private startSpin(): void {
        // Enable hover mode and give it a big angular velocity kick
        this.enableHoverMode();

        // Add significant angular velocity around body z-axis
        this.drone.state.angularVelocity.set(0, 0, 8.0);
        console.log('Spin! Angular velocity kick applied');
    }

    private startFlip(): void {
        // Do a flip! Give it angular velocity around x or y axis
        this.enableHoverMode();

        // Kick it to flip (around body x-axis)
        this.drone.state.angularVelocity.set(12.0, 0, 0);

        // Also give it a bit of upward velocity to have room for the flip
        this.drone.state.velocity.z += 3.0;

        console.log('Flip! Good luck little drone!');
    }

    private handleCrash(): void {
        console.log('Drone crashed! Press R to reset, or H for hover mode.');

        // Switch to manual and stop motors
        this.controlMode = ControlMode.MANUAL;
        this.motorThrusts.fill(0);
        this.drone.setMotorInputs(this.motorThrusts);

        // Pause simulation
        this.isPaused = true;
    }

    public destroy(): void {
        this.isRunning = false;
        this.droneModel.dispose();
        this.scene.dispose();
    }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TetraCopterApp();
    });
} else {
    new TetraCopterApp();
}