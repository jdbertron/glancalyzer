# CLIP vs Composition Classifier - Explained

## The Two-Stage Pipeline

Your classification system has **two separate models**:

### Stage 1: CLIP (Feature Extractor)
- **What it does**: Converts an image into a 512-dimensional feature vector
- **Input**: Raw image (JPEG/PNG)
- **Output**: 512 numbers (features)
- **Model**: CLIP (Contrastive Language-Image Pre-training) - a pre-trained model from OpenAI
- **Used for**: Extracting visual features from images

### Stage 2: MLP Classifier (Your Trained Model)
- **What it does**: Takes CLIP features and predicts composition type
- **Input**: 512 CLIP features
- **Output**: 12 probabilities (one for each composition class)
- **Model**: `composition_classifier.pt` - **This is your trained model**
- **Used for**: Classifying composition based on CLIP features

## The Complete Flow

```
Image → CLIP → [512 features] → MLP Classifier → [12 probabilities]
```

## What You Trained

You trained **only the MLP classifier** (`composition_classifier.pt`). This model:
- Takes 512 features as input (from CLIP)
- Outputs 12 composition probabilities
- Was trained using CLIP features extracted from your training images

## What CLIP Does

CLIP is a **pre-trained model** (you didn't train it). It:
- Extracts visual features from images
- Was trained by OpenAI on millions of image-text pairs
- Converts any image into a 512-dimensional feature vector
- Is used as a "feature extractor" before your classifier

## Why This Matters

When we say "convert CLIP to TensorFlow.js" (Option A), we mean:
- Convert the CLIP model (pre-trained by OpenAI) to TensorFlow.js format
- Use TensorFlow.js to extract CLIP features (instead of @xenova/transformers)
- Then use TensorFlow.js for your MLP classifier

This makes everything pure JavaScript and works in Convex.

## Summary

- **CLIP**: Pre-trained feature extractor (not your model, but needed for inference)
- **composition_classifier.pt**: Your trained MLP classifier (this is what you trained)
- **Both are needed**: CLIP extracts features, then your classifier uses those features

