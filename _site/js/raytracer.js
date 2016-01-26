define(['webgl', 'window'], function raytracer(WebGLDebugUtils, window) {
  'use strict';

  class RayTracer {
    /**
     * Set up ray tracer instance
     * @param $canvas
     */
    constructor($canvas) {
      this.$canvas = $canvas;
      this.gl = this.initWebGL();
      this.initShaders();
    }

    /**
     * Initialise WebGL on the canvas
     * @returns {*}
     */
    initWebGL() {
      var gl;
      var canvas = this.$canvas.get(0);

      try {
        gl = WebGLDebugUtils.makeDebugContext(canvas.getContext('experimental-webgl'));
      } catch (e) {
        console.error(e);
      }

      if (!gl) {
        throw new Error('Your browser does not support WebGL.');
      }

      return gl;
    }

    /**
     * Reset the canvas height
     */
    resizeCanvas() {
      // fix weird height glitch
      var scale = RayTracer.isRetina() ? 2 : 1;
      var canvas = this.$canvas.get(0);
      canvas.width = this.$canvas.width() * scale;
      canvas.height = this.$canvas.height() * scale;
      this.gl.viewport(0, 0, canvas.width, canvas.height);
    }

    /**
     * Load and initialise the vertex and fragment shaders
     */
    initShaders() {
      var fragmentShader = this.getShader($('#fragment-shader'));
      var vertexShader = this.getShader($('#vertex-shader'));

      var shaderProgram = this.shaderProgram = this.gl.createProgram();
      this.gl.attachShader(shaderProgram, vertexShader);
      this.gl.attachShader(shaderProgram, fragmentShader);
      this.gl.linkProgram(shaderProgram);

      if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
        throw new Error('Could not initialise shader program');
      }

      this.gl.useProgram(shaderProgram);

      // get the memory addresses for the variables in our shaders
      this.cameraPosition = this.gl.getUniformLocation(shaderProgram, 'cameraPosition');
      this.numberOfSpheres = this.gl.getUniformLocation(shaderProgram, 'numberOfSpheres');
      this.sphereCenters = [];
      for (let i = 0; i < 64; i++) {
        this.sphereCenters.push(this.gl.getUniformLocation(shaderProgram, 'sphereCenters[' + i + ']'));
      }
      this.reflectionDepth = this.gl.getUniformLocation(shaderProgram, 'reflections');
      this.shadows = this.gl.getUniformLocation(shaderProgram, 'shadows');

      this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
      this.gl.clearDepth(1.0);
      this.resizeCanvas();
      this.initBuffers();
    }

    /**
     * Get a shader object from a <script> tag
     * @param $shader
     * @returns {*}
     */
    getShader($shader) {
      var script = $shader.get(0);

      if (!script) {
        throw new Error('No shader loaded: ' + $shader);
      }

      var shader;
      if (script.type === 'x-shader/x-fragment') {
        shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
      } else if (script.type === 'x-shader/x-vertex') {
        shader = this.gl.createShader(this.gl.VERTEX_SHADER);
      } else {
        throw new Error('script tag has invalid type: ' + script.type);
      }

      this.gl.shaderSource(shader, script.textContent);
      this.gl.compileShader(shader);

      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        throw new Error('Shader failed to compile: ' + this.gl.getShaderInfoLog(shader));
      }

      return shader;
    }

    /**
     * Initialise the GL buffers
     */
    initBuffers() {
      var aVertexPosition = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
      this.gl.enableVertexAttribArray(aVertexPosition);

      var aPlotPosition = this.gl.getAttribLocation(this.shaderProgram, 'aPlotPosition');
      this.gl.enableVertexAttribArray(aPlotPosition);

      var screenBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, screenBuffer);
      var vertices = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0
      ];
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, screenBuffer);
      this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);

      var plotPositionBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, plotPositionBuffer);
      this.gl.vertexAttribPointer(aPlotPosition, 3, this.gl.FLOAT, false, 0, 0);
    }

    /**
     * Render the image to the canvas
     * @param numberOfSpheres
     * @param reflectionDepth
     * @param zoom
     * @param shadows
     * @param time
     */
    render(numberOfSpheres, reflectionDepth, zoom, shadows, time) {
      this.resizeCanvas();

      // layout spheres in a cube-like shape
      var spheres = [];
      var cubeSize = Math.floor(Math.cbrt(numberOfSpheres));
      var squareSize = Math.pow(cubeSize, 2);

      for (let i = 0.0; i < numberOfSpheres; i++) {
        let v = i % squareSize;
        spheres.push(new Vector(
          3 * (v % cubeSize) + Math.sin(time + i) * 0.15 - 3 * cubeSize / 2,
          3 * Math.floor(v / cubeSize) + Math.sin(time + i) * 0.15,
          3 * Math.floor(i / squareSize) + Math.sin(time + i) * 0.15 - 3 * cubeSize / 2
        ));
      }

      var up = new Vector(0, 1, 0);
      var cameraTo = new Vector(0, 0, 0);
      var cameraFrom = new Vector(
        Math.sin(time * 0.08) * 18,
        Math.sin(time * 0.026) * 5 + 5,
        Math.cos(time * 0.08) * 18
      );
      var cameraDirection = cameraTo.subtract(cameraFrom).normalize();

      // work out screen corners
      var cameraLeft = cameraDirection.crossProduct(up).normalize();
      var cameraUp = cameraLeft.crossProduct(cameraDirection).normalize();
      var cameraCenter = cameraFrom.add(cameraDirection.multiply(zoom));

      var ratio = this.$canvas.width() / this.$canvas.height();
      var cameraTopLeft = cameraCenter.add(cameraUp).add(cameraLeft.multiply(ratio));
      var cameraBottomLeft = cameraCenter.subtract(cameraUp).add(cameraLeft.multiply(ratio));
      var cameraTopRight = cameraCenter.add(cameraUp).subtract(cameraLeft.multiply(ratio));
      var cameraBottomRight = cameraCenter.subtract(cameraUp).subtract(cameraLeft.multiply(ratio));

      var corners = [];
      Vector.push(cameraTopRight, corners);
      Vector.push(cameraTopLeft, corners);
      Vector.push(cameraBottomRight, corners);
      Vector.push(cameraBottomLeft, corners);

      // add spheres to the scene
      this.gl.uniform1i(this.numberOfSpheres, spheres.length);
      for (let i = 0; i < spheres.length; i++) {
        this.gl.uniform3f(this.sphereCenters[i], spheres[i].x, spheres[i].y, spheres[i].z);
      }

      // load in our settings
      this.gl.uniform1i(this.reflectionDepth, reflectionDepth);
      this.gl.uniform1i(this.shadows, shadows);

      // add camera position to scene
      this.gl.uniform3f(this.cameraPosition, cameraFrom.x, cameraFrom.y, cameraFrom.z);

      // fills the plot position buffer
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(corners), this.gl.STATIC_DRAW);
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      console.log('Rendered', numberOfSpheres, reflectionDepth, shadows);
    }

    /**
     * Check if the screen is retina
     * @returns {boolean}
     */
    static isRetina() {
      return ((
          window.matchMedia && (
          window.matchMedia('only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx), only screen and (min-resolution: 75.6dpcm)').matches ||
          window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min--moz-device-pixel-ratio: 2), only screen and (min-device-pixel-ratio: 2)').matches)
        ) || (
          window.devicePixelRatio && window.devicePixelRatio >= 2
        )
      );
    }
  }

  class Vector {
    /**
     * Construct a 3 dimensional vector
     * @param x
     * @param y
     * @param z
     */
    constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    /**
     * Take the cross product (this . v) of this vector with another
     * @param v
     * @returns {Vector}
     */
    crossProduct(v) {
      return new Vector(
        this.y * v.z - v.y * this.z,
        this.z * v.x - v.z * this.x,
        this.x * v.y - v.x * this.y
      );
    }

    /**
     * Normalize this vector
     * @returns {Vector}
     */
    normalize() {
      var l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      return new Vector(this.x / l, this.y / l, this.z / l);
    }

    /**
     * Add to this vector
     * @param v
     * @returns {Vector}
     */
    add(v) {
      return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    /**
     * Subtract another vector from this Vector
     * @param v
     * @returns {Vector}
     */
    subtract(v) {
      return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    /**
     * Multiply vector by a Scalar
     * @param l
     * @returns {Vector}
     */
    multiply(l) {
      return new Vector(this.x * l, this.y * l, this.z * l);
    }

    /**
     * Push 3 vector values onto the end of an array
     * @param vector - {Vector}
     * @param array - {Array}
     */
    static push(vector, array) {
      array.push(vector.x, vector.y, vector.z);
    }
  }

  return RayTracer;
})
;

