"""Mesh generation from L-System skeleton — exports glTF 2.0 binary."""

from __future__ import annotations

import json
import math
import struct
from typing import NamedTuple

import numpy as np

from .lsystem import Bone, CreatureAesthetic, CreatureMorphology


class _Vertex(NamedTuple):
    x: float
    y: float
    z: float
    nx: float
    ny: float
    nz: float
    r: float
    g: float
    b: float


class MeshGenerator:
    """Build a low-poly mesh from a creature morphology and export as glTF binary."""

    SEGMENTS_AROUND = 6  # hexagonal cross-section — keeps tri count low

    def generate(self, morphology: CreatureMorphology) -> bytes:
        """Return glTF binary (GLB) bytes for the given morphology."""
        vertices: list[_Vertex] = []
        indices: list[int] = []

        color = self._normalize_color(morphology.aesthetic.base_color)
        scale = morphology.aesthetic.size_scale

        bone_world_positions = self._compute_world_positions(morphology.bones, scale)

        for bone_idx, bone in enumerate(morphology.bones):
            base_pos = bone_world_positions[bone_idx]
            # Direction: from parent to this bone
            if bone.parent_index >= 0 and bone.parent_index < len(bone_world_positions):
                parent_pos = bone_world_positions[bone.parent_index]
            else:
                parent_pos = (base_pos[0], base_pos[1] - bone.length * scale, base_pos[2])

            self._add_capsule(
                vertices,
                indices,
                start=parent_pos,
                end=base_pos,
                radius=bone.radius * scale,
                color=color,
            )

        # Clamp triangle budget
        max_tris = 2000
        if len(indices) // 3 > max_tris:
            indices = indices[: max_tris * 3]

        return self._build_glb(vertices, indices)

    # ── Geometry helpers ─────────────────────────────────────────────────

    def _compute_world_positions(
        self, bones: list[Bone], scale: float
    ) -> list[tuple[float, float, float]]:
        positions: list[tuple[float, float, float]] = []
        for bone in bones:
            px, py, pz = bone.local_position
            px *= scale
            py *= scale
            pz *= scale
            if bone.parent_index >= 0 and bone.parent_index < len(positions):
                pp = positions[bone.parent_index]
                px += pp[0]
                py += pp[1]
                pz += pp[2]
            positions.append((px, py, pz))
        return positions

    def _add_capsule(
        self,
        vertices: list[_Vertex],
        indices: list[int],
        start: tuple[float, float, float],
        end: tuple[float, float, float],
        radius: float,
        color: tuple[float, float, float],
    ) -> None:
        """Add a capsule (cylinder + hemisphere caps) between start and end."""
        segs = self.SEGMENTS_AROUND
        base_idx = len(vertices)

        dx = end[0] - start[0]
        dy = end[1] - start[1]
        dz = end[2] - start[2]
        length = math.sqrt(dx * dx + dy * dy + dz * dz)
        if length < 1e-6:
            length = 0.01
            dy = 0.01

        # Build local frame
        up = (dx / length, dy / length, dz / length)
        # Pick an arbitrary perpendicular
        if abs(up[1]) < 0.99:
            right = self._cross(up, (0.0, 1.0, 0.0))
        else:
            right = self._cross(up, (1.0, 0.0, 0.0))
        right = self._normalize_vec(right)
        forward = self._cross(right, up)
        forward = self._normalize_vec(forward)

        # Bottom ring
        for i in range(segs):
            angle = 2.0 * math.pi * i / segs
            nx = math.cos(angle) * right[0] + math.sin(angle) * forward[0]
            ny = math.cos(angle) * right[1] + math.sin(angle) * forward[1]
            nz = math.cos(angle) * right[2] + math.sin(angle) * forward[2]
            vertices.append(_Vertex(
                start[0] + nx * radius, start[1] + ny * radius, start[2] + nz * radius,
                nx, ny, nz, color[0], color[1], color[2],
            ))

        # Top ring
        for i in range(segs):
            angle = 2.0 * math.pi * i / segs
            nx = math.cos(angle) * right[0] + math.sin(angle) * forward[0]
            ny = math.cos(angle) * right[1] + math.sin(angle) * forward[1]
            nz = math.cos(angle) * right[2] + math.sin(angle) * forward[2]
            vertices.append(_Vertex(
                end[0] + nx * radius, end[1] + ny * radius, end[2] + nz * radius,
                nx, ny, nz, color[0], color[1], color[2],
            ))

        # Side triangles
        for i in range(segs):
            i_next = (i + 1) % segs
            b0 = base_idx + i
            b1 = base_idx + i_next
            t0 = base_idx + segs + i
            t1 = base_idx + segs + i_next
            indices.extend([b0, t0, b1, b1, t0, t1])

        # Bottom cap center
        bc = len(vertices)
        vertices.append(_Vertex(
            start[0], start[1], start[2],
            -up[0], -up[1], -up[2], color[0], color[1], color[2],
        ))
        for i in range(segs):
            i_next = (i + 1) % segs
            indices.extend([bc, base_idx + i_next, base_idx + i])

        # Top cap center
        tc = len(vertices)
        vertices.append(_Vertex(
            end[0], end[1], end[2],
            up[0], up[1], up[2], color[0], color[1], color[2],
        ))
        for i in range(segs):
            i_next = (i + 1) % segs
            indices.extend([tc, base_idx + segs + i, base_idx + segs + i_next])

    # ── glTF binary (GLB) construction ───────────────────────────────────

    def _build_glb(self, vertices: list[_Vertex], indices: list[int]) -> bytes:
        """Manually build a minimal glTF 2.0 binary (GLB) without trimesh."""
        # Position, Normal, Color buffers
        pos_data = b""
        norm_data = b""
        color_data = b""
        for v in vertices:
            pos_data += struct.pack("<fff", v.x, v.y, v.z)
            norm_data += struct.pack("<fff", v.nx, v.ny, v.nz)
            color_data += struct.pack("<fff", v.r, v.g, v.b)

        idx_data = b""
        for idx in indices:
            idx_data += struct.pack("<H" if len(vertices) < 65536 else "<I", idx)

        component_type = 5123 if len(vertices) < 65536 else 5125  # UNSIGNED_SHORT or UNSIGNED_INT
        idx_byte_len = len(idx_data)

        # Pad each buffer view to 4-byte alignment
        def pad4(data: bytes) -> bytes:
            remainder = len(data) % 4
            return data + b"\x00" * ((4 - remainder) % 4)

        idx_padded = pad4(idx_data)
        pos_padded = pad4(pos_data)
        norm_padded = pad4(norm_data)
        color_padded = pad4(color_data)

        buffer_bytes = idx_padded + pos_padded + norm_padded + color_padded

        # Compute bounds
        positions = [(v.x, v.y, v.z) for v in vertices]
        if positions:
            pos_min = [min(p[i] for p in positions) for i in range(3)]
            pos_max = [max(p[i] for p in positions) for i in range(3)]
        else:
            pos_min = [0.0, 0.0, 0.0]
            pos_max = [0.0, 0.0, 0.0]

        gltf = {
            "asset": {"version": "2.0", "generator": "nexagen-creature-gen"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0}],
            "meshes": [{
                "primitives": [{
                    "attributes": {
                        "POSITION": 1,
                        "NORMAL": 2,
                        "COLOR_0": 3,
                    },
                    "indices": 0,
                }],
            }],
            "accessors": [
                {  # 0: indices
                    "bufferView": 0,
                    "componentType": component_type,
                    "count": len(indices),
                    "type": "SCALAR",
                    "max": [max(indices)] if indices else [0],
                    "min": [min(indices)] if indices else [0],
                },
                {  # 1: positions
                    "bufferView": 1,
                    "componentType": 5126,
                    "count": len(vertices),
                    "type": "VEC3",
                    "min": pos_min,
                    "max": pos_max,
                },
                {  # 2: normals
                    "bufferView": 2,
                    "componentType": 5126,
                    "count": len(vertices),
                    "type": "VEC3",
                },
                {  # 3: colors
                    "bufferView": 3,
                    "componentType": 5126,
                    "count": len(vertices),
                    "type": "VEC3",
                },
            ],
            "bufferViews": [
                {"buffer": 0, "byteOffset": 0, "byteLength": idx_byte_len, "target": 34963},
                {"buffer": 0, "byteOffset": len(idx_padded), "byteLength": len(pos_data), "target": 34962},
                {"buffer": 0, "byteOffset": len(idx_padded) + len(pos_padded), "byteLength": len(norm_data), "target": 34962},
                {"buffer": 0, "byteOffset": len(idx_padded) + len(pos_padded) + len(norm_padded), "byteLength": len(color_data), "target": 34962},
            ],
            "buffers": [{"byteLength": len(buffer_bytes)}],
        }

        json_str = json.dumps(gltf, separators=(",", ":"))
        json_bytes = json_str.encode("utf-8")
        # Pad JSON chunk to 4-byte alignment with spaces
        json_pad = (4 - len(json_bytes) % 4) % 4
        json_bytes += b" " * json_pad

        # GLB structure
        # Header: magic(4) + version(4) + length(4)
        # Chunk 0 (JSON): length(4) + type(4) + data
        # Chunk 1 (BIN):  length(4) + type(4) + data
        bin_pad = (4 - len(buffer_bytes) % 4) % 4
        buffer_bytes_padded = buffer_bytes + b"\x00" * bin_pad

        total_length = 12 + 8 + len(json_bytes) + 8 + len(buffer_bytes_padded)

        glb = bytearray()
        glb += struct.pack("<I", 0x46546C67)  # magic: glTF
        glb += struct.pack("<I", 2)            # version
        glb += struct.pack("<I", total_length)
        # JSON chunk
        glb += struct.pack("<I", len(json_bytes))
        glb += struct.pack("<I", 0x4E4F534A)  # JSON
        glb += json_bytes
        # BIN chunk
        glb += struct.pack("<I", len(buffer_bytes_padded))
        glb += struct.pack("<I", 0x004E4942)  # BIN\0
        glb += buffer_bytes_padded

        return bytes(glb)

    # ── Vector math ──────────────────────────────────────────────────────

    @staticmethod
    def _cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
        return (
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        )

    @staticmethod
    def _normalize_vec(v: tuple[float, float, float]) -> tuple[float, float, float]:
        length = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
        if length < 1e-9:
            return (0.0, 1.0, 0.0)
        return (v[0] / length, v[1] / length, v[2] / length)

    @staticmethod
    def _normalize_color(c: tuple[int, int, int]) -> tuple[float, float, float]:
        return (c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)
