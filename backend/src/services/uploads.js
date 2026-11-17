/**
 * File uploads (assignment submissions, assignment briefs, study materials).
 * Files are stored in MongoDB GridFS (bucket "uploads") so they survive on
 * stateless hosts such as Vercel, where the local disk is wiped between requests.
 * Each file gets a random, unguessable name and is served read-only at
 * /api/uploads/<kind>/<name>.
 */
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { mongoose } = require('../db/database');

// Vercel rejects request bodies above 4.5 MB, so cap uploads a little under that there
const MAX_BYTES = process.env.VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024;
const MAX_LABEL = `${Math.round(MAX_BYTES / 1024 / 1024)} MB`;
const ALLOWED = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt', '.md', '.zip', '.png', '.jpg', '.jpeg', '.ipynb', '.py', '.c', '.cpp', '.java', '.js', '.sql']);
const MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};
const NAME_RE = /^[a-f0-9]{32}\.[a-z0-9]+$/;
const KIND_RE = /^[a-z-]+$/;

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
}

function uploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED.has(ext)) return cb(Object.assign(new Error(`Files of type ${ext || '(none)'} are not accepted`), { status: 400 }));
      cb(null, true);
    }
  }).single('file');
}

function store(kind, file) {
  const filename = `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`;
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(`${kind}/${filename}`, {
      metadata: { kind, originalName: file.originalname, mimetype: file.mimetype }
    });
    stream.once('error', reject);
    stream.once('finish', () => resolve(filename));
    stream.end(file.buffer);
  });
}

/** Express middleware: parse an optional multipart "file" field and persist it to GridFS */
function acceptFile(kind) {
  const handler = uploader();
  return (req, res, next) =>
    handler(req, res, async (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${MAX_LABEL}` : err.message;
        return res.status(400).json({ error: msg });
      }
      if (!req.file) return next();
      try {
        req.file.filename = await store(kind, req.file);
        req.file.buffer = undefined;
        next();
      } catch (e) {
        console.error('Upload storage failed:', e.message);
        res.status(500).json({ error: 'Could not store the uploaded file' });
      }
    });
}

function describe(file, kind) {
  if (!file) return null;
  const kb = file.size / 1024;
  return {
    url: `/api/uploads/${kind}/${file.filename}`,
    name: file.originalname,
    size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`,
    type: path.extname(file.originalname).slice(1).toUpperCase() || 'FILE'
  };
}

/** Delete a previously uploaded file referenced by its public URL (ignores external links) */
function removeByUrl(url) {
  const m = String(url || '').match(/^\/api\/uploads\/([a-z-]+)\/([a-f0-9]{32}\.[a-z0-9]+)$/);
  if (!m) return;
  const b = bucket();
  b.find({ filename: `${m[1]}/${m[2]}` }).toArray()
    .then((files) => Promise.all(files.map((f) => b.delete(f._id))))
    .catch(() => {});
}

/** GET /api/uploads/:kind/:name — stream a stored file back */
async function serveUpload(req, res, next) {
  const { kind, name } = req.params;
  if (!KIND_RE.test(kind) || !NAME_RE.test(name)) return res.status(404).json({ error: 'File not found' });
  try {
    const b = bucket();
    const [file] = await b.find({ filename: `${kind}/${name}` }).limit(1).toArray();
    if (!file) return res.status(404).json({ error: 'File not found' });
    const ext = path.extname(name);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    const original = file.metadata?.originalName;
    if (original) res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(original)}`);
    b.openDownloadStream(file._id).on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { acceptFile, describe, removeByUrl, serveUpload };
