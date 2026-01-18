const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const VIDEOS_DIR = process.env.VIDEOS_DIR || path.join(__dirname, 'videos');
const MAX_IMAGES = 5; // Maximum number of images to keep
const MAX_VIDEOS = 5; // Maximum number of videos to keep

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
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

// Get all uploaded videos sorted by creation time (oldest first)
function getUploadedVideos() {
    try {
        const files = fs.readdirSync(VIDEOS_DIR)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.webm', '.mp4', '.mov', '.avi'].includes(ext);
            })
            .map(file => {
                const filepath = path.join(VIDEOS_DIR, file);
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
        console.error('Error reading videos directory:', err);
        return [];
    }
}

// Delete oldest files to maintain MAX_IMAGES limit
function enforceImageLimit() {
    const files = getUploadedFiles();
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

// Delete oldest videos to maintain MAX_VIDEOS limit
function enforceVideoLimit() {
    const files = getUploadedVideos();
    while (files.length >= MAX_VIDEOS) {
        const oldest = files.shift();
        try {
            fs.unlinkSync(oldest.path);
            console.log(`Deleted oldest video: ${oldest.name}`);
        } catch (err) {
            console.error(`Failed to delete ${oldest.name}:`, err);
        }
    }
}

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        enforceImageLimit();
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const ext = (path.extname(file.originalname) || '.png').trim();
        cb(null, `${uniqueId}${ext}`);
    }
});

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        enforceVideoLimit();
        cb(null, VIDEOS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const ext = (path.extname(file.originalname) || '.webm').trim();
        cb(null, `${uniqueId}${ext}`);
    }
});

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Share page for images - displays image with branding (BEFORE static middleware)
app.get('/share/:filename', (req, res) => {
    const filename = req.params.filename.trim();
    const filepath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).send('Image not found');
    }

    const templatePath = path.join(__dirname, 'share.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(
        'window.SHARE_FILENAME',
        `window.SHARE_FILENAME = "${filename}"`
    );
    res.send(html);
});

// Share page for videos - displays video with branding
app.get('/share-video/:filename', (req, res) => {
    const filename = req.params.filename.trim();
    const filepath = path.join(VIDEOS_DIR, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).send('Video not found');
    }

    const templatePath = path.join(__dirname, 'share-video.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(
        'window.SHARE_FILENAME',
        `window.SHARE_FILENAME = "${filename}"`
    );
    res.send(html);
});

// Serve static files from root
app.use(express.static(__dirname));

// Normalize URLs - trim whitespace from paths
app.use('/uploads', (req, res, next) => {
    const decodedPath = decodeURIComponent(req.path).trim();
    if (decodedPath !== req.path) {
        return res.redirect(301, `/uploads${decodedPath}`);
    }
    next();
});

app.use('/videos', (req, res, next) => {
    const decodedPath = decodeURIComponent(req.path).trim();
    if (decodedPath !== req.path) {
        return res.redirect(301, `/videos${decodedPath}`);
    }
    next();
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/videos', express.static(VIDEOS_DIR));

// API: Upload image
app.post('/api/upload', uploadImage.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const filename = req.file.filename.trim();
    const imageUrl = `/uploads/${filename}`;
    const shareUrl = `/share/${filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${shareUrl}`.trim();

    res.json({
        success: true,
        data: {
            filename: filename,
            url: imageUrl,
            shareUrl: shareUrl,
            fullUrl: fullUrl,
            size: req.file.size,
            imagesStored: getUploadedFiles().length
        }
    });
});

// API: Upload video
app.post('/api/upload-video', uploadVideo.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No video provided' });
    }

    const filename = req.file.filename.trim();
    const videoUrl = `/videos/${filename}`;
    const shareUrl = `/share-video/${filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${shareUrl}`.trim();

    res.json({
        success: true,
        data: {
            filename: filename,
            url: videoUrl,
            shareUrl: shareUrl,
            fullUrl: fullUrl,
            size: req.file.size,
            videosStored: getUploadedVideos().length
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

// API: Get all stored videos
app.get('/api/videos', (req, res) => {
    const files = getUploadedVideos();
    res.json({
        success: true,
        data: {
            count: files.length,
            maxVideos: MAX_VIDEOS,
            videos: files.map(f => ({
                filename: f.name,
                url: `/videos/${f.name}`,
                shareUrl: `/share-video/${f.name}`,
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
    console.log(`Videos directory: ${VIDEOS_DIR}`);
    console.log(`Max images: ${MAX_IMAGES}, Max videos: ${MAX_VIDEOS}`);

    const images = getUploadedFiles();
    const videos = getUploadedVideos();
    console.log(`Current: ${images.length} images, ${videos.length} videos`);
});
