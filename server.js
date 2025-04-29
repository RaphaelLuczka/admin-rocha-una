const express = require('express');
const multer = require('multer');
const session = require('express-session');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Firebase Admin SDK
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // ATENÇÃO aqui
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Sessão de login
app.use(session({
  secret: 'seu_segredo_aqui',
  resave: false,
  saveUninitialized: true
}));

function checkAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    req.session.authenticated = true;
    res.redirect('/admin.html');
  } else {
    res.redirect('/login.html');
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/logout.html');
  });
});

// Upload evento
app.post('/upload', checkAuth, upload.single('banner'), async (req, res) => {
  const { titulo, data, descricao } = req.body;
  const file = req.file;
  
  if (!file) return res.status(400).send('Nenhum arquivo enviado.');

  cloudinary.uploader.upload_stream({ folder: 'banners_rocha' }, async (error, result) => {
    if (error) return res.status(500).send('Erro ao enviar imagem.');

    const novoEvento = {
      titulo,
      data,
      descricao,
      url: result.secure_url
    };

    await db.ref('banners').push(novoEvento);
    res.redirect('/admin.html');
  }).end(file.buffer);
});


// Excluir evento do Firebase
app.post('/delete', checkAuth, (req, res) => {
  const { id } = req.body;

  db.ref('banners').child(id).remove()
    .then(() => {
      res.redirect('/admin.html');
    })
    .catch(error => {
      console.error('Erro ao excluir:', error);
      res.status(500).send('Erro ao excluir.');
    });
});

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// Buscar banners
app.get('/banners.json', async (req, res) => {
  const bannersRef = db.ref('banners');
  bannersRef.once('value', (snapshot) => {
    const data = snapshot.val() || {};
    res.json(data);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
