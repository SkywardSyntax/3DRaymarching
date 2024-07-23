import { useEffect, useState } from 'react';
import { mat4 } from 'gl-matrix';

function Home() {
  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const vertexShaderSource = `
      attribute vec4 a_position;
      void main() {
        gl_Position = a_position;
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_zoom;

      float sphere(vec3 p) {
        return length(p) - 1.0;
      }

      float rayMarching(vec3 ro, vec3 rd) {
        float t = 0.0;
        for (int i = 0; i < 100; i++) {
          vec3 p = ro + t * rd;
          float d = sphere(p);
          if (d < 0.001) break;
          t += d;
        }
        return t;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        uv = (uv - 0.5) * 2.0; // Map UV to range [-1, 1]
        uv.x *= u_resolution.x / u_resolution.y; // Maintain aspect ratio

        vec3 ro = vec3(0.0, 0.0, 5.0 / u_zoom); // Ray origin
        vec3 rd = normalize(vec3(uv, -1.0)); // Ray direction

        float t = rayMarching(ro, rd);
        vec3 pos = ro + t * rd;
        vec3 color = vec3(1.0 - t / 10.0, 0.5 * sin(u_time + t), 1.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders');
      return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const zoomLocation = gl.getUniformLocation(program, 'u_zoom');

    if (positionLocation === -1) {
      console.error('Unable to get attribute location for a_position');
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function render(time) {
      time *= 0.001; // convert to seconds
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time);
      gl.uniform1f(zoomLocation, zoom);

      // Clear the canvas with a specific color
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    // Handle window resize events
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Handle pinch-to-zoom events
    let initialPinchDistance = null;
    let lastZoom = zoom;

    function handleTouchStart(event) {
      if (event.touches.length === 2) {
        initialPinchDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
        lastZoom = zoom;
      }
    }

    function handleTouchMove(event) {
      if (event.touches.length === 2 && initialPinchDistance !== null) {
        const currentPinchDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
        const pinchRatio = currentPinchDistance / initialPinchDistance;
        setZoom(Math.max(0.1, lastZoom * pinchRatio));
      }
    }

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      document.body.removeChild(canvas);
    };
  }, [zoom]);

  return null;
}

export default Home;
