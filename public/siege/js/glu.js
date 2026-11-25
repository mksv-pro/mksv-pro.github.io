/* Siege's few WebGL2 helpers: programs (their uniforms found by name), buffers, textures, framebuffers,
   and 4x4 matrices (column-major, as GL reads them). Loaded before render.js. */
(function () {
  /** A program from two sources; attribute locations bound by name (so one vertex array serves several
      programs); `u` the uniforms by name, `use()` binds it. Throws with the log on a compile error. */
  function program(gl, vs, fs, attribs = {}) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'); throw new Error(`shader: ${log}\n${lines}`); } return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    Object.entries(attribs).forEach(([n, i]) => gl.bindAttribLocation(p, i, n)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i += 1) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u, use: () => gl.useProgram(p) };
  }
  /** A vertex array over one interleaved buffer: layout [[location, size, type ('f' float, 'b' signed byte normalised)], ...]. */
  function vertexArray(gl, data, layout, usage = gl.STATIC_DRAW) {
    const vao = gl.createVertexArray(); const buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    const stride = layout.reduce((s, [, n]) => s + n * 4, 0); let off = 0;
    layout.forEach(([loc, n]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off); off += n * 4; });
    gl.bindVertexArray(null); return { vao, buf, stride };
  }
  /** A 2D array texture from layers of RGBA8 (each w x h), mipmapped; mag 'nearest' keeps the pixels square up close. */
  function arrayTexture(gl, w, h, layers, o = {}) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, w, h, layers.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    layers.forEach((px, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, px));
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, o.mag === 'linear' ? gl.LINEAR : gl.NEAREST);
    const wrap = o.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT; gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, wrap);
    const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(o.aniso || 8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  }
  /** A plain 2D texture (no mipmaps). */
  function texture(gl, w, h, internal, format, type, data, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap); return t;
  }
  /** A framebuffer over the given attachments ([attachment point, texture or renderbuffer]); throws if incomplete. */
  function framebuffer(gl, atts) {
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    atts.forEach(([pt, obj]) => { if (obj instanceof WebGLTexture) gl.framebufferTexture2D(gl.FRAMEBUFFER, pt, gl.TEXTURE_2D, obj, 0); else gl.framebufferRenderbuffer(gl.FRAMEBUFFER, pt, gl.RENDERBUFFER, obj); });
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete: 0x${st.toString(16)}`); return f;
  }
  function renderbuffer(gl, samples, internal, w, h) { const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); if (samples > 1) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, internal, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, internal, w, h); return r; }

  /* ---- 4x4 matrices, column-major Float32Array(16) ---- */
  const m4 = {
    mul(a, b, o = new Float32Array(16)) { for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
    /** A perspective projection looking down -z (fovy: the vertical angle). */
    persp(fovy, aspect, n, f) { const t = 1 / Math.tan(fovy / 2); const o = new Float32Array(16); o[0] = t / aspect; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o; },
    ortho(l, r, b, t, n, f) { const o = new Float32Array(16); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o; },
    /** The view from eye along the basis (R right, U up, F forward): view x = R, y = U, z = -F. */
    view(R, U, F, eye) { const o = new Float32Array(16); [R, U, [-F[0], -F[1], -F[2]]].forEach((a, r) => { o[r] = a[0]; o[4 + r] = a[1]; o[8 + r] = a[2]; o[12 + r] = -(a[0] * eye[0] + a[1] * eye[1] + a[2] * eye[2]); }); o[15] = 1; return o; },
    /** From models.js's 3x4 row-major [r00 r01 r02 tx  r10 ...] (into o). */
    from34(m, o = new Float32Array(16)) { o[0] = m[0]; o[1] = m[4]; o[2] = m[8]; o[3] = 0; o[4] = m[1]; o[5] = m[5]; o[6] = m[9]; o[7] = 0; o[8] = m[2]; o[9] = m[6]; o[10] = m[10]; o[11] = 0; o[12] = m[3]; o[13] = m[7]; o[14] = m[11]; o[15] = 1; return o; },
    ident() { const o = new Float32Array(16); o[0] = 1; o[5] = 1; o[10] = 1; o[15] = 1; return o; },
  };

  window.SIEGE_GLU = { program, vertexArray, arrayTexture, texture, framebuffer, renderbuffer, m4 };
}());
