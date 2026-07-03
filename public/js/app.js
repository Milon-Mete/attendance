/**
 * NEXUS ATTENDANCE - Main Application Logic
 * Futuristic attendance system with face recognition and GPS tracking
 */
(async () => {
  'use strict';

  // ====== DOM References ======
  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const overlay = $('overlay');
  const cameraLoader = $('cameraLoader');
  const scanStatus = $('scanStatus');
  const connectionStatus = $('connectionStatus');
  const userSection = $('userSection');
  const registerSection = $('registerSection');
  const userSelectSection = $('userSelectSection');
  const dutySection = $('dutySection');
  const historySection = $('historySection');
  const nameInput = $('nameInput');
  const registerBtn = $('registerBtn');
  const userList = $('userList');
  const userNameDisplay = $('userNameDisplay');
  const totalDuties = $('totalDuties');
  const presentCount = $('presentCount');
  const startDutyBtn = $('startDutyBtn');
  const endDutyBtn = $('endDutyBtn');
  const dutyTimer = $('dutyTimer');
  const timerHours = $('timerHours');
  const timerMinutes = $('timerMinutes');
  const timerSeconds = $('timerSeconds');
  const gpsCoords = $('gpsCoords');
  const gpsStatus = $('gpsStatus');
  const faceMatchStatus = $('faceMatchStatus');
  const matchLabel = $('matchLabel');
  const matchConfidence = $('matchConfidence');
  const matchIcon = $('matchIcon');
  const attendanceResult = $('attendanceResult');
  const resultTitle = $('resultTitle');
  const resultMessage = $('resultMessage');
  const resultIcon = $('resultIcon');
  const historyList = $('historyList');
  const toast = $('toast');
  const toastMessage = $('toastMessage');
  const toastIcon = $('toastIcon');

  // ====== State ======
  let currentUser = null;
  let activeAttendance = null;
  let timerInterval = null;
  let timerStartTime = null;
  let isProcessing = false;
  let faceDetectionInterval = null;

  // ====== Utility Functions ======

  function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toastIcon.className = 'toast-icon ' + type;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  function formatDateTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
           ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  function updateStatus(text, state = 'online') {
    const dot = connectionStatus.querySelector('.dot');
    const textEl = connectionStatus.querySelector('.status-text');
    textEl.textContent = text;
    dot.style.background = state === 'online' ? 'var(--neon-green)' : 
                           state === 'warning' ? 'var(--warning)' : 'var(--danger)';
  }

  // ====== Face Detection Loop ======

  async function startFaceDetectionLoop() {
    if (faceDetectionInterval) return;

    // Run face detection periodically
    const runDetection = async () => {
      if (!video.videoWidth || !FaceRecognitionModule.isReady()) return;

      try {
        const detections = await FaceRecognitionModule.detectAllFaces(video);
        const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
        FaceRecognitionModule.drawFaceOverlay(overlay, detections, displaySize);
      } catch (err) {
        console.warn('Face detection loop error:', err);
      }
    };

    // Run immediately and then every 1s
    await runDetection();
    faceDetectionInterval = setInterval(runDetection, 1000);
  }

  function stopFaceDetectionLoop() {
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
      faceDetectionInterval = null;
    }
  }

  // ====== User Registration ======

  async function handleRegistration() {
    const name = nameInput.value.trim();
    if (!name || isProcessing) return;

    isProcessing = true;
    registerBtn.disabled = true;
    registerBtn.textContent = 'REGISTERING...';

    try {
      // Capture face descriptor
      scanStatus.textContent = 'CAPTURING BIOMETRIC...';
      const detection = await FaceRecognitionModule.detectFace(video);

      if (!detection) {
        showToast('No face detected! Please look at the camera.', 'error');
        isProcessing = false;
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<span>REGISTER</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        scanStatus.textContent = 'AWAITING FACE...';
        return;
      }

      const faceDescriptor = Array.from(detection.descriptor);

      // Send to server
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, faceDescriptor })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      currentUser = data.user;
      showToast(`Registered as ${name}`, 'success');
      showUserDashboard();
      loadHistory();
      updateStatus('ONLINE');

    } catch (err) {
      showToast(err.message, 'error');
      scanStatus.textContent = 'REGISTRATION FAILED';
    }

    isProcessing = false;
    registerBtn.disabled = false;
    registerBtn.innerHTML = '<span>REGISTER</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  }

  // ====== User Selection ======

  async function loadUsers() {
    try {
      const res = await fetch('/api/users');
      const users = await res.json();
      return users;
    } catch (err) {
      console.error('Failed to load users:', err);
      return [];
    }
  }

  function renderUserList(users) {
    userList.innerHTML = '';

    if (users.length === 0) {
      userList.innerHTML = `
        <div class="empty-state">
          <p>No registered users found</p>
        </div>
      `;
      return;
    }

    users.forEach(user => {
      const item = document.createElement('div');
      item.className = 'user-list-item';
      item.innerHTML = `
        <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
        <span class="name">${user.name}</span>
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      `;
      item.addEventListener('click', () => selectUser(user));
      userList.appendChild(item);
    });
  }

  async function selectUser(user) {
    currentUser = user;
    showToast(`Welcome back, ${user.name}`, 'success');
    showUserDashboard();
    loadHistory();
    updateStatus('ONLINE');
  }

  // ====== UI Navigation ======

  function showUserDashboard() {
    registerSection.style.display = 'none';
    userSelectSection.style.display = 'none';
    userSection.style.display = 'block';
    dutySection.style.display = 'block';
    historySection.style.display = 'block';

    userNameDisplay.textContent = currentUser.name.toUpperCase();
    
    // Check for active duty
    checkActiveDuty();
    loadStats();
    startFaceDetectionLoop();
  }

  async function loadStats() {
    try {
      const res = await fetch(`/api/attendance/${currentUser.id}`);
      const records = await res.json();
      totalDuties.textContent = records.length;
      presentCount.textContent = records.filter(r => r.status === 'present').length;
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async function checkActiveDuty() {
    try {
      const res = await fetch(`/api/attendance/active/${currentUser.id}`);
      const active = await res.json();

      if (active) {
        activeAttendance = active;
        startDutyBtn.disabled = true;
        endDutyBtn.disabled = false;
        startDutyBtn.classList.add('active');
        endDutyBtn.classList.add('active');
        dutyTimer.style.display = 'block';
        timerStartTime = new Date(active.dutyStart.time).getTime();
        startTimer();
        scanStatus.textContent = 'DUTY ACTIVE - MONITORING';
      }
    } catch (err) {
      console.error('Failed to check active duty:', err);
    }
  }

  // ====== Timer ======

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    dutyTimer.style.display = 'none';
  }

  function updateTimer() {
    if (!timerStartTime) return;
    const now = Date.now();
    const diff = now - timerStartTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    timerHours.textContent = String(hours).padStart(2, '0');
    timerMinutes.textContent = String(minutes).padStart(2, '0');
    timerSeconds.textContent = String(seconds).padStart(2, '0');
  }

  // ====== Duty Actions ======

  async function startDuty() {
    if (isProcessing || !currentUser) return;
    isProcessing = true;
    startDutyBtn.disabled = true;
    scanStatus.textContent = 'CAPTURING START OF DUTY...';

    try {
      // 1. Get GPS location
      let latitude = null, longitude = null;
      try {
        const pos = await LocationModule.getCurrentPosition();
        latitude = pos.latitude;
        longitude = pos.longitude;
      } catch (err) {
        console.warn('GPS failed:', err);
      }

      // 2. Capture photo and face descriptor
      const imageBase64 = CameraModule.capturePhoto();
      if (!imageBase64) throw new Error('Camera capture failed');

      const detection = await FaceRecognitionModule.detectFace(video);
      if (!detection) {
        showToast('No face detected! Please look at the camera.', 'error');
        isProcessing = false;
        startDutyBtn.disabled = false;
        scanStatus.textContent = 'AWAITING FACE...';
        return;
      }

      const faceDescriptor = Array.from(detection.descriptor);

      // 3. Send to server
      const res = await fetch('/api/attendance/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          imageBase64,
          latitude,
          longitude,
          faceDescriptor
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      activeAttendance = data.attendance;
      timerStartTime = new Date(activeAttendance.dutyStart.time).getTime();
      
      // 4. Update UI
      endDutyBtn.disabled = false;
      endDutyBtn.classList.add('active');
      startDutyBtn.classList.add('active');
      dutyTimer.style.display = 'block';
      startTimer();
      
      showToast('Duty started!', 'success');
      scanStatus.textContent = 'DUTY ACTIVE - MONITORING';
      
      // Show GPS in status
      if (latitude && longitude) {
        gpsStatus.classList.add('acquired');
        gpsCoords.textContent = LocationModule.formatCoords({ latitude, longitude });
      }

    } catch (err) {
      showToast(err.message, 'error');
      startDutyBtn.disabled = false;
      scanStatus.textContent = 'FAILED TO START DUTY';
    }

    isProcessing = false;
  }

  async function endDuty() {
    if (isProcessing || !currentUser || !activeAttendance) return;
    isProcessing = true;
    endDutyBtn.disabled = true;
    scanStatus.textContent = 'VERIFYING IDENTITY...';

    // Hide previous result
    attendanceResult.style.display = 'none';

    try {
      // 1. Get GPS
      let latitude = null, longitude = null;
      try {
        const pos = await LocationModule.getCurrentPosition();
        latitude = pos.latitude;
        longitude = pos.longitude;
      } catch (err) {
        console.warn('GPS failed:', err);
      }

      // 2. Capture end-of-duty face
      const imageBase64 = CameraModule.capturePhoto();
      if (!imageBase64) throw new Error('Camera capture failed');

      const detection = await FaceRecognitionModule.detectFace(video);
      if (!detection) {
        showToast('No face detected! Please look at the camera.', 'error');
        isProcessing = false;
        endDutyBtn.disabled = false;
        scanStatus.textContent = 'AWAITING FACE...';
        return;
      }

      const endFaceDescriptor = Array.from(detection.descriptor);

      // 3. Compare face with start-of-duty face
      const startDescriptor = activeAttendance.dutyStart.faceDescriptor;
      const distance = FaceRecognitionModule.compareDescriptors(startDescriptor, endFaceDescriptor);
      const isMatched = distance <= 0.6;
      const confidence = FaceRecognitionModule.getConfidence(distance);

      // 4. Show face match result
      faceMatchStatus.style.display = 'flex';
      if (isMatched) {
        matchLabel.textContent = '✅ FACE VERIFIED - IDENTITY CONFIRMED';
        matchLabel.className = 'match-label';
        matchIcon.className = 'match-icon';
        matchConfidence.textContent = `Confidence: ${confidence}% | Distance: ${distance.toFixed(4)}`;
      } else {
        matchLabel.textContent = '❌ FACE MISMATCH - IDENTITY UNCERTAIN';
        matchLabel.className = 'match-label fail';
        matchIcon.className = 'match-icon fail';
        matchConfidence.textContent = `Distance: ${distance.toFixed(4)} (threshold: 0.6)`;
      }

      // 5. Send to server
      scanStatus.textContent = 'RECORDING ATTENDANCE...';
      const res = await fetch('/api/attendance/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: activeAttendance.id,
          imageBase64,
          latitude,
          longitude,
          faceDescriptor: endFaceDescriptor,
          faceMatchDistance: distance
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 6. Show result
      attendanceResult.style.display = 'flex';
      if (data.faceMatched) {
        resultTitle.textContent = '✅ ATTENDANCE CONFIRMED - PRESENT';
        resultMessage.textContent = `Duty ended at ${formatDateTime(data.attendance.dutyEnd.time)}`;
        attendanceResult.className = 'attendance-result success';
        resultIcon.className = 'result-icon';
        showToast('Present! Face verified successfully!', 'success');
      } else {
        resultTitle.textContent = '⚠️ FACE MISMATCH - MARKED FOR REVIEW';
        resultMessage.textContent = `Distance: ${distance.toFixed(4)} exceeds threshold. Duty logged.`;
        attendanceResult.className = 'attendance-result fail';
        resultIcon.className = 'result-icon';
        showToast('Face mismatch detected. Please contact admin.', 'error');
      }

      // 7. Reset UI
      activeAttendance = null;
      stopTimer();
      startDutyBtn.disabled = false;
      endDutyBtn.disabled = true;
      startDutyBtn.classList.remove('active');
      endDutyBtn.classList.remove('active');
      dutyTimer.style.display = 'none';
      scanStatus.textContent = 'DUTY COMPLETED';

      // Refresh data
      loadHistory();
      loadStats();

    } catch (err) {
      showToast(err.message, 'error');
      endDutyBtn.disabled = false;
      scanStatus.textContent = 'ERROR ENDING DUTY';
    }

    isProcessing = false;
  }

  // ====== History ======

  async function loadHistory() {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/attendance/${currentUser.id}`);
      const records = await res.json();

      if (!records || records.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>No duty records yet</p>
          </div>
        `;
        return;
      }

      // Show most recent first
      const sorted = [...records].reverse();
      historyList.innerHTML = sorted.map(record => {
        const status = record.status || 'active';
        const statusLabel = status === 'present' ? 'Present' : 
                            status === 'face_mismatch' ? 'Face Mismatch' : 'Active';
        const startTime = formatDateTime(record.dutyStart.time);
        const endTime = record.dutyEnd ? formatDateTime(record.dutyEnd.time) : 'Ongoing...';
        let duration = '';
        if (record.dutyEnd) {
          duration = formatDuration(new Date(record.dutyEnd.time) - new Date(record.dutyStart.time));
        }

        return `
          <div class="history-item">
            <div class="history-status ${status}"></div>
            <div class="history-info">
              <span class="history-date">${startTime}</span>
              <span class="history-detail">→ ${record.dutyEnd ? endTime : 'In progress...'}</span>
            </div>
            <span class="history-duration">${duration || 'Active'}</span>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  // ====== Event Listeners ======

  // Registration
  nameInput.addEventListener('input', () => {
    registerBtn.disabled = !nameInput.value.trim();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && nameInput.value.trim()) handleRegistration();
  });

  registerBtn.addEventListener('click', handleRegistration);

  // Show existing user selection
  document.getElementById('showExistingUser').addEventListener('click', async (e) => {
    e.preventDefault();
    registerSection.style.display = 'none';
    userSelectSection.style.display = 'block';
    const users = await loadUsers();
    renderUserList(users);
  });

  // Show registration form
  document.getElementById('showRegisterForm').addEventListener('click', (e) => {
    e.preventDefault();
    userSelectSection.style.display = 'none';
    registerSection.style.display = 'block';
  });

  // Duty buttons
  startDutyBtn.addEventListener('click', startDuty);
  endDutyBtn.addEventListener('click', endDuty);

  // Refresh history
  document.getElementById('refreshHistory').addEventListener('click', loadHistory);

  // ====== GPS Tracking ======

  LocationModule.onPosition((pos) => {
    if (pos) {
      gpsStatus.classList.add('acquired');
      gpsCoords.textContent = LocationModule.formatCoords(pos);
    }
  });

  // ====== Initialize Application ======

  async function initApp() {
    try {
      updateStatus('INITIALIZING', 'warning');
      scanStatus.textContent = 'INITIALIZING SYSTEM...';

      // 1. Load face-api models
      await FaceRecognitionModule.loadModels();
      
      // 2. Start camera
      await CameraModule.init(video, overlay);
      
      // 3. Hide loader
      cameraLoader.classList.add('hidden');
      scanStatus.textContent = 'AWAITING FACE...';
      
      // 4. Start GPS
      LocationModule.startWatching();

      // 5. Check for existing users initially
      const users = await loadUsers();
      if (users.length > 0) {
        userSelectSection.style.display = 'block';
        renderUserList(users);
        registerSection.style.display = 'none';
        
        // If only one user, auto-select
        if (users.length === 1) {
          setTimeout(() => selectUser(users[0]), 500);
        }
      }

      updateStatus('READY', 'online');
      showToast('System initialized successfully', 'info');

    } catch (err) {
      console.error('Init error:', err);
      updateStatus('ERROR', 'error');
      scanStatus.textContent = 'SYSTEM ERROR - CHECK CONSOLE';
      cameraLoader.querySelector('span').textContent = 'Error: ' + err.message;
      showToast('System initialization failed: ' + err.message, 'error');
    }
  }

  // Start the app when face-api is loaded
  function waitForFaceAPI() {
    if (typeof faceapi !== 'undefined') {
      initApp();
    } else {
      setTimeout(waitForFaceAPI, 200);
    }
  }

  // Start
  waitForFaceAPI();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    CameraModule.stop();
    LocationModule.stopWatching();
    stopFaceDetectionLoop();
    stopTimer();
  });

})();
