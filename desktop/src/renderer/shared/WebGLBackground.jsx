// Same WebGL2 amber/orange shader as extension — no THREE.js dependency
import { useEffect, useRef } from 'react';

const VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

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
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.0 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.x *= u_res.x / u_res.y;
  float t = u_time * 0.10;
  float n = fbm(uv * 2.6 + vec2(t*.35, t*.28)) + 0.38 * fbm(uv * 5.2 - vec2(t*.55, t*.18));
  vec3 dark = vec3(0.04, 0.033, 0.026);
  vec3 amber = vec3(0.92, 0.52, 0.08);
  vec3 hot = vec3(0.97, 0.34, 0.02);
  vec3 col = mix(dark, amber, smoothstep(0.32, 0.68, n));
  col = mix(col, hot, smoothstep(0.58, 0.88, n) * 0.45);
  vec2 vig = (gl_FragCoord.xy / u_res) - 0.5;
  col *= clamp(1.0 - dot(vig, vig) * 1.6, 0.0, 1.0);
  fragColor = vec4(col, 1.0);
}`;

export default function WebGLBackground({ style = {} }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) return;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const t0 = performance.now();

    function resize() {
      const p = canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.width = (p?.offsetWidth ?? 800) * dpr;
      canvas.height = (p?.offsetHeight ?? 600) * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    function frame() {
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); gl.deleteProgram(prog); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, width: '100%', height: '100%',
      zIndex: 0, display: 'block',
      background: 'linear-gradient(135deg, #0d0c0b 0%, #1a1108 100%)',
      ...style,
    }} />
  );
}
