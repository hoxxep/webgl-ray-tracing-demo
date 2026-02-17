import fragmentShaderSource from '../shaders/fragment.glsl?raw';
import vertexShaderSource from '../shaders/vertex.glsl?raw';

export class RayTracer {
  private gl: WebGLRenderingContext;
  private shaderProgram: WebGLProgram;
  private canvas: HTMLCanvasElement;

  private cameraPosition: WebGLUniformLocation;
  private numberOfSpheres: WebGLUniformLocation;
  private sphereCentersLoc: WebGLUniformLocation;
  private reflectionDepth: WebGLUniformLocation;
  private shadows: WebGLUniformLocation;
  private lastWidth: number;
  private lastHeight: number;

  // Pre-allocated buffers to avoid per-frame allocations
  private sphereData: Float32Array;
  private cornerData: Float32Array;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = this.initWebGL();
    this.shaderProgram = null!;
    this.cameraPosition = null!;
    this.numberOfSpheres = null!;
    this.sphereCentersLoc = null!;
    this.reflectionDepth = null!;
    this.shadows = null!;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.sphereData = new Float32Array(64 * 3);
    this.cornerData = new Float32Array(12);
    this.initShaders();
  }

  private initWebGL(): WebGLRenderingContext {
    const gl = this.canvas.getContext('webgl');

    if (!gl) {
      throw new Error('Your browser does not support WebGL.');
    }

    return gl;
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w === this.lastWidth && h === this.lastHeight) return;
    this.lastWidth = w;
    this.lastHeight = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  private initShaders(): void {
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);

    const shaderProgram = this.shaderProgram = this.gl.createProgram()!;
    this.gl.attachShader(shaderProgram, fragmentShader);
    this.gl.attachShader(shaderProgram, vertexShader);
    this.gl.linkProgram(shaderProgram);

    if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
      throw new Error('Could not initialise shader program');
    }

    this.gl.useProgram(shaderProgram);

    this.cameraPosition = this.gl.getUniformLocation(shaderProgram, 'cameraPosition')!;
    this.numberOfSpheres = this.gl.getUniformLocation(shaderProgram, 'numberOfSpheres')!;
    this.sphereCentersLoc = this.gl.getUniformLocation(shaderProgram, 'sphereCenters')!;
    this.reflectionDepth = this.gl.getUniformLocation(shaderProgram, 'reflections')!;
    this.shadows = this.gl.getUniformLocation(shaderProgram, 'shadows')!;

    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clearDepth(1.0);
    this.resizeCanvas();
    this.initBuffers();
  }

  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('Shader failed to compile: ' + this.gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  private initBuffers(): void {
    const aVertexPosition = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
    this.gl.enableVertexAttribArray(aVertexPosition);

    const aPlotPosition = this.gl.getAttribLocation(this.shaderProgram, 'aPlotPosition');
    this.gl.enableVertexAttribArray(aPlotPosition);

    const screenBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, screenBuffer);
    const vertices = [
      1.0, 1.0,
      -1.0, 1.0,
      1.0, -1.0,
      -1.0, -1.0,
    ];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, screenBuffer);
    this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);

    const plotPositionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, plotPositionBuffer);
    this.gl.vertexAttribPointer(aPlotPosition, 3, this.gl.FLOAT, false, 0, 0);
  }

  render(numberOfSpheres: number, reflectionDepth: number, zoom: number, shadows: boolean, time: number): void {
    this.resizeCanvas();

    // Write sphere positions directly into pre-allocated Float32Array
    const cubeSize = Math.floor(Math.cbrt(numberOfSpheres));
    const squareSize = cubeSize * cubeSize;
    const halfGrid = 3 * cubeSize / 2;
    const sd = this.sphereData;

    for (let i = 0; i < numberOfSpheres; i++) {
      const v = i % squareSize;
      const wobble = Math.sin(time + i) * 0.15;
      const j = i * 3;
      sd[j]     = 3 * (v % cubeSize) + wobble - halfGrid;
      sd[j + 1] = 3 * Math.floor(v / cubeSize) + wobble;
      sd[j + 2] = 3 * Math.floor(i / squareSize) + wobble - halfGrid;
    }

    // Camera position (no Vector allocations — all inline math)
    const cfx = Math.sin(time * 0.08) * 18;
    const cfy = Math.sin(time * 0.026) * 5 + 5;
    const cfz = Math.cos(time * 0.08) * 18;

    // cameraDirection = normalize(-cameraFrom)
    const cdLen = Math.sqrt(cfx * cfx + cfy * cfy + cfz * cfz);
    const cdx = -cfx / cdLen;
    const cdy = -cfy / cdLen;
    const cdz = -cfz / cdLen;

    // cameraLeft = normalize(cameraDirection × up)  where up = (0,1,0)
    // cross(cd, up) = (-cdz, 0, cdx)
    const clLen = Math.sqrt(cdz * cdz + cdx * cdx);
    const clx = -cdz / clLen;
    const clz = cdx / clLen;

    // cameraUp = normalize(cameraLeft × cameraDirection)
    // cross((clx,0,clz), (cdx,cdy,cdz)) = (-clz*cdy, clz*cdx - clx*cdz, clx*cdy)
    const cux_r = -clz * cdy;
    const cuy_r = clz * cdx - clx * cdz;
    const cuz_r = clx * cdy;
    const cuLen = Math.sqrt(cux_r * cux_r + cuy_r * cuy_r + cuz_r * cuz_r);
    const cux = cux_r / cuLen;
    const cuy = cuy_r / cuLen;
    const cuz = cuz_r / cuLen;

    // cameraCenter = cameraFrom + cameraDirection * zoom
    const ccx = cfx + cdx * zoom;
    const ccy = cfy + cdy * zoom;
    const ccz = cfz + cdz * zoom;

    // scaledLeft = cameraLeft * ratio
    const ratio = this.canvas.clientWidth / this.canvas.clientHeight;
    const slx = clx * ratio;
    const slz = clz * ratio;

    // Write corners directly into pre-allocated Float32Array
    const cd = this.cornerData;
    // topRight = cameraCenter + cameraUp - scaledLeft
    cd[0] = ccx + cux - slx;
    cd[1] = ccy + cuy;
    cd[2] = ccz + cuz - slz;
    // topLeft = cameraCenter + cameraUp + scaledLeft
    cd[3] = ccx + cux + slx;
    cd[4] = ccy + cuy;
    cd[5] = ccz + cuz + slz;
    // bottomRight = cameraCenter - cameraUp - scaledLeft
    cd[6] = ccx - cux - slx;
    cd[7] = ccy - cuy;
    cd[8] = ccz - cuz - slz;
    // bottomLeft = cameraCenter - cameraUp + scaledLeft
    cd[9]  = ccx - cux + slx;
    cd[10] = ccy - cuy;
    cd[11] = ccz - cuz + slz;

    this.gl.uniform1i(this.numberOfSpheres, numberOfSpheres);
    this.gl.uniform3fv(this.sphereCentersLoc, sd.subarray(0, numberOfSpheres * 3));

    this.gl.uniform1i(this.reflectionDepth, reflectionDepth);
    this.gl.uniform1i(this.shadows, shadows ? 1 : 0);

    this.gl.uniform3f(this.cameraPosition, cfx, cfy, cfz);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, cd, this.gl.DYNAMIC_DRAW);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
