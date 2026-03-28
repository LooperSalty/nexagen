// Fog utility functions
// Include in other shaders via preprocessor or copy these functions

/**
 * Apply linear fog blending.
 *
 * @param color     Original fragment color
 * @param distance  Distance from camera to fragment
 * @param fogColor  Color of the fog
 * @param fogStart  Distance where fog begins
 * @param fogEnd    Distance where fog fully obscures
 * @return          Color blended with fog
 */
vec3 applyFog(vec3 color, float distance, vec3 fogColor, float fogStart, float fogEnd) {
    float fogFactor = clamp((fogEnd - distance) / (fogEnd - fogStart), 0.0, 1.0);
    return mix(fogColor, color, fogFactor);
}

/**
 * Apply exponential fog blending.
 * Produces a more natural falloff than linear fog.
 *
 * @param color      Original fragment color
 * @param distance   Distance from camera to fragment
 * @param fogColor   Color of the fog
 * @param fogDensity Density coefficient controlling falloff rate
 * @return           Color blended with fog
 */
vec3 applyFogExponential(vec3 color, float distance, vec3 fogColor, float fogDensity) {
    float fogFactor = exp(-fogDensity * distance);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fogColor, color, fogFactor);
}

/**
 * Apply squared exponential fog blending.
 * Even steeper falloff for thick atmospheric effects.
 *
 * @param color      Original fragment color
 * @param distance   Distance from camera to fragment
 * @param fogColor   Color of the fog
 * @param fogDensity Density coefficient controlling falloff rate
 * @return           Color blended with fog
 */
vec3 applyFogExponentialSquared(vec3 color, float distance, vec3 fogColor, float fogDensity) {
    float exponent = fogDensity * distance;
    float fogFactor = exp(-exponent * exponent);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fogColor, color, fogFactor);
}

/**
 * Apply height-based fog that gets thicker at lower altitudes.
 *
 * @param color      Original fragment color
 * @param fragPos    World-space position of the fragment
 * @param cameraPos  World-space position of the camera
 * @param fogColor   Color of the fog
 * @param fogDensity Base density coefficient
 * @param fogHeight  Height at which fog density is at maximum
 * @return           Color blended with fog
 */
vec3 applyFogHeight(vec3 color, vec3 fragPos, vec3 cameraPos, vec3 fogColor, float fogDensity, float fogHeight) {
    float distance = length(fragPos - cameraPos);
    float heightFactor = exp(-max(fragPos.y - fogHeight, 0.0) * 0.1);
    float fogFactor = exp(-fogDensity * distance * heightFactor);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fogColor, color, fogFactor);
}
