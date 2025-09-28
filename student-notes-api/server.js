import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NOTES_FILE = path.join(__dirname, 'notes.json');

// In-memory storage
let notes = [];
let nextId = 1;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Load notes from file on startup
async function loadNotes() {
  try {
    const data = await fs.readFile(NOTES_FILE, 'utf8');
    const loadedNotes = JSON.parse(data);
    notes = loadedNotes;
    nextId = Math.max(...notes.map(note => note.id), 0) + 1;
    console.log(`Loaded ${notes.length} notes from ${NOTES_FILE}`);
  } catch (error) {
    console.log('No existing notes file found. Starting with empty notes array.');
  }
}

// Save notes to file
async function saveNotes() {
  try {
    await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (error) {
    console.error('Error saving notes:', error.message);
  }
}

// Input validation middleware
const validateNote = (req, res, next) => {
  const { title, content, tags } = req.body;
  
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required and must be a non-empty string' });
  }
  
  if (tags !== undefined && !Array.isArray(tags)) {
    return res.status(400).json({ error: 'Tags must be an array of strings' });
  }
  
  if (tags && !tags.every(tag => typeof tag === 'string')) {
    return res.status(400).json({ error: 'All tags must be strings' });
  }
  
  next();
};

// Routes

// POST /notes - Create a new note
app.post('/notes', validateNote, async (req, res) => {
  try {
    const { title, content, tags = [] } = req.body;
    
    const newNote = {
      id: nextId++,
      title: title.trim(),
      content: content.trim(),
      tags: tags.map(tag => tag.trim()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    notes.push(newNote);
    await saveNotes();
    
    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notes - List all notes with optional filtering
app.get('/notes', (req, res) => {
  try {
    const { tag, q } = req.query;
    let filteredNotes = [...notes];
    
    // Filter by tag
    if (tag) {
      filteredNotes = filteredNotes.filter(note => 
        note.tags.some(noteTag => noteTag.toLowerCase().includes(tag.toLowerCase()))
      );
    }
    
    // Search in title and content
    if (q) {
      const searchTerm = q.toLowerCase();
      filteredNotes = filteredNotes.filter(note => 
        note.title.toLowerCase().includes(searchTerm) || 
        note.content.toLowerCase().includes(searchTerm)
      );
    }
    
    res.json(filteredNotes);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notes/:id - Get a single note by ID
app.get('/notes/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    
    const note = notes.find(note => note.id === id);
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /notes/:id - Update a note
app.put('/notes/:id', validateNote, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    
    const noteIndex = notes.findIndex(note => note.id === id);
    
    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const { title, content, tags = [] } = req.body;
    
    notes[noteIndex] = {
      ...notes[noteIndex],
      title: title.trim(),
      content: content.trim(),
      tags: tags.map(tag => tag.trim()),
      updatedAt: new Date().toISOString()
    };
    
    await saveNotes();
    
    res.json(notes[noteIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /notes/:id - Delete a note
app.delete('/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    
    const noteIndex = notes.findIndex(note => note.id === id);
    
    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    notes.splice(noteIndex, 1);
    await saveNotes();
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
  });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  await loadNotes();
  app.listen(PORT, () => {
    console.log(`Student Notes API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);
