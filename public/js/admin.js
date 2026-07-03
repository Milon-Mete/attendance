/**
 * NEXUS ADMIN - Admin Dashboard Logic
 * Shows all attendance data, user stats, location info, and photos
 */
(async () => {
  'use strict';

  // ====== DOM References ======
  const $ = (id) => document.getElementById(id);
  const toast = $('toast');
  const toastMessage = $('toastMessage');
  const toastIcon = $('toastIcon');

  // ====== Utility Functions ======

  function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toastIcon.className = 'toast-icon ' + type;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  function formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDuration(ms) {
    if (!ms && ms !== 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatCoords(lat, lng) {
    if (!lat || !lng) return null;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  function getMapsLink(lat, lng) {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function formatDurationBetween(startIso, endIso) {
    if (!startIso) return '—';
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    return formatDuration(end - start);
  }

  let allRecords = [];
  let allUsers = [];

  // ====== Load Data ======

  async function loadDashboard() {
    try {
      showToast('Loading admin data...', 'info');

      // Fetch stats and attendance in parallel
      const [statsRes, recordsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/attendance'),
        fetch('/api/users')
      ]);

      const stats = await statsRes.json();
      allRecords = await recordsRes.json();
      allUsers = await usersRes.json();

      // Update stats cards
      updateStatsCards(stats);
      
      // Update active duty list
      updateActiveDutyList(stats);
      
      // Update user list
      updateUserList(stats);
      
      // Update records table
      updateRecordsTable(allRecords);
      
      // Update location list
      updateLocationList(allRecords);
      
      // Update user filter dropdown
      updateUserFilter(allUsers);

      showToast('Dashboard updated', 'success');

    } catch (err) {
      console.error('Dashboard load error:', err);
      showToast('Failed to load dashboard data', 'error');
    }
  }

  // ====== Stats Cards ======

  function updateStatsCards(stats) {
    $('totalUsers').textContent = stats.totalUsers;
    $('totalRecords').textContent = stats.totalRecords;
    $('activeDuties').textContent = stats.activeDuties;
    $('todayPresent').textContent = stats.today.present;
    $('todayMismatch').textContent = stats.today.mismatch;
    $('todayTotal').textContent = stats.today.total;
  }

  // ====== Active Duty List ======

  function updateActiveDutyList(stats) {
    const container = $('activeDutyList');
    const activeUsers = stats.userStats.filter(u => u.isOnDuty);

    if (activeUsers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <p>No one is currently on duty</p>
        </div>
      `;
      return;
    }

    container.innerHTML = activeUsers.map(user => {
      const record = allRecords.find(r => r.id === user.activeAttendanceId);
      const duration = record ? formatDurationBetween(record.dutyStart.time) : '—';
      
      return `
        <div class="active-duty-item">
          <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
          <div class="info">
            <span class="name">${user.name}</span>
            <span class="since">Started: ${record ? formatDateTime(record.dutyStart.time) : '—'}</span>
          </div>
          <span class="duration">${duration}</span>
        </div>
      `;
    }).join('');
  }

  // ====== User List ======

  function updateUserList(stats) {
    const container = $('adminUserList');
    const users = stats.userStats;

    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <p>No users registered yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = users.map(user => {
      const statusBadge = user.isOnDuty 
        ? '<span class="badge active">ON DUTY</span>'
        : user.present > 0 
          ? `<span class="badge present">${user.present} PRESENT</span>`
          : '';
      
      const mismatchBadge = user.mismatch > 0 
        ? `<span class="badge mismatch">${user.mismatch} MISMATCH</span>`
        : '';

      return `
        <div class="admin-user-item">
          <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
          <div class="info">
            <span class="name">${user.name}</span>
            <span class="meta">
              <span>Registered: ${formatDateTime(user.registeredAt)}</span>
              <span>Total: ${user.total}</span>
              ${user.isOnDuty ? '<span style="color:var(--neon-cyan)">● Active Now</span>' : ''}
            </span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${statusBadge}
            ${mismatchBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  // ====== Records Table ======

  function updateRecordsTable(records) {
    const tbody = $('recordsBody');
    const statusFilter = $('statusFilter').value;
    const userFilter = $('userFilter').value;

    let filtered = [...records];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(r => r.userId === userFilter);
    }

    // Sort by most recent first
    filtered.sort((a, b) => new Date(b.dutyStart.time) - new Date(a.dutyStart.time));

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">No matching records found</td></tr>`;
      $('recordCount').textContent = 'Showing 0 records';
      return;
    }

    tbody.innerHTML = filtered.map(record => {
      const userName = record.user ? record.user.name : record.userName || 'Unknown';
      const startLoc = record.dutyStart.latitude && record.dutyStart.longitude
        ? { lat: record.dutyStart.latitude, lng: record.dutyStart.longitude }
        : null;
      const endLoc = record.dutyEnd && record.dutyEnd.latitude && record.dutyEnd.longitude
        ? { lat: record.dutyEnd.latitude, lng: record.dutyEnd.longitude }
        : null;

      const startMaps = startLoc ? getMapsLink(startLoc.lat, startLoc.lng) : null;
      const endMaps = endLoc ? getMapsLink(endLoc.lat, endLoc.lng) : null;

      const faceMatched = record.dutyEnd ? record.dutyEnd.faceMatched : null;
      const faceDistance = record.dutyEnd ? record.dutyEnd.faceMatchDistance : null;

      const statusClass = record.status;
      const statusLabel = record.status === 'present' ? '✅ Present' 
                        : record.status === 'face_mismatch' ? '⚠️ Mismatch' 
                        : '🟢 Active';

      const duration = formatDurationBetween(record.dutyStart.time, record.dutyEnd ? record.dutyEnd.time : null);

      return `
        <tr>
          <td><strong>${userName}</strong></td>
          <td>${formatDateTime(record.dutyStart.time)}</td>
          <td>${formatTime(record.dutyStart.time)}</td>
          <td>${record.dutyEnd ? formatTime(record.dutyEnd.time) : '🟢 Ongoing'}</td>
          <td>${duration}</td>
          <td>
            ${startMaps 
              ? `<a href="${startMaps}" target="_blank" class="loc-link" title="View on Google Maps">
                  📍 ${formatCoords(startLoc.lat, startLoc.lng)}
                 </a>`
              : '—'}
            ${endMaps 
              ? `<br><a href="${endMaps}" target="_blank" class="loc-link" title="End location">
                  🎯 ${formatCoords(endLoc.lat, endLoc.lng)}
                 </a>`
              : ''}
          </td>
          <td style="text-align:center;">
            ${faceMatched === true ? '✅' : faceMatched === false ? '❌' : '—'}
            ${faceDistance !== null ? `<br><span style="font-size:9px;color:var(--text-dim)">${faceDistance.toFixed(4)}</span>` : ''}
          </td>
          <td>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <a href="${record.dutyStart.imagePath}" target="_blank" class="photo-link" title="Start photo">
              📸 Start
            </a>
            ${record.dutyEnd 
              ? `<a href="${record.dutyEnd.imagePath}" target="_blank" class="photo-link" title="End photo">
                  📸 End
                 </a>`
              : ''}
          </td>
        </tr>
      `;
    }).join('');

    $('recordCount').textContent = `Showing ${filtered.length} of ${records.length} records`;
  }

  // ====== Location List ======

  function updateLocationList(records) {
    const container = $('locationList');

    // Collect all locations from records
    const locations = [];
    records.forEach(record => {
      const userName = record.user ? record.user.name : record.userName || 'Unknown';
      
      if (record.dutyStart.latitude && record.dutyStart.longitude) {
        locations.push({
          userName,
          type: 'Start Duty',
          time: record.dutyStart.time,
          lat: record.dutyStart.latitude,
          lng: record.dutyStart.longitude,
          mapsLink: getMapsLink(record.dutyStart.latitude, record.dutyStart.longitude)
        });
      }

      if (record.dutyEnd && record.dutyEnd.latitude && record.dutyEnd.longitude) {
        locations.push({
          userName,
          type: 'End Duty',
          time: record.dutyEnd.time,
          lat: record.dutyEnd.latitude,
          lng: record.dutyEnd.longitude,
          mapsLink: getMapsLink(record.dutyEnd.latitude, record.dutyEnd.longitude)
        });
      }
    });

    // Sort by most recent
    locations.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    // Show latest 20
    const recentLocations = locations.slice(0, 20);

    if (recentLocations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <p>No location data available</p>
        </div>
      `;
      return;
    }

    container.innerHTML = recentLocations.map(loc => `
      <div class="location-item">
        <div class="loc-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div class="info">
          <span class="user-name">${loc.userName}</span>
          <span class="coords">${formatCoords(loc.lat, loc.lng)}</span>
          <span class="time">${formatDateTime(loc.time)}</span>
        </div>
        <span class="location-type-badge">${loc.type}</span>
        <a href="${loc.mapsLink}" target="_blank" class="maps-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Open Maps
        </a>
      </div>
    `).join('');
  }

  // ====== User Filter ======

  function updateUserFilter(users) {
    const select = $('userFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="all">All Users</option>';
    
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.name;
      select.appendChild(option);
    });

    select.value = currentValue;
  }

  // ====== Event Listeners ======

  // Refresh button
  $('refreshAdmin').addEventListener('click', loadDashboard);

  // Filter changes
  $('statusFilter').addEventListener('change', () => updateRecordsTable(allRecords));
  $('userFilter').addEventListener('change', () => updateRecordsTable(allRecords));

  // Auto-refresh every 30 seconds
  setInterval(loadDashboard, 30000);

  // ====== Initialize ======

  await loadDashboard();
  showToast('Admin panel ready', 'success');

})();
