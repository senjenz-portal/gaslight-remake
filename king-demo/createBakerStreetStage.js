/**
 * createBakerStreetStage.js — procedural Three.js BACKGROUND DIORAMA
 * Victorian Baker Street at night on a floating rock island.
 *
 * Built with the img2threejs skill (~/.claude/skills/img2threejs) from the reference plate
 *   assets/plates/street-arrival.png
 * through the staged pipeline blockout -> structural-pass -> form-refinement -> material-pass
 * -> lighting-pass, each pass gated and reviewed. The authoritative reconstruction record is
 * object-sculpt-spec.json next to this file (component tree, materials, repetition systems,
 * solved reference camera, detail inventory and the full reviewHistory).
 *
 * Pipeline provenance
 *   spec:      object-sculpt-spec.json   (136 components, 29 materials)
 *   generated: forge/stage3_build/generate_threejs_factory.py --pass-id lighting-pass
 *   patched:   postgen_patch.py  (the three non-radial repetition systems, halo sprites,
 *              rock facet jitter, parented warm point lights, and the idle tick — see that
 *              script's header for why each item cannot come from the generator)
 *   transpiled: esbuild --format=esm --target=es2020   (types stripped; no other transform)
 *
 * Exports
 *   createBakerStreetStage(options?)        -> THREE.Group   the stage itself
 *   createBakerStreetStageNightRig()        -> THREE.Group   sky + moon + cool bounce fill
 *   createBakerStreetStageIsoCamera(size?)  -> THREE.OrthographicCamera, reference-matched
 *   createBakerStreetNightDioramaModel      alias of createBakerStreetStage
 *
 * Runtime
 *   root.userData.tick(deltaSeconds)        gas lamp flicker + window glow breathing.
 *                                           Emissive only: NO geometry moves, so the stage
 *                                           never competes with a foreground character.
 *   root.userData.sculptRuntime             nodes / meshes / sockets / colliders / destructionGroups
 *   root.userData.sculptRuntime.sockets['root:character-stage']  where the foreground
 *                                           character stands on the near pavement
 *
 * Measured budget (built model traversal, renders/lighting-final.stats.json)
 *   14466 triangles, 138 meshes, 11 instanced systems,
 *   0 bound textures (the reference is an untextured flat-shaded render, so
 *   procedural PBR canvases are deliberately disabled), brief ceiling 25,000 triangles.
 *
 * Imports only 'three'. The generator's three/examples/jsm helper exports were dropped by
 * postgen_patch.py to keep that contract.
 */
import * as THREE from "three";
function buildLatheGeometry(profile) {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function readLayerNumber(value, keys, fallback) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const record = value;
    for (const key of keys) {
      if (typeof record[key] === "number") return record[key];
    }
  }
  return fallback;
}
function hexToRgb(hex) {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex) ? "#" + hex.slice(1).split("").map((part) => part + part).join("") : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 9075295;
  return [clampAlbedoChannel(value >> 16 & 255), clampAlbedoChannel(value >> 8 & 255), clampAlbedoChannel(value & 255)];
}
function materialPalette(spec) {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === "string");
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...Array.isArray(secondary) ? secondary : []];
  return colors.filter((value) => typeof value === "string" && value.startsWith("#"));
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function clampAlbedoChannel(value) {
  return Math.max(30, Math.min(240, Math.round(value)));
}
function clampPbrF0(value) {
  return Math.max(0.02, Math.min(1, value));
}
function clampPbrIor(value) {
  return Math.max(1, Math.min(2.5, value));
}
function clampPbrMetalness(value) {
  return value >= 0.5 ? 1 : 0;
}
function clampedAlbedoColor(spec) {
  const source = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F";
  const [red, green, blue] = hexToRgb(source);
  return new THREE.Color(red / 255, green / 255, blue / 255);
}
function smoothCurve(value) {
  return value * value * (3 - 2 * value);
}
function periodicHash(x, y, seed, periodX, periodY) {
  const wrappedX = (x % periodX + periodX) % periodX;
  const wrappedY = (y % periodY + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
function periodicValueNoise(u, v, seed, periodX, periodY) {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}
function surfaceBands(spec) {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const band = item;
    const frequency = typeof band.frequency === "number" ? band.frequency : 0;
    const amplitude = typeof band.amplitude === "number" ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? "")} ${String(band.role ?? "")}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === "number" ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === "number" ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description)
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false }
  ];
}
function sampleSurface(u, v, bands, seed) {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}
function mixPalette(colors, value) {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix))
  ];
}
function parseRgba(value) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}
function sampleColorGradient(gradient, u, v) {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: "rgba(138,122,95,1)" }, { offset: 1, color: "rgba(138,122,95,1)" }];
  let t;
  if (gradient.type === "radial") {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(1e-3, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix)
  ];
}
function writePixel(data, offset, red, green, blue) {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}
function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}
function createMapTexture(canvas, colorSpace, spec, options) {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 2,
    typeof repeat[1] === "number" ? repeat[1] : 2
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function referenceMapUrl(spec, channel) {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== "object") return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === "number" ? reference.confidence : typeof reference.estimatedFidelity === "number" ? reference.estimatedFidelity : 0;
  const threshold = typeof reference.targetThreshold === "number" ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== "object") return null;
  const map = maps[channel];
  if (!map || typeof map !== "object") return null;
  const record = map;
  const url = typeof record.url === "string" && record.url.trim() ? record.url : record.path;
  return typeof url === "string" && url.trim() ? url : null;
}
function createLoadedMapTexture(url, colorSpace, spec, options) {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 1,
    typeof repeat[1] === "number" ? repeat[1] : 1
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function makeReferenceTextureSet(spec, options) {
  const albedo = referenceMapUrl(spec, "albedo");
  const roughness = referenceMapUrl(spec, "roughness");
  const height = referenceMapUrl(spec, "height");
  const normal = referenceMapUrl(spec, "normal");
  const ao = referenceMapUrl(spec, "ao");
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: "reference-pixel-extraction"
  };
}
function makeProceduralTextureSet(id, spec, options) {
  if (typeof document === "undefined") return null;
  if (spec.proceduralMaps === "disabled-flat-facet") return null;
  const qualityFirst = (options.qualityPriority ?? "reference-fidelity") === "reference-fidelity";
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === "number" && Number.isFinite(requested) ? requested : qualityFirst ? 1024 : 512;
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size)
  };
  const contexts = {
    albedo: canvases.albedo.getContext("2d"),
    roughness: canvases.roughness.getContext("2d"),
    height: canvases.height.getContext("2d"),
    normal: canvases.normal.getContext("2d"),
    ao: canvases.ao.getContext("2d")
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size)
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F";
  const colors = (palette.length >= 2 ? palette : [fallback, "#6E614B", "#A08F70"]).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ["base"], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ["variation"], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ["amplitude", "variation"], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ["heightCorrelation"], 0.3));
  const colorGradient = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color;
      if (colorGradient) {
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = (y - 1 + size) % size * size;
    const down = (y + 1) % size * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (heightField[y * size + left] + heightField[y * size + right] + heightField[up + x] + heightField[down + x]) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data,
        offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: "procedural"
  };
}
function createSculptMaterial(id, spec, options, denseComponent = false) {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 16777215 : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ["base"], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ["base"], 0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ["base", "amount"], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ["base"], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ["base", "amount"], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ["base", "value"], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ["base", "amount"], 0)),
    attenuationDistance: Math.max(1e-3, readLayerNumber(spec.attenuationDistance, ["base", "value"], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === "string" ? spec.attenuationColor : "#ffffff"),
    sheen: clamp01(readLayerNumber(spec.sheen, ["base", "amount"], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === "string" ? spec.sheenColor : "#ffffff"),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ["base"], 1)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ["base", "amount"], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ["base", "value"], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ["base", "amount"], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ["rotation"], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ["base", "value"], 1)),
    specularColor: new THREE.Color(typeof spec.specularColor === "string" ? spec.specularColor : "#ffffff"),
    emissive: new THREE.Color(typeof spec.emissive === "string" ? spec.emissive : "#000000"),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ["base"], 1)),
    opacity: clamp01(readLayerNumber(spec.opacity, ["base"], 1)),
    transparent: readLayerNumber(spec.transmission, ["base", "amount"], 0) > 0 || readLayerNumber(spec.opacity, ["base"], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ["cutoff", "alphaTest"], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === "dense" || spec.topologyClass === "dense";
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ["amplitude", "strength"], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ["amplitude", "strength"], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(5e-3, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ["envMapIntensity"], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? "flat-fallback";
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}
function readVector3(value, fallback) {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number")) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}
function readNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function makeAttachmentEndpoint(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const record = attachment;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 1e-4) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(5e-3, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(3e-3, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius
  };
}
function createBakerStreetNightDioramaModel(options = {}) {
  var _a;
  const root = new THREE.Group();
  root.name = "Baker Street Night Diorama";
  root.userData.reconstructionEvidence = { "itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": { "solved": true, "projection": "orthographic", "fovDegrees": 0, "aspect": 1, "azimuthDeg": 45, "elevationDeg": 28.7, "orthoHalfExtent": 9.697, "target": [0, 2.63, 0], "positionHint": [12, 9.3, 12], "orientation": { "yaw": -45, "pitch": -28.7, "roll": 0 }, "pixelsPerUnit": 52.8, "derivation": ["the plate's platform is a square in plan; its left and right silhouette corners sit at the same image row (y=626/637), which fixes azimuth at 45 deg", "the platform's south-west top edge runs at slope 0.48 px/px, and for an orthographic iso view that slope equals sin(elevation) -> elevation = 28.7 deg", "the left/right corners are 750 px apart for a 10-unit square -> 52.8 px per world unit", "the platform centre projects to image row 632, and image row 512 is 2.63 units above the platform top -> camera target (0, 2.63, 0)", "verified: predicted corner pixels (139,632)/(883,632)/(510,811) against measured (136,626)/(884,637)/(~510,811)"], "note": "solved by inverting the plate's isometric projection from measured silhouette landmarks, not by a perspective solver; renders are pixel-comparable to the plate" }, "approximationNotes": [] };
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;
  const materialMap = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    { "id": "hidden", "name": "Hidden root group", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#000000", "color": "#000000", "albedo": { "dominant": "#000000", "secondary": ["#000000", "#000000"], "samplingNotes": "sampled from reference plate pixels (derived from neighbouring sampled facets); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#000000", "#000000", "#000000"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 1, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "organizing root only; never a visible surface", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."], "opacity": { "base": 0 } },
    options
  );
  materialMap["brick-facade"] = createSculptMaterial(
    "brick-facade",
    { "id": "brick-facade", "name": "Brick facade (warm maroon stock brick)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#74464a", "color": "#74464a", "albedo": { "dominant": "#74464a", "secondary": ["#533235", "#8d555a"], "samplingNotes": "sampled from reference plate pixels (#633e43 unlit field / #985a41 under lamp); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#74464a", "#533235", "#8d555a"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.88, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["brick-pier"] = createSculptMaterial(
    "brick-pier",
    { "id": "brick-pier", "name": "Brick pier (cooler, further from lamps)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#6a4048", "color": "#6a4048", "albedo": { "dominant": "#6a4048", "secondary": ["#4c2e33", "#814e57"], "samplingNotes": "sampled from reference plate pixels (#251420 pier lit face); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#6a4048", "#4c2e33", "#814e57"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.9, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["stone-trim"] = createSculptMaterial(
    "stone-trim",
    { "id": "stone-trim", "name": "Portland stone trim (lintels, sills, cornice, quoin)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#9a95a6", "color": "#9a95a6", "albedo": { "dominant": "#9a95a6", "secondary": ["#6e6b77", "#bbb5ca"], "samplingNotes": "sampled from reference plate pixels (#cc8c5e under lamp / #56475e away); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#9a95a6", "#6e6b77", "#bbb5ca"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.72, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["stone-plinth"] = createSculptMaterial(
    "stone-plinth",
    { "id": "stone-plinth", "name": "Granite plinth and steps", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#7c7a8f", "color": "#7c7a8f", "albedo": { "dominant": "#7c7a8f", "secondary": ["#595766", "#9794ae"], "samplingNotes": "sampled from reference plate pixels (#403747 door surround); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#7c7a8f", "#595766", "#9794ae"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.8, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["window-muntin"] = createSculptMaterial(
    "window-muntin",
    { "id": "window-muntin", "name": "Painted glazing bar (warm, lit from behind)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#8c7f74", "color": "#8c7f74", "albedo": { "dominant": "#8c7f74", "secondary": ["#645b53", "#aa9a8d"], "samplingNotes": "sampled from reference plate pixels (warm pale bars over #fad081 glass in crop-roof); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#8c7f74", "#645b53", "#aa9a8d"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.8, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["roof-slab"] = createSculptMaterial(
    "roof-slab",
    { "id": "roof-slab", "name": "Lead roof slab and cap slabs (sky-lit top faces)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#2b3556", "color": "#2b3556", "albedo": { "dominant": "#2b3556", "secondary": ["#1e263d", "#344068"], "samplingNotes": "sampled from reference plate pixels (#182c61 roof top face / #162c61 pier cap); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#2b3556", "#1e263d", "#344068"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.78, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["wall-shadow"] = createSculptMaterial(
    "wall-shadow",
    { "id": "wall-shadow", "name": "Unlit gable end wall", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#2b3352", "color": "#2b3352", "albedo": { "dominant": "#2b3352", "secondary": ["#1e243b", "#343e64"], "samplingNotes": "sampled from reference plate pixels (#090a1e gable); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#2b3352", "#1e243b", "#343e64"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.9, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["pavement"] = createSculptMaterial(
    "pavement",
    { "id": "pavement", "name": "Flagstone pavement", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#565160", "color": "#565160", "albedo": { "dominant": "#565160", "secondary": ["#3d3a45", "#686275"], "samplingNotes": "sampled from reference plate pixels (#665f74 lit / #334269 shadow); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#565160", "#3d3a45", "#686275"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.85, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["cobble"] = createSculptMaterial(
    "cobble",
    { "id": "cobble", "name": "Cobbled roadway setts", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#6b667f", "color": "#6b667f", "albedo": { "dominant": "#6b667f", "secondary": ["#4d495b", "#827c9a"], "samplingNotes": "sampled from reference plate pixels (#4e4965 sett top / #211c30 joint); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#6b667f", "#4d495b", "#827c9a"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.86, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [{ "id": "sett-value-jitter", "channel": "albedo", "amount": 0.16, "mask": "per-instance deterministic hash (seed 90210)", "evidenceRefs": ["street-zone"], "observation": "neighbouring setts in the plate differ in value by roughly \xB115%; sampled tops run #4e4965 down to #3a3750" }, { "id": "joint-darkening", "channel": "albedo", "amount": 0.45, "mask": "road-joint bed showing between sett tops", "evidenceRefs": ["street-zone"], "observation": "joints sample #211c30, far darker than any sett top" }], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["road-joint"] = createSculptMaterial(
    "road-joint",
    { "id": "road-joint", "name": "Dark sett joint bed under the cobble tops", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#2a2740", "color": "#2a2740", "albedo": { "dominant": "#2a2740", "secondary": ["#1e1c2e", "#332f4e"], "samplingNotes": "sampled from reference plate pixels (#211c30 cobble gap); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#2a2740", "#1e1c2e", "#332f4e"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.95, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["kerb-stone"] = createSculptMaterial(
    "kerb-stone",
    { "id": "kerb-stone", "name": "Kerb stone", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#868ead", "color": "#868ead", "albedo": { "dominant": "#868ead", "secondary": ["#60667c", "#a3add3"], "samplingNotes": "sampled from reference plate pixels (#384162 kerb face); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#868ead", "#60667c", "#a3add3"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.82, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["slab-edge"] = createSculptMaterial(
    "slab-edge",
    { "id": "slab-edge", "name": "Platform slab side face", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#33405f", "color": "#33405f", "albedo": { "dominant": "#33405f", "secondary": ["#242e44", "#3e4e73"], "samplingNotes": "sampled from reference plate pixels (dark side face with a thin bright top-edge highlight in the plate); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#33405f", "#242e44", "#3e4e73"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.8, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "corrected after a 4x crop comparison: the plate's slab SIDE is dark and it is the near PAVEMENT TOP that carries the #39517d mid-blue. The earlier reading (and the emissive rim added for it) had the two surfaces the wrong way round", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["rock"] = createSculptMaterial(
    "rock",
    { "id": "rock", "name": "Floating rock mass (upper facets)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#1e2436", "color": "#1e2436", "albedo": { "dominant": "#1e2436", "secondary": ["#151926", "#242b41"], "samplingNotes": "sampled from reference plate pixels (#0e1429 lit facet); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#1e2436", "#151926", "#242b41"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.94, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [{ "id": "facet-value-families", "channel": "albedo", "amount": 0.35, "mask": "per-facet deterministic hash (seed 20250811)", "evidenceRefs": ["rock-zone"], "observation": "the plate's rock reads as two value families, #0e1429 for sky-facing facets and #020611 for the deep flanks, with hard edges between them" }], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["rock-deep"] = createSculptMaterial(
    "rock-deep",
    { "id": "rock-deep", "name": "Floating rock mass (deep facets)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#0d1220", "color": "#0d1220", "albedo": { "dominant": "#0d1220", "secondary": ["#090c17", "#0f1527"], "samplingNotes": "sampled from reference plate pixels (#020611 deep facet); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#0d1220", "#090c17", "#0f1527"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.96, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["iron-black"] = createSculptMaterial(
    "iron-black",
    { "id": "iron-black", "name": "Cast iron (lamp posts, brackets, wheels, harness)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#171a25", "color": "#171a25", "albedo": { "dominant": "#171a25", "secondary": ["#10121a", "#1c1f2d"], "samplingNotes": "sampled from reference plate pixels (#050a20 lamp post); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#171a25", "#10121a", "#1c1f2d"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.55, "variation": 0.08, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0.35, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [{ "id": "post-rim-sheen", "channel": "roughness", "amount": 0.08, "mask": "grazing edges of the fluted post and the wheel rims", "evidenceRefs": ["lamp-zone"], "observation": "the lamp post keeps a thin lighter edge against the pavement in the plate while its face stays #050a20, i.e. a specular sheen at grazing angles rather than a lighter albedo" }], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["window-glow"] = createSculptMaterial(
    "window-glow",
    { "id": "window-glow", "name": "Lit window glass (amber interior)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#4a3116", "color": "#4a3116", "albedo": { "dominant": "#4a3116", "secondary": ["#35230f", "#5a3b1a"], "samplingNotes": "sampled from reference plate pixels (#fad081 glass core); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#4a3116", "#35230f", "#5a3b1a"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.35, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."], "emissive": "#ffd894", "emissiveIntensity": { "base": 0.85 } },
    options
  );
  materialMap["lamp-glow"] = createSculptMaterial(
    "lamp-glow",
    { "id": "lamp-glow", "name": "Gas lamp glass (hot mantle)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#42301a", "color": "#42301a", "albedo": { "dominant": "#42301a", "secondary": ["#2f2212", "#503a1f"], "samplingNotes": "sampled from reference plate pixels (#b7a665 lamp glass / #fbf387 cab lamp); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#42301a", "#2f2212", "#503a1f"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.3, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."], "emissive": "#ffa94f", "emissiveIntensity": { "base": 0.42 } },
    options
  );
  materialMap["glow-card"] = createSculptMaterial(
    "glow-card",
    { "id": "glow-card", "name": "Additive halo card around a flame", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#000000", "color": "#000000", "albedo": { "dominant": "#000000", "secondary": ["#000000", "#000000"], "samplingNotes": "sampled from reference plate pixels (derived from neighbouring sampled facets); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#000000", "#000000", "#000000"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 1, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "postgen replaces this with an additive-blended card; opacity is the fallback", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."], "emissive": "#ffb262", "emissiveIntensity": { "base": 1 }, "opacity": { "base": 0.085 } },
    options
  );
  materialMap["wood-sign"] = createSculptMaterial(
    "wood-sign",
    { "id": "wood-sign", "name": "Painted plank signboard", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#a5713c", "color": "#a5713c", "albedo": { "dominant": "#a5713c", "secondary": ["#76512b", "#c98949"], "samplingNotes": "sampled from reference plate pixels (#814f30 sign board); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#a5713c", "#76512b", "#c98949"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.85, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["cab-body"] = createSculptMaterial(
    "cab-body",
    { "id": "cab-body", "name": "Lacquered cab body (blue-black)", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#38425f", "color": "#38425f", "albedo": { "dominant": "#38425f", "secondary": ["#282f44", "#445073"], "samplingNotes": "sampled from reference plate pixels (#13193a cab front / #02030b shadow side); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#38425f", "#282f44", "#445073"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.5, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["cab-dark"] = createSculptMaterial(
    "cab-dark",
    { "id": "cab-dark", "name": "Cab door glass and recessed panels", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#12161f", "color": "#12161f", "albedo": { "dominant": "#12161f", "secondary": ["#0c0f16", "#151a25"], "samplingNotes": "sampled from reference plate pixels (#02030b); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#12161f", "#0c0f16", "#151a25"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.45, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["horse-dark"] = createSculptMaterial(
    "horse-dark",
    { "id": "horse-dark", "name": "Dark bay horse hide", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#7a5f48", "color": "#7a5f48", "albedo": { "dominant": "#7a5f48", "secondary": ["#574433", "#947357"], "samplingNotes": "sampled from reference plate pixels (#4e495c barrel under night light); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#7a5f48", "#574433", "#947357"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.85, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["horse-light"] = createSculptMaterial(
    "horse-light",
    { "id": "horse-light", "name": "Grey horse hide / blanket", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#8f8272", "color": "#8f8272", "albedo": { "dominant": "#8f8272", "secondary": ["#665d52", "#ae9e8b"], "samplingNotes": "sampled from reference plate pixels (#584d5c); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#8f8272", "#665d52", "#ae9e8b"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.85, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["coat-navy"] = createSculptMaterial(
    "coat-navy",
    { "id": "coat-navy", "name": "Navy wool coat", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#2b3a63", "color": "#2b3a63", "albedo": { "dominant": "#2b3a63", "secondary": ["#1e2947", "#344678"], "samplingNotes": "sampled from reference plate pixels (#0a143c skirt / #400b10 driver coat in shadow); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#2b3a63", "#1e2947", "#344678"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.9, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["coat-green"] = createSculptMaterial(
    "coat-green",
    { "id": "coat-green", "name": "Bottle green coat", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#2d6349", "color": "#2d6349", "albedo": { "dominant": "#2d6349", "secondary": ["#204734", "#367859"], "samplingNotes": "sampled from reference plate pixels (#091d13); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#2d6349", "#204734", "#367859"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.9, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["coat-purple"] = createSculptMaterial(
    "coat-purple",
    { "id": "coat-purple", "name": "Plum overcoat", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#4d3a6c", "color": "#4d3a6c", "albedo": { "dominant": "#4d3a6c", "secondary": ["#37294d", "#5d4683"], "samplingNotes": "sampled from reference plate pixels (#120d33); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#4d3a6c", "#37294d", "#5d4683"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.9, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["accent-red"] = createSculptMaterial(
    "accent-red",
    { "id": "accent-red", "name": "Scarlet scarf", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#963330", "color": "#963330", "albedo": { "dominant": "#963330", "secondary": ["#6c2422", "#b73e3a"], "samplingNotes": "sampled from reference plate pixels (#450910); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#963330", "#6c2422", "#b73e3a"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.9, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  materialMap["skin-tone"] = createSculptMaterial(
    "skin-tone",
    { "id": "skin-tone", "name": "Face and hands", "type": "standard", "shaderModel": "MeshPhysicalMaterial, flat-shaded facet response", "baseColor": "#c39a74", "color": "#c39a74", "albedo": { "dominant": "#c39a74", "secondary": ["#8c6e53", "#edbb8d"], "samplingNotes": "sampled from reference plate pixels (#9e6a59 face); albedo raised above the sampled value because the sample is albedo x night lighting" }, "colorVariation": { "palette": ["#c39a74", "#8c6e53", "#edbb8d"], "pattern": "flat-facet", "amplitude": 0, "heightCorrelation": 0 }, "textureResolution": 256, "flatShading": true, "roughness": { "base": 0.7, "variation": 0, "map": "none-flat-facet", "localResponse": "facet-to-facet value change comes from geometry normals, not a roughness map" }, "metalness": { "base": 0, "variation": 0 }, "normal": { "pattern": "none", "strength": 0, "scale": 1, "space": "tangent" }, "bump": { "pattern": "none", "amplitude": 0, "scale": 1 }, "displacement": { "pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false }, "ambientOcclusion": { "cavityStrength": 0.2, "contactShadowBias": 0.3, "notes": "flat-shaded stage: contact darkening comes from the light rig, not an AO map" }, "surfaceFrequencyBands": [{ "id": "macro", "frequency": 1, "amplitude": 0.02, "role": "nominal: the only value structure in the reference is the facet-normal step from geometry, so this amplitude is a floor, not observed relief" }], "envMapIntensity": 0.35, "proceduralMaps": "disabled-flat-facet", "localOverrides": [], "notes": "flat-shaded facet material matching the reference plate's untextured look", "shaderNotes": ["The reference plate is an untextured flat-shaded render: every surface is one value per facet.", "Procedural albedo/roughness/normal/AO canvases are therefore DISABLED for this build (postgen early-out) \u2014 a noise field would be detail the reference does not contain."] },
    options
  );
  const nodes = { root };
  const meshes = {};
  const sockets = {};
  const colliders = {};
  const destructionGroups = {};
  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Baker Street night diorama (root)__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
  } else {
    node_root_0.position.set(0, 0, 0);
    node_root_0.rotation.set(0, 0, 0);
  }
  node_root_0.userData.sculptComponent = { "id": "root", "name": "Baker Street night diorama (root)", "level": "macro", "role": "body", "importance": 1, "confidence": 1, "primitive": "box", "topologyClass": "material-only", "topologyRationale": "organizing pivot only: it carries no reference surface, so no solid class applies", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": null, "attachment": null, "dimensions": { "width": 0.01, "height": 0.01, "depth": 0.01, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 1 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "root", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "character-stage", "localPosition": [2.3, 0.16, 1.2], "localRotation": [0, -0.78, 0], "purpose": "where the demo viewer's foreground character stands on the near pavement" }, { "id": "camera-iso", "localPosition": [12, 9.3, 12], "localRotation": [0, 0, 0], "purpose": "reference-matched isometric review camera position" }], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "hidden" } }, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 1, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(0, 0, 0, 1.0)", "secondaryAlbedo": "rgba(0, 0, 0, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["full-object"], "samplingNotes": "plate-observed dominant #000000; reproduction albedo #000000; source: derived from adjacent sampled facets" } };
  node_root_0.userData.actionProfile = { "animationRole": "root", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "character-stage", "localPosition": [2.3, 0.16, 1.2], "localRotation": [0, -0.78, 0], "purpose": "where the demo viewer's foreground character stands on the near pavement" }, { "id": "camera-iso", "localPosition": [12, 9.3, 12], "localRotation": [0, 0, 0], "purpose": "reference-matched isometric review camera position" }], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "hidden" } };
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0 ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.01, 0.01, 0.01);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_root_0.name = "Baker Street night diorama (root)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = node_root_0.userData.sculptComponent;
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["root"] ?? (destructionGroups["root"] = []);
  destructionGroups["root"].push(node_root_0);
  const socket_root_character_stage_0 = new THREE.Object3D();
  socket_root_character_stage_0.name = "character-stage";
  socket_root_character_stage_0.position.set(2.3, 0.16, 1.2);
  socket_root_character_stage_0.rotation.set(0, -0.78, 0);
  socket_root_character_stage_0.userData.socket = { "id": "character-stage", "localPosition": [2.3, 0.16, 1.2], "localRotation": [0, -0.78, 0], "purpose": "where the demo viewer's foreground character stands on the near pavement" };
  node_root_0.add(socket_root_character_stage_0);
  sockets["root:character-stage"] = socket_root_character_stage_0;
  const socket_root_camera_iso_1 = new THREE.Object3D();
  socket_root_camera_iso_1.name = "camera-iso";
  socket_root_camera_iso_1.position.set(12, 9.3, 12);
  socket_root_camera_iso_1.rotation.set(0, 0, 0);
  socket_root_camera_iso_1.userData.socket = { "id": "camera-iso", "localPosition": [12, 9.3, 12], "localRotation": [0, 0, 0], "purpose": "reference-matched isometric review camera position" };
  node_root_0.add(socket_root_camera_iso_1);
  sockets["root:camera-iso"] = socket_root_camera_iso_1;
  const attachment_rock_mass_1 = null;
  const endpoint_rock_mass_1 = makeAttachmentEndpoint(attachment_rock_mass_1);
  const node_rock_mass_1 = new THREE.Group();
  node_rock_mass_1.name = "Floating rock mass__pivot";
  node_rock_mass_1.scale.set(1, 1, 1);
  if (endpoint_rock_mass_1) {
    node_rock_mass_1.position.copy(endpoint_rock_mass_1.start);
    node_rock_mass_1.rotation.set(0, 0, 0);
  } else {
    node_rock_mass_1.position.set(0.15, 0, 0.2);
    node_rock_mass_1.rotation.set(0, 0, 0);
  }
  node_rock_mass_1.userData.sculptComponent = { "id": "rock-mass", "name": "Floating rock mass", "level": "macro", "role": "body", "importance": 0.9, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "one carved stone volume whose faceted flanks flow into each other; splitting it into boxes would put seams where the plate shows continuous rock", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[5.15, -0.3], [7.3, -1.45], [6.4, -2.4], [5.45, -3.4], [4.35, -4.4], [3.25, -5.5], [2.4, -6.3], [1.35, -7.1], [0.15, -7.7]], "segments": 9 }, "facetJitter": { "seed": 20250811, "amplitude": 0.32, "note": "postgen displaces lathe rings so the rock is not radially symmetric" } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [0.15, 0, 0.2], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "rock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rock" } }, "material": "rock", "materialLayers": ["rock"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["large flat triangular facets", "flares OUT below the slab to a maximum radius of 7.3 at depth 1.45, then tapers with 45-degree screen-space flanks (fitted to the plate's measured per-row silhouette: row 700 spans 159..867 px, row 860 spans 312..719 px, tip at row 990)", "blunt keel tip 7.7 units below the platform top"], "surfaceDetail": { "macroRoughness": 0.94, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["rock-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(13, 19, 37, 1.0)", "secondaryAlbedo": "rgba(30, 36, 54, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["rock-zone"], "samplingNotes": "plate-observed dominant #0d1325; reproduction albedo #1e2436; source: #0e1429 lit facet" } };
  node_rock_mass_1.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "rock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rock" } };
  (nodes["root"] ?? root).add(node_rock_mass_1);
  nodes["rock-mass"] = node_rock_mass_1;
  const mesh_rock_mass_1Geometry = endpoint_rock_mass_1 ? new THREE.CylinderGeometry(endpoint_rock_mass_1.endRadius, endpoint_rock_mass_1.baseRadius, endpoint_rock_mass_1.length, 8, 4) : buildLatheGeometry({ "points": [[5.15, -0.3], [7.3, -1.45], [6.4, -2.4], [5.45, -3.4], [4.35, -4.4], [3.25, -5.5], [2.4, -6.3], [1.35, -7.1], [0.15, -7.7]], "segments": 9 });
  if (!endpoint_rock_mass_1) {
    mesh_rock_mass_1Geometry.scale(1, 1, 1);
  }
  const mesh_rock_mass_1 = new THREE.Mesh(
    mesh_rock_mass_1Geometry,
    materialMap["rock"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_rock_mass_1.name = "Floating rock mass";
  if (endpoint_rock_mass_1) {
    mesh_rock_mass_1.position.copy(endpoint_rock_mass_1.midpoint);
    mesh_rock_mass_1.quaternion.copy(endpoint_rock_mass_1.quaternion);
  }
  mesh_rock_mass_1.castShadow = options.castShadow ?? true;
  mesh_rock_mass_1.receiveShadow = options.receiveShadow ?? true;
  mesh_rock_mass_1.userData.sculptComponent = node_rock_mass_1.userData.sculptComponent;
  node_rock_mass_1.add(mesh_rock_mass_1);
  meshes["rock-mass"] = mesh_rock_mass_1;
  colliders["rock-mass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["rock"] ?? (destructionGroups["rock"] = []);
  destructionGroups["rock"].push(node_rock_mass_1);
  const attachment_rock_spur_west_2 = null;
  const endpoint_rock_spur_west_2 = makeAttachmentEndpoint(attachment_rock_spur_west_2);
  const node_rock_spur_west_2 = new THREE.Group();
  node_rock_spur_west_2.name = "West rock spur__pivot";
  node_rock_spur_west_2.scale.set(1, 1, 1);
  if (endpoint_rock_spur_west_2) {
    node_rock_spur_west_2.position.copy(endpoint_rock_spur_west_2.start);
    node_rock_spur_west_2.rotation.set(0, 0, 0);
  } else {
    node_rock_spur_west_2.position.set(-2, -1.65, 1.3);
    node_rock_spur_west_2.rotation.set(0, 0, 0);
  }
  node_rock_spur_west_2.userData.sculptComponent = { "id": "rock-spur-west", "name": "West rock spur", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.55, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "a secondary carved bulge that breaks the main mass's radial symmetry; same continuous stone", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[2.25, -0.2], [1.95, -1.2], [1.1, -2.4], [0.15, -3.3]], "segments": 7 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.55 }, "transform": { "position": [-2, -1.65, 1.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "rock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rock-deep" } }, "material": "rock-deep", "materialLayers": ["rock-deep"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.96, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["rock-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(3, 7, 18, 1.0)", "secondaryAlbedo": "rgba(13, 18, 32, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["rock-zone"], "samplingNotes": "plate-observed dominant #030712; reproduction albedo #0d1220; source: #020611 deep facet" } };
  node_rock_spur_west_2.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "rock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rock-deep" } };
  (nodes["root"] ?? root).add(node_rock_spur_west_2);
  nodes["rock-spur-west"] = node_rock_spur_west_2;
  const mesh_rock_spur_west_2Geometry = endpoint_rock_spur_west_2 ? new THREE.CylinderGeometry(endpoint_rock_spur_west_2.endRadius, endpoint_rock_spur_west_2.baseRadius, endpoint_rock_spur_west_2.length, 8, 4) : buildLatheGeometry({ "points": [[2.25, -0.2], [1.95, -1.2], [1.1, -2.4], [0.15, -3.3]], "segments": 7 });
  if (!endpoint_rock_spur_west_2) {
    mesh_rock_spur_west_2Geometry.scale(1, 1, 1);
  }
  const mesh_rock_spur_west_2 = new THREE.Mesh(
    mesh_rock_spur_west_2Geometry,
    materialMap["rock-deep"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_rock_spur_west_2.name = "West rock spur";
  if (endpoint_rock_spur_west_2) {
    mesh_rock_spur_west_2.position.copy(endpoint_rock_spur_west_2.midpoint);
    mesh_rock_spur_west_2.quaternion.copy(endpoint_rock_spur_west_2.quaternion);
  }
  mesh_rock_spur_west_2.castShadow = options.castShadow ?? true;
  mesh_rock_spur_west_2.receiveShadow = options.receiveShadow ?? true;
  mesh_rock_spur_west_2.userData.sculptComponent = node_rock_spur_west_2.userData.sculptComponent;
  node_rock_spur_west_2.add(mesh_rock_spur_west_2);
  meshes["rock-spur-west"] = mesh_rock_spur_west_2;
  colliders["rock-spur-west"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["rock"] ?? (destructionGroups["rock"] = []);
  destructionGroups["rock"].push(node_rock_spur_west_2);
  const attachment_rock_spur_south_3 = null;
  const endpoint_rock_spur_south_3 = makeAttachmentEndpoint(attachment_rock_spur_south_3);
  const node_rock_spur_south_3 = new THREE.Group();
  node_rock_spur_south_3.name = "South rock spur__pivot";
  node_rock_spur_south_3.scale.set(1, 1, 1);
  if (endpoint_rock_spur_south_3) {
    node_rock_spur_south_3.position.copy(endpoint_rock_spur_south_3.start);
    node_rock_spur_south_3.rotation.set(0, 0, 0);
  } else {
    node_rock_spur_south_3.position.set(2.1, -2.2, 2.3);
    node_rock_spur_south_3.rotation.set(0, 0, 0);
  }
  node_rock_spur_south_3.userData.sculptComponent = { "id": "rock-spur-south", "name": "South rock spur", "level": "meso", "role": "body", "importance": 0.45, "confidence": 0.5, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "second asymmetric carved bulge under the front corner, continuous with the main mass", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[2, -0.2], [1.7, -1.1], [1, -2.2], [0.12, -3.1]], "segments": 7 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.5 }, "transform": { "position": [2.1, -2.2, 2.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "rock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rock-deep" } }, "material": "rock-deep", "materialLayers": ["rock-deep"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.96, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["rock-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(3, 7, 18, 1.0)", "secondaryAlbedo": "rgba(13, 18, 32, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["rock-zone"], "samplingNotes": "plate-observed dominant #030712; reproduction albedo #0d1220; source: #020611 deep facet" } };
  node_rock_spur_south_3.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "rock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "rock-deep" } };
  (nodes["root"] ?? root).add(node_rock_spur_south_3);
  nodes["rock-spur-south"] = node_rock_spur_south_3;
  const mesh_rock_spur_south_3Geometry = endpoint_rock_spur_south_3 ? new THREE.CylinderGeometry(endpoint_rock_spur_south_3.endRadius, endpoint_rock_spur_south_3.baseRadius, endpoint_rock_spur_south_3.length, 8, 4) : buildLatheGeometry({ "points": [[2, -0.2], [1.7, -1.1], [1, -2.2], [0.12, -3.1]], "segments": 7 });
  if (!endpoint_rock_spur_south_3) {
    mesh_rock_spur_south_3Geometry.scale(1, 1, 1);
  }
  const mesh_rock_spur_south_3 = new THREE.Mesh(
    mesh_rock_spur_south_3Geometry,
    materialMap["rock-deep"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_rock_spur_south_3.name = "South rock spur";
  if (endpoint_rock_spur_south_3) {
    mesh_rock_spur_south_3.position.copy(endpoint_rock_spur_south_3.midpoint);
    mesh_rock_spur_south_3.quaternion.copy(endpoint_rock_spur_south_3.quaternion);
  }
  mesh_rock_spur_south_3.castShadow = options.castShadow ?? true;
  mesh_rock_spur_south_3.receiveShadow = options.receiveShadow ?? true;
  mesh_rock_spur_south_3.userData.sculptComponent = node_rock_spur_south_3.userData.sculptComponent;
  node_rock_spur_south_3.add(mesh_rock_spur_south_3);
  meshes["rock-spur-south"] = mesh_rock_spur_south_3;
  colliders["rock-spur-south"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["rock"] ?? (destructionGroups["rock"] = []);
  destructionGroups["rock"].push(node_rock_spur_south_3);
  const attachment_platform_slab_4 = null;
  const endpoint_platform_slab_4 = makeAttachmentEndpoint(attachment_platform_slab_4);
  const node_platform_slab_4 = new THREE.Group();
  node_platform_slab_4.name = "Island platform slab__pivot";
  node_platform_slab_4.scale.set(1, 1, 1);
  if (endpoint_platform_slab_4) {
    node_platform_slab_4.position.copy(endpoint_platform_slab_4.start);
    node_platform_slab_4.rotation.set(0, 0, 0);
  } else {
    node_platform_slab_4.position.set(0, -0.25, 0);
    node_platform_slab_4.rotation.set(0, 0, 0);
  }
  node_platform_slab_4.userData.sculptComponent = { "id": "platform-slab", "name": "Island platform slab", "level": "macro", "role": "body", "importance": 0.85, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 10, "height": 0.5, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.9 }, "transform": { "position": [0, -0.25, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "platform", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "slab-edge" } }, "material": "slab-edge", "materialLayers": ["slab-edge"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["square plan, 10 x 10 units", "cool rim-lit side faces", "0.5 unit thickness"], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["rock-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(30, 39, 64, 1.0)", "secondaryAlbedo": "rgba(51, 64, 95, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["rock-zone"], "samplingNotes": "plate-observed dominant #1e2740; reproduction albedo #33405f; source: dark side face with a thin bright top-edge highlight in the plate" } };
  node_platform_slab_4.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "platform", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "slab-edge" } };
  (nodes["root"] ?? root).add(node_platform_slab_4);
  nodes["platform-slab"] = node_platform_slab_4;
  const mesh_platform_slab_4Geometry = endpoint_platform_slab_4 ? new THREE.CylinderGeometry(endpoint_platform_slab_4.endRadius, endpoint_platform_slab_4.baseRadius, endpoint_platform_slab_4.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_platform_slab_4) {
    mesh_platform_slab_4Geometry.scale(10, 0.5, 10);
  }
  const mesh_platform_slab_4 = new THREE.Mesh(
    mesh_platform_slab_4Geometry,
    materialMap["slab-edge"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_platform_slab_4.name = "Island platform slab";
  if (endpoint_platform_slab_4) {
    mesh_platform_slab_4.position.copy(endpoint_platform_slab_4.midpoint);
    mesh_platform_slab_4.quaternion.copy(endpoint_platform_slab_4.quaternion);
  }
  mesh_platform_slab_4.castShadow = options.castShadow ?? true;
  mesh_platform_slab_4.receiveShadow = options.receiveShadow ?? true;
  mesh_platform_slab_4.userData.sculptComponent = node_platform_slab_4.userData.sculptComponent;
  node_platform_slab_4.add(mesh_platform_slab_4);
  meshes["platform-slab"] = mesh_platform_slab_4;
  colliders["platform-slab"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["platform"] ?? (destructionGroups["platform"] = []);
  destructionGroups["platform"].push(node_platform_slab_4);
  const attachment_pavement_west_5 = null;
  const endpoint_pavement_west_5 = makeAttachmentEndpoint(attachment_pavement_west_5);
  const node_pavement_west_5 = new THREE.Group();
  node_pavement_west_5.name = "Pavement in front of the facade__pivot";
  node_pavement_west_5.scale.set(1, 1, 1);
  if (endpoint_pavement_west_5) {
    node_pavement_west_5.position.copy(endpoint_pavement_west_5.start);
    node_pavement_west_5.rotation.set(0, 0, 0);
  } else {
    node_pavement_west_5.position.set(-2.435, 0.08, 0);
    node_pavement_west_5.rotation.set(0, 0, 0);
  }
  node_pavement_west_5.userData.sculptComponent = { "id": "pavement-west", "name": "Pavement in front of the facade", "level": "macro", "role": "body", "importance": 0.7, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.93, "height": 0.16, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-2.435, 0.08, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pavement", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "pavement" } }, "material": "pavement", "materialLayers": ["pavement"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["flagstone strip 1.93 units wide between facade and kerb"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(102, 95, 116, 1.0)", "secondaryAlbedo": "rgba(86, 81, 96, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #665f74; reproduction albedo #565160; source: #665f74 lit / #334269 shadow" } };
  node_pavement_west_5.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pavement", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "pavement" } };
  (nodes["root"] ?? root).add(node_pavement_west_5);
  nodes["pavement-west"] = node_pavement_west_5;
  const mesh_pavement_west_5Geometry = endpoint_pavement_west_5 ? new THREE.CylinderGeometry(endpoint_pavement_west_5.endRadius, endpoint_pavement_west_5.baseRadius, endpoint_pavement_west_5.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_pavement_west_5) {
    mesh_pavement_west_5Geometry.scale(1.93, 0.16, 10);
  }
  const mesh_pavement_west_5 = new THREE.Mesh(
    mesh_pavement_west_5Geometry,
    materialMap["pavement"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pavement_west_5.name = "Pavement in front of the facade";
  if (endpoint_pavement_west_5) {
    mesh_pavement_west_5.position.copy(endpoint_pavement_west_5.midpoint);
    mesh_pavement_west_5.quaternion.copy(endpoint_pavement_west_5.quaternion);
  }
  mesh_pavement_west_5.castShadow = options.castShadow ?? true;
  mesh_pavement_west_5.receiveShadow = options.receiveShadow ?? true;
  mesh_pavement_west_5.userData.sculptComponent = node_pavement_west_5.userData.sculptComponent;
  node_pavement_west_5.add(mesh_pavement_west_5);
  meshes["pavement-west"] = mesh_pavement_west_5;
  colliders["pavement-west"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["pavement"] ?? (destructionGroups["pavement"] = []);
  destructionGroups["pavement"].push(node_pavement_west_5);
  const attachment_road_bed_6 = null;
  const endpoint_road_bed_6 = makeAttachmentEndpoint(attachment_road_bed_6);
  const node_road_bed_6 = new THREE.Group();
  node_road_bed_6.name = "Roadway bed under the setts__pivot";
  node_road_bed_6.scale.set(1, 1, 1);
  if (endpoint_road_bed_6) {
    node_road_bed_6.position.copy(endpoint_road_bed_6.start);
    node_road_bed_6.rotation.set(0, 0, 0);
  } else {
    node_road_bed_6.position.set(0.99, 0.05, 0);
    node_road_bed_6.rotation.set(0, 0, 0);
  }
  node_road_bed_6.userData.sculptComponent = { "id": "road-bed", "name": "Roadway bed under the setts", "level": "macro", "role": "body", "importance": 0.7, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 4.92, "height": 0.1, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [0.99, 0.05, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "road", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "road-joint" } }, "material": "road-joint", "materialLayers": ["road-joint"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["dark joint bed that reads as mortar between the cobble tops"], "surfaceDetail": { "macroRoughness": 0.95, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(33, 28, 48, 1.0)", "secondaryAlbedo": "rgba(42, 39, 64, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #211c30; reproduction albedo #2a2740; source: #211c30 cobble gap" } };
  node_road_bed_6.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "road", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "road-joint" } };
  (nodes["root"] ?? root).add(node_road_bed_6);
  nodes["road-bed"] = node_road_bed_6;
  const mesh_road_bed_6Geometry = endpoint_road_bed_6 ? new THREE.CylinderGeometry(endpoint_road_bed_6.endRadius, endpoint_road_bed_6.baseRadius, endpoint_road_bed_6.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_road_bed_6) {
    mesh_road_bed_6Geometry.scale(4.92, 0.1, 10);
  }
  const mesh_road_bed_6 = new THREE.Mesh(
    mesh_road_bed_6Geometry,
    materialMap["road-joint"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_road_bed_6.name = "Roadway bed under the setts";
  if (endpoint_road_bed_6) {
    mesh_road_bed_6.position.copy(endpoint_road_bed_6.midpoint);
    mesh_road_bed_6.quaternion.copy(endpoint_road_bed_6.quaternion);
  }
  mesh_road_bed_6.castShadow = options.castShadow ?? true;
  mesh_road_bed_6.receiveShadow = options.receiveShadow ?? true;
  mesh_road_bed_6.userData.sculptComponent = node_road_bed_6.userData.sculptComponent;
  node_road_bed_6.add(mesh_road_bed_6);
  meshes["road-bed"] = mesh_road_bed_6;
  colliders["road-bed"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["road"] ?? (destructionGroups["road"] = []);
  destructionGroups["road"].push(node_road_bed_6);
  const attachment_pavement_east_7 = null;
  const endpoint_pavement_east_7 = makeAttachmentEndpoint(attachment_pavement_east_7);
  const node_pavement_east_7 = new THREE.Group();
  node_pavement_east_7.name = "Near pavement__pivot";
  node_pavement_east_7.scale.set(1, 1, 1);
  if (endpoint_pavement_east_7) {
    node_pavement_east_7.position.copy(endpoint_pavement_east_7.start);
    node_pavement_east_7.rotation.set(0, 0, 0);
  } else {
    node_pavement_east_7.position.set(4.225, 0.08, 0);
    node_pavement_east_7.rotation.set(0, 0, 0);
  }
  node_pavement_east_7.userData.sculptComponent = { "id": "pavement-east", "name": "Near pavement", "level": "macro", "role": "body", "importance": 0.6, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.55, "height": 0.16, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [4.225, 0.08, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pavement", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "pavement" } }, "material": "pavement", "materialLayers": ["pavement"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["narrower near-side flagstone strip, 1.55 units"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(102, 95, 116, 1.0)", "secondaryAlbedo": "rgba(86, 81, 96, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #665f74; reproduction albedo #565160; source: #665f74 lit / #334269 shadow" } };
  node_pavement_east_7.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pavement", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "pavement" } };
  (nodes["root"] ?? root).add(node_pavement_east_7);
  nodes["pavement-east"] = node_pavement_east_7;
  const mesh_pavement_east_7Geometry = endpoint_pavement_east_7 ? new THREE.CylinderGeometry(endpoint_pavement_east_7.endRadius, endpoint_pavement_east_7.baseRadius, endpoint_pavement_east_7.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_pavement_east_7) {
    mesh_pavement_east_7Geometry.scale(1.55, 0.16, 10);
  }
  const mesh_pavement_east_7 = new THREE.Mesh(
    mesh_pavement_east_7Geometry,
    materialMap["pavement"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pavement_east_7.name = "Near pavement";
  if (endpoint_pavement_east_7) {
    mesh_pavement_east_7.position.copy(endpoint_pavement_east_7.midpoint);
    mesh_pavement_east_7.quaternion.copy(endpoint_pavement_east_7.quaternion);
  }
  mesh_pavement_east_7.castShadow = options.castShadow ?? true;
  mesh_pavement_east_7.receiveShadow = options.receiveShadow ?? true;
  mesh_pavement_east_7.userData.sculptComponent = node_pavement_east_7.userData.sculptComponent;
  node_pavement_east_7.add(mesh_pavement_east_7);
  meshes["pavement-east"] = mesh_pavement_east_7;
  colliders["pavement-east"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["pavement"] ?? (destructionGroups["pavement"] = []);
  destructionGroups["pavement"].push(node_pavement_east_7);
  const attachment_kerb_west_8 = null;
  const endpoint_kerb_west_8 = makeAttachmentEndpoint(attachment_kerb_west_8);
  const node_kerb_west_8 = new THREE.Group();
  node_kerb_west_8.name = "West kerb__pivot";
  node_kerb_west_8.scale.set(1, 1, 1);
  if (endpoint_kerb_west_8) {
    node_kerb_west_8.position.copy(endpoint_kerb_west_8.start);
    node_kerb_west_8.rotation.set(0, 0, 0);
  } else {
    node_kerb_west_8.position.set(-1.56, 0.12, 0);
    node_kerb_west_8.rotation.set(0, 0, 0);
  }
  node_kerb_west_8.userData.sculptComponent = { "id": "kerb-west", "name": "West kerb", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.18, "height": 0.24, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-1.56, 0.12, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "kerb", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "kerb-stone" } }, "material": "kerb-stone", "materialLayers": ["kerb-stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["raised kerb line separating pavement from setts"], "surfaceDetail": { "macroRoughness": 0.82, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(56, 65, 98, 1.0)", "secondaryAlbedo": "rgba(134, 142, 173, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #384162; reproduction albedo #868ead; source: #384162 kerb face" } };
  node_kerb_west_8.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "kerb", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "kerb-stone" } };
  (nodes["root"] ?? root).add(node_kerb_west_8);
  nodes["kerb-west"] = node_kerb_west_8;
  const mesh_kerb_west_8Geometry = endpoint_kerb_west_8 ? new THREE.CylinderGeometry(endpoint_kerb_west_8.endRadius, endpoint_kerb_west_8.baseRadius, endpoint_kerb_west_8.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_kerb_west_8) {
    mesh_kerb_west_8Geometry.scale(0.18, 0.24, 10);
  }
  const mesh_kerb_west_8 = new THREE.Mesh(
    mesh_kerb_west_8Geometry,
    materialMap["kerb-stone"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_kerb_west_8.name = "West kerb";
  if (endpoint_kerb_west_8) {
    mesh_kerb_west_8.position.copy(endpoint_kerb_west_8.midpoint);
    mesh_kerb_west_8.quaternion.copy(endpoint_kerb_west_8.quaternion);
  }
  mesh_kerb_west_8.castShadow = options.castShadow ?? true;
  mesh_kerb_west_8.receiveShadow = options.receiveShadow ?? true;
  mesh_kerb_west_8.userData.sculptComponent = node_kerb_west_8.userData.sculptComponent;
  node_kerb_west_8.add(mesh_kerb_west_8);
  meshes["kerb-west"] = mesh_kerb_west_8;
  colliders["kerb-west"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["kerb"] ?? (destructionGroups["kerb"] = []);
  destructionGroups["kerb"].push(node_kerb_west_8);
  const attachment_kerb_east_9 = null;
  const endpoint_kerb_east_9 = makeAttachmentEndpoint(attachment_kerb_east_9);
  const node_kerb_east_9 = new THREE.Group();
  node_kerb_east_9.name = "Near kerb__pivot";
  node_kerb_east_9.scale.set(1, 1, 1);
  if (endpoint_kerb_east_9) {
    node_kerb_east_9.position.copy(endpoint_kerb_east_9.start);
    node_kerb_east_9.rotation.set(0, 0, 0);
  } else {
    node_kerb_east_9.position.set(3.54, 0.12, 0);
    node_kerb_east_9.rotation.set(0, 0, 0);
  }
  node_kerb_east_9.userData.sculptComponent = { "id": "kerb-east", "name": "Near kerb", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.18, "height": 0.24, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [3.54, 0.12, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "kerb", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "kerb-stone" } }, "material": "kerb-stone", "materialLayers": ["kerb-stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["raised near-side kerb line"], "surfaceDetail": { "macroRoughness": 0.82, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(56, 65, 98, 1.0)", "secondaryAlbedo": "rgba(134, 142, 173, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #384162; reproduction albedo #868ead; source: #384162 kerb face" } };
  node_kerb_east_9.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "kerb", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "kerb-stone" } };
  (nodes["root"] ?? root).add(node_kerb_east_9);
  nodes["kerb-east"] = node_kerb_east_9;
  const mesh_kerb_east_9Geometry = endpoint_kerb_east_9 ? new THREE.CylinderGeometry(endpoint_kerb_east_9.endRadius, endpoint_kerb_east_9.baseRadius, endpoint_kerb_east_9.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_kerb_east_9) {
    mesh_kerb_east_9Geometry.scale(0.18, 0.24, 10);
  }
  const mesh_kerb_east_9 = new THREE.Mesh(
    mesh_kerb_east_9Geometry,
    materialMap["kerb-stone"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_kerb_east_9.name = "Near kerb";
  if (endpoint_kerb_east_9) {
    mesh_kerb_east_9.position.copy(endpoint_kerb_east_9.midpoint);
    mesh_kerb_east_9.quaternion.copy(endpoint_kerb_east_9.quaternion);
  }
  mesh_kerb_east_9.castShadow = options.castShadow ?? true;
  mesh_kerb_east_9.receiveShadow = options.receiveShadow ?? true;
  mesh_kerb_east_9.userData.sculptComponent = node_kerb_east_9.userData.sculptComponent;
  node_kerb_east_9.add(mesh_kerb_east_9);
  meshes["kerb-east"] = mesh_kerb_east_9;
  colliders["kerb-east"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["kerb"] ?? (destructionGroups["kerb"] = []);
  destructionGroups["kerb"].push(node_kerb_east_9);
  const attachment_cobble_field_10 = null;
  const endpoint_cobble_field_10 = makeAttachmentEndpoint(attachment_cobble_field_10);
  const node_cobble_field_10 = new THREE.Group();
  node_cobble_field_10.name = "Cobbled sett field__pivot";
  node_cobble_field_10.scale.set(1, 1, 1);
  if (endpoint_cobble_field_10) {
    node_cobble_field_10.position.copy(endpoint_cobble_field_10.start);
    node_cobble_field_10.rotation.set(0, 0, 0);
  } else {
    node_cobble_field_10.position.set(0.99, 0.11, 0);
    node_cobble_field_10.rotation.set(0, 0, 0);
  }
  node_cobble_field_10.userData.sculptComponent = { "id": "cobble-field", "name": "Cobbled sett field", "level": "meso", "role": "body", "importance": 0.75, "confidence": 0.8, "primitive": "instanced-cluster", "topologyClass": "surface-relief", "topologyRationale": "a field of shallow sett tops sitting on the road bed: relief on a host surface, not a volume of its own", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "instanceBase": "box", "gridPlacement": { "mode": "staggered-grid", "cell": [0.55, 0.32], "jitter": 0.055, "valueJitter": 0.16, "seed": 90210, "note": "emitted by postgen as one InstancedMesh of top-face setts" } }, "parent": "root", "attachment": null, "dimensions": { "width": 4.6, "height": 0.06, "depth": 9.6, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [0.99, 0.11, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cobble", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cobble" } }, "material": "cobble", "materialLayers": ["cobble"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["staggered sett courses running along the street axis", "per-sett value jitter", "dark joints from the road bed showing between tops"], "surfaceDetail": { "macroRoughness": 0.86, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(76, 74, 107, 1.0)", "secondaryAlbedo": "rgba(107, 102, 127, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #4c4a6b; reproduction albedo #6b667f; source: #4e4965 sett top / #211c30 joint" } };
  node_cobble_field_10.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cobble", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cobble" } };
  (nodes["root"] ?? root).add(node_cobble_field_10);
  nodes["cobble-field"] = node_cobble_field_10;
  const mesh_cobble_field_10Geometry = endpoint_cobble_field_10 ? new THREE.CylinderGeometry(endpoint_cobble_field_10.endRadius, endpoint_cobble_field_10.baseRadius, endpoint_cobble_field_10.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cobble_field_10) {
    mesh_cobble_field_10Geometry.scale(4.6, 0.06, 9.6);
  }
  const mesh_cobble_field_10 = new THREE.Mesh(
    mesh_cobble_field_10Geometry,
    materialMap["cobble"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cobble_field_10.name = "Cobbled sett field";
  if (endpoint_cobble_field_10) {
    mesh_cobble_field_10.position.copy(endpoint_cobble_field_10.midpoint);
    mesh_cobble_field_10.quaternion.copy(endpoint_cobble_field_10.quaternion);
  }
  mesh_cobble_field_10.castShadow = options.castShadow ?? true;
  mesh_cobble_field_10.receiveShadow = options.receiveShadow ?? true;
  mesh_cobble_field_10.userData.sculptComponent = node_cobble_field_10.userData.sculptComponent;
  node_cobble_field_10.add(mesh_cobble_field_10);
  meshes["cobble-field"] = mesh_cobble_field_10;
  colliders["cobble-field"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cobble"] ?? (destructionGroups["cobble"] = []);
  destructionGroups["cobble"].push(node_cobble_field_10);
  const attachment_building_south_11 = null;
  const endpoint_building_south_11 = makeAttachmentEndpoint(attachment_building_south_11);
  const node_building_south_11 = new THREE.Group();
  node_building_south_11.name = "Terrace block, south bay__pivot";
  node_building_south_11.scale.set(1, 1, 1);
  if (endpoint_building_south_11) {
    node_building_south_11.position.copy(endpoint_building_south_11.start);
    node_building_south_11.rotation.set(0, 0, 0);
  } else {
    node_building_south_11.position.set(-4.2, 3.925, 2.4);
    node_building_south_11.rotation.set(0, 0, 0);
  }
  node_building_south_11.userData.sculptComponent = { "id": "building-south", "name": "Terrace block, south bay", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.6, "height": 7.85, "depth": 5.2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-4.2, 3.925, 2.4], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "building", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-facade" } }, "material": "brick-facade", "materialLayers": ["brick-facade"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["two-storey brick block flush with the platform's south-west edge", "wall stops at 7.85 so the rear-pitched roof caps it"], "surfaceDetail": { "macroRoughness": 0.88, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(99, 62, 67, 1.0)", "secondaryAlbedo": "rgba(116, 70, 74, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #633e43; reproduction albedo #74464a; source: #633e43 unlit field / #985a41 under lamp" } };
  node_building_south_11.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "building", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-facade" } };
  (nodes["root"] ?? root).add(node_building_south_11);
  nodes["building-south"] = node_building_south_11;
  const mesh_building_south_11Geometry = endpoint_building_south_11 ? new THREE.CylinderGeometry(endpoint_building_south_11.endRadius, endpoint_building_south_11.baseRadius, endpoint_building_south_11.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_building_south_11) {
    mesh_building_south_11Geometry.scale(1.6, 7.85, 5.2);
  }
  const mesh_building_south_11 = new THREE.Mesh(
    mesh_building_south_11Geometry,
    materialMap["brick-facade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_building_south_11.name = "Terrace block, south bay";
  if (endpoint_building_south_11) {
    mesh_building_south_11.position.copy(endpoint_building_south_11.midpoint);
    mesh_building_south_11.quaternion.copy(endpoint_building_south_11.quaternion);
  }
  mesh_building_south_11.castShadow = options.castShadow ?? true;
  mesh_building_south_11.receiveShadow = options.receiveShadow ?? true;
  mesh_building_south_11.userData.sculptComponent = node_building_south_11.userData.sculptComponent;
  node_building_south_11.add(mesh_building_south_11);
  meshes["building-south"] = mesh_building_south_11;
  colliders["building-south"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["building"] ?? (destructionGroups["building"] = []);
  destructionGroups["building"].push(node_building_south_11);
  const attachment_building_north_12 = null;
  const endpoint_building_north_12 = makeAttachmentEndpoint(attachment_building_north_12);
  const node_building_north_12 = new THREE.Group();
  node_building_north_12.name = "Terrace block, north bay__pivot";
  node_building_north_12.scale.set(1, 1, 1);
  if (endpoint_building_north_12) {
    node_building_north_12.position.copy(endpoint_building_north_12.start);
    node_building_north_12.rotation.set(0, 0, 0);
  } else {
    node_building_north_12.position.set(-4.2, 3.925, -2.6);
    node_building_north_12.rotation.set(0, 0, 0);
  }
  node_building_north_12.userData.sculptComponent = { "id": "building-north", "name": "Terrace block, north bay", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.6, "height": 7.85, "depth": 4.8, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-4.2, 3.925, -2.6], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "building", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-facade" } }, "material": "brick-facade", "materialLayers": ["brick-facade"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["north bay carries the wider window rhythm and the north quoin"], "surfaceDetail": { "macroRoughness": 0.88, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(99, 62, 67, 1.0)", "secondaryAlbedo": "rgba(116, 70, 74, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #633e43; reproduction albedo #74464a; source: #633e43 unlit field / #985a41 under lamp" } };
  node_building_north_12.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "building", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-facade" } };
  (nodes["root"] ?? root).add(node_building_north_12);
  nodes["building-north"] = node_building_north_12;
  const mesh_building_north_12Geometry = endpoint_building_north_12 ? new THREE.CylinderGeometry(endpoint_building_north_12.endRadius, endpoint_building_north_12.baseRadius, endpoint_building_north_12.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_building_north_12) {
    mesh_building_north_12Geometry.scale(1.6, 7.85, 4.8);
  }
  const mesh_building_north_12 = new THREE.Mesh(
    mesh_building_north_12Geometry,
    materialMap["brick-facade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_building_north_12.name = "Terrace block, north bay";
  if (endpoint_building_north_12) {
    mesh_building_north_12.position.copy(endpoint_building_north_12.midpoint);
    mesh_building_north_12.quaternion.copy(endpoint_building_north_12.quaternion);
  }
  mesh_building_north_12.castShadow = options.castShadow ?? true;
  mesh_building_north_12.receiveShadow = options.receiveShadow ?? true;
  mesh_building_north_12.userData.sculptComponent = node_building_north_12.userData.sculptComponent;
  node_building_north_12.add(mesh_building_north_12);
  meshes["building-north"] = mesh_building_north_12;
  colliders["building-north"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["building"] ?? (destructionGroups["building"] = []);
  destructionGroups["building"].push(node_building_north_12);
  const attachment_gable_end_south_13 = null;
  const endpoint_gable_end_south_13 = makeAttachmentEndpoint(attachment_gable_end_south_13);
  const node_gable_end_south_13 = new THREE.Group();
  node_gable_end_south_13.name = "South gable end wall__pivot";
  node_gable_end_south_13.scale.set(1, 1, 1);
  if (endpoint_gable_end_south_13) {
    node_gable_end_south_13.position.copy(endpoint_gable_end_south_13.start);
    node_gable_end_south_13.rotation.set(0, 0, 0);
  } else {
    node_gable_end_south_13.position.set(-4.2, 3.9, 4.94);
    node_gable_end_south_13.rotation.set(0, 0, 0);
  }
  node_gable_end_south_13.userData.sculptComponent = { "id": "gable-end-south", "name": "South gable end wall", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.62, "height": 7.8, "depth": 0.14, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-4.2, 3.9, 4.94], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gable", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wall-shadow" } }, "material": "wall-shadow", "materialLayers": ["wall-shadow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["flat unlit end wall facing the platform's south-west edge"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(9, 10, 30, 1.0)", "secondaryAlbedo": "rgba(43, 51, 82, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #090a1e; reproduction albedo #2b3352; source: #090a1e gable" } };
  node_gable_end_south_13.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gable", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wall-shadow" } };
  (nodes["root"] ?? root).add(node_gable_end_south_13);
  nodes["gable-end-south"] = node_gable_end_south_13;
  const mesh_gable_end_south_13Geometry = endpoint_gable_end_south_13 ? new THREE.CylinderGeometry(endpoint_gable_end_south_13.endRadius, endpoint_gable_end_south_13.baseRadius, endpoint_gable_end_south_13.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_gable_end_south_13) {
    mesh_gable_end_south_13Geometry.scale(1.62, 7.8, 0.14);
  }
  const mesh_gable_end_south_13 = new THREE.Mesh(
    mesh_gable_end_south_13Geometry,
    materialMap["wall-shadow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_gable_end_south_13.name = "South gable end wall";
  if (endpoint_gable_end_south_13) {
    mesh_gable_end_south_13.position.copy(endpoint_gable_end_south_13.midpoint);
    mesh_gable_end_south_13.quaternion.copy(endpoint_gable_end_south_13.quaternion);
  }
  mesh_gable_end_south_13.castShadow = options.castShadow ?? true;
  mesh_gable_end_south_13.receiveShadow = options.receiveShadow ?? true;
  mesh_gable_end_south_13.userData.sculptComponent = node_gable_end_south_13.userData.sculptComponent;
  node_gable_end_south_13.add(mesh_gable_end_south_13);
  meshes["gable-end-south"] = mesh_gable_end_south_13;
  colliders["gable-end-south"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["gable"] ?? (destructionGroups["gable"] = []);
  destructionGroups["gable"].push(node_gable_end_south_13);
  const attachment_roof_south_14 = null;
  const endpoint_roof_south_14 = makeAttachmentEndpoint(attachment_roof_south_14);
  const node_roof_south_14 = new THREE.Group();
  node_roof_south_14.name = "South bay roof slab (pitched to the rear)__pivot";
  node_roof_south_14.scale.set(1, 1, 1);
  if (endpoint_roof_south_14) {
    node_roof_south_14.position.copy(endpoint_roof_south_14.start);
    node_roof_south_14.rotation.set(0, 0, 0.4);
  } else {
    node_roof_south_14.position.set(-4.32, 7.94, 2.4);
    node_roof_south_14.rotation.set(0, 0, 0.4);
  }
  node_roof_south_14.userData.sculptComponent = { "id": "roof-south", "name": "South bay roof slab (pitched to the rear)", "level": "macro", "role": "body", "importance": 0.75, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 2, "height": 0.26, "depth": 5.3, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-4.32, 7.94, 2.4], "rotation": [0, 0, 0.4] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "roof", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "roof-slab" } }, "material": "roof-slab", "materialLayers": ["roof-slab"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["lead roof pitched about 23 degrees down toward the rear, so the FACADE eave (not the back edge) is the plate's upper-left silhouette boundary", "sky-lit navy top face (#182c61 sampled)"], "surfaceDetail": { "macroRoughness": 0.78, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(24, 44, 97, 1.0)", "secondaryAlbedo": "rgba(43, 53, 86, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #182c61; reproduction albedo #2b3556; source: #182c61 roof top face / #162c61 pier cap" } };
  node_roof_south_14.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "roof", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "roof-slab" } };
  (nodes["root"] ?? root).add(node_roof_south_14);
  nodes["roof-south"] = node_roof_south_14;
  const mesh_roof_south_14Geometry = endpoint_roof_south_14 ? new THREE.CylinderGeometry(endpoint_roof_south_14.endRadius, endpoint_roof_south_14.baseRadius, endpoint_roof_south_14.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_roof_south_14) {
    mesh_roof_south_14Geometry.scale(2, 0.26, 5.3);
  }
  const mesh_roof_south_14 = new THREE.Mesh(
    mesh_roof_south_14Geometry,
    materialMap["roof-slab"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_roof_south_14.name = "South bay roof slab (pitched to the rear)";
  if (endpoint_roof_south_14) {
    mesh_roof_south_14.position.copy(endpoint_roof_south_14.midpoint);
    mesh_roof_south_14.quaternion.copy(endpoint_roof_south_14.quaternion);
  }
  mesh_roof_south_14.castShadow = options.castShadow ?? true;
  mesh_roof_south_14.receiveShadow = options.receiveShadow ?? true;
  mesh_roof_south_14.userData.sculptComponent = node_roof_south_14.userData.sculptComponent;
  node_roof_south_14.add(mesh_roof_south_14);
  meshes["roof-south"] = mesh_roof_south_14;
  colliders["roof-south"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["roof"] ?? (destructionGroups["roof"] = []);
  destructionGroups["roof"].push(node_roof_south_14);
  const attachment_roof_north_15 = null;
  const endpoint_roof_north_15 = makeAttachmentEndpoint(attachment_roof_north_15);
  const node_roof_north_15 = new THREE.Group();
  node_roof_north_15.name = "North bay roof slab (pitched to the rear)__pivot";
  node_roof_north_15.scale.set(1, 1, 1);
  if (endpoint_roof_north_15) {
    node_roof_north_15.position.copy(endpoint_roof_north_15.start);
    node_roof_north_15.rotation.set(0, 0, 0.4);
  } else {
    node_roof_north_15.position.set(-4.32, 7.94, -2.6);
    node_roof_north_15.rotation.set(0, 0, 0.4);
  }
  node_roof_north_15.userData.sculptComponent = { "id": "roof-north", "name": "North bay roof slab (pitched to the rear)", "level": "macro", "role": "body", "importance": 0.75, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 2, "height": 0.26, "depth": 4.9, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-4.32, 7.94, -2.6], "rotation": [0, 0, 0.4] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "roof", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "roof-slab" } }, "material": "roof-slab", "materialLayers": ["roof-slab"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["same rear pitch continued over the north bay"], "surfaceDetail": { "macroRoughness": 0.78, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(24, 44, 97, 1.0)", "secondaryAlbedo": "rgba(43, 53, 86, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #182c61; reproduction albedo #2b3556; source: #182c61 roof top face / #162c61 pier cap" } };
  node_roof_north_15.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "roof", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "roof-slab" } };
  (nodes["root"] ?? root).add(node_roof_north_15);
  nodes["roof-north"] = node_roof_north_15;
  const mesh_roof_north_15Geometry = endpoint_roof_north_15 ? new THREE.CylinderGeometry(endpoint_roof_north_15.endRadius, endpoint_roof_north_15.baseRadius, endpoint_roof_north_15.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_roof_north_15) {
    mesh_roof_north_15Geometry.scale(2, 0.26, 4.9);
  }
  const mesh_roof_north_15 = new THREE.Mesh(
    mesh_roof_north_15Geometry,
    materialMap["roof-slab"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_roof_north_15.name = "North bay roof slab (pitched to the rear)";
  if (endpoint_roof_north_15) {
    mesh_roof_north_15.position.copy(endpoint_roof_north_15.midpoint);
    mesh_roof_north_15.quaternion.copy(endpoint_roof_north_15.quaternion);
  }
  mesh_roof_north_15.castShadow = options.castShadow ?? true;
  mesh_roof_north_15.receiveShadow = options.receiveShadow ?? true;
  mesh_roof_north_15.userData.sculptComponent = node_roof_north_15.userData.sculptComponent;
  node_roof_north_15.add(mesh_roof_north_15);
  meshes["roof-north"] = mesh_roof_north_15;
  colliders["roof-north"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["roof"] ?? (destructionGroups["roof"] = []);
  destructionGroups["roof"].push(node_roof_north_15);
  const attachment_cornice_south_16 = null;
  const endpoint_cornice_south_16 = makeAttachmentEndpoint(attachment_cornice_south_16);
  const node_cornice_south_16 = new THREE.Group();
  node_cornice_south_16.name = "South cornice band__pivot";
  node_cornice_south_16.scale.set(1, 1, 1);
  if (endpoint_cornice_south_16) {
    node_cornice_south_16.position.copy(endpoint_cornice_south_16.start);
    node_cornice_south_16.rotation.set(0, 0, 0);
  } else {
    node_cornice_south_16.position.set(-3.27, 8.16, 2.4);
    node_cornice_south_16.rotation.set(0, 0, 0);
  }
  node_cornice_south_16.userData.sculptComponent = { "id": "cornice-south", "name": "South cornice band", "level": "macro", "role": "body", "importance": 0.7, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.34, "height": 0.62, "depth": 5.32, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.27, 8.16, 2.4], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cornice", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["projecting stone band that forms the facade eave line at y=8.47"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_cornice_south_16.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cornice", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_cornice_south_16);
  nodes["cornice-south"] = node_cornice_south_16;
  const mesh_cornice_south_16Geometry = endpoint_cornice_south_16 ? new THREE.CylinderGeometry(endpoint_cornice_south_16.endRadius, endpoint_cornice_south_16.baseRadius, endpoint_cornice_south_16.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cornice_south_16) {
    mesh_cornice_south_16Geometry.scale(0.34, 0.62, 5.32);
  }
  const mesh_cornice_south_16 = new THREE.Mesh(
    mesh_cornice_south_16Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cornice_south_16.name = "South cornice band";
  if (endpoint_cornice_south_16) {
    mesh_cornice_south_16.position.copy(endpoint_cornice_south_16.midpoint);
    mesh_cornice_south_16.quaternion.copy(endpoint_cornice_south_16.quaternion);
  }
  mesh_cornice_south_16.castShadow = options.castShadow ?? true;
  mesh_cornice_south_16.receiveShadow = options.receiveShadow ?? true;
  mesh_cornice_south_16.userData.sculptComponent = node_cornice_south_16.userData.sculptComponent;
  node_cornice_south_16.add(mesh_cornice_south_16);
  meshes["cornice-south"] = mesh_cornice_south_16;
  colliders["cornice-south"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cornice"] ?? (destructionGroups["cornice"] = []);
  destructionGroups["cornice"].push(node_cornice_south_16);
  const attachment_cornice_north_17 = null;
  const endpoint_cornice_north_17 = makeAttachmentEndpoint(attachment_cornice_north_17);
  const node_cornice_north_17 = new THREE.Group();
  node_cornice_north_17.name = "North cornice band__pivot";
  node_cornice_north_17.scale.set(1, 1, 1);
  if (endpoint_cornice_north_17) {
    node_cornice_north_17.position.copy(endpoint_cornice_north_17.start);
    node_cornice_north_17.rotation.set(0, 0, 0);
  } else {
    node_cornice_north_17.position.set(-3.27, 8.16, -2.6);
    node_cornice_north_17.rotation.set(0, 0, 0);
  }
  node_cornice_north_17.userData.sculptComponent = { "id": "cornice-north", "name": "North cornice band", "level": "macro", "role": "body", "importance": 0.7, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.34, "height": 0.62, "depth": 4.92, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.27, 8.16, -2.6], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cornice", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["projecting stone band that forms the facade eave line at y=8.47"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_cornice_north_17.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cornice", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_cornice_north_17);
  nodes["cornice-north"] = node_cornice_north_17;
  const mesh_cornice_north_17Geometry = endpoint_cornice_north_17 ? new THREE.CylinderGeometry(endpoint_cornice_north_17.endRadius, endpoint_cornice_north_17.baseRadius, endpoint_cornice_north_17.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cornice_north_17) {
    mesh_cornice_north_17Geometry.scale(0.34, 0.62, 4.92);
  }
  const mesh_cornice_north_17 = new THREE.Mesh(
    mesh_cornice_north_17Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cornice_north_17.name = "North cornice band";
  if (endpoint_cornice_north_17) {
    mesh_cornice_north_17.position.copy(endpoint_cornice_north_17.midpoint);
    mesh_cornice_north_17.quaternion.copy(endpoint_cornice_north_17.quaternion);
  }
  mesh_cornice_north_17.castShadow = options.castShadow ?? true;
  mesh_cornice_north_17.receiveShadow = options.receiveShadow ?? true;
  mesh_cornice_north_17.userData.sculptComponent = node_cornice_north_17.userData.sculptComponent;
  node_cornice_north_17.add(mesh_cornice_north_17);
  meshes["cornice-north"] = mesh_cornice_north_17;
  colliders["cornice-north"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cornice"] ?? (destructionGroups["cornice"] = []);
  destructionGroups["cornice"].push(node_cornice_north_17);
  const attachment_plinth_course_18 = null;
  const endpoint_plinth_course_18 = makeAttachmentEndpoint(attachment_plinth_course_18);
  const node_plinth_course_18 = new THREE.Group();
  node_plinth_course_18.name = "Stone plinth course__pivot";
  node_plinth_course_18.scale.set(1, 1, 1);
  if (endpoint_plinth_course_18) {
    node_plinth_course_18.position.copy(endpoint_plinth_course_18.start);
    node_plinth_course_18.rotation.set(0, 0, 0);
  } else {
    node_plinth_course_18.position.set(-3.31, 0.45, 0);
    node_plinth_course_18.rotation.set(0, 0, 0);
  }
  node_plinth_course_18.userData.sculptComponent = { "id": "plinth-course", "name": "Stone plinth course", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.2, "height": 0.9, "depth": 10, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.31, 0.45, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "plinth", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } }, "material": "stone-plinth", "materialLayers": ["stone-plinth"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stall-riser height plinth along the whole facade"], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(64, 55, 71, 1.0)", "secondaryAlbedo": "rgba(124, 122, 143, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #403747; reproduction albedo #7c7a8f; source: #403747 door surround" } };
  node_plinth_course_18.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "plinth", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } };
  (nodes["root"] ?? root).add(node_plinth_course_18);
  nodes["plinth-course"] = node_plinth_course_18;
  const mesh_plinth_course_18Geometry = endpoint_plinth_course_18 ? new THREE.CylinderGeometry(endpoint_plinth_course_18.endRadius, endpoint_plinth_course_18.baseRadius, endpoint_plinth_course_18.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_plinth_course_18) {
    mesh_plinth_course_18Geometry.scale(0.2, 0.9, 10);
  }
  const mesh_plinth_course_18 = new THREE.Mesh(
    mesh_plinth_course_18Geometry,
    materialMap["stone-plinth"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_plinth_course_18.name = "Stone plinth course";
  if (endpoint_plinth_course_18) {
    mesh_plinth_course_18.position.copy(endpoint_plinth_course_18.midpoint);
    mesh_plinth_course_18.quaternion.copy(endpoint_plinth_course_18.quaternion);
  }
  mesh_plinth_course_18.castShadow = options.castShadow ?? true;
  mesh_plinth_course_18.receiveShadow = options.receiveShadow ?? true;
  mesh_plinth_course_18.userData.sculptComponent = node_plinth_course_18.userData.sculptComponent;
  node_plinth_course_18.add(mesh_plinth_course_18);
  meshes["plinth-course"] = mesh_plinth_course_18;
  colliders["plinth-course"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["plinth"] ?? (destructionGroups["plinth"] = []);
  destructionGroups["plinth"].push(node_plinth_course_18);
  const attachment_quoin_north_19 = null;
  const endpoint_quoin_north_19 = makeAttachmentEndpoint(attachment_quoin_north_19);
  const node_quoin_north_19 = new THREE.Group();
  node_quoin_north_19.name = "North corner quoin band__pivot";
  node_quoin_north_19.scale.set(1, 1, 1);
  if (endpoint_quoin_north_19) {
    node_quoin_north_19.position.copy(endpoint_quoin_north_19.start);
    node_quoin_north_19.rotation.set(0, 0, 0);
  } else {
    node_quoin_north_19.position.set(-3.3, 4.05, -4.72);
    node_quoin_north_19.rotation.set(0, 0, 0);
  }
  node_quoin_north_19.userData.sculptComponent = { "id": "quoin-north", "name": "North corner quoin band", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.22, "height": 8.1, "depth": 0.56, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.3, 4.05, -4.72], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "quoin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["vertical stone corner band; the plate's brightest warm-lit vertical stripe"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_quoin_north_19.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "quoin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_quoin_north_19);
  nodes["quoin-north"] = node_quoin_north_19;
  const mesh_quoin_north_19Geometry = endpoint_quoin_north_19 ? new THREE.CylinderGeometry(endpoint_quoin_north_19.endRadius, endpoint_quoin_north_19.baseRadius, endpoint_quoin_north_19.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_quoin_north_19) {
    mesh_quoin_north_19Geometry.scale(0.22, 8.1, 0.56);
  }
  const mesh_quoin_north_19 = new THREE.Mesh(
    mesh_quoin_north_19Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_quoin_north_19.name = "North corner quoin band";
  if (endpoint_quoin_north_19) {
    mesh_quoin_north_19.position.copy(endpoint_quoin_north_19.midpoint);
    mesh_quoin_north_19.quaternion.copy(endpoint_quoin_north_19.quaternion);
  }
  mesh_quoin_north_19.castShadow = options.castShadow ?? true;
  mesh_quoin_north_19.receiveShadow = options.receiveShadow ?? true;
  mesh_quoin_north_19.userData.sculptComponent = node_quoin_north_19.userData.sculptComponent;
  node_quoin_north_19.add(mesh_quoin_north_19);
  meshes["quoin-north"] = mesh_quoin_north_19;
  colliders["quoin-north"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["quoin"] ?? (destructionGroups["quoin"] = []);
  destructionGroups["quoin"].push(node_quoin_north_19);
  const attachment_brick_relief_20 = null;
  const endpoint_brick_relief_20 = makeAttachmentEndpoint(attachment_brick_relief_20);
  const node_brick_relief_20 = new THREE.Group();
  node_brick_relief_20.name = "Protruding brick header scatter__pivot";
  node_brick_relief_20.scale.set(1, 1, 1);
  if (endpoint_brick_relief_20) {
    node_brick_relief_20.position.copy(endpoint_brick_relief_20.start);
    node_brick_relief_20.rotation.set(0, 0, 0);
  } else {
    node_brick_relief_20.position.set(-3.35, 4.6, -1);
    node_brick_relief_20.rotation.set(0, 0, 0);
  }
  node_brick_relief_20.userData.sculptComponent = { "id": "brick-relief", "name": "Protruding brick header scatter", "level": "micro", "role": "body", "importance": 0.7, "confidence": 0.7, "primitive": "instanced-cluster", "topologyClass": "surface-relief", "topologyRationale": "single header bricks pushed proud of the wall face: relief carved onto the facade shell", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "instanceBase": "box", "gridPlacement": { "mode": "facade-scatter", "seed": 4711, "count": 46, "bandsY": [1.2, 8], "bandsZ": [-4.9, 4.9], "note": "emitted by postgen as one InstancedMesh on the x=-3.4 facade plane" } }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 0.13, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.35, 4.6, -1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "brick", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-facade" } }, "material": "brick-facade", "materialLayers": ["brick-facade"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["scattered single headers standing ~0.08 proud of the brick face", "denser near the north quoin and between window bays"], "surfaceDetail": { "macroRoughness": 0.88, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(99, 62, 67, 1.0)", "secondaryAlbedo": "rgba(116, 70, 74, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #633e43; reproduction albedo #74464a; source: #633e43 unlit field / #985a41 under lamp" } };
  node_brick_relief_20.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "brick", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-facade" } };
  (nodes["root"] ?? root).add(node_brick_relief_20);
  nodes["brick-relief"] = node_brick_relief_20;
  const mesh_brick_relief_20Geometry = endpoint_brick_relief_20 ? new THREE.CylinderGeometry(endpoint_brick_relief_20.endRadius, endpoint_brick_relief_20.baseRadius, endpoint_brick_relief_20.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_brick_relief_20) {
    mesh_brick_relief_20Geometry.scale(0.16, 0.13, 0.34);
  }
  const mesh_brick_relief_20 = new THREE.Mesh(
    mesh_brick_relief_20Geometry,
    materialMap["brick-facade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_brick_relief_20.name = "Protruding brick header scatter";
  if (endpoint_brick_relief_20) {
    mesh_brick_relief_20.position.copy(endpoint_brick_relief_20.midpoint);
    mesh_brick_relief_20.quaternion.copy(endpoint_brick_relief_20.quaternion);
  }
  mesh_brick_relief_20.castShadow = options.castShadow ?? true;
  mesh_brick_relief_20.receiveShadow = options.receiveShadow ?? true;
  mesh_brick_relief_20.userData.sculptComponent = node_brick_relief_20.userData.sculptComponent;
  node_brick_relief_20.add(mesh_brick_relief_20);
  meshes["brick-relief"] = mesh_brick_relief_20;
  colliders["brick-relief"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["brick"] ?? (destructionGroups["brick"] = []);
  destructionGroups["brick"].push(node_brick_relief_20);
  const attachment_upper_window_1_frame_21 = null;
  const endpoint_upper_window_1_frame_21 = makeAttachmentEndpoint(attachment_upper_window_1_frame_21);
  const node_upper_window_1_frame_21 = new THREE.Group();
  node_upper_window_1_frame_21.name = "Upper sash window 1 frame__pivot";
  node_upper_window_1_frame_21.scale.set(1, 1, 1);
  if (endpoint_upper_window_1_frame_21) {
    node_upper_window_1_frame_21.position.copy(endpoint_upper_window_1_frame_21.start);
    node_upper_window_1_frame_21.rotation.set(0, 0, 0);
  } else {
    node_upper_window_1_frame_21.position.set(-3.36, 6.35, 4);
    node_upper_window_1_frame_21.rotation.set(0, 0, 0);
  }
  node_upper_window_1_frame_21.userData.sculptComponent = { "id": "upper-window-1-frame", "name": "Upper sash window 1 frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.3, "depth": 1.18, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 6.35, 4], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["chunky pale sash frame standing proud of the brick"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_1_frame_21.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_1_frame_21);
  nodes["upper-window-1-frame"] = node_upper_window_1_frame_21;
  const mesh_upper_window_1_frame_21Geometry = endpoint_upper_window_1_frame_21 ? new THREE.CylinderGeometry(endpoint_upper_window_1_frame_21.endRadius, endpoint_upper_window_1_frame_21.baseRadius, endpoint_upper_window_1_frame_21.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_1_frame_21) {
    mesh_upper_window_1_frame_21Geometry.scale(0.16, 2.3, 1.18);
  }
  const mesh_upper_window_1_frame_21 = new THREE.Mesh(
    mesh_upper_window_1_frame_21Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_1_frame_21.name = "Upper sash window 1 frame";
  if (endpoint_upper_window_1_frame_21) {
    mesh_upper_window_1_frame_21.position.copy(endpoint_upper_window_1_frame_21.midpoint);
    mesh_upper_window_1_frame_21.quaternion.copy(endpoint_upper_window_1_frame_21.quaternion);
  }
  mesh_upper_window_1_frame_21.castShadow = options.castShadow ?? true;
  mesh_upper_window_1_frame_21.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_1_frame_21.userData.sculptComponent = node_upper_window_1_frame_21.userData.sculptComponent;
  node_upper_window_1_frame_21.add(mesh_upper_window_1_frame_21);
  meshes["upper-window-1-frame"] = mesh_upper_window_1_frame_21;
  colliders["upper-window-1-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_1_frame_21);
  const attachment_upper_window_1_glass_22 = null;
  const endpoint_upper_window_1_glass_22 = makeAttachmentEndpoint(attachment_upper_window_1_glass_22);
  const node_upper_window_1_glass_22 = new THREE.Group();
  node_upper_window_1_glass_22.name = "Upper sash window 1 glass__pivot";
  node_upper_window_1_glass_22.scale.set(1, 1, 1);
  if (endpoint_upper_window_1_glass_22) {
    node_upper_window_1_glass_22.position.copy(endpoint_upper_window_1_glass_22.start);
    node_upper_window_1_glass_22.rotation.set(0, 0, 0);
  } else {
    node_upper_window_1_glass_22.position.set(-3.26, 6.35, 4);
    node_upper_window_1_glass_22.rotation.set(0, 0, 0);
  }
  node_upper_window_1_glass_22.userData.sculptComponent = { "id": "upper-window-1-glass", "name": "Upper sash window 1 glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.04, "depth": 0.94, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 6.35, 4], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["amber interior glow, brightest at the centre of the opening", "pane sits 0.05 proud of the stone frame's face so the frame reads as a pale border rather than occluding the glow (the generator's frame is a solid box, not a ring)"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_upper_window_1_glass_22.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_upper_window_1_glass_22);
  nodes["upper-window-1-glass"] = node_upper_window_1_glass_22;
  const mesh_upper_window_1_glass_22Geometry = endpoint_upper_window_1_glass_22 ? new THREE.CylinderGeometry(endpoint_upper_window_1_glass_22.endRadius, endpoint_upper_window_1_glass_22.baseRadius, endpoint_upper_window_1_glass_22.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_1_glass_22) {
    mesh_upper_window_1_glass_22Geometry.scale(0.06, 2.04, 0.94);
  }
  const mesh_upper_window_1_glass_22 = new THREE.Mesh(
    mesh_upper_window_1_glass_22Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_1_glass_22.name = "Upper sash window 1 glass";
  if (endpoint_upper_window_1_glass_22) {
    mesh_upper_window_1_glass_22.position.copy(endpoint_upper_window_1_glass_22.midpoint);
    mesh_upper_window_1_glass_22.quaternion.copy(endpoint_upper_window_1_glass_22.quaternion);
  }
  mesh_upper_window_1_glass_22.castShadow = options.castShadow ?? true;
  mesh_upper_window_1_glass_22.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_1_glass_22.userData.sculptComponent = node_upper_window_1_glass_22.userData.sculptComponent;
  node_upper_window_1_glass_22.add(mesh_upper_window_1_glass_22);
  meshes["upper-window-1-glass"] = mesh_upper_window_1_glass_22;
  colliders["upper-window-1-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_1_glass_22);
  const attachment_upper_window_1_lintel_23 = null;
  const endpoint_upper_window_1_lintel_23 = makeAttachmentEndpoint(attachment_upper_window_1_lintel_23);
  const node_upper_window_1_lintel_23 = new THREE.Group();
  node_upper_window_1_lintel_23.name = "Upper window 1 wedge lintel__pivot";
  node_upper_window_1_lintel_23.scale.set(1, 1, 1);
  if (endpoint_upper_window_1_lintel_23) {
    node_upper_window_1_lintel_23.position.copy(endpoint_upper_window_1_lintel_23.start);
    node_upper_window_1_lintel_23.rotation.set(0, 0, 0);
  } else {
    node_upper_window_1_lintel_23.position.set(-3.27, 7.63, 4);
    node_upper_window_1_lintel_23.rotation.set(0, 0, 0);
  }
  node_upper_window_1_lintel_23.userData.sculptComponent = { "id": "upper-window-1-lintel", "name": "Upper window 1 wedge lintel", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.32, "height": 0.26, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.27, 7.63, 4], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["three-block wedge lintel cap projecting over the opening"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_1_lintel_23.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_1_lintel_23);
  nodes["upper-window-1-lintel"] = node_upper_window_1_lintel_23;
  const mesh_upper_window_1_lintel_23Geometry = endpoint_upper_window_1_lintel_23 ? new THREE.CylinderGeometry(endpoint_upper_window_1_lintel_23.endRadius, endpoint_upper_window_1_lintel_23.baseRadius, endpoint_upper_window_1_lintel_23.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_1_lintel_23) {
    mesh_upper_window_1_lintel_23Geometry.scale(0.32, 0.26, 1.46);
  }
  const mesh_upper_window_1_lintel_23 = new THREE.Mesh(
    mesh_upper_window_1_lintel_23Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_1_lintel_23.name = "Upper window 1 wedge lintel";
  if (endpoint_upper_window_1_lintel_23) {
    mesh_upper_window_1_lintel_23.position.copy(endpoint_upper_window_1_lintel_23.midpoint);
    mesh_upper_window_1_lintel_23.quaternion.copy(endpoint_upper_window_1_lintel_23.quaternion);
  }
  mesh_upper_window_1_lintel_23.castShadow = options.castShadow ?? true;
  mesh_upper_window_1_lintel_23.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_1_lintel_23.userData.sculptComponent = node_upper_window_1_lintel_23.userData.sculptComponent;
  node_upper_window_1_lintel_23.add(mesh_upper_window_1_lintel_23);
  meshes["upper-window-1-lintel"] = mesh_upper_window_1_lintel_23;
  colliders["upper-window-1-lintel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_1_lintel_23);
  const attachment_upper_window_1_sill_24 = null;
  const endpoint_upper_window_1_sill_24 = makeAttachmentEndpoint(attachment_upper_window_1_sill_24);
  const node_upper_window_1_sill_24 = new THREE.Group();
  node_upper_window_1_sill_24.name = "Upper window 1 sill__pivot";
  node_upper_window_1_sill_24.scale.set(1, 1, 1);
  if (endpoint_upper_window_1_sill_24) {
    node_upper_window_1_sill_24.position.copy(endpoint_upper_window_1_sill_24.start);
    node_upper_window_1_sill_24.rotation.set(0, 0, 0);
  } else {
    node_upper_window_1_sill_24.position.set(-3.28, 5.12, 4);
    node_upper_window_1_sill_24.rotation.set(0, 0, 0);
  }
  node_upper_window_1_sill_24.userData.sculptComponent = { "id": "upper-window-1-sill", "name": "Upper window 1 sill", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.3, "height": 0.16, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.28, 5.12, 4], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["projecting stone sill"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_1_sill_24.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_1_sill_24);
  nodes["upper-window-1-sill"] = node_upper_window_1_sill_24;
  const mesh_upper_window_1_sill_24Geometry = endpoint_upper_window_1_sill_24 ? new THREE.CylinderGeometry(endpoint_upper_window_1_sill_24.endRadius, endpoint_upper_window_1_sill_24.baseRadius, endpoint_upper_window_1_sill_24.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_1_sill_24) {
    mesh_upper_window_1_sill_24Geometry.scale(0.3, 0.16, 1.46);
  }
  const mesh_upper_window_1_sill_24 = new THREE.Mesh(
    mesh_upper_window_1_sill_24Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_1_sill_24.name = "Upper window 1 sill";
  if (endpoint_upper_window_1_sill_24) {
    mesh_upper_window_1_sill_24.position.copy(endpoint_upper_window_1_sill_24.midpoint);
    mesh_upper_window_1_sill_24.quaternion.copy(endpoint_upper_window_1_sill_24.quaternion);
  }
  mesh_upper_window_1_sill_24.castShadow = options.castShadow ?? true;
  mesh_upper_window_1_sill_24.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_1_sill_24.userData.sculptComponent = node_upper_window_1_sill_24.userData.sculptComponent;
  node_upper_window_1_sill_24.add(mesh_upper_window_1_sill_24);
  meshes["upper-window-1-sill"] = mesh_upper_window_1_sill_24;
  colliders["upper-window-1-sill"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_1_sill_24);
  const attachment_upper_window_2_frame_25 = null;
  const endpoint_upper_window_2_frame_25 = makeAttachmentEndpoint(attachment_upper_window_2_frame_25);
  const node_upper_window_2_frame_25 = new THREE.Group();
  node_upper_window_2_frame_25.name = "Upper sash window 2 frame__pivot";
  node_upper_window_2_frame_25.scale.set(1, 1, 1);
  if (endpoint_upper_window_2_frame_25) {
    node_upper_window_2_frame_25.position.copy(endpoint_upper_window_2_frame_25.start);
    node_upper_window_2_frame_25.rotation.set(0, 0, 0);
  } else {
    node_upper_window_2_frame_25.position.set(-3.36, 6.35, 1.35);
    node_upper_window_2_frame_25.rotation.set(0, 0, 0);
  }
  node_upper_window_2_frame_25.userData.sculptComponent = { "id": "upper-window-2-frame", "name": "Upper sash window 2 frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.3, "depth": 1.18, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 6.35, 1.35], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["chunky pale sash frame standing proud of the brick"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_2_frame_25.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_2_frame_25);
  nodes["upper-window-2-frame"] = node_upper_window_2_frame_25;
  const mesh_upper_window_2_frame_25Geometry = endpoint_upper_window_2_frame_25 ? new THREE.CylinderGeometry(endpoint_upper_window_2_frame_25.endRadius, endpoint_upper_window_2_frame_25.baseRadius, endpoint_upper_window_2_frame_25.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_2_frame_25) {
    mesh_upper_window_2_frame_25Geometry.scale(0.16, 2.3, 1.18);
  }
  const mesh_upper_window_2_frame_25 = new THREE.Mesh(
    mesh_upper_window_2_frame_25Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_2_frame_25.name = "Upper sash window 2 frame";
  if (endpoint_upper_window_2_frame_25) {
    mesh_upper_window_2_frame_25.position.copy(endpoint_upper_window_2_frame_25.midpoint);
    mesh_upper_window_2_frame_25.quaternion.copy(endpoint_upper_window_2_frame_25.quaternion);
  }
  mesh_upper_window_2_frame_25.castShadow = options.castShadow ?? true;
  mesh_upper_window_2_frame_25.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_2_frame_25.userData.sculptComponent = node_upper_window_2_frame_25.userData.sculptComponent;
  node_upper_window_2_frame_25.add(mesh_upper_window_2_frame_25);
  meshes["upper-window-2-frame"] = mesh_upper_window_2_frame_25;
  colliders["upper-window-2-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_2_frame_25);
  const attachment_upper_window_2_glass_26 = null;
  const endpoint_upper_window_2_glass_26 = makeAttachmentEndpoint(attachment_upper_window_2_glass_26);
  const node_upper_window_2_glass_26 = new THREE.Group();
  node_upper_window_2_glass_26.name = "Upper sash window 2 glass__pivot";
  node_upper_window_2_glass_26.scale.set(1, 1, 1);
  if (endpoint_upper_window_2_glass_26) {
    node_upper_window_2_glass_26.position.copy(endpoint_upper_window_2_glass_26.start);
    node_upper_window_2_glass_26.rotation.set(0, 0, 0);
  } else {
    node_upper_window_2_glass_26.position.set(-3.26, 6.35, 1.35);
    node_upper_window_2_glass_26.rotation.set(0, 0, 0);
  }
  node_upper_window_2_glass_26.userData.sculptComponent = { "id": "upper-window-2-glass", "name": "Upper sash window 2 glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.04, "depth": 0.94, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 6.35, 1.35], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["amber interior glow, brightest at the centre of the opening", "pane sits 0.05 proud of the stone frame's face so the frame reads as a pale border rather than occluding the glow (the generator's frame is a solid box, not a ring)"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_upper_window_2_glass_26.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_upper_window_2_glass_26);
  nodes["upper-window-2-glass"] = node_upper_window_2_glass_26;
  const mesh_upper_window_2_glass_26Geometry = endpoint_upper_window_2_glass_26 ? new THREE.CylinderGeometry(endpoint_upper_window_2_glass_26.endRadius, endpoint_upper_window_2_glass_26.baseRadius, endpoint_upper_window_2_glass_26.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_2_glass_26) {
    mesh_upper_window_2_glass_26Geometry.scale(0.06, 2.04, 0.94);
  }
  const mesh_upper_window_2_glass_26 = new THREE.Mesh(
    mesh_upper_window_2_glass_26Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_2_glass_26.name = "Upper sash window 2 glass";
  if (endpoint_upper_window_2_glass_26) {
    mesh_upper_window_2_glass_26.position.copy(endpoint_upper_window_2_glass_26.midpoint);
    mesh_upper_window_2_glass_26.quaternion.copy(endpoint_upper_window_2_glass_26.quaternion);
  }
  mesh_upper_window_2_glass_26.castShadow = options.castShadow ?? true;
  mesh_upper_window_2_glass_26.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_2_glass_26.userData.sculptComponent = node_upper_window_2_glass_26.userData.sculptComponent;
  node_upper_window_2_glass_26.add(mesh_upper_window_2_glass_26);
  meshes["upper-window-2-glass"] = mesh_upper_window_2_glass_26;
  colliders["upper-window-2-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_2_glass_26);
  const attachment_upper_window_2_lintel_27 = null;
  const endpoint_upper_window_2_lintel_27 = makeAttachmentEndpoint(attachment_upper_window_2_lintel_27);
  const node_upper_window_2_lintel_27 = new THREE.Group();
  node_upper_window_2_lintel_27.name = "Upper window 2 wedge lintel__pivot";
  node_upper_window_2_lintel_27.scale.set(1, 1, 1);
  if (endpoint_upper_window_2_lintel_27) {
    node_upper_window_2_lintel_27.position.copy(endpoint_upper_window_2_lintel_27.start);
    node_upper_window_2_lintel_27.rotation.set(0, 0, 0);
  } else {
    node_upper_window_2_lintel_27.position.set(-3.27, 7.63, 1.35);
    node_upper_window_2_lintel_27.rotation.set(0, 0, 0);
  }
  node_upper_window_2_lintel_27.userData.sculptComponent = { "id": "upper-window-2-lintel", "name": "Upper window 2 wedge lintel", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.32, "height": 0.26, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.27, 7.63, 1.35], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["three-block wedge lintel cap projecting over the opening"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_2_lintel_27.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_2_lintel_27);
  nodes["upper-window-2-lintel"] = node_upper_window_2_lintel_27;
  const mesh_upper_window_2_lintel_27Geometry = endpoint_upper_window_2_lintel_27 ? new THREE.CylinderGeometry(endpoint_upper_window_2_lintel_27.endRadius, endpoint_upper_window_2_lintel_27.baseRadius, endpoint_upper_window_2_lintel_27.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_2_lintel_27) {
    mesh_upper_window_2_lintel_27Geometry.scale(0.32, 0.26, 1.46);
  }
  const mesh_upper_window_2_lintel_27 = new THREE.Mesh(
    mesh_upper_window_2_lintel_27Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_2_lintel_27.name = "Upper window 2 wedge lintel";
  if (endpoint_upper_window_2_lintel_27) {
    mesh_upper_window_2_lintel_27.position.copy(endpoint_upper_window_2_lintel_27.midpoint);
    mesh_upper_window_2_lintel_27.quaternion.copy(endpoint_upper_window_2_lintel_27.quaternion);
  }
  mesh_upper_window_2_lintel_27.castShadow = options.castShadow ?? true;
  mesh_upper_window_2_lintel_27.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_2_lintel_27.userData.sculptComponent = node_upper_window_2_lintel_27.userData.sculptComponent;
  node_upper_window_2_lintel_27.add(mesh_upper_window_2_lintel_27);
  meshes["upper-window-2-lintel"] = mesh_upper_window_2_lintel_27;
  colliders["upper-window-2-lintel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_2_lintel_27);
  const attachment_upper_window_2_sill_28 = null;
  const endpoint_upper_window_2_sill_28 = makeAttachmentEndpoint(attachment_upper_window_2_sill_28);
  const node_upper_window_2_sill_28 = new THREE.Group();
  node_upper_window_2_sill_28.name = "Upper window 2 sill__pivot";
  node_upper_window_2_sill_28.scale.set(1, 1, 1);
  if (endpoint_upper_window_2_sill_28) {
    node_upper_window_2_sill_28.position.copy(endpoint_upper_window_2_sill_28.start);
    node_upper_window_2_sill_28.rotation.set(0, 0, 0);
  } else {
    node_upper_window_2_sill_28.position.set(-3.28, 5.12, 1.35);
    node_upper_window_2_sill_28.rotation.set(0, 0, 0);
  }
  node_upper_window_2_sill_28.userData.sculptComponent = { "id": "upper-window-2-sill", "name": "Upper window 2 sill", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.3, "height": 0.16, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.28, 5.12, 1.35], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["projecting stone sill"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_2_sill_28.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_2_sill_28);
  nodes["upper-window-2-sill"] = node_upper_window_2_sill_28;
  const mesh_upper_window_2_sill_28Geometry = endpoint_upper_window_2_sill_28 ? new THREE.CylinderGeometry(endpoint_upper_window_2_sill_28.endRadius, endpoint_upper_window_2_sill_28.baseRadius, endpoint_upper_window_2_sill_28.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_2_sill_28) {
    mesh_upper_window_2_sill_28Geometry.scale(0.3, 0.16, 1.46);
  }
  const mesh_upper_window_2_sill_28 = new THREE.Mesh(
    mesh_upper_window_2_sill_28Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_2_sill_28.name = "Upper window 2 sill";
  if (endpoint_upper_window_2_sill_28) {
    mesh_upper_window_2_sill_28.position.copy(endpoint_upper_window_2_sill_28.midpoint);
    mesh_upper_window_2_sill_28.quaternion.copy(endpoint_upper_window_2_sill_28.quaternion);
  }
  mesh_upper_window_2_sill_28.castShadow = options.castShadow ?? true;
  mesh_upper_window_2_sill_28.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_2_sill_28.userData.sculptComponent = node_upper_window_2_sill_28.userData.sculptComponent;
  node_upper_window_2_sill_28.add(mesh_upper_window_2_sill_28);
  meshes["upper-window-2-sill"] = mesh_upper_window_2_sill_28;
  colliders["upper-window-2-sill"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_2_sill_28);
  const attachment_upper_window_3_frame_29 = null;
  const endpoint_upper_window_3_frame_29 = makeAttachmentEndpoint(attachment_upper_window_3_frame_29);
  const node_upper_window_3_frame_29 = new THREE.Group();
  node_upper_window_3_frame_29.name = "Upper sash window 3 frame__pivot";
  node_upper_window_3_frame_29.scale.set(1, 1, 1);
  if (endpoint_upper_window_3_frame_29) {
    node_upper_window_3_frame_29.position.copy(endpoint_upper_window_3_frame_29.start);
    node_upper_window_3_frame_29.rotation.set(0, 0, 0);
  } else {
    node_upper_window_3_frame_29.position.set(-3.36, 6.35, -1.3);
    node_upper_window_3_frame_29.rotation.set(0, 0, 0);
  }
  node_upper_window_3_frame_29.userData.sculptComponent = { "id": "upper-window-3-frame", "name": "Upper sash window 3 frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.3, "depth": 1.18, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 6.35, -1.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["chunky pale sash frame standing proud of the brick"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_3_frame_29.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_3_frame_29);
  nodes["upper-window-3-frame"] = node_upper_window_3_frame_29;
  const mesh_upper_window_3_frame_29Geometry = endpoint_upper_window_3_frame_29 ? new THREE.CylinderGeometry(endpoint_upper_window_3_frame_29.endRadius, endpoint_upper_window_3_frame_29.baseRadius, endpoint_upper_window_3_frame_29.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_3_frame_29) {
    mesh_upper_window_3_frame_29Geometry.scale(0.16, 2.3, 1.18);
  }
  const mesh_upper_window_3_frame_29 = new THREE.Mesh(
    mesh_upper_window_3_frame_29Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_3_frame_29.name = "Upper sash window 3 frame";
  if (endpoint_upper_window_3_frame_29) {
    mesh_upper_window_3_frame_29.position.copy(endpoint_upper_window_3_frame_29.midpoint);
    mesh_upper_window_3_frame_29.quaternion.copy(endpoint_upper_window_3_frame_29.quaternion);
  }
  mesh_upper_window_3_frame_29.castShadow = options.castShadow ?? true;
  mesh_upper_window_3_frame_29.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_3_frame_29.userData.sculptComponent = node_upper_window_3_frame_29.userData.sculptComponent;
  node_upper_window_3_frame_29.add(mesh_upper_window_3_frame_29);
  meshes["upper-window-3-frame"] = mesh_upper_window_3_frame_29;
  colliders["upper-window-3-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_3_frame_29);
  const attachment_upper_window_3_glass_30 = null;
  const endpoint_upper_window_3_glass_30 = makeAttachmentEndpoint(attachment_upper_window_3_glass_30);
  const node_upper_window_3_glass_30 = new THREE.Group();
  node_upper_window_3_glass_30.name = "Upper sash window 3 glass__pivot";
  node_upper_window_3_glass_30.scale.set(1, 1, 1);
  if (endpoint_upper_window_3_glass_30) {
    node_upper_window_3_glass_30.position.copy(endpoint_upper_window_3_glass_30.start);
    node_upper_window_3_glass_30.rotation.set(0, 0, 0);
  } else {
    node_upper_window_3_glass_30.position.set(-3.26, 6.35, -1.3);
    node_upper_window_3_glass_30.rotation.set(0, 0, 0);
  }
  node_upper_window_3_glass_30.userData.sculptComponent = { "id": "upper-window-3-glass", "name": "Upper sash window 3 glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.04, "depth": 0.94, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 6.35, -1.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["amber interior glow, brightest at the centre of the opening", "pane sits 0.05 proud of the stone frame's face so the frame reads as a pale border rather than occluding the glow (the generator's frame is a solid box, not a ring)"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_upper_window_3_glass_30.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_upper_window_3_glass_30);
  nodes["upper-window-3-glass"] = node_upper_window_3_glass_30;
  const mesh_upper_window_3_glass_30Geometry = endpoint_upper_window_3_glass_30 ? new THREE.CylinderGeometry(endpoint_upper_window_3_glass_30.endRadius, endpoint_upper_window_3_glass_30.baseRadius, endpoint_upper_window_3_glass_30.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_3_glass_30) {
    mesh_upper_window_3_glass_30Geometry.scale(0.06, 2.04, 0.94);
  }
  const mesh_upper_window_3_glass_30 = new THREE.Mesh(
    mesh_upper_window_3_glass_30Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_3_glass_30.name = "Upper sash window 3 glass";
  if (endpoint_upper_window_3_glass_30) {
    mesh_upper_window_3_glass_30.position.copy(endpoint_upper_window_3_glass_30.midpoint);
    mesh_upper_window_3_glass_30.quaternion.copy(endpoint_upper_window_3_glass_30.quaternion);
  }
  mesh_upper_window_3_glass_30.castShadow = options.castShadow ?? true;
  mesh_upper_window_3_glass_30.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_3_glass_30.userData.sculptComponent = node_upper_window_3_glass_30.userData.sculptComponent;
  node_upper_window_3_glass_30.add(mesh_upper_window_3_glass_30);
  meshes["upper-window-3-glass"] = mesh_upper_window_3_glass_30;
  colliders["upper-window-3-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_3_glass_30);
  const attachment_upper_window_3_lintel_31 = null;
  const endpoint_upper_window_3_lintel_31 = makeAttachmentEndpoint(attachment_upper_window_3_lintel_31);
  const node_upper_window_3_lintel_31 = new THREE.Group();
  node_upper_window_3_lintel_31.name = "Upper window 3 wedge lintel__pivot";
  node_upper_window_3_lintel_31.scale.set(1, 1, 1);
  if (endpoint_upper_window_3_lintel_31) {
    node_upper_window_3_lintel_31.position.copy(endpoint_upper_window_3_lintel_31.start);
    node_upper_window_3_lintel_31.rotation.set(0, 0, 0);
  } else {
    node_upper_window_3_lintel_31.position.set(-3.27, 7.63, -1.3);
    node_upper_window_3_lintel_31.rotation.set(0, 0, 0);
  }
  node_upper_window_3_lintel_31.userData.sculptComponent = { "id": "upper-window-3-lintel", "name": "Upper window 3 wedge lintel", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.32, "height": 0.26, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.27, 7.63, -1.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["three-block wedge lintel cap projecting over the opening"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_3_lintel_31.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_3_lintel_31);
  nodes["upper-window-3-lintel"] = node_upper_window_3_lintel_31;
  const mesh_upper_window_3_lintel_31Geometry = endpoint_upper_window_3_lintel_31 ? new THREE.CylinderGeometry(endpoint_upper_window_3_lintel_31.endRadius, endpoint_upper_window_3_lintel_31.baseRadius, endpoint_upper_window_3_lintel_31.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_3_lintel_31) {
    mesh_upper_window_3_lintel_31Geometry.scale(0.32, 0.26, 1.46);
  }
  const mesh_upper_window_3_lintel_31 = new THREE.Mesh(
    mesh_upper_window_3_lintel_31Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_3_lintel_31.name = "Upper window 3 wedge lintel";
  if (endpoint_upper_window_3_lintel_31) {
    mesh_upper_window_3_lintel_31.position.copy(endpoint_upper_window_3_lintel_31.midpoint);
    mesh_upper_window_3_lintel_31.quaternion.copy(endpoint_upper_window_3_lintel_31.quaternion);
  }
  mesh_upper_window_3_lintel_31.castShadow = options.castShadow ?? true;
  mesh_upper_window_3_lintel_31.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_3_lintel_31.userData.sculptComponent = node_upper_window_3_lintel_31.userData.sculptComponent;
  node_upper_window_3_lintel_31.add(mesh_upper_window_3_lintel_31);
  meshes["upper-window-3-lintel"] = mesh_upper_window_3_lintel_31;
  colliders["upper-window-3-lintel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_3_lintel_31);
  const attachment_upper_window_3_sill_32 = null;
  const endpoint_upper_window_3_sill_32 = makeAttachmentEndpoint(attachment_upper_window_3_sill_32);
  const node_upper_window_3_sill_32 = new THREE.Group();
  node_upper_window_3_sill_32.name = "Upper window 3 sill__pivot";
  node_upper_window_3_sill_32.scale.set(1, 1, 1);
  if (endpoint_upper_window_3_sill_32) {
    node_upper_window_3_sill_32.position.copy(endpoint_upper_window_3_sill_32.start);
    node_upper_window_3_sill_32.rotation.set(0, 0, 0);
  } else {
    node_upper_window_3_sill_32.position.set(-3.28, 5.12, -1.3);
    node_upper_window_3_sill_32.rotation.set(0, 0, 0);
  }
  node_upper_window_3_sill_32.userData.sculptComponent = { "id": "upper-window-3-sill", "name": "Upper window 3 sill", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.3, "height": 0.16, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.28, 5.12, -1.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["projecting stone sill"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_3_sill_32.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_3_sill_32);
  nodes["upper-window-3-sill"] = node_upper_window_3_sill_32;
  const mesh_upper_window_3_sill_32Geometry = endpoint_upper_window_3_sill_32 ? new THREE.CylinderGeometry(endpoint_upper_window_3_sill_32.endRadius, endpoint_upper_window_3_sill_32.baseRadius, endpoint_upper_window_3_sill_32.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_3_sill_32) {
    mesh_upper_window_3_sill_32Geometry.scale(0.3, 0.16, 1.46);
  }
  const mesh_upper_window_3_sill_32 = new THREE.Mesh(
    mesh_upper_window_3_sill_32Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_3_sill_32.name = "Upper window 3 sill";
  if (endpoint_upper_window_3_sill_32) {
    mesh_upper_window_3_sill_32.position.copy(endpoint_upper_window_3_sill_32.midpoint);
    mesh_upper_window_3_sill_32.quaternion.copy(endpoint_upper_window_3_sill_32.quaternion);
  }
  mesh_upper_window_3_sill_32.castShadow = options.castShadow ?? true;
  mesh_upper_window_3_sill_32.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_3_sill_32.userData.sculptComponent = node_upper_window_3_sill_32.userData.sculptComponent;
  node_upper_window_3_sill_32.add(mesh_upper_window_3_sill_32);
  meshes["upper-window-3-sill"] = mesh_upper_window_3_sill_32;
  colliders["upper-window-3-sill"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_3_sill_32);
  const attachment_upper_window_4_frame_33 = null;
  const endpoint_upper_window_4_frame_33 = makeAttachmentEndpoint(attachment_upper_window_4_frame_33);
  const node_upper_window_4_frame_33 = new THREE.Group();
  node_upper_window_4_frame_33.name = "Upper sash window 4 frame__pivot";
  node_upper_window_4_frame_33.scale.set(1, 1, 1);
  if (endpoint_upper_window_4_frame_33) {
    node_upper_window_4_frame_33.position.copy(endpoint_upper_window_4_frame_33.start);
    node_upper_window_4_frame_33.rotation.set(0, 0, 0);
  } else {
    node_upper_window_4_frame_33.position.set(-3.36, 6.35, -3.95);
    node_upper_window_4_frame_33.rotation.set(0, 0, 0);
  }
  node_upper_window_4_frame_33.userData.sculptComponent = { "id": "upper-window-4-frame", "name": "Upper sash window 4 frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.3, "depth": 1.18, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 6.35, -3.95], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["chunky pale sash frame standing proud of the brick"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_4_frame_33.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_4_frame_33);
  nodes["upper-window-4-frame"] = node_upper_window_4_frame_33;
  const mesh_upper_window_4_frame_33Geometry = endpoint_upper_window_4_frame_33 ? new THREE.CylinderGeometry(endpoint_upper_window_4_frame_33.endRadius, endpoint_upper_window_4_frame_33.baseRadius, endpoint_upper_window_4_frame_33.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_4_frame_33) {
    mesh_upper_window_4_frame_33Geometry.scale(0.16, 2.3, 1.18);
  }
  const mesh_upper_window_4_frame_33 = new THREE.Mesh(
    mesh_upper_window_4_frame_33Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_4_frame_33.name = "Upper sash window 4 frame";
  if (endpoint_upper_window_4_frame_33) {
    mesh_upper_window_4_frame_33.position.copy(endpoint_upper_window_4_frame_33.midpoint);
    mesh_upper_window_4_frame_33.quaternion.copy(endpoint_upper_window_4_frame_33.quaternion);
  }
  mesh_upper_window_4_frame_33.castShadow = options.castShadow ?? true;
  mesh_upper_window_4_frame_33.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_4_frame_33.userData.sculptComponent = node_upper_window_4_frame_33.userData.sculptComponent;
  node_upper_window_4_frame_33.add(mesh_upper_window_4_frame_33);
  meshes["upper-window-4-frame"] = mesh_upper_window_4_frame_33;
  colliders["upper-window-4-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_4_frame_33);
  const attachment_upper_window_4_glass_34 = null;
  const endpoint_upper_window_4_glass_34 = makeAttachmentEndpoint(attachment_upper_window_4_glass_34);
  const node_upper_window_4_glass_34 = new THREE.Group();
  node_upper_window_4_glass_34.name = "Upper sash window 4 glass__pivot";
  node_upper_window_4_glass_34.scale.set(1, 1, 1);
  if (endpoint_upper_window_4_glass_34) {
    node_upper_window_4_glass_34.position.copy(endpoint_upper_window_4_glass_34.start);
    node_upper_window_4_glass_34.rotation.set(0, 0, 0);
  } else {
    node_upper_window_4_glass_34.position.set(-3.26, 6.35, -3.95);
    node_upper_window_4_glass_34.rotation.set(0, 0, 0);
  }
  node_upper_window_4_glass_34.userData.sculptComponent = { "id": "upper-window-4-glass", "name": "Upper sash window 4 glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.04, "depth": 0.94, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 6.35, -3.95], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["amber interior glow, brightest at the centre of the opening", "pane sits 0.05 proud of the stone frame's face so the frame reads as a pale border rather than occluding the glow (the generator's frame is a solid box, not a ring)"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_upper_window_4_glass_34.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_upper_window_4_glass_34);
  nodes["upper-window-4-glass"] = node_upper_window_4_glass_34;
  const mesh_upper_window_4_glass_34Geometry = endpoint_upper_window_4_glass_34 ? new THREE.CylinderGeometry(endpoint_upper_window_4_glass_34.endRadius, endpoint_upper_window_4_glass_34.baseRadius, endpoint_upper_window_4_glass_34.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_4_glass_34) {
    mesh_upper_window_4_glass_34Geometry.scale(0.06, 2.04, 0.94);
  }
  const mesh_upper_window_4_glass_34 = new THREE.Mesh(
    mesh_upper_window_4_glass_34Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_4_glass_34.name = "Upper sash window 4 glass";
  if (endpoint_upper_window_4_glass_34) {
    mesh_upper_window_4_glass_34.position.copy(endpoint_upper_window_4_glass_34.midpoint);
    mesh_upper_window_4_glass_34.quaternion.copy(endpoint_upper_window_4_glass_34.quaternion);
  }
  mesh_upper_window_4_glass_34.castShadow = options.castShadow ?? true;
  mesh_upper_window_4_glass_34.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_4_glass_34.userData.sculptComponent = node_upper_window_4_glass_34.userData.sculptComponent;
  node_upper_window_4_glass_34.add(mesh_upper_window_4_glass_34);
  meshes["upper-window-4-glass"] = mesh_upper_window_4_glass_34;
  colliders["upper-window-4-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_4_glass_34);
  const attachment_upper_window_4_lintel_35 = null;
  const endpoint_upper_window_4_lintel_35 = makeAttachmentEndpoint(attachment_upper_window_4_lintel_35);
  const node_upper_window_4_lintel_35 = new THREE.Group();
  node_upper_window_4_lintel_35.name = "Upper window 4 wedge lintel__pivot";
  node_upper_window_4_lintel_35.scale.set(1, 1, 1);
  if (endpoint_upper_window_4_lintel_35) {
    node_upper_window_4_lintel_35.position.copy(endpoint_upper_window_4_lintel_35.start);
    node_upper_window_4_lintel_35.rotation.set(0, 0, 0);
  } else {
    node_upper_window_4_lintel_35.position.set(-3.27, 7.63, -3.95);
    node_upper_window_4_lintel_35.rotation.set(0, 0, 0);
  }
  node_upper_window_4_lintel_35.userData.sculptComponent = { "id": "upper-window-4-lintel", "name": "Upper window 4 wedge lintel", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.32, "height": 0.26, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.27, 7.63, -3.95], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["three-block wedge lintel cap projecting over the opening"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_4_lintel_35.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_4_lintel_35);
  nodes["upper-window-4-lintel"] = node_upper_window_4_lintel_35;
  const mesh_upper_window_4_lintel_35Geometry = endpoint_upper_window_4_lintel_35 ? new THREE.CylinderGeometry(endpoint_upper_window_4_lintel_35.endRadius, endpoint_upper_window_4_lintel_35.baseRadius, endpoint_upper_window_4_lintel_35.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_4_lintel_35) {
    mesh_upper_window_4_lintel_35Geometry.scale(0.32, 0.26, 1.46);
  }
  const mesh_upper_window_4_lintel_35 = new THREE.Mesh(
    mesh_upper_window_4_lintel_35Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_4_lintel_35.name = "Upper window 4 wedge lintel";
  if (endpoint_upper_window_4_lintel_35) {
    mesh_upper_window_4_lintel_35.position.copy(endpoint_upper_window_4_lintel_35.midpoint);
    mesh_upper_window_4_lintel_35.quaternion.copy(endpoint_upper_window_4_lintel_35.quaternion);
  }
  mesh_upper_window_4_lintel_35.castShadow = options.castShadow ?? true;
  mesh_upper_window_4_lintel_35.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_4_lintel_35.userData.sculptComponent = node_upper_window_4_lintel_35.userData.sculptComponent;
  node_upper_window_4_lintel_35.add(mesh_upper_window_4_lintel_35);
  meshes["upper-window-4-lintel"] = mesh_upper_window_4_lintel_35;
  colliders["upper-window-4-lintel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_4_lintel_35);
  const attachment_upper_window_4_sill_36 = null;
  const endpoint_upper_window_4_sill_36 = makeAttachmentEndpoint(attachment_upper_window_4_sill_36);
  const node_upper_window_4_sill_36 = new THREE.Group();
  node_upper_window_4_sill_36.name = "Upper window 4 sill__pivot";
  node_upper_window_4_sill_36.scale.set(1, 1, 1);
  if (endpoint_upper_window_4_sill_36) {
    node_upper_window_4_sill_36.position.copy(endpoint_upper_window_4_sill_36.start);
    node_upper_window_4_sill_36.rotation.set(0, 0, 0);
  } else {
    node_upper_window_4_sill_36.position.set(-3.28, 5.12, -3.95);
    node_upper_window_4_sill_36.rotation.set(0, 0, 0);
  }
  node_upper_window_4_sill_36.userData.sculptComponent = { "id": "upper-window-4-sill", "name": "Upper window 4 sill", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.3, "height": 0.16, "depth": 1.46, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.28, 5.12, -3.95], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["projecting stone sill"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_upper_window_4_sill_36.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "upper", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_upper_window_4_sill_36);
  nodes["upper-window-4-sill"] = node_upper_window_4_sill_36;
  const mesh_upper_window_4_sill_36Geometry = endpoint_upper_window_4_sill_36 ? new THREE.CylinderGeometry(endpoint_upper_window_4_sill_36.endRadius, endpoint_upper_window_4_sill_36.baseRadius, endpoint_upper_window_4_sill_36.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_upper_window_4_sill_36) {
    mesh_upper_window_4_sill_36Geometry.scale(0.3, 0.16, 1.46);
  }
  const mesh_upper_window_4_sill_36 = new THREE.Mesh(
    mesh_upper_window_4_sill_36Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_upper_window_4_sill_36.name = "Upper window 4 sill";
  if (endpoint_upper_window_4_sill_36) {
    mesh_upper_window_4_sill_36.position.copy(endpoint_upper_window_4_sill_36.midpoint);
    mesh_upper_window_4_sill_36.quaternion.copy(endpoint_upper_window_4_sill_36.quaternion);
  }
  mesh_upper_window_4_sill_36.castShadow = options.castShadow ?? true;
  mesh_upper_window_4_sill_36.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_window_4_sill_36.userData.sculptComponent = node_upper_window_4_sill_36.userData.sculptComponent;
  node_upper_window_4_sill_36.add(mesh_upper_window_4_sill_36);
  meshes["upper-window-4-sill"] = mesh_upper_window_4_sill_36;
  colliders["upper-window-4-sill"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["upper"] ?? (destructionGroups["upper"] = []);
  destructionGroups["upper"].push(node_upper_window_4_sill_36);
  const attachment_shopfront_a_frame_37 = null;
  const endpoint_shopfront_a_frame_37 = makeAttachmentEndpoint(attachment_shopfront_a_frame_37);
  const node_shopfront_a_frame_37 = new THREE.Group();
  node_shopfront_a_frame_37.name = "Ground floor shopfront-a frame__pivot";
  node_shopfront_a_frame_37.scale.set(1, 1, 1);
  if (endpoint_shopfront_a_frame_37) {
    node_shopfront_a_frame_37.position.copy(endpoint_shopfront_a_frame_37.start);
    node_shopfront_a_frame_37.rotation.set(0, 0, 0);
  } else {
    node_shopfront_a_frame_37.position.set(-3.36, 3.2, 3.6);
    node_shopfront_a_frame_37.rotation.set(0, 0, 0);
  }
  node_shopfront_a_frame_37.userData.sculptComponent = { "id": "shopfront-a-frame", "name": "Ground floor shopfront-a frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.8, "depth": 2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 3.2, 3.6], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["shopfront frame with heavy pale mullion grid"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_shopfront_a_frame_37.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_shopfront_a_frame_37);
  nodes["shopfront-a-frame"] = node_shopfront_a_frame_37;
  const mesh_shopfront_a_frame_37Geometry = endpoint_shopfront_a_frame_37 ? new THREE.CylinderGeometry(endpoint_shopfront_a_frame_37.endRadius, endpoint_shopfront_a_frame_37.baseRadius, endpoint_shopfront_a_frame_37.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shopfront_a_frame_37) {
    mesh_shopfront_a_frame_37Geometry.scale(0.16, 2.8, 2);
  }
  const mesh_shopfront_a_frame_37 = new THREE.Mesh(
    mesh_shopfront_a_frame_37Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shopfront_a_frame_37.name = "Ground floor shopfront-a frame";
  if (endpoint_shopfront_a_frame_37) {
    mesh_shopfront_a_frame_37.position.copy(endpoint_shopfront_a_frame_37.midpoint);
    mesh_shopfront_a_frame_37.quaternion.copy(endpoint_shopfront_a_frame_37.quaternion);
  }
  mesh_shopfront_a_frame_37.castShadow = options.castShadow ?? true;
  mesh_shopfront_a_frame_37.receiveShadow = options.receiveShadow ?? true;
  mesh_shopfront_a_frame_37.userData.sculptComponent = node_shopfront_a_frame_37.userData.sculptComponent;
  node_shopfront_a_frame_37.add(mesh_shopfront_a_frame_37);
  meshes["shopfront-a-frame"] = mesh_shopfront_a_frame_37;
  colliders["shopfront-a-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shopfront"] ?? (destructionGroups["shopfront"] = []);
  destructionGroups["shopfront"].push(node_shopfront_a_frame_37);
  const attachment_shopfront_a_glass_38 = null;
  const endpoint_shopfront_a_glass_38 = makeAttachmentEndpoint(attachment_shopfront_a_glass_38);
  const node_shopfront_a_glass_38 = new THREE.Group();
  node_shopfront_a_glass_38.name = "Ground floor shopfront-a glass__pivot";
  node_shopfront_a_glass_38.scale.set(1, 1, 1);
  if (endpoint_shopfront_a_glass_38) {
    node_shopfront_a_glass_38.position.copy(endpoint_shopfront_a_glass_38.start);
    node_shopfront_a_glass_38.rotation.set(0, 0, 0);
  } else {
    node_shopfront_a_glass_38.position.set(-3.26, 3.2, 3.6);
    node_shopfront_a_glass_38.rotation.set(0, 0, 0);
  }
  node_shopfront_a_glass_38.userData.sculptComponent = { "id": "shopfront-a-glass", "name": "Ground floor shopfront-a glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.56, "depth": 1.78, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 3.2, 3.6], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["the plate's brightest amber field; spills warm light onto the pavement"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_shopfront_a_glass_38.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_shopfront_a_glass_38);
  nodes["shopfront-a-glass"] = node_shopfront_a_glass_38;
  const mesh_shopfront_a_glass_38Geometry = endpoint_shopfront_a_glass_38 ? new THREE.CylinderGeometry(endpoint_shopfront_a_glass_38.endRadius, endpoint_shopfront_a_glass_38.baseRadius, endpoint_shopfront_a_glass_38.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shopfront_a_glass_38) {
    mesh_shopfront_a_glass_38Geometry.scale(0.06, 2.56, 1.78);
  }
  const mesh_shopfront_a_glass_38 = new THREE.Mesh(
    mesh_shopfront_a_glass_38Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shopfront_a_glass_38.name = "Ground floor shopfront-a glass";
  if (endpoint_shopfront_a_glass_38) {
    mesh_shopfront_a_glass_38.position.copy(endpoint_shopfront_a_glass_38.midpoint);
    mesh_shopfront_a_glass_38.quaternion.copy(endpoint_shopfront_a_glass_38.quaternion);
  }
  mesh_shopfront_a_glass_38.castShadow = options.castShadow ?? true;
  mesh_shopfront_a_glass_38.receiveShadow = options.receiveShadow ?? true;
  mesh_shopfront_a_glass_38.userData.sculptComponent = node_shopfront_a_glass_38.userData.sculptComponent;
  node_shopfront_a_glass_38.add(mesh_shopfront_a_glass_38);
  meshes["shopfront-a-glass"] = mesh_shopfront_a_glass_38;
  colliders["shopfront-a-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shopfront"] ?? (destructionGroups["shopfront"] = []);
  destructionGroups["shopfront"].push(node_shopfront_a_glass_38);
  const attachment_shopfront_a_transom_39 = null;
  const endpoint_shopfront_a_transom_39 = makeAttachmentEndpoint(attachment_shopfront_a_transom_39);
  const node_shopfront_a_transom_39 = new THREE.Group();
  node_shopfront_a_transom_39.name = "Ground floor shopfront-a transom band__pivot";
  node_shopfront_a_transom_39.scale.set(1, 1, 1);
  if (endpoint_shopfront_a_transom_39) {
    node_shopfront_a_transom_39.position.copy(endpoint_shopfront_a_transom_39.start);
    node_shopfront_a_transom_39.rotation.set(0, 0, 0);
  } else {
    node_shopfront_a_transom_39.position.set(-3.3, 4.62, 3.6);
    node_shopfront_a_transom_39.rotation.set(0, 0, 0);
  }
  node_shopfront_a_transom_39.userData.sculptComponent = { "id": "shopfront-a-transom", "name": "Ground floor shopfront-a transom band", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.28, "height": 0.2, "depth": 2.2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.3, 4.62, 3.6], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stone band over the shopfront head"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_shopfront_a_transom_39.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_shopfront_a_transom_39);
  nodes["shopfront-a-transom"] = node_shopfront_a_transom_39;
  const mesh_shopfront_a_transom_39Geometry = endpoint_shopfront_a_transom_39 ? new THREE.CylinderGeometry(endpoint_shopfront_a_transom_39.endRadius, endpoint_shopfront_a_transom_39.baseRadius, endpoint_shopfront_a_transom_39.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shopfront_a_transom_39) {
    mesh_shopfront_a_transom_39Geometry.scale(0.28, 0.2, 2.2);
  }
  const mesh_shopfront_a_transom_39 = new THREE.Mesh(
    mesh_shopfront_a_transom_39Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shopfront_a_transom_39.name = "Ground floor shopfront-a transom band";
  if (endpoint_shopfront_a_transom_39) {
    mesh_shopfront_a_transom_39.position.copy(endpoint_shopfront_a_transom_39.midpoint);
    mesh_shopfront_a_transom_39.quaternion.copy(endpoint_shopfront_a_transom_39.quaternion);
  }
  mesh_shopfront_a_transom_39.castShadow = options.castShadow ?? true;
  mesh_shopfront_a_transom_39.receiveShadow = options.receiveShadow ?? true;
  mesh_shopfront_a_transom_39.userData.sculptComponent = node_shopfront_a_transom_39.userData.sculptComponent;
  node_shopfront_a_transom_39.add(mesh_shopfront_a_transom_39);
  meshes["shopfront-a-transom"] = mesh_shopfront_a_transom_39;
  colliders["shopfront-a-transom"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shopfront"] ?? (destructionGroups["shopfront"] = []);
  destructionGroups["shopfront"].push(node_shopfront_a_transom_39);
  const attachment_shopfront_b_frame_40 = null;
  const endpoint_shopfront_b_frame_40 = makeAttachmentEndpoint(attachment_shopfront_b_frame_40);
  const node_shopfront_b_frame_40 = new THREE.Group();
  node_shopfront_b_frame_40.name = "Ground floor shopfront-b frame__pivot";
  node_shopfront_b_frame_40.scale.set(1, 1, 1);
  if (endpoint_shopfront_b_frame_40) {
    node_shopfront_b_frame_40.position.copy(endpoint_shopfront_b_frame_40.start);
    node_shopfront_b_frame_40.rotation.set(0, 0, 0);
  } else {
    node_shopfront_b_frame_40.position.set(-3.36, 3.2, 1);
    node_shopfront_b_frame_40.rotation.set(0, 0, 0);
  }
  node_shopfront_b_frame_40.userData.sculptComponent = { "id": "shopfront-b-frame", "name": "Ground floor shopfront-b frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.8, "depth": 2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 3.2, 1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["shopfront frame with heavy pale mullion grid"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_shopfront_b_frame_40.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_shopfront_b_frame_40);
  nodes["shopfront-b-frame"] = node_shopfront_b_frame_40;
  const mesh_shopfront_b_frame_40Geometry = endpoint_shopfront_b_frame_40 ? new THREE.CylinderGeometry(endpoint_shopfront_b_frame_40.endRadius, endpoint_shopfront_b_frame_40.baseRadius, endpoint_shopfront_b_frame_40.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shopfront_b_frame_40) {
    mesh_shopfront_b_frame_40Geometry.scale(0.16, 2.8, 2);
  }
  const mesh_shopfront_b_frame_40 = new THREE.Mesh(
    mesh_shopfront_b_frame_40Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shopfront_b_frame_40.name = "Ground floor shopfront-b frame";
  if (endpoint_shopfront_b_frame_40) {
    mesh_shopfront_b_frame_40.position.copy(endpoint_shopfront_b_frame_40.midpoint);
    mesh_shopfront_b_frame_40.quaternion.copy(endpoint_shopfront_b_frame_40.quaternion);
  }
  mesh_shopfront_b_frame_40.castShadow = options.castShadow ?? true;
  mesh_shopfront_b_frame_40.receiveShadow = options.receiveShadow ?? true;
  mesh_shopfront_b_frame_40.userData.sculptComponent = node_shopfront_b_frame_40.userData.sculptComponent;
  node_shopfront_b_frame_40.add(mesh_shopfront_b_frame_40);
  meshes["shopfront-b-frame"] = mesh_shopfront_b_frame_40;
  colliders["shopfront-b-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shopfront"] ?? (destructionGroups["shopfront"] = []);
  destructionGroups["shopfront"].push(node_shopfront_b_frame_40);
  const attachment_shopfront_b_glass_41 = null;
  const endpoint_shopfront_b_glass_41 = makeAttachmentEndpoint(attachment_shopfront_b_glass_41);
  const node_shopfront_b_glass_41 = new THREE.Group();
  node_shopfront_b_glass_41.name = "Ground floor shopfront-b glass__pivot";
  node_shopfront_b_glass_41.scale.set(1, 1, 1);
  if (endpoint_shopfront_b_glass_41) {
    node_shopfront_b_glass_41.position.copy(endpoint_shopfront_b_glass_41.start);
    node_shopfront_b_glass_41.rotation.set(0, 0, 0);
  } else {
    node_shopfront_b_glass_41.position.set(-3.26, 3.2, 1);
    node_shopfront_b_glass_41.rotation.set(0, 0, 0);
  }
  node_shopfront_b_glass_41.userData.sculptComponent = { "id": "shopfront-b-glass", "name": "Ground floor shopfront-b glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.56, "depth": 1.78, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 3.2, 1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["the plate's brightest amber field; spills warm light onto the pavement"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_shopfront_b_glass_41.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_shopfront_b_glass_41);
  nodes["shopfront-b-glass"] = node_shopfront_b_glass_41;
  const mesh_shopfront_b_glass_41Geometry = endpoint_shopfront_b_glass_41 ? new THREE.CylinderGeometry(endpoint_shopfront_b_glass_41.endRadius, endpoint_shopfront_b_glass_41.baseRadius, endpoint_shopfront_b_glass_41.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shopfront_b_glass_41) {
    mesh_shopfront_b_glass_41Geometry.scale(0.06, 2.56, 1.78);
  }
  const mesh_shopfront_b_glass_41 = new THREE.Mesh(
    mesh_shopfront_b_glass_41Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shopfront_b_glass_41.name = "Ground floor shopfront-b glass";
  if (endpoint_shopfront_b_glass_41) {
    mesh_shopfront_b_glass_41.position.copy(endpoint_shopfront_b_glass_41.midpoint);
    mesh_shopfront_b_glass_41.quaternion.copy(endpoint_shopfront_b_glass_41.quaternion);
  }
  mesh_shopfront_b_glass_41.castShadow = options.castShadow ?? true;
  mesh_shopfront_b_glass_41.receiveShadow = options.receiveShadow ?? true;
  mesh_shopfront_b_glass_41.userData.sculptComponent = node_shopfront_b_glass_41.userData.sculptComponent;
  node_shopfront_b_glass_41.add(mesh_shopfront_b_glass_41);
  meshes["shopfront-b-glass"] = mesh_shopfront_b_glass_41;
  colliders["shopfront-b-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shopfront"] ?? (destructionGroups["shopfront"] = []);
  destructionGroups["shopfront"].push(node_shopfront_b_glass_41);
  const attachment_shopfront_b_transom_42 = null;
  const endpoint_shopfront_b_transom_42 = makeAttachmentEndpoint(attachment_shopfront_b_transom_42);
  const node_shopfront_b_transom_42 = new THREE.Group();
  node_shopfront_b_transom_42.name = "Ground floor shopfront-b transom band__pivot";
  node_shopfront_b_transom_42.scale.set(1, 1, 1);
  if (endpoint_shopfront_b_transom_42) {
    node_shopfront_b_transom_42.position.copy(endpoint_shopfront_b_transom_42.start);
    node_shopfront_b_transom_42.rotation.set(0, 0, 0);
  } else {
    node_shopfront_b_transom_42.position.set(-3.3, 4.62, 1);
    node_shopfront_b_transom_42.rotation.set(0, 0, 0);
  }
  node_shopfront_b_transom_42.userData.sculptComponent = { "id": "shopfront-b-transom", "name": "Ground floor shopfront-b transom band", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.28, "height": 0.2, "depth": 2.2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.3, 4.62, 1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stone band over the shopfront head"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_shopfront_b_transom_42.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shopfront", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_shopfront_b_transom_42);
  nodes["shopfront-b-transom"] = node_shopfront_b_transom_42;
  const mesh_shopfront_b_transom_42Geometry = endpoint_shopfront_b_transom_42 ? new THREE.CylinderGeometry(endpoint_shopfront_b_transom_42.endRadius, endpoint_shopfront_b_transom_42.baseRadius, endpoint_shopfront_b_transom_42.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shopfront_b_transom_42) {
    mesh_shopfront_b_transom_42Geometry.scale(0.28, 0.2, 2.2);
  }
  const mesh_shopfront_b_transom_42 = new THREE.Mesh(
    mesh_shopfront_b_transom_42Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shopfront_b_transom_42.name = "Ground floor shopfront-b transom band";
  if (endpoint_shopfront_b_transom_42) {
    mesh_shopfront_b_transom_42.position.copy(endpoint_shopfront_b_transom_42.midpoint);
    mesh_shopfront_b_transom_42.quaternion.copy(endpoint_shopfront_b_transom_42.quaternion);
  }
  mesh_shopfront_b_transom_42.castShadow = options.castShadow ?? true;
  mesh_shopfront_b_transom_42.receiveShadow = options.receiveShadow ?? true;
  mesh_shopfront_b_transom_42.userData.sculptComponent = node_shopfront_b_transom_42.userData.sculptComponent;
  node_shopfront_b_transom_42.add(mesh_shopfront_b_transom_42);
  meshes["shopfront-b-transom"] = mesh_shopfront_b_transom_42;
  colliders["shopfront-b-transom"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shopfront"] ?? (destructionGroups["shopfront"] = []);
  destructionGroups["shopfront"].push(node_shopfront_b_transom_42);
  const attachment_shop_window_c_frame_43 = null;
  const endpoint_shop_window_c_frame_43 = makeAttachmentEndpoint(attachment_shop_window_c_frame_43);
  const node_shop_window_c_frame_43 = new THREE.Group();
  node_shop_window_c_frame_43.name = "Ground floor shop-window-c frame__pivot";
  node_shop_window_c_frame_43.scale.set(1, 1, 1);
  if (endpoint_shop_window_c_frame_43) {
    node_shop_window_c_frame_43.position.copy(endpoint_shop_window_c_frame_43.start);
    node_shop_window_c_frame_43.rotation.set(0, 0, 0);
  } else {
    node_shop_window_c_frame_43.position.set(-3.36, 3.2, -1);
    node_shop_window_c_frame_43.rotation.set(0, 0, 0);
  }
  node_shop_window_c_frame_43.userData.sculptComponent = { "id": "shop-window-c-frame", "name": "Ground floor shop-window-c frame", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.16, "height": 2.8, "depth": 1.2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [-3.36, 3.2, -1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["shopfront frame with heavy pale mullion grid"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_shop_window_c_frame_43.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_shop_window_c_frame_43);
  nodes["shop-window-c-frame"] = node_shop_window_c_frame_43;
  const mesh_shop_window_c_frame_43Geometry = endpoint_shop_window_c_frame_43 ? new THREE.CylinderGeometry(endpoint_shop_window_c_frame_43.endRadius, endpoint_shop_window_c_frame_43.baseRadius, endpoint_shop_window_c_frame_43.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shop_window_c_frame_43) {
    mesh_shop_window_c_frame_43Geometry.scale(0.16, 2.8, 1.2);
  }
  const mesh_shop_window_c_frame_43 = new THREE.Mesh(
    mesh_shop_window_c_frame_43Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shop_window_c_frame_43.name = "Ground floor shop-window-c frame";
  if (endpoint_shop_window_c_frame_43) {
    mesh_shop_window_c_frame_43.position.copy(endpoint_shop_window_c_frame_43.midpoint);
    mesh_shop_window_c_frame_43.quaternion.copy(endpoint_shop_window_c_frame_43.quaternion);
  }
  mesh_shop_window_c_frame_43.castShadow = options.castShadow ?? true;
  mesh_shop_window_c_frame_43.receiveShadow = options.receiveShadow ?? true;
  mesh_shop_window_c_frame_43.userData.sculptComponent = node_shop_window_c_frame_43.userData.sculptComponent;
  node_shop_window_c_frame_43.add(mesh_shop_window_c_frame_43);
  meshes["shop-window-c-frame"] = mesh_shop_window_c_frame_43;
  colliders["shop-window-c-frame"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shop"] ?? (destructionGroups["shop"] = []);
  destructionGroups["shop"].push(node_shop_window_c_frame_43);
  const attachment_shop_window_c_glass_44 = null;
  const endpoint_shop_window_c_glass_44 = makeAttachmentEndpoint(attachment_shop_window_c_glass_44);
  const node_shop_window_c_glass_44 = new THREE.Group();
  node_shop_window_c_glass_44.name = "Ground floor shop-window-c glass__pivot";
  node_shop_window_c_glass_44.scale.set(1, 1, 1);
  if (endpoint_shop_window_c_glass_44) {
    node_shop_window_c_glass_44.position.copy(endpoint_shop_window_c_glass_44.start);
    node_shop_window_c_glass_44.rotation.set(0, 0, 0);
  } else {
    node_shop_window_c_glass_44.position.set(-3.26, 3.2, -1);
    node_shop_window_c_glass_44.rotation.set(0, 0, 0);
  }
  node_shop_window_c_glass_44.userData.sculptComponent = { "id": "shop-window-c-glass", "name": "Ground floor shop-window-c glass", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 2.56, "depth": 0.98, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.85 }, "transform": { "position": [-3.26, 3.2, -1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["the plate's brightest amber field; spills warm light onto the pavement"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_shop_window_c_glass_44.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_shop_window_c_glass_44);
  nodes["shop-window-c-glass"] = node_shop_window_c_glass_44;
  const mesh_shop_window_c_glass_44Geometry = endpoint_shop_window_c_glass_44 ? new THREE.CylinderGeometry(endpoint_shop_window_c_glass_44.endRadius, endpoint_shop_window_c_glass_44.baseRadius, endpoint_shop_window_c_glass_44.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shop_window_c_glass_44) {
    mesh_shop_window_c_glass_44Geometry.scale(0.06, 2.56, 0.98);
  }
  const mesh_shop_window_c_glass_44 = new THREE.Mesh(
    mesh_shop_window_c_glass_44Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shop_window_c_glass_44.name = "Ground floor shop-window-c glass";
  if (endpoint_shop_window_c_glass_44) {
    mesh_shop_window_c_glass_44.position.copy(endpoint_shop_window_c_glass_44.midpoint);
    mesh_shop_window_c_glass_44.quaternion.copy(endpoint_shop_window_c_glass_44.quaternion);
  }
  mesh_shop_window_c_glass_44.castShadow = options.castShadow ?? true;
  mesh_shop_window_c_glass_44.receiveShadow = options.receiveShadow ?? true;
  mesh_shop_window_c_glass_44.userData.sculptComponent = node_shop_window_c_glass_44.userData.sculptComponent;
  node_shop_window_c_glass_44.add(mesh_shop_window_c_glass_44);
  meshes["shop-window-c-glass"] = mesh_shop_window_c_glass_44;
  colliders["shop-window-c-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shop"] ?? (destructionGroups["shop"] = []);
  destructionGroups["shop"].push(node_shop_window_c_glass_44);
  const attachment_shop_window_c_transom_45 = null;
  const endpoint_shop_window_c_transom_45 = makeAttachmentEndpoint(attachment_shop_window_c_transom_45);
  const node_shop_window_c_transom_45 = new THREE.Group();
  node_shop_window_c_transom_45.name = "Ground floor shop-window-c transom band__pivot";
  node_shop_window_c_transom_45.scale.set(1, 1, 1);
  if (endpoint_shop_window_c_transom_45) {
    node_shop_window_c_transom_45.position.copy(endpoint_shop_window_c_transom_45.start);
    node_shop_window_c_transom_45.rotation.set(0, 0, 0);
  } else {
    node_shop_window_c_transom_45.position.set(-3.3, 4.62, -1);
    node_shop_window_c_transom_45.rotation.set(0, 0, 0);
  }
  node_shop_window_c_transom_45.userData.sculptComponent = { "id": "shop-window-c-transom", "name": "Ground floor shop-window-c transom band", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.28, "height": 0.2, "depth": 1.4, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.3, 4.62, -1], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } }, "material": "stone-trim", "materialLayers": ["stone-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stone band over the shopfront head"], "surfaceDetail": { "macroRoughness": 0.72, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(122, 106, 112, 1.0)", "secondaryAlbedo": "rgba(154, 149, 166, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #7a6a70; reproduction albedo #9a95a6; source: #cc8c5e under lamp / #56475e away" } };
  node_shop_window_c_transom_45.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "shop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-trim" } };
  (nodes["root"] ?? root).add(node_shop_window_c_transom_45);
  nodes["shop-window-c-transom"] = node_shop_window_c_transom_45;
  const mesh_shop_window_c_transom_45Geometry = endpoint_shop_window_c_transom_45 ? new THREE.CylinderGeometry(endpoint_shop_window_c_transom_45.endRadius, endpoint_shop_window_c_transom_45.baseRadius, endpoint_shop_window_c_transom_45.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_shop_window_c_transom_45) {
    mesh_shop_window_c_transom_45Geometry.scale(0.28, 0.2, 1.4);
  }
  const mesh_shop_window_c_transom_45 = new THREE.Mesh(
    mesh_shop_window_c_transom_45Geometry,
    materialMap["stone-trim"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_shop_window_c_transom_45.name = "Ground floor shop-window-c transom band";
  if (endpoint_shop_window_c_transom_45) {
    mesh_shop_window_c_transom_45.position.copy(endpoint_shop_window_c_transom_45.midpoint);
    mesh_shop_window_c_transom_45.quaternion.copy(endpoint_shop_window_c_transom_45.quaternion);
  }
  mesh_shop_window_c_transom_45.castShadow = options.castShadow ?? true;
  mesh_shop_window_c_transom_45.receiveShadow = options.receiveShadow ?? true;
  mesh_shop_window_c_transom_45.userData.sculptComponent = node_shop_window_c_transom_45.userData.sculptComponent;
  node_shop_window_c_transom_45.add(mesh_shop_window_c_transom_45);
  meshes["shop-window-c-transom"] = mesh_shop_window_c_transom_45;
  colliders["shop-window-c-transom"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["shop"] ?? (destructionGroups["shop"] = []);
  destructionGroups["shop"].push(node_shop_window_c_transom_45);
  const attachment_door_reveal_panel_46 = null;
  const endpoint_door_reveal_panel_46 = makeAttachmentEndpoint(attachment_door_reveal_panel_46);
  const node_door_reveal_panel_46 = new THREE.Group();
  node_door_reveal_panel_46.name = "Door reveal panel (dark inset behind the projecting surround)__pivot";
  node_door_reveal_panel_46.scale.set(1, 1, 1);
  if (endpoint_door_reveal_panel_46) {
    node_door_reveal_panel_46.position.copy(endpoint_door_reveal_panel_46.start);
    node_door_reveal_panel_46.rotation.set(0, 0, 0);
  } else {
    node_door_reveal_panel_46.position.set(-3.3, 2.6, -3.8);
    node_door_reveal_panel_46.rotation.set(0, 0, 0);
  }
  node_door_reveal_panel_46.userData.sculptComponent = { "id": "door-reveal-panel", "name": "Door reveal panel (dark inset behind the projecting surround)", "level": "meso", "role": "body", "importance": 0.65, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "the plate forms this dark reveal by PROJECTING the stone surround forward of a dark panel, not by carving a cavity: the panel's own faces are flat and its shadowed value comes from the surround occluding the lamps", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.24, "height": 3.2, "depth": 1.15, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-3.3, 2.6, -3.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-dark" } }, "material": "cab-dark", "materialLayers": ["cab-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["dark unlit reveal behind the surround, no interior glow"], "surfaceDetail": { "macroRoughness": 0.45, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(2, 3, 11, 1.0)", "secondaryAlbedo": "rgba(18, 22, 31, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #02030b; reproduction albedo #12161f; source: #02030b" } };
  node_door_reveal_panel_46.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-dark" } };
  (nodes["root"] ?? root).add(node_door_reveal_panel_46);
  nodes["door-reveal-panel"] = node_door_reveal_panel_46;
  const mesh_door_reveal_panel_46Geometry = endpoint_door_reveal_panel_46 ? new THREE.CylinderGeometry(endpoint_door_reveal_panel_46.endRadius, endpoint_door_reveal_panel_46.baseRadius, endpoint_door_reveal_panel_46.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_door_reveal_panel_46) {
    mesh_door_reveal_panel_46Geometry.scale(0.24, 3.2, 1.15);
  }
  const mesh_door_reveal_panel_46 = new THREE.Mesh(
    mesh_door_reveal_panel_46Geometry,
    materialMap["cab-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_door_reveal_panel_46.name = "Door reveal panel (dark inset behind the projecting surround)";
  if (endpoint_door_reveal_panel_46) {
    mesh_door_reveal_panel_46.position.copy(endpoint_door_reveal_panel_46.midpoint);
    mesh_door_reveal_panel_46.quaternion.copy(endpoint_door_reveal_panel_46.quaternion);
  }
  mesh_door_reveal_panel_46.castShadow = options.castShadow ?? true;
  mesh_door_reveal_panel_46.receiveShadow = options.receiveShadow ?? true;
  mesh_door_reveal_panel_46.userData.sculptComponent = node_door_reveal_panel_46.userData.sculptComponent;
  node_door_reveal_panel_46.add(mesh_door_reveal_panel_46);
  meshes["door-reveal-panel"] = mesh_door_reveal_panel_46;
  colliders["door-reveal-panel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["door"] ?? (destructionGroups["door"] = []);
  destructionGroups["door"].push(node_door_reveal_panel_46);
  const attachment_door_leaf_47 = null;
  const endpoint_door_leaf_47 = makeAttachmentEndpoint(attachment_door_leaf_47);
  const node_door_leaf_47 = new THREE.Group();
  node_door_leaf_47.name = "Panelled door__pivot";
  node_door_leaf_47.scale.set(1, 1, 1);
  if (endpoint_door_leaf_47) {
    node_door_leaf_47.position.copy(endpoint_door_leaf_47.start);
    node_door_leaf_47.rotation.set(0, 0, 0);
  } else {
    node_door_leaf_47.position.set(-3.36, 2.5, -3.8);
    node_door_leaf_47.rotation.set(0, 0, 0);
  }
  node_door_leaf_47.userData.sculptComponent = { "id": "door-leaf", "name": "Panelled door", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.1, "height": 2.8, "depth": 0.95, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.36, 2.5, -3.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } }, "material": "stone-plinth", "materialLayers": ["stone-plinth"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["two-panel door read as one dark slab at this scale"], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(64, 55, 71, 1.0)", "secondaryAlbedo": "rgba(124, 122, 143, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #403747; reproduction albedo #7c7a8f; source: #403747 door surround" } };
  node_door_leaf_47.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } };
  (nodes["root"] ?? root).add(node_door_leaf_47);
  nodes["door-leaf"] = node_door_leaf_47;
  const mesh_door_leaf_47Geometry = endpoint_door_leaf_47 ? new THREE.CylinderGeometry(endpoint_door_leaf_47.endRadius, endpoint_door_leaf_47.baseRadius, endpoint_door_leaf_47.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_door_leaf_47) {
    mesh_door_leaf_47Geometry.scale(0.1, 2.8, 0.95);
  }
  const mesh_door_leaf_47 = new THREE.Mesh(
    mesh_door_leaf_47Geometry,
    materialMap["stone-plinth"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_door_leaf_47.name = "Panelled door";
  if (endpoint_door_leaf_47) {
    mesh_door_leaf_47.position.copy(endpoint_door_leaf_47.midpoint);
    mesh_door_leaf_47.quaternion.copy(endpoint_door_leaf_47.quaternion);
  }
  mesh_door_leaf_47.castShadow = options.castShadow ?? true;
  mesh_door_leaf_47.receiveShadow = options.receiveShadow ?? true;
  mesh_door_leaf_47.userData.sculptComponent = node_door_leaf_47.userData.sculptComponent;
  node_door_leaf_47.add(mesh_door_leaf_47);
  meshes["door-leaf"] = mesh_door_leaf_47;
  colliders["door-leaf"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["door"] ?? (destructionGroups["door"] = []);
  destructionGroups["door"].push(node_door_leaf_47);
  const attachment_door_surround_48 = null;
  const endpoint_door_surround_48 = makeAttachmentEndpoint(attachment_door_surround_48);
  const node_door_surround_48 = new THREE.Group();
  node_door_surround_48.name = "Door stone surround__pivot";
  node_door_surround_48.scale.set(1, 1, 1);
  if (endpoint_door_surround_48) {
    node_door_surround_48.position.copy(endpoint_door_surround_48.start);
    node_door_surround_48.rotation.set(0, 0, 0);
  } else {
    node_door_surround_48.position.set(-3.29, 2.7, -3.8);
    node_door_surround_48.rotation.set(0, 0, 0);
  }
  node_door_surround_48.userData.sculptComponent = { "id": "door-surround", "name": "Door stone surround", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.26, "height": 3.5, "depth": 1.42, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.29, 2.7, -3.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } }, "material": "stone-plinth", "materialLayers": ["stone-plinth"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["pilaster surround with a heavy lintel over the opening"], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(64, 55, 71, 1.0)", "secondaryAlbedo": "rgba(124, 122, 143, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #403747; reproduction albedo #7c7a8f; source: #403747 door surround" } };
  node_door_surround_48.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } };
  (nodes["root"] ?? root).add(node_door_surround_48);
  nodes["door-surround"] = node_door_surround_48;
  const mesh_door_surround_48Geometry = endpoint_door_surround_48 ? new THREE.CylinderGeometry(endpoint_door_surround_48.endRadius, endpoint_door_surround_48.baseRadius, endpoint_door_surround_48.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_door_surround_48) {
    mesh_door_surround_48Geometry.scale(0.26, 3.5, 1.42);
  }
  const mesh_door_surround_48 = new THREE.Mesh(
    mesh_door_surround_48Geometry,
    materialMap["stone-plinth"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_door_surround_48.name = "Door stone surround";
  if (endpoint_door_surround_48) {
    mesh_door_surround_48.position.copy(endpoint_door_surround_48.midpoint);
    mesh_door_surround_48.quaternion.copy(endpoint_door_surround_48.quaternion);
  }
  mesh_door_surround_48.castShadow = options.castShadow ?? true;
  mesh_door_surround_48.receiveShadow = options.receiveShadow ?? true;
  mesh_door_surround_48.userData.sculptComponent = node_door_surround_48.userData.sculptComponent;
  node_door_surround_48.add(mesh_door_surround_48);
  meshes["door-surround"] = mesh_door_surround_48;
  colliders["door-surround"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["door"] ?? (destructionGroups["door"] = []);
  destructionGroups["door"].push(node_door_surround_48);
  const attachment_door_step_1_49 = null;
  const endpoint_door_step_1_49 = makeAttachmentEndpoint(attachment_door_step_1_49);
  const node_door_step_1_49 = new THREE.Group();
  node_door_step_1_49.name = "Door step, lower__pivot";
  node_door_step_1_49.scale.set(1, 1, 1);
  if (endpoint_door_step_1_49) {
    node_door_step_1_49.position.copy(endpoint_door_step_1_49.start);
    node_door_step_1_49.rotation.set(0, 0, 0);
  } else {
    node_door_step_1_49.position.set(-3, 0.26, -3.8);
    node_door_step_1_49.rotation.set(0, 0, 0);
  }
  node_door_step_1_49.userData.sculptComponent = { "id": "door-step-1", "name": "Door step, lower", "level": "micro", "role": "body", "importance": 0.45, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.55, "height": 0.2, "depth": 1.5, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3, 0.26, -3.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } }, "material": "stone-plinth", "materialLayers": ["stone-plinth"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["two stone steps up to the door"], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(64, 55, 71, 1.0)", "secondaryAlbedo": "rgba(124, 122, 143, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #403747; reproduction albedo #7c7a8f; source: #403747 door surround" } };
  node_door_step_1_49.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } };
  (nodes["root"] ?? root).add(node_door_step_1_49);
  nodes["door-step-1"] = node_door_step_1_49;
  const mesh_door_step_1_49Geometry = endpoint_door_step_1_49 ? new THREE.CylinderGeometry(endpoint_door_step_1_49.endRadius, endpoint_door_step_1_49.baseRadius, endpoint_door_step_1_49.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_door_step_1_49) {
    mesh_door_step_1_49Geometry.scale(0.55, 0.2, 1.5);
  }
  const mesh_door_step_1_49 = new THREE.Mesh(
    mesh_door_step_1_49Geometry,
    materialMap["stone-plinth"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_door_step_1_49.name = "Door step, lower";
  if (endpoint_door_step_1_49) {
    mesh_door_step_1_49.position.copy(endpoint_door_step_1_49.midpoint);
    mesh_door_step_1_49.quaternion.copy(endpoint_door_step_1_49.quaternion);
  }
  mesh_door_step_1_49.castShadow = options.castShadow ?? true;
  mesh_door_step_1_49.receiveShadow = options.receiveShadow ?? true;
  mesh_door_step_1_49.userData.sculptComponent = node_door_step_1_49.userData.sculptComponent;
  node_door_step_1_49.add(mesh_door_step_1_49);
  meshes["door-step-1"] = mesh_door_step_1_49;
  colliders["door-step-1"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["door"] ?? (destructionGroups["door"] = []);
  destructionGroups["door"].push(node_door_step_1_49);
  const attachment_door_step_2_50 = null;
  const endpoint_door_step_2_50 = makeAttachmentEndpoint(attachment_door_step_2_50);
  const node_door_step_2_50 = new THREE.Group();
  node_door_step_2_50.name = "Door step, upper__pivot";
  node_door_step_2_50.scale.set(1, 1, 1);
  if (endpoint_door_step_2_50) {
    node_door_step_2_50.position.copy(endpoint_door_step_2_50.start);
    node_door_step_2_50.rotation.set(0, 0, 0);
  } else {
    node_door_step_2_50.position.set(-3.14, 0.46, -3.8);
    node_door_step_2_50.rotation.set(0, 0, 0);
  }
  node_door_step_2_50.userData.sculptComponent = { "id": "door-step-2", "name": "Door step, upper", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.35, "height": 0.2, "depth": 1.4, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-3.14, 0.46, -3.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } }, "material": "stone-plinth", "materialLayers": ["stone-plinth"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.8, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(64, 55, 71, 1.0)", "secondaryAlbedo": "rgba(124, 122, 143, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #403747; reproduction albedo #7c7a8f; source: #403747 door surround" } };
  node_door_step_2_50.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "door", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone-plinth" } };
  (nodes["root"] ?? root).add(node_door_step_2_50);
  nodes["door-step-2"] = node_door_step_2_50;
  const mesh_door_step_2_50Geometry = endpoint_door_step_2_50 ? new THREE.CylinderGeometry(endpoint_door_step_2_50.endRadius, endpoint_door_step_2_50.baseRadius, endpoint_door_step_2_50.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_door_step_2_50) {
    mesh_door_step_2_50Geometry.scale(0.35, 0.2, 1.4);
  }
  const mesh_door_step_2_50 = new THREE.Mesh(
    mesh_door_step_2_50Geometry,
    materialMap["stone-plinth"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_door_step_2_50.name = "Door step, upper";
  if (endpoint_door_step_2_50) {
    mesh_door_step_2_50.position.copy(endpoint_door_step_2_50.midpoint);
    mesh_door_step_2_50.quaternion.copy(endpoint_door_step_2_50.quaternion);
  }
  mesh_door_step_2_50.castShadow = options.castShadow ?? true;
  mesh_door_step_2_50.receiveShadow = options.receiveShadow ?? true;
  mesh_door_step_2_50.userData.sculptComponent = node_door_step_2_50.userData.sculptComponent;
  node_door_step_2_50.add(mesh_door_step_2_50);
  meshes["door-step-2"] = mesh_door_step_2_50;
  colliders["door-step-2"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["door"] ?? (destructionGroups["door"] = []);
  destructionGroups["door"].push(node_door_step_2_50);
  const attachment_sign_a_board_51 = null;
  const endpoint_sign_a_board_51 = makeAttachmentEndpoint(attachment_sign_a_board_51);
  const node_sign_a_board_51 = new THREE.Group();
  node_sign_a_board_51.name = "High hanging signboard (north bay)__pivot";
  node_sign_a_board_51.scale.set(1, 1, 1);
  if (endpoint_sign_a_board_51) {
    node_sign_a_board_51.position.copy(endpoint_sign_a_board_51.start);
    node_sign_a_board_51.rotation.set(0, 0, 0);
  } else {
    node_sign_a_board_51.position.set(-2.35, 6.85, -4.35);
    node_sign_a_board_51.rotation.set(0, 0, 0);
  }
  node_sign_a_board_51.userData.sculptComponent = { "id": "sign-a-board", "name": "High hanging signboard (north bay)", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.09, "height": 0.78, "depth": 1.05, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-2.35, 6.85, -4.35], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wood-sign" } }, "material": "wood-sign", "materialLayers": ["wood-sign"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["vertical plank board hung square to the facade, warm tan"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(129, 79, 48, 1.0)", "secondaryAlbedo": "rgba(165, 113, 60, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #814f30; reproduction albedo #a5713c; source: #814f30 sign board" } };
  node_sign_a_board_51.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wood-sign" } };
  (nodes["root"] ?? root).add(node_sign_a_board_51);
  nodes["sign-a-board"] = node_sign_a_board_51;
  const mesh_sign_a_board_51Geometry = endpoint_sign_a_board_51 ? new THREE.CylinderGeometry(endpoint_sign_a_board_51.endRadius, endpoint_sign_a_board_51.baseRadius, endpoint_sign_a_board_51.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_sign_a_board_51) {
    mesh_sign_a_board_51Geometry.scale(0.09, 0.78, 1.05);
  }
  const mesh_sign_a_board_51 = new THREE.Mesh(
    mesh_sign_a_board_51Geometry,
    materialMap["wood-sign"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_a_board_51.name = "High hanging signboard (north bay)";
  if (endpoint_sign_a_board_51) {
    mesh_sign_a_board_51.position.copy(endpoint_sign_a_board_51.midpoint);
    mesh_sign_a_board_51.quaternion.copy(endpoint_sign_a_board_51.quaternion);
  }
  mesh_sign_a_board_51.castShadow = options.castShadow ?? true;
  mesh_sign_a_board_51.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_a_board_51.userData.sculptComponent = node_sign_a_board_51.userData.sculptComponent;
  node_sign_a_board_51.add(mesh_sign_a_board_51);
  meshes["sign-a-board"] = mesh_sign_a_board_51;
  colliders["sign-a-board"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_a_board_51);
  const attachment_sign_a_arm_52 = { "parentId": "root", "parentSocket": "root:sign-a-arm-mount", "localStart": [-3.36, 7.55, -4.35], "localEnd": [-2.28, 7.5, -4.35], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.045, "endRadius": 0.035, "contactNormal": [0, 1, 0], "evidenceRefs": ["facade-zone"] };
  const endpoint_sign_a_arm_52 = makeAttachmentEndpoint(attachment_sign_a_arm_52);
  const node_sign_a_arm_52 = new THREE.Group();
  node_sign_a_arm_52.name = "Sign bracket arm (north bay)__pivot";
  node_sign_a_arm_52.scale.set(1, 1, 1);
  if (endpoint_sign_a_arm_52) {
    node_sign_a_arm_52.position.copy(endpoint_sign_a_arm_52.start);
    node_sign_a_arm_52.rotation.set(0, 0, 0);
  } else {
    node_sign_a_arm_52.position.set(0, 0, 0);
    node_sign_a_arm_52.rotation.set(0, 0, 0);
  }
  node_sign_a_arm_52.userData.sculptComponent = { "id": "sign-a-arm", "name": "Sign bracket arm (north bay)", "level": "meso", "role": "strut", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:sign-a-arm-mount", "localStart": [-3.36, 7.55, -4.35], "localEnd": [-2.28, 7.5, -4.35], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.045, "endRadius": 0.035, "contactNormal": [0, 1, 0], "evidenceRefs": ["facade-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_sign_a_arm_52.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_sign_a_arm_52);
  nodes["sign-a-arm"] = node_sign_a_arm_52;
  const mesh_sign_a_arm_52Geometry = endpoint_sign_a_arm_52 ? new THREE.CylinderGeometry(endpoint_sign_a_arm_52.endRadius, endpoint_sign_a_arm_52.baseRadius, endpoint_sign_a_arm_52.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_sign_a_arm_52) {
    mesh_sign_a_arm_52Geometry.scale(1, 1, 1);
  }
  const mesh_sign_a_arm_52 = new THREE.Mesh(
    mesh_sign_a_arm_52Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_a_arm_52.name = "Sign bracket arm (north bay)";
  if (endpoint_sign_a_arm_52) {
    mesh_sign_a_arm_52.position.copy(endpoint_sign_a_arm_52.midpoint);
    mesh_sign_a_arm_52.quaternion.copy(endpoint_sign_a_arm_52.quaternion);
  }
  mesh_sign_a_arm_52.castShadow = options.castShadow ?? true;
  mesh_sign_a_arm_52.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_a_arm_52.userData.sculptComponent = node_sign_a_arm_52.userData.sculptComponent;
  node_sign_a_arm_52.add(mesh_sign_a_arm_52);
  meshes["sign-a-arm"] = mesh_sign_a_arm_52;
  colliders["sign-a-arm"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_a_arm_52);
  const attachment_sign_a_hanger_53 = { "parentId": "root", "parentSocket": "root:sign-a-hanger-mount", "localStart": [-2.35, 7.48, -4.35], "localEnd": [-2.35, 7.22, -4.35], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.025, "endRadius": 0.025, "contactNormal": [0, 1, 0], "evidenceRefs": ["facade-zone"] };
  const endpoint_sign_a_hanger_53 = makeAttachmentEndpoint(attachment_sign_a_hanger_53);
  const node_sign_a_hanger_53 = new THREE.Group();
  node_sign_a_hanger_53.name = "Sign hanger rod (north bay)__pivot";
  node_sign_a_hanger_53.scale.set(1, 1, 1);
  if (endpoint_sign_a_hanger_53) {
    node_sign_a_hanger_53.position.copy(endpoint_sign_a_hanger_53.start);
    node_sign_a_hanger_53.rotation.set(0, 0, 0);
  } else {
    node_sign_a_hanger_53.position.set(0, 0, 0);
    node_sign_a_hanger_53.rotation.set(0, 0, 0);
  }
  node_sign_a_hanger_53.userData.sculptComponent = { "id": "sign-a-hanger", "name": "Sign hanger rod (north bay)", "level": "micro", "role": "strut", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:sign-a-hanger-mount", "localStart": [-2.35, 7.48, -4.35], "localEnd": [-2.35, 7.22, -4.35], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.025, "endRadius": 0.025, "contactNormal": [0, 1, 0], "evidenceRefs": ["facade-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_sign_a_hanger_53.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_sign_a_hanger_53);
  nodes["sign-a-hanger"] = node_sign_a_hanger_53;
  const mesh_sign_a_hanger_53Geometry = endpoint_sign_a_hanger_53 ? new THREE.CylinderGeometry(endpoint_sign_a_hanger_53.endRadius, endpoint_sign_a_hanger_53.baseRadius, endpoint_sign_a_hanger_53.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_sign_a_hanger_53) {
    mesh_sign_a_hanger_53Geometry.scale(1, 1, 1);
  }
  const mesh_sign_a_hanger_53 = new THREE.Mesh(
    mesh_sign_a_hanger_53Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_a_hanger_53.name = "Sign hanger rod (north bay)";
  if (endpoint_sign_a_hanger_53) {
    mesh_sign_a_hanger_53.position.copy(endpoint_sign_a_hanger_53.midpoint);
    mesh_sign_a_hanger_53.quaternion.copy(endpoint_sign_a_hanger_53.quaternion);
  }
  mesh_sign_a_hanger_53.castShadow = options.castShadow ?? true;
  mesh_sign_a_hanger_53.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_a_hanger_53.userData.sculptComponent = node_sign_a_hanger_53.userData.sculptComponent;
  node_sign_a_hanger_53.add(mesh_sign_a_hanger_53);
  meshes["sign-a-hanger"] = mesh_sign_a_hanger_53;
  colliders["sign-a-hanger"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_a_hanger_53);
  const attachment_sign_b_board_54 = null;
  const endpoint_sign_b_board_54 = makeAttachmentEndpoint(attachment_sign_b_board_54);
  const node_sign_b_board_54 = new THREE.Group();
  node_sign_b_board_54.name = "Shop signboard over the shopfront__pivot";
  node_sign_b_board_54.scale.set(1, 1, 1);
  if (endpoint_sign_b_board_54) {
    node_sign_b_board_54.position.copy(endpoint_sign_b_board_54.start);
    node_sign_b_board_54.rotation.set(0, 0, 0);
  } else {
    node_sign_b_board_54.position.set(-2.52, 4.9, -0.6);
    node_sign_b_board_54.rotation.set(0, 0, 0);
  }
  node_sign_b_board_54.userData.sculptComponent = { "id": "sign-b-board", "name": "Shop signboard over the shopfront", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.09, "height": 0.62, "depth": 0.98, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-2.52, 4.9, -0.6], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wood-sign" } }, "material": "wood-sign", "materialLayers": ["wood-sign"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["second plank board, lower and closer to the lamp"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(129, 79, 48, 1.0)", "secondaryAlbedo": "rgba(165, 113, 60, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #814f30; reproduction albedo #a5713c; source: #814f30 sign board" } };
  node_sign_b_board_54.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wood-sign" } };
  (nodes["root"] ?? root).add(node_sign_b_board_54);
  nodes["sign-b-board"] = node_sign_b_board_54;
  const mesh_sign_b_board_54Geometry = endpoint_sign_b_board_54 ? new THREE.CylinderGeometry(endpoint_sign_b_board_54.endRadius, endpoint_sign_b_board_54.baseRadius, endpoint_sign_b_board_54.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_sign_b_board_54) {
    mesh_sign_b_board_54Geometry.scale(0.09, 0.62, 0.98);
  }
  const mesh_sign_b_board_54 = new THREE.Mesh(
    mesh_sign_b_board_54Geometry,
    materialMap["wood-sign"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_b_board_54.name = "Shop signboard over the shopfront";
  if (endpoint_sign_b_board_54) {
    mesh_sign_b_board_54.position.copy(endpoint_sign_b_board_54.midpoint);
    mesh_sign_b_board_54.quaternion.copy(endpoint_sign_b_board_54.quaternion);
  }
  mesh_sign_b_board_54.castShadow = options.castShadow ?? true;
  mesh_sign_b_board_54.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_b_board_54.userData.sculptComponent = node_sign_b_board_54.userData.sculptComponent;
  node_sign_b_board_54.add(mesh_sign_b_board_54);
  meshes["sign-b-board"] = mesh_sign_b_board_54;
  colliders["sign-b-board"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_b_board_54);
  const attachment_sign_b_arm_55 = { "parentId": "root", "parentSocket": "root:sign-b-arm-mount", "localStart": [-3.36, 5.46, -0.6], "localEnd": [-2.45, 5.42, -0.6], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.04, "endRadius": 0.03, "contactNormal": [0, 1, 0], "evidenceRefs": ["facade-zone"] };
  const endpoint_sign_b_arm_55 = makeAttachmentEndpoint(attachment_sign_b_arm_55);
  const node_sign_b_arm_55 = new THREE.Group();
  node_sign_b_arm_55.name = "Shop sign bracket arm__pivot";
  node_sign_b_arm_55.scale.set(1, 1, 1);
  if (endpoint_sign_b_arm_55) {
    node_sign_b_arm_55.position.copy(endpoint_sign_b_arm_55.start);
    node_sign_b_arm_55.rotation.set(0, 0, 0);
  } else {
    node_sign_b_arm_55.position.set(0, 0, 0);
    node_sign_b_arm_55.rotation.set(0, 0, 0);
  }
  node_sign_b_arm_55.userData.sculptComponent = { "id": "sign-b-arm", "name": "Shop sign bracket arm", "level": "meso", "role": "strut", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:sign-b-arm-mount", "localStart": [-3.36, 5.46, -0.6], "localEnd": [-2.45, 5.42, -0.6], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.04, "endRadius": 0.03, "contactNormal": [0, 1, 0], "evidenceRefs": ["facade-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["facade-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["facade-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_sign_b_arm_55.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_sign_b_arm_55);
  nodes["sign-b-arm"] = node_sign_b_arm_55;
  const mesh_sign_b_arm_55Geometry = endpoint_sign_b_arm_55 ? new THREE.CylinderGeometry(endpoint_sign_b_arm_55.endRadius, endpoint_sign_b_arm_55.baseRadius, endpoint_sign_b_arm_55.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_sign_b_arm_55) {
    mesh_sign_b_arm_55Geometry.scale(1, 1, 1);
  }
  const mesh_sign_b_arm_55 = new THREE.Mesh(
    mesh_sign_b_arm_55Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_b_arm_55.name = "Shop sign bracket arm";
  if (endpoint_sign_b_arm_55) {
    mesh_sign_b_arm_55.position.copy(endpoint_sign_b_arm_55.midpoint);
    mesh_sign_b_arm_55.quaternion.copy(endpoint_sign_b_arm_55.quaternion);
  }
  mesh_sign_b_arm_55.castShadow = options.castShadow ?? true;
  mesh_sign_b_arm_55.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_b_arm_55.userData.sculptComponent = node_sign_b_arm_55.userData.sculptComponent;
  node_sign_b_arm_55.add(mesh_sign_b_arm_55);
  meshes["sign-b-arm"] = mesh_sign_b_arm_55;
  colliders["sign-b-arm"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_b_arm_55);
  const attachment_sign_c_board_56 = null;
  const endpoint_sign_c_board_56 = makeAttachmentEndpoint(attachment_sign_c_board_56);
  const node_sign_c_board_56 = new THREE.Group();
  node_sign_c_board_56.name = "Pier signboard__pivot";
  node_sign_c_board_56.scale.set(1, 1, 1);
  if (endpoint_sign_c_board_56) {
    node_sign_c_board_56.position.copy(endpoint_sign_c_board_56.start);
    node_sign_c_board_56.rotation.set(0, 0, 0);
  } else {
    node_sign_c_board_56.position.set(4.1, 4.4, -2.92);
    node_sign_c_board_56.rotation.set(0, 0, 0);
  }
  node_sign_c_board_56.userData.sculptComponent = { "id": "sign-c-board", "name": "Pier signboard", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.92, "height": 0.62, "depth": 0.09, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.65 }, "transform": { "position": [4.1, 4.4, -2.92], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wood-sign" } }, "material": "wood-sign", "materialLayers": ["wood-sign"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["board hung off the pier's street face"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["pier-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(129, 79, 48, 1.0)", "secondaryAlbedo": "rgba(165, 113, 60, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["pier-zone"], "samplingNotes": "plate-observed dominant #814f30; reproduction albedo #a5713c; source: #814f30 sign board" } };
  node_sign_c_board_56.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "wood-sign" } };
  (nodes["root"] ?? root).add(node_sign_c_board_56);
  nodes["sign-c-board"] = node_sign_c_board_56;
  const mesh_sign_c_board_56Geometry = endpoint_sign_c_board_56 ? new THREE.CylinderGeometry(endpoint_sign_c_board_56.endRadius, endpoint_sign_c_board_56.baseRadius, endpoint_sign_c_board_56.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_sign_c_board_56) {
    mesh_sign_c_board_56Geometry.scale(0.92, 0.62, 0.09);
  }
  const mesh_sign_c_board_56 = new THREE.Mesh(
    mesh_sign_c_board_56Geometry,
    materialMap["wood-sign"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_c_board_56.name = "Pier signboard";
  if (endpoint_sign_c_board_56) {
    mesh_sign_c_board_56.position.copy(endpoint_sign_c_board_56.midpoint);
    mesh_sign_c_board_56.quaternion.copy(endpoint_sign_c_board_56.quaternion);
  }
  mesh_sign_c_board_56.castShadow = options.castShadow ?? true;
  mesh_sign_c_board_56.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_c_board_56.userData.sculptComponent = node_sign_c_board_56.userData.sculptComponent;
  node_sign_c_board_56.add(mesh_sign_c_board_56);
  meshes["sign-c-board"] = mesh_sign_c_board_56;
  colliders["sign-c-board"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_c_board_56);
  const attachment_sign_c_arm_57 = { "parentId": "root", "parentSocket": "root:sign-c-arm-mount", "localStart": [4.1, 5.02, -3.32], "localEnd": [4.1, 4.98, -2.86], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.04, "endRadius": 0.03, "contactNormal": [0, 1, 0], "evidenceRefs": ["pier-zone"] };
  const endpoint_sign_c_arm_57 = makeAttachmentEndpoint(attachment_sign_c_arm_57);
  const node_sign_c_arm_57 = new THREE.Group();
  node_sign_c_arm_57.name = "Pier sign bracket arm__pivot";
  node_sign_c_arm_57.scale.set(1, 1, 1);
  if (endpoint_sign_c_arm_57) {
    node_sign_c_arm_57.position.copy(endpoint_sign_c_arm_57.start);
    node_sign_c_arm_57.rotation.set(0, 0, 0);
  } else {
    node_sign_c_arm_57.position.set(0, 0, 0);
    node_sign_c_arm_57.rotation.set(0, 0, 0);
  }
  node_sign_c_arm_57.userData.sculptComponent = { "id": "sign-c-arm", "name": "Pier sign bracket arm", "level": "meso", "role": "strut", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:sign-c-arm-mount", "localStart": [4.1, 5.02, -3.32], "localEnd": [4.1, 4.98, -2.86], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.04, "endRadius": 0.03, "contactNormal": [0, 1, 0], "evidenceRefs": ["pier-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["pier-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["pier-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_sign_c_arm_57.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "sign", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_sign_c_arm_57);
  nodes["sign-c-arm"] = node_sign_c_arm_57;
  const mesh_sign_c_arm_57Geometry = endpoint_sign_c_arm_57 ? new THREE.CylinderGeometry(endpoint_sign_c_arm_57.endRadius, endpoint_sign_c_arm_57.baseRadius, endpoint_sign_c_arm_57.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_sign_c_arm_57) {
    mesh_sign_c_arm_57Geometry.scale(1, 1, 1);
  }
  const mesh_sign_c_arm_57 = new THREE.Mesh(
    mesh_sign_c_arm_57Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_sign_c_arm_57.name = "Pier sign bracket arm";
  if (endpoint_sign_c_arm_57) {
    mesh_sign_c_arm_57.position.copy(endpoint_sign_c_arm_57.midpoint);
    mesh_sign_c_arm_57.quaternion.copy(endpoint_sign_c_arm_57.quaternion);
  }
  mesh_sign_c_arm_57.castShadow = options.castShadow ?? true;
  mesh_sign_c_arm_57.receiveShadow = options.receiveShadow ?? true;
  mesh_sign_c_arm_57.userData.sculptComponent = node_sign_c_arm_57.userData.sculptComponent;
  node_sign_c_arm_57.add(mesh_sign_c_arm_57);
  meshes["sign-c-arm"] = mesh_sign_c_arm_57;
  colliders["sign-c-arm"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["sign"] ?? (destructionGroups["sign"] = []);
  destructionGroups["sign"].push(node_sign_c_arm_57);
  const attachment_corner_pier_58 = null;
  const endpoint_corner_pier_58 = makeAttachmentEndpoint(attachment_corner_pier_58);
  const node_corner_pier_58 = new THREE.Group();
  node_corner_pier_58.name = "Brick corner pier__pivot";
  node_corner_pier_58.scale.set(1, 1, 1);
  if (endpoint_corner_pier_58) {
    node_corner_pier_58.position.copy(endpoint_corner_pier_58.start);
    node_corner_pier_58.rotation.set(0, 0, 0);
  } else {
    node_corner_pier_58.position.set(4.175, 4, -4.175);
    node_corner_pier_58.rotation.set(0, 0, 0);
  }
  node_corner_pier_58.userData.sculptComponent = { "id": "corner-pier", "name": "Brick corner pier", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.65, "height": 8, "depth": 1.65, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [4.175, 4, -4.175], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "corner", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-pier" } }, "material": "brick-pier", "materialLayers": ["brick-pier"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["tall narrow brick pier at the platform's north-east corner", "its outer vertical edge is the plate's right silhouette limit"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["pier-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(34, 24, 42, 1.0)", "secondaryAlbedo": "rgba(106, 64, 72, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["pier-zone"], "samplingNotes": "plate-observed dominant #22182a; reproduction albedo #6a4048; source: #251420 pier lit face" } };
  node_corner_pier_58.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "corner", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "brick-pier" } };
  (nodes["root"] ?? root).add(node_corner_pier_58);
  nodes["corner-pier"] = node_corner_pier_58;
  const mesh_corner_pier_58Geometry = endpoint_corner_pier_58 ? new THREE.CylinderGeometry(endpoint_corner_pier_58.endRadius, endpoint_corner_pier_58.baseRadius, endpoint_corner_pier_58.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_corner_pier_58) {
    mesh_corner_pier_58Geometry.scale(1.65, 8, 1.65);
  }
  const mesh_corner_pier_58 = new THREE.Mesh(
    mesh_corner_pier_58Geometry,
    materialMap["brick-pier"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_corner_pier_58.name = "Brick corner pier";
  if (endpoint_corner_pier_58) {
    mesh_corner_pier_58.position.copy(endpoint_corner_pier_58.midpoint);
    mesh_corner_pier_58.quaternion.copy(endpoint_corner_pier_58.quaternion);
  }
  mesh_corner_pier_58.castShadow = options.castShadow ?? true;
  mesh_corner_pier_58.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_pier_58.userData.sculptComponent = node_corner_pier_58.userData.sculptComponent;
  node_corner_pier_58.add(mesh_corner_pier_58);
  meshes["corner-pier"] = mesh_corner_pier_58;
  colliders["corner-pier"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["corner"] ?? (destructionGroups["corner"] = []);
  destructionGroups["corner"].push(node_corner_pier_58);
  const attachment_pier_cap_59 = null;
  const endpoint_pier_cap_59 = makeAttachmentEndpoint(attachment_pier_cap_59);
  const node_pier_cap_59 = new THREE.Group();
  node_pier_cap_59.name = "Pier cap slab__pivot";
  node_pier_cap_59.scale.set(1, 1, 1);
  if (endpoint_pier_cap_59) {
    node_pier_cap_59.position.copy(endpoint_pier_cap_59.start);
    node_pier_cap_59.rotation.set(0, 0, 0);
  } else {
    node_pier_cap_59.position.set(4.175, 8.15, -4.175);
    node_pier_cap_59.rotation.set(0, 0, 0);
  }
  node_pier_cap_59.userData.sculptComponent = { "id": "pier-cap", "name": "Pier cap slab", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.9, "height": 0.3, "depth": 1.9, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [4.175, 8.15, -4.175], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pier", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "roof-slab" } }, "material": "roof-slab", "materialLayers": ["roof-slab"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["navy sky-lit cap slab overhanging the shaft"], "surfaceDetail": { "macroRoughness": 0.78, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["pier-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(24, 44, 97, 1.0)", "secondaryAlbedo": "rgba(43, 53, 86, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["pier-zone"], "samplingNotes": "plate-observed dominant #182c61; reproduction albedo #2b3556; source: #182c61 roof top face / #162c61 pier cap" } };
  node_pier_cap_59.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pier", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "roof-slab" } };
  (nodes["root"] ?? root).add(node_pier_cap_59);
  nodes["pier-cap"] = node_pier_cap_59;
  const mesh_pier_cap_59Geometry = endpoint_pier_cap_59 ? new THREE.CylinderGeometry(endpoint_pier_cap_59.endRadius, endpoint_pier_cap_59.baseRadius, endpoint_pier_cap_59.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_pier_cap_59) {
    mesh_pier_cap_59Geometry.scale(1.9, 0.3, 1.9);
  }
  const mesh_pier_cap_59 = new THREE.Mesh(
    mesh_pier_cap_59Geometry,
    materialMap["roof-slab"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pier_cap_59.name = "Pier cap slab";
  if (endpoint_pier_cap_59) {
    mesh_pier_cap_59.position.copy(endpoint_pier_cap_59.midpoint);
    mesh_pier_cap_59.quaternion.copy(endpoint_pier_cap_59.quaternion);
  }
  mesh_pier_cap_59.castShadow = options.castShadow ?? true;
  mesh_pier_cap_59.receiveShadow = options.receiveShadow ?? true;
  mesh_pier_cap_59.userData.sculptComponent = node_pier_cap_59.userData.sculptComponent;
  node_pier_cap_59.add(mesh_pier_cap_59);
  meshes["pier-cap"] = mesh_pier_cap_59;
  colliders["pier-cap"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["pier"] ?? (destructionGroups["pier"] = []);
  destructionGroups["pier"].push(node_pier_cap_59);
  const attachment_pier_window_60 = null;
  const endpoint_pier_window_60 = makeAttachmentEndpoint(attachment_pier_window_60);
  const node_pier_window_60 = new THREE.Group();
  node_pier_window_60.name = "Lit window in the pier__pivot";
  node_pier_window_60.scale.set(1, 1, 1);
  if (endpoint_pier_window_60) {
    node_pier_window_60.position.copy(endpoint_pier_window_60.start);
    node_pier_window_60.rotation.set(0, 0, 0);
  } else {
    node_pier_window_60.position.set(5.03, 2.44, -3.9);
    node_pier_window_60.rotation.set(0, 0, 0);
  }
  node_pier_window_60.userData.sculptComponent = { "id": "pier-window", "name": "Lit window in the pier", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.1, "height": 1, "depth": 0.52, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.65 }, "transform": { "position": [5.03, 2.44, -3.9], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pier", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } }, "material": "window-glow", "materialLayers": ["window-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["small amber strip low on the pier's street face"], "surfaceDetail": { "macroRoughness": 0.35, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["pier-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(217, 168, 110, 1.0)", "secondaryAlbedo": "rgba(74, 49, 22, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["pier-zone"], "samplingNotes": "plate-observed dominant #d9a86e; reproduction albedo #4a3116; source: #fad081 glass core" } };
  node_pier_window_60.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "pier", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "window-glow" } };
  (nodes["root"] ?? root).add(node_pier_window_60);
  nodes["pier-window"] = node_pier_window_60;
  const mesh_pier_window_60Geometry = endpoint_pier_window_60 ? new THREE.CylinderGeometry(endpoint_pier_window_60.endRadius, endpoint_pier_window_60.baseRadius, endpoint_pier_window_60.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_pier_window_60) {
    mesh_pier_window_60Geometry.scale(0.1, 1, 0.52);
  }
  const mesh_pier_window_60 = new THREE.Mesh(
    mesh_pier_window_60Geometry,
    materialMap["window-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_pier_window_60.name = "Lit window in the pier";
  if (endpoint_pier_window_60) {
    mesh_pier_window_60.position.copy(endpoint_pier_window_60.midpoint);
    mesh_pier_window_60.quaternion.copy(endpoint_pier_window_60.quaternion);
  }
  mesh_pier_window_60.castShadow = options.castShadow ?? true;
  mesh_pier_window_60.receiveShadow = options.receiveShadow ?? true;
  mesh_pier_window_60.userData.sculptComponent = node_pier_window_60.userData.sculptComponent;
  node_pier_window_60.add(mesh_pier_window_60);
  meshes["pier-window"] = mesh_pier_window_60;
  colliders["pier-window"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["pier"] ?? (destructionGroups["pier"] = []);
  destructionGroups["pier"].push(node_pier_window_60);
  const attachment_lamp_a_base_61 = null;
  const endpoint_lamp_a_base_61 = makeAttachmentEndpoint(attachment_lamp_a_base_61);
  const node_lamp_a_base_61 = new THREE.Group();
  node_lamp_a_base_61.name = "lamp-a fluted base__pivot";
  node_lamp_a_base_61.scale.set(1, 1, 1);
  if (endpoint_lamp_a_base_61) {
    node_lamp_a_base_61.position.copy(endpoint_lamp_a_base_61.start);
    node_lamp_a_base_61.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_base_61.position.set(-2.04, 0.16, 4.05);
    node_lamp_a_base_61.rotation.set(0, 0, 0);
  }
  node_lamp_a_base_61.userData.sculptComponent = { "id": "lamp-a-base", "name": "lamp-a fluted base", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "a turned revolve: the base moulding is one continuous lathed surface in the plate", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[0.24, 0], [0.24, 0.16], [0.16, 0.24], [0.15, 0.48], [0.12, 0.56]], "segments": 8 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-2.04, 0.16, 4.05], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stepped octagonal base moulding stack"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_a_base_61.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_a_base_61);
  nodes["lamp-a-base"] = node_lamp_a_base_61;
  const mesh_lamp_a_base_61Geometry = endpoint_lamp_a_base_61 ? new THREE.CylinderGeometry(endpoint_lamp_a_base_61.endRadius, endpoint_lamp_a_base_61.baseRadius, endpoint_lamp_a_base_61.length, 8, 4) : buildLatheGeometry({ "points": [[0.24, 0], [0.24, 0.16], [0.16, 0.24], [0.15, 0.48], [0.12, 0.56]], "segments": 8 });
  if (!endpoint_lamp_a_base_61) {
    mesh_lamp_a_base_61Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_a_base_61 = new THREE.Mesh(
    mesh_lamp_a_base_61Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_base_61.name = "lamp-a fluted base";
  if (endpoint_lamp_a_base_61) {
    mesh_lamp_a_base_61.position.copy(endpoint_lamp_a_base_61.midpoint);
    mesh_lamp_a_base_61.quaternion.copy(endpoint_lamp_a_base_61.quaternion);
  }
  mesh_lamp_a_base_61.castShadow = options.castShadow ?? true;
  mesh_lamp_a_base_61.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_base_61.userData.sculptComponent = node_lamp_a_base_61.userData.sculptComponent;
  node_lamp_a_base_61.add(mesh_lamp_a_base_61);
  meshes["lamp-a-base"] = mesh_lamp_a_base_61;
  colliders["lamp-a-base"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_base_61);
  const attachment_lamp_a_post_62 = { "parentId": "root", "parentSocket": "root:lamp-a-post-mount", "localStart": [-2.04, 0.5, 4.05], "localEnd": [-2.04, 4.58, 4.05], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.115, "endRadius": 0.075, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] };
  const endpoint_lamp_a_post_62 = makeAttachmentEndpoint(attachment_lamp_a_post_62);
  const node_lamp_a_post_62 = new THREE.Group();
  node_lamp_a_post_62.name = "lamp-a tapered post__pivot";
  node_lamp_a_post_62.scale.set(1, 1, 1);
  if (endpoint_lamp_a_post_62) {
    node_lamp_a_post_62.position.copy(endpoint_lamp_a_post_62.start);
    node_lamp_a_post_62.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_post_62.position.set(0, 0, 0);
    node_lamp_a_post_62.rotation.set(0, 0, 0);
  }
  node_lamp_a_post_62.userData.sculptComponent = { "id": "lamp-a-post", "name": "lamp-a tapered post", "level": "macro", "role": "strut", "importance": 0.85, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:lamp-a-post-mount", "localStart": [-2.04, 0.5, 4.05], "localEnd": [-2.04, 4.58, 4.05], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.115, "endRadius": 0.075, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["tall tapered cast-iron post, the plate's strongest vertical accent"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_a_post_62.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_a_post_62);
  nodes["lamp-a-post"] = node_lamp_a_post_62;
  const mesh_lamp_a_post_62Geometry = endpoint_lamp_a_post_62 ? new THREE.CylinderGeometry(endpoint_lamp_a_post_62.endRadius, endpoint_lamp_a_post_62.baseRadius, endpoint_lamp_a_post_62.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_lamp_a_post_62) {
    mesh_lamp_a_post_62Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_a_post_62 = new THREE.Mesh(
    mesh_lamp_a_post_62Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_post_62.name = "lamp-a tapered post";
  if (endpoint_lamp_a_post_62) {
    mesh_lamp_a_post_62.position.copy(endpoint_lamp_a_post_62.midpoint);
    mesh_lamp_a_post_62.quaternion.copy(endpoint_lamp_a_post_62.quaternion);
  }
  mesh_lamp_a_post_62.castShadow = options.castShadow ?? true;
  mesh_lamp_a_post_62.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_post_62.userData.sculptComponent = node_lamp_a_post_62.userData.sculptComponent;
  node_lamp_a_post_62.add(mesh_lamp_a_post_62);
  meshes["lamp-a-post"] = mesh_lamp_a_post_62;
  colliders["lamp-a-post"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_post_62);
  const attachment_lamp_a_collar_63 = null;
  const endpoint_lamp_a_collar_63 = makeAttachmentEndpoint(attachment_lamp_a_collar_63);
  const node_lamp_a_collar_63 = new THREE.Group();
  node_lamp_a_collar_63.name = "lamp-a lantern collar__pivot";
  node_lamp_a_collar_63.scale.set(1, 1, 1);
  if (endpoint_lamp_a_collar_63) {
    node_lamp_a_collar_63.position.copy(endpoint_lamp_a_collar_63.start);
    node_lamp_a_collar_63.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_collar_63.position.set(-2.04, 4.5, 4.05);
    node_lamp_a_collar_63.rotation.set(0, 0, 0);
  }
  node_lamp_a_collar_63.userData.sculptComponent = { "id": "lamp-a-collar", "name": "lamp-a lantern collar", "level": "micro", "role": "body", "importance": 0.45, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "turned revolve joining post to lantern; one continuous lathed surface", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[0.09, 0], [0.17, 0.06], [0.17, 0.14], [0.1, 0.2]], "segments": 8 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-2.04, 4.5, 4.05], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_a_collar_63.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_a_collar_63);
  nodes["lamp-a-collar"] = node_lamp_a_collar_63;
  const mesh_lamp_a_collar_63Geometry = endpoint_lamp_a_collar_63 ? new THREE.CylinderGeometry(endpoint_lamp_a_collar_63.endRadius, endpoint_lamp_a_collar_63.baseRadius, endpoint_lamp_a_collar_63.length, 8, 4) : buildLatheGeometry({ "points": [[0.09, 0], [0.17, 0.06], [0.17, 0.14], [0.1, 0.2]], "segments": 8 });
  if (!endpoint_lamp_a_collar_63) {
    mesh_lamp_a_collar_63Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_a_collar_63 = new THREE.Mesh(
    mesh_lamp_a_collar_63Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_collar_63.name = "lamp-a lantern collar";
  if (endpoint_lamp_a_collar_63) {
    mesh_lamp_a_collar_63.position.copy(endpoint_lamp_a_collar_63.midpoint);
    mesh_lamp_a_collar_63.quaternion.copy(endpoint_lamp_a_collar_63.quaternion);
  }
  mesh_lamp_a_collar_63.castShadow = options.castShadow ?? true;
  mesh_lamp_a_collar_63.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_collar_63.userData.sculptComponent = node_lamp_a_collar_63.userData.sculptComponent;
  node_lamp_a_collar_63.add(mesh_lamp_a_collar_63);
  meshes["lamp-a-collar"] = mesh_lamp_a_collar_63;
  colliders["lamp-a-collar"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_collar_63);
  const attachment_lamp_a_lantern_64 = { "parentId": "root", "parentSocket": "root:lamp-a-lantern-mount", "localStart": [-2.04, 4.66, 4.05], "localEnd": [-2.04, 5.36, 4.05], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.24, "endRadius": 0.15, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] };
  const endpoint_lamp_a_lantern_64 = makeAttachmentEndpoint(attachment_lamp_a_lantern_64);
  const node_lamp_a_lantern_64 = new THREE.Group();
  node_lamp_a_lantern_64.name = "lamp-a lantern glass__pivot";
  node_lamp_a_lantern_64.scale.set(1, 1, 1);
  if (endpoint_lamp_a_lantern_64) {
    node_lamp_a_lantern_64.position.copy(endpoint_lamp_a_lantern_64.start);
    node_lamp_a_lantern_64.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_lantern_64.position.set(0, 0, 0);
    node_lamp_a_lantern_64.rotation.set(0, 0, 0);
  }
  node_lamp_a_lantern_64.userData.sculptComponent = { "id": "lamp-a-lantern", "name": "lamp-a lantern glass", "level": "meso", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:lamp-a-lantern-mount", "localStart": [-2.04, 4.66, 4.05], "localEnd": [-2.04, 5.36, 4.05], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.24, "endRadius": 0.15, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } }, "material": "lamp-glow", "materialLayers": ["lamp-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["four-sided tapered glass box, wider at the bottom", "hot near-white core with a warm falloff"], "surfaceDetail": { "macroRoughness": 0.3, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(183, 166, 101, 1.0)", "secondaryAlbedo": "rgba(66, 48, 26, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #b7a665; reproduction albedo #42301a; source: #b7a665 lamp glass / #fbf387 cab lamp" } };
  node_lamp_a_lantern_64.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } };
  (nodes["root"] ?? root).add(node_lamp_a_lantern_64);
  nodes["lamp-a-lantern"] = node_lamp_a_lantern_64;
  const mesh_lamp_a_lantern_64Geometry = endpoint_lamp_a_lantern_64 ? new THREE.CylinderGeometry(endpoint_lamp_a_lantern_64.endRadius, endpoint_lamp_a_lantern_64.baseRadius, endpoint_lamp_a_lantern_64.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_lamp_a_lantern_64) {
    mesh_lamp_a_lantern_64Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_a_lantern_64 = new THREE.Mesh(
    mesh_lamp_a_lantern_64Geometry,
    materialMap["lamp-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_lantern_64.name = "lamp-a lantern glass";
  if (endpoint_lamp_a_lantern_64) {
    mesh_lamp_a_lantern_64.position.copy(endpoint_lamp_a_lantern_64.midpoint);
    mesh_lamp_a_lantern_64.quaternion.copy(endpoint_lamp_a_lantern_64.quaternion);
  }
  mesh_lamp_a_lantern_64.castShadow = options.castShadow ?? true;
  mesh_lamp_a_lantern_64.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_lantern_64.userData.sculptComponent = node_lamp_a_lantern_64.userData.sculptComponent;
  node_lamp_a_lantern_64.add(mesh_lamp_a_lantern_64);
  meshes["lamp-a-lantern"] = mesh_lamp_a_lantern_64;
  colliders["lamp-a-lantern"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_lantern_64);
  const attachment_lamp_a_lantern_cap_65 = null;
  const endpoint_lamp_a_lantern_cap_65 = makeAttachmentEndpoint(attachment_lamp_a_lantern_cap_65);
  const node_lamp_a_lantern_cap_65 = new THREE.Group();
  node_lamp_a_lantern_cap_65.name = "lamp-a lantern cap__pivot";
  node_lamp_a_lantern_cap_65.scale.set(1, 1, 1);
  if (endpoint_lamp_a_lantern_cap_65) {
    node_lamp_a_lantern_cap_65.position.copy(endpoint_lamp_a_lantern_cap_65.start);
    node_lamp_a_lantern_cap_65.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_lantern_cap_65.position.set(-2.04, 5.44, 4.05);
    node_lamp_a_lantern_cap_65.rotation.set(0, 0, 0);
  }
  node_lamp_a_lantern_cap_65.userData.sculptComponent = { "id": "lamp-a-lantern-cap", "name": "lamp-a lantern cap", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "turned/pressed cap revolve over the glass; continuous surface, not an assembly", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[0.22, 0], [0.24, 0.05], [0.13, 0.2], [0.05, 0.34], [0.02, 0.4]], "segments": 8 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-2.04, 5.44, 4.05], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stepped pointed cap with a small finial"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_a_lantern_cap_65.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_a_lantern_cap_65);
  nodes["lamp-a-lantern-cap"] = node_lamp_a_lantern_cap_65;
  const mesh_lamp_a_lantern_cap_65Geometry = endpoint_lamp_a_lantern_cap_65 ? new THREE.CylinderGeometry(endpoint_lamp_a_lantern_cap_65.endRadius, endpoint_lamp_a_lantern_cap_65.baseRadius, endpoint_lamp_a_lantern_cap_65.length, 8, 4) : buildLatheGeometry({ "points": [[0.22, 0], [0.24, 0.05], [0.13, 0.2], [0.05, 0.34], [0.02, 0.4]], "segments": 8 });
  if (!endpoint_lamp_a_lantern_cap_65) {
    mesh_lamp_a_lantern_cap_65Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_a_lantern_cap_65 = new THREE.Mesh(
    mesh_lamp_a_lantern_cap_65Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_lantern_cap_65.name = "lamp-a lantern cap";
  if (endpoint_lamp_a_lantern_cap_65) {
    mesh_lamp_a_lantern_cap_65.position.copy(endpoint_lamp_a_lantern_cap_65.midpoint);
    mesh_lamp_a_lantern_cap_65.quaternion.copy(endpoint_lamp_a_lantern_cap_65.quaternion);
  }
  mesh_lamp_a_lantern_cap_65.castShadow = options.castShadow ?? true;
  mesh_lamp_a_lantern_cap_65.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_lantern_cap_65.userData.sculptComponent = node_lamp_a_lantern_cap_65.userData.sculptComponent;
  node_lamp_a_lantern_cap_65.add(mesh_lamp_a_lantern_cap_65);
  meshes["lamp-a-lantern-cap"] = mesh_lamp_a_lantern_cap_65;
  colliders["lamp-a-lantern-cap"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_lantern_cap_65);
  const attachment_lamp_a_finial_66 = null;
  const endpoint_lamp_a_finial_66 = makeAttachmentEndpoint(attachment_lamp_a_finial_66);
  const node_lamp_a_finial_66 = new THREE.Group();
  node_lamp_a_finial_66.name = "lamp-a finial__pivot";
  node_lamp_a_finial_66.scale.set(1, 1, 1);
  if (endpoint_lamp_a_finial_66) {
    node_lamp_a_finial_66.position.copy(endpoint_lamp_a_finial_66.start);
    node_lamp_a_finial_66.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_finial_66.position.set(-2.04, 5.9, 4.05);
    node_lamp_a_finial_66.rotation.set(0, 0, 0);
  }
  node_lamp_a_finial_66.userData.sculptComponent = { "id": "lamp-a-finial", "name": "lamp-a finial", "level": "micro", "role": "body", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.07, "height": 0.14, "depth": 0.07, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [-2.04, 5.9, 4.05], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_a_finial_66.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_a_finial_66);
  nodes["lamp-a-finial"] = node_lamp_a_finial_66;
  const mesh_lamp_a_finial_66Geometry = endpoint_lamp_a_finial_66 ? new THREE.CylinderGeometry(endpoint_lamp_a_finial_66.endRadius, endpoint_lamp_a_finial_66.baseRadius, endpoint_lamp_a_finial_66.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lamp_a_finial_66) {
    mesh_lamp_a_finial_66Geometry.scale(0.07, 0.14, 0.07);
  }
  const mesh_lamp_a_finial_66 = new THREE.Mesh(
    mesh_lamp_a_finial_66Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_finial_66.name = "lamp-a finial";
  if (endpoint_lamp_a_finial_66) {
    mesh_lamp_a_finial_66.position.copy(endpoint_lamp_a_finial_66.midpoint);
    mesh_lamp_a_finial_66.quaternion.copy(endpoint_lamp_a_finial_66.quaternion);
  }
  mesh_lamp_a_finial_66.castShadow = options.castShadow ?? true;
  mesh_lamp_a_finial_66.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_finial_66.userData.sculptComponent = node_lamp_a_finial_66.userData.sculptComponent;
  node_lamp_a_finial_66.add(mesh_lamp_a_finial_66);
  meshes["lamp-a-finial"] = mesh_lamp_a_finial_66;
  colliders["lamp-a-finial"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_finial_66);
  const attachment_lamp_a_halo_67 = null;
  const endpoint_lamp_a_halo_67 = makeAttachmentEndpoint(attachment_lamp_a_halo_67);
  const node_lamp_a_halo_67 = new THREE.Group();
  node_lamp_a_halo_67.name = "lamp-a halo card__pivot";
  node_lamp_a_halo_67.scale.set(1, 1, 1);
  if (endpoint_lamp_a_halo_67) {
    node_lamp_a_halo_67.position.copy(endpoint_lamp_a_halo_67.start);
    node_lamp_a_halo_67.rotation.set(0, 0, 0);
  } else {
    node_lamp_a_halo_67.position.set(-2.04, 5.02, 4.05);
    node_lamp_a_halo_67.rotation.set(0, 0, 0);
  }
  node_lamp_a_halo_67.userData.sculptComponent = { "id": "lamp-a-halo", "name": "lamp-a halo card", "level": "meso", "role": "effect", "importance": 0.9, "confidence": 0.7, "primitive": "plane-card", "topologyClass": "conforming-shell", "topologyRationale": "a camera-facing card standing in for volumetric scatter; it is a shell around the flame, not a solid", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "billboard": "camera-facing", "blending": "additive", "note": "postgen swaps the plane material to additive blending and drives it from tick" }, "parent": "root", "attachment": null, "dimensions": { "width": 3.4, "height": 3.4, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-2.04, 5.02, 4.05], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "glow-card" } }, "material": "glow-card", "materialLayers": ["glow-card"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["soft radial halo, ~1.3 unit radius, warm amber falling to zero", "reads over both the facade and the night sky in the plate"], "surfaceDetail": { "macroRoughness": 1, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(187, 139, 86, 1.0)", "secondaryAlbedo": "rgba(0, 0, 0, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #bb8b56; reproduction albedo #000000; source: derived from adjacent sampled facets" } };
  node_lamp_a_halo_67.userData.actionProfile = { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "glow-card" } };
  (nodes["root"] ?? root).add(node_lamp_a_halo_67);
  nodes["lamp-a-halo"] = node_lamp_a_halo_67;
  const mesh_lamp_a_halo_67Geometry = endpoint_lamp_a_halo_67 ? new THREE.CylinderGeometry(endpoint_lamp_a_halo_67.endRadius, endpoint_lamp_a_halo_67.baseRadius, endpoint_lamp_a_halo_67.length, 8, 4) : new THREE.PlaneGeometry(1, 1, 4, 4);
  if (!endpoint_lamp_a_halo_67) {
    mesh_lamp_a_halo_67Geometry.scale(3.4, 3.4, 1);
  }
  const mesh_lamp_a_halo_67 = new THREE.Mesh(
    mesh_lamp_a_halo_67Geometry,
    materialMap["glow-card"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_a_halo_67.name = "lamp-a halo card";
  if (endpoint_lamp_a_halo_67) {
    mesh_lamp_a_halo_67.position.copy(endpoint_lamp_a_halo_67.midpoint);
    mesh_lamp_a_halo_67.quaternion.copy(endpoint_lamp_a_halo_67.quaternion);
  }
  mesh_lamp_a_halo_67.castShadow = options.castShadow ?? true;
  mesh_lamp_a_halo_67.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_a_halo_67.userData.sculptComponent = node_lamp_a_halo_67.userData.sculptComponent;
  node_lamp_a_halo_67.add(mesh_lamp_a_halo_67);
  meshes["lamp-a-halo"] = mesh_lamp_a_halo_67;
  colliders["lamp-a-halo"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_a_halo_67);
  const attachment_lamp_b_base_68 = null;
  const endpoint_lamp_b_base_68 = makeAttachmentEndpoint(attachment_lamp_b_base_68);
  const node_lamp_b_base_68 = new THREE.Group();
  node_lamp_b_base_68.name = "lamp-b fluted base__pivot";
  node_lamp_b_base_68.scale.set(1, 1, 1);
  if (endpoint_lamp_b_base_68) {
    node_lamp_b_base_68.position.copy(endpoint_lamp_b_base_68.start);
    node_lamp_b_base_68.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_base_68.position.set(-1.84, 0.16, -3.97);
    node_lamp_b_base_68.rotation.set(0, 0, 0);
  }
  node_lamp_b_base_68.userData.sculptComponent = { "id": "lamp-b-base", "name": "lamp-b fluted base", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "a turned revolve: the base moulding is one continuous lathed surface in the plate", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[0.24, 0], [0.24, 0.16], [0.16, 0.24], [0.15, 0.48], [0.12, 0.56]], "segments": 8 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [-1.84, 0.16, -3.97], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stepped octagonal base moulding stack"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_b_base_68.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_b_base_68);
  nodes["lamp-b-base"] = node_lamp_b_base_68;
  const mesh_lamp_b_base_68Geometry = endpoint_lamp_b_base_68 ? new THREE.CylinderGeometry(endpoint_lamp_b_base_68.endRadius, endpoint_lamp_b_base_68.baseRadius, endpoint_lamp_b_base_68.length, 8, 4) : buildLatheGeometry({ "points": [[0.24, 0], [0.24, 0.16], [0.16, 0.24], [0.15, 0.48], [0.12, 0.56]], "segments": 8 });
  if (!endpoint_lamp_b_base_68) {
    mesh_lamp_b_base_68Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_b_base_68 = new THREE.Mesh(
    mesh_lamp_b_base_68Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_base_68.name = "lamp-b fluted base";
  if (endpoint_lamp_b_base_68) {
    mesh_lamp_b_base_68.position.copy(endpoint_lamp_b_base_68.midpoint);
    mesh_lamp_b_base_68.quaternion.copy(endpoint_lamp_b_base_68.quaternion);
  }
  mesh_lamp_b_base_68.castShadow = options.castShadow ?? true;
  mesh_lamp_b_base_68.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_base_68.userData.sculptComponent = node_lamp_b_base_68.userData.sculptComponent;
  node_lamp_b_base_68.add(mesh_lamp_b_base_68);
  meshes["lamp-b-base"] = mesh_lamp_b_base_68;
  colliders["lamp-b-base"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_base_68);
  const attachment_lamp_b_post_69 = { "parentId": "root", "parentSocket": "root:lamp-b-post-mount", "localStart": [-1.84, 0.5, -3.97], "localEnd": [-1.84, 4.58, -3.97], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.115, "endRadius": 0.075, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] };
  const endpoint_lamp_b_post_69 = makeAttachmentEndpoint(attachment_lamp_b_post_69);
  const node_lamp_b_post_69 = new THREE.Group();
  node_lamp_b_post_69.name = "lamp-b tapered post__pivot";
  node_lamp_b_post_69.scale.set(1, 1, 1);
  if (endpoint_lamp_b_post_69) {
    node_lamp_b_post_69.position.copy(endpoint_lamp_b_post_69.start);
    node_lamp_b_post_69.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_post_69.position.set(0, 0, 0);
    node_lamp_b_post_69.rotation.set(0, 0, 0);
  }
  node_lamp_b_post_69.userData.sculptComponent = { "id": "lamp-b-post", "name": "lamp-b tapered post", "level": "macro", "role": "strut", "importance": 0.85, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:lamp-b-post-mount", "localStart": [-1.84, 0.5, -3.97], "localEnd": [-1.84, 4.58, -3.97], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.115, "endRadius": 0.075, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["tall tapered cast-iron post, the plate's strongest vertical accent"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_b_post_69.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_b_post_69);
  nodes["lamp-b-post"] = node_lamp_b_post_69;
  const mesh_lamp_b_post_69Geometry = endpoint_lamp_b_post_69 ? new THREE.CylinderGeometry(endpoint_lamp_b_post_69.endRadius, endpoint_lamp_b_post_69.baseRadius, endpoint_lamp_b_post_69.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_lamp_b_post_69) {
    mesh_lamp_b_post_69Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_b_post_69 = new THREE.Mesh(
    mesh_lamp_b_post_69Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_post_69.name = "lamp-b tapered post";
  if (endpoint_lamp_b_post_69) {
    mesh_lamp_b_post_69.position.copy(endpoint_lamp_b_post_69.midpoint);
    mesh_lamp_b_post_69.quaternion.copy(endpoint_lamp_b_post_69.quaternion);
  }
  mesh_lamp_b_post_69.castShadow = options.castShadow ?? true;
  mesh_lamp_b_post_69.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_post_69.userData.sculptComponent = node_lamp_b_post_69.userData.sculptComponent;
  node_lamp_b_post_69.add(mesh_lamp_b_post_69);
  meshes["lamp-b-post"] = mesh_lamp_b_post_69;
  colliders["lamp-b-post"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_post_69);
  const attachment_lamp_b_collar_70 = null;
  const endpoint_lamp_b_collar_70 = makeAttachmentEndpoint(attachment_lamp_b_collar_70);
  const node_lamp_b_collar_70 = new THREE.Group();
  node_lamp_b_collar_70.name = "lamp-b lantern collar__pivot";
  node_lamp_b_collar_70.scale.set(1, 1, 1);
  if (endpoint_lamp_b_collar_70) {
    node_lamp_b_collar_70.position.copy(endpoint_lamp_b_collar_70.start);
    node_lamp_b_collar_70.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_collar_70.position.set(-1.84, 4.5, -3.97);
    node_lamp_b_collar_70.rotation.set(0, 0, 0);
  }
  node_lamp_b_collar_70.userData.sculptComponent = { "id": "lamp-b-collar", "name": "lamp-b lantern collar", "level": "micro", "role": "body", "importance": 0.45, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "turned revolve joining post to lantern; one continuous lathed surface", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[0.09, 0], [0.17, 0.06], [0.17, 0.14], [0.1, 0.2]], "segments": 8 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-1.84, 4.5, -3.97], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_b_collar_70.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_b_collar_70);
  nodes["lamp-b-collar"] = node_lamp_b_collar_70;
  const mesh_lamp_b_collar_70Geometry = endpoint_lamp_b_collar_70 ? new THREE.CylinderGeometry(endpoint_lamp_b_collar_70.endRadius, endpoint_lamp_b_collar_70.baseRadius, endpoint_lamp_b_collar_70.length, 8, 4) : buildLatheGeometry({ "points": [[0.09, 0], [0.17, 0.06], [0.17, 0.14], [0.1, 0.2]], "segments": 8 });
  if (!endpoint_lamp_b_collar_70) {
    mesh_lamp_b_collar_70Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_b_collar_70 = new THREE.Mesh(
    mesh_lamp_b_collar_70Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_collar_70.name = "lamp-b lantern collar";
  if (endpoint_lamp_b_collar_70) {
    mesh_lamp_b_collar_70.position.copy(endpoint_lamp_b_collar_70.midpoint);
    mesh_lamp_b_collar_70.quaternion.copy(endpoint_lamp_b_collar_70.quaternion);
  }
  mesh_lamp_b_collar_70.castShadow = options.castShadow ?? true;
  mesh_lamp_b_collar_70.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_collar_70.userData.sculptComponent = node_lamp_b_collar_70.userData.sculptComponent;
  node_lamp_b_collar_70.add(mesh_lamp_b_collar_70);
  meshes["lamp-b-collar"] = mesh_lamp_b_collar_70;
  colliders["lamp-b-collar"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_collar_70);
  const attachment_lamp_b_lantern_71 = { "parentId": "root", "parentSocket": "root:lamp-b-lantern-mount", "localStart": [-1.84, 4.66, -3.97], "localEnd": [-1.84, 5.36, -3.97], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.24, "endRadius": 0.15, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] };
  const endpoint_lamp_b_lantern_71 = makeAttachmentEndpoint(attachment_lamp_b_lantern_71);
  const node_lamp_b_lantern_71 = new THREE.Group();
  node_lamp_b_lantern_71.name = "lamp-b lantern glass__pivot";
  node_lamp_b_lantern_71.scale.set(1, 1, 1);
  if (endpoint_lamp_b_lantern_71) {
    node_lamp_b_lantern_71.position.copy(endpoint_lamp_b_lantern_71.start);
    node_lamp_b_lantern_71.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_lantern_71.position.set(0, 0, 0);
    node_lamp_b_lantern_71.rotation.set(0, 0, 0);
  }
  node_lamp_b_lantern_71.userData.sculptComponent = { "id": "lamp-b-lantern", "name": "lamp-b lantern glass", "level": "meso", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:lamp-b-lantern-mount", "localStart": [-1.84, 4.66, -3.97], "localEnd": [-1.84, 5.36, -3.97], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.24, "endRadius": 0.15, "contactNormal": [0, 1, 0], "evidenceRefs": ["lamp-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } }, "material": "lamp-glow", "materialLayers": ["lamp-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["four-sided tapered glass box, wider at the bottom", "hot near-white core with a warm falloff"], "surfaceDetail": { "macroRoughness": 0.3, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(183, 166, 101, 1.0)", "secondaryAlbedo": "rgba(66, 48, 26, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #b7a665; reproduction albedo #42301a; source: #b7a665 lamp glass / #fbf387 cab lamp" } };
  node_lamp_b_lantern_71.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } };
  (nodes["root"] ?? root).add(node_lamp_b_lantern_71);
  nodes["lamp-b-lantern"] = node_lamp_b_lantern_71;
  const mesh_lamp_b_lantern_71Geometry = endpoint_lamp_b_lantern_71 ? new THREE.CylinderGeometry(endpoint_lamp_b_lantern_71.endRadius, endpoint_lamp_b_lantern_71.baseRadius, endpoint_lamp_b_lantern_71.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_lamp_b_lantern_71) {
    mesh_lamp_b_lantern_71Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_b_lantern_71 = new THREE.Mesh(
    mesh_lamp_b_lantern_71Geometry,
    materialMap["lamp-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_lantern_71.name = "lamp-b lantern glass";
  if (endpoint_lamp_b_lantern_71) {
    mesh_lamp_b_lantern_71.position.copy(endpoint_lamp_b_lantern_71.midpoint);
    mesh_lamp_b_lantern_71.quaternion.copy(endpoint_lamp_b_lantern_71.quaternion);
  }
  mesh_lamp_b_lantern_71.castShadow = options.castShadow ?? true;
  mesh_lamp_b_lantern_71.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_lantern_71.userData.sculptComponent = node_lamp_b_lantern_71.userData.sculptComponent;
  node_lamp_b_lantern_71.add(mesh_lamp_b_lantern_71);
  meshes["lamp-b-lantern"] = mesh_lamp_b_lantern_71;
  colliders["lamp-b-lantern"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_lantern_71);
  const attachment_lamp_b_lantern_cap_72 = null;
  const endpoint_lamp_b_lantern_cap_72 = makeAttachmentEndpoint(attachment_lamp_b_lantern_cap_72);
  const node_lamp_b_lantern_cap_72 = new THREE.Group();
  node_lamp_b_lantern_cap_72.name = "lamp-b lantern cap__pivot";
  node_lamp_b_lantern_cap_72.scale.set(1, 1, 1);
  if (endpoint_lamp_b_lantern_cap_72) {
    node_lamp_b_lantern_cap_72.position.copy(endpoint_lamp_b_lantern_cap_72.start);
    node_lamp_b_lantern_cap_72.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_lantern_cap_72.position.set(-1.84, 5.44, -3.97);
    node_lamp_b_lantern_cap_72.rotation.set(0, 0, 0);
  }
  node_lamp_b_lantern_cap_72.userData.sculptComponent = { "id": "lamp-b-lantern-cap", "name": "lamp-b lantern cap", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "turned/pressed cap revolve over the glass; continuous surface, not an assembly", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "latheProfile": { "points": [[0.22, 0], [0.24, 0.05], [0.13, 0.2], [0.05, 0.34], [0.02, 0.4]], "segments": 8 } }, "parent": "root", "attachment": null, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-1.84, 5.44, -3.97], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["stepped pointed cap with a small finial"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_b_lantern_cap_72.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_b_lantern_cap_72);
  nodes["lamp-b-lantern-cap"] = node_lamp_b_lantern_cap_72;
  const mesh_lamp_b_lantern_cap_72Geometry = endpoint_lamp_b_lantern_cap_72 ? new THREE.CylinderGeometry(endpoint_lamp_b_lantern_cap_72.endRadius, endpoint_lamp_b_lantern_cap_72.baseRadius, endpoint_lamp_b_lantern_cap_72.length, 8, 4) : buildLatheGeometry({ "points": [[0.22, 0], [0.24, 0.05], [0.13, 0.2], [0.05, 0.34], [0.02, 0.4]], "segments": 8 });
  if (!endpoint_lamp_b_lantern_cap_72) {
    mesh_lamp_b_lantern_cap_72Geometry.scale(1, 1, 1);
  }
  const mesh_lamp_b_lantern_cap_72 = new THREE.Mesh(
    mesh_lamp_b_lantern_cap_72Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_lantern_cap_72.name = "lamp-b lantern cap";
  if (endpoint_lamp_b_lantern_cap_72) {
    mesh_lamp_b_lantern_cap_72.position.copy(endpoint_lamp_b_lantern_cap_72.midpoint);
    mesh_lamp_b_lantern_cap_72.quaternion.copy(endpoint_lamp_b_lantern_cap_72.quaternion);
  }
  mesh_lamp_b_lantern_cap_72.castShadow = options.castShadow ?? true;
  mesh_lamp_b_lantern_cap_72.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_lantern_cap_72.userData.sculptComponent = node_lamp_b_lantern_cap_72.userData.sculptComponent;
  node_lamp_b_lantern_cap_72.add(mesh_lamp_b_lantern_cap_72);
  meshes["lamp-b-lantern-cap"] = mesh_lamp_b_lantern_cap_72;
  colliders["lamp-b-lantern-cap"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_lantern_cap_72);
  const attachment_lamp_b_finial_73 = null;
  const endpoint_lamp_b_finial_73 = makeAttachmentEndpoint(attachment_lamp_b_finial_73);
  const node_lamp_b_finial_73 = new THREE.Group();
  node_lamp_b_finial_73.name = "lamp-b finial__pivot";
  node_lamp_b_finial_73.scale.set(1, 1, 1);
  if (endpoint_lamp_b_finial_73) {
    node_lamp_b_finial_73.position.copy(endpoint_lamp_b_finial_73.start);
    node_lamp_b_finial_73.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_finial_73.position.set(-1.84, 5.9, -3.97);
    node_lamp_b_finial_73.rotation.set(0, 0, 0);
  }
  node_lamp_b_finial_73.userData.sculptComponent = { "id": "lamp-b-finial", "name": "lamp-b finial", "level": "micro", "role": "body", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.07, "height": 0.14, "depth": 0.07, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [-1.84, 5.9, -3.97], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_lamp_b_finial_73.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_lamp_b_finial_73);
  nodes["lamp-b-finial"] = node_lamp_b_finial_73;
  const mesh_lamp_b_finial_73Geometry = endpoint_lamp_b_finial_73 ? new THREE.CylinderGeometry(endpoint_lamp_b_finial_73.endRadius, endpoint_lamp_b_finial_73.baseRadius, endpoint_lamp_b_finial_73.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lamp_b_finial_73) {
    mesh_lamp_b_finial_73Geometry.scale(0.07, 0.14, 0.07);
  }
  const mesh_lamp_b_finial_73 = new THREE.Mesh(
    mesh_lamp_b_finial_73Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_finial_73.name = "lamp-b finial";
  if (endpoint_lamp_b_finial_73) {
    mesh_lamp_b_finial_73.position.copy(endpoint_lamp_b_finial_73.midpoint);
    mesh_lamp_b_finial_73.quaternion.copy(endpoint_lamp_b_finial_73.quaternion);
  }
  mesh_lamp_b_finial_73.castShadow = options.castShadow ?? true;
  mesh_lamp_b_finial_73.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_finial_73.userData.sculptComponent = node_lamp_b_finial_73.userData.sculptComponent;
  node_lamp_b_finial_73.add(mesh_lamp_b_finial_73);
  meshes["lamp-b-finial"] = mesh_lamp_b_finial_73;
  colliders["lamp-b-finial"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_finial_73);
  const attachment_lamp_b_halo_74 = null;
  const endpoint_lamp_b_halo_74 = makeAttachmentEndpoint(attachment_lamp_b_halo_74);
  const node_lamp_b_halo_74 = new THREE.Group();
  node_lamp_b_halo_74.name = "lamp-b halo card__pivot";
  node_lamp_b_halo_74.scale.set(1, 1, 1);
  if (endpoint_lamp_b_halo_74) {
    node_lamp_b_halo_74.position.copy(endpoint_lamp_b_halo_74.start);
    node_lamp_b_halo_74.rotation.set(0, 0, 0);
  } else {
    node_lamp_b_halo_74.position.set(-1.84, 5.02, -3.97);
    node_lamp_b_halo_74.rotation.set(0, 0, 0);
  }
  node_lamp_b_halo_74.userData.sculptComponent = { "id": "lamp-b-halo", "name": "lamp-b halo card", "level": "meso", "role": "effect", "importance": 0.9, "confidence": 0.7, "primitive": "plane-card", "topologyClass": "conforming-shell", "topologyRationale": "a camera-facing card standing in for volumetric scatter; it is a shell around the flame, not a solid", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "billboard": "camera-facing", "blending": "additive", "note": "postgen swaps the plane material to additive blending and drives it from tick" }, "parent": "root", "attachment": null, "dimensions": { "width": 3.4, "height": 3.4, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [-1.84, 5.02, -3.97], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "glow-card" } }, "material": "glow-card", "materialLayers": ["glow-card"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["soft radial halo, ~1.3 unit radius, warm amber falling to zero", "reads over both the facade and the night sky in the plate"], "surfaceDetail": { "macroRoughness": 1, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["lamp-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(187, 139, 86, 1.0)", "secondaryAlbedo": "rgba(0, 0, 0, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["lamp-zone"], "samplingNotes": "plate-observed dominant #bb8b56; reproduction albedo #000000; source: derived from adjacent sampled facets" } };
  node_lamp_b_halo_74.userData.actionProfile = { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lamp", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "glow-card" } };
  (nodes["root"] ?? root).add(node_lamp_b_halo_74);
  nodes["lamp-b-halo"] = node_lamp_b_halo_74;
  const mesh_lamp_b_halo_74Geometry = endpoint_lamp_b_halo_74 ? new THREE.CylinderGeometry(endpoint_lamp_b_halo_74.endRadius, endpoint_lamp_b_halo_74.baseRadius, endpoint_lamp_b_halo_74.length, 8, 4) : new THREE.PlaneGeometry(1, 1, 4, 4);
  if (!endpoint_lamp_b_halo_74) {
    mesh_lamp_b_halo_74Geometry.scale(3.4, 3.4, 1);
  }
  const mesh_lamp_b_halo_74 = new THREE.Mesh(
    mesh_lamp_b_halo_74Geometry,
    materialMap["glow-card"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lamp_b_halo_74.name = "lamp-b halo card";
  if (endpoint_lamp_b_halo_74) {
    mesh_lamp_b_halo_74.position.copy(endpoint_lamp_b_halo_74.midpoint);
    mesh_lamp_b_halo_74.quaternion.copy(endpoint_lamp_b_halo_74.quaternion);
  }
  mesh_lamp_b_halo_74.castShadow = options.castShadow ?? true;
  mesh_lamp_b_halo_74.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_b_halo_74.userData.sculptComponent = node_lamp_b_halo_74.userData.sculptComponent;
  node_lamp_b_halo_74.add(mesh_lamp_b_halo_74);
  meshes["lamp-b-halo"] = mesh_lamp_b_halo_74;
  colliders["lamp-b-halo"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lamp"] ?? (destructionGroups["lamp"] = []);
  destructionGroups["lamp"].push(node_lamp_b_halo_74);
  const attachment_cab_body_75 = null;
  const endpoint_cab_body_75 = makeAttachmentEndpoint(attachment_cab_body_75);
  const node_cab_body_75 = new THREE.Group();
  node_cab_body_75.name = "Cab body shell__pivot";
  node_cab_body_75.scale.set(1, 1, 1);
  if (endpoint_cab_body_75) {
    node_cab_body_75.position.copy(endpoint_cab_body_75.start);
    node_cab_body_75.rotation.set(0, 0, 0);
  } else {
    node_cab_body_75.position.set(1.55, 2.4, -1.8);
    node_cab_body_75.rotation.set(0, 0, 0);
  }
  node_cab_body_75.userData.sculptComponent = { "id": "cab-body", "name": "Cab body shell", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.5, "height": 1.8, "depth": 2.6, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [1.55, 2.4, -1.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "cab-hitch", "localPosition": [0, -0.9, 1.5], "localRotation": [0, 0, 0], "purpose": "pole/trace mount toward the horse team" }], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } }, "material": "cab-body", "materialLayers": ["cab-body"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["boxy brougham cabin, blue-black lacquer", "long axis along the street"], "surfaceDetail": { "macroRoughness": 0.5, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(19, 25, 58, 1.0)", "secondaryAlbedo": "rgba(56, 66, 95, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #13193a; reproduction albedo #38425f; source: #13193a cab front / #02030b shadow side" } };
  node_cab_body_75.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [{ "id": "cab-hitch", "localPosition": [0, -0.9, 1.5], "localRotation": [0, 0, 0], "purpose": "pole/trace mount toward the horse team" }], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } };
  (nodes["root"] ?? root).add(node_cab_body_75);
  nodes["cab-body"] = node_cab_body_75;
  const mesh_cab_body_75Geometry = endpoint_cab_body_75 ? new THREE.CylinderGeometry(endpoint_cab_body_75.endRadius, endpoint_cab_body_75.baseRadius, endpoint_cab_body_75.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_body_75) {
    mesh_cab_body_75Geometry.scale(1.5, 1.8, 2.6);
  }
  const mesh_cab_body_75 = new THREE.Mesh(
    mesh_cab_body_75Geometry,
    materialMap["cab-body"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_body_75.name = "Cab body shell";
  if (endpoint_cab_body_75) {
    mesh_cab_body_75.position.copy(endpoint_cab_body_75.midpoint);
    mesh_cab_body_75.quaternion.copy(endpoint_cab_body_75.quaternion);
  }
  mesh_cab_body_75.castShadow = options.castShadow ?? true;
  mesh_cab_body_75.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_body_75.userData.sculptComponent = node_cab_body_75.userData.sculptComponent;
  node_cab_body_75.add(mesh_cab_body_75);
  meshes["cab-body"] = mesh_cab_body_75;
  colliders["cab-body"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_body_75);
  const socket_cab_body_cab_hitch_0 = new THREE.Object3D();
  socket_cab_body_cab_hitch_0.name = "cab-hitch";
  socket_cab_body_cab_hitch_0.position.set(0, -0.9, 1.5);
  socket_cab_body_cab_hitch_0.rotation.set(0, 0, 0);
  socket_cab_body_cab_hitch_0.userData.socket = { "id": "cab-hitch", "localPosition": [0, -0.9, 1.5], "localRotation": [0, 0, 0], "purpose": "pole/trace mount toward the horse team" };
  node_cab_body_75.add(socket_cab_body_cab_hitch_0);
  sockets["cab-body:cab-hitch"] = socket_cab_body_cab_hitch_0;
  const attachment_cab_roof_76 = null;
  const endpoint_cab_roof_76 = makeAttachmentEndpoint(attachment_cab_roof_76);
  const node_cab_roof_76 = new THREE.Group();
  node_cab_roof_76.name = "Cab roof slab__pivot";
  node_cab_roof_76.scale.set(1, 1, 1);
  if (endpoint_cab_roof_76) {
    node_cab_roof_76.position.copy(endpoint_cab_roof_76.start);
    node_cab_roof_76.rotation.set(0, 0, 0);
  } else {
    node_cab_roof_76.position.set(1.55, 3.42, -1.8);
    node_cab_roof_76.rotation.set(0, 0, 0);
  }
  node_cab_roof_76.userData.sculptComponent = { "id": "cab-roof", "name": "Cab roof slab", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.8, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.62, "height": 0.24, "depth": 2.74, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.8 }, "transform": { "position": [1.55, 3.42, -1.8], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } }, "material": "cab-body", "materialLayers": ["cab-body"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["slightly overhanging roof slab"], "surfaceDetail": { "macroRoughness": 0.5, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(19, 25, 58, 1.0)", "secondaryAlbedo": "rgba(56, 66, 95, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #13193a; reproduction albedo #38425f; source: #13193a cab front / #02030b shadow side" } };
  node_cab_roof_76.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } };
  (nodes["root"] ?? root).add(node_cab_roof_76);
  nodes["cab-roof"] = node_cab_roof_76;
  const mesh_cab_roof_76Geometry = endpoint_cab_roof_76 ? new THREE.CylinderGeometry(endpoint_cab_roof_76.endRadius, endpoint_cab_roof_76.baseRadius, endpoint_cab_roof_76.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_roof_76) {
    mesh_cab_roof_76Geometry.scale(1.62, 0.24, 2.74);
  }
  const mesh_cab_roof_76 = new THREE.Mesh(
    mesh_cab_roof_76Geometry,
    materialMap["cab-body"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_roof_76.name = "Cab roof slab";
  if (endpoint_cab_roof_76) {
    mesh_cab_roof_76.position.copy(endpoint_cab_roof_76.midpoint);
    mesh_cab_roof_76.quaternion.copy(endpoint_cab_roof_76.quaternion);
  }
  mesh_cab_roof_76.castShadow = options.castShadow ?? true;
  mesh_cab_roof_76.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_roof_76.userData.sculptComponent = node_cab_roof_76.userData.sculptComponent;
  node_cab_roof_76.add(mesh_cab_roof_76);
  meshes["cab-roof"] = mesh_cab_roof_76;
  colliders["cab-roof"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_roof_76);
  const attachment_cab_roof_cap_77 = null;
  const endpoint_cab_roof_cap_77 = makeAttachmentEndpoint(attachment_cab_roof_cap_77);
  const node_cab_roof_cap_77 = new THREE.Group();
  node_cab_roof_cap_77.name = "Cab roof crown__pivot";
  node_cab_roof_cap_77.scale.set(1, 1, 1);
  if (endpoint_cab_roof_cap_77) {
    node_cab_roof_cap_77.position.copy(endpoint_cab_roof_cap_77.start);
    node_cab_roof_cap_77.rotation.set(0, 0, 0);
  } else {
    node_cab_roof_cap_77.position.set(1.55, 3.58, -1.85);
    node_cab_roof_cap_77.rotation.set(0, 0, 0);
  }
  node_cab_roof_cap_77.userData.sculptComponent = { "id": "cab-roof-cap", "name": "Cab roof crown", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.12, "height": 0.14, "depth": 2.1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [1.55, 3.58, -1.85], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } }, "material": "cab-body", "materialLayers": ["cab-body"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["raised crown panel giving the roof two value steps"], "surfaceDetail": { "macroRoughness": 0.5, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(19, 25, 58, 1.0)", "secondaryAlbedo": "rgba(56, 66, 95, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #13193a; reproduction albedo #38425f; source: #13193a cab front / #02030b shadow side" } };
  node_cab_roof_cap_77.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } };
  (nodes["root"] ?? root).add(node_cab_roof_cap_77);
  nodes["cab-roof-cap"] = node_cab_roof_cap_77;
  const mesh_cab_roof_cap_77Geometry = endpoint_cab_roof_cap_77 ? new THREE.CylinderGeometry(endpoint_cab_roof_cap_77.endRadius, endpoint_cab_roof_cap_77.baseRadius, endpoint_cab_roof_cap_77.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_roof_cap_77) {
    mesh_cab_roof_cap_77Geometry.scale(1.12, 0.14, 2.1);
  }
  const mesh_cab_roof_cap_77 = new THREE.Mesh(
    mesh_cab_roof_cap_77Geometry,
    materialMap["cab-body"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_roof_cap_77.name = "Cab roof crown";
  if (endpoint_cab_roof_cap_77) {
    mesh_cab_roof_cap_77.position.copy(endpoint_cab_roof_cap_77.midpoint);
    mesh_cab_roof_cap_77.quaternion.copy(endpoint_cab_roof_cap_77.quaternion);
  }
  mesh_cab_roof_cap_77.castShadow = options.castShadow ?? true;
  mesh_cab_roof_cap_77.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_roof_cap_77.userData.sculptComponent = node_cab_roof_cap_77.userData.sculptComponent;
  node_cab_roof_cap_77.add(mesh_cab_roof_cap_77);
  meshes["cab-roof-cap"] = mesh_cab_roof_cap_77;
  colliders["cab-roof-cap"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_roof_cap_77);
  const attachment_cab_door_panel_78 = null;
  const endpoint_cab_door_panel_78 = makeAttachmentEndpoint(attachment_cab_door_panel_78);
  const node_cab_door_panel_78 = new THREE.Group();
  node_cab_door_panel_78.name = "Cab door panel__pivot";
  node_cab_door_panel_78.scale.set(1, 1, 1);
  if (endpoint_cab_door_panel_78) {
    node_cab_door_panel_78.position.copy(endpoint_cab_door_panel_78.start);
    node_cab_door_panel_78.rotation.set(0, 0, 0);
  } else {
    node_cab_door_panel_78.position.set(2.32, 2.3, -1.9);
    node_cab_door_panel_78.rotation.set(0, 0, 0);
  }
  node_cab_door_panel_78.userData.sculptComponent = { "id": "cab-door-panel", "name": "Cab door panel", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.08, "height": 1.2, "depth": 1.05, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [2.32, 2.3, -1.9], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } }, "material": "cab-body", "materialLayers": ["cab-body"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["door outline proud of the body side"], "surfaceDetail": { "macroRoughness": 0.5, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(19, 25, 58, 1.0)", "secondaryAlbedo": "rgba(56, 66, 95, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #13193a; reproduction albedo #38425f; source: #13193a cab front / #02030b shadow side" } };
  node_cab_door_panel_78.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } };
  (nodes["root"] ?? root).add(node_cab_door_panel_78);
  nodes["cab-door-panel"] = node_cab_door_panel_78;
  const mesh_cab_door_panel_78Geometry = endpoint_cab_door_panel_78 ? new THREE.CylinderGeometry(endpoint_cab_door_panel_78.endRadius, endpoint_cab_door_panel_78.baseRadius, endpoint_cab_door_panel_78.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_door_panel_78) {
    mesh_cab_door_panel_78Geometry.scale(0.08, 1.2, 1.05);
  }
  const mesh_cab_door_panel_78 = new THREE.Mesh(
    mesh_cab_door_panel_78Geometry,
    materialMap["cab-body"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_door_panel_78.name = "Cab door panel";
  if (endpoint_cab_door_panel_78) {
    mesh_cab_door_panel_78.position.copy(endpoint_cab_door_panel_78.midpoint);
    mesh_cab_door_panel_78.quaternion.copy(endpoint_cab_door_panel_78.quaternion);
  }
  mesh_cab_door_panel_78.castShadow = options.castShadow ?? true;
  mesh_cab_door_panel_78.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_door_panel_78.userData.sculptComponent = node_cab_door_panel_78.userData.sculptComponent;
  node_cab_door_panel_78.add(mesh_cab_door_panel_78);
  meshes["cab-door-panel"] = mesh_cab_door_panel_78;
  colliders["cab-door-panel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_door_panel_78);
  const attachment_cab_door_glass_79 = null;
  const endpoint_cab_door_glass_79 = makeAttachmentEndpoint(attachment_cab_door_glass_79);
  const node_cab_door_glass_79 = new THREE.Group();
  node_cab_door_glass_79.name = "Cab door glass__pivot";
  node_cab_door_glass_79.scale.set(1, 1, 1);
  if (endpoint_cab_door_glass_79) {
    node_cab_door_glass_79.position.copy(endpoint_cab_door_glass_79.start);
    node_cab_door_glass_79.rotation.set(0, 0, 0);
  } else {
    node_cab_door_glass_79.position.set(2.34, 2.72, -1.55);
    node_cab_door_glass_79.rotation.set(0, 0, 0);
  }
  node_cab_door_glass_79.userData.sculptComponent = { "id": "cab-door-glass", "name": "Cab door glass", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.06, "height": 0.56, "depth": 0.66, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [2.34, 2.72, -1.55], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-dark" } }, "material": "cab-dark", "materialLayers": ["cab-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["unlit dark glass, no interior glow"], "surfaceDetail": { "macroRoughness": 0.45, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(2, 3, 11, 1.0)", "secondaryAlbedo": "rgba(18, 22, 31, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #02030b; reproduction albedo #12161f; source: #02030b" } };
  node_cab_door_glass_79.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-dark" } };
  (nodes["root"] ?? root).add(node_cab_door_glass_79);
  nodes["cab-door-glass"] = node_cab_door_glass_79;
  const mesh_cab_door_glass_79Geometry = endpoint_cab_door_glass_79 ? new THREE.CylinderGeometry(endpoint_cab_door_glass_79.endRadius, endpoint_cab_door_glass_79.baseRadius, endpoint_cab_door_glass_79.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_door_glass_79) {
    mesh_cab_door_glass_79Geometry.scale(0.06, 0.56, 0.66);
  }
  const mesh_cab_door_glass_79 = new THREE.Mesh(
    mesh_cab_door_glass_79Geometry,
    materialMap["cab-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_door_glass_79.name = "Cab door glass";
  if (endpoint_cab_door_glass_79) {
    mesh_cab_door_glass_79.position.copy(endpoint_cab_door_glass_79.midpoint);
    mesh_cab_door_glass_79.quaternion.copy(endpoint_cab_door_glass_79.quaternion);
  }
  mesh_cab_door_glass_79.castShadow = options.castShadow ?? true;
  mesh_cab_door_glass_79.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_door_glass_79.userData.sculptComponent = node_cab_door_glass_79.userData.sculptComponent;
  node_cab_door_glass_79.add(mesh_cab_door_glass_79);
  meshes["cab-door-glass"] = mesh_cab_door_glass_79;
  colliders["cab-door-glass"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_door_glass_79);
  const attachment_cab_driver_bench_80 = null;
  const endpoint_cab_driver_bench_80 = makeAttachmentEndpoint(attachment_cab_driver_bench_80);
  const node_cab_driver_bench_80 = new THREE.Group();
  node_cab_driver_bench_80.name = "Driver's box__pivot";
  node_cab_driver_bench_80.scale.set(1, 1, 1);
  if (endpoint_cab_driver_bench_80) {
    node_cab_driver_bench_80.position.copy(endpoint_cab_driver_bench_80.start);
    node_cab_driver_bench_80.rotation.set(0, 0, 0);
  } else {
    node_cab_driver_bench_80.position.set(1.55, 2.25, -0.2);
    node_cab_driver_bench_80.rotation.set(0, 0, 0);
  }
  node_cab_driver_bench_80.userData.sculptComponent = { "id": "cab-driver-bench", "name": "Driver's box", "level": "meso", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.4, "height": 0.55, "depth": 0.8, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [1.55, 2.25, -0.2], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } }, "material": "cab-body", "materialLayers": ["cab-body"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["raised bench ahead of the cabin"], "surfaceDetail": { "macroRoughness": 0.5, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(19, 25, 58, 1.0)", "secondaryAlbedo": "rgba(56, 66, 95, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #13193a; reproduction albedo #38425f; source: #13193a cab front / #02030b shadow side" } };
  node_cab_driver_bench_80.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } };
  (nodes["root"] ?? root).add(node_cab_driver_bench_80);
  nodes["cab-driver-bench"] = node_cab_driver_bench_80;
  const mesh_cab_driver_bench_80Geometry = endpoint_cab_driver_bench_80 ? new THREE.CylinderGeometry(endpoint_cab_driver_bench_80.endRadius, endpoint_cab_driver_bench_80.baseRadius, endpoint_cab_driver_bench_80.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_driver_bench_80) {
    mesh_cab_driver_bench_80Geometry.scale(1.4, 0.55, 0.8);
  }
  const mesh_cab_driver_bench_80 = new THREE.Mesh(
    mesh_cab_driver_bench_80Geometry,
    materialMap["cab-body"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_driver_bench_80.name = "Driver's box";
  if (endpoint_cab_driver_bench_80) {
    mesh_cab_driver_bench_80.position.copy(endpoint_cab_driver_bench_80.midpoint);
    mesh_cab_driver_bench_80.quaternion.copy(endpoint_cab_driver_bench_80.quaternion);
  }
  mesh_cab_driver_bench_80.castShadow = options.castShadow ?? true;
  mesh_cab_driver_bench_80.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_driver_bench_80.userData.sculptComponent = node_cab_driver_bench_80.userData.sculptComponent;
  node_cab_driver_bench_80.add(mesh_cab_driver_bench_80);
  meshes["cab-driver-bench"] = mesh_cab_driver_bench_80;
  colliders["cab-driver-bench"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_driver_bench_80);
  const attachment_cab_footboard_81 = null;
  const endpoint_cab_footboard_81 = makeAttachmentEndpoint(attachment_cab_footboard_81);
  const node_cab_footboard_81 = new THREE.Group();
  node_cab_footboard_81.name = "Driver footboard__pivot";
  node_cab_footboard_81.scale.set(1, 1, 1);
  if (endpoint_cab_footboard_81) {
    node_cab_footboard_81.position.copy(endpoint_cab_footboard_81.start);
    node_cab_footboard_81.rotation.set(0, 0, 0);
  } else {
    node_cab_footboard_81.position.set(1.55, 1.86, 0.3);
    node_cab_footboard_81.rotation.set(0, 0, 0);
  }
  node_cab_footboard_81.userData.sculptComponent = { "id": "cab-footboard", "name": "Driver footboard", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.3, "height": 0.14, "depth": 0.55, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.65 }, "transform": { "position": [1.55, 1.86, 0.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } }, "material": "cab-body", "materialLayers": ["cab-body"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.5, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(19, 25, 58, 1.0)", "secondaryAlbedo": "rgba(56, 66, 95, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #13193a; reproduction albedo #38425f; source: #13193a cab front / #02030b shadow side" } };
  node_cab_footboard_81.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "cab-body" } };
  (nodes["root"] ?? root).add(node_cab_footboard_81);
  nodes["cab-footboard"] = node_cab_footboard_81;
  const mesh_cab_footboard_81Geometry = endpoint_cab_footboard_81 ? new THREE.CylinderGeometry(endpoint_cab_footboard_81.endRadius, endpoint_cab_footboard_81.baseRadius, endpoint_cab_footboard_81.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_footboard_81) {
    mesh_cab_footboard_81Geometry.scale(1.3, 0.14, 0.55);
  }
  const mesh_cab_footboard_81 = new THREE.Mesh(
    mesh_cab_footboard_81Geometry,
    materialMap["cab-body"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_footboard_81.name = "Driver footboard";
  if (endpoint_cab_footboard_81) {
    mesh_cab_footboard_81.position.copy(endpoint_cab_footboard_81.midpoint);
    mesh_cab_footboard_81.quaternion.copy(endpoint_cab_footboard_81.quaternion);
  }
  mesh_cab_footboard_81.castShadow = options.castShadow ?? true;
  mesh_cab_footboard_81.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_footboard_81.userData.sculptComponent = node_cab_footboard_81.userData.sculptComponent;
  node_cab_footboard_81.add(mesh_cab_footboard_81);
  meshes["cab-footboard"] = mesh_cab_footboard_81;
  colliders["cab-footboard"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_footboard_81);
  const attachment_cab_lamp_a_82 = null;
  const endpoint_cab_lamp_a_82 = makeAttachmentEndpoint(attachment_cab_lamp_a_82);
  const node_cab_lamp_a_82 = new THREE.Group();
  node_cab_lamp_a_82.name = "Near cab lamp__pivot";
  node_cab_lamp_a_82.scale.set(1, 1, 1);
  if (endpoint_cab_lamp_a_82) {
    node_cab_lamp_a_82.position.copy(endpoint_cab_lamp_a_82.start);
    node_cab_lamp_a_82.rotation.set(0, 0, 0);
  } else {
    node_cab_lamp_a_82.position.set(2.27, 2.95, -0.52);
    node_cab_lamp_a_82.rotation.set(0, 0, 0);
  }
  node_cab_lamp_a_82.userData.sculptComponent = { "id": "cab-lamp-a", "name": "Near cab lamp", "level": "meso", "role": "body", "importance": 0.8, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.19, "height": 0.3, "depth": 0.19, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [2.27, 2.95, -0.52], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } }, "material": "lamp-glow", "materialLayers": ["lamp-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["small amber carriage lamp, near-white core"], "surfaceDetail": { "macroRoughness": 0.3, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(183, 166, 101, 1.0)", "secondaryAlbedo": "rgba(66, 48, 26, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #b7a665; reproduction albedo #42301a; source: #b7a665 lamp glass / #fbf387 cab lamp" } };
  node_cab_lamp_a_82.userData.actionProfile = { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } };
  (nodes["root"] ?? root).add(node_cab_lamp_a_82);
  nodes["cab-lamp-a"] = node_cab_lamp_a_82;
  const mesh_cab_lamp_a_82Geometry = endpoint_cab_lamp_a_82 ? new THREE.CylinderGeometry(endpoint_cab_lamp_a_82.endRadius, endpoint_cab_lamp_a_82.baseRadius, endpoint_cab_lamp_a_82.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_lamp_a_82) {
    mesh_cab_lamp_a_82Geometry.scale(0.19, 0.3, 0.19);
  }
  const mesh_cab_lamp_a_82 = new THREE.Mesh(
    mesh_cab_lamp_a_82Geometry,
    materialMap["lamp-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_lamp_a_82.name = "Near cab lamp";
  if (endpoint_cab_lamp_a_82) {
    mesh_cab_lamp_a_82.position.copy(endpoint_cab_lamp_a_82.midpoint);
    mesh_cab_lamp_a_82.quaternion.copy(endpoint_cab_lamp_a_82.quaternion);
  }
  mesh_cab_lamp_a_82.castShadow = options.castShadow ?? true;
  mesh_cab_lamp_a_82.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_lamp_a_82.userData.sculptComponent = node_cab_lamp_a_82.userData.sculptComponent;
  node_cab_lamp_a_82.add(mesh_cab_lamp_a_82);
  meshes["cab-lamp-a"] = mesh_cab_lamp_a_82;
  colliders["cab-lamp-a"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_lamp_a_82);
  const attachment_cab_lamp_b_83 = null;
  const endpoint_cab_lamp_b_83 = makeAttachmentEndpoint(attachment_cab_lamp_b_83);
  const node_cab_lamp_b_83 = new THREE.Group();
  node_cab_lamp_b_83.name = "Off cab lamp beside the driver__pivot";
  node_cab_lamp_b_83.scale.set(1, 1, 1);
  if (endpoint_cab_lamp_b_83) {
    node_cab_lamp_b_83.position.copy(endpoint_cab_lamp_b_83.start);
    node_cab_lamp_b_83.rotation.set(0, 0, 0);
  } else {
    node_cab_lamp_b_83.position.set(0.93, 3, -0.3);
    node_cab_lamp_b_83.rotation.set(0, 0, 0);
  }
  node_cab_lamp_b_83.userData.sculptComponent = { "id": "cab-lamp-b", "name": "Off cab lamp beside the driver", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.17, "height": 0.28, "depth": 0.17, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [0.93, 3, -0.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } }, "material": "lamp-glow", "materialLayers": ["lamp-glow"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["second carriage lamp beside the driver's knee"], "surfaceDetail": { "macroRoughness": 0.3, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(183, 166, 101, 1.0)", "secondaryAlbedo": "rgba(66, 48, 26, 1.0)", "materialClass": "glass", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #b7a665; reproduction albedo #42301a; source: #b7a665 lamp glass / #fbf387 cab lamp" } };
  node_cab_lamp_b_83.userData.actionProfile = { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "lamp-glow" } };
  (nodes["root"] ?? root).add(node_cab_lamp_b_83);
  nodes["cab-lamp-b"] = node_cab_lamp_b_83;
  const mesh_cab_lamp_b_83Geometry = endpoint_cab_lamp_b_83 ? new THREE.CylinderGeometry(endpoint_cab_lamp_b_83.endRadius, endpoint_cab_lamp_b_83.baseRadius, endpoint_cab_lamp_b_83.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_cab_lamp_b_83) {
    mesh_cab_lamp_b_83Geometry.scale(0.17, 0.28, 0.17);
  }
  const mesh_cab_lamp_b_83 = new THREE.Mesh(
    mesh_cab_lamp_b_83Geometry,
    materialMap["lamp-glow"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_lamp_b_83.name = "Off cab lamp beside the driver";
  if (endpoint_cab_lamp_b_83) {
    mesh_cab_lamp_b_83.position.copy(endpoint_cab_lamp_b_83.midpoint);
    mesh_cab_lamp_b_83.quaternion.copy(endpoint_cab_lamp_b_83.quaternion);
  }
  mesh_cab_lamp_b_83.castShadow = options.castShadow ?? true;
  mesh_cab_lamp_b_83.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_lamp_b_83.userData.sculptComponent = node_cab_lamp_b_83.userData.sculptComponent;
  node_cab_lamp_b_83.add(mesh_cab_lamp_b_83);
  meshes["cab-lamp-b"] = mesh_cab_lamp_b_83;
  colliders["cab-lamp-b"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_lamp_b_83);
  const attachment_cab_lamp_a_halo_84 = null;
  const endpoint_cab_lamp_a_halo_84 = makeAttachmentEndpoint(attachment_cab_lamp_a_halo_84);
  const node_cab_lamp_a_halo_84 = new THREE.Group();
  node_cab_lamp_a_halo_84.name = "Near cab lamp halo__pivot";
  node_cab_lamp_a_halo_84.scale.set(1, 1, 1);
  if (endpoint_cab_lamp_a_halo_84) {
    node_cab_lamp_a_halo_84.position.copy(endpoint_cab_lamp_a_halo_84.start);
    node_cab_lamp_a_halo_84.rotation.set(0, 0, 0);
  } else {
    node_cab_lamp_a_halo_84.position.set(2.27, 2.95, -0.52);
    node_cab_lamp_a_halo_84.rotation.set(0, 0, 0);
  }
  node_cab_lamp_a_halo_84.userData.sculptComponent = { "id": "cab-lamp-a-halo", "name": "Near cab lamp halo", "level": "meso", "role": "effect", "importance": 0.6, "confidence": 0.6, "primitive": "plane-card", "topologyClass": "conforming-shell", "topologyRationale": "camera-facing card standing in for the lamp's scatter, not a solid", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)", "billboard": "camera-facing", "blending": "additive" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.35, "height": 1.35, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [2.27, 2.95, -0.52], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "glow-card" } }, "material": "glow-card", "materialLayers": ["glow-card"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 1, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(187, 139, 86, 1.0)", "secondaryAlbedo": "rgba(0, 0, 0, 1.0)", "materialClass": "unknown", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #bb8b56; reproduction albedo #000000; source: derived from adjacent sampled facets" } };
  node_cab_lamp_a_halo_84.userData.actionProfile = { "animationRole": "flicker", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "glow-card" } };
  (nodes["root"] ?? root).add(node_cab_lamp_a_halo_84);
  nodes["cab-lamp-a-halo"] = node_cab_lamp_a_halo_84;
  const mesh_cab_lamp_a_halo_84Geometry = endpoint_cab_lamp_a_halo_84 ? new THREE.CylinderGeometry(endpoint_cab_lamp_a_halo_84.endRadius, endpoint_cab_lamp_a_halo_84.baseRadius, endpoint_cab_lamp_a_halo_84.length, 8, 4) : new THREE.PlaneGeometry(1, 1, 4, 4);
  if (!endpoint_cab_lamp_a_halo_84) {
    mesh_cab_lamp_a_halo_84Geometry.scale(1.35, 1.35, 1);
  }
  const mesh_cab_lamp_a_halo_84 = new THREE.Mesh(
    mesh_cab_lamp_a_halo_84Geometry,
    materialMap["glow-card"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_lamp_a_halo_84.name = "Near cab lamp halo";
  if (endpoint_cab_lamp_a_halo_84) {
    mesh_cab_lamp_a_halo_84.position.copy(endpoint_cab_lamp_a_halo_84.midpoint);
    mesh_cab_lamp_a_halo_84.quaternion.copy(endpoint_cab_lamp_a_halo_84.quaternion);
  }
  mesh_cab_lamp_a_halo_84.castShadow = options.castShadow ?? true;
  mesh_cab_lamp_a_halo_84.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_lamp_a_halo_84.userData.sculptComponent = node_cab_lamp_a_halo_84.userData.sculptComponent;
  node_cab_lamp_a_halo_84.add(mesh_cab_lamp_a_halo_84);
  meshes["cab-lamp-a-halo"] = mesh_cab_lamp_a_halo_84;
  colliders["cab-lamp-a-halo"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_lamp_a_halo_84);
  const attachment_cab_wheel_rear_near_85 = null;
  const endpoint_cab_wheel_rear_near_85 = makeAttachmentEndpoint(attachment_cab_wheel_rear_near_85);
  const node_cab_wheel_rear_near_85 = new THREE.Group();
  node_cab_wheel_rear_near_85.name = "Rear wheel (near side)__pivot";
  node_cab_wheel_rear_near_85.scale.set(1, 1, 1);
  if (endpoint_cab_wheel_rear_near_85) {
    node_cab_wheel_rear_near_85.position.copy(endpoint_cab_wheel_rear_near_85.start);
    node_cab_wheel_rear_near_85.rotation.set(0, 1.5708, 0);
  } else {
    node_cab_wheel_rear_near_85.position.set(2.42, 1.2, -2.9);
    node_cab_wheel_rear_near_85.rotation.set(0, 1.5708, 0);
  }
  node_cab_wheel_rear_near_85.userData.sculptComponent = { "id": "cab-wheel-rear-near", "name": "Rear wheel (near side)", "level": "meso", "role": "body", "importance": 0.85, "confidence": 0.75, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "a thin rim ring; the spokes are a separate radial repetition system inside it", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 2.55, "height": 2.55, "depth": 0.5, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [2.42, 1.2, -2.9], "rotation": [0, 1.5708, 0] }, "actionProfile": { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["large rear wheel, thin rim, ~10 spokes"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_wheel_rear_near_85.userData.actionProfile = { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_wheel_rear_near_85);
  nodes["cab-wheel-rear-near"] = node_cab_wheel_rear_near_85;
  const mesh_cab_wheel_rear_near_85Geometry = endpoint_cab_wheel_rear_near_85 ? new THREE.CylinderGeometry(endpoint_cab_wheel_rear_near_85.endRadius, endpoint_cab_wheel_rear_near_85.baseRadius, endpoint_cab_wheel_rear_near_85.length, 8, 4) : new THREE.TorusGeometry(0.45, 0.08, 8, 16);
  if (!endpoint_cab_wheel_rear_near_85) {
    mesh_cab_wheel_rear_near_85Geometry.scale(2.55, 2.55, 0.5);
  }
  const mesh_cab_wheel_rear_near_85 = new THREE.Mesh(
    mesh_cab_wheel_rear_near_85Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_wheel_rear_near_85.name = "Rear wheel (near side)";
  if (endpoint_cab_wheel_rear_near_85) {
    mesh_cab_wheel_rear_near_85.position.copy(endpoint_cab_wheel_rear_near_85.midpoint);
    mesh_cab_wheel_rear_near_85.quaternion.copy(endpoint_cab_wheel_rear_near_85.quaternion);
  }
  mesh_cab_wheel_rear_near_85.castShadow = options.castShadow ?? true;
  mesh_cab_wheel_rear_near_85.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_wheel_rear_near_85.userData.sculptComponent = node_cab_wheel_rear_near_85.userData.sculptComponent;
  node_cab_wheel_rear_near_85.add(mesh_cab_wheel_rear_near_85);
  meshes["cab-wheel-rear-near"] = mesh_cab_wheel_rear_near_85;
  colliders["cab-wheel-rear-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_wheel_rear_near_85);
  const attachment_cab_wheel_front_near_86 = null;
  const endpoint_cab_wheel_front_near_86 = makeAttachmentEndpoint(attachment_cab_wheel_front_near_86);
  const node_cab_wheel_front_near_86 = new THREE.Group();
  node_cab_wheel_front_near_86.name = "Front wheel (near side)__pivot";
  node_cab_wheel_front_near_86.scale.set(1, 1, 1);
  if (endpoint_cab_wheel_front_near_86) {
    node_cab_wheel_front_near_86.position.copy(endpoint_cab_wheel_front_near_86.start);
    node_cab_wheel_front_near_86.rotation.set(0, 1.5708, 0);
  } else {
    node_cab_wheel_front_near_86.position.set(2.42, 0.85, 0.1);
    node_cab_wheel_front_near_86.rotation.set(0, 1.5708, 0);
  }
  node_cab_wheel_front_near_86.userData.sculptComponent = { "id": "cab-wheel-front-near", "name": "Front wheel (near side)", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "thin rim ring, smaller front wheel; spokes handled by the repetition system", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.8, "height": 1.8, "depth": 0.45, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [2.42, 0.85, 0.1], "rotation": [0, 1.5708, 0] }, "actionProfile": { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["smaller front wheel tucked under the driver's box"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_wheel_front_near_86.userData.actionProfile = { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_wheel_front_near_86);
  nodes["cab-wheel-front-near"] = node_cab_wheel_front_near_86;
  const mesh_cab_wheel_front_near_86Geometry = endpoint_cab_wheel_front_near_86 ? new THREE.CylinderGeometry(endpoint_cab_wheel_front_near_86.endRadius, endpoint_cab_wheel_front_near_86.baseRadius, endpoint_cab_wheel_front_near_86.length, 8, 4) : new THREE.TorusGeometry(0.45, 0.08, 8, 16);
  if (!endpoint_cab_wheel_front_near_86) {
    mesh_cab_wheel_front_near_86Geometry.scale(1.8, 1.8, 0.45);
  }
  const mesh_cab_wheel_front_near_86 = new THREE.Mesh(
    mesh_cab_wheel_front_near_86Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_wheel_front_near_86.name = "Front wheel (near side)";
  if (endpoint_cab_wheel_front_near_86) {
    mesh_cab_wheel_front_near_86.position.copy(endpoint_cab_wheel_front_near_86.midpoint);
    mesh_cab_wheel_front_near_86.quaternion.copy(endpoint_cab_wheel_front_near_86.quaternion);
  }
  mesh_cab_wheel_front_near_86.castShadow = options.castShadow ?? true;
  mesh_cab_wheel_front_near_86.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_wheel_front_near_86.userData.sculptComponent = node_cab_wheel_front_near_86.userData.sculptComponent;
  node_cab_wheel_front_near_86.add(mesh_cab_wheel_front_near_86);
  meshes["cab-wheel-front-near"] = mesh_cab_wheel_front_near_86;
  colliders["cab-wheel-front-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_wheel_front_near_86);
  const attachment_cab_wheel_rear_off_87 = null;
  const endpoint_cab_wheel_rear_off_87 = makeAttachmentEndpoint(attachment_cab_wheel_rear_off_87);
  const node_cab_wheel_rear_off_87 = new THREE.Group();
  node_cab_wheel_rear_off_87.name = "Rear wheel (off side)__pivot";
  node_cab_wheel_rear_off_87.scale.set(1, 1, 1);
  if (endpoint_cab_wheel_rear_off_87) {
    node_cab_wheel_rear_off_87.position.copy(endpoint_cab_wheel_rear_off_87.start);
    node_cab_wheel_rear_off_87.rotation.set(0, 1.5708, 0);
  } else {
    node_cab_wheel_rear_off_87.position.set(0.68, 1.2, -2.9);
    node_cab_wheel_rear_off_87.rotation.set(0, 1.5708, 0);
  }
  node_cab_wheel_rear_off_87.userData.sculptComponent = { "id": "cab-wheel-rear-off", "name": "Rear wheel (off side)", "level": "meso", "role": "body", "importance": 0.85, "confidence": 0.75, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "a thin rim ring; the spokes are a separate radial repetition system inside it", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 2.55, "height": 2.55, "depth": 0.5, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0.68, 1.2, -2.9], "rotation": [0, 1.5708, 0] }, "actionProfile": { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["large rear wheel, thin rim, ~10 spokes"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_wheel_rear_off_87.userData.actionProfile = { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_wheel_rear_off_87);
  nodes["cab-wheel-rear-off"] = node_cab_wheel_rear_off_87;
  const mesh_cab_wheel_rear_off_87Geometry = endpoint_cab_wheel_rear_off_87 ? new THREE.CylinderGeometry(endpoint_cab_wheel_rear_off_87.endRadius, endpoint_cab_wheel_rear_off_87.baseRadius, endpoint_cab_wheel_rear_off_87.length, 8, 4) : new THREE.TorusGeometry(0.45, 0.08, 8, 16);
  if (!endpoint_cab_wheel_rear_off_87) {
    mesh_cab_wheel_rear_off_87Geometry.scale(2.55, 2.55, 0.5);
  }
  const mesh_cab_wheel_rear_off_87 = new THREE.Mesh(
    mesh_cab_wheel_rear_off_87Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_wheel_rear_off_87.name = "Rear wheel (off side)";
  if (endpoint_cab_wheel_rear_off_87) {
    mesh_cab_wheel_rear_off_87.position.copy(endpoint_cab_wheel_rear_off_87.midpoint);
    mesh_cab_wheel_rear_off_87.quaternion.copy(endpoint_cab_wheel_rear_off_87.quaternion);
  }
  mesh_cab_wheel_rear_off_87.castShadow = options.castShadow ?? true;
  mesh_cab_wheel_rear_off_87.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_wheel_rear_off_87.userData.sculptComponent = node_cab_wheel_rear_off_87.userData.sculptComponent;
  node_cab_wheel_rear_off_87.add(mesh_cab_wheel_rear_off_87);
  meshes["cab-wheel-rear-off"] = mesh_cab_wheel_rear_off_87;
  colliders["cab-wheel-rear-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_wheel_rear_off_87);
  const attachment_cab_wheel_front_off_88 = null;
  const endpoint_cab_wheel_front_off_88 = makeAttachmentEndpoint(attachment_cab_wheel_front_off_88);
  const node_cab_wheel_front_off_88 = new THREE.Group();
  node_cab_wheel_front_off_88.name = "Front wheel (off side)__pivot";
  node_cab_wheel_front_off_88.scale.set(1, 1, 1);
  if (endpoint_cab_wheel_front_off_88) {
    node_cab_wheel_front_off_88.position.copy(endpoint_cab_wheel_front_off_88.start);
    node_cab_wheel_front_off_88.rotation.set(0, 1.5708, 0);
  } else {
    node_cab_wheel_front_off_88.position.set(0.68, 0.85, 0.1);
    node_cab_wheel_front_off_88.rotation.set(0, 1.5708, 0);
  }
  node_cab_wheel_front_off_88.userData.sculptComponent = { "id": "cab-wheel-front-off", "name": "Front wheel (off side)", "level": "meso", "role": "body", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "thin rim ring, smaller front wheel; spokes handled by the repetition system", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 1.8, "height": 1.8, "depth": 0.45, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [0.68, 0.85, 0.1], "rotation": [0, 1.5708, 0] }, "actionProfile": { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["smaller front wheel tucked under the driver's box"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_wheel_front_off_88.userData.actionProfile = { "animationRole": "spin", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_wheel_front_off_88);
  nodes["cab-wheel-front-off"] = node_cab_wheel_front_off_88;
  const mesh_cab_wheel_front_off_88Geometry = endpoint_cab_wheel_front_off_88 ? new THREE.CylinderGeometry(endpoint_cab_wheel_front_off_88.endRadius, endpoint_cab_wheel_front_off_88.baseRadius, endpoint_cab_wheel_front_off_88.length, 8, 4) : new THREE.TorusGeometry(0.45, 0.08, 8, 16);
  if (!endpoint_cab_wheel_front_off_88) {
    mesh_cab_wheel_front_off_88Geometry.scale(1.8, 1.8, 0.45);
  }
  const mesh_cab_wheel_front_off_88 = new THREE.Mesh(
    mesh_cab_wheel_front_off_88Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_wheel_front_off_88.name = "Front wheel (off side)";
  if (endpoint_cab_wheel_front_off_88) {
    mesh_cab_wheel_front_off_88.position.copy(endpoint_cab_wheel_front_off_88.midpoint);
    mesh_cab_wheel_front_off_88.quaternion.copy(endpoint_cab_wheel_front_off_88.quaternion);
  }
  mesh_cab_wheel_front_off_88.castShadow = options.castShadow ?? true;
  mesh_cab_wheel_front_off_88.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_wheel_front_off_88.userData.sculptComponent = node_cab_wheel_front_off_88.userData.sculptComponent;
  node_cab_wheel_front_off_88.add(mesh_cab_wheel_front_off_88);
  meshes["cab-wheel-front-off"] = mesh_cab_wheel_front_off_88;
  colliders["cab-wheel-front-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_wheel_front_off_88);
  const attachment_cab_pole_89 = { "parentId": "root", "parentSocket": "root:cab-pole-mount", "localStart": [1.2, 1.6, -0.45], "localEnd": [1.2, 1.42, 2.2], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.055, "endRadius": 0.045, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_cab_pole_89 = makeAttachmentEndpoint(attachment_cab_pole_89);
  const node_cab_pole_89 = new THREE.Group();
  node_cab_pole_89.name = "Centre pole to the team__pivot";
  node_cab_pole_89.scale.set(1, 1, 1);
  if (endpoint_cab_pole_89) {
    node_cab_pole_89.position.copy(endpoint_cab_pole_89.start);
    node_cab_pole_89.rotation.set(0, 0, 0);
  } else {
    node_cab_pole_89.position.set(0, 0, 0);
    node_cab_pole_89.rotation.set(0, 0, 0);
  }
  node_cab_pole_89.userData.sculptComponent = { "id": "cab-pole", "name": "Centre pole to the team", "level": "meso", "role": "strut", "importance": 0.6, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:cab-pole-mount", "localStart": [1.2, 1.6, -0.45], "localEnd": [1.2, 1.42, 2.2], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.055, "endRadius": 0.045, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_pole_89.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_pole_89);
  nodes["cab-pole"] = node_cab_pole_89;
  const mesh_cab_pole_89Geometry = endpoint_cab_pole_89 ? new THREE.CylinderGeometry(endpoint_cab_pole_89.endRadius, endpoint_cab_pole_89.baseRadius, endpoint_cab_pole_89.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_cab_pole_89) {
    mesh_cab_pole_89Geometry.scale(1, 1, 1);
  }
  const mesh_cab_pole_89 = new THREE.Mesh(
    mesh_cab_pole_89Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_pole_89.name = "Centre pole to the team";
  if (endpoint_cab_pole_89) {
    mesh_cab_pole_89.position.copy(endpoint_cab_pole_89.midpoint);
    mesh_cab_pole_89.quaternion.copy(endpoint_cab_pole_89.quaternion);
  }
  mesh_cab_pole_89.castShadow = options.castShadow ?? true;
  mesh_cab_pole_89.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_pole_89.userData.sculptComponent = node_cab_pole_89.userData.sculptComponent;
  node_cab_pole_89.add(mesh_cab_pole_89);
  meshes["cab-pole"] = mesh_cab_pole_89;
  colliders["cab-pole"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_pole_89);
  const attachment_cab_trace_near_90 = { "parentId": "root", "parentSocket": "root:cab-trace-near-mount", "localStart": [2.1, 1.7, -0.5], "localEnd": [2.05, 2, 1.6], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.03, "endRadius": 0.025, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_cab_trace_near_90 = makeAttachmentEndpoint(attachment_cab_trace_near_90);
  const node_cab_trace_near_90 = new THREE.Group();
  node_cab_trace_near_90.name = "Near trace__pivot";
  node_cab_trace_near_90.scale.set(1, 1, 1);
  if (endpoint_cab_trace_near_90) {
    node_cab_trace_near_90.position.copy(endpoint_cab_trace_near_90.start);
    node_cab_trace_near_90.rotation.set(0, 0, 0);
  } else {
    node_cab_trace_near_90.position.set(0, 0, 0);
    node_cab_trace_near_90.rotation.set(0, 0, 0);
  }
  node_cab_trace_near_90.userData.sculptComponent = { "id": "cab-trace-near", "name": "Near trace", "level": "micro", "role": "strut", "importance": 0.4, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:cab-trace-near-mount", "localStart": [2.1, 1.7, -0.5], "localEnd": [2.05, 2, 1.6], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.03, "endRadius": 0.025, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_trace_near_90.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_trace_near_90);
  nodes["cab-trace-near"] = node_cab_trace_near_90;
  const mesh_cab_trace_near_90Geometry = endpoint_cab_trace_near_90 ? new THREE.CylinderGeometry(endpoint_cab_trace_near_90.endRadius, endpoint_cab_trace_near_90.baseRadius, endpoint_cab_trace_near_90.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_cab_trace_near_90) {
    mesh_cab_trace_near_90Geometry.scale(1, 1, 1);
  }
  const mesh_cab_trace_near_90 = new THREE.Mesh(
    mesh_cab_trace_near_90Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_trace_near_90.name = "Near trace";
  if (endpoint_cab_trace_near_90) {
    mesh_cab_trace_near_90.position.copy(endpoint_cab_trace_near_90.midpoint);
    mesh_cab_trace_near_90.quaternion.copy(endpoint_cab_trace_near_90.quaternion);
  }
  mesh_cab_trace_near_90.castShadow = options.castShadow ?? true;
  mesh_cab_trace_near_90.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_trace_near_90.userData.sculptComponent = node_cab_trace_near_90.userData.sculptComponent;
  node_cab_trace_near_90.add(mesh_cab_trace_near_90);
  meshes["cab-trace-near"] = mesh_cab_trace_near_90;
  colliders["cab-trace-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_trace_near_90);
  const attachment_cab_rein_91 = { "parentId": "root", "parentSocket": "root:cab-rein-mount", "localStart": [1.5, 3.05, 0.35], "localEnd": [1.25, 2.75, 2.6], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.022, "endRadius": 0.018, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_cab_rein_91 = makeAttachmentEndpoint(attachment_cab_rein_91);
  const node_cab_rein_91 = new THREE.Group();
  node_cab_rein_91.name = "Reins__pivot";
  node_cab_rein_91.scale.set(1, 1, 1);
  if (endpoint_cab_rein_91) {
    node_cab_rein_91.position.copy(endpoint_cab_rein_91.start);
    node_cab_rein_91.rotation.set(0, 0, 0);
  } else {
    node_cab_rein_91.position.set(0, 0, 0);
    node_cab_rein_91.rotation.set(0, 0, 0);
  }
  node_cab_rein_91.userData.sculptComponent = { "id": "cab-rein", "name": "Reins", "level": "micro", "role": "cable", "importance": 0.4, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:cab-rein-mount", "localStart": [1.5, 3.05, 0.35], "localEnd": [1.25, 2.75, 2.6], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.022, "endRadius": 0.018, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_cab_rein_91.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "cab", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_cab_rein_91);
  nodes["cab-rein"] = node_cab_rein_91;
  const mesh_cab_rein_91Geometry = endpoint_cab_rein_91 ? new THREE.CylinderGeometry(endpoint_cab_rein_91.endRadius, endpoint_cab_rein_91.baseRadius, endpoint_cab_rein_91.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_cab_rein_91) {
    mesh_cab_rein_91Geometry.scale(1, 1, 1);
  }
  const mesh_cab_rein_91 = new THREE.Mesh(
    mesh_cab_rein_91Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_cab_rein_91.name = "Reins";
  if (endpoint_cab_rein_91) {
    mesh_cab_rein_91.position.copy(endpoint_cab_rein_91.midpoint);
    mesh_cab_rein_91.quaternion.copy(endpoint_cab_rein_91.quaternion);
  }
  mesh_cab_rein_91.castShadow = options.castShadow ?? true;
  mesh_cab_rein_91.receiveShadow = options.receiveShadow ?? true;
  mesh_cab_rein_91.userData.sculptComponent = node_cab_rein_91.userData.sculptComponent;
  node_cab_rein_91.add(mesh_cab_rein_91);
  meshes["cab-rein"] = mesh_cab_rein_91;
  colliders["cab-rein"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["cab"] ?? (destructionGroups["cab"] = []);
  destructionGroups["cab"].push(node_cab_rein_91);
  const attachment_driver_torso_92 = null;
  const endpoint_driver_torso_92 = makeAttachmentEndpoint(attachment_driver_torso_92);
  const node_driver_torso_92 = new THREE.Group();
  node_driver_torso_92.name = "Driver torso__pivot";
  node_driver_torso_92.scale.set(1, 1, 1);
  if (endpoint_driver_torso_92) {
    node_driver_torso_92.position.copy(endpoint_driver_torso_92.start);
    node_driver_torso_92.rotation.set(0, 0, 0);
  } else {
    node_driver_torso_92.position.set(1.55, 2.95, -0.25);
    node_driver_torso_92.rotation.set(0, 0, 0);
  }
  node_driver_torso_92.userData.sculptComponent = { "id": "driver-torso", "name": "Driver torso", "level": "meso", "role": "body", "importance": 0.65, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.55, "height": 0.9, "depth": 0.44, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [1.55, 2.95, -0.25], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["caped navy greatcoat, one blocky mass"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_driver_torso_92.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_driver_torso_92);
  nodes["driver-torso"] = node_driver_torso_92;
  const mesh_driver_torso_92Geometry = endpoint_driver_torso_92 ? new THREE.CylinderGeometry(endpoint_driver_torso_92.endRadius, endpoint_driver_torso_92.baseRadius, endpoint_driver_torso_92.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_driver_torso_92) {
    mesh_driver_torso_92Geometry.scale(0.55, 0.9, 0.44);
  }
  const mesh_driver_torso_92 = new THREE.Mesh(
    mesh_driver_torso_92Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_torso_92.name = "Driver torso";
  if (endpoint_driver_torso_92) {
    mesh_driver_torso_92.position.copy(endpoint_driver_torso_92.midpoint);
    mesh_driver_torso_92.quaternion.copy(endpoint_driver_torso_92.quaternion);
  }
  mesh_driver_torso_92.castShadow = options.castShadow ?? true;
  mesh_driver_torso_92.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_torso_92.userData.sculptComponent = node_driver_torso_92.userData.sculptComponent;
  node_driver_torso_92.add(mesh_driver_torso_92);
  meshes["driver-torso"] = mesh_driver_torso_92;
  colliders["driver-torso"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_torso_92);
  const attachment_driver_scarf_93 = null;
  const endpoint_driver_scarf_93 = makeAttachmentEndpoint(attachment_driver_scarf_93);
  const node_driver_scarf_93 = new THREE.Group();
  node_driver_scarf_93.name = "Driver scarf__pivot";
  node_driver_scarf_93.scale.set(1, 1, 1);
  if (endpoint_driver_scarf_93) {
    node_driver_scarf_93.position.copy(endpoint_driver_scarf_93.start);
    node_driver_scarf_93.rotation.set(0, 0, 0);
  } else {
    node_driver_scarf_93.position.set(1.55, 3.38, -0.14);
    node_driver_scarf_93.rotation.set(0, 0, 0);
  }
  node_driver_scarf_93.userData.sculptComponent = { "id": "driver-scarf", "name": "Driver scarf", "level": "micro", "role": "body", "importance": 0.6, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.36, "height": 0.18, "depth": 0.32, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [1.55, 3.38, -0.14], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "accent-red" } }, "material": "accent-red", "materialLayers": ["accent-red"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["the plate's only saturated red accent"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(69, 9, 16, 1.0)", "secondaryAlbedo": "rgba(150, 51, 48, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #450910; reproduction albedo #963330; source: #450910" } };
  node_driver_scarf_93.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "accent-red" } };
  (nodes["root"] ?? root).add(node_driver_scarf_93);
  nodes["driver-scarf"] = node_driver_scarf_93;
  const mesh_driver_scarf_93Geometry = endpoint_driver_scarf_93 ? new THREE.CylinderGeometry(endpoint_driver_scarf_93.endRadius, endpoint_driver_scarf_93.baseRadius, endpoint_driver_scarf_93.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_driver_scarf_93) {
    mesh_driver_scarf_93Geometry.scale(0.36, 0.18, 0.32);
  }
  const mesh_driver_scarf_93 = new THREE.Mesh(
    mesh_driver_scarf_93Geometry,
    materialMap["accent-red"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_scarf_93.name = "Driver scarf";
  if (endpoint_driver_scarf_93) {
    mesh_driver_scarf_93.position.copy(endpoint_driver_scarf_93.midpoint);
    mesh_driver_scarf_93.quaternion.copy(endpoint_driver_scarf_93.quaternion);
  }
  mesh_driver_scarf_93.castShadow = options.castShadow ?? true;
  mesh_driver_scarf_93.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_scarf_93.userData.sculptComponent = node_driver_scarf_93.userData.sculptComponent;
  node_driver_scarf_93.add(mesh_driver_scarf_93);
  meshes["driver-scarf"] = mesh_driver_scarf_93;
  colliders["driver-scarf"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_scarf_93);
  const attachment_driver_head_94 = null;
  const endpoint_driver_head_94 = makeAttachmentEndpoint(attachment_driver_head_94);
  const node_driver_head_94 = new THREE.Group();
  node_driver_head_94.name = "Driver head__pivot";
  node_driver_head_94.scale.set(1, 1, 1);
  if (endpoint_driver_head_94) {
    node_driver_head_94.position.copy(endpoint_driver_head_94.start);
    node_driver_head_94.rotation.set(0, 0, 0);
  } else {
    node_driver_head_94.position.set(1.55, 3.58, -0.2);
    node_driver_head_94.rotation.set(0, 0, 0);
  }
  node_driver_head_94.userData.sculptComponent = { "id": "driver-head", "name": "Driver head", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.28, "height": 0.3, "depth": 0.28, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.65 }, "transform": { "position": [1.55, 3.58, -0.2], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } }, "material": "skin-tone", "materialLayers": ["skin-tone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.7, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(158, 106, 89, 1.0)", "secondaryAlbedo": "rgba(195, 154, 116, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #9e6a59; reproduction albedo #c39a74; source: #9e6a59 face" } };
  node_driver_head_94.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } };
  (nodes["root"] ?? root).add(node_driver_head_94);
  nodes["driver-head"] = node_driver_head_94;
  const mesh_driver_head_94Geometry = endpoint_driver_head_94 ? new THREE.CylinderGeometry(endpoint_driver_head_94.endRadius, endpoint_driver_head_94.baseRadius, endpoint_driver_head_94.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_driver_head_94) {
    mesh_driver_head_94Geometry.scale(0.28, 0.3, 0.28);
  }
  const mesh_driver_head_94 = new THREE.Mesh(
    mesh_driver_head_94Geometry,
    materialMap["skin-tone"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_head_94.name = "Driver head";
  if (endpoint_driver_head_94) {
    mesh_driver_head_94.position.copy(endpoint_driver_head_94.midpoint);
    mesh_driver_head_94.quaternion.copy(endpoint_driver_head_94.quaternion);
  }
  mesh_driver_head_94.castShadow = options.castShadow ?? true;
  mesh_driver_head_94.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_head_94.userData.sculptComponent = node_driver_head_94.userData.sculptComponent;
  node_driver_head_94.add(mesh_driver_head_94);
  meshes["driver-head"] = mesh_driver_head_94;
  colliders["driver-head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_head_94);
  const attachment_driver_hat_brim_95 = null;
  const endpoint_driver_hat_brim_95 = makeAttachmentEndpoint(attachment_driver_hat_brim_95);
  const node_driver_hat_brim_95 = new THREE.Group();
  node_driver_hat_brim_95.name = "Driver cap brim__pivot";
  node_driver_hat_brim_95.scale.set(1, 1, 1);
  if (endpoint_driver_hat_brim_95) {
    node_driver_hat_brim_95.position.copy(endpoint_driver_hat_brim_95.start);
    node_driver_hat_brim_95.rotation.set(0, 0, 0);
  } else {
    node_driver_hat_brim_95.position.set(1.55, 3.76, -0.19);
    node_driver_hat_brim_95.rotation.set(0, 0, 0);
  }
  node_driver_hat_brim_95.userData.sculptComponent = { "id": "driver-hat-brim", "name": "Driver cap brim", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.44, "height": 0.09, "depth": 0.42, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.65 }, "transform": { "position": [1.55, 3.76, -0.19], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["flat peaked cap"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_driver_hat_brim_95.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_driver_hat_brim_95);
  nodes["driver-hat-brim"] = node_driver_hat_brim_95;
  const mesh_driver_hat_brim_95Geometry = endpoint_driver_hat_brim_95 ? new THREE.CylinderGeometry(endpoint_driver_hat_brim_95.endRadius, endpoint_driver_hat_brim_95.baseRadius, endpoint_driver_hat_brim_95.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_driver_hat_brim_95) {
    mesh_driver_hat_brim_95Geometry.scale(0.44, 0.09, 0.42);
  }
  const mesh_driver_hat_brim_95 = new THREE.Mesh(
    mesh_driver_hat_brim_95Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_hat_brim_95.name = "Driver cap brim";
  if (endpoint_driver_hat_brim_95) {
    mesh_driver_hat_brim_95.position.copy(endpoint_driver_hat_brim_95.midpoint);
    mesh_driver_hat_brim_95.quaternion.copy(endpoint_driver_hat_brim_95.quaternion);
  }
  mesh_driver_hat_brim_95.castShadow = options.castShadow ?? true;
  mesh_driver_hat_brim_95.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_hat_brim_95.userData.sculptComponent = node_driver_hat_brim_95.userData.sculptComponent;
  node_driver_hat_brim_95.add(mesh_driver_hat_brim_95);
  meshes["driver-hat-brim"] = mesh_driver_hat_brim_95;
  colliders["driver-hat-brim"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_hat_brim_95);
  const attachment_driver_hat_crown_96 = null;
  const endpoint_driver_hat_crown_96 = makeAttachmentEndpoint(attachment_driver_hat_crown_96);
  const node_driver_hat_crown_96 = new THREE.Group();
  node_driver_hat_crown_96.name = "Driver cap crown__pivot";
  node_driver_hat_crown_96.scale.set(1, 1, 1);
  if (endpoint_driver_hat_crown_96) {
    node_driver_hat_crown_96.position.copy(endpoint_driver_hat_crown_96.start);
    node_driver_hat_crown_96.rotation.set(0, 0, 0);
  } else {
    node_driver_hat_crown_96.position.set(1.55, 3.85, -0.2);
    node_driver_hat_crown_96.rotation.set(0, 0, 0);
  }
  node_driver_hat_crown_96.userData.sculptComponent = { "id": "driver-hat-crown", "name": "Driver cap crown", "level": "micro", "role": "body", "importance": 0.45, "confidence": 0.65, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.34, "height": 0.14, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.65 }, "transform": { "position": [1.55, 3.85, -0.2], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_driver_hat_crown_96.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.65 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_driver_hat_crown_96);
  nodes["driver-hat-crown"] = node_driver_hat_crown_96;
  const mesh_driver_hat_crown_96Geometry = endpoint_driver_hat_crown_96 ? new THREE.CylinderGeometry(endpoint_driver_hat_crown_96.endRadius, endpoint_driver_hat_crown_96.baseRadius, endpoint_driver_hat_crown_96.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_driver_hat_crown_96) {
    mesh_driver_hat_crown_96Geometry.scale(0.34, 0.14, 0.34);
  }
  const mesh_driver_hat_crown_96 = new THREE.Mesh(
    mesh_driver_hat_crown_96Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_hat_crown_96.name = "Driver cap crown";
  if (endpoint_driver_hat_crown_96) {
    mesh_driver_hat_crown_96.position.copy(endpoint_driver_hat_crown_96.midpoint);
    mesh_driver_hat_crown_96.quaternion.copy(endpoint_driver_hat_crown_96.quaternion);
  }
  mesh_driver_hat_crown_96.castShadow = options.castShadow ?? true;
  mesh_driver_hat_crown_96.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_hat_crown_96.userData.sculptComponent = node_driver_hat_crown_96.userData.sculptComponent;
  node_driver_hat_crown_96.add(mesh_driver_hat_crown_96);
  meshes["driver-hat-crown"] = mesh_driver_hat_crown_96;
  colliders["driver-hat-crown"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_hat_crown_96);
  const attachment_driver_arm_near_97 = { "parentId": "root", "parentSocket": "root:driver-arm-near-mount", "localStart": [1.81, 3.2, -0.12], "localEnd": [1.67, 2.86, 0.42], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.07, "endRadius": 0.055, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_driver_arm_near_97 = makeAttachmentEndpoint(attachment_driver_arm_near_97);
  const node_driver_arm_near_97 = new THREE.Group();
  node_driver_arm_near_97.name = "Driver near arm__pivot";
  node_driver_arm_near_97.scale.set(1, 1, 1);
  if (endpoint_driver_arm_near_97) {
    node_driver_arm_near_97.position.copy(endpoint_driver_arm_near_97.start);
    node_driver_arm_near_97.rotation.set(0, 0, 0);
  } else {
    node_driver_arm_near_97.position.set(0, 0, 0);
    node_driver_arm_near_97.rotation.set(0, 0, 0);
  }
  node_driver_arm_near_97.userData.sculptComponent = { "id": "driver-arm-near", "name": "Driver near arm", "level": "micro", "role": "arm", "importance": 0.4, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:driver-arm-near-mount", "localStart": [1.81, 3.2, -0.12], "localEnd": [1.67, 2.86, 0.42], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.07, "endRadius": 0.055, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_driver_arm_near_97.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_driver_arm_near_97);
  nodes["driver-arm-near"] = node_driver_arm_near_97;
  const mesh_driver_arm_near_97Geometry = endpoint_driver_arm_near_97 ? new THREE.CylinderGeometry(endpoint_driver_arm_near_97.endRadius, endpoint_driver_arm_near_97.baseRadius, endpoint_driver_arm_near_97.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_driver_arm_near_97) {
    mesh_driver_arm_near_97Geometry.scale(1, 1, 1);
  }
  const mesh_driver_arm_near_97 = new THREE.Mesh(
    mesh_driver_arm_near_97Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_arm_near_97.name = "Driver near arm";
  if (endpoint_driver_arm_near_97) {
    mesh_driver_arm_near_97.position.copy(endpoint_driver_arm_near_97.midpoint);
    mesh_driver_arm_near_97.quaternion.copy(endpoint_driver_arm_near_97.quaternion);
  }
  mesh_driver_arm_near_97.castShadow = options.castShadow ?? true;
  mesh_driver_arm_near_97.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_arm_near_97.userData.sculptComponent = node_driver_arm_near_97.userData.sculptComponent;
  node_driver_arm_near_97.add(mesh_driver_arm_near_97);
  meshes["driver-arm-near"] = mesh_driver_arm_near_97;
  colliders["driver-arm-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_arm_near_97);
  const attachment_driver_arm_off_98 = { "parentId": "root", "parentSocket": "root:driver-arm-off-mount", "localStart": [1.29, 3.2, -0.12], "localEnd": [1.43, 2.86, 0.42], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.07, "endRadius": 0.055, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_driver_arm_off_98 = makeAttachmentEndpoint(attachment_driver_arm_off_98);
  const node_driver_arm_off_98 = new THREE.Group();
  node_driver_arm_off_98.name = "Driver off arm__pivot";
  node_driver_arm_off_98.scale.set(1, 1, 1);
  if (endpoint_driver_arm_off_98) {
    node_driver_arm_off_98.position.copy(endpoint_driver_arm_off_98.start);
    node_driver_arm_off_98.rotation.set(0, 0, 0);
  } else {
    node_driver_arm_off_98.position.set(0, 0, 0);
    node_driver_arm_off_98.rotation.set(0, 0, 0);
  }
  node_driver_arm_off_98.userData.sculptComponent = { "id": "driver-arm-off", "name": "Driver off arm", "level": "micro", "role": "arm", "importance": 0.35, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:driver-arm-off-mount", "localStart": [1.29, 3.2, -0.12], "localEnd": [1.43, 2.86, 0.42], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.07, "endRadius": 0.055, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_driver_arm_off_98.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "driver", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_driver_arm_off_98);
  nodes["driver-arm-off"] = node_driver_arm_off_98;
  const mesh_driver_arm_off_98Geometry = endpoint_driver_arm_off_98 ? new THREE.CylinderGeometry(endpoint_driver_arm_off_98.endRadius, endpoint_driver_arm_off_98.baseRadius, endpoint_driver_arm_off_98.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_driver_arm_off_98) {
    mesh_driver_arm_off_98Geometry.scale(1, 1, 1);
  }
  const mesh_driver_arm_off_98 = new THREE.Mesh(
    mesh_driver_arm_off_98Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_driver_arm_off_98.name = "Driver off arm";
  if (endpoint_driver_arm_off_98) {
    mesh_driver_arm_off_98.position.copy(endpoint_driver_arm_off_98.midpoint);
    mesh_driver_arm_off_98.quaternion.copy(endpoint_driver_arm_off_98.quaternion);
  }
  mesh_driver_arm_off_98.castShadow = options.castShadow ?? true;
  mesh_driver_arm_off_98.receiveShadow = options.receiveShadow ?? true;
  mesh_driver_arm_off_98.userData.sculptComponent = node_driver_arm_off_98.userData.sculptComponent;
  node_driver_arm_off_98.add(mesh_driver_arm_off_98);
  meshes["driver-arm-off"] = mesh_driver_arm_off_98;
  colliders["driver-arm-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["driver"] ?? (destructionGroups["driver"] = []);
  destructionGroups["driver"].push(node_driver_arm_off_98);
  const attachment_horse_a_barrel_99 = null;
  const endpoint_horse_a_barrel_99 = makeAttachmentEndpoint(attachment_horse_a_barrel_99);
  const node_horse_a_barrel_99 = new THREE.Group();
  node_horse_a_barrel_99.name = "horse-a barrel__pivot";
  node_horse_a_barrel_99.scale.set(1, 1, 1);
  if (endpoint_horse_a_barrel_99) {
    node_horse_a_barrel_99.position.copy(endpoint_horse_a_barrel_99.start);
    node_horse_a_barrel_99.rotation.set(0, 0, 0);
  } else {
    node_horse_a_barrel_99.position.set(0.55, 1.72, 2.3);
    node_horse_a_barrel_99.rotation.set(0, 0, 0);
  }
  node_horse_a_barrel_99.userData.sculptComponent = { "id": "horse-a-barrel", "name": "horse-a barrel", "level": "macro", "role": "body", "importance": 0.85, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.72, "height": 0.95, "depth": 2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0.55, 1.72, 2.3], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["boxy barrel with flat facet flanks"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_barrel_99.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_barrel_99);
  nodes["horse-a-barrel"] = node_horse_a_barrel_99;
  const mesh_horse_a_barrel_99Geometry = endpoint_horse_a_barrel_99 ? new THREE.CylinderGeometry(endpoint_horse_a_barrel_99.endRadius, endpoint_horse_a_barrel_99.baseRadius, endpoint_horse_a_barrel_99.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_barrel_99) {
    mesh_horse_a_barrel_99Geometry.scale(0.72, 0.95, 2);
  }
  const mesh_horse_a_barrel_99 = new THREE.Mesh(
    mesh_horse_a_barrel_99Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_barrel_99.name = "horse-a barrel";
  if (endpoint_horse_a_barrel_99) {
    mesh_horse_a_barrel_99.position.copy(endpoint_horse_a_barrel_99.midpoint);
    mesh_horse_a_barrel_99.quaternion.copy(endpoint_horse_a_barrel_99.quaternion);
  }
  mesh_horse_a_barrel_99.castShadow = options.castShadow ?? true;
  mesh_horse_a_barrel_99.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_barrel_99.userData.sculptComponent = node_horse_a_barrel_99.userData.sculptComponent;
  node_horse_a_barrel_99.add(mesh_horse_a_barrel_99);
  meshes["horse-a-barrel"] = mesh_horse_a_barrel_99;
  colliders["horse-a-barrel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_barrel_99);
  const attachment_horse_a_chest_100 = null;
  const endpoint_horse_a_chest_100 = makeAttachmentEndpoint(attachment_horse_a_chest_100);
  const node_horse_a_chest_100 = new THREE.Group();
  node_horse_a_chest_100.name = "horse-a chest__pivot";
  node_horse_a_chest_100.scale.set(1, 1, 1);
  if (endpoint_horse_a_chest_100) {
    node_horse_a_chest_100.position.copy(endpoint_horse_a_chest_100.start);
    node_horse_a_chest_100.rotation.set(0, 0, 0);
  } else {
    node_horse_a_chest_100.position.set(0.55, 1.65, 3.45);
    node_horse_a_chest_100.rotation.set(0, 0, 0);
  }
  node_horse_a_chest_100.userData.sculptComponent = { "id": "horse-a-chest", "name": "horse-a chest", "level": "meso", "role": "body", "importance": 0.75, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.68, "height": 0.85, "depth": 0.55, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [0.55, 1.65, 3.45], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_chest_100.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_chest_100);
  nodes["horse-a-chest"] = node_horse_a_chest_100;
  const mesh_horse_a_chest_100Geometry = endpoint_horse_a_chest_100 ? new THREE.CylinderGeometry(endpoint_horse_a_chest_100.endRadius, endpoint_horse_a_chest_100.baseRadius, endpoint_horse_a_chest_100.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_chest_100) {
    mesh_horse_a_chest_100Geometry.scale(0.68, 0.85, 0.55);
  }
  const mesh_horse_a_chest_100 = new THREE.Mesh(
    mesh_horse_a_chest_100Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_chest_100.name = "horse-a chest";
  if (endpoint_horse_a_chest_100) {
    mesh_horse_a_chest_100.position.copy(endpoint_horse_a_chest_100.midpoint);
    mesh_horse_a_chest_100.quaternion.copy(endpoint_horse_a_chest_100.quaternion);
  }
  mesh_horse_a_chest_100.castShadow = options.castShadow ?? true;
  mesh_horse_a_chest_100.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_chest_100.userData.sculptComponent = node_horse_a_chest_100.userData.sculptComponent;
  node_horse_a_chest_100.add(mesh_horse_a_chest_100);
  meshes["horse-a-chest"] = mesh_horse_a_chest_100;
  colliders["horse-a-chest"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_chest_100);
  const attachment_horse_a_neck_101 = { "parentId": "root", "parentSocket": "root:horse-a-neck-mount", "localStart": [0.55, 2.02, 3.5], "localEnd": [0.55, 2.72, 4.12], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.33, "endRadius": 0.24, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_a_neck_101 = makeAttachmentEndpoint(attachment_horse_a_neck_101);
  const node_horse_a_neck_101 = new THREE.Group();
  node_horse_a_neck_101.name = "horse-a neck__pivot";
  node_horse_a_neck_101.scale.set(1, 1, 1);
  if (endpoint_horse_a_neck_101) {
    node_horse_a_neck_101.position.copy(endpoint_horse_a_neck_101.start);
    node_horse_a_neck_101.rotation.set(0, 0, 0);
  } else {
    node_horse_a_neck_101.position.set(0, 0, 0);
    node_horse_a_neck_101.rotation.set(0, 0, 0);
  }
  node_horse_a_neck_101.userData.sculptComponent = { "id": "horse-a-neck", "name": "horse-a neck", "level": "meso", "role": "neck", "importance": 0.75, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-a-neck-mount", "localStart": [0.55, 2.02, 3.5], "localEnd": [0.55, 2.72, 4.12], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.33, "endRadius": 0.24, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["arched neck rising forward from the chest"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_neck_101.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_neck_101);
  nodes["horse-a-neck"] = node_horse_a_neck_101;
  const mesh_horse_a_neck_101Geometry = endpoint_horse_a_neck_101 ? new THREE.CylinderGeometry(endpoint_horse_a_neck_101.endRadius, endpoint_horse_a_neck_101.baseRadius, endpoint_horse_a_neck_101.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_a_neck_101) {
    mesh_horse_a_neck_101Geometry.scale(1, 1, 1);
  }
  const mesh_horse_a_neck_101 = new THREE.Mesh(
    mesh_horse_a_neck_101Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_neck_101.name = "horse-a neck";
  if (endpoint_horse_a_neck_101) {
    mesh_horse_a_neck_101.position.copy(endpoint_horse_a_neck_101.midpoint);
    mesh_horse_a_neck_101.quaternion.copy(endpoint_horse_a_neck_101.quaternion);
  }
  mesh_horse_a_neck_101.castShadow = options.castShadow ?? true;
  mesh_horse_a_neck_101.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_neck_101.userData.sculptComponent = node_horse_a_neck_101.userData.sculptComponent;
  node_horse_a_neck_101.add(mesh_horse_a_neck_101);
  meshes["horse-a-neck"] = mesh_horse_a_neck_101;
  colliders["horse-a-neck"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_neck_101);
  const attachment_horse_a_head_102 = null;
  const endpoint_horse_a_head_102 = makeAttachmentEndpoint(attachment_horse_a_head_102);
  const node_horse_a_head_102 = new THREE.Group();
  node_horse_a_head_102.name = "horse-a head__pivot";
  node_horse_a_head_102.scale.set(1, 1, 1);
  if (endpoint_horse_a_head_102) {
    node_horse_a_head_102.position.copy(endpoint_horse_a_head_102.start);
    node_horse_a_head_102.rotation.set(-0.42, 0, 0);
  } else {
    node_horse_a_head_102.position.set(0.55, 2.78, 4.36);
    node_horse_a_head_102.rotation.set(-0.42, 0, 0);
  }
  node_horse_a_head_102.userData.sculptComponent = { "id": "horse-a-head", "name": "horse-a head", "level": "meso", "role": "body", "importance": 0.7999999999999999, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.3, "height": 0.4, "depth": 0.72, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [0.55, 2.78, 4.36], "rotation": [-0.42, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["wedge head angled nose-down"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_head_102.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_head_102);
  nodes["horse-a-head"] = node_horse_a_head_102;
  const mesh_horse_a_head_102Geometry = endpoint_horse_a_head_102 ? new THREE.CylinderGeometry(endpoint_horse_a_head_102.endRadius, endpoint_horse_a_head_102.baseRadius, endpoint_horse_a_head_102.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_head_102) {
    mesh_horse_a_head_102Geometry.scale(0.3, 0.4, 0.72);
  }
  const mesh_horse_a_head_102 = new THREE.Mesh(
    mesh_horse_a_head_102Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_head_102.name = "horse-a head";
  if (endpoint_horse_a_head_102) {
    mesh_horse_a_head_102.position.copy(endpoint_horse_a_head_102.midpoint);
    mesh_horse_a_head_102.quaternion.copy(endpoint_horse_a_head_102.quaternion);
  }
  mesh_horse_a_head_102.castShadow = options.castShadow ?? true;
  mesh_horse_a_head_102.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_head_102.userData.sculptComponent = node_horse_a_head_102.userData.sculptComponent;
  node_horse_a_head_102.add(mesh_horse_a_head_102);
  meshes["horse-a-head"] = mesh_horse_a_head_102;
  colliders["horse-a-head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_head_102);
  const attachment_horse_a_muzzle_103 = null;
  const endpoint_horse_a_muzzle_103 = makeAttachmentEndpoint(attachment_horse_a_muzzle_103);
  const node_horse_a_muzzle_103 = new THREE.Group();
  node_horse_a_muzzle_103.name = "horse-a muzzle__pivot";
  node_horse_a_muzzle_103.scale.set(1, 1, 1);
  if (endpoint_horse_a_muzzle_103) {
    node_horse_a_muzzle_103.position.copy(endpoint_horse_a_muzzle_103.start);
    node_horse_a_muzzle_103.rotation.set(0, 0, 0);
  } else {
    node_horse_a_muzzle_103.position.set(0.55, 2.5, 4.72);
    node_horse_a_muzzle_103.rotation.set(0, 0, 0);
  }
  node_horse_a_muzzle_103.userData.sculptComponent = { "id": "horse-a-muzzle", "name": "horse-a muzzle", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.27, "height": 0.26, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [0.55, 2.5, 4.72], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_muzzle_103.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_muzzle_103);
  nodes["horse-a-muzzle"] = node_horse_a_muzzle_103;
  const mesh_horse_a_muzzle_103Geometry = endpoint_horse_a_muzzle_103 ? new THREE.CylinderGeometry(endpoint_horse_a_muzzle_103.endRadius, endpoint_horse_a_muzzle_103.baseRadius, endpoint_horse_a_muzzle_103.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_muzzle_103) {
    mesh_horse_a_muzzle_103Geometry.scale(0.27, 0.26, 0.34);
  }
  const mesh_horse_a_muzzle_103 = new THREE.Mesh(
    mesh_horse_a_muzzle_103Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_muzzle_103.name = "horse-a muzzle";
  if (endpoint_horse_a_muzzle_103) {
    mesh_horse_a_muzzle_103.position.copy(endpoint_horse_a_muzzle_103.midpoint);
    mesh_horse_a_muzzle_103.quaternion.copy(endpoint_horse_a_muzzle_103.quaternion);
  }
  mesh_horse_a_muzzle_103.castShadow = options.castShadow ?? true;
  mesh_horse_a_muzzle_103.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_muzzle_103.userData.sculptComponent = node_horse_a_muzzle_103.userData.sculptComponent;
  node_horse_a_muzzle_103.add(mesh_horse_a_muzzle_103);
  meshes["horse-a-muzzle"] = mesh_horse_a_muzzle_103;
  colliders["horse-a-muzzle"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_muzzle_103);
  const attachment_horse_a_collar_104 = null;
  const endpoint_horse_a_collar_104 = makeAttachmentEndpoint(attachment_horse_a_collar_104);
  const node_horse_a_collar_104 = new THREE.Group();
  node_horse_a_collar_104.name = "horse-a harness collar__pivot";
  node_horse_a_collar_104.scale.set(1, 1, 1);
  if (endpoint_horse_a_collar_104) {
    node_horse_a_collar_104.position.copy(endpoint_horse_a_collar_104.start);
    node_horse_a_collar_104.rotation.set(0, 0, 0);
  } else {
    node_horse_a_collar_104.position.set(0.55, 2.05, 3.63);
    node_horse_a_collar_104.rotation.set(0, 0, 0);
  }
  node_horse_a_collar_104.userData.sculptComponent = { "id": "horse-a-collar", "name": "horse-a harness collar", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.8, "height": 0.62, "depth": 0.22, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [0.55, 2.05, 3.63], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["dark leather collar and blinker straps"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_horse_a_collar_104.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_horse_a_collar_104);
  nodes["horse-a-collar"] = node_horse_a_collar_104;
  const mesh_horse_a_collar_104Geometry = endpoint_horse_a_collar_104 ? new THREE.CylinderGeometry(endpoint_horse_a_collar_104.endRadius, endpoint_horse_a_collar_104.baseRadius, endpoint_horse_a_collar_104.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_collar_104) {
    mesh_horse_a_collar_104Geometry.scale(0.8, 0.62, 0.22);
  }
  const mesh_horse_a_collar_104 = new THREE.Mesh(
    mesh_horse_a_collar_104Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_collar_104.name = "horse-a harness collar";
  if (endpoint_horse_a_collar_104) {
    mesh_horse_a_collar_104.position.copy(endpoint_horse_a_collar_104.midpoint);
    mesh_horse_a_collar_104.quaternion.copy(endpoint_horse_a_collar_104.quaternion);
  }
  mesh_horse_a_collar_104.castShadow = options.castShadow ?? true;
  mesh_horse_a_collar_104.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_collar_104.userData.sculptComponent = node_horse_a_collar_104.userData.sculptComponent;
  node_horse_a_collar_104.add(mesh_horse_a_collar_104);
  meshes["horse-a-collar"] = mesh_horse_a_collar_104;
  colliders["horse-a-collar"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_collar_104);
  const attachment_horse_a_leg_fore_near_105 = { "parentId": "root", "parentSocket": "root:horse-a-leg-fore-near-mount", "localStart": [0.79, 1.3, 3.15], "localEnd": [0.79, 0.16, 3.15], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_a_leg_fore_near_105 = makeAttachmentEndpoint(attachment_horse_a_leg_fore_near_105);
  const node_horse_a_leg_fore_near_105 = new THREE.Group();
  node_horse_a_leg_fore_near_105.name = "horse-a fore-near leg__pivot";
  node_horse_a_leg_fore_near_105.scale.set(1, 1, 1);
  if (endpoint_horse_a_leg_fore_near_105) {
    node_horse_a_leg_fore_near_105.position.copy(endpoint_horse_a_leg_fore_near_105.start);
    node_horse_a_leg_fore_near_105.rotation.set(0, 0, 0);
  } else {
    node_horse_a_leg_fore_near_105.position.set(0, 0, 0);
    node_horse_a_leg_fore_near_105.rotation.set(0, 0, 0);
  }
  node_horse_a_leg_fore_near_105.userData.sculptComponent = { "id": "horse-a-leg-fore-near", "name": "horse-a fore-near leg", "level": "meso", "role": "leg", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-a-leg-fore-near-mount", "localStart": [0.79, 1.3, 3.15], "localEnd": [0.79, 0.16, 3.15], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["straight blocky leg, no fetlock detail at this scale"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_leg_fore_near_105.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_leg_fore_near_105);
  nodes["horse-a-leg-fore-near"] = node_horse_a_leg_fore_near_105;
  const mesh_horse_a_leg_fore_near_105Geometry = endpoint_horse_a_leg_fore_near_105 ? new THREE.CylinderGeometry(endpoint_horse_a_leg_fore_near_105.endRadius, endpoint_horse_a_leg_fore_near_105.baseRadius, endpoint_horse_a_leg_fore_near_105.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_a_leg_fore_near_105) {
    mesh_horse_a_leg_fore_near_105Geometry.scale(1, 1, 1);
  }
  const mesh_horse_a_leg_fore_near_105 = new THREE.Mesh(
    mesh_horse_a_leg_fore_near_105Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_leg_fore_near_105.name = "horse-a fore-near leg";
  if (endpoint_horse_a_leg_fore_near_105) {
    mesh_horse_a_leg_fore_near_105.position.copy(endpoint_horse_a_leg_fore_near_105.midpoint);
    mesh_horse_a_leg_fore_near_105.quaternion.copy(endpoint_horse_a_leg_fore_near_105.quaternion);
  }
  mesh_horse_a_leg_fore_near_105.castShadow = options.castShadow ?? true;
  mesh_horse_a_leg_fore_near_105.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_leg_fore_near_105.userData.sculptComponent = node_horse_a_leg_fore_near_105.userData.sculptComponent;
  node_horse_a_leg_fore_near_105.add(mesh_horse_a_leg_fore_near_105);
  meshes["horse-a-leg-fore-near"] = mesh_horse_a_leg_fore_near_105;
  colliders["horse-a-leg-fore-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_leg_fore_near_105);
  const attachment_horse_a_leg_fore_off_106 = { "parentId": "root", "parentSocket": "root:horse-a-leg-fore-off-mount", "localStart": [0.31, 1.3, 3.15], "localEnd": [0.31, 0.16, 3.15], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_a_leg_fore_off_106 = makeAttachmentEndpoint(attachment_horse_a_leg_fore_off_106);
  const node_horse_a_leg_fore_off_106 = new THREE.Group();
  node_horse_a_leg_fore_off_106.name = "horse-a fore-off leg__pivot";
  node_horse_a_leg_fore_off_106.scale.set(1, 1, 1);
  if (endpoint_horse_a_leg_fore_off_106) {
    node_horse_a_leg_fore_off_106.position.copy(endpoint_horse_a_leg_fore_off_106.start);
    node_horse_a_leg_fore_off_106.rotation.set(0, 0, 0);
  } else {
    node_horse_a_leg_fore_off_106.position.set(0, 0, 0);
    node_horse_a_leg_fore_off_106.rotation.set(0, 0, 0);
  }
  node_horse_a_leg_fore_off_106.userData.sculptComponent = { "id": "horse-a-leg-fore-off", "name": "horse-a fore-off leg", "level": "meso", "role": "leg", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-a-leg-fore-off-mount", "localStart": [0.31, 1.3, 3.15], "localEnd": [0.31, 0.16, 3.15], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["straight blocky leg, no fetlock detail at this scale"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_leg_fore_off_106.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_leg_fore_off_106);
  nodes["horse-a-leg-fore-off"] = node_horse_a_leg_fore_off_106;
  const mesh_horse_a_leg_fore_off_106Geometry = endpoint_horse_a_leg_fore_off_106 ? new THREE.CylinderGeometry(endpoint_horse_a_leg_fore_off_106.endRadius, endpoint_horse_a_leg_fore_off_106.baseRadius, endpoint_horse_a_leg_fore_off_106.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_a_leg_fore_off_106) {
    mesh_horse_a_leg_fore_off_106Geometry.scale(1, 1, 1);
  }
  const mesh_horse_a_leg_fore_off_106 = new THREE.Mesh(
    mesh_horse_a_leg_fore_off_106Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_leg_fore_off_106.name = "horse-a fore-off leg";
  if (endpoint_horse_a_leg_fore_off_106) {
    mesh_horse_a_leg_fore_off_106.position.copy(endpoint_horse_a_leg_fore_off_106.midpoint);
    mesh_horse_a_leg_fore_off_106.quaternion.copy(endpoint_horse_a_leg_fore_off_106.quaternion);
  }
  mesh_horse_a_leg_fore_off_106.castShadow = options.castShadow ?? true;
  mesh_horse_a_leg_fore_off_106.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_leg_fore_off_106.userData.sculptComponent = node_horse_a_leg_fore_off_106.userData.sculptComponent;
  node_horse_a_leg_fore_off_106.add(mesh_horse_a_leg_fore_off_106);
  meshes["horse-a-leg-fore-off"] = mesh_horse_a_leg_fore_off_106;
  colliders["horse-a-leg-fore-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_leg_fore_off_106);
  const attachment_horse_a_leg_hind_near_107 = { "parentId": "root", "parentSocket": "root:horse-a-leg-hind-near-mount", "localStart": [0.79, 1.3, 1.5], "localEnd": [0.79, 0.16, 1.5], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_a_leg_hind_near_107 = makeAttachmentEndpoint(attachment_horse_a_leg_hind_near_107);
  const node_horse_a_leg_hind_near_107 = new THREE.Group();
  node_horse_a_leg_hind_near_107.name = "horse-a hind-near leg__pivot";
  node_horse_a_leg_hind_near_107.scale.set(1, 1, 1);
  if (endpoint_horse_a_leg_hind_near_107) {
    node_horse_a_leg_hind_near_107.position.copy(endpoint_horse_a_leg_hind_near_107.start);
    node_horse_a_leg_hind_near_107.rotation.set(0, 0, 0);
  } else {
    node_horse_a_leg_hind_near_107.position.set(0, 0, 0);
    node_horse_a_leg_hind_near_107.rotation.set(0, 0, 0);
  }
  node_horse_a_leg_hind_near_107.userData.sculptComponent = { "id": "horse-a-leg-hind-near", "name": "horse-a hind-near leg", "level": "meso", "role": "leg", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-a-leg-hind-near-mount", "localStart": [0.79, 1.3, 1.5], "localEnd": [0.79, 0.16, 1.5], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["straight blocky leg, no fetlock detail at this scale"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_leg_hind_near_107.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_leg_hind_near_107);
  nodes["horse-a-leg-hind-near"] = node_horse_a_leg_hind_near_107;
  const mesh_horse_a_leg_hind_near_107Geometry = endpoint_horse_a_leg_hind_near_107 ? new THREE.CylinderGeometry(endpoint_horse_a_leg_hind_near_107.endRadius, endpoint_horse_a_leg_hind_near_107.baseRadius, endpoint_horse_a_leg_hind_near_107.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_a_leg_hind_near_107) {
    mesh_horse_a_leg_hind_near_107Geometry.scale(1, 1, 1);
  }
  const mesh_horse_a_leg_hind_near_107 = new THREE.Mesh(
    mesh_horse_a_leg_hind_near_107Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_leg_hind_near_107.name = "horse-a hind-near leg";
  if (endpoint_horse_a_leg_hind_near_107) {
    mesh_horse_a_leg_hind_near_107.position.copy(endpoint_horse_a_leg_hind_near_107.midpoint);
    mesh_horse_a_leg_hind_near_107.quaternion.copy(endpoint_horse_a_leg_hind_near_107.quaternion);
  }
  mesh_horse_a_leg_hind_near_107.castShadow = options.castShadow ?? true;
  mesh_horse_a_leg_hind_near_107.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_leg_hind_near_107.userData.sculptComponent = node_horse_a_leg_hind_near_107.userData.sculptComponent;
  node_horse_a_leg_hind_near_107.add(mesh_horse_a_leg_hind_near_107);
  meshes["horse-a-leg-hind-near"] = mesh_horse_a_leg_hind_near_107;
  colliders["horse-a-leg-hind-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_leg_hind_near_107);
  const attachment_horse_a_leg_hind_off_108 = { "parentId": "root", "parentSocket": "root:horse-a-leg-hind-off-mount", "localStart": [0.31, 1.3, 1.5], "localEnd": [0.31, 0.16, 1.5], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_a_leg_hind_off_108 = makeAttachmentEndpoint(attachment_horse_a_leg_hind_off_108);
  const node_horse_a_leg_hind_off_108 = new THREE.Group();
  node_horse_a_leg_hind_off_108.name = "horse-a hind-off leg__pivot";
  node_horse_a_leg_hind_off_108.scale.set(1, 1, 1);
  if (endpoint_horse_a_leg_hind_off_108) {
    node_horse_a_leg_hind_off_108.position.copy(endpoint_horse_a_leg_hind_off_108.start);
    node_horse_a_leg_hind_off_108.rotation.set(0, 0, 0);
  } else {
    node_horse_a_leg_hind_off_108.position.set(0, 0, 0);
    node_horse_a_leg_hind_off_108.rotation.set(0, 0, 0);
  }
  node_horse_a_leg_hind_off_108.userData.sculptComponent = { "id": "horse-a-leg-hind-off", "name": "horse-a hind-off leg", "level": "meso", "role": "leg", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-a-leg-hind-off-mount", "localStart": [0.31, 1.3, 1.5], "localEnd": [0.31, 0.16, 1.5], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["straight blocky leg, no fetlock detail at this scale"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_leg_hind_off_108.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_leg_hind_off_108);
  nodes["horse-a-leg-hind-off"] = node_horse_a_leg_hind_off_108;
  const mesh_horse_a_leg_hind_off_108Geometry = endpoint_horse_a_leg_hind_off_108 ? new THREE.CylinderGeometry(endpoint_horse_a_leg_hind_off_108.endRadius, endpoint_horse_a_leg_hind_off_108.baseRadius, endpoint_horse_a_leg_hind_off_108.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_a_leg_hind_off_108) {
    mesh_horse_a_leg_hind_off_108Geometry.scale(1, 1, 1);
  }
  const mesh_horse_a_leg_hind_off_108 = new THREE.Mesh(
    mesh_horse_a_leg_hind_off_108Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_leg_hind_off_108.name = "horse-a hind-off leg";
  if (endpoint_horse_a_leg_hind_off_108) {
    mesh_horse_a_leg_hind_off_108.position.copy(endpoint_horse_a_leg_hind_off_108.midpoint);
    mesh_horse_a_leg_hind_off_108.quaternion.copy(endpoint_horse_a_leg_hind_off_108.quaternion);
  }
  mesh_horse_a_leg_hind_off_108.castShadow = options.castShadow ?? true;
  mesh_horse_a_leg_hind_off_108.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_leg_hind_off_108.userData.sculptComponent = node_horse_a_leg_hind_off_108.userData.sculptComponent;
  node_horse_a_leg_hind_off_108.add(mesh_horse_a_leg_hind_off_108);
  meshes["horse-a-leg-hind-off"] = mesh_horse_a_leg_hind_off_108;
  colliders["horse-a-leg-hind-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_leg_hind_off_108);
  const attachment_horse_a_tail_109 = { "parentId": "root", "parentSocket": "root:horse-a-tail-mount", "localStart": [0.55, 2, 1.08], "localEnd": [0.55, 1.15, 0.82], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.1, "endRadius": 0.05, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_a_tail_109 = makeAttachmentEndpoint(attachment_horse_a_tail_109);
  const node_horse_a_tail_109 = new THREE.Group();
  node_horse_a_tail_109.name = "horse-a tail__pivot";
  node_horse_a_tail_109.scale.set(1, 1, 1);
  if (endpoint_horse_a_tail_109) {
    node_horse_a_tail_109.position.copy(endpoint_horse_a_tail_109.start);
    node_horse_a_tail_109.rotation.set(0, 0, 0);
  } else {
    node_horse_a_tail_109.position.set(0, 0, 0);
    node_horse_a_tail_109.rotation.set(0, 0, 0);
  }
  node_horse_a_tail_109.userData.sculptComponent = { "id": "horse-a-tail", "name": "horse-a tail", "level": "micro", "role": "tail", "importance": 0.35, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-a-tail-mount", "localStart": [0.55, 2, 1.08], "localEnd": [0.55, 1.15, 0.82], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.1, "endRadius": 0.05, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_tail_109.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_tail_109);
  nodes["horse-a-tail"] = node_horse_a_tail_109;
  const mesh_horse_a_tail_109Geometry = endpoint_horse_a_tail_109 ? new THREE.CylinderGeometry(endpoint_horse_a_tail_109.endRadius, endpoint_horse_a_tail_109.baseRadius, endpoint_horse_a_tail_109.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_a_tail_109) {
    mesh_horse_a_tail_109Geometry.scale(1, 1, 1);
  }
  const mesh_horse_a_tail_109 = new THREE.Mesh(
    mesh_horse_a_tail_109Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_tail_109.name = "horse-a tail";
  if (endpoint_horse_a_tail_109) {
    mesh_horse_a_tail_109.position.copy(endpoint_horse_a_tail_109.midpoint);
    mesh_horse_a_tail_109.quaternion.copy(endpoint_horse_a_tail_109.quaternion);
  }
  mesh_horse_a_tail_109.castShadow = options.castShadow ?? true;
  mesh_horse_a_tail_109.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_tail_109.userData.sculptComponent = node_horse_a_tail_109.userData.sculptComponent;
  node_horse_a_tail_109.add(mesh_horse_a_tail_109);
  meshes["horse-a-tail"] = mesh_horse_a_tail_109;
  colliders["horse-a-tail"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_tail_109);
  const attachment_horse_a_ear_near_110 = null;
  const endpoint_horse_a_ear_near_110 = makeAttachmentEndpoint(attachment_horse_a_ear_near_110);
  const node_horse_a_ear_near_110 = new THREE.Group();
  node_horse_a_ear_near_110.name = "horse-a near ear__pivot";
  node_horse_a_ear_near_110.scale.set(1, 1, 1);
  if (endpoint_horse_a_ear_near_110) {
    node_horse_a_ear_near_110.position.copy(endpoint_horse_a_ear_near_110.start);
    node_horse_a_ear_near_110.rotation.set(0, 0, 0);
  } else {
    node_horse_a_ear_near_110.position.set(0.64, 3.02, 4.26);
    node_horse_a_ear_near_110.rotation.set(0, 0, 0);
  }
  node_horse_a_ear_near_110.userData.sculptComponent = { "id": "horse-a-ear-near", "name": "horse-a near ear", "level": "micro", "role": "body", "importance": 0.3, "confidence": 0.55, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.08, "height": 0.2, "depth": 0.08, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.55 }, "transform": { "position": [0.64, 3.02, 4.26], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_ear_near_110.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_ear_near_110);
  nodes["horse-a-ear-near"] = node_horse_a_ear_near_110;
  const mesh_horse_a_ear_near_110Geometry = endpoint_horse_a_ear_near_110 ? new THREE.CylinderGeometry(endpoint_horse_a_ear_near_110.endRadius, endpoint_horse_a_ear_near_110.baseRadius, endpoint_horse_a_ear_near_110.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_ear_near_110) {
    mesh_horse_a_ear_near_110Geometry.scale(0.08, 0.2, 0.08);
  }
  const mesh_horse_a_ear_near_110 = new THREE.Mesh(
    mesh_horse_a_ear_near_110Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_ear_near_110.name = "horse-a near ear";
  if (endpoint_horse_a_ear_near_110) {
    mesh_horse_a_ear_near_110.position.copy(endpoint_horse_a_ear_near_110.midpoint);
    mesh_horse_a_ear_near_110.quaternion.copy(endpoint_horse_a_ear_near_110.quaternion);
  }
  mesh_horse_a_ear_near_110.castShadow = options.castShadow ?? true;
  mesh_horse_a_ear_near_110.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_ear_near_110.userData.sculptComponent = node_horse_a_ear_near_110.userData.sculptComponent;
  node_horse_a_ear_near_110.add(mesh_horse_a_ear_near_110);
  meshes["horse-a-ear-near"] = mesh_horse_a_ear_near_110;
  colliders["horse-a-ear-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_ear_near_110);
  const attachment_horse_a_ear_off_111 = null;
  const endpoint_horse_a_ear_off_111 = makeAttachmentEndpoint(attachment_horse_a_ear_off_111);
  const node_horse_a_ear_off_111 = new THREE.Group();
  node_horse_a_ear_off_111.name = "horse-a off ear__pivot";
  node_horse_a_ear_off_111.scale.set(1, 1, 1);
  if (endpoint_horse_a_ear_off_111) {
    node_horse_a_ear_off_111.position.copy(endpoint_horse_a_ear_off_111.start);
    node_horse_a_ear_off_111.rotation.set(0, 0, 0);
  } else {
    node_horse_a_ear_off_111.position.set(0.46, 3.02, 4.26);
    node_horse_a_ear_off_111.rotation.set(0, 0, 0);
  }
  node_horse_a_ear_off_111.userData.sculptComponent = { "id": "horse-a-ear-off", "name": "horse-a off ear", "level": "micro", "role": "body", "importance": 0.3, "confidence": 0.55, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.08, "height": 0.2, "depth": 0.08, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.55 }, "transform": { "position": [0.46, 3.02, 4.26], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } }, "material": "horse-dark", "materialLayers": ["horse-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(78, 73, 92, 1.0)", "secondaryAlbedo": "rgba(122, 95, 72, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #4e495c; reproduction albedo #7a5f48; source: #4e495c barrel under night light" } };
  node_horse_a_ear_off_111.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-dark" } };
  (nodes["root"] ?? root).add(node_horse_a_ear_off_111);
  nodes["horse-a-ear-off"] = node_horse_a_ear_off_111;
  const mesh_horse_a_ear_off_111Geometry = endpoint_horse_a_ear_off_111 ? new THREE.CylinderGeometry(endpoint_horse_a_ear_off_111.endRadius, endpoint_horse_a_ear_off_111.baseRadius, endpoint_horse_a_ear_off_111.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_a_ear_off_111) {
    mesh_horse_a_ear_off_111Geometry.scale(0.08, 0.2, 0.08);
  }
  const mesh_horse_a_ear_off_111 = new THREE.Mesh(
    mesh_horse_a_ear_off_111Geometry,
    materialMap["horse-dark"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_a_ear_off_111.name = "horse-a off ear";
  if (endpoint_horse_a_ear_off_111) {
    mesh_horse_a_ear_off_111.position.copy(endpoint_horse_a_ear_off_111.midpoint);
    mesh_horse_a_ear_off_111.quaternion.copy(endpoint_horse_a_ear_off_111.quaternion);
  }
  mesh_horse_a_ear_off_111.castShadow = options.castShadow ?? true;
  mesh_horse_a_ear_off_111.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_a_ear_off_111.userData.sculptComponent = node_horse_a_ear_off_111.userData.sculptComponent;
  node_horse_a_ear_off_111.add(mesh_horse_a_ear_off_111);
  meshes["horse-a-ear-off"] = mesh_horse_a_ear_off_111;
  colliders["horse-a-ear-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_a_ear_off_111);
  const attachment_horse_b_barrel_112 = null;
  const endpoint_horse_b_barrel_112 = makeAttachmentEndpoint(attachment_horse_b_barrel_112);
  const node_horse_b_barrel_112 = new THREE.Group();
  node_horse_b_barrel_112.name = "horse-b barrel__pivot";
  node_horse_b_barrel_112.scale.set(1, 1, 1);
  if (endpoint_horse_b_barrel_112) {
    node_horse_b_barrel_112.position.copy(endpoint_horse_b_barrel_112.start);
    node_horse_b_barrel_112.rotation.set(0, 0, 0);
  } else {
    node_horse_b_barrel_112.position.set(1.9, 1.72, 2);
    node_horse_b_barrel_112.rotation.set(0, 0, 0);
  }
  node_horse_b_barrel_112.userData.sculptComponent = { "id": "horse-b-barrel", "name": "horse-b barrel", "level": "macro", "role": "body", "importance": 0.6, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.72, "height": 0.95, "depth": 2, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [1.9, 1.72, 2], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["boxy barrel with flat facet flanks"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_barrel_112.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_barrel_112);
  nodes["horse-b-barrel"] = node_horse_b_barrel_112;
  const mesh_horse_b_barrel_112Geometry = endpoint_horse_b_barrel_112 ? new THREE.CylinderGeometry(endpoint_horse_b_barrel_112.endRadius, endpoint_horse_b_barrel_112.baseRadius, endpoint_horse_b_barrel_112.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_b_barrel_112) {
    mesh_horse_b_barrel_112Geometry.scale(0.72, 0.95, 2);
  }
  const mesh_horse_b_barrel_112 = new THREE.Mesh(
    mesh_horse_b_barrel_112Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_barrel_112.name = "horse-b barrel";
  if (endpoint_horse_b_barrel_112) {
    mesh_horse_b_barrel_112.position.copy(endpoint_horse_b_barrel_112.midpoint);
    mesh_horse_b_barrel_112.quaternion.copy(endpoint_horse_b_barrel_112.quaternion);
  }
  mesh_horse_b_barrel_112.castShadow = options.castShadow ?? true;
  mesh_horse_b_barrel_112.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_barrel_112.userData.sculptComponent = node_horse_b_barrel_112.userData.sculptComponent;
  node_horse_b_barrel_112.add(mesh_horse_b_barrel_112);
  meshes["horse-b-barrel"] = mesh_horse_b_barrel_112;
  colliders["horse-b-barrel"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_barrel_112);
  const attachment_horse_b_chest_113 = null;
  const endpoint_horse_b_chest_113 = makeAttachmentEndpoint(attachment_horse_b_chest_113);
  const node_horse_b_chest_113 = new THREE.Group();
  node_horse_b_chest_113.name = "horse-b chest__pivot";
  node_horse_b_chest_113.scale.set(1, 1, 1);
  if (endpoint_horse_b_chest_113) {
    node_horse_b_chest_113.position.copy(endpoint_horse_b_chest_113.start);
    node_horse_b_chest_113.rotation.set(0, 0, 0);
  } else {
    node_horse_b_chest_113.position.set(1.9, 1.65, 3.15);
    node_horse_b_chest_113.rotation.set(0, 0, 0);
  }
  node_horse_b_chest_113.userData.sculptComponent = { "id": "horse-b-chest", "name": "horse-b chest", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.68, "height": 0.85, "depth": 0.55, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [1.9, 1.65, 3.15], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_chest_113.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_chest_113);
  nodes["horse-b-chest"] = node_horse_b_chest_113;
  const mesh_horse_b_chest_113Geometry = endpoint_horse_b_chest_113 ? new THREE.CylinderGeometry(endpoint_horse_b_chest_113.endRadius, endpoint_horse_b_chest_113.baseRadius, endpoint_horse_b_chest_113.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_b_chest_113) {
    mesh_horse_b_chest_113Geometry.scale(0.68, 0.85, 0.55);
  }
  const mesh_horse_b_chest_113 = new THREE.Mesh(
    mesh_horse_b_chest_113Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_chest_113.name = "horse-b chest";
  if (endpoint_horse_b_chest_113) {
    mesh_horse_b_chest_113.position.copy(endpoint_horse_b_chest_113.midpoint);
    mesh_horse_b_chest_113.quaternion.copy(endpoint_horse_b_chest_113.quaternion);
  }
  mesh_horse_b_chest_113.castShadow = options.castShadow ?? true;
  mesh_horse_b_chest_113.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_chest_113.userData.sculptComponent = node_horse_b_chest_113.userData.sculptComponent;
  node_horse_b_chest_113.add(mesh_horse_b_chest_113);
  meshes["horse-b-chest"] = mesh_horse_b_chest_113;
  colliders["horse-b-chest"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_chest_113);
  const attachment_horse_b_neck_114 = { "parentId": "root", "parentSocket": "root:horse-b-neck-mount", "localStart": [1.9, 2.02, 3.2], "localEnd": [1.9, 2.72, 3.82], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.33, "endRadius": 0.24, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_b_neck_114 = makeAttachmentEndpoint(attachment_horse_b_neck_114);
  const node_horse_b_neck_114 = new THREE.Group();
  node_horse_b_neck_114.name = "horse-b neck__pivot";
  node_horse_b_neck_114.scale.set(1, 1, 1);
  if (endpoint_horse_b_neck_114) {
    node_horse_b_neck_114.position.copy(endpoint_horse_b_neck_114.start);
    node_horse_b_neck_114.rotation.set(0, 0, 0);
  } else {
    node_horse_b_neck_114.position.set(0, 0, 0);
    node_horse_b_neck_114.rotation.set(0, 0, 0);
  }
  node_horse_b_neck_114.userData.sculptComponent = { "id": "horse-b-neck", "name": "horse-b neck", "level": "meso", "role": "neck", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-b-neck-mount", "localStart": [1.9, 2.02, 3.2], "localEnd": [1.9, 2.72, 3.82], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.33, "endRadius": 0.24, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["arched neck rising forward from the chest"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_neck_114.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_neck_114);
  nodes["horse-b-neck"] = node_horse_b_neck_114;
  const mesh_horse_b_neck_114Geometry = endpoint_horse_b_neck_114 ? new THREE.CylinderGeometry(endpoint_horse_b_neck_114.endRadius, endpoint_horse_b_neck_114.baseRadius, endpoint_horse_b_neck_114.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_b_neck_114) {
    mesh_horse_b_neck_114Geometry.scale(1, 1, 1);
  }
  const mesh_horse_b_neck_114 = new THREE.Mesh(
    mesh_horse_b_neck_114Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_neck_114.name = "horse-b neck";
  if (endpoint_horse_b_neck_114) {
    mesh_horse_b_neck_114.position.copy(endpoint_horse_b_neck_114.midpoint);
    mesh_horse_b_neck_114.quaternion.copy(endpoint_horse_b_neck_114.quaternion);
  }
  mesh_horse_b_neck_114.castShadow = options.castShadow ?? true;
  mesh_horse_b_neck_114.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_neck_114.userData.sculptComponent = node_horse_b_neck_114.userData.sculptComponent;
  node_horse_b_neck_114.add(mesh_horse_b_neck_114);
  meshes["horse-b-neck"] = mesh_horse_b_neck_114;
  colliders["horse-b-neck"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_neck_114);
  const attachment_horse_b_head_115 = null;
  const endpoint_horse_b_head_115 = makeAttachmentEndpoint(attachment_horse_b_head_115);
  const node_horse_b_head_115 = new THREE.Group();
  node_horse_b_head_115.name = "horse-b head__pivot";
  node_horse_b_head_115.scale.set(1, 1, 1);
  if (endpoint_horse_b_head_115) {
    node_horse_b_head_115.position.copy(endpoint_horse_b_head_115.start);
    node_horse_b_head_115.rotation.set(-0.42, 0, 0);
  } else {
    node_horse_b_head_115.position.set(1.9, 2.78, 4.06);
    node_horse_b_head_115.rotation.set(-0.42, 0, 0);
  }
  node_horse_b_head_115.userData.sculptComponent = { "id": "horse-b-head", "name": "horse-b head", "level": "meso", "role": "body", "importance": 0.5499999999999999, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.3, "height": 0.4, "depth": 0.72, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [1.9, 2.78, 4.06], "rotation": [-0.42, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["wedge head angled nose-down"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_head_115.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_head_115);
  nodes["horse-b-head"] = node_horse_b_head_115;
  const mesh_horse_b_head_115Geometry = endpoint_horse_b_head_115 ? new THREE.CylinderGeometry(endpoint_horse_b_head_115.endRadius, endpoint_horse_b_head_115.baseRadius, endpoint_horse_b_head_115.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_b_head_115) {
    mesh_horse_b_head_115Geometry.scale(0.3, 0.4, 0.72);
  }
  const mesh_horse_b_head_115 = new THREE.Mesh(
    mesh_horse_b_head_115Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_head_115.name = "horse-b head";
  if (endpoint_horse_b_head_115) {
    mesh_horse_b_head_115.position.copy(endpoint_horse_b_head_115.midpoint);
    mesh_horse_b_head_115.quaternion.copy(endpoint_horse_b_head_115.quaternion);
  }
  mesh_horse_b_head_115.castShadow = options.castShadow ?? true;
  mesh_horse_b_head_115.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_head_115.userData.sculptComponent = node_horse_b_head_115.userData.sculptComponent;
  node_horse_b_head_115.add(mesh_horse_b_head_115);
  meshes["horse-b-head"] = mesh_horse_b_head_115;
  colliders["horse-b-head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_head_115);
  const attachment_horse_b_muzzle_116 = null;
  const endpoint_horse_b_muzzle_116 = makeAttachmentEndpoint(attachment_horse_b_muzzle_116);
  const node_horse_b_muzzle_116 = new THREE.Group();
  node_horse_b_muzzle_116.name = "horse-b muzzle__pivot";
  node_horse_b_muzzle_116.scale.set(1, 1, 1);
  if (endpoint_horse_b_muzzle_116) {
    node_horse_b_muzzle_116.position.copy(endpoint_horse_b_muzzle_116.start);
    node_horse_b_muzzle_116.rotation.set(0, 0, 0);
  } else {
    node_horse_b_muzzle_116.position.set(1.9, 2.5, 4.42);
    node_horse_b_muzzle_116.rotation.set(0, 0, 0);
  }
  node_horse_b_muzzle_116.userData.sculptComponent = { "id": "horse-b-muzzle", "name": "horse-b muzzle", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.27, "height": 0.26, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [1.9, 2.5, 4.42], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_muzzle_116.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_muzzle_116);
  nodes["horse-b-muzzle"] = node_horse_b_muzzle_116;
  const mesh_horse_b_muzzle_116Geometry = endpoint_horse_b_muzzle_116 ? new THREE.CylinderGeometry(endpoint_horse_b_muzzle_116.endRadius, endpoint_horse_b_muzzle_116.baseRadius, endpoint_horse_b_muzzle_116.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_b_muzzle_116) {
    mesh_horse_b_muzzle_116Geometry.scale(0.27, 0.26, 0.34);
  }
  const mesh_horse_b_muzzle_116 = new THREE.Mesh(
    mesh_horse_b_muzzle_116Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_muzzle_116.name = "horse-b muzzle";
  if (endpoint_horse_b_muzzle_116) {
    mesh_horse_b_muzzle_116.position.copy(endpoint_horse_b_muzzle_116.midpoint);
    mesh_horse_b_muzzle_116.quaternion.copy(endpoint_horse_b_muzzle_116.quaternion);
  }
  mesh_horse_b_muzzle_116.castShadow = options.castShadow ?? true;
  mesh_horse_b_muzzle_116.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_muzzle_116.userData.sculptComponent = node_horse_b_muzzle_116.userData.sculptComponent;
  node_horse_b_muzzle_116.add(mesh_horse_b_muzzle_116);
  meshes["horse-b-muzzle"] = mesh_horse_b_muzzle_116;
  colliders["horse-b-muzzle"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_muzzle_116);
  const attachment_horse_b_collar_117 = null;
  const endpoint_horse_b_collar_117 = makeAttachmentEndpoint(attachment_horse_b_collar_117);
  const node_horse_b_collar_117 = new THREE.Group();
  node_horse_b_collar_117.name = "horse-b harness collar__pivot";
  node_horse_b_collar_117.scale.set(1, 1, 1);
  if (endpoint_horse_b_collar_117) {
    node_horse_b_collar_117.position.copy(endpoint_horse_b_collar_117.start);
    node_horse_b_collar_117.rotation.set(0, 0, 0);
  } else {
    node_horse_b_collar_117.position.set(1.9, 2.05, 3.33);
    node_horse_b_collar_117.rotation.set(0, 0, 0);
  }
  node_horse_b_collar_117.userData.sculptComponent = { "id": "horse-b-collar", "name": "horse-b harness collar", "level": "meso", "role": "body", "importance": 0.55, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.8, "height": 0.62, "depth": 0.22, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.7 }, "transform": { "position": [1.9, 2.05, 3.33], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } }, "material": "iron-black", "materialLayers": ["iron-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["dark leather collar and blinker straps"], "surfaceDetail": { "macroRoughness": 0.55, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(5, 10, 32, 1.0)", "secondaryAlbedo": "rgba(23, 26, 37, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #050a20; reproduction albedo #171a25; source: #050a20 lamp post" } };
  node_horse_b_collar_117.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "iron-black" } };
  (nodes["root"] ?? root).add(node_horse_b_collar_117);
  nodes["horse-b-collar"] = node_horse_b_collar_117;
  const mesh_horse_b_collar_117Geometry = endpoint_horse_b_collar_117 ? new THREE.CylinderGeometry(endpoint_horse_b_collar_117.endRadius, endpoint_horse_b_collar_117.baseRadius, endpoint_horse_b_collar_117.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_b_collar_117) {
    mesh_horse_b_collar_117Geometry.scale(0.8, 0.62, 0.22);
  }
  const mesh_horse_b_collar_117 = new THREE.Mesh(
    mesh_horse_b_collar_117Geometry,
    materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_collar_117.name = "horse-b harness collar";
  if (endpoint_horse_b_collar_117) {
    mesh_horse_b_collar_117.position.copy(endpoint_horse_b_collar_117.midpoint);
    mesh_horse_b_collar_117.quaternion.copy(endpoint_horse_b_collar_117.quaternion);
  }
  mesh_horse_b_collar_117.castShadow = options.castShadow ?? true;
  mesh_horse_b_collar_117.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_collar_117.userData.sculptComponent = node_horse_b_collar_117.userData.sculptComponent;
  node_horse_b_collar_117.add(mesh_horse_b_collar_117);
  meshes["horse-b-collar"] = mesh_horse_b_collar_117;
  colliders["horse-b-collar"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_collar_117);
  const attachment_horse_b_leg_fore_near_118 = { "parentId": "root", "parentSocket": "root:horse-b-leg-fore-near-mount", "localStart": [2.14, 1.3, 2.85], "localEnd": [2.14, 0.16, 2.85], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_b_leg_fore_near_118 = makeAttachmentEndpoint(attachment_horse_b_leg_fore_near_118);
  const node_horse_b_leg_fore_near_118 = new THREE.Group();
  node_horse_b_leg_fore_near_118.name = "horse-b fore-near leg__pivot";
  node_horse_b_leg_fore_near_118.scale.set(1, 1, 1);
  if (endpoint_horse_b_leg_fore_near_118) {
    node_horse_b_leg_fore_near_118.position.copy(endpoint_horse_b_leg_fore_near_118.start);
    node_horse_b_leg_fore_near_118.rotation.set(0, 0, 0);
  } else {
    node_horse_b_leg_fore_near_118.position.set(0, 0, 0);
    node_horse_b_leg_fore_near_118.rotation.set(0, 0, 0);
  }
  node_horse_b_leg_fore_near_118.userData.sculptComponent = { "id": "horse-b-leg-fore-near", "name": "horse-b fore-near leg", "level": "meso", "role": "leg", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-b-leg-fore-near-mount", "localStart": [2.14, 1.3, 2.85], "localEnd": [2.14, 0.16, 2.85], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["straight blocky leg, no fetlock detail at this scale"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_leg_fore_near_118.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_leg_fore_near_118);
  nodes["horse-b-leg-fore-near"] = node_horse_b_leg_fore_near_118;
  const mesh_horse_b_leg_fore_near_118Geometry = endpoint_horse_b_leg_fore_near_118 ? new THREE.CylinderGeometry(endpoint_horse_b_leg_fore_near_118.endRadius, endpoint_horse_b_leg_fore_near_118.baseRadius, endpoint_horse_b_leg_fore_near_118.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_b_leg_fore_near_118) {
    mesh_horse_b_leg_fore_near_118Geometry.scale(1, 1, 1);
  }
  const mesh_horse_b_leg_fore_near_118 = new THREE.Mesh(
    mesh_horse_b_leg_fore_near_118Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_leg_fore_near_118.name = "horse-b fore-near leg";
  if (endpoint_horse_b_leg_fore_near_118) {
    mesh_horse_b_leg_fore_near_118.position.copy(endpoint_horse_b_leg_fore_near_118.midpoint);
    mesh_horse_b_leg_fore_near_118.quaternion.copy(endpoint_horse_b_leg_fore_near_118.quaternion);
  }
  mesh_horse_b_leg_fore_near_118.castShadow = options.castShadow ?? true;
  mesh_horse_b_leg_fore_near_118.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_leg_fore_near_118.userData.sculptComponent = node_horse_b_leg_fore_near_118.userData.sculptComponent;
  node_horse_b_leg_fore_near_118.add(mesh_horse_b_leg_fore_near_118);
  meshes["horse-b-leg-fore-near"] = mesh_horse_b_leg_fore_near_118;
  colliders["horse-b-leg-fore-near"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_leg_fore_near_118);
  const attachment_horse_b_leg_fore_off_119 = { "parentId": "root", "parentSocket": "root:horse-b-leg-fore-off-mount", "localStart": [1.66, 1.3, 2.85], "localEnd": [1.66, 0.16, 2.85], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] };
  const endpoint_horse_b_leg_fore_off_119 = makeAttachmentEndpoint(attachment_horse_b_leg_fore_off_119);
  const node_horse_b_leg_fore_off_119 = new THREE.Group();
  node_horse_b_leg_fore_off_119.name = "horse-b fore-off leg__pivot";
  node_horse_b_leg_fore_off_119.scale.set(1, 1, 1);
  if (endpoint_horse_b_leg_fore_off_119) {
    node_horse_b_leg_fore_off_119.position.copy(endpoint_horse_b_leg_fore_off_119.start);
    node_horse_b_leg_fore_off_119.rotation.set(0, 0, 0);
  } else {
    node_horse_b_leg_fore_off_119.position.set(0, 0, 0);
    node_horse_b_leg_fore_off_119.rotation.set(0, 0, 0);
  }
  node_horse_b_leg_fore_off_119.userData.sculptComponent = { "id": "horse-b-leg-fore-off", "name": "horse-b fore-off leg", "level": "meso", "role": "leg", "importance": 0.5, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "a straight tapered shaft measured end-to-end from the plate; built between its two measured endpoints so it cannot float off its mount", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": { "parentId": "root", "parentSocket": "root:horse-b-leg-fore-off-mount", "localStart": [1.66, 1.3, 2.85], "localEnd": [1.66, 0.16, 2.85], "contactType": "socket", "embedDepth": 0.06, "gapTolerance": 0.01, "baseRadius": 0.135, "endRadius": 0.08, "contactNormal": [0, 1, 0], "evidenceRefs": ["cab-zone"] }, "dimensions": { "width": 1, "height": 1, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.75 }, "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["straight blocky leg, no fetlock detail at this scale"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_leg_fore_off_119.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_leg_fore_off_119);
  nodes["horse-b-leg-fore-off"] = node_horse_b_leg_fore_off_119;
  const mesh_horse_b_leg_fore_off_119Geometry = endpoint_horse_b_leg_fore_off_119 ? new THREE.CylinderGeometry(endpoint_horse_b_leg_fore_off_119.endRadius, endpoint_horse_b_leg_fore_off_119.baseRadius, endpoint_horse_b_leg_fore_off_119.length, 8, 4) : new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 4);
  if (!endpoint_horse_b_leg_fore_off_119) {
    mesh_horse_b_leg_fore_off_119Geometry.scale(1, 1, 1);
  }
  const mesh_horse_b_leg_fore_off_119 = new THREE.Mesh(
    mesh_horse_b_leg_fore_off_119Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_leg_fore_off_119.name = "horse-b fore-off leg";
  if (endpoint_horse_b_leg_fore_off_119) {
    mesh_horse_b_leg_fore_off_119.position.copy(endpoint_horse_b_leg_fore_off_119.midpoint);
    mesh_horse_b_leg_fore_off_119.quaternion.copy(endpoint_horse_b_leg_fore_off_119.quaternion);
  }
  mesh_horse_b_leg_fore_off_119.castShadow = options.castShadow ?? true;
  mesh_horse_b_leg_fore_off_119.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_leg_fore_off_119.userData.sculptComponent = node_horse_b_leg_fore_off_119.userData.sculptComponent;
  node_horse_b_leg_fore_off_119.add(mesh_horse_b_leg_fore_off_119);
  meshes["horse-b-leg-fore-off"] = mesh_horse_b_leg_fore_off_119;
  colliders["horse-b-leg-fore-off"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_leg_fore_off_119);
  const attachment_horse_b_blanket_120 = null;
  const endpoint_horse_b_blanket_120 = makeAttachmentEndpoint(attachment_horse_b_blanket_120);
  const node_horse_b_blanket_120 = new THREE.Group();
  node_horse_b_blanket_120.name = "Off horse blanket__pivot";
  node_horse_b_blanket_120.scale.set(1, 1, 1);
  if (endpoint_horse_b_blanket_120) {
    node_horse_b_blanket_120.position.copy(endpoint_horse_b_blanket_120.start);
    node_horse_b_blanket_120.rotation.set(0, 0, 0);
  } else {
    node_horse_b_blanket_120.position.set(1.9, 2.16, 1.9);
    node_horse_b_blanket_120.rotation.set(0, 0, 0);
  }
  node_horse_b_blanket_120.userData.sculptComponent = { "id": "horse-b-blanket", "name": "Off horse blanket", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.76, "height": 0.3, "depth": 1, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [1.9, 2.16, 1.9], "rotation": [0, 0, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } }, "material": "horse-light", "materialLayers": ["horse-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["pale blanket over the off horse's back"], "surfaceDetail": { "macroRoughness": 0.85, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["cab-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(88, 77, 92, 1.0)", "secondaryAlbedo": "rgba(143, 130, 114, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["cab-zone"], "samplingNotes": "plate-observed dominant #584d5c; reproduction albedo #8f8272; source: #584d5c" } };
  node_horse_b_blanket_120.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "horse", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "horse-light" } };
  (nodes["root"] ?? root).add(node_horse_b_blanket_120);
  nodes["horse-b-blanket"] = node_horse_b_blanket_120;
  const mesh_horse_b_blanket_120Geometry = endpoint_horse_b_blanket_120 ? new THREE.CylinderGeometry(endpoint_horse_b_blanket_120.endRadius, endpoint_horse_b_blanket_120.baseRadius, endpoint_horse_b_blanket_120.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_horse_b_blanket_120) {
    mesh_horse_b_blanket_120Geometry.scale(0.76, 0.3, 1);
  }
  const mesh_horse_b_blanket_120 = new THREE.Mesh(
    mesh_horse_b_blanket_120Geometry,
    materialMap["horse-light"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_horse_b_blanket_120.name = "Off horse blanket";
  if (endpoint_horse_b_blanket_120) {
    mesh_horse_b_blanket_120.position.copy(endpoint_horse_b_blanket_120.midpoint);
    mesh_horse_b_blanket_120.quaternion.copy(endpoint_horse_b_blanket_120.quaternion);
  }
  mesh_horse_b_blanket_120.castShadow = options.castShadow ?? true;
  mesh_horse_b_blanket_120.receiveShadow = options.receiveShadow ?? true;
  mesh_horse_b_blanket_120.userData.sculptComponent = node_horse_b_blanket_120.userData.sculptComponent;
  node_horse_b_blanket_120.add(mesh_horse_b_blanket_120);
  meshes["horse-b-blanket"] = mesh_horse_b_blanket_120;
  colliders["horse-b-blanket"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["horse"] ?? (destructionGroups["horse"] = []);
  destructionGroups["horse"].push(node_horse_b_blanket_120);
  const attachment_lady_blue_skirt_121 = null;
  const endpoint_lady_blue_skirt_121 = makeAttachmentEndpoint(attachment_lady_blue_skirt_121);
  const node_lady_blue_skirt_121 = new THREE.Group();
  node_lady_blue_skirt_121.name = "lady-blue lower body__pivot";
  node_lady_blue_skirt_121.scale.set(1, 1, 1);
  if (endpoint_lady_blue_skirt_121) {
    node_lady_blue_skirt_121.position.copy(endpoint_lady_blue_skirt_121.start);
    node_lady_blue_skirt_121.rotation.set(0, -0.5, 0);
  } else {
    node_lady_blue_skirt_121.position.set(-2.45, 0.76, -0.31);
    node_lady_blue_skirt_121.rotation.set(0, -0.5, 0);
  }
  node_lady_blue_skirt_121.userData.sculptComponent = { "id": "lady-blue-skirt", "name": "lady-blue lower body", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.5, "height": 1.2, "depth": 0.42, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [-2.45, 0.76, -0.31], "rotation": [0, -0.5, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["A-line skirt or coat skirt read as one tapered block"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_lady_blue_skirt_121.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_lady_blue_skirt_121);
  nodes["lady-blue-skirt"] = node_lady_blue_skirt_121;
  const mesh_lady_blue_skirt_121Geometry = endpoint_lady_blue_skirt_121 ? new THREE.CylinderGeometry(endpoint_lady_blue_skirt_121.endRadius, endpoint_lady_blue_skirt_121.baseRadius, endpoint_lady_blue_skirt_121.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_blue_skirt_121) {
    mesh_lady_blue_skirt_121Geometry.scale(0.5, 1.2, 0.42);
  }
  const mesh_lady_blue_skirt_121 = new THREE.Mesh(
    mesh_lady_blue_skirt_121Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_blue_skirt_121.name = "lady-blue lower body";
  if (endpoint_lady_blue_skirt_121) {
    mesh_lady_blue_skirt_121.position.copy(endpoint_lady_blue_skirt_121.midpoint);
    mesh_lady_blue_skirt_121.quaternion.copy(endpoint_lady_blue_skirt_121.quaternion);
  }
  mesh_lady_blue_skirt_121.castShadow = options.castShadow ?? true;
  mesh_lady_blue_skirt_121.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_blue_skirt_121.userData.sculptComponent = node_lady_blue_skirt_121.userData.sculptComponent;
  node_lady_blue_skirt_121.add(mesh_lady_blue_skirt_121);
  meshes["lady-blue-skirt"] = mesh_lady_blue_skirt_121;
  colliders["lady-blue-skirt"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_blue_skirt_121);
  const attachment_lady_blue_bodice_122 = null;
  const endpoint_lady_blue_bodice_122 = makeAttachmentEndpoint(attachment_lady_blue_bodice_122);
  const node_lady_blue_bodice_122 = new THREE.Group();
  node_lady_blue_bodice_122.name = "lady-blue upper body__pivot";
  node_lady_blue_bodice_122.scale.set(1, 1, 1);
  if (endpoint_lady_blue_bodice_122) {
    node_lady_blue_bodice_122.position.copy(endpoint_lady_blue_bodice_122.start);
    node_lady_blue_bodice_122.rotation.set(0, -0.5, 0);
  } else {
    node_lady_blue_bodice_122.position.set(-2.45, 1.7, -0.31);
    node_lady_blue_bodice_122.rotation.set(0, -0.5, 0);
  }
  node_lady_blue_bodice_122.userData.sculptComponent = { "id": "lady-blue-bodice", "name": "lady-blue upper body", "level": "meso", "role": "body", "importance": 0.5, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.44, "height": 0.7, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [-2.45, 1.7, -0.31], "rotation": [0, -0.5, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_lady_blue_bodice_122.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_lady_blue_bodice_122);
  nodes["lady-blue-bodice"] = node_lady_blue_bodice_122;
  const mesh_lady_blue_bodice_122Geometry = endpoint_lady_blue_bodice_122 ? new THREE.CylinderGeometry(endpoint_lady_blue_bodice_122.endRadius, endpoint_lady_blue_bodice_122.baseRadius, endpoint_lady_blue_bodice_122.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_blue_bodice_122) {
    mesh_lady_blue_bodice_122Geometry.scale(0.44, 0.7, 0.34);
  }
  const mesh_lady_blue_bodice_122 = new THREE.Mesh(
    mesh_lady_blue_bodice_122Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_blue_bodice_122.name = "lady-blue upper body";
  if (endpoint_lady_blue_bodice_122) {
    mesh_lady_blue_bodice_122.position.copy(endpoint_lady_blue_bodice_122.midpoint);
    mesh_lady_blue_bodice_122.quaternion.copy(endpoint_lady_blue_bodice_122.quaternion);
  }
  mesh_lady_blue_bodice_122.castShadow = options.castShadow ?? true;
  mesh_lady_blue_bodice_122.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_blue_bodice_122.userData.sculptComponent = node_lady_blue_bodice_122.userData.sculptComponent;
  node_lady_blue_bodice_122.add(mesh_lady_blue_bodice_122);
  meshes["lady-blue-bodice"] = mesh_lady_blue_bodice_122;
  colliders["lady-blue-bodice"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_blue_bodice_122);
  const attachment_lady_blue_head_123 = null;
  const endpoint_lady_blue_head_123 = makeAttachmentEndpoint(attachment_lady_blue_head_123);
  const node_lady_blue_head_123 = new THREE.Group();
  node_lady_blue_head_123.name = "lady-blue head__pivot";
  node_lady_blue_head_123.scale.set(1, 1, 1);
  if (endpoint_lady_blue_head_123) {
    node_lady_blue_head_123.position.copy(endpoint_lady_blue_head_123.start);
    node_lady_blue_head_123.rotation.set(0, -0.5, 0);
  } else {
    node_lady_blue_head_123.position.set(-2.45, 2.2, -0.31);
    node_lady_blue_head_123.rotation.set(0, -0.5, 0);
  }
  node_lady_blue_head_123.userData.sculptComponent = { "id": "lady-blue-head", "name": "lady-blue head", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.55, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.24, "height": 0.3, "depth": 0.24, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.55 }, "transform": { "position": [-2.45, 2.2, -0.31], "rotation": [0, -0.5, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } }, "material": "skin-tone", "materialLayers": ["skin-tone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.7, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(158, 106, 89, 1.0)", "secondaryAlbedo": "rgba(195, 154, 116, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #9e6a59; reproduction albedo #c39a74; source: #9e6a59 face" } };
  node_lady_blue_head_123.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } };
  (nodes["root"] ?? root).add(node_lady_blue_head_123);
  nodes["lady-blue-head"] = node_lady_blue_head_123;
  const mesh_lady_blue_head_123Geometry = endpoint_lady_blue_head_123 ? new THREE.CylinderGeometry(endpoint_lady_blue_head_123.endRadius, endpoint_lady_blue_head_123.baseRadius, endpoint_lady_blue_head_123.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_blue_head_123) {
    mesh_lady_blue_head_123Geometry.scale(0.24, 0.3, 0.24);
  }
  const mesh_lady_blue_head_123 = new THREE.Mesh(
    mesh_lady_blue_head_123Geometry,
    materialMap["skin-tone"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_blue_head_123.name = "lady-blue head";
  if (endpoint_lady_blue_head_123) {
    mesh_lady_blue_head_123.position.copy(endpoint_lady_blue_head_123.midpoint);
    mesh_lady_blue_head_123.quaternion.copy(endpoint_lady_blue_head_123.quaternion);
  }
  mesh_lady_blue_head_123.castShadow = options.castShadow ?? true;
  mesh_lady_blue_head_123.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_blue_head_123.userData.sculptComponent = node_lady_blue_head_123.userData.sculptComponent;
  node_lady_blue_head_123.add(mesh_lady_blue_head_123);
  meshes["lady-blue-head"] = mesh_lady_blue_head_123;
  colliders["lady-blue-head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_blue_head_123);
  const attachment_lady_blue_hat_brim_124 = null;
  const endpoint_lady_blue_hat_brim_124 = makeAttachmentEndpoint(attachment_lady_blue_hat_brim_124);
  const node_lady_blue_hat_brim_124 = new THREE.Group();
  node_lady_blue_hat_brim_124.name = "lady-blue hat brim__pivot";
  node_lady_blue_hat_brim_124.scale.set(1, 1, 1);
  if (endpoint_lady_blue_hat_brim_124) {
    node_lady_blue_hat_brim_124.position.copy(endpoint_lady_blue_hat_brim_124.start);
    node_lady_blue_hat_brim_124.rotation.set(0, -0.5, 0);
  } else {
    node_lady_blue_hat_brim_124.position.set(-2.45, 2.4, -0.31);
    node_lady_blue_hat_brim_124.rotation.set(0, -0.5, 0);
  }
  node_lady_blue_hat_brim_124.userData.sculptComponent = { "id": "lady-blue-hat-brim", "name": "lady-blue hat brim", "level": "micro", "role": "body", "importance": 0.5, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.62, "height": 0.08, "depth": 0.62, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [-2.45, 2.4, -0.31], "rotation": [0, -0.5, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["wide brim reads as the figure's identifying silhouette"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_lady_blue_hat_brim_124.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_lady_blue_hat_brim_124);
  nodes["lady-blue-hat-brim"] = node_lady_blue_hat_brim_124;
  const mesh_lady_blue_hat_brim_124Geometry = endpoint_lady_blue_hat_brim_124 ? new THREE.CylinderGeometry(endpoint_lady_blue_hat_brim_124.endRadius, endpoint_lady_blue_hat_brim_124.baseRadius, endpoint_lady_blue_hat_brim_124.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_blue_hat_brim_124) {
    mesh_lady_blue_hat_brim_124Geometry.scale(0.62, 0.08, 0.62);
  }
  const mesh_lady_blue_hat_brim_124 = new THREE.Mesh(
    mesh_lady_blue_hat_brim_124Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_blue_hat_brim_124.name = "lady-blue hat brim";
  if (endpoint_lady_blue_hat_brim_124) {
    mesh_lady_blue_hat_brim_124.position.copy(endpoint_lady_blue_hat_brim_124.midpoint);
    mesh_lady_blue_hat_brim_124.quaternion.copy(endpoint_lady_blue_hat_brim_124.quaternion);
  }
  mesh_lady_blue_hat_brim_124.castShadow = options.castShadow ?? true;
  mesh_lady_blue_hat_brim_124.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_blue_hat_brim_124.userData.sculptComponent = node_lady_blue_hat_brim_124.userData.sculptComponent;
  node_lady_blue_hat_brim_124.add(mesh_lady_blue_hat_brim_124);
  meshes["lady-blue-hat-brim"] = mesh_lady_blue_hat_brim_124;
  colliders["lady-blue-hat-brim"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_blue_hat_brim_124);
  const attachment_lady_blue_hat_crown_125 = null;
  const endpoint_lady_blue_hat_crown_125 = makeAttachmentEndpoint(attachment_lady_blue_hat_crown_125);
  const node_lady_blue_hat_crown_125 = new THREE.Group();
  node_lady_blue_hat_crown_125.name = "lady-blue hat crown__pivot";
  node_lady_blue_hat_crown_125.scale.set(1, 1, 1);
  if (endpoint_lady_blue_hat_crown_125) {
    node_lady_blue_hat_crown_125.position.copy(endpoint_lady_blue_hat_crown_125.start);
    node_lady_blue_hat_crown_125.rotation.set(0, -0.5, 0);
  } else {
    node_lady_blue_hat_crown_125.position.set(-2.45, 2.51, -0.31);
    node_lady_blue_hat_crown_125.rotation.set(0, -0.5, 0);
  }
  node_lady_blue_hat_crown_125.userData.sculptComponent = { "id": "lady-blue-hat-crown", "name": "lady-blue hat crown", "level": "micro", "role": "body", "importance": 0.4, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.341, "height": 0.17, "depth": 0.341, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [-2.45, 2.51, -0.31], "rotation": [0, -0.5, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } }, "material": "coat-navy", "materialLayers": ["coat-navy"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(10, 20, 60, 1.0)", "secondaryAlbedo": "rgba(43, 58, 99, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #0a143c; reproduction albedo #2b3a63; source: #0a143c skirt / #400b10 driver coat in shadow" } };
  node_lady_blue_hat_crown_125.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-navy" } };
  (nodes["root"] ?? root).add(node_lady_blue_hat_crown_125);
  nodes["lady-blue-hat-crown"] = node_lady_blue_hat_crown_125;
  const mesh_lady_blue_hat_crown_125Geometry = endpoint_lady_blue_hat_crown_125 ? new THREE.CylinderGeometry(endpoint_lady_blue_hat_crown_125.endRadius, endpoint_lady_blue_hat_crown_125.baseRadius, endpoint_lady_blue_hat_crown_125.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_blue_hat_crown_125) {
    mesh_lady_blue_hat_crown_125Geometry.scale(0.341, 0.17, 0.341);
  }
  const mesh_lady_blue_hat_crown_125 = new THREE.Mesh(
    mesh_lady_blue_hat_crown_125Geometry,
    materialMap["coat-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_blue_hat_crown_125.name = "lady-blue hat crown";
  if (endpoint_lady_blue_hat_crown_125) {
    mesh_lady_blue_hat_crown_125.position.copy(endpoint_lady_blue_hat_crown_125.midpoint);
    mesh_lady_blue_hat_crown_125.quaternion.copy(endpoint_lady_blue_hat_crown_125.quaternion);
  }
  mesh_lady_blue_hat_crown_125.castShadow = options.castShadow ?? true;
  mesh_lady_blue_hat_crown_125.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_blue_hat_crown_125.userData.sculptComponent = node_lady_blue_hat_crown_125.userData.sculptComponent;
  node_lady_blue_hat_crown_125.add(mesh_lady_blue_hat_crown_125);
  meshes["lady-blue-hat-crown"] = mesh_lady_blue_hat_crown_125;
  colliders["lady-blue-hat-crown"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_blue_hat_crown_125);
  const attachment_gent_plum_skirt_126 = null;
  const endpoint_gent_plum_skirt_126 = makeAttachmentEndpoint(attachment_gent_plum_skirt_126);
  const node_gent_plum_skirt_126 = new THREE.Group();
  node_gent_plum_skirt_126.name = "gent-plum lower body__pivot";
  node_gent_plum_skirt_126.scale.set(1, 1, 1);
  if (endpoint_gent_plum_skirt_126) {
    node_gent_plum_skirt_126.position.copy(endpoint_gent_plum_skirt_126.start);
    node_gent_plum_skirt_126.rotation.set(0, 0.9, 0);
  } else {
    node_gent_plum_skirt_126.position.set(3.95, 0.76, 0.56);
    node_gent_plum_skirt_126.rotation.set(0, 0.9, 0);
  }
  node_gent_plum_skirt_126.userData.sculptComponent = { "id": "gent-plum-skirt", "name": "gent-plum lower body", "level": "meso", "role": "body", "importance": 0.45, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.5, "height": 1.2, "depth": 0.42, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [3.95, 0.76, 0.56], "rotation": [0, 0.9, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } }, "material": "coat-purple", "materialLayers": ["coat-purple"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["A-line skirt or coat skirt read as one tapered block"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(18, 13, 51, 1.0)", "secondaryAlbedo": "rgba(77, 58, 108, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #120d33; reproduction albedo #4d3a6c; source: #120d33" } };
  node_gent_plum_skirt_126.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } };
  (nodes["root"] ?? root).add(node_gent_plum_skirt_126);
  nodes["gent-plum-skirt"] = node_gent_plum_skirt_126;
  const mesh_gent_plum_skirt_126Geometry = endpoint_gent_plum_skirt_126 ? new THREE.CylinderGeometry(endpoint_gent_plum_skirt_126.endRadius, endpoint_gent_plum_skirt_126.baseRadius, endpoint_gent_plum_skirt_126.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_gent_plum_skirt_126) {
    mesh_gent_plum_skirt_126Geometry.scale(0.5, 1.2, 0.42);
  }
  const mesh_gent_plum_skirt_126 = new THREE.Mesh(
    mesh_gent_plum_skirt_126Geometry,
    materialMap["coat-purple"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_gent_plum_skirt_126.name = "gent-plum lower body";
  if (endpoint_gent_plum_skirt_126) {
    mesh_gent_plum_skirt_126.position.copy(endpoint_gent_plum_skirt_126.midpoint);
    mesh_gent_plum_skirt_126.quaternion.copy(endpoint_gent_plum_skirt_126.quaternion);
  }
  mesh_gent_plum_skirt_126.castShadow = options.castShadow ?? true;
  mesh_gent_plum_skirt_126.receiveShadow = options.receiveShadow ?? true;
  mesh_gent_plum_skirt_126.userData.sculptComponent = node_gent_plum_skirt_126.userData.sculptComponent;
  node_gent_plum_skirt_126.add(mesh_gent_plum_skirt_126);
  meshes["gent-plum-skirt"] = mesh_gent_plum_skirt_126;
  colliders["gent-plum-skirt"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["gent"] ?? (destructionGroups["gent"] = []);
  destructionGroups["gent"].push(node_gent_plum_skirt_126);
  const attachment_gent_plum_bodice_127 = null;
  const endpoint_gent_plum_bodice_127 = makeAttachmentEndpoint(attachment_gent_plum_bodice_127);
  const node_gent_plum_bodice_127 = new THREE.Group();
  node_gent_plum_bodice_127.name = "gent-plum upper body__pivot";
  node_gent_plum_bodice_127.scale.set(1, 1, 1);
  if (endpoint_gent_plum_bodice_127) {
    node_gent_plum_bodice_127.position.copy(endpoint_gent_plum_bodice_127.start);
    node_gent_plum_bodice_127.rotation.set(0, 0.9, 0);
  } else {
    node_gent_plum_bodice_127.position.set(3.95, 1.7, 0.56);
    node_gent_plum_bodice_127.rotation.set(0, 0.9, 0);
  }
  node_gent_plum_bodice_127.userData.sculptComponent = { "id": "gent-plum-bodice", "name": "gent-plum upper body", "level": "meso", "role": "body", "importance": 0.45, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.44, "height": 0.7, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [3.95, 1.7, 0.56], "rotation": [0, 0.9, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } }, "material": "coat-purple", "materialLayers": ["coat-purple"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(18, 13, 51, 1.0)", "secondaryAlbedo": "rgba(77, 58, 108, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #120d33; reproduction albedo #4d3a6c; source: #120d33" } };
  node_gent_plum_bodice_127.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } };
  (nodes["root"] ?? root).add(node_gent_plum_bodice_127);
  nodes["gent-plum-bodice"] = node_gent_plum_bodice_127;
  const mesh_gent_plum_bodice_127Geometry = endpoint_gent_plum_bodice_127 ? new THREE.CylinderGeometry(endpoint_gent_plum_bodice_127.endRadius, endpoint_gent_plum_bodice_127.baseRadius, endpoint_gent_plum_bodice_127.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_gent_plum_bodice_127) {
    mesh_gent_plum_bodice_127Geometry.scale(0.44, 0.7, 0.34);
  }
  const mesh_gent_plum_bodice_127 = new THREE.Mesh(
    mesh_gent_plum_bodice_127Geometry,
    materialMap["coat-purple"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_gent_plum_bodice_127.name = "gent-plum upper body";
  if (endpoint_gent_plum_bodice_127) {
    mesh_gent_plum_bodice_127.position.copy(endpoint_gent_plum_bodice_127.midpoint);
    mesh_gent_plum_bodice_127.quaternion.copy(endpoint_gent_plum_bodice_127.quaternion);
  }
  mesh_gent_plum_bodice_127.castShadow = options.castShadow ?? true;
  mesh_gent_plum_bodice_127.receiveShadow = options.receiveShadow ?? true;
  mesh_gent_plum_bodice_127.userData.sculptComponent = node_gent_plum_bodice_127.userData.sculptComponent;
  node_gent_plum_bodice_127.add(mesh_gent_plum_bodice_127);
  meshes["gent-plum-bodice"] = mesh_gent_plum_bodice_127;
  colliders["gent-plum-bodice"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["gent"] ?? (destructionGroups["gent"] = []);
  destructionGroups["gent"].push(node_gent_plum_bodice_127);
  const attachment_gent_plum_head_128 = null;
  const endpoint_gent_plum_head_128 = makeAttachmentEndpoint(attachment_gent_plum_head_128);
  const node_gent_plum_head_128 = new THREE.Group();
  node_gent_plum_head_128.name = "gent-plum head__pivot";
  node_gent_plum_head_128.scale.set(1, 1, 1);
  if (endpoint_gent_plum_head_128) {
    node_gent_plum_head_128.position.copy(endpoint_gent_plum_head_128.start);
    node_gent_plum_head_128.rotation.set(0, 0.9, 0);
  } else {
    node_gent_plum_head_128.position.set(3.95, 2.2, 0.56);
    node_gent_plum_head_128.rotation.set(0, 0.9, 0);
  }
  node_gent_plum_head_128.userData.sculptComponent = { "id": "gent-plum-head", "name": "gent-plum head", "level": "micro", "role": "body", "importance": 0.35, "confidence": 0.55, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.24, "height": 0.3, "depth": 0.24, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.55 }, "transform": { "position": [3.95, 2.2, 0.56], "rotation": [0, 0.9, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } }, "material": "skin-tone", "materialLayers": ["skin-tone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.7, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(158, 106, 89, 1.0)", "secondaryAlbedo": "rgba(195, 154, 116, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #9e6a59; reproduction albedo #c39a74; source: #9e6a59 face" } };
  node_gent_plum_head_128.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } };
  (nodes["root"] ?? root).add(node_gent_plum_head_128);
  nodes["gent-plum-head"] = node_gent_plum_head_128;
  const mesh_gent_plum_head_128Geometry = endpoint_gent_plum_head_128 ? new THREE.CylinderGeometry(endpoint_gent_plum_head_128.endRadius, endpoint_gent_plum_head_128.baseRadius, endpoint_gent_plum_head_128.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_gent_plum_head_128) {
    mesh_gent_plum_head_128Geometry.scale(0.24, 0.3, 0.24);
  }
  const mesh_gent_plum_head_128 = new THREE.Mesh(
    mesh_gent_plum_head_128Geometry,
    materialMap["skin-tone"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_gent_plum_head_128.name = "gent-plum head";
  if (endpoint_gent_plum_head_128) {
    mesh_gent_plum_head_128.position.copy(endpoint_gent_plum_head_128.midpoint);
    mesh_gent_plum_head_128.quaternion.copy(endpoint_gent_plum_head_128.quaternion);
  }
  mesh_gent_plum_head_128.castShadow = options.castShadow ?? true;
  mesh_gent_plum_head_128.receiveShadow = options.receiveShadow ?? true;
  mesh_gent_plum_head_128.userData.sculptComponent = node_gent_plum_head_128.userData.sculptComponent;
  node_gent_plum_head_128.add(mesh_gent_plum_head_128);
  meshes["gent-plum-head"] = mesh_gent_plum_head_128;
  colliders["gent-plum-head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["gent"] ?? (destructionGroups["gent"] = []);
  destructionGroups["gent"].push(node_gent_plum_head_128);
  const attachment_gent_plum_hat_brim_129 = null;
  const endpoint_gent_plum_hat_brim_129 = makeAttachmentEndpoint(attachment_gent_plum_hat_brim_129);
  const node_gent_plum_hat_brim_129 = new THREE.Group();
  node_gent_plum_hat_brim_129.name = "gent-plum hat brim__pivot";
  node_gent_plum_hat_brim_129.scale.set(1, 1, 1);
  if (endpoint_gent_plum_hat_brim_129) {
    node_gent_plum_hat_brim_129.position.copy(endpoint_gent_plum_hat_brim_129.start);
    node_gent_plum_hat_brim_129.rotation.set(0, 0.9, 0);
  } else {
    node_gent_plum_hat_brim_129.position.set(3.95, 2.4, 0.56);
    node_gent_plum_hat_brim_129.rotation.set(0, 0.9, 0);
  }
  node_gent_plum_hat_brim_129.userData.sculptComponent = { "id": "gent-plum-hat-brim", "name": "gent-plum hat brim", "level": "micro", "role": "body", "importance": 0.45, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.5, "height": 0.08, "depth": 0.5, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [3.95, 2.4, 0.56], "rotation": [0, 0.9, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } }, "material": "coat-purple", "materialLayers": ["coat-purple"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["wide brim reads as the figure's identifying silhouette"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(18, 13, 51, 1.0)", "secondaryAlbedo": "rgba(77, 58, 108, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #120d33; reproduction albedo #4d3a6c; source: #120d33" } };
  node_gent_plum_hat_brim_129.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } };
  (nodes["root"] ?? root).add(node_gent_plum_hat_brim_129);
  nodes["gent-plum-hat-brim"] = node_gent_plum_hat_brim_129;
  const mesh_gent_plum_hat_brim_129Geometry = endpoint_gent_plum_hat_brim_129 ? new THREE.CylinderGeometry(endpoint_gent_plum_hat_brim_129.endRadius, endpoint_gent_plum_hat_brim_129.baseRadius, endpoint_gent_plum_hat_brim_129.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_gent_plum_hat_brim_129) {
    mesh_gent_plum_hat_brim_129Geometry.scale(0.5, 0.08, 0.5);
  }
  const mesh_gent_plum_hat_brim_129 = new THREE.Mesh(
    mesh_gent_plum_hat_brim_129Geometry,
    materialMap["coat-purple"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_gent_plum_hat_brim_129.name = "gent-plum hat brim";
  if (endpoint_gent_plum_hat_brim_129) {
    mesh_gent_plum_hat_brim_129.position.copy(endpoint_gent_plum_hat_brim_129.midpoint);
    mesh_gent_plum_hat_brim_129.quaternion.copy(endpoint_gent_plum_hat_brim_129.quaternion);
  }
  mesh_gent_plum_hat_brim_129.castShadow = options.castShadow ?? true;
  mesh_gent_plum_hat_brim_129.receiveShadow = options.receiveShadow ?? true;
  mesh_gent_plum_hat_brim_129.userData.sculptComponent = node_gent_plum_hat_brim_129.userData.sculptComponent;
  node_gent_plum_hat_brim_129.add(mesh_gent_plum_hat_brim_129);
  meshes["gent-plum-hat-brim"] = mesh_gent_plum_hat_brim_129;
  colliders["gent-plum-hat-brim"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["gent"] ?? (destructionGroups["gent"] = []);
  destructionGroups["gent"].push(node_gent_plum_hat_brim_129);
  const attachment_gent_plum_hat_crown_130 = null;
  const endpoint_gent_plum_hat_crown_130 = makeAttachmentEndpoint(attachment_gent_plum_hat_crown_130);
  const node_gent_plum_hat_crown_130 = new THREE.Group();
  node_gent_plum_hat_crown_130.name = "gent-plum hat crown__pivot";
  node_gent_plum_hat_crown_130.scale.set(1, 1, 1);
  if (endpoint_gent_plum_hat_crown_130) {
    node_gent_plum_hat_crown_130.position.copy(endpoint_gent_plum_hat_crown_130.start);
    node_gent_plum_hat_crown_130.rotation.set(0, 0.9, 0);
  } else {
    node_gent_plum_hat_crown_130.position.set(3.95, 2.51, 0.56);
    node_gent_plum_hat_crown_130.rotation.set(0, 0.9, 0);
  }
  node_gent_plum_hat_crown_130.userData.sculptComponent = { "id": "gent-plum-hat-crown", "name": "gent-plum hat crown", "level": "micro", "role": "body", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.275, "height": 0.17, "depth": 0.275, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [3.95, 2.51, 0.56], "rotation": [0, 0.9, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } }, "material": "coat-purple", "materialLayers": ["coat-purple"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(18, 13, 51, 1.0)", "secondaryAlbedo": "rgba(77, 58, 108, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #120d33; reproduction albedo #4d3a6c; source: #120d33" } };
  node_gent_plum_hat_crown_130.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "gent", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-purple" } };
  (nodes["root"] ?? root).add(node_gent_plum_hat_crown_130);
  nodes["gent-plum-hat-crown"] = node_gent_plum_hat_crown_130;
  const mesh_gent_plum_hat_crown_130Geometry = endpoint_gent_plum_hat_crown_130 ? new THREE.CylinderGeometry(endpoint_gent_plum_hat_crown_130.endRadius, endpoint_gent_plum_hat_crown_130.baseRadius, endpoint_gent_plum_hat_crown_130.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_gent_plum_hat_crown_130) {
    mesh_gent_plum_hat_crown_130Geometry.scale(0.275, 0.17, 0.275);
  }
  const mesh_gent_plum_hat_crown_130 = new THREE.Mesh(
    mesh_gent_plum_hat_crown_130Geometry,
    materialMap["coat-purple"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_gent_plum_hat_crown_130.name = "gent-plum hat crown";
  if (endpoint_gent_plum_hat_crown_130) {
    mesh_gent_plum_hat_crown_130.position.copy(endpoint_gent_plum_hat_crown_130.midpoint);
    mesh_gent_plum_hat_crown_130.quaternion.copy(endpoint_gent_plum_hat_crown_130.quaternion);
  }
  mesh_gent_plum_hat_crown_130.castShadow = options.castShadow ?? true;
  mesh_gent_plum_hat_crown_130.receiveShadow = options.receiveShadow ?? true;
  mesh_gent_plum_hat_crown_130.userData.sculptComponent = node_gent_plum_hat_crown_130.userData.sculptComponent;
  node_gent_plum_hat_crown_130.add(mesh_gent_plum_hat_crown_130);
  meshes["gent-plum-hat-crown"] = mesh_gent_plum_hat_crown_130;
  colliders["gent-plum-hat-crown"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["gent"] ?? (destructionGroups["gent"] = []);
  destructionGroups["gent"].push(node_gent_plum_hat_crown_130);
  const attachment_lady_green_skirt_131 = null;
  const endpoint_lady_green_skirt_131 = makeAttachmentEndpoint(attachment_lady_green_skirt_131);
  const node_lady_green_skirt_131 = new THREE.Group();
  node_lady_green_skirt_131.name = "lady-green lower body__pivot";
  node_lady_green_skirt_131.scale.set(1, 1, 1);
  if (endpoint_lady_green_skirt_131) {
    node_lady_green_skirt_131.position.copy(endpoint_lady_green_skirt_131.start);
    node_lady_green_skirt_131.rotation.set(0, 2.4, 0);
  } else {
    node_lady_green_skirt_131.position.set(4.15, 0.76, -2.16);
    node_lady_green_skirt_131.rotation.set(0, 2.4, 0);
  }
  node_lady_green_skirt_131.userData.sculptComponent = { "id": "lady-green-skirt", "name": "lady-green lower body", "level": "meso", "role": "body", "importance": 0.45, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.5, "height": 1.2, "depth": 0.42, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [4.15, 0.76, -2.16], "rotation": [0, 2.4, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } }, "material": "coat-green", "materialLayers": ["coat-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["A-line skirt or coat skirt read as one tapered block"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(9, 29, 19, 1.0)", "secondaryAlbedo": "rgba(45, 99, 73, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #091d13; reproduction albedo #2d6349; source: #091d13" } };
  node_lady_green_skirt_131.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } };
  (nodes["root"] ?? root).add(node_lady_green_skirt_131);
  nodes["lady-green-skirt"] = node_lady_green_skirt_131;
  const mesh_lady_green_skirt_131Geometry = endpoint_lady_green_skirt_131 ? new THREE.CylinderGeometry(endpoint_lady_green_skirt_131.endRadius, endpoint_lady_green_skirt_131.baseRadius, endpoint_lady_green_skirt_131.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_green_skirt_131) {
    mesh_lady_green_skirt_131Geometry.scale(0.5, 1.2, 0.42);
  }
  const mesh_lady_green_skirt_131 = new THREE.Mesh(
    mesh_lady_green_skirt_131Geometry,
    materialMap["coat-green"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_green_skirt_131.name = "lady-green lower body";
  if (endpoint_lady_green_skirt_131) {
    mesh_lady_green_skirt_131.position.copy(endpoint_lady_green_skirt_131.midpoint);
    mesh_lady_green_skirt_131.quaternion.copy(endpoint_lady_green_skirt_131.quaternion);
  }
  mesh_lady_green_skirt_131.castShadow = options.castShadow ?? true;
  mesh_lady_green_skirt_131.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_green_skirt_131.userData.sculptComponent = node_lady_green_skirt_131.userData.sculptComponent;
  node_lady_green_skirt_131.add(mesh_lady_green_skirt_131);
  meshes["lady-green-skirt"] = mesh_lady_green_skirt_131;
  colliders["lady-green-skirt"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_green_skirt_131);
  const attachment_lady_green_bodice_132 = null;
  const endpoint_lady_green_bodice_132 = makeAttachmentEndpoint(attachment_lady_green_bodice_132);
  const node_lady_green_bodice_132 = new THREE.Group();
  node_lady_green_bodice_132.name = "lady-green upper body__pivot";
  node_lady_green_bodice_132.scale.set(1, 1, 1);
  if (endpoint_lady_green_bodice_132) {
    node_lady_green_bodice_132.position.copy(endpoint_lady_green_bodice_132.start);
    node_lady_green_bodice_132.rotation.set(0, 2.4, 0);
  } else {
    node_lady_green_bodice_132.position.set(4.15, 1.7, -2.16);
    node_lady_green_bodice_132.rotation.set(0, 2.4, 0);
  }
  node_lady_green_bodice_132.userData.sculptComponent = { "id": "lady-green-bodice", "name": "lady-green upper body", "level": "meso", "role": "body", "importance": 0.45, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.44, "height": 0.7, "depth": 0.34, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [4.15, 1.7, -2.16], "rotation": [0, 2.4, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } }, "material": "coat-green", "materialLayers": ["coat-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(9, 29, 19, 1.0)", "secondaryAlbedo": "rgba(45, 99, 73, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #091d13; reproduction albedo #2d6349; source: #091d13" } };
  node_lady_green_bodice_132.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } };
  (nodes["root"] ?? root).add(node_lady_green_bodice_132);
  nodes["lady-green-bodice"] = node_lady_green_bodice_132;
  const mesh_lady_green_bodice_132Geometry = endpoint_lady_green_bodice_132 ? new THREE.CylinderGeometry(endpoint_lady_green_bodice_132.endRadius, endpoint_lady_green_bodice_132.baseRadius, endpoint_lady_green_bodice_132.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_green_bodice_132) {
    mesh_lady_green_bodice_132Geometry.scale(0.44, 0.7, 0.34);
  }
  const mesh_lady_green_bodice_132 = new THREE.Mesh(
    mesh_lady_green_bodice_132Geometry,
    materialMap["coat-green"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_green_bodice_132.name = "lady-green upper body";
  if (endpoint_lady_green_bodice_132) {
    mesh_lady_green_bodice_132.position.copy(endpoint_lady_green_bodice_132.midpoint);
    mesh_lady_green_bodice_132.quaternion.copy(endpoint_lady_green_bodice_132.quaternion);
  }
  mesh_lady_green_bodice_132.castShadow = options.castShadow ?? true;
  mesh_lady_green_bodice_132.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_green_bodice_132.userData.sculptComponent = node_lady_green_bodice_132.userData.sculptComponent;
  node_lady_green_bodice_132.add(mesh_lady_green_bodice_132);
  meshes["lady-green-bodice"] = mesh_lady_green_bodice_132;
  colliders["lady-green-bodice"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_green_bodice_132);
  const attachment_lady_green_head_133 = null;
  const endpoint_lady_green_head_133 = makeAttachmentEndpoint(attachment_lady_green_head_133);
  const node_lady_green_head_133 = new THREE.Group();
  node_lady_green_head_133.name = "lady-green head__pivot";
  node_lady_green_head_133.scale.set(1, 1, 1);
  if (endpoint_lady_green_head_133) {
    node_lady_green_head_133.position.copy(endpoint_lady_green_head_133.start);
    node_lady_green_head_133.rotation.set(0, 2.4, 0);
  } else {
    node_lady_green_head_133.position.set(4.15, 2.2, -2.16);
    node_lady_green_head_133.rotation.set(0, 2.4, 0);
  }
  node_lady_green_head_133.userData.sculptComponent = { "id": "lady-green-head", "name": "lady-green head", "level": "micro", "role": "body", "importance": 0.35, "confidence": 0.55, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.24, "height": 0.3, "depth": 0.24, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.55 }, "transform": { "position": [4.15, 2.2, -2.16], "rotation": [0, 2.4, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } }, "material": "skin-tone", "materialLayers": ["skin-tone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.7, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(158, 106, 89, 1.0)", "secondaryAlbedo": "rgba(195, 154, 116, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #9e6a59; reproduction albedo #c39a74; source: #9e6a59 face" } };
  node_lady_green_head_133.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.55 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "skin-tone" } };
  (nodes["root"] ?? root).add(node_lady_green_head_133);
  nodes["lady-green-head"] = node_lady_green_head_133;
  const mesh_lady_green_head_133Geometry = endpoint_lady_green_head_133 ? new THREE.CylinderGeometry(endpoint_lady_green_head_133.endRadius, endpoint_lady_green_head_133.baseRadius, endpoint_lady_green_head_133.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_green_head_133) {
    mesh_lady_green_head_133Geometry.scale(0.24, 0.3, 0.24);
  }
  const mesh_lady_green_head_133 = new THREE.Mesh(
    mesh_lady_green_head_133Geometry,
    materialMap["skin-tone"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_green_head_133.name = "lady-green head";
  if (endpoint_lady_green_head_133) {
    mesh_lady_green_head_133.position.copy(endpoint_lady_green_head_133.midpoint);
    mesh_lady_green_head_133.quaternion.copy(endpoint_lady_green_head_133.quaternion);
  }
  mesh_lady_green_head_133.castShadow = options.castShadow ?? true;
  mesh_lady_green_head_133.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_green_head_133.userData.sculptComponent = node_lady_green_head_133.userData.sculptComponent;
  node_lady_green_head_133.add(mesh_lady_green_head_133);
  meshes["lady-green-head"] = mesh_lady_green_head_133;
  colliders["lady-green-head"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_green_head_133);
  const attachment_lady_green_hat_brim_134 = null;
  const endpoint_lady_green_hat_brim_134 = makeAttachmentEndpoint(attachment_lady_green_hat_brim_134);
  const node_lady_green_hat_brim_134 = new THREE.Group();
  node_lady_green_hat_brim_134.name = "lady-green hat brim__pivot";
  node_lady_green_hat_brim_134.scale.set(1, 1, 1);
  if (endpoint_lady_green_hat_brim_134) {
    node_lady_green_hat_brim_134.position.copy(endpoint_lady_green_hat_brim_134.start);
    node_lady_green_hat_brim_134.rotation.set(0, 2.4, 0);
  } else {
    node_lady_green_hat_brim_134.position.set(4.15, 2.4, -2.16);
    node_lady_green_hat_brim_134.rotation.set(0, 2.4, 0);
  }
  node_lady_green_hat_brim_134.userData.sculptComponent = { "id": "lady-green-hat-brim", "name": "lady-green hat brim", "level": "micro", "role": "body", "importance": 0.45, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.52, "height": 0.08, "depth": 0.52, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [4.15, 2.4, -2.16], "rotation": [0, 2.4, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } }, "material": "coat-green", "materialLayers": ["coat-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["wide brim reads as the figure's identifying silhouette"], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(9, 29, 19, 1.0)", "secondaryAlbedo": "rgba(45, 99, 73, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #091d13; reproduction albedo #2d6349; source: #091d13" } };
  node_lady_green_hat_brim_134.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } };
  (nodes["root"] ?? root).add(node_lady_green_hat_brim_134);
  nodes["lady-green-hat-brim"] = node_lady_green_hat_brim_134;
  const mesh_lady_green_hat_brim_134Geometry = endpoint_lady_green_hat_brim_134 ? new THREE.CylinderGeometry(endpoint_lady_green_hat_brim_134.endRadius, endpoint_lady_green_hat_brim_134.baseRadius, endpoint_lady_green_hat_brim_134.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_green_hat_brim_134) {
    mesh_lady_green_hat_brim_134Geometry.scale(0.52, 0.08, 0.52);
  }
  const mesh_lady_green_hat_brim_134 = new THREE.Mesh(
    mesh_lady_green_hat_brim_134Geometry,
    materialMap["coat-green"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_green_hat_brim_134.name = "lady-green hat brim";
  if (endpoint_lady_green_hat_brim_134) {
    mesh_lady_green_hat_brim_134.position.copy(endpoint_lady_green_hat_brim_134.midpoint);
    mesh_lady_green_hat_brim_134.quaternion.copy(endpoint_lady_green_hat_brim_134.quaternion);
  }
  mesh_lady_green_hat_brim_134.castShadow = options.castShadow ?? true;
  mesh_lady_green_hat_brim_134.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_green_hat_brim_134.userData.sculptComponent = node_lady_green_hat_brim_134.userData.sculptComponent;
  node_lady_green_hat_brim_134.add(mesh_lady_green_hat_brim_134);
  meshes["lady-green-hat-brim"] = mesh_lady_green_hat_brim_134;
  colliders["lady-green-hat-brim"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_green_hat_brim_134);
  const attachment_lady_green_hat_crown_135 = null;
  const endpoint_lady_green_hat_crown_135 = makeAttachmentEndpoint(attachment_lady_green_hat_crown_135);
  const node_lady_green_hat_crown_135 = new THREE.Group();
  node_lady_green_hat_crown_135.name = "lady-green hat crown__pivot";
  node_lady_green_hat_crown_135.scale.set(1, 1, 1);
  if (endpoint_lady_green_hat_crown_135) {
    node_lady_green_hat_crown_135.position.copy(endpoint_lady_green_hat_crown_135.start);
    node_lady_green_hat_crown_135.rotation.set(0, 2.4, 0);
  } else {
    node_lady_green_hat_crown_135.position.set(4.15, 2.51, -2.16);
    node_lady_green_hat_crown_135.rotation.set(0, 2.4, 0);
  }
  node_lady_green_hat_crown_135.userData.sculptComponent = { "id": "lady-green-hat-crown", "name": "lady-green hat crown", "level": "micro", "role": "body", "importance": 0.35, "confidence": 0.6, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "separate rigid facet volume bolted to its neighbours in the reference; no continuous surface flows across the seam", "geometryDescriptor": { "topologyIntent": "flat-shaded low-poly facet solid", "edgeTreatment": { "type": "none", "bevelRadius": 0, "segments": 1 }, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "flat per-face normals (facet read)" }, "parent": "root", "attachment": null, "dimensions": { "width": 0.28600000000000003, "height": 0.17, "depth": 0.28600000000000003, "units": "world-units (1 unit = 52.8 reference px)", "confidence": 0.6 }, "transform": { "position": [4.15, 2.51, -2.16], "rotation": [0, 2.4, 0] }, "actionProfile": { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } }, "material": "coat-green", "materialLayers": ["coat-green"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": { "macroRoughness": 0.9, "microRoughness": 0, "bumpAmplitude": 0, "normalPattern": "flat facets", "displacementPattern": "none", "occlusionPattern": "light-rig contact shading", "edgeWearPattern": "none", "notes": "reference plate has no surface texture" }, "evidenceRefs": ["street-zone"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": { "dominantAlbedo": "rgba(9, 29, 19, 1.0)", "secondaryAlbedo": "rgba(45, 99, 73, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.8, "finish": "matte flat-facet", "evidenceRefs": ["street-zone"], "samplingNotes": "plate-observed dominant #091d13; reproduction albedo #2d6349; source: #091d13" } };
  node_lady_green_hat_crown_135.userData.actionProfile = { "animationRole": "static", "pivot": { "mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.6 }, "transformChannels": { "translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true }, "sockets": [], "collider": { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" }, "constraints": [], "destruction": { "breakable": false, "fractureGroup": "lady", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "coat-green" } };
  (nodes["root"] ?? root).add(node_lady_green_hat_crown_135);
  nodes["lady-green-hat-crown"] = node_lady_green_hat_crown_135;
  const mesh_lady_green_hat_crown_135Geometry = endpoint_lady_green_hat_crown_135 ? new THREE.CylinderGeometry(endpoint_lady_green_hat_crown_135.endRadius, endpoint_lady_green_hat_crown_135.baseRadius, endpoint_lady_green_hat_crown_135.length, 8, 4) : new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  if (!endpoint_lady_green_hat_crown_135) {
    mesh_lady_green_hat_crown_135Geometry.scale(0.28600000000000003, 0.17, 0.28600000000000003);
  }
  const mesh_lady_green_hat_crown_135 = new THREE.Mesh(
    mesh_lady_green_hat_crown_135Geometry,
    materialMap["coat-green"] ?? new THREE.MeshStandardMaterial({ color: 8947848 })
  );
  mesh_lady_green_hat_crown_135.name = "lady-green hat crown";
  if (endpoint_lady_green_hat_crown_135) {
    mesh_lady_green_hat_crown_135.position.copy(endpoint_lady_green_hat_crown_135.midpoint);
    mesh_lady_green_hat_crown_135.quaternion.copy(endpoint_lady_green_hat_crown_135.quaternion);
  }
  mesh_lady_green_hat_crown_135.castShadow = options.castShadow ?? true;
  mesh_lady_green_hat_crown_135.receiveShadow = options.receiveShadow ?? true;
  mesh_lady_green_hat_crown_135.userData.sculptComponent = node_lady_green_hat_crown_135.userData.sculptComponent;
  node_lady_green_hat_crown_135.add(mesh_lady_green_hat_crown_135);
  meshes["lady-green-hat-crown"] = mesh_lady_green_hat_crown_135;
  colliders["lady-green-hat-crown"] = { "type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy is exact for a facet volume of this shape" };
  destructionGroups["lady"] ?? (destructionGroups["lady"] = []);
  destructionGroups["lady"].push(node_lady_green_hat_crown_135);
  {
    const parent = nodes["cobble-field"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const mat = materialMap["cobble"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.5, 0.055, 0.28];
    const axis = new THREE.Vector3(0, 1, 0).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 279);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 279; i++) {
      const ang = (0 + i * 360 / 279) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "cobble-sett-grid";
    parent.add(cluster);
  }
  {
    const parent = nodes["brick-relief"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const mat = materialMap["brick-facade"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.16, 0.13, 0.34];
    const axis = new THREE.Vector3(1, 0, 0).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 46);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 46; i++) {
      const ang = (0 + i * 360 / 46) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "brick-header-scatter";
    parent.add(cluster);
  }
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const mat = materialMap["window-muntin"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.05, 0.05, 0.05];
    const axis = new THREE.Vector3(1, 0, 0).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 96);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 96; i++) {
      const ang = (0 + i * 360 / 96) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "window-muntin-grid";
    parent.add(cluster);
  }
  {
    const parent = nodes["cab-wheel-rear-near"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    const mat = materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.05, 1.05, 0.05];
    const axis = new THREE.Vector3(1, 0, 0).normalize();
    const radius = 1.1;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 10);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 10; i++) {
      const ang = (0 + i * 360 / 10) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "wheel-spoke-ring";
    parent.add(cluster);
  }
  const POSTGEN = { "cobbles": [{ "p": [-2.3333, 0, -4.7818], "s": [0.4805, 0.055, 0.2867], "r": [0, -0.0147, 0], "t": 1.133 }, { "p": [-1.7836, 0, -4.7671], "s": [0.4887, 0.055, 0.288], "r": [0, 0.02, 0], "t": 0.843 }, { "p": [-1.2257, 0, -4.8162], "s": [0.5249, 0.055, 0.2818], "r": [0, -0.0143, 0], "t": 1.149 }, { "p": [-0.6318, 0, -4.8402], "s": [0.4591, 0.055, 0.2606], "r": [0, -18e-4, 0], "t": 0.946 }, { "p": [-0.1043, 0, -4.8502], "s": [0.4795, 0.055, 0.3006], "r": [0, -0.0228, 0], "t": 0.988 }, { "p": [0.4037, 0, -4.7884], "s": [0.4598, 0.055, 0.2977], "r": [0, 0.0284, 0], "t": 0.853 }, { "p": [0.9614, 0, -4.7538], "s": [0.4676, 0.055, 0.2775], "r": [0, 0.0362, 0], "t": 1.125 }, { "p": [1.5744, 0, -4.7579], "s": [0.5007, 0.055, 0.2783], "r": [0, 0.0293, 0], "t": 1.083 }, { "p": [2.1371, 0, -4.7742], "s": [0.4546, 0.055, 0.3051], "r": [0, -0.0152, 0], "t": 0.863 }, { "p": [-2.0444, 0, -4.5295], "s": [0.5305, 0.055, 0.2823], "r": [0, 11e-4, 0], "t": 0.911 }, { "p": [-1.5152, 0, -4.4659], "s": [0.5344, 0.055, 0.2998], "r": [0, 0.0148, 0], "t": 1.092 }, { "p": [-0.9123, 0, -4.5323], "s": [0.5187, 0.055, 0.2664], "r": [0, 77e-4, 0], "t": 0.88 }, { "p": [-0.3958, 0, -4.5164], "s": [0.5143, 0.055, 0.3008], "r": [0, -0.038, 0], "t": 0.998 }, { "p": [0.1673, 0, -4.5037], "s": [0.5165, 0.055, 0.2867], "r": [0, 0.02, 0], "t": 1.044 }, { "p": [0.7109, 0, -4.4668], "s": [0.4663, 0.055, 0.2679], "r": [0, 0.0116, 0], "t": 1.014 }, { "p": [1.3145, 0, -4.5308], "s": [0.5268, 0.055, 0.2522], "r": [0, -0.035, 0], "t": 0.84 }, { "p": [1.8609, 0, -4.464], "s": [0.5353, 0.055, 0.2726], "r": [0, 0.0385, 0], "t": 0.983 }, { "p": [2.352, 0, -4.5175], "s": [0.5375, 0.055, 0.2802], "r": [0, 0.0463, 0], "t": 0.848 }, { "p": [-2.2939, 0, -4.1094], "s": [0.5232, 0.055, 0.2558], "r": [0, 0.0126, 0], "t": 0.872 }, { "p": [-1.7661, 0, -4.1558], "s": [0.4973, 0.055, 0.2731], "r": [0, 0.0294, 0], "t": 0.965 }, { "p": [-1.203, 0, -4.1444], "s": [0.4898, 0.055, 0.2759], "r": [0, 0.0237, 0], "t": 0.866 }, { "p": [-0.6968, 0, -4.1409], "s": [0.54, 0.055, 0.263], "r": [0, 73e-4, 0], "t": 0.852 }, { "p": [-0.0578, 0, -4.2038], "s": [0.5386, 0.055, 0.2787], "r": [0, 61e-4, 0], "t": 0.94 }, { "p": [0.4829, 0, -4.1454], "s": [0.486, 0.055, 0.2834], "r": [0, -92e-4, 0], "t": 0.882 }, { "p": [1.0241, 0, -4.1117], "s": [0.4788, 0.055, 0.2872], "r": [0, -0.0334, 0], "t": 1.093 }, { "p": [1.568, 0, -4.1337], "s": [0.4757, 0.055, 0.2799], "r": [0, -0.0113, 0], "t": 0.932 }, { "p": [2.0535, 0, -4.1966], "s": [0.4815, 0.055, 0.2927], "r": [0, 0.0464, 0], "t": 0.893 }, { "p": [-2.0063, 0, -3.8302], "s": [0.515, 0.055, 0.3018], "r": [0, -0.0287, 0], "t": 0.877 }, { "p": [-1.4509, 0, -3.8341], "s": [0.4718, 0.055, 0.2694], "r": [0, -0.0282, 0], "t": 0.94 }, { "p": [-0.9069, 0, -3.8665], "s": [0.5369, 0.055, 0.2827], "r": [0, 0.034, 0], "t": 0.915 }, { "p": [-0.3784, 0, -3.8908], "s": [0.5242, 0.055, 0.2963], "r": [0, -0.0277, 0], "t": 0.929 }, { "p": [0.2029, 0, -3.8048], "s": [0.5101, 0.055, 0.2968], "r": [0, 27e-4, 0], "t": 0.943 }, { "p": [0.7442, 0, -3.8411], "s": [0.453, 0.055, 0.2812], "r": [0, -0.0278, 0], "t": 0.886 }, { "p": [1.3273, 0, -3.8388], "s": [0.5473, 0.055, 0.29], "r": [0, 0.0496, 0], "t": 1.116 }, { "p": [1.7861, 0, -3.8663], "s": [0.516, 0.055, 0.2532], "r": [0, -0.0165, 0], "t": 1.078 }, { "p": [2.3472, 0, -3.8754], "s": [0.4953, 0.055, 0.2573], "r": [0, 96e-4, 0], "t": 1.047 }, { "p": [-2.3258, 0, -3.5424], "s": [0.4727, 0.055, 0.2973], "r": [0, -0.0424, 0], "t": 0.93 }, { "p": [-1.7043, 0, -3.4811], "s": [0.5095, 0.055, 0.2848], "r": [0, 0.0164, 0], "t": 0.898 }, { "p": [-1.2374, 0, -3.4912], "s": [0.4639, 0.055, 0.2851], "r": [0, -0.0279, 0], "t": 0.921 }, { "p": [-0.6585, 0, -3.5131], "s": [0.5436, 0.055, 0.2809], "r": [0, -8e-4, 0], "t": 1.021 }, { "p": [-0.1397, 0, -3.5264], "s": [0.5065, 0.055, 0.2971], "r": [0, -0.04, 0], "t": 0.922 }, { "p": [0.4962, 0, -3.4939], "s": [0.509, 0.055, 0.2977], "r": [0, 76e-4, 0], "t": 1.01 }, { "p": [1.0327, 0, -3.5332], "s": [0.5188, 0.055, 0.2929], "r": [0, 0.0103, 0], "t": 1.017 }, { "p": [1.5882, 0, -3.4829], "s": [0.4835, 0.055, 0.288], "r": [0, -0.0428, 0], "t": 1.034 }, { "p": [2.0959, 0, -3.5199], "s": [0.5196, 0.055, 0.288], "r": [0, -6e-3, 0], "t": 1.001 }, { "p": [-1.9926, 0, -3.2514], "s": [0.474, 0.055, 0.2832], "r": [0, 0.0125, 0], "t": 1.07 }, { "p": [-1.4293, 0, -3.2325], "s": [0.4682, 0.055, 0.2966], "r": [0, -45e-4, 0], "t": 0.909 }, { "p": [-0.9606, 0, -3.2475], "s": [0.4624, 0.055, 0.2565], "r": [0, 0.0499, 0], "t": 1.037 }, { "p": [-0.3706, 0, -3.2385], "s": [0.5374, 0.055, 0.2607], "r": [0, -0.0449, 0], "t": 0.849 }, { "p": [0.1788, 0, -3.1818], "s": [0.4913, 0.055, 0.2938], "r": [0, -0.0329, 0], "t": 1.14 }, { "p": [0.7073, 0, -3.1744], "s": [0.5358, 0.055, 0.2603], "r": [0, -0.0495, 0], "t": 1.064 }, { "p": [1.2748, 0, -3.248], "s": [0.4658, 0.055, 0.3071], "r": [0, 0.0326, 0], "t": 1.113 }, { "p": [1.8233, 0, -3.1475], "s": [0.5233, 0.055, 0.3035], "r": [0, -0.0268, 0], "t": 0.961 }, { "p": [2.3977, 0, -3.1922], "s": [0.4795, 0.055, 0.2794], "r": [0, -96e-4, 0], "t": 1.009 }, { "p": [-2.3203, 0, -2.8433], "s": [0.4858, 0.055, 0.2979], "r": [0, -0.0201, 0], "t": 1.081 }, { "p": [-1.7778, 0, -2.9095], "s": [0.4926, 0.055, 0.3012], "r": [0, -0.0357, 0], "t": 1.13 }, { "p": [-1.1487, 0, -2.9229], "s": [0.4615, 0.055, 0.2572], "r": [0, 0.0221, 0], "t": 1.146 }, { "p": [-0.6621, 0, -2.8296], "s": [0.5168, 0.055, 0.2966], "r": [0, 0.0272, 0], "t": 1.01 }, { "p": [-0.1504, 0, -2.8766], "s": [0.5356, 0.055, 0.2538], "r": [0, -0.0158, 0], "t": 0.876 }, { "p": [0.4699, 0, -2.8519], "s": [0.4875, 0.055, 0.2967], "r": [0, 0.0286, 0], "t": 0.967 }, { "p": [0.9461, 0, -2.8638], "s": [0.5471, 0.055, 0.2555], "r": [0, -0.0138, 0], "t": 1.036 }, { "p": [1.5702, 0, -2.8379], "s": [0.5269, 0.055, 0.287], "r": [0, -28e-4, 0], "t": 0.859 }, { "p": [2.0718, 0, -2.8699], "s": [0.4726, 0.055, 0.2797], "r": [0, 0.0281, 0], "t": 1 }, { "p": [-1.9795, 0, -2.6074], "s": [0.5288, 0.055, 0.2935], "r": [0, -0.0392, 0], "t": 1.003 }, { "p": [-1.4351, 0, -2.5154], "s": [0.4816, 0.055, 0.3037], "r": [0, -0.0171, 0], "t": 1.021 }, { "p": [-0.8948, 0, -2.5998], "s": [0.5193, 0.055, 0.2651], "r": [0, -0.0497, 0], "t": 0.999 }, { "p": [-0.3392, 0, -2.5126], "s": [0.4787, 0.055, 0.2818], "r": [0, -0.0332, 0], "t": 1.154 }, { "p": [0.1772, 0, -2.5428], "s": [0.4726, 0.055, 0.2762], "r": [0, -0.0188, 0], "t": 0.951 }, { "p": [0.771, 0, -2.5616], "s": [0.4755, 0.055, 0.2939], "r": [0, 0.0412, 0], "t": 1.048 }, { "p": [1.2826, 0, -2.5649], "s": [0.4875, 0.055, 0.3002], "r": [0, 0.0279, 0], "t": 0.991 }, { "p": [1.8335, 0, -2.5237], "s": [0.4603, 0.055, 0.2532], "r": [0, 0.0274, 0], "t": 1.022 }, { "p": [2.3961, 0, -2.5979], "s": [0.4536, 0.055, 0.274], "r": [0, 0.035, 0], "t": 0.86 }, { "p": [-2.2768, 0, -2.2798], "s": [0.4561, 0.055, 0.2902], "r": [0, 0.0366, 0], "t": 1.11 }, { "p": [-1.7077, 0, -2.2929], "s": [0.4622, 0.055, 0.2909], "r": [0, 0.031, 0], "t": 1.063 }, { "p": [-1.1509, 0, -2.1888], "s": [0.4853, 0.055, 0.2594], "r": [0, 0.0473, 0], "t": 0.904 }, { "p": [-0.5985, 0, -2.2089], "s": [0.5417, 0.055, 0.271], "r": [0, 0.038, 0], "t": 1.113 }, { "p": [-0.0485, 0, -2.2449], "s": [0.4829, 0.055, 0.2994], "r": [0, -0.0175, 0], "t": 0.882 }, { "p": [0.418, 0, -2.263], "s": [0.5216, 0.055, 0.2622], "r": [0, -62e-4, 0], "t": 1.021 }, { "p": [1.0412, 0, -2.2674], "s": [0.5254, 0.055, 0.3024], "r": [0, -0.0316, 0], "t": 1.157 }, { "p": [1.552, 0, -2.2881], "s": [0.4556, 0.055, 0.3012], "r": [0, 0.0288, 0], "t": 1.067 }, { "p": [2.1245, 0, -2.2547], "s": [0.4677, 0.055, 0.2552], "r": [0, -0.0225, 0], "t": 1.058 }, { "p": [-2.0786, 0, -1.9587], "s": [0.4576, 0.055, 0.287], "r": [0, -0.0354, 0], "t": 1.035 }, { "p": [-1.4544, 0, -1.9212], "s": [0.5051, 0.055, 0.2849], "r": [0, -0.0125, 0], "t": 1.097 }, { "p": [-0.8706, 0, -1.879], "s": [0.5314, 0.055, 0.2811], "r": [0, 0.0273, 0], "t": 0.851 }, { "p": [-0.3757, 0, -1.9257], "s": [0.5024, 0.055, 0.2719], "r": [0, 91e-4, 0], "t": 0.941 }, { "p": [0.1901, 0, -1.9377], "s": [0.4977, 0.055, 0.258], "r": [0, -83e-4, 0], "t": 1.074 }, { "p": [0.6768, 0, -1.8825], "s": [0.4575, 0.055, 0.301], "r": [0, -0.0364, 0], "t": 0.888 }, { "p": [1.3235, 0, -1.8871], "s": [0.5487, 0.055, 0.2525], "r": [0, -9e-4, 0], "t": 0.85 }, { "p": [1.8276, 0, -1.9699], "s": [0.4921, 0.055, 0.2712], "r": [0, 0.0139, 0], "t": 0.941 }, { "p": [2.4006, 0, -1.9485], "s": [0.4847, 0.055, 0.2923], "r": [0, 0.0163, 0], "t": 0.925 }, { "p": [-2.3505, 0, -1.6433], "s": [0.4853, 0.055, 0.3001], "r": [0, -0.0196, 0], "t": 0.965 }, { "p": [-1.72, 0, -1.5657], "s": [0.5125, 0.055, 0.3054], "r": [0, 0.0267, 0], "t": 1.137 }, { "p": [-1.2456, 0, -1.6311], "s": [0.4946, 0.055, 0.2712], "r": [0, -64e-4, 0], "t": 1.006 }, { "p": [-0.6758, 0, -1.5517], "s": [0.5107, 0.055, 0.2585], "r": [0, -0.0279, 0], "t": 1.118 }, { "p": [-0.1417, 0, -1.5656], "s": [0.5287, 0.055, 0.3003], "r": [0, -0.0337, 0], "t": 0.915 }, { "p": [0.4288, 0, -1.6283], "s": [0.4908, 0.055, 0.2964], "r": [0, -0.0135, 0], "t": 1.159 }, { "p": [1.0377, 0, -1.6036], "s": [0.4668, 0.055, 0.2725], "r": [0, -0.0126, 0], "t": 1.081 }, { "p": [1.5045, 0, -1.5871], "s": [0.509, 0.055, 0.272], "r": [0, -0.0104, 0], "t": 0.898 }, { "p": [2.0889, 0, -1.6419], "s": [0.5396, 0.055, 0.2551], "r": [0, -0.0308, 0], "t": 1.026 }, { "p": [-1.9845, 0, -1.326], "s": [0.5092, 0.055, 0.2542], "r": [0, 0.0319, 0], "t": 0.971 }, { "p": [-1.4991, 0, -1.2997], "s": [0.5162, 0.055, 0.3014], "r": [0, 9e-4, 0], "t": 1.018 }, { "p": [-0.9729, 0, -1.3069], "s": [0.501, 0.055, 0.2571], "r": [0, 85e-4, 0], "t": 0.951 }, { "p": [-0.3444, 0, -1.276], "s": [0.4617, 0.055, 0.3021], "r": [0, -0.0108, 0], "t": 1.05 }, { "p": [0.2241, 0, -1.2708], "s": [0.5019, 0.055, 0.3011], "r": [0, -0.0162, 0], "t": 1.122 }, { "p": [0.6916, 0, -1.2593], "s": [0.46, 0.055, 0.2758], "r": [0, -91e-4, 0], "t": 0.912 }, { "p": [1.3054, 0, -1.264], "s": [0.5005, 0.055, 0.2539], "r": [0, -51e-4, 0], "t": 0.937 }, { "p": [1.7966, 0, -1.285], "s": [0.5171, 0.055, 0.2725], "r": [0, -0.0341, 0], "t": 0.983 }, { "p": [2.3667, 0, -1.3143], "s": [0.5178, 0.055, 0.2539], "r": [0, 0.0254, 0], "t": 0.887 }, { "p": [-2.3274, 0, -1.0091], "s": [0.4889, 0.055, 0.3072], "r": [0, 68e-4, 0], "t": 0.896 }, { "p": [-1.7212, 0, -0.9363], "s": [0.4731, 0.055, 0.2946], "r": [0, -0.0342, 0], "t": 1.136 }, { "p": [-1.2343, 0, -0.9618], "s": [0.4989, 0.055, 0.255], "r": [0, 0.0233, 0], "t": 0.998 }, { "p": [-0.665, 0, -0.9319], "s": [0.4839, 0.055, 0.3073], "r": [0, 52e-4, 0], "t": 0.913 }, { "p": [-0.0909, 0, -0.9628], "s": [0.539, 0.055, 0.2652], "r": [0, -0.0122, 0], "t": 1.035 }, { "p": [0.4331, 0, -0.9962], "s": [0.4529, 0.055, 0.2976], "r": [0, 0.0188, 0], "t": 1.141 }, { "p": [1.0356, 0, -0.9478], "s": [0.4707, 0.055, 0.2522], "r": [0, -0.0299, 0], "t": 1.141 }, { "p": [1.5339, 0, -1.0034], "s": [0.5249, 0.055, 0.279], "r": [0, 0.0451, 0], "t": 1.011 }, { "p": [2.0987, 0, -0.9723], "s": [0.4681, 0.055, 0.2828], "r": [0, 0.017, 0], "t": 1 }, { "p": [-2.078, 0, -0.6461], "s": [0.5146, 0.055, 0.2591], "r": [0, -0.0308, 0], "t": 1.063 }, { "p": [-1.4613, 0, -0.6771], "s": [0.4712, 0.055, 0.2753], "r": [0, -0.0435, 0], "t": 1.141 }, { "p": [-0.9334, 0, -0.5982], "s": [0.5384, 0.055, 0.2719], "r": [0, -0.0451, 0], "t": 1.085 }, { "p": [-0.4123, 0, -0.6687], "s": [0.5395, 0.055, 0.2999], "r": [0, 0.0308, 0], "t": 1.122 }, { "p": [0.1611, 0, -0.5894], "s": [0.5023, 0.055, 0.2942], "r": [0, -77e-4, 0], "t": 1.066 }, { "p": [0.7645, 0, -0.6303], "s": [0.5262, 0.055, 0.2597], "r": [0, -0.0123, 0], "t": 0.951 }, { "p": [1.2771, 0, -0.6168], "s": [0.527, 0.055, 0.2895], "r": [0, -0.0465, 0], "t": 1.039 }, { "p": [1.8244, 0, -0.5947], "s": [0.5116, 0.055, 0.2679], "r": [0, -0.0143, 0], "t": 0.987 }, { "p": [2.3886, 0, -0.6171], "s": [0.5145, 0.055, 0.303], "r": [0, -0.0271, 0], "t": 0.848 }, { "p": [-2.3365, 0, -0.3693], "s": [0.4663, 0.055, 0.3068], "r": [0, -74e-4, 0], "t": 1.073 }, { "p": [-1.7459, 0, -0.298], "s": [0.4861, 0.055, 0.2615], "r": [0, -43e-4, 0], "t": 0.951 }, { "p": [-1.151, 0, -0.2673], "s": [0.5337, 0.055, 0.2874], "r": [0, -0.0196, 0], "t": 1.011 }, { "p": [-0.6327, 0, -0.3601], "s": [0.5455, 0.055, 0.2711], "r": [0, -0.04, 0], "t": 0.982 }, { "p": [-0.1313, 0, -0.2834], "s": [0.4509, 0.055, 0.2985], "r": [0, 0.0498, 0], "t": 1.065 }, { "p": [0.4971, 0, -0.3508], "s": [0.5485, 0.055, 0.2544], "r": [0, 59e-4, 0], "t": 0.859 }, { "p": [0.9963, 0, -0.2911], "s": [0.5484, 0.055, 0.2886], "r": [0, 0.0346, 0], "t": 0.914 }, { "p": [1.5698, 0, -0.3369], "s": [0.4824, 0.055, 0.307], "r": [0, 0.0287, 0], "t": 0.994 }, { "p": [2.0881, 0, -0.3151], "s": [0.4982, 0.055, 0.286], "r": [0, -0.0305, 0], "t": 1.023 }, { "p": [-1.9861, 0, -0.0532], "s": [0.4851, 0.055, 0.2521], "r": [0, 0.0177, 0], "t": 1.13 }, { "p": [-1.4761, 0, -0.0321], "s": [0.4996, 0.055, 0.2597], "r": [0, 0.0238, 0], "t": 0.853 }, { "p": [-0.9359, 0, 0.0126], "s": [0.4593, 0.055, 0.3048], "r": [0, 0.0482, 0], "t": 0.9 }, { "p": [-0.3648, 0, -0.0368], "s": [0.5222, 0.055, 0.3071], "r": [0, 0.0313, 0], "t": 0.923 }, { "p": [0.2208, 0, 0.0143], "s": [0.4611, 0.055, 0.289], "r": [0, 0.0197, 0], "t": 0.85 }, { "p": [0.7784, 0, 75e-4], "s": [0.5474, 0.055, 0.298], "r": [0, -0.0291, 0], "t": 1.058 }, { "p": [1.3071, 0, -0.0318], "s": [0.467, 0.055, 0.2972], "r": [0, -0.0447, 0], "t": 1.091 }, { "p": [1.7752, 0, 0.0418], "s": [0.4752, 0.055, 0.3061], "r": [0, -0.0214, 0], "t": 1.033 }, { "p": [2.3687, 0, -0.0408], "s": [0.55, 0.055, 0.266], "r": [0, 75e-4, 0], "t": 0.958 }, { "p": [-2.2918, 0, 0.3642], "s": [0.4892, 0.055, 0.2577], "r": [0, -65e-4, 0], "t": 0.925 }, { "p": [-1.7606, 0, 0.3248], "s": [0.5191, 0.055, 0.265], "r": [0, 0.0347, 0], "t": 0.865 }, { "p": [-1.231, 0, 0.3453], "s": [0.4968, 0.055, 0.2667], "r": [0, -0.0304, 0], "t": 1.127 }, { "p": [-0.6681, 0, 0.2818], "s": [0.502, 0.055, 0.2868], "r": [0, 0.0425, 0], "t": 0.905 }, { "p": [-0.0774, 0, 0.3072], "s": [0.4863, 0.055, 0.2841], "r": [0, 72e-4, 0], "t": 1.093 }, { "p": [0.4225, 0, 0.3316], "s": [0.4749, 0.055, 0.3011], "r": [0, 61e-4, 0], "t": 1.074 }, { "p": [1.0284, 0, 0.2744], "s": [0.4692, 0.055, 0.2779], "r": [0, -0.0166, 0], "t": 1.099 }, { "p": [1.5484, 0, 0.2948], "s": [0.4704, 0.055, 0.2843], "r": [0, 0.0163, 0], "t": 1.035 }, { "p": [2.1436, 0, 0.3122], "s": [0.4979, 0.055, 0.2719], "r": [0, -0.0137, 0], "t": 1.134 }, { "p": [-2.0528, 0, 0.6665], "s": [0.5175, 0.055, 0.2871], "r": [0, 0.0164, 0], "t": 0.938 }, { "p": [-1.4715, 0, 0.6864], "s": [0.4788, 0.055, 0.2545], "r": [0, -0.0164, 0], "t": 1.022 }, { "p": [-0.8983, 0, 0.6568], "s": [0.4929, 0.055, 0.2803], "r": [0, 0.0216, 0], "t": 1.046 }, { "p": [-0.426, 0, 0.6541], "s": [0.5202, 0.055, 0.2668], "r": [0, -0.0207, 0], "t": 0.873 }, { "p": [0.1445, 0, 0.6642], "s": [0.4893, 0.055, 0.2603], "r": [0, 0.039, 0], "t": 0.887 }, { "p": [0.7471, 0, 0.6852], "s": [0.484, 0.055, 0.262], "r": [0, 0.0377, 0], "t": 0.994 }, { "p": [1.2706, 0, 0.5903], "s": [0.5299, 0.055, 0.2711], "r": [0, 0.0293, 0], "t": 0.963 }, { "p": [1.8528, 0, 0.6392], "s": [0.5328, 0.055, 0.2948], "r": [0, -0.0182, 0], "t": 1.157 }, { "p": [2.373, 0, 0.5991], "s": [0.483, 0.055, 0.2931], "r": [0, -0.0211, 0], "t": 0.858 }, { "p": [-2.2594, 0, 0.9411], "s": [0.4891, 0.055, 0.2717], "r": [0, -77e-4, 0], "t": 1.08 }, { "p": [-1.7406, 0, 0.9144], "s": [0.4587, 0.055, 0.2977], "r": [0, -0.0278, 0], "t": 1.087 }, { "p": [-1.163, 0, 0.9073], "s": [0.4504, 0.055, 0.2945], "r": [0, -0.0348, 0], "t": 0.892 }, { "p": [-0.6015, 0, 0.9126], "s": [0.489, 0.055, 0.2791], "r": [0, -0.0157, 0], "t": 1.098 }, { "p": [-0.1225, 0, 0.9894], "s": [0.5246, 0.055, 0.2972], "r": [0, 52e-4, 0], "t": 1.041 }, { "p": [0.4314, 0, 1.0014], "s": [0.5244, 0.055, 0.2545], "r": [0, 0.034, 0], "t": 0.924 }, { "p": [1.0257, 0, 0.9122], "s": [0.4815, 0.055, 0.2615], "r": [0, -0.0386, 0], "t": 0.898 }, { "p": [1.5849, 0, 0.9242], "s": [0.4992, 0.055, 0.2957], "r": [0, -0.0354, 0], "t": 0.979 }, { "p": [2.0623, 0, 0.9786], "s": [0.5338, 0.055, 0.2961], "r": [0, 0.0335, 0], "t": 1.114 }, { "p": [-2.037, 0, 1.328], "s": [0.5464, 0.055, 0.2749], "r": [0, 0.0461, 0], "t": 0.934 }, { "p": [-1.5193, 0, 1.2825], "s": [0.493, 0.055, 0.272], "r": [0, 42e-4, 0], "t": 1.142 }, { "p": [-0.8823, 0, 1.3277], "s": [0.4668, 0.055, 0.2568], "r": [0, 0.0141, 0], "t": 0.963 }, { "p": [-0.3317, 0, 1.2981], "s": [0.4653, 0.055, 0.2856], "r": [0, -0.0224, 0], "t": 0.98 }, { "p": [0.2008, 0, 1.2709], "s": [0.4815, 0.055, 0.2946], "r": [0, -0.011, 0], "t": 1.022 }, { "p": [0.7145, 0, 1.2611], "s": [0.4809, 0.055, 0.27], "r": [0, 0.0268, 0], "t": 0.952 }, { "p": [1.2537, 0, 1.2611], "s": [0.5229, 0.055, 0.2548], "r": [0, 0.0423, 0], "t": 0.974 }, { "p": [1.8354, 0, 1.3052], "s": [0.4727, 0.055, 0.2789], "r": [0, -0.0176, 0], "t": 1.063 }, { "p": [2.4248, 0, 1.2969], "s": [0.5436, 0.055, 0.3043], "r": [0, 11e-4, 0], "t": 0.886 }, { "p": [-2.2855, 0, 1.5747], "s": [0.5479, 0.055, 0.2936], "r": [0, 0.0153, 0], "t": 0.934 }, { "p": [-1.6967, 0, 1.6318], "s": [0.5484, 0.055, 0.3042], "r": [0, 0.0105, 0], "t": 0.964 }, { "p": [-1.204, 0, 1.5614], "s": [0.519, 0.055, 0.2683], "r": [0, -64e-4, 0], "t": 1.063 }, { "p": [-0.6864, 0, 1.5469], "s": [0.4787, 0.055, 0.2842], "r": [0, -69e-4, 0], "t": 0.944 }, { "p": [-0.0453, 0, 1.6118], "s": [0.4862, 0.055, 0.2979], "r": [0, 0.0189, 0], "t": 1.142 }, { "p": [0.4537, 0, 1.5952], "s": [0.5033, 0.055, 0.2704], "r": [0, -0.0252, 0], "t": 1.09 }, { "p": [0.9825, 0, 1.5779], "s": [0.4888, 0.055, 0.2526], "r": [0, -0.0291, 0], "t": 1.13 }, { "p": [1.552, 0, 1.555], "s": [0.4973, 0.055, 0.2674], "r": [0, -0.031, 0], "t": 0.97 }, { "p": [2.1288, 0, 1.6014], "s": [0.4676, 0.055, 0.3035], "r": [0, 0.0159, 0], "t": 0.958 }, { "p": [-1.9946, 0, 1.9479], "s": [0.5113, 0.055, 0.2643], "r": [0, 0.0347, 0], "t": 0.871 }, { "p": [-1.4989, 0, 1.8913], "s": [0.5057, 0.055, 0.2546], "r": [0, -0.0424, 0], "t": 0.917 }, { "p": [-0.9603, 0, 1.8812], "s": [0.4623, 0.055, 0.2535], "r": [0, -0.0466, 0], "t": 0.896 }, { "p": [-0.4195, 0, 1.8995], "s": [0.5392, 0.055, 0.2548], "r": [0, 0.0364, 0], "t": 0.981 }, { "p": [0.2086, 0, 1.8961], "s": [0.5009, 0.055, 0.2706], "r": [0, -0.0112, 0], "t": 0.852 }, { "p": [0.693, 0, 1.8774], "s": [0.4563, 0.055, 0.272], "r": [0, 58e-4, 0], "t": 0.961 }, { "p": [1.3274, 0, 1.9688], "s": [0.533, 0.055, 0.307], "r": [0, 0.0247, 0], "t": 0.928 }, { "p": [1.7705, 0, 1.9261], "s": [0.5256, 0.055, 0.2598], "r": [0, 0.0408, 0], "t": 0.865 }, { "p": [2.3887, 0, 1.8671], "s": [0.5032, 0.055, 0.2968], "r": [0, -42e-4, 0], "t": 0.999 }, { "p": [-2.2872, 0, 2.2254], "s": [0.521, 0.055, 0.274], "r": [0, -0.0415, 0], "t": 0.964 }, { "p": [-1.7451, 0, 2.2767], "s": [0.4663, 0.055, 0.2821], "r": [0, -0.0452, 0], "t": 0.948 }, { "p": [-1.2196, 0, 2.2813], "s": [0.5372, 0.055, 0.2588], "r": [0, -0.0451, 0], "t": 1.091 }, { "p": [-0.6683, 0, 2.2759], "s": [0.5055, 0.055, 0.2605], "r": [0, 0.0428, 0], "t": 0.961 }, { "p": [-0.117, 0, 2.2711], "s": [0.5099, 0.055, 0.2987], "r": [0, -0.0123, 0], "t": 1.066 }, { "p": [0.4002, 0, 2.2051], "s": [0.473, 0.055, 0.292], "r": [0, -0.0449, 0], "t": 1.151 }, { "p": [1.0288, 0, 2.2607], "s": [0.4853, 0.055, 0.2996], "r": [0, -0.0392, 0], "t": 1.002 }, { "p": [1.5929, 0, 2.2166], "s": [0.4611, 0.055, 0.2862], "r": [0, 0.0191, 0], "t": 0.909 }, { "p": [2.0907, 0, 2.2194], "s": [0.5056, 0.055, 0.261], "r": [0, -0.0115, 0], "t": 0.959 }, { "p": [-2.0284, 0, 2.5163], "s": [0.5311, 0.055, 0.3002], "r": [0, 0.0283, 0], "t": 1.01 }, { "p": [-1.5267, 0, 2.58], "s": [0.5021, 0.055, 0.2972], "r": [0, 0.0451, 0], "t": 1.101 }, { "p": [-0.9333, 0, 2.597], "s": [0.4558, 0.055, 0.2906], "r": [0, -36e-4, 0], "t": 1.035 }, { "p": [-0.3286, 0, 2.5863], "s": [0.5129, 0.055, 0.2533], "r": [0, 0.0299, 0], "t": 1.04 }, { "p": [0.1711, 0, 2.5597], "s": [0.4553, 0.055, 0.2896], "r": [0, 0.0274, 0], "t": 1.064 }, { "p": [0.6707, 0, 2.5193], "s": [0.4689, 0.055, 0.2874], "r": [0, 16e-4, 0], "t": 0.958 }, { "p": [1.2335, 0, 2.5286], "s": [0.53, 0.055, 0.2587], "r": [0, 0.0155, 0], "t": 0.991 }, { "p": [1.8795, 0, 2.5204], "s": [0.5133, 0.055, 0.2756], "r": [0, -0.0383, 0], "t": 1.091 }, { "p": [2.4043, 0, 2.5507], "s": [0.5221, 0.055, 0.2804], "r": [0, 0.0197, 0], "t": 1.134 }, { "p": [-2.2468, 0, 2.8268], "s": [0.5486, 0.055, 0.2785], "r": [0, -78e-4, 0], "t": 1.071 }, { "p": [-1.7315, 0, 2.8504], "s": [0.4577, 0.055, 0.2569], "r": [0, -0.0213, 0], "t": 0.868 }, { "p": [-1.1645, 0, 2.8434], "s": [0.5268, 0.055, 0.2919], "r": [0, -0.0229, 0], "t": 0.983 }, { "p": [-0.6866, 0, 2.9051], "s": [0.4523, 0.055, 0.2542], "r": [0, -0.0417, 0], "t": 1.023 }, { "p": [-0.0483, 0, 2.9311], "s": [0.526, 0.055, 0.2592], "r": [0, -0.0377, 0], "t": 0.978 }, { "p": [0.4223, 0, 2.9176], "s": [0.4814, 0.055, 0.2948], "r": [0, 0.0495, 0], "t": 1.159 }, { "p": [1.0253, 0, 2.8403], "s": [0.4799, 0.055, 0.2754], "r": [0, 0.0328, 0], "t": 0.843 }, { "p": [1.5004, 0, 2.8364], "s": [0.5485, 0.055, 0.2627], "r": [0, -0.0413, 0], "t": 0.853 }, { "p": [2.0509, 0, 2.9344], "s": [0.4533, 0.055, 0.2534], "r": [0, 0.014, 0], "t": 0.99 }, { "p": [-2.0665, 0, 3.2039], "s": [0.5031, 0.055, 0.2621], "r": [0, -0.0428, 0], "t": 1.052 }, { "p": [-1.4936, 0, 3.2488], "s": [0.4793, 0.055, 0.2991], "r": [0, 0.024, 0], "t": 0.996 }, { "p": [-0.9265, 0, 3.1789], "s": [0.4898, 0.055, 0.2753], "r": [0, -0.0174, 0], "t": 1.013 }, { "p": [-0.3385, 0, 3.1534], "s": [0.5024, 0.055, 0.3075], "r": [0, 0.0343, 0], "t": 1.149 }, { "p": [0.2031, 0, 3.149], "s": [0.5322, 0.055, 0.2733], "r": [0, 88e-4, 0], "t": 1.155 }, { "p": [0.7508, 0, 3.2285], "s": [0.4924, 0.055, 0.2806], "r": [0, 0.0163, 0], "t": 1.052 }, { "p": [1.3203, 0, 3.234], "s": [0.4822, 0.055, 0.2666], "r": [0, 0.0273, 0], "t": 1.084 }, { "p": [1.8689, 0, 3.2005], "s": [0.5234, 0.055, 0.2993], "r": [0, -0.0198, 0], "t": 0.916 }, { "p": [2.3756, 0, 3.18], "s": [0.4887, 0.055, 0.3035], "r": [0, 66e-4, 0], "t": 1.033 }, { "p": [-2.2652, 0, 3.5285], "s": [0.5336, 0.055, 0.2758], "r": [0, 0.0341, 0], "t": 1.007 }, { "p": [-1.7684, 0, 3.5418], "s": [0.4655, 0.055, 0.2667], "r": [0, 0.0218, 0], "t": 0.953 }, { "p": [-1.2108, 0, 3.4747], "s": [0.509, 0.055, 0.2973], "r": [0, 0.02, 0], "t": 0.895 }, { "p": [-0.6076, 0, 3.5672], "s": [0.4636, 0.055, 0.2882], "r": [0, -0.0277, 0], "t": 0.847 }, { "p": [-0.094, 0, 3.5255], "s": [0.4573, 0.055, 0.2583], "r": [0, 46e-4, 0], "t": 0.851 }, { "p": [0.4088, 0, 3.5663], "s": [0.4765, 0.055, 0.2601], "r": [0, 0.0287, 0], "t": 0.902 }, { "p": [1.017, 0, 3.4806], "s": [0.4654, 0.055, 0.2923], "r": [0, 0.0307, 0], "t": 1.116 }, { "p": [1.5365, 0, 3.5343], "s": [0.5347, 0.055, 0.2979], "r": [0, -0.0227, 0], "t": 1.016 }, { "p": [2.0916, 0, 3.4807], "s": [0.4567, 0.055, 0.2803], "r": [0, -0.0414, 0], "t": 0.907 }, { "p": [-2.038, 0, 3.8756], "s": [0.4679, 0.055, 0.2706], "r": [0, -0.0471, 0], "t": 0.994 }, { "p": [-1.4404, 0, 3.8181], "s": [0.49, 0.055, 0.2552], "r": [0, -0.0483, 0], "t": 1.04 }, { "p": [-0.8903, 0, 3.8233], "s": [0.5395, 0.055, 0.2811], "r": [0, -0.0209, 0], "t": 0.851 }, { "p": [-0.3358, 0, 3.7957], "s": [0.4693, 0.055, 0.287], "r": [0, -0.0128, 0], "t": 1.003 }, { "p": [0.2102, 0, 3.7863], "s": [0.4845, 0.055, 0.2956], "r": [0, -0.0439, 0], "t": 1.046 }, { "p": [0.7386, 0, 3.801], "s": [0.454, 0.055, 0.2963], "r": [0, -52e-4, 0], "t": 0.925 }, { "p": [1.2564, 0, 3.8333], "s": [0.5036, 0.055, 0.2738], "r": [0, -0.0355, 0], "t": 0.98 }, { "p": [1.8536, 0, 3.809], "s": [0.4884, 0.055, 0.2565], "r": [0, -0.045, 0], "t": 1.011 }, { "p": [2.349, 0, 3.8417], "s": [0.4947, 0.055, 0.258], "r": [0, -0.0225, 0], "t": 0.857 }, { "p": [-2.3317, 0, 4.1744], "s": [0.4925, 0.055, 0.2534], "r": [0, 0.0102, 0], "t": 1.067 }, { "p": [-1.7113, 0, 4.1339], "s": [0.5258, 0.055, 0.2896], "r": [0, -23e-4, 0], "t": 0.907 }, { "p": [-1.2431, 0, 4.2105], "s": [0.4805, 0.055, 0.2731], "r": [0, -0.0307, 0], "t": 0.85 }, { "p": [-0.6309, 0, 4.1355], "s": [0.4786, 0.055, 0.255], "r": [0, -0.0387, 0], "t": 1.016 }, { "p": [-0.0494, 0, 4.1424], "s": [0.5003, 0.055, 0.2789], "r": [0, 94e-4, 0], "t": 1.128 }, { "p": [0.4147, 0, 4.113], "s": [0.519, 0.055, 0.2841], "r": [0, -0.0233, 0], "t": 0.985 }, { "p": [1.0089, 0, 4.196], "s": [0.51, 0.055, 0.2543], "r": [0, 59e-4, 0], "t": 0.917 }, { "p": [1.5777, 0, 4.2088], "s": [0.4722, 0.055, 0.2655], "r": [0, -0.0101, 0], "t": 1.095 }, { "p": [2.0924, 0, 4.1647], "s": [0.5344, 0.055, 0.2944], "r": [0, 0.0435, 0], "t": 0.858 }, { "p": [-2.0127, 0, 4.4487], "s": [0.5084, 0.055, 0.3041], "r": [0, -61e-4, 0], "t": 1.143 }, { "p": [-1.4997, 0, 4.4915], "s": [0.4688, 0.055, 0.2833], "r": [0, -94e-4, 0], "t": 1.004 }, { "p": [-0.9691, 0, 4.5321], "s": [0.4684, 0.055, 0.2657], "r": [0, 0.0236, 0], "t": 0.973 }, { "p": [-0.3907, 0, 4.4326], "s": [0.5215, 0.055, 0.2766], "r": [0, 0.0384, 0], "t": 0.9 }, { "p": [0.1357, 0, 4.4964], "s": [0.4843, 0.055, 0.2626], "r": [0, 46e-4, 0], "t": 1.142 }, { "p": [0.7227, 0, 4.4659], "s": [0.5131, 0.055, 0.2584], "r": [0, 0.0377, 0], "t": 0.929 }, { "p": [1.3241, 0, 4.4314], "s": [0.4735, 0.055, 0.3076], "r": [0, 0.0466, 0], "t": 1.152 }, { "p": [1.8464, 0, 4.5343], "s": [0.4738, 0.055, 0.3074], "r": [0, -0.0142, 0], "t": 1.153 }, { "p": [2.3435, 0, 4.5089], "s": [0.5127, 0.055, 0.2917], "r": [0, 3e-4, 0], "t": 1.094 }], "headers": [{ "p": [-0.03, -2.9596, 2.3391], "s": [0.16, 0.13, 0.3002], "r": [0, 0, 0], "t": 0.975 }, { "p": [-0.03, -1.9229, -1.0643], "s": [0.16, 0.13, 0.4427], "r": [0, 0, 0], "t": 0.904 }, { "p": [-0.03, 0.3021, -1.0447], "s": [0.16, 0.13, 0.4189], "r": [0, 0, 0], "t": 1.034 }, { "p": [-0.03, 1.3332, -3.8019], "s": [0.16, 0.13, 0.4446], "r": [0, 0, 0], "t": 1.055 }, { "p": [-0.03, -3.1327, 4.018], "s": [0.16, 0.13, 0.2804], "r": [0, 0, 0], "t": 1.1 }, { "p": [-0.03, 3.1653, -1.8799], "s": [0.16, 0.13, 0.3187], "r": [0, 0, 0], "t": 1.086 }, { "p": [-0.03, 1.6485, 1.2061], "s": [0.16, 0.13, 0.3872], "r": [0, 0, 0], "t": 1.03 }, { "p": [-0.03, -1.4798, -3.8295], "s": [0.16, 0.13, 0.4165], "r": [0, 0, 0], "t": 0.946 }, { "p": [-0.03, 1.7256, -1.129], "s": [0.16, 0.13, 0.2839], "r": [0, 0, 0], "t": 0.918 }, { "p": [-0.03, 0.0696, -2.312], "s": [0.16, 0.13, 0.4082], "r": [0, 0, 0], "t": 1.079 }, { "p": [-0.03, 0.3258, -3.2229], "s": [0.16, 0.13, 0.268], "r": [0, 0, 0], "t": 1.061 }, { "p": [-0.03, -1.6509, -1.5488], "s": [0.16, 0.13, 0.3335], "r": [0, 0, 0], "t": 1.115 }, { "p": [-0.03, 2.2826, -1.8755], "s": [0.16, 0.13, 0.3357], "r": [0, 0, 0], "t": 1.063 }, { "p": [-0.03, 2.6074, 0.7499], "s": [0.16, 0.13, 0.2622], "r": [0, 0, 0], "t": 0.912 }, { "p": [-0.03, 0.1695, 2.4334], "s": [0.16, 0.13, 0.3941], "r": [0, 0, 0], "t": 0.943 }, { "p": [-0.03, 2.9505, 3.0784], "s": [0.16, 0.13, 0.4128], "r": [0, 0, 0], "t": 1.112 }, { "p": [-0.03, -1.9494, -1.8893], "s": [0.16, 0.13, 0.2733], "r": [0, 0, 0], "t": 1.045 }, { "p": [-0.03, 1.3198, -1.7653], "s": [0.16, 0.13, 0.2991], "r": [0, 0, 0], "t": 0.905 }, { "p": [-0.03, 1.8031, -1.5932], "s": [0.16, 0.13, 0.4088], "r": [0, 0, 0], "t": 0.972 }, { "p": [-0.03, 3.3103, 4.7503], "s": [0.16, 0.13, 0.3901], "r": [0, 0, 0], "t": 1.027 }, { "p": [-0.03, -3.3233, -0.5467], "s": [0.16, 0.13, 0.3102], "r": [0, 0, 0], "t": 0.918 }, { "p": [-0.03, -2.9958, 5.7928], "s": [0.16, 0.13, 0.2976], "r": [0, 0, 0], "t": 1.087 }, { "p": [-0.03, 0.1672, 5.4641], "s": [0.16, 0.13, 0.352], "r": [0, 0, 0], "t": 0.942 }, { "p": [-0.03, 2.908, 1.4452], "s": [0.16, 0.13, 0.2793], "r": [0, 0, 0], "t": 1.097 }, { "p": [-0.03, -3.0699, 5.4804], "s": [0.16, 0.13, 0.3145], "r": [0, 0, 0], "t": 1.091 }, { "p": [-0.03, 2.4063, -2.2363], "s": [0.16, 0.13, 0.3529], "r": [0, 0, 0], "t": 0.937 }, { "p": [-0.03, -2.4041, -1.7996], "s": [0.16, 0.13, 0.394], "r": [0, 0, 0], "t": 1.066 }, { "p": [-0.03, 2.3665, 0.6316], "s": [0.16, 0.13, 0.4044], "r": [0, 0, 0], "t": 1.114 }, { "p": [-0.03, 3.3906, 0.768], "s": [0.16, 0.13, 0.4191], "r": [0, 0, 0], "t": 1.019 }, { "p": [-0.03, -0.0144, -2.9035], "s": [0.16, 0.13, 0.3706], "r": [0, 0, 0], "t": 1.125 }, { "p": [-0.03, 2.5026, -1.5437], "s": [0.16, 0.13, 0.2871], "r": [0, 0, 0], "t": 1.014 }, { "p": [-0.03, 1.1594, 4.0037], "s": [0.16, 0.13, 0.3905], "r": [0, 0, 0], "t": 1.102 }, { "p": [-0.03, -3.0513, 5.1055], "s": [0.16, 0.13, 0.2696], "r": [0, 0, 0], "t": 0.907 }, { "p": [-0.03, -2.2764, 3.272], "s": [0.16, 0.13, 0.4443], "r": [0, 0, 0], "t": 0.944 }, { "p": [-0.03, 0.4046, -1.8648], "s": [0.16, 0.13, 0.2583], "r": [0, 0, 0], "t": 1.06 }, { "p": [-0.03, 2.7337, -2.1927], "s": [0.16, 0.13, 0.4515], "r": [0, 0, 0], "t": 1.094 }, { "p": [-0.03, -1.2594, -3.8486], "s": [0.16, 0.13, 0.2755], "r": [0, 0, 0], "t": 1.139 }, { "p": [-0.03, -1.95, 3.1586], "s": [0.16, 0.13, 0.2657], "r": [0, 0, 0], "t": 1 }, { "p": [-0.03, 3.203, -2.3864], "s": [0.16, 0.13, 0.4102], "r": [0, 0, 0], "t": 1.13 }, { "p": [-0.03, -0.6667, -1.5615], "s": [0.16, 0.13, 0.4491], "r": [0, 0, 0], "t": 1.002 }, { "p": [-0.03, 2.6982, 3.9582], "s": [0.16, 0.13, 0.3034], "r": [0, 0, 0], "t": 1.069 }, { "p": [-0.03, -2.157, -3.7875], "s": [0.16, 0.13, 0.3643], "r": [0, 0, 0], "t": 1.095 }, { "p": [-0.03, -3.0996, -1.6572], "s": [0.16, 0.13, 0.3292], "r": [0, 0, 0], "t": 1.061 }, { "p": [-0.03, -1.0279, -1.6155], "s": [0.16, 0.13, 0.3086], "r": [0, 0, 0], "t": 1.058 }, { "p": [-0.03, 0.7486, -2.2286], "s": [0.16, 0.13, 0.3284], "r": [0, 0, 0], "t": 0.906 }, { "p": [-0.03, 3.082, 5.3873], "s": [0.16, 0.13, 0.2705], "r": [0, 0, 0], "t": 1.025 }], "muntins": [{ "p": [-3.215, 6.35, 3.8433], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-1-glass" }, { "p": [-3.215, 6.35, 4.1567], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-1-glass" }, { "p": [-3.215, 6.01, 4], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-1-glass" }, { "p": [-3.215, 6.69, 4], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-1-glass" }, { "p": [-3.215, 6.35, 1.1933], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-2-glass" }, { "p": [-3.215, 6.35, 1.5067], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-2-glass" }, { "p": [-3.215, 6.01, 1.35], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-2-glass" }, { "p": [-3.215, 6.69, 1.35], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-2-glass" }, { "p": [-3.215, 6.35, -1.4567], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-3-glass" }, { "p": [-3.215, 6.35, -1.1433], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-3-glass" }, { "p": [-3.215, 6.01, -1.3], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-3-glass" }, { "p": [-3.215, 6.69, -1.3], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-3-glass" }, { "p": [-3.215, 6.35, -4.1067], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-4-glass" }, { "p": [-3.215, 6.35, -3.7933], "s": [0.05, 2.04, 0.055], "r": [0, 0, 0], "t": 1, "owner": "upper-window-4-glass" }, { "p": [-3.215, 6.01, -3.95], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-4-glass" }, { "p": [-3.215, 6.69, -3.95], "s": [0.05, 0.055, 0.94], "r": [0, 0, 0], "t": 1, "owner": "upper-window-4-glass" }, { "p": [-3.215, 3.2, 3.3033], "s": [0.05, 2.56, 0.055], "r": [0, 0, 0], "t": 1, "owner": "shopfront-a-glass" }, { "p": [-3.215, 3.2, 3.8967], "s": [0.05, 2.56, 0.055], "r": [0, 0, 0], "t": 1, "owner": "shopfront-a-glass" }, { "p": [-3.215, 2.56, 3.6], "s": [0.05, 0.055, 1.78], "r": [0, 0, 0], "t": 1, "owner": "shopfront-a-glass" }, { "p": [-3.215, 3.2, 3.6], "s": [0.05, 0.055, 1.78], "r": [0, 0, 0], "t": 1, "owner": "shopfront-a-glass" }, { "p": [-3.215, 3.84, 3.6], "s": [0.05, 0.055, 1.78], "r": [0, 0, 0], "t": 1, "owner": "shopfront-a-glass" }, { "p": [-3.215, 3.2, 0.7033], "s": [0.05, 2.56, 0.055], "r": [0, 0, 0], "t": 1, "owner": "shopfront-b-glass" }, { "p": [-3.215, 3.2, 1.2967], "s": [0.05, 2.56, 0.055], "r": [0, 0, 0], "t": 1, "owner": "shopfront-b-glass" }, { "p": [-3.215, 2.56, 1], "s": [0.05, 0.055, 1.78], "r": [0, 0, 0], "t": 1, "owner": "shopfront-b-glass" }, { "p": [-3.215, 3.2, 1], "s": [0.05, 0.055, 1.78], "r": [0, 0, 0], "t": 1, "owner": "shopfront-b-glass" }, { "p": [-3.215, 3.84, 1], "s": [0.05, 0.055, 1.78], "r": [0, 0, 0], "t": 1, "owner": "shopfront-b-glass" }, { "p": [-3.215, 3.2, -1.1633], "s": [0.05, 2.56, 0.055], "r": [0, 0, 0], "t": 1, "owner": "shop-window-c-glass" }, { "p": [-3.215, 3.2, -0.8367], "s": [0.05, 2.56, 0.055], "r": [0, 0, 0], "t": 1, "owner": "shop-window-c-glass" }, { "p": [-3.215, 2.56, -1], "s": [0.05, 0.055, 0.98], "r": [0, 0, 0], "t": 1, "owner": "shop-window-c-glass" }, { "p": [-3.215, 3.2, -1], "s": [0.05, 0.055, 0.98], "r": [0, 0, 0], "t": 1, "owner": "shop-window-c-glass" }, { "p": [-3.215, 3.84, -1], "s": [0.05, 0.055, 0.98], "r": [0, 0, 0], "t": 1, "owner": "shop-window-c-glass" }], "spokes": [{ "node": "cab-wheel-rear-near", "p": [0.5737, 0, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 0], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [0.4642, 0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 0.6283], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [0.1773, 0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 1.2566], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [-0.1773, 0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 1.885], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [-0.4642, 0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 2.5133], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [-0.5737, 0, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 3.1416], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [-0.4642, -0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 3.7699], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [-0.1773, -0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 4.3982], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [0.1773, -0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 5.0265], "t": 1 }, { "node": "cab-wheel-rear-near", "p": [0.4642, -0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 5.6549], "t": 1 }, { "node": "cab-wheel-front-near", "p": [0.405, 0, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 0], "t": 1 }, { "node": "cab-wheel-front-near", "p": [0.3277, 0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 0.6283], "t": 1 }, { "node": "cab-wheel-front-near", "p": [0.1252, 0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 1.2566], "t": 1 }, { "node": "cab-wheel-front-near", "p": [-0.1252, 0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 1.885], "t": 1 }, { "node": "cab-wheel-front-near", "p": [-0.3277, 0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 2.5133], "t": 1 }, { "node": "cab-wheel-front-near", "p": [-0.405, 0, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 3.1416], "t": 1 }, { "node": "cab-wheel-front-near", "p": [-0.3277, -0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 3.7699], "t": 1 }, { "node": "cab-wheel-front-near", "p": [-0.1252, -0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 4.3982], "t": 1 }, { "node": "cab-wheel-front-near", "p": [0.1252, -0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 5.0265], "t": 1 }, { "node": "cab-wheel-front-near", "p": [0.3277, -0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 5.6549], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [0.5737, 0, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 0], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [0.4642, 0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 0.6283], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [0.1773, 0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 1.2566], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [-0.1773, 0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 1.885], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [-0.4642, 0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 2.5133], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [-0.5737, 0, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 3.1416], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [-0.4642, -0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 3.7699], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [-0.1773, -0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 4.3982], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [0.1773, -0.5457, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 5.0265], "t": 1 }, { "node": "cab-wheel-rear-off", "p": [0.4642, -0.3372, 0], "s": [0.055, 1.1475, 0.055], "r": [0, 0, 5.6549], "t": 1 }, { "node": "cab-wheel-front-off", "p": [0.405, 0, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 0], "t": 1 }, { "node": "cab-wheel-front-off", "p": [0.3277, 0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 0.6283], "t": 1 }, { "node": "cab-wheel-front-off", "p": [0.1252, 0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 1.2566], "t": 1 }, { "node": "cab-wheel-front-off", "p": [-0.1252, 0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 1.885], "t": 1 }, { "node": "cab-wheel-front-off", "p": [-0.3277, 0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 2.5133], "t": 1 }, { "node": "cab-wheel-front-off", "p": [-0.405, 0, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 3.1416], "t": 1 }, { "node": "cab-wheel-front-off", "p": [-0.3277, -0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 3.7699], "t": 1 }, { "node": "cab-wheel-front-off", "p": [-0.1252, -0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 4.3982], "t": 1 }, { "node": "cab-wheel-front-off", "p": [0.1252, -0.3852, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 5.0265], "t": 1 }, { "node": "cab-wheel-front-off", "p": [0.3277, -0.2381, 0], "s": [0.055, 0.81, 0.055], "r": [0, 0, 5.6549], "t": 1 }], "haloIds": ["lamp-a-halo", "lamp-b-halo", "cab-lamp-a-halo"], "lampIds": ["lamp-a-lantern", "lamp-b-lantern", "cab-lamp-a", "cab-lamp-b"], "windowIds": ["upper-window-1-glass", "upper-window-2-glass", "upper-window-3-glass", "upper-window-4-glass", "shopfront-a-glass", "shopfront-b-glass", "shop-window-c-glass", "pier-window"], "rockIds": ["rock-mass", "rock-spur-west", "rock-spur-south"], "rockJitter": { "seed": 20250811, "amplitude": 0.32, "note": "postgen displaces lathe rings so the rock is not radially symmetric" }, "haloTint": "#ffb262", "haloOpacity": 0.085, "pointLights": [{ "id": "lamp-a-point", "color": "#ffc47a", "intensity": 2.4, "distance": 15, "decay": 1, "position": [-2.04, 5.02, 4.05], "attach": "lamp-a-lantern" }, { "id": "lamp-b-point", "color": "#ffc47a", "intensity": 2.4, "distance": 15, "decay": 1, "position": [-1.84, 5.02, -3.97], "attach": "lamp-b-lantern" }, { "id": "window-fill", "color": "#ffb765", "intensity": 1.6, "distance": 9, "decay": 1, "position": [-2.6, 3.2, 1.6], "attach": "shopfront-b-glass" }, { "id": "cab-lamp-point", "color": "#ffd089", "intensity": 1, "distance": 5, "decay": 1, "position": [2.27, 2.95, -0.52], "attach": "cab-lamp-a" }] };
  const instanceGeometry = new THREE.BoxGeometry(1, 1, 1);
  const addInstanced = (name, parent, baseMaterial, items) => {
    if (!items.length || !baseMaterial) return null;
    const mat = baseMaterial.clone();
    const mesh = new THREE.InstancedMesh(instanceGeometry, mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      e.set(it.r[0], it.r[1], it.r[2]);
      q.setFromEuler(e);
      v.set(it.p[0], it.p[1], it.p[2]);
      s.set(it.s[0], it.s[1], it.s[2]);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
      c.setScalar(it.t ?? 1).convertSRGBToLinear();
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const hideHost = (id) => {
    const h = meshes[id];
    if (h) h.visible = false;
  };
  hideHost("cobble-field");
  hideHost("brick-relief");
  if (nodes["cobble-field"]) {
    addInstanced("cobble-sett-grid", nodes["cobble-field"], materialMap["cobble"], POSTGEN.cobbles);
  }
  if (nodes["brick-relief"]) {
    addInstanced("brick-header-scatter", nodes["brick-relief"], materialMap["brick-facade"], POSTGEN.headers);
  }
  const muntins = POSTGEN.muntins.filter((m) => nodes[m.owner]);
  addInstanced("window-muntin-grid", root, materialMap["stone-trim"], muntins);
  const spokesByNode = {};
  for (const sp of POSTGEN.spokes) (spokesByNode[_a = sp.node] ?? (spokesByNode[_a] = [])).push(sp);
  for (const [nodeId, items] of Object.entries(spokesByNode)) {
    const parent = nodes[nodeId];
    if (!parent) continue;
    addInstanced(nodeId + "-spokes", parent, materialMap["iron-black"], items);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8, 1),
      materialMap["iron-black"] ?? new THREE.MeshStandardMaterial({ color: 1514021 })
    );
    hub.rotation.x = Math.PI / 2;
    hub.name = nodeId + "-hub";
    parent.add(hub);
  }
  const haloTexture = (() => {
    if (typeof document === "undefined") return null;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.62)");
    g.addColorStop(0.55, "rgba(255,255,255,0.16)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const halos = [];
  POSTGEN.haloIds.forEach((id, index) => {
    const node = nodes[id];
    const card = meshes[id];
    if (!node) return;
    if (card) card.visible = false;
    const spec = card ? card.userData.sculptComponent : null;
    const w = spec ? spec.dimensions.width : 2.4;
    const h = spec ? spec.dimensions.height : 2.4;
    const opacity = POSTGEN.haloOpacity;
    const material = new THREE.SpriteMaterial({
      map: haloTexture ?? null,
      color: new THREE.Color(POSTGEN.haloTint),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w, h, 1);
    sprite.name = id + "-sprite";
    node.add(sprite);
    halos.push({ sprite, base: opacity, phase: index * 1.7 });
  });
  const jitterRock = (id) => {
    const mesh = meshes[id];
    if (!mesh) return;
    const amp = POSTGEN.rockJitter.amplitude ?? 0.3;
    const seed = POSTGEN.rockJitter.seed ?? 1;
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const hash = (a, b, c) => {
      const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 0.017) * 43758.5453;
      return n - Math.floor(n);
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) {
        pos.setY(i, y - hash(x, y, z) * amp * 0.6);
        continue;
      }
      const k = 1 + (hash(Math.round(x * 8), Math.round(y * 8), Math.round(z * 8)) - 0.5) * 2 * (amp / Math.max(1, r) + 0.06);
      pos.setXYZ(i, x * k, y + (hash(z, x, y) - 0.5) * amp * 0.5, z * k);
    }
    const flat = geo.toNonIndexed();
    const fpos = flat.getAttribute("position");
    const colors = new Float32Array(fpos.count * 3);
    const base = new THREE.Color(16777215);
    for (let f = 0; f < fpos.count; f += 3) {
      const cx = (fpos.getX(f) + fpos.getX(f + 1) + fpos.getX(f + 2)) / 3;
      const cy = (fpos.getY(f) + fpos.getY(f + 1) + fpos.getY(f + 2)) / 3;
      const cz = (fpos.getZ(f) + fpos.getZ(f + 1) + fpos.getZ(f + 2)) / 3;
      const lit = hash(Math.round(cx * 5), Math.round(cy * 5), Math.round(cz * 5));
      const value = lit > 0.55 ? 1.18 : lit > 0.28 ? 0.86 : 0.6;
      base.setScalar(value).convertSRGBToLinear();
      for (let v = 0; v < 3; v++) {
        colors[(f + v) * 3] = base.r;
        colors[(f + v) * 3 + 1] = base.g;
        colors[(f + v) * 3 + 2] = base.b;
      }
    }
    flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    flat.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = flat;
    const mat = mesh.material.clone();
    mat.vertexColors = true;
    mat.flatShading = true;
    mesh.material = mat;
  };
  POSTGEN.rockIds.forEach(jitterRock);
  const stageLights = [];
  POSTGEN.pointLights.forEach((entry, index) => {
    const light = new THREE.PointLight(
      new THREE.Color(entry.color),
      entry.intensity,
      entry.distance,
      entry.decay
    );
    light.name = entry.id;
    const host = nodes[entry.attach];
    if (host) {
      host.add(light);
    } else {
      light.position.set(entry.position[0], entry.position[1], entry.position[2]);
      root.add(light);
    }
    stageLights.push({ light, base: entry.intensity, phase: index * 2.3 });
  });
  const flickerMats = [];
  POSTGEN.lampIds.forEach((id, i) => {
    const mesh = meshes[id];
    if (!mesh) return;
    const mat = mesh.material.clone();
    mesh.material = mat;
    flickerMats.push({ mat, base: mat.emissiveIntensity, phase: i * 1.9, rate: 6.4, depth: 0.14 });
  });
  POSTGEN.windowIds.forEach((id, i) => {
    const mesh = meshes[id];
    if (!mesh) return;
    const mat = mesh.material.clone();
    mesh.material = mat;
    flickerMats.push({ mat, base: mat.emissiveIntensity, phase: i * 0.83, rate: 0.55, depth: 0.06 });
  });
  let clock = 0;
  root.userData.tick = (dt) => {
    var _a2, _b;
    clock += Number.isFinite(dt) ? dt : 0;
    for (const f of flickerMats) {
      const n = Math.sin(clock * f.rate + f.phase) * 0.6 + Math.sin(clock * f.rate * 1.71 + f.phase * 2.1) * 0.3 + Math.sin(clock * f.rate * 0.43 + f.phase * 0.7) * 0.1;
      f.mat.emissiveIntensity = f.base * (1 + n * f.depth);
    }
    for (const l of stageLights) {
      const n = Math.sin(clock * 6.1 + l.phase) * 0.6 + Math.sin(clock * 9.7 + l.phase * 1.7) * 0.4;
      l.light.intensity = l.base * (1 + n * 0.1);
    }
    for (const h of halos) {
      const n = Math.sin(clock * 5.3 + h.phase) * 0.6 + Math.sin(clock * 8.9 + h.phase * 1.3) * 0.4;
      h.sprite.material.opacity = h.base * (1 + n * 0.16);
      const s = 1 + n * 0.05;
      h.sprite.scale.set(h.sprite.userData.w ?? h.sprite.scale.x, h.sprite.scale.y, 1);
      h.sprite.scale.multiplyScalar(1);
      h.sprite.scale.x = ((_a2 = h.sprite.userData).baseW ?? (_a2.baseW = h.sprite.scale.x)) * s;
      h.sprite.scale.y = ((_b = h.sprite.userData).baseH ?? (_b.baseH = h.sprite.scale.y)) * s;
    }
  };
  root.userData.tickContract = {
    signature: "tick(deltaSeconds: number): void",
    drives: ["gas lamp flicker (lantern emissive + point light + halo)", "window glow breathing"],
    movesGeometry: false
  };
  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups };
  root.userData.lookDevTargets = { "qualityPriority": "reference-fidelity-flat-shaded", "materialPass": { "albedoPaletteRequired": true, "roughnessVariationRequired": false, "normalOrBumpRequired": false, "localOverridesRequired": false, "minimumTextureResolution": 0, "flatFacetJustification": ["The reference plate is an untextured flat-shaded render: sampling any facet gives one constant value, so procedural albedo/roughness/normal/AO canvases would add detail the reference does not contain and would read as noise behind a foreground character.", "Value variation therefore comes from geometry normals plus per-instance colour jitter on the cobble and rock facets, which is the same mechanism the plate uses."], "independentMapChannels": [], "requiredSurfaceFrequencyBands": ["macro"], "referencePbrExtraction": { "requiredWhenSourceImagePresent": false, "skipReason": "extract_pbr_evidence.py infers roughness/height/normal from a photograph's shading; the source here is a synthetic flat-shaded render with no such signal, so its output would be inference about the renderer, not the material. Palette evidence was instead sampled directly (reference-palette.json / reference-palette2.json)." }, "mustAvoid": ["noise fields on flat-shaded facets", "saturated colour competing with a foreground character", "halo brighter than the lantern core"] }, "lightingPass": { "requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  root.userData.actionReadiness = {
    note: "Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets."
  };
  return root;
}
function createBakerStreetNightDioramaLookDevLights(mode = "neutral") {
  const lights = new THREE.Group();
  lights.name = "Baker Street Night Diorama look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === "reference" ? 16773334 : 15922431,
    3554114,
    mode === "grazing" ? 0.28 : mode === "reference" ? 0.72 : 0.85
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === "reference" ? 16764810 : 16774376,
    mode === "grazing" ? 4.2 : mode === "reference" ? 2.6 : 2.15
  );
  if (mode === "grazing") key.position.set(7.5, 1.1, 4);
  else if (mode === "reference") key.position.set(-4.5, 7.5, 5);
  else key.position.set(-4, 6, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -25e-5;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(11060479, mode === "grazing" ? 0.12 : 0.42);
  fill.position.set(4, 3, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(16773572, mode === "grazing" ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{ "id": "night-sky-hemisphere", "type": "hemisphere", "skyColor": "#26497c", "groundColor": "#131c33", "intensity": 1.55, "evidence": "background navy #07153a corner to #0d2f4f near the diorama; every up-facing surface (roof, pier cap) reads that same navy family" }, { "id": "moon-key", "type": "directional", "color": "#93b4e8", "intensity": 0.6, "position": [9, 12, 6], "evidence": "cool rim on the platform slab side faces (#39517d) and the pier's off face" }, { "id": "lamp-a-point", "type": "point", "color": "#ffc47a", "intensity": 2.4, "distance": 15, "decay": 1, "position": [-2.04, 5.02, 4.05], "evidence": "warm pool on pavement and brick around image (283,435); brick goes #633e43 -> #985a41" }, { "id": "lamp-b-point", "type": "point", "color": "#ffc47a", "intensity": 2.4, "distance": 15, "decay": 1, "position": [-1.84, 5.02, -3.97], "evidence": "second warm pool around image (590,295) lighting the quoin stripe to #cc8c5e" }, { "id": "sky-bounce-fill", "type": "directional", "color": "#6f8ccc", "intensity": 0.62, "position": [3, -4, 9], "evidence": "the platform slab's side faces sample #39517d, brighter and bluer than the rock immediately below them (#0d1325), and the rock's upper facets are lit from the front-left; a downward sky term cannot do that, so the plate carries a cool up-from-front fill" }, { "id": "window-fill", "type": "point", "color": "#ffb765", "intensity": 1.6, "distance": 9, "decay": 1, "position": [-2.6, 3.2, 1.6], "evidence": "shopfront glow spilling onto the pavement in front of the windows" }, { "id": "cab-lamp-point", "type": "point", "color": "#ffd089", "intensity": 1, "distance": 5, "decay": 1, "position": [2.27, 2.95, -0.52], "evidence": "small warm pool on the cab body and the near cobbles around image (600,552)" }, { "id": "exposure-and-tone", "type": "render-settings", "toneMapping": "ACESFilmic", "exposure": 1, "background": "#0b2344", "evidence": "plate background sampled #0b2344 at the frame's lower edge; contact shadows are soft and short, consistent with a large sky term plus small warm point sources" }];
  lights.userData.lookDevTargets = { "qualityPriority": "reference-fidelity-flat-shaded", "materialPass": { "albedoPaletteRequired": true, "roughnessVariationRequired": false, "normalOrBumpRequired": false, "localOverridesRequired": false, "minimumTextureResolution": 0, "flatFacetJustification": ["The reference plate is an untextured flat-shaded render: sampling any facet gives one constant value, so procedural albedo/roughness/normal/AO canvases would add detail the reference does not contain and would read as noise behind a foreground character.", "Value variation therefore comes from geometry normals plus per-instance colour jitter on the cobble and rock facets, which is the same mechanism the plate uses."], "independentMapChannels": [], "requiredSurfaceFrequencyBands": ["macro"], "referencePbrExtraction": { "requiredWhenSourceImagePresent": false, "skipReason": "extract_pbr_evidence.py infers roughness/height/normal from a photograph's shading; the source here is a synthetic flat-shaded render with no such signal, so its output would be inference about the renderer, not the material. Palette evidence was instead sampled directly (reference-palette.json / reference-palette2.json)." }, "mustAvoid": ["noise fields on flat-shaded facets", "saturated colour competing with a foreground character", "halo brighter than the lantern core"] }, "lightingPass": { "requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  return lights;
}
function frameBakerStreetNightDioramaCamera(camera, object, options = {}) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = camera.fov * Math.PI / 180;
  const distance = maxDim / 2 / Math.tan(fov / 2);
  const az = (options.azimuthDeg ?? 0) * Math.PI / 180;
  const el = (options.elevationDeg ?? 0) * Math.PI / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el)
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
function configureBakerStreetNightDioramaRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
function createBakerStreetStageNightRig() {
  const rig = new THREE.Group();
  rig.name = "Baker Street stage night rig";
  const hemi0 = new THREE.HemisphereLight(new THREE.Color("#26497c"), new THREE.Color("#131c33"), 1.55);
  hemi0.name = "night-sky-hemisphere";
  rig.add(hemi0);
  const dir1 = new THREE.DirectionalLight(new THREE.Color("#93b4e8"), 0.6);
  dir1.position.set(9, 12, 6);
  dir1.name = "moon-key";
  dir1.castShadow = true;
  dir1.shadow.mapSize.set(2048, 2048);
  dir1.shadow.camera.near = 1;
  dir1.shadow.camera.far = 60;
  dir1.shadow.camera.left = -12;
  dir1.shadow.camera.right = 12;
  dir1.shadow.camera.top = 12;
  dir1.shadow.camera.bottom = -12;
  dir1.shadow.bias = -6e-4;
  dir1.shadow.normalBias = 0.03;
  rig.add(dir1);
  const dir2 = new THREE.DirectionalLight(new THREE.Color("#6f8ccc"), 0.62);
  dir2.position.set(3, -4, 9);
  dir2.name = "sky-bounce-fill";
  rig.add(dir2);
  return rig;
}
function createBakerStreetStageIsoCamera(size = 1024) {
  const half = 9.697;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 120);
  const az = 45 * Math.PI / 180;
  const el = 28.7 * Math.PI / 180;
  const dist = 40;
  const target = new THREE.Vector3(0, 2.63, 0);
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * dist,
    target.y + Math.sin(el) * dist,
    target.z + Math.cos(az) * Math.cos(el) * dist
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.userData.target = target;
  camera.userData.pixelsPerUnit = size / (2 * half);
  return camera;
}
function createBakerStreetStage(options = {}) {
  return createBakerStreetNightDioramaModel(options);
}
export {
  configureBakerStreetNightDioramaRenderer,
  createBakerStreetNightDioramaLookDevLights,
  createBakerStreetNightDioramaModel,
  createBakerStreetStage,
  createBakerStreetStageIsoCamera,
  createBakerStreetStageNightRig,
  frameBakerStreetNightDioramaCamera
};
