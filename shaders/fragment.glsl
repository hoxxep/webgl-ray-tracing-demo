precision mediump float;

varying vec3 vPosition;
uniform vec3 cameraPosition;
uniform int reflections;  // max = 10
uniform bool shadows;
uniform int numberOfSpheres;  // max = 64
uniform vec3 sphereCenters[64];
// Pre-normalized light directions (compile-time constants, no per-fragment normalize)
// light0 appears twice in the original (lightDirections[0] == [1]), so weighted 2x in lightAt
const vec3 light0 = vec3(0.577350269, 0.577350269, -0.577350269);
const vec3 light1 = vec3(0.33333333, 0.66666667, 0.66666667); // normalize(0.5, 1.0, 1.0)

/**
 * Check for an intersection with a sphere
 */
bool intersectSphere(vec3 sphereCenter, vec3 rayStart, vec3 rayDirection, out float distance) {
  vec3 rayToSphere = sphereCenter - rayStart;
  float b = dot(rayDirection, rayToSphere);

  // Sphere is behind the ray — skip discriminant and sqrt
  if (b <= 0.0) {
    distance = 10000.0;
    return false;
  }

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
  vec3 closestCenter;
  for (int i = 0; i < 64; i++) {
    if (i >= numberOfSpheres) break;
    if (intersectSphere(sphereCenters[i], rayStart, rayDirection, thisDistance)) {
      if (minDistance < 0.0 || thisDistance < minDistance) {
        minDistance = thisDistance;
        sphereIndex = i;
        closestCenter = sphereCenters[i];
      }
    }
  }

  if (minDistance <= 0.0) {
    sphereIndex = -1;
    distance = 10000.0;
    return false;
  }

  distance = minDistance;
  intersectPosition = rayStart + minDistance * rayDirection;
  normal = normalize(intersectPosition - closestCenter);
  return true;
}

bool intersectSpheresSimple(vec3 rayStart, vec3 rayDirection) {
  // sqrt-free: we only need yes/no, not exact distance.
  // intersection exists with distance>0 iff b>0, rr>1, and discriminant>=0
  for (int i = 0; i < 64; i++) {
    if (i >= numberOfSpheres) break;
    vec3 oc = sphereCenters[i] - rayStart;
    float b = dot(rayDirection, oc);
    if (b > 0.0) {
      float rr = dot(oc, oc);
      if (rr > 1.0 && b * b - rr + 1.0 >= 0.0) return true;
    }
  }
  return false;
}

/**
 * Schlick's Fresnel approximation: reflectivity increases at grazing angles
 */
float fresnelReflectivity(vec3 normal, vec3 viewer, float r0) {
  float cosTheta = clamp(dot(normal, viewer), 0.0, 1.0);
  float x = 1.0 - cosTheta;
  float x2 = x * x;
  return r0 + (1.0 - r0) * (x2 * x2 * x);
}

/**
 * Calculate the intensity of light at a certain angle - 0.0 means none, 1.0 means true colour, >1.0 for gloss/shine
 */
vec3 lightAt(vec3 position, vec3 normal, vec3 viewer, vec3 color) {
  float intensity = 0.0;
  vec3 shadowOrigin = position + normal * 0.01; // offset to prevent shadow acne

  // Light 0 (2x weight — original had this direction duplicated in lightDirections[0] and [1])
  float NdotL = dot(light0, normal);
  if (NdotL > 0.0 && (!shadows || !intersectSpheresSimple(shadowOrigin, light0))) {
    vec3 reflection = reflect(-light0, normal);
    intensity += 2.0 * (0.05 + 0.3 * pow(max(dot(reflection, viewer), 0.0), 30.0) + 0.7 * NdotL);
  } else if (NdotL > 0.0) {
    intensity += 2.0 * 0.05; // in shadow
  } else {
    intensity += 2.0 * (0.05 + 0.7 * NdotL); // back-face: negative diffuse for smooth falloff
  }

  // Light 1
  NdotL = dot(light1, normal);
  if (NdotL > 0.0 && (!shadows || !intersectSpheresSimple(shadowOrigin, light1))) {
    vec3 reflection = reflect(-light1, normal);
    intensity += 0.05 + 0.3 * pow(max(dot(reflection, viewer), 0.0), 30.0) + 0.7 * NdotL;
  } else if (NdotL > 0.0) {
    intensity += 0.05; // in shadow
  } else {
    intensity += 0.05 + 0.7 * NdotL; // back-face: negative diffuse for smooth falloff
  }

  intensity /= 1.4;

  if (intensity > 1.0) {
    return mix(color, vec3(1.2, 1.2, 1.2), min(intensity - 1.0, 1.0));
  }

  return max(intensity, 0.0) * color;
}

/**
 * Check if our ray intersects with an object/floor
 */
bool intersectWorld(vec3 rayStart, vec3 rayDirection, out vec3 intersectPosition, out vec3 normal, out vec3 color) {
  int sphereIndex;
  float distance;

  if (intersectSpheres(rayStart, rayDirection, sphereIndex, distance, intersectPosition, normal)) {
    float n = max(float(sphereIndex), 0.5) / 32.0;
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

  // start pos, normal, end pos
  vec3 position1, normal, position2;
  vec3 color, reflectedColor, colorMax;

  // Fresnel reflections: C = (1-r)*L_direct + r*C_reflected
  // r varies with angle — low at center (strong color), high at edges (mirror)
  if (intersectWorld(cameraPosition, cameraDirection, position1, normal, reflectedColor)) {
    float r0 = mix(0.6, 0.18, step(0.99, normal.y));
    float r = fresnelReflectivity(normal, -cameraDirection, r0);
    color = lightAt(position1, normal, -cameraDirection, reflectedColor);
    colorMax = vec3(r);
    cameraDirection = reflect(cameraDirection, normal);

    bool even = true;
    for (int i=0; i<10; i++) {
      if (i < int(reflections)) {
        // Skip further bounces when reflection contribution is negligible
        if (colorMax.r + colorMax.g + colorMax.b < 0.01) break;
        if (even) {
          even = false;
          if (intersectWorld(position1, cameraDirection, position2, normal, reflectedColor)) {
            color += lightAt(position2, normal, -cameraDirection, reflectedColor) * colorMax;
            r0 = mix(0.6, 0.18, step(0.99, normal.y));
            colorMax *= fresnelReflectivity(normal, -cameraDirection, r0);
            cameraDirection = reflect(cameraDirection, normal);
          } else {
            break;
          }
        } else {
          even = true;
          if (intersectWorld(position2, cameraDirection, position1, normal, reflectedColor)) {
            color += lightAt(position1, normal, -cameraDirection, reflectedColor) * colorMax;
            r0 = mix(0.6, 0.08, step(0.99, normal.y));
            colorMax *= fresnelReflectivity(normal, -cameraDirection, r0);
            cameraDirection = reflect(cameraDirection, normal);
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
  } else {
    gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
  }
}
