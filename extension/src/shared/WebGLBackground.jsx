import { useEffect, useRef } from 'react';

const VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Animated amber/orange FBM noise field — no THREE.js dependency
const FRAG = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec2  u_res;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),             hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p  = p * 2.0 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  uv.x *= aspect;

  float t = u_time * 0.10;
  float n  = fbm(uv * 2.6 + vec2(t * 0.35, t * 0.28));
  n       += 0.38 * fbm(uv * 5.2 - vec2(t * 0.55, t * 0.18));

  vec3 dark   = vec3(0.04, 0.033, 0.026);
  vec3 amber  = vec3(0.92, 0.52, 0.08);
  vec3 hot    = vec3(0.97, 0.34, 0.02);

  vec3 col = mix(dark,  amber, smoothstep(0.32, 0.68, n));
  col      = mix(col,   hot,   smoothstep(0.58, 0.88, n) * 0.45);

  // Vignette
  vec2 vig = (gl_FragCoord.xy / u_res) - 0.5;
  float v  = 1.0 - dot(vig, vig) * 1.6;
  col *= clamp(v, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}
`;

export default function WebGLBackground({ style = {} }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) return; // fallback: CSS background shows through

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[WebGLBg shader error]', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vert = compile(gl.VERTEX_SHADER,   VERT);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[WebGLBg link error]', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes  = gl.getUniformLocation(prog, 'u_res');
    const t0    = performance.now();

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect() ?? { width: 300, height: 200 };
      const dpr  = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    function frame() {
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uRes,  canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
        background: 'linear-gradient(135deg, #0d0c0b 0%, #1a1108 100%)',
        ...style,
      }}
    />
  );
}
