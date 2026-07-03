const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database file path
const DB_PATH = path.join(__dirname, 'database', 'data.json');

// Initialize database
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultData = { users: [], attendance: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
  }
}

function readDB() {
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

initDB();

// ====== API ROUTES ======

// Register a new user with face descriptor
app.post('/api/users/register', (req, res) => {
  try {
    const { name, faceDescriptor } = req.body;
    if (!name || !faceDescriptor) {
      return res.status(400).json({ error: 'Name and face descriptor required' });
    }
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ error: 'Invalid face descriptor (must be 128 values)' });
    }

    const db = readDB();
    const existingUser = db.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists', user: existingUser });
    }

    const newUser = {
      id: 'USER-' + Date.now(),
      name,
      faceDescriptor,
      registeredAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);

    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', (req, res) => {
  try {
    const db = readDB();
    res.json(db.users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start duty (attendance check-in)
app.post('/api/attendance/start', (req, res) => {
  try {
    const { userId, userName, imageBase64, latitude, longitude, faceDescriptor } = req.body;
    
    // Save the image
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageName = `duty_start_${userId}_${Date.now()}.jpg`;
    const imagePath = path.join(__dirname, 'images', imageName);
    fs.writeFileSync(imagePath, base64Data, 'base64');

    const db = readDB();

    const attendanceRecord = {
      id: 'ATT-' + Date.now(),
      userId,
      userName,
      dutyStart: {
        time: new Date().toISOString(),
        imagePath: '/images/' + imageName,
        latitude: latitude || null,
        longitude: longitude || null,
        faceDescriptor
      },
      dutyEnd: null,
      status: 'active'
    };

    db.attendance.push(attendanceRecord);
    writeDB(db);

    res.json({ success: true, attendance: attendanceRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End duty (attendance check-out with face match verification)
app.post('/api/attendance/end', (req, res) => {
  try {
    const { attendanceId, imageBase64, latitude, longitude, faceDescriptor, faceMatchDistance } = req.body;

    // Save the end duty image
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageName = `duty_end_${attendanceId}_${Date.now()}.jpg`;
    const imagePath = path.join(__dirname, 'images', imageName);
    fs.writeFileSync(imagePath, base64Data, 'base64');

    const db = readDB();
    const record = db.attendance.find(a => a.id === attendanceId);

    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (record.dutyEnd) {
      return res.status(400).json({ error: 'Duty already ended' });
    }

    const isFaceMatched = faceMatchDistance !== undefined && faceMatchDistance <= 0.6;

    record.dutyEnd = {
      time: new Date().toISOString(),
      imagePath: '/images/' + imageName,
      latitude: latitude || null,
      longitude: longitude || null,
      faceDescriptor,
      faceMatchDistance: faceMatchDistance || null,
      faceMatched: isFaceMatched
    };
    record.status = isFaceMatched ? 'present' : 'face_mismatch';

    writeDB(db);

    res.json({ 
      success: true, 
      attendance: record,
      faceMatched: isFaceMatched,
      faceMatchDistance: faceMatchDistance || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get attendance records for a user
app.get('/api/attendance/:userId', (req, res) => {
  try {
    const db = readDB();
    const records = db.attendance.filter(a => a.userId === req.params.userId);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all attendance records
app.get('/api/attendance', (req, res) => {
  try {
    const db = readDB();
    res.json(db.attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get today's active duty for a user
app.get('/api/attendance/active/:userId', (req, res) => {
  try {
    const db = readDB();
    const active = db.attendance.find(a => a.userId === req.params.userId && a.dutyEnd === null);
    res.json(active || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== ADMIN API ======

// Get overall system stats
app.get('/api/admin/stats', (req, res) => {
  try {
    const db = readDB();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const totalUsers = db.users.length;
    const totalRecords = db.attendance.length;
    const activeDuties = db.attendance.filter(a => a.dutyEnd === null).length;
    
    const todayRecords = db.attendance.filter(a => a.dutyStart.time >= todayStart);
    const todayPresent = todayRecords.filter(a => a.status === 'present').length;
    const todayMismatch = todayRecords.filter(a => a.status === 'face_mismatch').length;
    const todayActive = todayRecords.filter(a => a.status === 'active').length;

    // User-wise stats
    const userStats = db.users.map(user => {
      const userRecords = db.attendance.filter(a => a.userId === user.id);
      const total = userRecords.length;
      const present = userRecords.filter(r => r.status === 'present').length;
      const mismatch = userRecords.filter(r => r.status === 'face_mismatch').length;
      const active = userRecords.filter(r => r.status === 'active').length;
      const todayRecord = userRecords.find(r => r.dutyStart.time >= todayStart && r.dutyEnd === null);
      
      return {
        userId: user.id,
        name: user.name,
        registeredAt: user.registeredAt,
        total,
        present,
        mismatch,
        active,
        isOnDuty: !!todayRecord,
        activeAttendanceId: todayRecord ? todayRecord.id : null
      };
    });

    res.json({
      totalUsers,
      totalRecords,
      activeDuties,
      today: {
        total: todayRecords.length,
        present: todayPresent,
        mismatch: todayMismatch,
        active: todayActive
      },
      userStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all attendance records with user info (full details for admin)
app.get('/api/admin/attendance', (req, res) => {
  try {
    const db = readDB();
    const records = db.attendance;
    
    // Attach user info
    const enriched = records.map(record => {
      const user = db.users.find(u => u.id === record.userId);
      return {
        ...record,
        user: user ? { id: user.id, name: user.name, registeredAt: user.registeredAt } : null
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== FRONTEND ROUTES ======

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Nexus Attendance System`);
  console.log(`📸 User Portal: http://localhost:${PORT}`);
  console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
});
