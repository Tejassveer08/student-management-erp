/**
 * File uploads (assignment submissions, assignment briefs, study materials).
 * Files are stored on disk under backend/uploads/<kind>/ with random, unguessable
 * names and served read-only at /api/uploads/<kind>/<name>.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ROOT = path.resolve(__dirname, '../../uploads');
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt', '.md', '.zip', '.png', '.jpg', '.jpeg', '.ipynb', '.py', '.c', '.cpp', '.java', '.js', '.sql']);

function uploader(kind) {
  const dir = path.join(ROOT, kind);
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED.has(ext)) return cb(Object.assign(new Error(`Files of type ${ext || '(none)'} are not accepted`), { status: 400 }));
      cb(null, true);
    }
  }).single('file');
}

/** Express middleware wrapper that turns multer errors into 400 JSON responses */
function acceptFile(kind) {
  const handler = uploader(kind);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 15 MB' : err.message;
      res.status(400).json({ error: msg });
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
  fs.promises.unlink(path.join(ROOT, m[1], m[2])).catch(() => {});
}

module.exports = { ROOT, acceptFile, describe, removeByUrl };
