"""Export trained PPO model to ONNX with optional INT8 quantisation."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


def export_to_onnx(
    model_path: str | Path,
    obs_size: int,
    action_size: int,
    output_path: str | Path,
    quantize: bool = True,
    opset_version: int = 17,
) -> Path:
    """Export a stable-baselines3 PPO model to ONNX format.

    Parameters
    ----------
    model_path : path to the saved SB3 model (.zip)
    obs_size : observation vector dimension
    action_size : action vector dimension
    output_path : where to write the .onnx file
    quantize : if True, apply dynamic INT8 quantisation
    opset_version : ONNX opset

    Returns
    -------
    Path to the final ONNX file (may differ from *output_path* if quantised).
    """
    try:
        import torch
        import torch.onnx
        from stable_baselines3 import PPO
    except ImportError as exc:
        raise RuntimeError(
            "torch and stable-baselines3 are required for ONNX export. "
            "pip install torch stable-baselines3"
        ) from exc

    model_path = Path(model_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load the trained model
    model = PPO.load(str(model_path))
    policy = model.policy

    # Extract the actor (policy) network
    actor = policy.mlp_extractor  # feature extractor
    action_net = policy.action_net

    class _ActorWrapper(torch.nn.Module):
        """Wraps SB3 actor into a single forward pass: obs -> action mean."""

        def __init__(self, extractor: torch.nn.Module, action_head: torch.nn.Module) -> None:
            super().__init__()
            self.extractor = extractor
            self.action_head = action_head

        def forward(self, obs: torch.Tensor) -> torch.Tensor:
            features = self.extractor.forward_actor(obs)
            return self.action_head(features)

    wrapper = _ActorWrapper(actor, action_net)
    wrapper.eval()

    dummy_input = torch.randn(1, obs_size, dtype=torch.float32)

    torch.onnx.export(
        wrapper,
        dummy_input,
        str(output_path),
        opset_version=opset_version,
        input_names=["observation"],
        output_names=["action_mean"],
        dynamic_axes={
            "observation": {0: "batch"},
            "action_mean": {0: "batch"},
        },
    )
    logger.info("Exported ONNX model to %s", output_path)

    # Verify the exported model produces matching outputs
    _verify_onnx(wrapper, dummy_input, output_path)

    # Optional INT8 quantisation
    if quantize:
        output_path = _quantize_model(output_path)

    return output_path


def _verify_onnx(
    torch_model: object,
    dummy_input: object,
    onnx_path: Path,
    atol: float = 1e-4,
) -> None:
    """Verify that the ONNX model produces the same output as the PyTorch model."""
    import torch
    import onnxruntime as ort

    with torch.no_grad():
        torch_out = torch_model(dummy_input).numpy()

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    ort_out = session.run(None, {"observation": dummy_input.numpy()})[0]

    max_diff = float(np.max(np.abs(torch_out - ort_out)))
    logger.info("ONNX verification — max absolute diff: %.6f", max_diff)

    if max_diff > atol:
        logger.warning(
            "ONNX output diverges from PyTorch (max diff %.6f > atol %.6f)",
            max_diff,
            atol,
        )
    else:
        logger.info("ONNX verification passed")


def _quantize_model(onnx_path: Path) -> Path:
    """Apply dynamic INT8 quantisation to reduce model size."""
    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic
    except ImportError:
        logger.warning("onnxruntime.quantization not available — skipping quantisation")
        return onnx_path

    quantized_path = onnx_path.with_suffix(".int8.onnx")
    quantize_dynamic(
        model_input=str(onnx_path),
        model_output=str(quantized_path),
        weight_type=QuantType.QInt8,
    )
    logger.info("Quantised model saved to %s", quantized_path)

    # Report size reduction
    orig_size = onnx_path.stat().st_size
    quant_size = quantized_path.stat().st_size
    reduction = (1.0 - quant_size / orig_size) * 100 if orig_size > 0 else 0.0
    logger.info("Size reduction: %.1f%% (%d -> %d bytes)", reduction, orig_size, quant_size)

    return quantized_path


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 4:
        print("Usage: python export_onnx.py <model_path> <obs_size> <action_size> [output_path]")
        sys.exit(1)

    mp = sys.argv[1]
    obs = int(sys.argv[2])
    act = int(sys.argv[3])
    out = sys.argv[4] if len(sys.argv) > 4 else "creature_policy.onnx"
    result = export_to_onnx(mp, obs, act, out)
    print(f"Final model: {result}")
