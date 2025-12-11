#!/usr/bin/env python3
"""
Inspect a PyTorch model file to see how it was saved.
This helps determine if you need to define the architecture or can load it directly.
"""

import torch
import sys
import os

def inspect_model(model_path):
    """Inspect the model file to see what's inside."""
    
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found!")
        sys.exit(1)
    
    print(f"Inspecting {model_path}...\n")
    
    try:
        # Try loading the file
        data = torch.load(model_path, map_location='cpu')
        
        # Check what type of object it is
        print(f"Type: {type(data)}")
        
        if isinstance(data, torch.nn.Module):
            print("✓ This is a full model (saved with torch.save(model, ...))")
            print(f"  Model class: {data.__class__.__name__}")
            print(f"  Model: {data}")
            print("\n✓ You can load this directly - no architecture definition needed!")
            return True
            
        elif isinstance(data, dict):
            print("⚠️  This is a state_dict (saved with torch.save(model.state_dict(), ...))")
            print(f"  Number of layers: {len(data)}")
            print("\n  Layer names:")
            for key in list(data.keys())[:10]:  # Show first 10
                print(f"    - {key}: shape {data[key].shape}")
            if len(data) > 10:
                print(f"    ... and {len(data) - 10} more layers")
            
            # Try to infer some info
            if 'classifier.weight' in data or 'fc.weight' in data or 'head.weight' in data:
                for key in ['classifier.weight', 'fc.weight', 'head.weight']:
                    if key in data:
                        num_classes = data[key].shape[0]
                        print(f"\n  Inferred num_classes: {num_classes} (from {key})")
                        break
            
            print("\n⚠️  You need to define the model architecture to load this.")
            print("   Update convert_to_onnx.py with your model definition.")
            return False
            
        else:
            print(f"⚠️  Unknown format: {type(data)}")
            print(f"  Content: {str(data)[:200]}...")
            return False
            
    except Exception as e:
        print(f"Error loading file: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    model_path = "composition_classifier.pt"
    inspect_model(model_path)

