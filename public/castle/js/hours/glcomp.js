/* The castle's pictures put on screen by the graphics card (WebGL2). hours.js still draws every pixel
   (cheap: 3 to 5 ms a frame); this adds, in fragment shaders, what reads from the scene's own buffers
   (each pixel's material, and its depth from where it stands on the ground):
     a halo round what shines (dual Kawase bloom at half size: lights, flames, lit windows), foliage in
     the wind, point lights over a relief taken within each material, cast shadows (the sun, the
     bonfire: screen-space shadows marched over the depth), cloud shadows, wet earth and stone, glass
     and metal, water (Fresnel, clear shallows, caustics), the light's own share snapped to steps in
     OKLab, sun shafts, distance haze and morning mist, a colour grade (3D lookup table);
   then the picture enlarged to the screen's own pixels with a sharp bilinear filter (flat pixels, one
   device pixel of blend at their edges: no uneven pixels at a scale that is not whole).
   With every effect off the output is the input, byte for byte (texelFetch); without WebGL2, hours.js
   keeps putImageData.
   window.HOURS_GL.make(canvas, { alpha, fit }) -> null, or { present(rgba, w, h, fx), snapshot(), lost() }
   (fit: the canvas takes the device pixels of its box; else it stays w x h). */
(function () {
  'use strict';
  const VS = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0., 1.); }`;
  const HEAD = `#version 300 es
precision highp float; precision highp int; precision mediump sampler3D;
out vec4 o;
`;
  // material flags (hours.js PROPS: byte 1 of each material's entry)
  const FLAGS = { GROUND: 1, EMISSIVE: 2, WATER: 4, GLASS: 8, FOLIAGE: 16, WETGROUND: 32, WETWALL: 64, METAL: 128 };

  /* The scene pass, at the castle's pixel size, into a texture (lit); rows as the buffers, row 0 at the top. */
  const MAIN = `${HEAD}
uniform sampler2D uImg; uniform sampler2D uMat; uniform sampler2D uBlue; uniform sampler2D uProps; uniform sampler2D uBase;
uniform sampler2D uDyn; uniform sampler2D uBloom; uniform sampler3D uLut;
uniform vec2 uSize; uniform float uT; uniform float uHasMat; uniform float uHasBase; uniform float uBaseK; uniform float uSkyN;
uniform float uGrade; uniform vec4 uSun; uniform vec3 uSunCol;
uniform int uNL; uniform vec4 uL[16]; uniform vec3 uLc[16]; uniform float uRelief; uniform float uFlat; uniform float uFireShadow;
uniform float uShadow; uniform vec3 uSunDir; uniform float uGlint; uniform float uClouds; uniform float uCover; uniform float uPan; uniform vec2 uWindV;
uniform float uWind; uniform float uWet; uniform vec3 uSkyHor; uniform vec3 uSkyTop; uniform float uHorY; uniform float uDay;
uniform float uWater; uniform vec2 uWaterY; uniform float uAerial; uniform float uMist; uniform vec2 uMistY; uniform vec3 uHaze;
uniform float uBloomK; uniform float uQuant; uniform int uDebug;
const float G = 3.; const float TT = .33; const float THICK = 22.; // (the ground seen from ~18 degrees up: depth 3 x its row; standing things this deep)
ivec2 SZ;
float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
ivec2 cl(ivec2 p) { return clamp(p, ivec2(0), SZ - 1); }
vec3 at(ivec2 p) { return texelFetch(uImg, cl(p), 0).rgb; }
int mat(ivec2 p) { return int(texelFetch(uMat, cl(p), 0).r * 255. + .5); }
ivec4 props(int m) { return ivec4(texelFetch(uProps, ivec2(m, 0), 0) * 255. + .5); }
bool dyn(ivec2 p) { return texelFetch(uDyn, cl(p), 0).r > 0.; } // (R8: a 1 reads 1/255)
bool skyM(int m) { return float(m) < uSkyN; }
float sky(vec2 p) { return uHasMat > 0. && skyM(mat(ivec2(p))) ? 1. : 0.; }
float baseY(ivec2 p) { return texelFetch(uBase, cl(p), 0).r * 255. * uBaseK - 1.; } // (-1: the sky, nothing stands there)
float depth(ivec2 p, float b) { return G * b + (b - float(p.y)) * TT; }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.; float a = .5; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; } return s; }
vec3 oklab(vec3 c) { // (Ottosson 2020, applied to the stored values: the steps are only for the light's share)
  vec3 l = vec3(dot(c, vec3(.4122214708, .5363325363, .0514459929)), dot(c, vec3(.2119034982, .6806995451, .1073969566)), dot(c, vec3(.0883024619, .2817188376, .6299787005)));
  l = pow(max(l, 0.), vec3(1. / 3.));
  return vec3(dot(l, vec3(.2104542553, .7936177850, -.0040720468)), dot(l, vec3(1.9779984951, -2.4285922050, .4505937099)), dot(l, vec3(.0259040371, .7827717662, -.8086757660))); }
vec3 unlab(vec3 L) {
  vec3 l = vec3(L.x + .3963377774 * L.y + .2158037573 * L.z, L.x - .1055613458 * L.y - .0638541728 * L.z, L.x - .0894841775 * L.y - 1.2914855480 * L.z); l = l * l * l;
  return vec3(dot(l, vec3(4.0767416621, -3.3077115913, .2309699292)), dot(l, vec3(-1.2684380046, 2.6097574011, -.3413193965)), dot(l, vec3(-.0041960863, -.7034186147, 1.7076147010))); }
/* Screen-space shadow: from p, a march towards the light over the depth; shadowed where something
   stands in front of the ray by less than THICK (Bend Studio's screen-space shadows, one dimension
   less). dir: screen pixels a step, dd: the ray's depth a step. */
float occluded(ivec2 p, float d0, vec2 dir, float dd, float len, float jit) {
  for (int k = 0; k < 44; k++) { // (a pixel a step: a post one pixel wide still casts)
    float s = 1.5 + float(k) + jit * .5; if (s > len) break; vec2 q = vec2(p) + .5 + dir * s;
    if (q.x < 0. || q.y < 0. || q.x >= uSize.x || q.y >= uSize.y) break;
    ivec2 qi = ivec2(q); float bq = baseY(qi); if (bq < 0. || bq - float(qi.y) < 8.) continue; // (the sky; grass, tufts and stones: too low to cast more than a smudge)
    float dQ = depth(qi, bq); float dR = d0 + dd * s;
    if (dQ > dR + 1.5 && dQ - dR < THICK) return 1.;
  }
  return 0.;
}
void main() {
  SZ = ivec2(uSize); ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c0 = texelFetch(uImg, p, 0); vec3 col = c0.rgb;
  float n = texelFetch(uBlue, p & 63, 0).r + .5 / 255.; // (blue noise: every dither here)
  bool hm = uHasMat > 0.;
  int m = hm ? mat(p) : 255; ivec4 pr = props(m); int fl = pr.g; bool isSky = hm && skyM(m); bool clean = hm && !dyn(p);
  if (uWind > 0. && hm) { // foliage in the wind: a clump borrows its neighbour's pixel, so leaves stir and edges flutter
    float ph = uT * 1.7 + fbm(vec2(float(p.x) * .045 + uT * .35, float(p.y) * .06)) * 7.; float s = sin(ph) * uWind;
    int dx = s > .62 ? 1 : s < -.62 ? -1 : 0;
    if (dx != 0) {
      ivec2 q = cl(p + ivec2(dx, 0)); int mq = mat(q); bool cq = !dyn(q);
      bool fp = clean && (fl & ${FLAGS.FOLIAGE}) != 0; bool fq = cq && (props(mq).g & ${FLAGS.FOLIAGE}) != 0;
      if ((fq && (fp || (isSky && clean))) || (fp && cq && skyM(mq))) { col = at(q); m = mq; pr = props(m); fl = pr.g; isSky = skyM(m); }
    }
  }
  bool ground = clean && (fl & ${FLAGS.GROUND}) != 0; // (bare ground: a figure drawn over it is no receiver)
  float b = uHasBase > 0. ? baseY(p) : -1.;
  vec3 unlit = col; // (the light's share is what the lights and the halo add to this: snapped to steps below)
  if (uNL > 0) { // point lights over the relief: a normal from the shading within one material (a dark stone by a pale one is no hollow)
    float l0 = lum(col); int fam = pr.r;
    #define LF(q) (hm && props(mat(q)).r != fam ? l0 : lum(at(q)))
    float gx = LF(p + ivec2(2, 0)) - LF(p - ivec2(2, 0)); float gy = LF(p + ivec2(0, 2)) - LF(p - ivec2(0, 2));
    vec3 N = normalize(vec3(-gx * uRelief, -gy * uRelief, 1.)); vec3 add = vec3(0.);
    for (int i = 0; i < 16; i++) {
      if (i >= uNL) break;
      vec2 d = uL[i].xy - vec2(p); float f = max(0., 1. - length(d) / uL[i].z); f *= f;
      if (f <= 0.) continue;
      if (i == 0 && uFireShadow > 0. && ground && b >= 0.) { // the bonfire's shadows on the ground
        float len = max(length(d), 1.); float d0 = depth(p, b);
        f *= 1. - .85 * occluded(p, d0, d / len, (G * uL[0].y - d0) / len, min(len - 3., 40.), n);
      }
      vec3 L = normalize(vec3(d, uL[i].z * .3)); add += uLc[i] * uL[i].w * f * max(max(dot(N, L), 0.) - uFlat * L.z, 0.); // (uFlat 1: only what the relief adds, the light itself already drawn)
    }
    add = max(add - .06, 0.) * (1. - sky(vec2(p))); // (no light on the far sky; its faint fringe dropped, not sprinkled)
    col = min(vec3(1.), col + col * add * 1.6 + add * .06);
  }
  if (uBloomK > 0.) col += texture(uBloom, (vec2(p) + .5) / uSize).rgb * uBloomK;
  if (uQuant > 0.) { // the light's share snapped to steps in OKLab (dithered), so it comes in pixels as the rest does
    vec3 a = oklab(unlit); vec3 d = (oklab(clamp(col, 0., 1.)) - a) / vec3(.035, .02, .02);
    vec3 q = sign(d) * floor(abs(d) + n * .999); q *= step(.5, abs(d)); // (under half a step: left alone, no sprinkle)
    if (dot(q, q) > 0.) col = unlab(a + q * vec3(.035, .02, .02)); else col = unlit;
  }
  if (!isSky && b >= 0. && uDay > 0.) {
    float shade = 0.;
    if (uShadow > 0. && ground) shade = uShadow * smoothstep(uHorY + 4., uHorY + 30., b) * occluded(p, depth(p, b), uSunDir.xy, uSunDir.z, 40., n); // the sun's shadows cast on the ground (faint far off: there they read as haze)
    if (uClouds > 0. && b > uHorY) { // clouds' shadows crossing the land with the wind (on the ground plane: stretched far off; not on the far ranges, where they smear)
      vec2 w = vec2((float(p.x) + uPan) * .016, G * b * .03) + uWindV * uT;
      float thr = mix(.72, .38, uCover);
      shade = max(shade, uClouds * step(n, smoothstep(thr - .05, thr + .05, fbm(w)))); // (a dithered rim, as pixel art draws a soft edge)
    }
    col *= mix(vec3(1.), vec3(.68, .7, .78), shade * uDay); // (the skylight left in the shade: a little bluer)
  }
  if (clean) { // the materials
    float far = clamp(1. - (float(p.y) - uHorY) / (uSize.y - uHorY), 0., 1.);
    if (uWet > 0. && (fl & ${FLAGS.WETGROUND}) != 0) { // wet earth and stone: darker, the sky in its puddles and its sheen
      float pool = smoothstep(.5, .66, fbm(vec2(p) * vec2(.07, .3)));
      col = mix(col * (1. - .16 * uWet), uSkyHor, uWet * (.03 + (.12 + .2 * far) * step(n, pool)));
    }
    if (uWet > 0. && (fl & ${FLAGS.WETWALL}) != 0) col *= 1. - .13 * uWet; // (rain-soaked walls and roofs darken)
    if ((fl & ${FLAGS.GLASS}) != 0 && uDay > 0.) { // the windows hold the sky, and the sun when it is behind us
      col = mix(col, mix(uSkyTop, uSkyHor, .5), .22 * uDay);
      col += uSunCol * uGlint * .5 * step(.8, hash(floor(vec2(p) / 3.)));
    }
    if ((fl & ${FLAGS.METAL}) != 0 && uDay > 0.) col = min(vec3(1.), col + uSunCol * .22 * uDay * smoothstep(.55, .85, lum(col))); // (the bright side of steel and gold catches more)
  }
  if (uWater > 0. && hm && (fl & ${FLAGS.WATER}) != 0) { // water: the sky far off (Fresnel), clear shallows by the banks, light knotted on the bottom
    float fr = 1. - smoothstep(uWaterY.x, uWaterY.y, float(p.y));
    float shallow = 0.;
    for (int k = 1; k <= 5; k++) { if ((props(mat(p + ivec2(0, k))).g & ${FLAGS.WATER}) == 0 || (props(mat(p - ivec2(0, k))).g & ${FLAGS.WATER}) == 0) { shallow = 1. - float(k) / 6.; break; } }
    if (uWind > 0.) { ivec2 l = p - ivec2(1, 0); ivec2 r = p + ivec2(1, 0); // (a breeze ruffles what it mirrors)
      if ((props(mat(l)).g & props(mat(r)).g & ${FLAGS.WATER}) != 0) col = mix(col, (at(l) + at(r)) * .5, .2 * min(uWind, 1.)); }
    col = mix(col, uSkyHor, .12 * fr * uWater * uDay);
    vec2 q = vec2(p) * vec2(.16, .4); float v = abs(fbm(q + uT * .25) - fbm(q * 1.31 - uT * .21 + 3.7));
    float caus = smoothstep(.055, .0, v) * shallow * uDay;
    col = mix(col, col * vec3(.82, .92, 1.02), .2 * (1. - fr) * uWater) + step(n, caus) * .1 * uWater;
  }
  if (uSun.z > 0.) { // shafts: how much open sky lies between this pixel and the sun, a decaying march
    // (GPU Gems 3, ch. 13: a radial march towards the sun over a mask of what shines; here the open sky
    // near the sun, brighter the closer: the gaps between clouds, towers and crests let it through)
    vec2 d = (uSun.xy - vec2(p)) / 28.; vec2 q = vec2(p) + d * n; float acc = 0.; float w = 1.; float R = uSize.y * .45;
    for (int k = 0; k < 28; k++) { acc += sky(q) * exp(-length(q - uSun.xy) / R) * (.4 + lum(at(ivec2(q)))) * w; w *= .96; q += d; }
    float r = acc / 12. * uSun.z * (1. - sky(vec2(p)) * .5); // (strongest in front of things, fainter on the sky itself)
    col = mix(col, uSunCol, clamp(r, 0., 1.) * .3); // (a veil, not a dither: a shaft is continuous or it reads as noise)
  }
  if (!isSky && b >= 0.) {
    if (uAerial > 0.) col = mix(col, uHaze, uAerial * (1. - smoothstep(uHorY - 6., uHorY + (uSize.y - uHorY) * .3, b))); // (the farthest things paler, bluer)
    if (uMist > 0. && b < uMistY.y + 3.) { // the morning's mist, low over the water and the meadow, drifting (not over what stands nearer)
      float band = smoothstep(uMistY.x, uMistY.x + 5., float(p.y)) * (1. - smoothstep(uMistY.y - 8., uMistY.y, float(p.y)));
      float f = fbm(vec2(float(p.x) * .025 + uT * uWindV.x * 2. + uPan * .02, float(p.y) * .18 - uT * .02));
      col = mix(col, uHaze, uMist * band * smoothstep(.38, .72, f) * .6);
    }
  }
  if (uGrade > 0.) col = mix(col, texture(uLut, clamp(col, 0., 1.) * (15. / 16.) + .5 / 16.).rgb, uGrade);
  if (uDebug == 1) col = mix(vec3(lum(c0.rgb)), vec3(1., 0., 0.), dyn(p) ? .8 : 0.); // (?fxdebug=dyn: what was drawn over the material, red)
  else if (uDebug == 2) col = b < 0. ? vec3(0., 0., .4) : vec3(b / uSize.y) * (ground ? vec3(.6, 1., .6) : vec3(1.)); // (=base: where each pixel stands, the ground green)
  else if (uDebug == 3) col = vec3(float(pr.r) / 120., float(fl) / 255., isSky ? 1. : 0.); // (=mat: family, flags, sky)
  o = vec4(col, c0.a);
}`;
  /* The halo, at half the size: what shines, then a Kawase step down and one up (Bjørge, "Bandwidth-
     efficient rendering", SIGGRAPH 2015): a wide soft glow for a handful of taps. */
  const BRIGHT = `${HEAD}
uniform sampler2D uImg; uniform sampler2D uMat; uniform sampler2D uProps; uniform vec2 uSize; uniform float uHasMat; uniform float uThr;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2; vec3 s = vec3(0.);
  for (int k = 0; k < 4; k++) {
    ivec2 q = clamp(p + ivec2(k & 1, k >> 1), ivec2(0), ivec2(uSize) - 1); vec3 c = texelFetch(uImg, q, 0).rgb;
    bool em = uHasMat > 0. && (int(texelFetch(uProps, ivec2(int(texelFetch(uMat, q, 0).r * 255. + .5), 0), 0).g * 255. + .5) & ${FLAGS.EMISSIVE}) != 0;
    float l = max(c.r, max(c.g, c.b)); float k2 = clamp((l - uThr) / max(1. - uThr, .05), 0., 1.);
    s += c * max(k2 * k2, em ? .8 : 0.);
  }
  o = vec4(s / 4., 1.);
}`;
  const DOWN = `${HEAD}
uniform sampler2D uSrc; uniform vec2 uTex;
void main() { vec2 uv = gl_FragCoord.xy * 2. * uTex; vec2 h = uTex;
  o = (texture(uSrc, uv) * 4. + texture(uSrc, uv - h) + texture(uSrc, uv + h) + texture(uSrc, uv + vec2(h.x, -h.y)) + texture(uSrc, uv - vec2(h.x, -h.y))) / 8.; }`;
  const UP = `${HEAD}
uniform sampler2D uSrc; uniform vec2 uTex; uniform vec2 uOut;
void main() { vec2 uv = gl_FragCoord.xy / uOut; vec2 h = uTex;
  o = (texture(uSrc, uv + vec2(-h.x * 2., 0.)) + texture(uSrc, uv + vec2(h.x * 2., 0.)) + texture(uSrc, uv + vec2(0., -h.y * 2.)) + texture(uSrc, uv + vec2(0., h.y * 2.))
    + (texture(uSrc, uv + vec2(-h.x, h.y)) + texture(uSrc, uv + h) + texture(uSrc, uv + vec2(h.x, -h.y)) + texture(uSrc, uv - h)) * 2.) / 12.; }`;
  /* The picture onto the screen: at a whole-number scale, texel for texel; else a sharp bilinear filter
     (each pixel flat, its edge blended over the one device pixel that straddles it). */
  const OUT = `${HEAD}
uniform sampler2D uLit; uniform vec2 uSize; uniform vec2 uOut; uniform float uSharp;
void main() {
  vec2 px = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y) / uOut * uSize; // (picture row 0 at the top of the screen)
  if (uSharp < .5) { o = texelFetch(uLit, ivec2(px), 0); return; }
  vec2 box = min(uSize / uOut, vec2(1.)); vec2 tx = px - .5 * box;
  vec2 off = smoothstep(1. - box, vec2(1.), fract(tx));
  o = texture(uLit, (floor(tx) + .5 + off) / uSize);
}`;
  const MAIN_U = ['uImg', 'uMat', 'uBlue', 'uProps', 'uBase', 'uDyn', 'uBloom', 'uLut', 'uSize', 'uT', 'uHasMat', 'uHasBase', 'uBaseK', 'uSkyN', 'uGrade', 'uSun', 'uSunCol',
    'uNL', 'uL', 'uLc', 'uRelief', 'uFlat', 'uFireShadow', 'uShadow', 'uSunDir', 'uGlint', 'uClouds', 'uCover', 'uPan', 'uWindV', 'uWind', 'uWet', 'uSkyHor', 'uSkyTop',
    'uHorY', 'uDay', 'uWater', 'uWaterY', 'uAerial', 'uMist', 'uMistY', 'uHaze', 'uBloomK', 'uQuant', 'uDebug'];
  // texture units: each texture keeps its own (no program samples the texture it draws into)
  const UNIT = { img: 0, mat: 1, blue: 2, lut: 3, props: 4, base: 5, dyn: 6, lit: 8, ba: 9, bb: 10, bc: 11 };

  function make(canvas, { alpha = false, fit = false } = {}) {
    const gl = canvas.getContext('webgl2', { alpha, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl) return null;
    let P = {}; let tex = {}; let fbo = {}; let sizes = {}; let lutKey = ''; let propsOf = null; let lastW = 0; let lastH = 0;
    let dev = null; // (the canvas box in device pixels, fit: ResizeObserver)
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    function program(fs, names) {
      const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(prog, 0, 'aPos'); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const U = {}; names.forEach((k) => { U[k] = gl.getUniformLocation(prog, k); }); return { prog, U };
    }
    const texture = (unit, filter, target = gl.TEXTURE_2D) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(target, k, filter));
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R].forEach((k) => gl.texParameteri(target, k, gl.CLAMP_TO_EDGE));
      return t;
    };
    /** Upload a w x h picture (R8, or RGBA8) to its texture, reallocated only on a new size. */
    function upload(name, w, h, data, rgba) {
      gl.activeTexture(gl.TEXTURE0 + UNIT[name]); gl.bindTexture(gl.TEXTURE_2D, tex[name]);
      const s = sizes[name]; const fmt = rgba ? gl.RGBA : gl.RED;
      if (!s || s[0] !== w || s[1] !== h) { gl.texImage2D(gl.TEXTURE_2D, 0, rgba ? gl.RGBA8 : gl.R8, w, h, 0, fmt, gl.UNSIGNED_BYTE, data); sizes[name] = [w, h]; }
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, fmt, gl.UNSIGNED_BYTE, data);
    }
    /** A render target w x h (its texture filtered linearly: the halo and the enlargement sample between texels). */
    function target(name, w, h) {
      const s = sizes[name]; if (s && s[0] === w && s[1] === h) return;
      gl.activeTexture(gl.TEXTURE0 + UNIT[name]); gl.bindTexture(gl.TEXTURE_2D, tex[name]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); sizes[name] = [w, h];
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[name]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[name], 0);
    }
    function init() {
      P = { main: program(MAIN, MAIN_U), bright: program(BRIGHT, ['uImg', 'uMat', 'uProps', 'uSize', 'uHasMat', 'uThr']),
        down: program(DOWN, ['uSrc', 'uTex']), up: program(UP, ['uSrc', 'uTex', 'uOut']), out: program(OUT, ['uLit', 'uSize', 'uOut', 'uSharp']) };
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // (one triangle over the screen)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      tex = {}; sizes = {}; fbo = {};
      ['img', 'mat', 'blue', 'props', 'base', 'dyn'].forEach((k) => { tex[k] = texture(UNIT[k], gl.NEAREST); });
      ['lit', 'ba', 'bb', 'bc'].forEach((k) => { tex[k] = texture(UNIT[k], gl.LINEAR); fbo[k] = gl.createFramebuffer(); });
      upload('blue', 64, 64, window.HOURS_BLUE || new Uint8Array(4096).fill(128));
      ['mat', 'base', 'dyn'].forEach((k) => upload(k, 1, 1, new Uint8Array([0])));
      upload('props', 256, 1, new Uint8Array(1024), true);
      tex.lut = texture(UNIT.lut, gl.LINEAR, gl.TEXTURE_3D);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 16, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutOf(null));
      const M = P.main; gl.useProgram(M.prog);
      [['uImg', 'img'], ['uMat', 'mat'], ['uBlue', 'blue'], ['uProps', 'props'], ['uBase', 'base'], ['uDyn', 'dyn'], ['uBloom', 'bc'], ['uLut', 'lut']].forEach(([u, k]) => gl.uniform1i(M.U[u], UNIT[k]));
      gl.useProgram(P.bright.prog); gl.uniform1i(P.bright.U.uImg, UNIT.img); gl.uniform1i(P.bright.U.uMat, UNIT.mat); gl.uniform1i(P.bright.U.uProps, UNIT.props);
      gl.useProgram(P.down.prog); gl.uniform1i(P.down.U.uSrc, UNIT.ba);
      gl.useProgram(P.up.prog); gl.uniform1i(P.up.U.uSrc, UNIT.bb);
      gl.useProgram(P.out.prog); gl.uniform1i(P.out.U.uLit, UNIT.lit);
      lutKey = ''; propsOf = null; lastW = 0; lastH = 0;
    }
    if (fit && window.ResizeObserver) {
      const ro = new ResizeObserver(([e]) => {
        const d = e.devicePixelContentBoxSize && e.devicePixelContentBoxSize[0]; // (exact device pixels, where the browser tells them)
        dev = d ? [d.inlineSize, d.blockSize] : [Math.round(e.contentRect.width * devicePixelRatio), Math.round(e.contentRect.height * devicePixelRatio)];
      });
      try { ro.observe(canvas, { box: 'device-pixel-content-box' }); } catch { ro.observe(canvas); }
    }
    const pass = (p, name, w, h) => { gl.useProgram(p.prog); gl.bindFramebuffer(gl.FRAMEBUFFER, name ? fbo[name] : null); gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const rgb = (c, d) => (c || d).map((v) => v / 255);

    /** present: the picture (RGBA bytes, w x h) on the canvas, with fx (each field optional, absent = off):
     *  grade {golden, dawn, storm, snow}; sun [x, y, strength] + sunCol (shafts); mat (material index a
     *  pixel, Uint8Array w x h), dyn (1 where something was drawn over the material), props (256 x RGBA:
     *  family, flags), skyN (indices under it are the sky); base (Uint8Array: 1 + the row the pixel stands
     *  on, x 1/baseK; 0 the sky); lights [[x, y, r, k, [r,g,b]]], relief, flat, fireShadow; shadow + sunDir
     *  [dx, dy, ddepth] a screen step, glint; clouds, cover, pan, windV; wind; wet; skyHor, skyTop, horY,
     *  day; water, waterY; aerial, mist, mistY, haze; bloom {k, thr}; quant; t (s). */
    function present(rgba, w, h, fx = {}) {
      if (gl.isContextLost()) return false;
      upload('img', w, h, rgba, true);
      const hasMat = Boolean(fx.mat && fx.mat.length === w * h);
      if (hasMat) { upload('mat', w, h, fx.mat); upload('dyn', w, h, fx.dyn && fx.dyn.length === w * h ? fx.dyn : new Uint8Array(w * h)); }
      if (fx.props && fx.props !== propsOf) { propsOf = fx.props; upload('props', 256, 1, fx.props, true); }
      const hasBase = hasMat && Boolean(fx.base && fx.base.length === w * h);
      if (hasBase) upload('base', w, h, fx.base);
      const bloom = fx.bloom && fx.bloom.k > 0 ? fx.bloom : null;
      if (bloom) { // the halo: bright -> ba (1/2), down -> bb (1/4), up -> bc (1/2)
        const hw = Math.ceil(w / 2); const hh = Math.ceil(h / 2); const qw = Math.ceil(hw / 2); const qh = Math.ceil(hh / 2);
        target('ba', hw, hh); target('bb', qw, qh); target('bc', hw, hh);
        gl.useProgram(P.bright.prog); gl.uniform2f(P.bright.U.uSize, w, h); gl.uniform1f(P.bright.U.uHasMat, hasMat ? 1 : 0); gl.uniform1f(P.bright.U.uThr, bloom.thr ?? 0.8);
        pass(P.bright, 'ba', hw, hh);
        gl.useProgram(P.down.prog); gl.uniform2f(P.down.U.uTex, 1 / hw, 1 / hh); pass(P.down, 'bb', qw, qh);
        gl.useProgram(P.up.prog); gl.uniform2f(P.up.U.uTex, 1 / qw, 1 / qh); gl.uniform2f(P.up.U.uOut, hw, hh); pass(P.up, 'bc', hw, hh);
      } else target('bc', 1, 1);
      target('lit', w, h);
      const U = P.main.U; gl.useProgram(P.main.prog);
      gl.uniform2f(U.uSize, w, h); gl.uniform1f(U.uT, fx.t || 0); gl.uniform1f(U.uHasMat, hasMat ? 1 : 0); gl.uniform1f(U.uHasBase, hasBase ? 1 : 0); gl.uniform1f(U.uBaseK, fx.baseK || 1);
      gl.uniform1f(U.uSkyN, hasMat ? fx.skyN || 0 : 0);
      const g = fx.grade; const gk = g ? ['golden', 'dawn', 'storm', 'snow'].map((k) => Math.round((g[k] || 0) * 50) / 50).join() : '';
      const graded = g && /[1-9]/.test(gk);
      if (graded && gk !== lutKey) { lutKey = gk; gl.activeTexture(gl.TEXTURE0 + UNIT.lut); gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, 16, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, lutOf(g)); }
      gl.uniform1f(U.uGrade, graded ? 1 : 0);
      const sun = fx.sun && fx.sun[2] > 0 && hasMat ? fx.sun : null;
      gl.uniform4f(U.uSun, sun ? sun[0] : 0, sun ? sun[1] : 0, sun ? sun[2] : 0, 0);
      gl.uniform3fv(U.uSunCol, rgb(fx.sunCol, [255, 236, 190]));
      const ls = (fx.lights || []).slice(0, 16);
      gl.uniform1i(U.uNL, ls.length);
      if (ls.length) {
        gl.uniform4fv(U.uL, ls.flatMap((l) => [l[0], l[1], l[2], l[3]])); gl.uniform3fv(U.uLc, ls.flatMap((l) => l[4].map((v) => v / 255)));
        gl.uniform1f(U.uRelief, fx.relief ?? 2.5); gl.uniform1f(U.uFlat, fx.flat ? 1 : 0);
      }
      gl.uniform1f(U.uFireShadow, hasBase && fx.fireShadow ? 1 : 0);
      const sd = fx.sunDir || [0, -1, 0];
      gl.uniform1f(U.uShadow, hasBase ? fx.shadow || 0 : 0); gl.uniform3f(U.uSunDir, sd[0], sd[1], sd[2]); gl.uniform1f(U.uGlint, fx.glint || 0);
      gl.uniform1f(U.uClouds, hasBase ? fx.clouds || 0 : 0); gl.uniform1f(U.uCover, fx.cover ?? 0.3); gl.uniform1f(U.uPan, fx.pan || 0);
      gl.uniform2fv(U.uWindV, fx.windV || [0, 0]); gl.uniform1f(U.uWind, hasMat ? fx.wind || 0 : 0); gl.uniform1f(U.uWet, hasMat ? fx.wet || 0 : 0);
      gl.uniform3fv(U.uSkyHor, rgb(fx.skyHor, [200, 210, 220])); gl.uniform3fv(U.uSkyTop, rgb(fx.skyTop, [120, 150, 200]));
      gl.uniform1f(U.uHorY, fx.horY ?? h * 0.4); gl.uniform1f(U.uDay, fx.day ?? 0);
      gl.uniform1f(U.uWater, hasMat ? fx.water || 0 : 0); gl.uniform2fv(U.uWaterY, fx.waterY || [0, h]);
      gl.uniform1f(U.uAerial, hasBase ? fx.aerial || 0 : 0); gl.uniform1f(U.uMist, hasBase ? fx.mist || 0 : 0); gl.uniform2fv(U.uMistY, fx.mistY || [0, 0]);
      gl.uniform3fv(U.uHaze, rgb(fx.haze, [200, 210, 220]));
      gl.uniform1f(U.uBloomK, bloom ? bloom.k : 0); gl.uniform1f(U.uQuant, fx.quant ? 1 : 0); gl.uniform1i(U.uDebug, ['', 'dyn', 'base', 'mat'].indexOf(fx.debug || '') | 0);
      pass(P.main, 'lit', w, h);
      // onto the canvas: its device pixels (fit), else the picture's own size
      const [ow, oh] = fit && dev && dev[0] > 0 && dev[1] > 0 ? dev : [w, h];
      if (canvas.width !== ow || canvas.height !== oh) { canvas.width = ow; canvas.height = oh; }
      const whole = ow % w === 0 && oh % h === 0 && ow / w === oh / h;
      gl.useProgram(P.out.prog); gl.uniform2f(P.out.U.uSize, w, h); gl.uniform2f(P.out.U.uOut, ow, oh); gl.uniform1f(P.out.U.uSharp, whole ? 0 : 1);
      pass(P.out, null, ow, oh);
      lastW = w; lastH = h;
      return true;
    }
    /** The last picture presented, effects included, at its own pixel size (ImageData), or null. */
    function snapshot() {
      if (!lastW || gl.isContextLost()) return null;
      const px = new Uint8ClampedArray(lastW * lastH * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.lit); gl.readPixels(0, 0, lastW, lastH, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return new ImageData(px, lastW, lastH); // (the lit texture's row 0 is the picture's top: no flip)
    }
    try { init(); } catch (e) { console.warn('castle on the graphics card: off,', e.message); return null; }
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => { try { init(); } catch { /* (stays blank until the next resize asks again) */ } });
    return { present, snapshot, lost: () => gl.isContextLost() };
  }

  /* The grade, as a 16^3 lookup table built from four looks, each weighted 0..1 (the hour and the
     weather choose them): the golden hour (warm lights, teal shadows: split toning), dawn (rose lights,
     violet shadows), a storm (colour drained, cooler), snow (blue shadows, the light lifted). */
  const LOOKS = {
    golden: (r, g, b, y) => [r + 0.07 * y - 0.02 * (1 - y), g + 0.025 * y + 0.01 * (1 - y), b - 0.05 * y + 0.04 * (1 - y)],
    dawn: (r, g, b, y) => [r + 0.05 * y + 0.01 * (1 - y), g - 0.015 * y - 0.01 * (1 - y), b + 0.03 * y + 0.05 * (1 - y)],
    storm: (r, g, b, y) => [(r * 0.6 + y * 0.4) * 0.93, (g * 0.6 + y * 0.4) * 0.96, (b * 0.6 + y * 0.4) * 1.03],
    snow: (r, g, b, y) => [r * 0.97 + 0.02, g * 0.99 + 0.03, b + 0.06 * (1 - y) + 0.02],
  };
  function lutOf(w) {
    const out = new Uint8Array(16 * 16 * 16 * 4);
    for (let bi = 0; bi < 16; bi += 1) for (let gi = 0; gi < 16; gi += 1) for (let ri = 0; ri < 16; ri += 1) {
      let c = [ri / 15, gi / 15, bi / 15];
      if (w) Object.keys(LOOKS).forEach((k) => { const a = w[k] || 0; if (a <= 0) return; const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; const t = LOOKS[k](c[0], c[1], c[2], y); c = c.map((v, j) => v + (t[j] - v) * a); });
      const i = ((bi * 16 + gi) * 16 + ri) * 4; out[i] = Math.round(Math.min(1, Math.max(0, c[0])) * 255); out[i + 1] = Math.round(Math.min(1, Math.max(0, c[1])) * 255); out[i + 2] = Math.round(Math.min(1, Math.max(0, c[2])) * 255); out[i + 3] = 255;
    }
    return out;
  }
  window.HOURS_GL = { make, FLAGS };
})();
