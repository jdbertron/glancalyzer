#!/usr/bin/env python3
"""
Export PyTorch MLP model weights to JSON format for use in TypeScript.

This script extracts the weights and biases from your composition_classifier.pt
and saves them as JSON that can be loaded in TypeScript to implement the forward pass.

Usage:
    python export_mlp_weights.py

Output:
    mlp_weights.json - Contains all layer weights and biases
"""

import torch
import torch.nn as nn
import json
import sys
import os

def get_model():
    """Load the model (same as in convert_to_tfjs.py)."""
    model_path = "composition_classifier.pt"
    
    try:
        print("Attempting to load full model from file...")
        model = torch.load(model_path, map_location='cpu')
        if isinstance(model, torch.nn.Module):
            print("✓ Successfully loaded full model")
            return model
    except Exception as e:
        print(f"Could not load as full model: {e}")
        print("Trying to load as state_dict...")

    try:
        state_dict = torch.load(model_path, map_location='cpu')
        print("\n⚠️  Model was saved as state_dict. Reconstructing architecture...")

        input_size = None
        num_classes = None
        for key in state_dict.keys():
            if 'mlp.6.weight' in key or 'mlp.6.bias' in key:
                if 'weight' in key: num_classes = state_dict[key].shape[0]
                elif 'bias' in key and num_classes is None: num_classes = state_dict[key].shape[0]
            if 'mlp.0.weight' in key: input_size = state_dict[key].shape[1]

        print(f"   Inferred input size: {input_size}")
        print(f"   Inferred num_classes: {num_classes}")

        class MLPHead(nn.Module):
            def __init__(self, input_size=512, num_classes=12):
                super(MLPHead, self).__init__()
                self.mlp = nn.Sequential(
                    nn.Linear(input_size, 256),      # mlp.0
                    nn.ReLU(),                        # mlp.1
                    nn.Dropout(0.3),                 # mlp.2
                    nn.Linear(256, 128),              # mlp.3
                    nn.ReLU(),                        # mlp.4
                    nn.Dropout(0.3),                 # mlp.5
                    nn.Linear(128, num_classes),     # mlp.6
                    nn.Sigmoid()                      # mlp.7
                )
            def forward(self, x): return self.mlp(x)

        if input_size and num_classes:
            model = MLPHead(input_size=input_size, num_classes=num_classes)
        elif num_classes:
            model = MLPHead(input_size=512, num_classes=num_classes)
        else:
            raise ValueError("Could not infer model architecture from state_dict")

        model.load_state_dict(state_dict)
        print("✓ Successfully loaded model from state_dict")
        return model
    except Exception as e:
        raise RuntimeError(f"Could not load model: {e}")

def export_weights():
    """Export model weights to JSON."""
    model_path = "composition_classifier.pt"
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found!")
        sys.exit(1)

    print(f"Loading model from {model_path}...")
    model = get_model()
    model.eval()

    # Extract weights and biases from each linear layer
    weights = {}
    
    # MLP structure: Linear(512->256) -> ReLU -> Dropout -> Linear(256->128) -> ReLU -> Dropout -> Linear(128->12) -> Sigmoid
    # We only need weights from Linear layers (mlp.0, mlp.3, mlp.6)
    
    for name, param in model.named_parameters():
        if 'weight' in name or 'bias' in name:
            # Convert to numpy then to list for JSON serialization
            data = param.detach().cpu().numpy().tolist()
            weights[name] = {
                'data': data,
                'shape': list(param.shape)
            }
            print(f"  Exported {name}: shape {list(param.shape)}")

    # Save to JSON
    output_path = "mlp_weights.json"
    with open(output_path, 'w') as f:
        json.dump(weights, f, indent=2)
    
    print(f"\n✓ Successfully exported weights to {output_path}")
    print(f"\nModel architecture:")
    print(f"  Input: 512 (CLIP features)")
    print(f"  Layer 1: Linear(512 -> 256) + ReLU + Dropout(0.3)")
    print(f"  Layer 2: Linear(256 -> 128) + ReLU + Dropout(0.3)")
    print(f"  Layer 3: Linear(128 -> 12) + Sigmoid")
    print(f"\nNext steps:")
    print(f"1. Copy {output_path} to your Convex project")
    print(f"2. Import it in your TypeScript code")
    print(f"3. Implement the forward pass function")

if __name__ == "__main__":
    export_weights()

