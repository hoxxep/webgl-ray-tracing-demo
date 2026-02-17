import { Vector } from './vector';
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

    const up = new Vector(0, 1, 0);
    const cameraFrom = new Vector(
      Math.sin(time * 0.08) * 18,
      Math.sin(time * 0.026) * 5 + 5,
      Math.cos(time * 0.08) * 18,
    );
    const cameraDirection = cameraFrom.multiply(-1).normalize();

    const cameraLeft = cameraDirection.crossProduct(up).normalize();
    const cameraUp = cameraLeft.crossProduct(cameraDirection).normalize();
    const cameraCenter = cameraFrom.add(cameraDirection.multiply(zoom));

    const ratio = this.canvas.clientWidth / this.canvas.clientHeight;
    const scaledLeft = cameraLeft.multiply(ratio);

    // Write corners directly into pre-allocated Float32Array
    const cd = this.cornerData;
    // topRight = cameraCenter + cameraUp - scaledLeft
    cd[0] = cameraCenter.x + cameraUp.x - scaledLeft.x;
    cd[1] = cameraCenter.y + cameraUp.y - scaledLeft.y;
    cd[2] = cameraCenter.z + cameraUp.z - scaledLeft.z;
    // topLeft = cameraCenter + cameraUp + scaledLeft
    cd[3] = cameraCenter.x + cameraUp.x + scaledLeft.x;
    cd[4] = cameraCenter.y + cameraUp.y + scaledLeft.y;
    cd[5] = cameraCenter.z + cameraUp.z + scaledLeft.z;
    // bottomRight = cameraCenter - cameraUp - scaledLeft
    cd[6] = cameraCenter.x - cameraUp.x - scaledLeft.x;
    cd[7] = cameraCenter.y - cameraUp.y - scaledLeft.y;
    cd[8] = cameraCenter.z - cameraUp.z - scaledLeft.z;
    // bottomLeft = cameraCenter - cameraUp + scaledLeft
    cd[9]  = cameraCenter.x - cameraUp.x + scaledLeft.x;
    cd[10] = cameraCenter.y - cameraUp.y + scaledLeft.y;
    cd[11] = cameraCenter.z - cameraUp.z + scaledLeft.z;

    this.gl.uniform1i(this.numberOfSpheres, numberOfSpheres);
    this.gl.uniform3fv(this.sphereCentersLoc, sd.subarray(0, numberOfSpheres * 3));

    this.gl.uniform1i(this.reflectionDepth, reflectionDepth);
    this.gl.uniform1i(this.shadows, shadows ? 1 : 0);

    this.gl.uniform3f(this.cameraPosition, cameraFrom.x, cameraFrom.y, cameraFrom.z);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, cd, this.gl.STATIC_DRAW);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
