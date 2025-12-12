// Constants for composition analysis thresholds
export const COMPOSITION_THRESHOLDS = {
  // Minimum probability for a single composition to be considered "high confidence"
  HIGH_CONFIDENCE_THRESHOLD: 0.40, // 40%
  
  // Minimum combined probability for multiple compositions to be shown together
  MULTIPLE_COMPOSITION_THRESHOLD: 0.30, // 30%
  
  // If no_composition is this much higher than the next best, we didn't find anything
  NO_COMPOSITION_DOMINANCE_THRESHOLD: 0.05, // 5% difference
} as const;

// Format composition names for display (e.g., "u_shaped" -> "U-Shaped")
export function formatCompositionName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

// Analyze composition probabilities and return a human-readable description
export interface CompositionAnalysis {
  description: string;
  highlightedCompositions: string[]; // Composition names that should be highlighted
}

export function analyzeComposition(
  probabilities: Record<string, number>
): CompositionAnalysis {
  // Convert to array of [name, probability] pairs and sort by probability (descending)
  const entries = Object.entries(probabilities)
    .map(([name, prob]) => [name, prob] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return {
      description: "No composition data available.",
      highlightedCompositions: [],
    };
  }

  const [topName, topProb] = entries[0];
  const [secondName, secondProb] = entries[1] || ['', 0];

  // Case 1: no_composition is the top result
  if (topName === 'no_composition') {
    // Even if there's a close second, if no_composition is highest, we didn't find anything
    return {
      description: "We couldn't identify a clear composition in this image.",
      highlightedCompositions: [],
    };
  }

  // Case 2: Top composition is high confidence (≥40%)
  if (topProb >= COMPOSITION_THRESHOLDS.HIGH_CONFIDENCE_THRESHOLD) {
    // Check if no_composition is close enough to be concerning
    const noCompProb = probabilities['no_composition'] || 0;
    
    // If no_composition is very close to the top result, we're not confident
    if (noCompProb > 0 && (topProb - noCompProb) < COMPOSITION_THRESHOLDS.NO_COMPOSITION_DOMINANCE_THRESHOLD) {
      return {
        description: "We couldn't identify a clear composition in this image.",
        highlightedCompositions: [],
      };
    }

    // Otherwise, we're confident in the top result
    const formattedName = formatCompositionName(topName);
    return {
      description: `The image looks like it has a nice ${formattedName} composition.`,
      highlightedCompositions: [topName],
    };
  }

  // Case 3: Multiple compositions that add up to ~30% or more
  // Find top 2 non-no_composition compositions
  const validCompositions = entries.filter(([name]) => name !== 'no_composition');
  const noCompProb = probabilities['no_composition'] || 0;

  if (validCompositions.length >= 2) {
    const [first, second] = validCompositions;
    const combinedProb = first[1] + second[1];

    // If no_composition is still the highest, we didn't find anything
    if (noCompProb > first[1]) {
      return {
        description: "We couldn't identify a clear composition in this image.",
        highlightedCompositions: [],
      };
    }

    // If combined probability is significant and no_composition isn't too high
    if (combinedProb >= COMPOSITION_THRESHOLDS.MULTIPLE_COMPOSITION_THRESHOLD) {
      // Check if no_composition is close to our top results
      if (noCompProb > 0 && (first[1] - noCompProb) < COMPOSITION_THRESHOLDS.NO_COMPOSITION_DOMINANCE_THRESHOLD) {
        return {
          description: "We couldn't identify a clear composition in this image.",
          highlightedCompositions: [],
        };
      }

      const formattedFirst = formatCompositionName(first[0]);
      const formattedSecond = formatCompositionName(second[0]);
      return {
        description: `We recognized ${formattedFirst} and ${formattedSecond} compositions.`,
        highlightedCompositions: [first[0], second[0]],
      };
    }
  }

  // Case 4: Single composition that's not high confidence but still the best
  if (validCompositions.length >= 1) {
    const [first] = validCompositions;
    
    // If no_composition is higher or very close, we didn't find anything
    if (noCompProb >= first[1] || (first[1] - noCompProb) < COMPOSITION_THRESHOLDS.NO_COMPOSITION_DOMINANCE_THRESHOLD) {
      return {
        description: "We couldn't identify a clear composition in this image.",
        highlightedCompositions: [],
      };
    }

    const formattedName = formatCompositionName(first[0]);
    return {
      description: `We recognized a ${formattedName} composition.`,
      highlightedCompositions: [first[0]],
    };
  }

  // Fallback: couldn't identify anything
  return {
    description: "We couldn't identify a clear composition in this image.",
    highlightedCompositions: [],
  };
}

