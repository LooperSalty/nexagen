"""Gymnasium environment for creature locomotion learning."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional, SupportsFloat

import gymnasium as gym
import numpy as np
from gymnasium import spaces


@dataclass(frozen=True)
class MorphologyConfig:
    """Minimal representation of a creature for the RL environment."""
    num_joints: int = 8
    body_mass: float = 10.0
    joint_max_torque: float = 50.0
    leg_length: float = 1.0


@dataclass(frozen=True)
class EnvConfig:
    """Configurable environment parameters."""
    max_steps: int = 1000
    target_speed: float = 2.0
    fall_threshold: float = 0.3
    energy_penalty_coeff: float = 0.01
    stability_bonus_coeff: float = 0.1
    terrain_resolution: int = 10
    gravity: float = -9.81
    dt: float = 0.02


class LocomotionEnv(gym.Env):
    """Gymnasium environment for training creature locomotion controllers.

    Observation space:
        - body orientation (quaternion, 4)
        - joint angles (num_joints)
        - joint velocities (num_joints)
        - ground contacts (num_joints // 2, one per limb end)
        - terrain height raycasts (terrain_resolution)
        - body velocity (3)
        - target direction (2)

    Action space:
        - torques on each joint in [-1, 1], scaled by max_torque

    Reward:
        velocity_toward_target - energy_cost - fall_penalty + stability_bonus
    """

    metadata = {"render_modes": ["human"], "render_fps": 50}

    def __init__(
        self,
        morphology: Optional[MorphologyConfig] = None,
        env_config: Optional[EnvConfig] = None,
        render_mode: Optional[str] = None,
    ) -> None:
        super().__init__()
        self.morphology = morphology or MorphologyConfig()
        self.config = env_config or EnvConfig()
        self.render_mode = render_mode

        nj = self.morphology.num_joints
        num_contacts = max(1, nj // 2)

        obs_size = (
            4                           # body orientation quaternion
            + nj                        # joint angles
            + nj                        # joint velocities
            + num_contacts              # ground contacts
            + self.config.terrain_resolution  # terrain raycasts
            + 3                         # body velocity
            + 2                         # target direction
        )

        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_size,), dtype=np.float32
        )
        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(nj,), dtype=np.float32
        )

        # Internal state
        self._step_count: int = 0
        self._body_pos: np.ndarray = np.zeros(3, dtype=np.float32)
        self._body_vel: np.ndarray = np.zeros(3, dtype=np.float32)
        self._body_quat: np.ndarray = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
        self._joint_angles: np.ndarray = np.zeros(nj, dtype=np.float32)
        self._joint_velocities: np.ndarray = np.zeros(nj, dtype=np.float32)
        self._ground_contacts: np.ndarray = np.ones(num_contacts, dtype=np.float32)
        self._target_dir: np.ndarray = np.array([1.0, 0.0], dtype=np.float32)
        self._terrain_heights: np.ndarray = np.zeros(self.config.terrain_resolution, dtype=np.float32)

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[dict[str, Any]] = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        super().reset(seed=seed)
        nj = self.morphology.num_joints

        self._step_count = 0
        self._body_pos = np.array([0.0, self.morphology.leg_length, 0.0], dtype=np.float32)
        self._body_vel = np.zeros(3, dtype=np.float32)
        self._body_quat = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
        self._joint_angles = np.zeros(nj, dtype=np.float32)
        self._joint_velocities = np.zeros(nj, dtype=np.float32)
        self._ground_contacts = np.ones(max(1, nj // 2), dtype=np.float32)

        # Random target direction
        if self.np_random is not None:
            angle = self.np_random.uniform(0, 2 * math.pi)
        else:
            angle = 0.0
        self._target_dir = np.array([math.cos(angle), math.sin(angle)], dtype=np.float32)

        # Flat terrain
        self._terrain_heights = np.zeros(self.config.terrain_resolution, dtype=np.float32)

        return self._get_obs(), {}

    def step(
        self, action: np.ndarray
    ) -> tuple[np.ndarray, SupportsFloat, bool, bool, dict[str, Any]]:
        action = np.clip(action, -1.0, 1.0).astype(np.float32)
        dt = self.config.dt
        nj = self.morphology.num_joints

        # Apply torques to joints (simplified dynamics)
        torques = action * self.morphology.joint_max_torque
        angular_acc = torques / (self.morphology.body_mass / nj)

        self._joint_velocities += angular_acc * dt
        self._joint_velocities *= 0.98  # damping
        self._joint_angles += self._joint_velocities * dt

        # Estimate forward velocity from joint motion (simplified)
        stride_contribution = np.sum(np.abs(self._joint_velocities)) * 0.02
        forward_dir = np.array([self._target_dir[0], 0.0, self._target_dir[1]], dtype=np.float32)
        self._body_vel += forward_dir * stride_contribution * dt
        self._body_vel[1] += self.config.gravity * dt  # gravity
        self._body_vel *= 0.95  # drag

        self._body_pos += self._body_vel * dt

        # Ground collision
        ground_y = 0.0
        if self._body_pos[1] < ground_y + 0.1:
            self._body_pos[1] = ground_y + 0.1
            self._body_vel[1] = max(0.0, self._body_vel[1])

        # Update contacts (feet touching ground)
        num_contacts = max(1, nj // 2)
        for i in range(num_contacts):
            foot_phase = math.sin(self._joint_angles[i * 2 % nj] * 2.0)
            self._ground_contacts[i] = 1.0 if foot_phase > 0.0 else 0.0

        self._step_count += 1

        # Reward computation
        vel_toward_target = (
            self._body_vel[0] * self._target_dir[0]
            + self._body_vel[2] * self._target_dir[1]
        )
        energy_cost = self.config.energy_penalty_coeff * float(np.sum(action ** 2))

        height = float(self._body_pos[1])
        fallen = height < self.config.fall_threshold
        fall_penalty = 5.0 if fallen else 0.0

        # Stability: reward upright orientation
        # quat w close to 1 means upright
        stability_bonus = self.config.stability_bonus_coeff * float(self._body_quat[0] ** 2)

        reward = float(vel_toward_target) - energy_cost - fall_penalty + stability_bonus

        terminated = fallen
        truncated = self._step_count >= self.config.max_steps

        info: dict[str, Any] = {
            "velocity": float(np.linalg.norm(self._body_vel)),
            "distance": float(np.linalg.norm(self._body_pos)),
            "steps": self._step_count,
        }

        return self._get_obs(), reward, terminated, truncated, info

    def _get_obs(self) -> np.ndarray:
        parts = [
            self._body_quat,
            self._joint_angles,
            self._joint_velocities,
            self._ground_contacts,
            self._terrain_heights,
            self._body_vel,
            self._target_dir,
        ]
        return np.concatenate(parts).astype(np.float32)

    def render(self) -> None:
        pass  # Visual rendering would require a 3D engine; not implemented here
