precision highp float;

uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunSize;

varying vec3 vWorldPos;
varying vec3 vViewPos;

// Simple hash noise for stars
float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

void main() {
    vec3 viewDir = normalize(vWorldPos);

    // Sky gradient from horizon to top based on view direction Y
    float heightFactor = max(viewDir.y, 0.0);
    float gradientPower = pow(heightFactor, 0.8);
    vec3 skyGradient = mix(horizonColor, topColor, gradientPower);

    // Sun disk with glow halo
    vec3 lightDir = normalize(sunDirection);
    float sunAngle = dot(viewDir, lightDir);

    // Sharp sun disk
    float sunDisk = smoothstep(1.0 - sunSize * 0.01, 1.0 - sunSize * 0.005, sunAngle);

    // Soft glow halo around sun
    float sunGlow = pow(max(sunAngle, 0.0), 256.0) * 0.5;
    float sunHalo = pow(max(sunAngle, 0.0), 32.0) * 0.15;

    vec3 sunContribution = sunColor * (sunDisk + sunGlow + sunHalo);

    // Ambient brightness from sun height
    float sunHeight = max(sunDirection.y, 0.0);
    float ambientBrightness = smoothstep(-0.1, 0.3, sunDirection.y);

    // Stars at night: visible when ambient < 0.3
    float starVisibility = 1.0 - smoothstep(0.0, 0.3, ambientBrightness);
    float stars = 0.0;
    if (starVisibility > 0.01 && viewDir.y > 0.0) {
        // Quantize direction to create a grid of potential star positions
        vec3 starGrid = floor(viewDir * 300.0);
        float starHash = hash(starGrid);

        // Only a few cells have stars
        float starThreshold = 0.985;
        if (starHash > starThreshold) {
            float starBrightness = (starHash - starThreshold) / (1.0 - starThreshold);
            stars = pow(starBrightness, 2.0) * starVisibility;

            // Twinkle
            stars *= 0.7 + 0.3 * sin(starHash * 6283.0 + starGrid.x * 10.0);
        }
    }

    // Combine
    vec3 finalColor = skyGradient * ambientBrightness + sunContribution + vec3(stars);

    // Below horizon: darken
    if (viewDir.y < 0.0) {
        float belowFactor = smoothstep(0.0, -0.2, viewDir.y);
        finalColor = mix(finalColor, horizonColor * 0.3, belowFactor);
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
