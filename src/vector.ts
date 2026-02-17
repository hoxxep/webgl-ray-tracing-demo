export class Vector {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}

  crossProduct(v: Vector): Vector {
    return new Vector(
      this.y * v.z - v.y * this.z,
      this.z * v.x - v.z * this.x,
      this.x * v.y - v.x * this.y,
    );
  }

  normalize(): Vector {
    const l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    return new Vector(this.x / l, this.y / l, this.z / l);
  }

  add(v: Vector): Vector {
    return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  subtract(v: Vector): Vector {
    return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  multiply(l: number): Vector {
    return new Vector(this.x * l, this.y * l, this.z * l);
  }

  static push(vector: Vector, array: number[]): void {
    array.push(vector.x, vector.y, vector.z);
  }
}
