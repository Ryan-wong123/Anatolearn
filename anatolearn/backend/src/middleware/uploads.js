const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');
const storage = require('../storage');
function cleanupFailedUpload(req, res, next) {
    res.once('finish', () => { if (res.statusCode >= 400)
        for (const file of Object.values(req.files || {}).flat())
            void fs.unlink(file.path).catch(() => { }); if (res.statusCode >= 400 && req.file)
        void fs.unlink(req.file.path).catch(() => { }); });
    next();
}
const uploadVideoAndCaptions = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const folder = path.extname(file.originalname).toLowerCase() === '.vtt' ? 'captions' : 'videos';
            const target = path.join(storage.UPLOAD_ROOT, folder);
            fs.mkdir(target, { recursive: true }).then(() => cb(null, target)).catch((err) => cb(err, target));
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${ext === '.vtt' ? 'captions' : 'video'}-${randomUUID()}${ext}`);
        },
    }),
    limits: { fileSize: 200 * 1024 * 1024, files: 2, fields: 20, fieldSize: 64 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const accepted = file.fieldname === 'video' ? ['.mp4', '.webm'].includes(ext) : file.fieldname === 'captions' && ext === '.vtt';
        cb(accepted ? null : new Error(file.fieldname === 'video' ? 'Only .mp4 and .webm files are allowed' : 'Only .vtt WebVTT caption files are allowed'), accepted);
    },
}).fields([{ name: 'video', maxCount: 1 }, { name: 'captions', maxCount: 1 }]);
const modelStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const modelsDir = path.join(storage.UPLOAD_ROOT, "models/anatomy");
        fs.mkdir(modelsDir, { recursive: true })
            .then(() => cb(null, modelsDir))
            .catch((err) => cb(err, modelsDir));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `model-${randomUUID()}${ext}`;
        cb(null, safeName);
    },
});
const uploadModel = multer({
    storage: modelStorage,
    limits: { fileSize: 200 * 1024 * 1024, files: 1, fields: 20, fieldSize: 64 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => {
        const allowed = [".glb", ".gltf", ".obj", ".usdz"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only GLB, self-contained glTF, OBJ and USDZ files are allowed. Export Unreal .uasset files to GLB first."));
        }
    },
});
const resourceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const resourcesDir = path.join(storage.UPLOAD_ROOT, "resources");
        fs.mkdir(resourcesDir, { recursive: true })
            .then(() => cb(null, resourcesDir))
            .catch((err) => cb(err, resourcesDir));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `resource-${randomUUID()}${ext}`;
        cb(null, safeName);
    },
});
const uploadResource = multer({
    storage: resourceStorage,
    limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 20, fieldSize: 64 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowed = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only PDF, DOC/DOCX, PNG, JPEG and WebP files are allowed"));
        }
    },
});
module.exports = { uploadModel, uploadVideoAndCaptions, uploadResource, cleanupFailedUpload };
