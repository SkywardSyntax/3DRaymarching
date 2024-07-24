import { useEffect, useState } from 'react';
import { mat4, vec3 } from 'gl-matrix';
import debounce from 'lodash.debounce';
import { render } from 'solid-js/web';
import DialogBox from '../components/DialogBox';

function Home() {
  const [zoom, setZoom] = useState(1.0);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [lastMouseY, setLastMouseY] = useState(0);
  const [lightPos, setLightPos] = useState([2.0, 2.0, 2.0]);
  const [roughness, setRoughness] = useState(0.1);

  const debouncedSetRoughness = debounce(setRoughness, 100);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    document.body.appendChild(canvasContainer);
    canvasContainer.appendChild(canvas);
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
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
      uniform vec3 u_lightPos;
      uniform mat4 u_rotation;
      uniform float u_roughness;

      struct Material {
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
        float shininess;
      };

      struct Light {
        vec3 position;
        vec3 color;
      };

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                       mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                       mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
      }

      float sphere(vec3 p) {
        return length(p) - 1.0 + u_roughness * noise(p * 10.0);
      }

      float calculateShadow(vec3 ro, vec3 rd) {
        float res = 1.0;
        float t = 0.01;
        for (int i = 0; i < 25; i++) {
          vec3 p = ro + t * rd;
          float d = sphere(p);
          if (d < 0.001) {
            res = 0.0;
            break;
          }
          res = min(res, 10.0 * d / t);
          t += d;
        }
        return res;
      }

      float softShadow(vec3 ro, vec3 rd) {
        float res = 1.0;
        float t = 0.01;
        float k = 16.0; // Smoothing factor
        for (int i = 0; i < 50; i++) {
          vec3 p = ro + t * rd;
          float d = sphere(p);
          if (d < 0.001) {
            res = 0.0;
            break;
          }
          res = min(res, k * d / t);
          t += d;
        }
        return res;
      }

      float ambientOcclusion(vec3 p, vec3 n) {
        float occlusion = 0.0;
        float scale = 1.0;
        for (int i = 1; i <= 5; i++) {
          float dist = float(i) * 0.1;
          occlusion += (dist - sphere(p + n * dist)) * scale;
          scale *= 0.5;
        }
        return 1.0 - occlusion;
      }

      float rayMarching(vec3 ro, vec3 rd, vec3 lightPos) {
        float t = 0.0;
        for (int i = 0; i < 50; i++) {
          vec3 p = ro + t * rd;
          float d = sphere(p);
          if (d < 0.001) break;
          t += d;
        }
        return t;
      }

      vec3 phongShading(vec3 pos, vec3 normal, vec3 viewDir, Light light, Material material) {
        vec3 lightDir = normalize(light.position - pos);
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        vec3 ambient = material.ambient * light.color;
        vec3 diffuse = material.diffuse * diff * light.color;
        vec3 specular = material.specular * spec * light.color;
        return ambient + diffuse + specular;
      }

      void renderLightSource(vec3 lightPos) {
        float d = sphere(lightPos);
        if (d < 0.001) {
          gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0); // Yellow color for light source
        }
      }

      bool isInFrustum(vec3 p) {
        vec4 clipSpacePos = u_rotation * vec4(p, 1.0);
        vec3 ndcPos = clipSpacePos.xyz / clipSpacePos.w;
        return all(lessThanEqual(abs(ndcPos), vec3(1.0)));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        uv = (uv - 0.5) * 2.0; // Map UV to range [-1, 1]
        uv.x *= u_resolution.x / u_resolution.y; // Maintain aspect ratio

        vec3 ro = vec3(0.0, 0.0, 5.0 / u_zoom); // Ray origin
        vec3 rd = normalize(vec3(uv, -1.0)); // Ray direction

        // Apply rotation to ray direction
        rd = (u_rotation * vec4(rd, 0.0)).xyz;

        float t = rayMarching(ro, rd, u_lightPos);
        vec3 pos = ro + t * rd;

        if (!isInFrustum(pos)) {
          discard;
        }

        vec3 lightDir = normalize(u_lightPos - pos);
        float shadow = softShadow(pos + lightDir * 0.01, lightDir);
        float ao = ambientOcclusion(pos, lightDir);

        vec3 normal = normalize(pos);
        vec3 viewDir = normalize(-pos);
        Material material = Material(vec3(0.1), vec3(0.6), vec3(0.3), 32.0);
        Light light = Light(u_lightPos, vec3(1.0));

        vec3 color = phongShading(pos, normal, viewDir, light, material) * shadow * ao;

        gl_FragColor = vec4(color, 1.0);

        // Render the light source indicator
        renderLightSource(u_lightPos);
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
    const lightPosLocation = gl.getUniformLocation(program, 'u_lightPos');
    const rotationLocation = gl.getUniformLocation(program, 'u_rotation');
    const roughnessLocation = gl.getUniformLocation(program, 'u_roughness');

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

    const sphereCache = new Map();
    const noiseCache = new Map();

    function cachedSphere(p) {
      const key = `${p[0]},${p[1]},${p[2]}`;
      if (sphereCache.has(key)) {
        return sphereCache.get(key);
      }
      const result = sphere(p);
      sphereCache.set(key, result);
      return result;
    }

    function cachedNoise(p) {
      const key = `${p[0]},${p[1]},${p[2]}`;
      if (noiseCache.has(key)) {
        return noiseCache.get(key);
      }
      const result = noise(p);
      noiseCache.set(key, result);
      return result;
    }

    function render(time) {
      time *= 0.001; // convert to seconds
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time);
      gl.uniform1f(zoomLocation, zoom);
      gl.uniform1f(roughnessLocation, roughness);

      // Update light source position
      const lightX = 2.0 * Math.cos(time);
      const lightY = 2.0 * Math.sin(time);
      const lightZ = 2.0;
      setLightPos([lightX, lightY, lightZ]);
      gl.uniform3f(lightPosLocation, lightX, lightY, lightZ);

      // Create rotation matrix
      const rotationMatrix = mat4.create();
      mat4.rotateX(rotationMatrix, rotationMatrix, rotationX);
      mat4.rotateY(rotationMatrix, rotationMatrix, rotationY);
      gl.uniformMatrix4fv(rotationLocation, false, rotationMatrix);

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

    // Handle arrow key events for roughness and rotation
    function handleKeyDown(event) {
      if (event.key === 'ArrowUp') {
        debouncedSetRoughness((prev) => Math.min(prev + 0.01, 1.0));
      } else if (event.key === 'ArrowDown') {
        debouncedSetRoughness((prev) => Math.max(prev - 0.01, 0.0));
      } else if (event.key === 'ArrowLeft') {
        setRotationY((prev) => prev - 0.1);
      } else if (event.key === 'ArrowRight') {
        setRotationY((prev) => prev + 0.1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.removeChild(canvasContainer);
    };
  }, [zoom, rotationX, rotationY, roughness]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const isFirstTimeUser = localStorage.getItem('isFirstTimeUser');
      if (isFirstTimeUser === null) {
        localStorage.setItem('isFirstTimeUser', 'true');
      }
    }
  }, []);

  return (
    <div className="frosted-glass-chip">
      {typeof localStorage !== 'undefined' && localStorage.getItem('isFirstTimeUser') === 'true' && (
        <div id="dialog-box-container"></div>
      )}
      {/* Removed rotation slider input */}
    </div>
  );
}

if (typeof window !== 'undefined') {
  const dialogBoxContainer = document.getElementById('dialog-box-container');
  if (dialogBoxContainer) {
    render(() => <DialogBox />, dialogBoxContainer);
  }
}

export default Home;
