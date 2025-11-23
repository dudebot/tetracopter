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
 *
 * SPINNING_HOVER: Symmetric handedness [1,1,1,1], accepts spin, attitude+position control
 * POSITION_ATTITUDE: Symmetric handedness, position-only control, lets attitude evolve
 * ALTERNATING_HOVER: Alternating handedness [1,-1,-1,1], full attitude+position control (stable, oscillatory)
 */
enum ControlMode {
    MANUAL = 'manual',
    ATTITUDE = 'attitude',
    POSITION = 'position',
    HOVER = 'hover',
    SPINNING_HOVER = 'spinning_hover',      // Symmetric handedness, accepts spin
    POSITION_ATTITUDE = 'position_attitude', // Symmetric handedness, position-only (was ORBIT_HOVER)
    ALTERNATING_HOVER = 'alternating_hover'  // Alternating handedness, full control
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
    private controlMode: ControlMode = ControlMode.SPINNING_HOVER;  // Start in spinning hover mode

    // Spinning reference frame tracking
    private spinningReferenceAngle: number = 0;  // Current angle of the spinning reference
    private estimatedSpinRate: number = 0;       // Estimated spin rate from thrust

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
        modeIndicator: HTMLElement;
        hoverBtn: HTMLElement;
        manualBtn: HTMLElement;
        posAttBtn: HTMLElement;
    };

    // Motor control - single input per motor
    private motorThrusts = [0, 0, 0, 0];

    // Track if user is currently dragging a slider
    private sliderBeingDragged: number | null = null;

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
            motorValues: [],
            modeIndicator: document.getElementById('currentMode')!,
            hoverBtn: document.getElementById('hoverBtn')!,
            manualBtn: document.getElementById('manualBtn')!,
            posAttBtn: document.getElementById('posAttBtn')!
        };

        // Initialize motor controls
        for (let i = 1; i <= 4; i++) {
            const slider = document.getElementById(`motor${i}`) as HTMLInputElement;
            const value = document.getElementById(`motor${i}val`) as HTMLElement;
            const motorIndex = i - 1;

            this.uiElements.motorSliders.push(slider);
            this.uiElements.motorValues.push(value);

            // Track when user starts dragging
            slider.addEventListener('mousedown', () => {
                this.sliderBeingDragged = motorIndex;
            });

            slider.addEventListener('touchstart', () => {
                this.sliderBeingDragged = motorIndex;
            });

            // Track when user stops dragging
            slider.addEventListener('mouseup', () => {
                this.sliderBeingDragged = null;
            });

            slider.addEventListener('touchend', () => {
                this.sliderBeingDragged = null;
            });

            // Apply slider value while dragging
            slider.addEventListener('input', () => {
                const thrust = parseFloat(slider.value);
                this.motorThrusts[motorIndex] = thrust;
                value.textContent = thrust.toFixed(1);

                // Always apply motor input when user drags (override controller momentarily)
                this.drone.setMotorInputs(this.motorThrusts);
            });
        }

        // Also handle mouse leaving the slider while dragging
        document.addEventListener('mouseup', () => {
            this.sliderBeingDragged = null;
        });
    }

    private initEventHandlers(): void {
        // Reset button
        document.getElementById('resetBtn')?.addEventListener('click', () => {
            this.reset();
        });

        // Hover button
        document.getElementById('hoverBtn')?.addEventListener('click', () => {
            this.enableHoverMode();
        });

        // Manual button - now "Stable" mode with alternating handedness
        document.getElementById('manualBtn')?.addEventListener('click', () => {
            this.enableAlternatingMode();
        });

        // Position+Attitude button (was Orbit)
        document.getElementById('posAttBtn')?.addEventListener('click', () => {
            this.enablePositionAttitudeMode();
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
                case 's':
                case 'S':
                    this.enableAlternatingMode();
                    break;
                case 'p':
                case 'P':
                    this.enablePositionAttitudeMode();
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
        // If user is dragging a slider, don't run controller (let them override)
        if (this.sliderBeingDragged !== null) {
            return;
        }

        const state = this.drone.state;

        if (this.controlMode === ControlMode.SPINNING_HOVER) {
            // SPINNING HOVER MODE: Accept the spin, track a rotating reference frame

            // Position control: compute desired force
            const desiredForceWorld = this.positionController.computeDesiredForce(state);
            const desiredForceBody = state.worldToBody(desiredForceWorld);

            // Estimate the yaw torque that will be induced by current thrust
            // With symmetric handedness, thrust creates unavoidable yaw torque
            const allocation = this.drone.getAllocation();
            const totalThrust = desiredForceBody.magnitude();
            const yawTorque = allocation.getHoverYawTorque(totalThrust);

            // Estimate spin rate: τ = I * dω/dt
            // At quasi-steady state, integrate to track accumulated spin
            const Izz = Constants.DRONE_INERTIA.get(2, 2);
            const angularAccel = yawTorque / Izz;

            // Instead of fighting the spin, track the actual current yaw
            // The target orientation should match the drone's current yaw, but keep upright
            const currentEuler = state.getEulerAngles();

            // Target: upright (roll=0, pitch=0) but match current yaw
            // This way we're not fighting the yaw, only stabilizing roll/pitch
            const targetOrientation = Quaternion.fromEuler(0, 0, currentEuler.yaw);
            this.attitudeController.setTargetOrientation(targetOrientation);

            // Attitude control: compute torque to stabilize roll/pitch only
            const desiredTorque = this.attitudeController.computeTorque(state);

            // Zero out yaw torque request - we're accepting whatever yaw happens
            desiredTorque.z = 0;

            // Apply through allocation matrix
            this.drone.setMotorInputsFromWrench(desiredForceBody, desiredTorque);
            this.updateMotorUI();

        } else if (this.controlMode === ControlMode.HOVER || this.controlMode === ControlMode.POSITION) {
            // Original hover mode (will be unstable with symmetric handedness)
            const desiredForceWorld = this.positionController.computeDesiredForce(state);
            const desiredForceBody = state.worldToBody(desiredForceWorld);

            this.attitudeController.setTargetOrientation(Quaternion.identity());
            const desiredTorque = this.attitudeController.computeTorque(state);

            this.drone.setMotorInputsFromWrench(desiredForceBody, desiredTorque);
            this.updateMotorUI();

        } else if (this.controlMode === ControlMode.ATTITUDE) {
            // Attitude-only mode: fixed upward thrust + attitude control
            const hoverForce = Constants.DRONE_MASS * Math.abs(Constants.GRAVITY.z);
            const bodyForce = new Vector3(0, 0, hoverForce / Math.sqrt(3));

            const desiredTorque = this.attitudeController.computeTorque(state);

            this.drone.setMotorInputsFromWrench(bodyForce, desiredTorque);
            this.updateMotorUI();

        } else if (this.controlMode === ControlMode.POSITION_ATTITUDE) {
            // POSITION+ATTITUDE MODE: Position-only control, let attitude evolve naturally
            // With symmetric handedness, any force creates torque - we just accept it
            // This should create the "orbit dance" as position and attitude interact

            // Position control (world frame) - same as spinning hover
            const desiredForceWorld = this.positionController.computeDesiredForce(state);
            const desiredForceBody = state.worldToBody(desiredForceWorld);

            // DON'T try to control attitude at all - let the coupled torque do what it will
            // The torque will be τ = k * F (from the allocation matrix)
            // Request zero torque - the allocation will give us what it can
            const zeroTorque = Vector3.zero();

            this.drone.setMotorInputsFromWrench(desiredForceBody, zeroTorque);
            this.updateMotorUI();

        } else if (this.controlMode === ControlMode.ALTERNATING_HOVER) {
            // ALTERNATING HOVER MODE: Full position + attitude control with alternating handedness
            // With alternating [1,-1,-1,1] handedness, torque can cancel out during hover
            // This gives more stable, oscillatory behavior

            // Position control
            const desiredForceWorld = this.positionController.computeDesiredForce(state);
            const desiredForceBody = state.worldToBody(desiredForceWorld);

            // Full attitude control - try to maintain upright orientation
            this.attitudeController.setTargetOrientation(Quaternion.identity());
            const desiredTorque = this.attitudeController.computeTorque(state);

            this.drone.setMotorInputsFromWrench(desiredForceBody, desiredTorque);
            this.updateMotorUI();
        }
    }

    private updateMotorUI(): void {
        const thrusts = this.drone.state.motorThrusts;
        thrusts.forEach((thrust, i) => {
            // Don't update slider if user is currently dragging it
            if (this.sliderBeingDragged !== i) {
                this.uiElements.motorSliders[i].value = thrust.toString();
                this.uiElements.motorValues[i].textContent = thrust.toFixed(1);
            }
        });
    }

    private updateModeUI(): void {
        // Update mode indicator text
        const modeNames: Record<ControlMode, string> = {
            [ControlMode.MANUAL]: 'Manual',
            [ControlMode.ATTITUDE]: 'Attitude',
            [ControlMode.POSITION]: 'Position',
            [ControlMode.HOVER]: 'Hover',
            [ControlMode.SPINNING_HOVER]: 'Hover',
            [ControlMode.POSITION_ATTITUDE]: 'Pos+Att',
            [ControlMode.ALTERNATING_HOVER]: 'Stable'
        };
        this.uiElements.modeIndicator.textContent = modeNames[this.controlMode];

        // Update button active states
        const isHoverMode = this.controlMode === ControlMode.HOVER ||
                           this.controlMode === ControlMode.SPINNING_HOVER ||
                           this.controlMode === ControlMode.POSITION;
        const isAlternatingMode = this.controlMode === ControlMode.ALTERNATING_HOVER;
        const isPosAttMode = this.controlMode === ControlMode.POSITION_ATTITUDE;

        this.uiElements.hoverBtn.classList.toggle('active', isHoverMode);
        this.uiElements.manualBtn.classList.toggle('active', isAlternatingMode);
        this.uiElements.posAttBtn.classList.toggle('active', isPosAttMode);
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
        // Reset drone state (position, velocity, orientation, angular velocity)
        this.drone.reset(
            new Vector3(0, 0, 3),
            Vector3.zero(),
            Quaternion.identity(),
            Vector3.zero()
        );

        // Reset spinning reference tracking
        this.spinningReferenceAngle = 0;
        this.estimatedSpinRate = 0;

        // Reset motor values
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

        // Keep current mode, don't change it
        console.log('Reset - physics state cleared');
    }

    private enableHoverMode(): void {
        // HOVER MODE: Symmetric handedness, accepts spin
        // Set symmetric handedness [1,1,1,1]
        this.drone.getAllocation().setHandedness(true);

        // Set target to current position (or slightly above if near ground)
        const currentPos = this.drone.state.position;
        const targetZ = Math.max(currentPos.z, 1.0);
        this.positionController.setTargetPosition(new Vector3(currentPos.x, currentPos.y, targetZ));

        this.controlMode = ControlMode.SPINNING_HOVER;
        this.updateModeUI();
        console.log(`Hover mode (symmetric handedness, spin-accepting). Target: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${targetZ.toFixed(2)})`);
    }

    private enableAlternatingMode(): void {
        // STABLE/ALTERNATING MODE: Alternating handedness, full attitude+position control
        // Set alternating handedness [1,-1,-1,1]
        this.drone.getAllocation().setHandedness(false);

        // Set target to current position (or slightly above if near ground)
        const currentPos = this.drone.state.position;
        const targetZ = Math.max(currentPos.z, 1.0);
        this.positionController.setTargetPosition(new Vector3(currentPos.x, currentPos.y, targetZ));

        // Set target orientation to identity (upright)
        this.attitudeController.setTargetOrientation(Quaternion.identity());

        this.controlMode = ControlMode.ALTERNATING_HOVER;
        this.updateModeUI();
        console.log(`Stable mode (alternating handedness, full control). Target: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${targetZ.toFixed(2)})`);
    }

    private enablePositionAttitudeMode(): void {
        // POSITION+ATTITUDE MODE: Symmetric handedness, position-only control
        // Set symmetric handedness [1,1,1,1]
        this.drone.getAllocation().setHandedness(true);

        // Set target to current position (or slightly above if near ground)
        const currentPos = this.drone.state.position;
        const targetZ = Math.max(currentPos.z, 1.0);
        this.positionController.setTargetPosition(new Vector3(currentPos.x, currentPos.y, targetZ));

        // Set target orientation to identity (upright)
        this.attitudeController.setTargetOrientation(Quaternion.identity());

        this.controlMode = ControlMode.POSITION_ATTITUDE;
        this.updateModeUI();
        console.log(`Pos+Att mode (symmetric handedness, position-only). Target: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${targetZ.toFixed(2)})`);
    }

    private nudgeTarget(dx: number, dy: number, dz: number): void {
        if (this.controlMode === ControlMode.HOVER ||
            this.controlMode === ControlMode.POSITION ||
            this.controlMode === ControlMode.SPINNING_HOVER ||
            this.controlMode === ControlMode.POSITION_ATTITUDE ||
            this.controlMode === ControlMode.ALTERNATING_HOVER) {
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