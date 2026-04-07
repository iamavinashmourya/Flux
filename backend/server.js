const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadsDir));

// List uploaded files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Upload PDF and get info
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // With diskStorage, multer does not provide file.buffer. Read from disk instead.
    const bytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(bytes);
    const numPages = pdfDoc.getPageCount();

    res.json({
      success: true,
      filename: file.originalname,
      pages: numPages,
      size: file.size,
      uploadPath: file.path,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// Rotate PDF
app.post('/api/rotate', upload.single('pdf'), async (req, res) => {
  try {
    const angle = parseInt(req.body.angle) || 90;
    const bytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    pages.forEach((page) => page.rotate(angle, { type: 'degrees' }));
    const pdfBytes = await pdfDoc.save();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=rotated.pdf',
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Rotate error:', err);
    res.status(500).json({ error: 'Failed to rotate PDF' });
  }
});

// Add text to PDF
app.post('/api/add-text', upload.single('pdf'), async (req, res) => {
  try {
    const { text, x, y, size, pageNum } = req.body;
    const bytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    const page = pages[parseInt(pageNum) || 0];

    page.drawText(text || 'Added by PDF Editor', {
      x: parseInt(x) || 50,
      y: parseInt(y) || 50,
      size: parseInt(size) || 24,
      color: { r: 1, g: 0, b: 0 },
    });

    const pdfBytes = await pdfDoc.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=edited.pdf',
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Add text error:', err);
    res.status(500).json({ error: 'Failed to add text' });
  }
});

// Delete uploaded file
app.delete('/api/files/:filename', (req, res) => {
  try {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});