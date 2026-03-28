"""RL training script for creature locomotion using PPO."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from .environments.locomotion_env import EnvConfig, LocomotionEnv, MorphologyConfig

logger = logging.getLogger(__name__)

DEFAULT_CHECKPOINT_DIR = Path(__file__).parent.parent / "checkpoints"


def train_creature(
    morphology: Optional[MorphologyConfig] = None,
    env_config: Optional[EnvConfig] = None,
    total_timesteps: int = 500_000,
    checkpoint_dir: Optional[Path] = None,
    learning_rate: float = 3e-4,
    batch_size: int = 64,
    n_epochs: int = 10,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    clip_range: float = 0.2,
    verbose: int = 1,
) -> Path:
    """Train a PPO agent for the given creature morphology.

    Returns the path to the saved model checkpoint.
    """
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.callbacks import CheckpointCallback
        from stable_baselines3.common.vec_env import DummyVecEnv
    except ImportError as exc:
        raise RuntimeError(
            "stable-baselines3 is required for training. "
            "Install with: pip install stable-baselines3"
        ) from exc

    morphology = morphology or MorphologyConfig()
    env_config = env_config or EnvConfig()
    save_dir = checkpoint_dir or DEFAULT_CHECKPOINT_DIR
    save_dir.mkdir(parents=True, exist_ok=True)

    def make_env() -> LocomotionEnv:
        return LocomotionEnv(morphology=morphology, env_config=env_config)

    vec_env = DummyVecEnv([make_env])

    model = PPO(
        policy="MlpPolicy",
        env=vec_env,
        learning_rate=learning_rate,
        batch_size=batch_size,
        n_epochs=n_epochs,
        gamma=gamma,
        gae_lambda=gae_lambda,
        clip_range=clip_range,
        verbose=verbose,
    )

    checkpoint_cb = CheckpointCallback(
        save_freq=max(1, total_timesteps // 10),
        save_path=str(save_dir),
        name_prefix="creature_ppo",
    )

    logger.info(
        "Starting PPO training: timesteps=%d, joints=%d",
        total_timesteps,
        morphology.num_joints,
    )

    model.learn(total_timesteps=total_timesteps, callback=checkpoint_cb)

    final_path = save_dir / "creature_ppo_final"
    model.save(str(final_path))
    logger.info("Training complete — model saved to %s", final_path)

    vec_env.close()
    return final_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    saved = train_creature(total_timesteps=100_000)
    print(f"Model saved at: {saved}")
