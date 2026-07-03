/**
 * Camera Module - Handles webcam access and photo capture
 */
const CameraModule = (() => {
  let stream = null;
  let videoElement = null;
  let canvasElement = null;

  /**
   * Initialize the camera
   */
  async function init(videoEl, overlayCanvas) {
    videoElement = videoEl;
    canvasElement = overlayCanvas;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      videoElement.srcObject = stream;
      await videoElement.play();
      return true;
    } catch (err) {
      console.error('Camera init error:', err);
      throw err;
    }
  }

  /**
   * Capture a photo from the video feed
   */
  function capturePhoto() {
    if (!videoElement || !videoElement.videoWidth) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * Capture photo with face overlay
   */
  function capturePhotoWithOverlay(overlayCanvas) {
    if (!videoElement || !videoElement.videoWidth) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(videoElement, 0, 0);

    // Draw overlay (face boxes, landmarks, etc.)
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * Stop the camera stream
   */
  function stop() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }

  /**
   * Get the current video element
   */
  function getVideo() {
    return videoElement;
  }

  /**
   * Check if camera is active
   */
  function isActive() {
    return stream !== null && stream.active;
  }

  return {
    init,
    capturePhoto,
    capturePhotoWithOverlay,
    stop,
    getVideo,
    isActive
  };
})();
