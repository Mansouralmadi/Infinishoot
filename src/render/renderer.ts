import * as THREE from 'three';
import { retroGlobals } from './retroMaterial';

/**
 * Renders the scene into a low-resolution target, then runs a post pass
 * (colour-depth reduction + ordered dither + saturation) to the canvas.
 * The canvas drawing buffer stays at the internal resolution and is scaled
 * up by CSS with `image-rendering: pixelated`.
 */
export const postSettings = {
  /** Internal vertical resolution; 0 = native window resolution. */
  resolution: 270,
  colorBits: 5,
  dither: 0.5,
  saturation: 1.15,
};

const postVert = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const postFrag = /* glsl */ `
uniform sampler2D tScene;
uniform float uBits;
uniform float uDither;
uniform float uSaturation;
in vec2 vUv;
layout(location = 0) out vec4 outColor;

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  const float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return m[i.x + i.y * 4] / 16.0 - 0.46875;
}

void main() {
  vec3 col = texture(tScene, vUv).rgb;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(luma), col, uSaturation), 0.0, 1.0);
  float levels = exp2(uBits) - 1.0;
  col += bayer4(gl_FragCoord.xy) * uDither / levels;
  col = floor(col * levels + 0.5) / levels;
  outColor = vec4(col, 1.0);
}
`;

export class RetroRenderer {
  readonly gl: THREE.WebGLRenderer;
  readonly width = { value: 0 };
  readonly height = { value: 0 };
  private target: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMat: THREE.ShaderMaterial;

  constructor(canvas: HTMLCanvasElement) {
    THREE.ColorManagement.enabled = false;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.setPixelRatio(1);
    this.gl.info.autoReset = false;

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });

    this.postMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: postVert,
      fragmentShader: postFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.target.texture },
        uBits: { value: postSettings.colorBits },
        uDither: { value: postSettings.dither },
        uSaturation: { value: postSettings.saturation },
      },
    });
    // Single full-screen triangle.
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new THREE.Mesh(tri, this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const h = postSettings.resolution > 0 ? Math.min(postSettings.resolution, ch) : ch;
    const w = Math.max(1, Math.round((h * cw) / ch));
    this.width.value = w;
    this.height.value = h;
    this.gl.setSize(w, h, false);
    this.target.setSize(w, h);
    retroGlobals.uSnapRes.value.set(w, h);
  }

  get aspect(): number {
    return this.width.value / this.height.value;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.info.reset();
    const u = this.postMat.uniforms;
    u.uBits.value = postSettings.colorBits;
    u.uDither.value = postSettings.dither;
    u.uSaturation.value = postSettings.saturation;

    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }
}
