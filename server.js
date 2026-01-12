const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Directory for uploaded images (Railway Volume should be mounted here)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `${uniqueId}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Serve static files from root
app.use(express.static(__dirname));

// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// API: Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;

    res.json({
        success: true,
        data: {
            filename: req.file.filename,
            url: imageUrl,
            fullUrl: fullUrl,
            size: req.file.size
        }
    });
});

// API: Get image info
app.get('/api/image/:filename', (req, res) => {
    const filepath = path.join(UPLOADS_DIR, req.params.filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ success: false, error: 'Image not found' });
    }

    const stats = fs.statSync(filepath);
    res.json({
        success: true,
        data: {
            filename: req.params.filename,
            size: stats.size,
            created: stats.birthtime
        }
    });
});

// API: Delete image (optional, for cleanup)
app.delete('/api/image/:filename', (req, res) => {
    const filepath = path.join(UPLOADS_DIR, req.params.filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ success: false, error: 'Image not found' });
    }

    fs.unlinkSync(filepath);
    res.json({ success: true });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`RealPic Lite server running on port ${PORT}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);
});
