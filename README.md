# Tetracopter

A physics simulator for a tetrahedral multirotor drone with 4 motors positioned at the vertices of a tetrahedron.

**[Live Demo](https://dudebot.github.io/tetracopter/)**

## Overview

Tetracopter simulates a unique drone configuration where motors are mounted at the four vertices of a tetrahedron, with thrust axes pointing radially outward from the center. This creates interesting control challenges due to the coupling between thrust and reaction torque.

### Key Physics

- **Radial thrust axes**: Each motor's thrust vector points outward from the tetrahedron's center
- **Coupled thrust and torque**: Reaction torque is generated along the same axis as thrust (tau = k * F)
- **Underactuated system**: 4 motor inputs controlling 6 degrees of freedom
- **Motor allocation**: Uses pseudoinverse of a 6x4 allocation matrix for least-squares control

### The Control Challenge

With symmetric motor handedness (all motors spinning the same direction), any net thrust produces an unavoidable yaw torque. This means:

- The drone cannot hover without spinning
- Attitude and position control are fundamentally coupled
- Different control strategies are needed depending on the goal

## Control Modes

### 1. Hover (Symmetric Handedness [1,1,1,1])

Uses symmetric motor handedness where all motors spin in the same direction. The controller:
- Stabilizes roll and pitch to maintain position
- Accepts the unavoidable yaw spin
- Tracks the spinning reference frame for attitude control

The drone will spin up while hovering but maintains its target position. This demonstrates the fundamental thrust-torque coupling.

### 2. Pos+Att (Symmetric Handedness)

Position-only control with symmetric handedness:
- Controls position through force commands
- Lets attitude evolve freely (no torque commands)
- Shows unconstrained dynamics and the natural "orbit dance" behavior
- The coupled torque from thrust causes interesting rotational dynamics

### 3. Stable (Alternating Handedness [1,-1,-1,1])

Uses alternating motor handedness where adjacent motors spin in opposite directions:
- Enables torque cancellation during hover
- Full attitude + position control is possible
- More stable but may exhibit oscillatory behavior
- Demonstrates how handedness configuration affects controllability

## Controls

### Buttons

| Button | Action |
|--------|--------|
| Reset | Reset drone to initial position and orientation |
| Hover | Enable spinning hover mode (symmetric handedness) |
| Pos+Att | Enable position-only control (symmetric handedness) |
| Stable | Enable stable mode (alternating handedness) |

### Keyboard

| Key | Action |
|-----|--------|
| R | Reset simulation |
| H | Hover mode |
| P | Pos+Att mode |
| S / M | Stable mode |
| Space | Pause/unpause simulation |
| Arrow keys | Nudge target position (XY plane) |
| PageUp/PageDown | Adjust target altitude |
| T | Toggle thrust visualization |
| L | Toggle position trail |
| C | Clear trail |

### Mouse

| Action | Effect |
|--------|--------|
| Drag | Orbit camera around drone |
| Scroll | Zoom in/out |

### Motor Sliders

The UI includes manual motor thrust sliders that show current motor commands. Dragging a slider temporarily overrides the controller, allowing direct motor manipulation.

## Technical Details

### Physics Engine

- **Rigid body dynamics** with quaternion-based orientation
- **Semi-implicit Euler integration** for numerical stability
- **10 physics substeps** per frame for controller stability
- **Ground collision detection** with position clamping

### Control System

- **PD attitude controller** with separate gains for roll, pitch, and yaw
- **PD position controller** with gravity compensation
- **Motor allocation** via Moore-Penrose pseudoinverse of the 6x4 allocation matrix
- **Motor saturation handling** with configurable thrust limits

### Allocation Matrix

The 6x4 allocation matrix M maps motor inputs u = [u1, u2, u3, u4] to body-frame wrench w = [F; tau]:

```
Column i: [n_i; k_i * n_i]
```

Where:
- `n_i` is the thrust axis (unit vector pointing outward from vertex i)
- `k_i` is the thrust-torque coupling coefficient (positive or negative based on handedness)

Motor commands are computed as: `u = M+ * w_desired` (least-squares solution)

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Three.js** - 3D visualization
- **Vite** - Build tool and dev server

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/dudebot/tetracopter.git
cd tetracopter

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

## Project Structure

```
tetracopter/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── control/
│   │   ├── AttitudeController.ts
│   │   └── PositionController.ts
│   ├── geometry/
│   │   ├── allocation.ts       # Motor allocation matrix
│   │   └── tetrahedron.ts      # Tetrahedral geometry
│   ├── math/
│   │   ├── matrix.ts           # Matrix operations
│   │   ├── quaternion.ts       # Quaternion math
│   │   └── vector3.ts          # 3D vector math
│   ├── physics/
│   │   ├── constants.ts        # Physical constants
│   │   ├── DroneState.ts       # State representation
│   │   └── TetraDrone.ts       # Drone physics model
│   └── visualization/
│       ├── DroneModel.ts       # 3D drone mesh
│       └── Scene.ts            # Three.js scene setup
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## License

MIT
