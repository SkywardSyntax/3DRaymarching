import { useEffect } from 'react';
import { mat4 } from 'gl-matrix';

function Home() {
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

      float sphere(vec3 p, float r) {
        return length(p) - r;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        uv = (uv - 0.5) * 2.0; // Map UV to range [-1, 1]
        uv.x *= u_resolution.x / u_resolution.y; // Maintain aspect ratio

        vec3 ro = vec3(0.0, 0.0, 5.0); // Ray origin
        vec3 rd = normalize(vec3(uv, -1.0)); // Ray direction

        float totalDistance = 0.0; // Total distance traveled by the ray
        float minDistance = 0.001; // Minimum distance to consider as hitting the surface
        float maxDistance = 100.0; // Maximum distance before giving up
        const int maxSteps = 64; // Maximum number of steps

        for (int i = 0; i < maxSteps; i++) {
          vec3 pos = ro + totalDistance * rd;
          float dist = sphere(pos, 1.0);
          if (dist < minDistance) {
            break;
          }
          totalDistance += dist;
          if (totalDistance > maxDistance) {
            totalDistance = maxDistance;
            break;
          }
        }

        vec3 color = vec3(0.0);
        if (totalDistance < maxDistance) {
          color = vec3(1.0 - totalDistance / 10.0, 0.5 * sin(u_time + totalDistance), 1.0);
        }
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

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      document.body.removeChild(canvas);
    };
  }, []);

  return null;
}

export default Home;
