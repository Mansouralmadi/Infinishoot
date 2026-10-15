import * as THREE from 'three';

/**
 * Fixed-angle 3/4 top-down follow camera. Never rotates (no yaw) so screen
 * directions always map to the same world directions. Leads slightly toward
 * where the player is aiming.
 */
export const cameraTuning = {
  pitchDeg: 58,
  distance: 25,
  fov: 34,
  follow: 7, // follow smoothing (higher = tighter)
  lookAhead: 0.22, // fraction of cursor offset to lead by (mouse)
  lookAheadMax: 4,
  padLookAhead: 3, // units to lead along stick aim (gamepad)
};

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private focus = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(cameraTuning.fov, aspect, 0.5, 120);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param target player position (interpolated)
   * @param lead world-space offset to lead toward (already clamped)
   * @param shake screen-shake offset; translates the camera without rotating it
   */
  update(target: THREE.Vector3, lead: THREE.Vector3, frameDt: number, shake = { x: 0, z: 0 }): void {
    const t = cameraTuning;
    // `fov` is the vertical FOV at 16:9. Narrower windows widen it so every
    // player sees at least the same horizontal slice of the arena.
    const minAspect = 16 / 9;
    const aspect = this.camera.aspect;
    const vfov =
      aspect >= minAspect
        ? t.fov
        : THREE.MathUtils.radToDeg(
            2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(t.fov) / 2) * (minAspect / aspect)),
          );
    if (this.camera.fov !== vfov) {
      this.camera.fov = vfov;
      this.camera.updateProjectionMatrix();
    }
    this.desired.copy(target).add(lead);
    if (!this.initialized) {
      this.focus.copy(this.desired);
      this.initialized = true;
    } else {
      this.focus.lerp(this.desired, 1 - Math.exp(-t.follow * frameDt));
    }
    const pitch = THREE.MathUtils.degToRad(t.pitchDeg);
    this.camera.position.set(
      this.focus.x,
      this.focus.y + Math.sin(pitch) * t.distance,
      this.focus.z + Math.cos(pitch) * t.distance,
    );
    this.camera.lookAt(this.focus);
    this.camera.position.x += shake.x;
    this.camera.position.z += shake.z;
  }
}
