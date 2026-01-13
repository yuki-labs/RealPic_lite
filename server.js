const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const MAX_IMAGES = 5; // Maximum number of images to keep

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Get all uploaded files sorted by creation time (oldest first)
function getUploadedFiles() {
    try {
        const files = fs.readdirSync(UPLOADS_DIR)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
            })
            .map(file => {
                const filepath = path.join(UPLOADS_DIR, file);
                const stats = fs.statSync(filepath);
                return {
                    name: file,
                    path: filepath,
                    created: stats.birthtime.getTime()
                };
            })
            .sort((a, b) => a.created - b.created); // Oldest first
        return files;
    } catch (err) {
        console.error('Error reading uploads directory:', err);
        return [];
    }
}

// Delete oldest files to maintain MAX_IMAGES limit
function enforceImageLimit() {
    const files = getUploadedFiles();

    // Delete oldest files until we're at MAX_IMAGES - 1 (to make room for new upload)
    while (files.length >= MAX_IMAGES) {
        const oldest = files.shift();
        try {
            fs.unlinkSync(oldest.path);
            console.log(`Deleted oldest image: ${oldest.name}`);
        } catch (err) {
            console.error(`Failed to delete ${oldest.name}:`, err);
        }
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Enforce limit before saving new file
        enforceImageLimit();
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const ext = (path.extname(file.originalname) || '.png').trim();
        cb(null, `${uniqueId}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Share page - displays image with branding (BEFORE static middleware)
app.get('/share/:filename', (req, res) => {
    const filename = req.params.filename.trim();
    const filepath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).send('Image not found');
    }

    // Read the share template and inject the filename
    const templatePath = path.join(__dirname, 'share.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    // Inject the filename as a JavaScript variable
    html = html.replace(
        'window.SHARE_FILENAME',
        `window.SHARE_FILENAME = "${filename}"`
    );

    res.send(html);
});

// Serve static files from root
app.use(express.static(__dirname));

// Normalize URLs - trim whitespace from paths (handles trailing %20, etc.)
app.use('/uploads', (req, res, next) => {
    // Decode URL and trim whitespace
    const decodedPath = decodeURIComponent(req.path).trim();
    if (decodedPath !== req.path) {
        // Redirect to clean URL if there was whitespace
        return res.redirect(301, `/uploads${decodedPath}`);
    }
    next();
});

// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// API: Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const filename = req.file.filename.trim();
    const imageUrl = `/uploads/${filename}`;
    const shareUrl = `/share/${filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${shareUrl}`.trim();

    // Get current count for info
    const currentCount = getUploadedFiles().length;

    res.json({
        success: true,
        data: {
            filename: filename,
            url: imageUrl,
            shareUrl: shareUrl,
            fullUrl: fullUrl,
            size: req.file.size,
            imagesStored: currentCount
        }
    });
});

// API: Get all stored images
app.get('/api/images', (req, res) => {
    const files = getUploadedFiles();
    res.json({
        success: true,
        data: {
            count: files.length,
            maxImages: MAX_IMAGES,
            images: files.map(f => ({
                filename: f.name,
                url: `/uploads/${f.name}`,
                shareUrl: `/share/${f.name}`,
                created: new Date(f.created).toISOString()
            }))
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

// API: Delete image
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
    console.log(`Max images: ${MAX_IMAGES}`);

    // Log current image count on startup
    const files = getUploadedFiles();
    console.log(`Current images stored: ${files.length}`);
});
