import * as THREE from 'three';

/**
 * Retro (late-90s console) material.
 *  - Per-vertex hemisphere + sun lighting (Gouraud), optional cel banding
 *  - Vertex snapping to the low-res pixel grid (PS1 wobble)
 *  - Blend between perspective-correct and affine texture mapping (uv*w trick;
 *    WebGL2 has no `noperspective`)
 *  - Nearest-filtered textures, vertex colours, instancing, sky-tinted fog
 *
 * Global look settings live in `retroGlobals`; every retro material shares
 * those uniform objects, so changing a value updates the whole scene.
 */
export const retroGlobals = {
  uSnapRes: { value: new THREE.Vector2(480, 270) },
  uSnapPx: { value: 0.5 }, // snap grid size in internal pixels, 0 = off
  uAffine: { value: 0.5 }, // 0 = perspective correct, 1 = full affine
  uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.4).normalize() },
  uSunColor: { value: new THREE.Color(0.72, 0.66, 0.52) },
  uSkyColor: { value: new THREE.Color(0.5, 0.56, 0.78) },
  uGroundColor: { value: new THREE.Color(0.36, 0.3, 0.4) },
  uToonSteps: { value: 3 }, // 0 = smooth Gouraud
  uFogColor: { value: new THREE.Color('#9fd8ff') },
  uFogNear: { value: 28 },
  uFogFar: { value: 70 },
  uTime: { value: 0 },
};

const vertexShader = /* glsl */ `
uniform vec2 uSnapRes;
uniform float uSnapPx;
uniform vec3 uSunDir;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform vec2 uUvScroll;

out vec3 vColor;
out vec3 vAmbient;
out float vDiffuse;
out float vFog;
out vec2 vUvP;
out vec3 vUvW; // uv * w, w  -> dividing per-fragment yields affine (screen-linear) UVs
#ifdef RETRO_INSTANCE_FLASH
  in vec4 instanceFlash; // per-instance hit flash (rgb, amount)
  out vec4 vFlash;
#endif

void main() {
  #ifdef RETRO_INSTANCE_FLASH
    vFlash = instanceFlash;
  #endif
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif

  vec4 wp = m * vec4(position, 1.0);
  vec3 n = normalize(mat3(m) * normal);

  vAmbient = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
  vDiffuse = max(dot(n, uSunDir), 0.0);

  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color.rgb;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor;
  #endif

  vec2 tuv = uv + uUvScroll * uTime;
  vUvP = tuv;

  vec4 mv = viewMatrix * wp;
  vFog = smoothstep(uFogNear, uFogFar, -mv.z);

  vec4 clip = projectionMatrix * mv;
  if (uSnapPx > 0.0 && clip.w > 0.0) {
    vec2 grid = uSnapRes * 0.5 / uSnapPx;
    clip.xy = round(clip.xy / clip.w * grid) / grid * clip.w;
  }
  vUvW = vec3(tuv * clip.w, clip.w);
  gl_Position = clip;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uAffine;
uniform float uAlphaTest;
uniform vec4 uFlash;
uniform float uUnlit;
uniform vec3 uSunColor;
uniform float uToonSteps;
uniform vec3 uFogColor;
#ifdef RETRO_MAP
  uniform sampler2D uMap;
#endif

in vec3 vColor;
in vec3 vAmbient;
in float vDiffuse;
in float vFog;
in vec2 vUvP;
in vec3 vUvW;
#ifdef RETRO_INSTANCE_FLASH
  in vec4 vFlash;
#endif
layout(location = 0) out vec4 outColor;

void main() {
  vec4 base = vec4(uColor * vColor, 1.0);
  #ifdef RETRO_MAP
    base *= texture(uMap, mix(vUvP, vUvW.xy / vUvW.z, uAffine));
  #endif
  if (base.a < uAlphaTest) discard;

  float d = vDiffuse;
  if (uToonSteps > 0.5) {
    // Soft-edged cel bands: chunky anime shading that still reads as lit.
    float s = d * uToonSteps;
    d = (floor(s) + smoothstep(0.35, 0.65, fract(s))) / uToonSteps;
  }
  vec3 lit = base.rgb * (vAmbient + uSunColor * d);
  vec3 col = mix(lit, base.rgb, uUnlit);
  col = mix(col, uFlash.rgb, uFlash.a);
  #ifdef RETRO_INSTANCE_FLASH
    col = mix(col, vFlash.rgb, vFlash.a);
  #endif
  col = mix(col, uFogColor, vFog);
  outColor = vec4(col, base.a);
}
`;

export interface RetroMaterialOptions {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  vertexColors?: boolean;
  alphaTest?: number;
  /** 0 = fully lit, 1 = ignores lighting (glowing things). */
  unlit?: number;
  side?: THREE.Side;
  transparent?: boolean;
  /** UV scroll speed in UV units per second (water, conveyors). */
  uvScroll?: [number, number];
  /** Read a per-instance `instanceFlash` vec4 attribute (InstancedMesh only). */
  instanceFlash?: boolean;
}

export type RetroMaterial = THREE.ShaderMaterial & {
  uniforms: { uFlash: { value: THREE.Vector4 }; uColor: { value: THREE.Color } };
};

export function createRetroMaterial(opts: RetroMaterialOptions = {}): RetroMaterial {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    vertexColors: opts.vertexColors ?? false,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    defines: {
      ...(opts.map ? { RETRO_MAP: '' } : {}),
      ...(opts.instanceFlash ? { RETRO_INSTANCE_FLASH: '' } : {}),
    },
    uniforms: {
      ...retroGlobals,
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uMap: { value: opts.map ?? null },
      uAlphaTest: { value: opts.alphaTest ?? 0 },
      uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
      uUnlit: { value: opts.unlit ?? 0 },
      uUvScroll: { value: new THREE.Vector2(...(opts.uvScroll ?? [0, 0])) },
    },
  });
  return mat as RetroMaterial;
}
