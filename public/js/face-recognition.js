/**
 * Face Recognition Module - Handles face detection, descriptor extraction, and matching
 * Uses face-api.js loaded from CDN
 */
const FaceRecognitionModule = (() => {
  let modelsLoaded = false;
  let isLoading = false;
  let loadPromise = null;

  // Model URLs (using jsDelivr CDN)
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';

  /**
   * Load face-api.js models
   */
  async function loadModels() {
    if (modelsLoaded) return true;
    if (isLoading) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
      try {
        // Load all required models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;
        console.log('Face-api models loaded successfully');
        return true;
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        throw err;
      } finally {
        isLoading = false;
      }
    })();

    return loadPromise;
  }

  /**
   * Detect faces and extract descriptors from a video element or image
   */
  async function detectFace(input) {
    if (!modelsLoaded) {
      await loadModels();
    }

    try {
      const result = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      return result;
    } catch (err) {
      console.error('Face detection error:', err);
      return null;
    }
  }

  /**
   * Detect all faces in an input (for display purposes)
   */
  async function detectAllFaces(input) {
    if (!modelsLoaded) {
      await loadModels();
    }

    try {
      const results = await faceapi
        .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      return results;
    } catch (err) {
      console.error('Face detection error:', err);
      return [];
    }
  }

  /**
   * Draw face detection results on a canvas overlay
   */
  function drawFaceOverlay(canvas, detections, displaySize) {
    const ctx = canvas.getContext('2d');
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

    // Resize detections to match display size
    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    // Draw face box
    faceapi.draw.drawDetections(canvas, resizedDetections);

    // Draw landmarks
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
  }

  /**
   * Compare two face descriptors and return the Euclidean distance
   * Lower distance = better match
   * Threshold: < 0.6 is generally considered a match
   */
  function compareDescriptors(descriptor1, descriptor2) {
    if (!descriptor1 || !descriptor2) return Infinity;

    // Convert to Float32Array if needed
    const desc1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
    const desc2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);

    // Calculate Euclidean distance
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
      const diff = desc1[i] - desc2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Match a face descriptor against stored descriptors
   * Returns { matched: boolean, distance: number, bestMatch: object }
   */
  function matchFace(queryDescriptor, storedDescriptors, threshold = 0.6) {
    if (!queryDescriptor || !storedDescriptors || storedDescriptors.length === 0) {
      return { matched: false, distance: Infinity, bestMatch: null };
    }

    let bestDistance = Infinity;
    let bestMatch = null;

    for (const stored of storedDescriptors) {
      const distance = compareDescriptors(queryDescriptor, stored.descriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = stored;
      }
    }

    return {
      matched: bestDistance <= threshold,
      distance: bestDistance,
      bestMatch
    };
  }

  /**
   * Check if face-api is loaded and models are available
   */
  function isReady() {
    return modelsLoaded && typeof faceapi !== 'undefined';
  }

  /**
   * Get confidence percentage from distance
   */
  function getConfidence(distance) {
    // Convert distance to a confidence percentage
    // Distance of 0 = 100% confidence, distance of 0.6 = ~40% confidence
    const confidence = Math.max(0, Math.min(100, (1 - distance / 0.6) * 100));
    return Math.round(confidence * 10) / 10;
  }

  return {
    loadModels,
    detectFace,
    detectAllFaces,
    drawFaceOverlay,
    compareDescriptors,
    matchFace,
    isReady,
    getConfidence
  };
})();
