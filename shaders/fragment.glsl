precision mediump float;

varying vec3 vPosition;
uniform vec3 cameraPosition;
uniform int reflections;  // max = 10
uniform bool shadows;
uniform int numberOfSpheres;  // max = 64
uniform vec3 sphereCenters[64];
vec3 lightDirections[3];

/**
 * Check for an intersection with a sphere
 */
bool intersectSphere(vec3 sphereCenter, vec3 rayStart, vec3 rayDirection, out float distance) {
  vec3 rayToSphere = sphereCenter - rayStart;
  float b = dot(rayDirection, rayToSphere);
  float d = b*b - dot(rayToSphere, rayToSphere) + 1.0;

  if (d < 0.0) {
    distance = 10000.0;
    return false;
  }

  distance = b - sqrt(d);
  if (distance < 0.0) {
    distance = 10000.0;
    return false;
  }

  return true;
}

/**
 * Does the ray intersect a sphere, if so, output the sphere's index and distance from the ray start
 */
bool intersectSpheres(vec3 rayStart, vec3 rayDirection, out int sphereIndex, out float distance, out vec3 intersectPosition, out vec3 normal) {
  float minDistance = -1.0, thisDistance = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i < numberOfSpheres) {
      if (intersectSphere(sphereCenters[i], rayStart, rayDirection, thisDistance)) {
        if (minDistance < 0.0 || thisDistance < minDistance) {
          minDistance = thisDistance;
          sphereIndex = i;
          intersectPosition = rayStart + minDistance * rayDirection;
          normal = intersectPosition - sphereCenters[i];
        }
      }
    }
  }

  if (minDistance <= 0.0) {
    sphereIndex = -1;
    distance = 10000.0;
    return false;
  } else {
    distance = minDistance;
    return true;
  }
}

bool intersectSpheresSimple(vec3 rayStart, vec3 rayDirection) {
  float minDistance = -1.0, thisDistance = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i < numberOfSpheres) {
      if (intersectSphere(sphereCenters[i], rayStart, rayDirection, thisDistance)) {
        if (minDistance < 0.0 || thisDistance < minDistance) {
          minDistance = thisDistance;
        }
      }
    }
  }

  return (minDistance >= 0.0);
}

/**
 * Calculate the intensity of light at a certain angle - 0.0 means none, 1.0 means true colour, >1.0 for gloss/shine
 */
vec3 lightAt(vec3 position, vec3 normal, vec3 viewer, vec3 color) {
  vec3 light = lightDirections[0];
  vec3 reflection = reflect(-light, normal);

  vec3 intersectPosition, n;
  float intensity = 0.0, distance;
  int sphereIndex;

  for (int i = 0; i < 3; i++) {
    light = lightDirections[i];
    reflection = reflect(-light, normal);

    // TODO: check if testing for shadows here is valid...
    if (!shadows || !intersectSpheresSimple(position, light)) {
      intensity = intensity + 0.05 + 0.3 * pow(max(dot(reflection, viewer), 0.0), 30.0) + 0.7 * dot(light, normal);
    } else {
      intensity = intensity + 0.05;
    }
  }

  intensity = intensity / 1.5;

  if (intensity > 1.0) {
    return mix(color, vec3(1.2, 1.2, 1.2), intensity - 1.0);
  }

  return intensity * color;
}

/**
 * Check if our ray intersects with an object/floor
 */
bool intersectWorld(vec3 rayStart, vec3 rayDirection, out vec3 intersectPosition, out vec3 normal, out vec3 color) {
  int sphereIndex;
  float distance;

  if (intersectSpheres(rayStart, rayDirection, sphereIndex, distance, intersectPosition, normal)) {
    float i = float(sphereIndex);
    float n = i / 32.0;
    color = vec3(sin(1.0/n) / 2.0 + 0.5, sin(n) / 2.0 + 0.5, cos(n) / 2.0 + 0.5);
  } else if (rayDirection.y < -0.01) {
    intersectPosition = rayStart + ((rayStart.y + 2.7) / -rayDirection.y) * rayDirection;

    if (intersectPosition.x*intersectPosition.x + intersectPosition.z*intersectPosition.z > 300.0) {
      return false;
    }

    normal = vec3(0.0, 1.0, 0.0);

    if (fract(intersectPosition.x / 5.0) > 0.5 == fract(intersectPosition.z / 5.0) > 0.5) {
      color = vec3(1.0);
    } else {
      color = vec3(0.0, 0.45, 0.4);
    }
  } else {
   return false;
  }

  return true;
}

void main(void) {
  vec3 cameraDirection = normalize(vPosition - cameraPosition);

  lightDirections[0] = normalize(vec3(0.577350269, 0.577350269, -0.577350269));
  lightDirections[1] = normalize(vec3(0.577350269, 0.577350269, -0.577350269));
  lightDirections[2] = normalize(vec3(0.5, 1.0, 1.0));

  // start pos, normal, end pos
  vec3 position1, normal, position2;
  vec3 color, reflectedColor, colorMax;

  if (intersectWorld(cameraPosition, cameraDirection, position1, normal, reflectedColor)) {
    color = lightAt(position1, normal, -cameraDirection, reflectedColor);
    colorMax = (reflectedColor + vec3(0.7)) / 1.7;
    cameraDirection = reflect(cameraDirection, normal);

    // since integer modulo isn't available
    bool even = true;
    for (int i=0; i<10; i++) {
      // since loops *have* to be unrolled due to no branches
      if (i < int(reflections)) {
        if (even) {
          even = false;
          if (intersectWorld(position1, cameraDirection, position2, normal, reflectedColor)) {
            color += lightAt(position1, normal, -cameraDirection, reflectedColor) * colorMax;
            colorMax *= (reflectedColor + vec3(0.7)) / 1.7;
            cameraDirection = reflect(cameraDirection, normal);
          } else {
            break;
          }
        } else {
          even = true;
          if (intersectWorld(position2, cameraDirection, position1, normal, reflectedColor)) {
            color += lightAt(position2, normal, -cameraDirection, reflectedColor) * colorMax;
            colorMax *= (reflectedColor + vec3(0.7)) / 1.7;
            cameraDirection = reflect(cameraDirection, normal);
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    gl_FragColor = vec4(color, 1.0);
  } else {
    gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
  }
}
