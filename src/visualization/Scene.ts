import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * Three.js scene setup and management
 */
export class Scene {
    public scene!: THREE.Scene;
    public camera!: THREE.PerspectiveCamera;
    public renderer!: THREE.WebGLRenderer;
    public controls!: OrbitControls;

    private container: HTMLElement;
    private lights!: {
        ambient: THREE.AmbientLight;
        directional: THREE.DirectionalLight;
    };

    constructor(container?: HTMLElement) {
        this.container = container || document.body;
        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initControls();
        this.initLights();
        this.initEnvironment();
        this.handleResize();
    }

    private initScene(): void {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        this.scene.fog = new THREE.Fog(0x1a1a1a, 10, 100);
    }

    private initCamera(): void {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

        // Position camera to view the drone
        // Z-up convention: look at origin from diagonal
        this.camera.position.set(5, 5, 5);
        this.camera.up.set(0, 0, 1); // Z is up
        this.camera.lookAt(0, 0, 1);
    }

    private initRenderer(): void {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.appendChild(this.renderer.domElement);
    }

    private initControls(): void {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 50;
        this.controls.target.set(0, 0, 1);

        // Set up for Z-up (camera up is already set)
        this.controls.update();
    }

    private initLights(): void {
        // Ambient light for overall illumination
        this.lights = {
            ambient: new THREE.AmbientLight(0xffffff, 0.4),
            directional: new THREE.DirectionalLight(0xffffff, 0.6)
        };

        // Directional light (sun) from above
        this.lights.directional.position.set(5, 5, 10);
        this.lights.directional.castShadow = true;

        // Shadow configuration
        this.lights.directional.shadow.camera.left = -10;
        this.lights.directional.shadow.camera.right = 10;
        this.lights.directional.shadow.camera.top = 10;
        this.lights.directional.shadow.camera.bottom = -10;
        this.lights.directional.shadow.camera.near = 0.1;
        this.lights.directional.shadow.camera.far = 50;
        this.lights.directional.shadow.mapSize.width = 2048;
        this.lights.directional.shadow.mapSize.height = 2048;

        this.scene.add(this.lights.ambient);
        this.scene.add(this.lights.directional);
    }

    private initEnvironment(): void {
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x303030,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.receiveShadow = true;
        // No rotation needed - plane is already in XY plane (Z=0)
        ground.position.z = 0;
        this.scene.add(ground);

        // Grid helper (XY plane for Z-up)
        const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        // Rotate grid to XY plane
        gridHelper.rotation.x = Math.PI / 2;
        this.scene.add(gridHelper);

        // Axis helper (shows XYZ axes)
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);

        // Add some reference spheres at different heights
        const refGeometry = new THREE.SphereGeometry(0.1);
        const refMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        for (let z = 1; z <= 5; z++) {
            const sphere = new THREE.Mesh(refGeometry, refMaterial);
            sphere.position.set(0, 0, z);
            this.scene.add(sphere);
        }
    }

    private handleResize(): void {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(width, height);
        });
    }

    /**
     * Update controls (call in animation loop)
     */
    update(): void {
        this.controls.update();
    }

    /**
     * Render the scene
     */
    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Add an object to the scene
     */
    add(object: THREE.Object3D): void {
        this.scene.add(object);
    }

    /**
     * Remove an object from the scene
     */
    remove(object: THREE.Object3D): void {
        this.scene.remove(object);
    }

    /**
     * Set camera target
     */
    setCameraTarget(x: number, y: number, z: number): void {
        this.controls.target.set(x, y, z);
        this.controls.update();
    }

    /**
     * Set camera position
     */
    setCameraPosition(x: number, y: number, z: number): void {
        this.camera.position.set(x, y, z);
        this.controls.update();
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.renderer.dispose();
        this.controls.dispose();
    }
}