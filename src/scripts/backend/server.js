// server.js — Orbit Backend (JSON Server + JWT)
// Roda em: http://localhost:3001
//
// Rotas públicas:
//   POST /api/auth/register      → cadastro de novo usuário
//   POST /api/auth/login         → login, retorna JWT
//
// Rotas protegidas (exige Bearer token):
//   GET    /api/users                  → lista usuários
//   GET    /api/users/:id              → busca usuário por id
//   GET    /api/posts                  → lista posts (com autor + contadores)
//   POST   /api/posts                  → cria post
//   DELETE /api/posts/:id              → deleta próprio post
//   POST   /api/posts/:id/like         → toggle curtir
//   GET    /api/posts/:id/comments     → lista comentários do post
//   POST   /api/posts/:id/comments     → cria comentário

const jsonServer = require('json-server');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');

// ── Configurações ────────────────────────────────────────────────────────────
const PORT       = 3001;
const JWT_SECRET = 'orbit-jwt-secret-2026';
const JWT_EXPIRES = '1d';
const DB_PATH    = path.join(__dirname, 'db.json');

// ── Helpers do banco ─────────────────────────────────────────────────────────
function getDb()       { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
function saveDb(data)  { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// Remove passwordHash antes de retornar o usuário ao front
function sanitizeUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// Gera um UUID v4 sem dependência externa
function generateId() {
  return crypto.randomUUID();
}

// ── Instância do servidor ────────────────────────────────────────────────────
const server      = jsonServer.create();
const router      = jsonServer.router(DB_PATH);
const middlewares = jsonServer.defaults({ noCors: false });

server.use(middlewares);

// Aumenta limite do body parser para suportar upload de imagens/PDFs em base64
const express = require('express');
server.use(express.json({ limit: '10mb' }));
server.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Middleware de JWT ────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
server.post('/api/auth/register', async (req, res) => {
  const { type, name, email, password, github, cpfCnpj } = req.body;

  // Validações básicas
  if (!type || !name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  if (!['dev', 'company'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de conta inválido.' });
  }

  const db = getDb();

  // E-mail já cadastrado?
  if (db.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'E-mail já cadastrado.' });
  }

  // CPF/CNPJ já cadastrado?
  if (cpfCnpj && db.users.find(u => u.cpfCnpj === cpfCnpj)) {
    return res.status(409).json({ error: 'CPF/CNPJ já cadastrado.' });
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(password, 10);

  const now = new Date().toISOString();

  const newUser = {
    id:           generateId(),
    type,
    name,
    email,
    passwordHash,
    github:       github   || null,
    cpfCnpj:     cpfCnpj  || null,
    createdAt:    now,
    updatedAt:    now,
    disabledAt:   null,
  };

  db.users.push(newUser);
  saveDb(db);

  const token = jwt.sign(
    { id: newUser.id, type: newUser.type, email: newUser.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return res.status(201).json({ token, user: sanitizeUser(newUser) });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
server.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const db   = getDb();
  const user = db.users.find(u => u.email === email);

  // Usuário não encontrado — mesma mensagem para não revelar se o e-mail existe
  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  if (user.disabledAt) {
    return res.status(403).json({ error: 'Conta desativada. Entre em contato com o suporte.' });
  }

  const senhaCorreta = await bcrypt.compare(password, user.passwordHash);
  if (!senhaCorreta) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  const token = jwt.sign(
    { id: user.id, type: user.type, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return res.status(200).json({ token, user: sanitizeUser(user) });
});

// ── Rotas protegidas ─────────────────────────────────────────────────────────
// Qualquer rota /api/users/* exige autenticação
server.use('/api/users', requireAuth);

// GET /api/users/:id/profile — perfil agregado (user + projects + reviews + stats)
server.get('/api/users/:id/profile', requireAuth, (req, res) => {
  const db   = getDb();
  const user = db.users.find(u => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const projects = (db.projects || []).filter(p => p.userId === req.params.id);
  const reviews  = (db.reviews  || []).filter(r => r.userId === req.params.id);

  const ratingSum   = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  const ratingAvg   = reviews.length ? +(ratingSum / reviews.length).toFixed(1) : 0;

  return res.status(200).json({
    user:  sanitizeUser(user),
    projects,
    reviews,
    stats: {
      rating:       ratingAvg,
      reviewsCount: reviews.length,
      projectsCount: projects.length,
    },
  });
});

// PATCH /api/users/:id — atualiza próprio perfil
server.patch('/api/users/:id', requireAuth, (req, res) => {
  // Só permite editar o próprio usuário
  if (req.params.id !== req.user.id) {
    return res.status(403).json({ error: 'Você só pode editar o próprio perfil.' });
  }

  const db    = getDb();
  const idx   = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  // Whitelist — só esses campos podem ser atualizados via PATCH
  const ALLOWED = [
    'name', 'headline', 'bio', 'skills', 'github', 'linkedin',
    'available', 'avatarUrl', 'resumeUrl', 'resumeFileName', 'title',
  ];

  const updates = {};
  for (const key of ALLOWED) {
    if (key in req.body) updates[key] = req.body[key];
  }

  // Validações básicas
  if (updates.name !== undefined && (!updates.name || !updates.name.trim())) {
    return res.status(400).json({ error: 'O nome não pode ser vazio.' });
  }

  if (updates.skills !== undefined && !Array.isArray(updates.skills)) {
    return res.status(400).json({ error: 'Habilidades devem ser uma lista.' });
  }

  if (updates.bio !== undefined && updates.bio && updates.bio.length > 2000) {
    return res.status(400).json({ error: 'A bio excede 2000 caracteres.' });
  }

  // Atualiza
  db.users[idx] = {
    ...db.users[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveDb(db);

  return res.status(200).json(sanitizeUser(db.users[idx]));
});

// ── POSTS ────────────────────────────────────────────────────────────────────

// GET /api/posts — lista todos os posts com autor + contadores
server.get('/api/posts', requireAuth, (req, res) => {
  const db = getDb();

  // Mais recentes primeiro
  const sorted = [...db.posts].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  const enriched = sorted.map(post => {
    const author        = db.users.find(u => u.id === post.userId);
    const likesCount    = db.likes.filter(l => l.postId === post.id).length;
    const commentsCount = db.comments.filter(c => c.postId === post.id).length;
    const likedByMe     = !!db.likes.find(
      l => l.postId === post.id && l.userId === req.user.id
    );

    return {
      ...post,
      author: author ? sanitizeUser(author) : null,
      likesCount,
      commentsCount,
      likedByMe,
    };
  });

  return res.status(200).json(enriched);
});

// POST /api/posts — cria novo post
server.post('/api/posts', requireAuth, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'O conteúdo do post não pode ser vazio.' });
  }

  if (content.length > 5000) {
    return res.status(400).json({ error: 'O conteúdo do post excede 5000 caracteres.' });
  }

  const db = getDb();
  const now = new Date().toISOString();

  const newPost = {
    id:        generateId(),
    userId:    req.user.id,
    content:   content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  db.posts.push(newPost);
  saveDb(db);

  const author = db.users.find(u => u.id === req.user.id);

  return res.status(201).json({
    ...newPost,
    author: author ? sanitizeUser(author) : null,
    likesCount: 0,
    commentsCount: 0,
    likedByMe: false,
  });
});

// DELETE /api/posts/:id — deleta próprio post
server.delete('/api/posts/:id', requireAuth, (req, res) => {
  const db    = getDb();
  const post  = db.posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post não encontrado.' });
  }

  if (post.userId !== req.user.id) {
    return res.status(403).json({ error: 'Você não pode deletar posts de outros usuários.' });
  }

  db.posts    = db.posts.filter(p => p.id !== req.params.id);
  db.comments = db.comments.filter(c => c.postId !== req.params.id);
  db.likes    = db.likes.filter(l => l.postId !== req.params.id);
  saveDb(db);

  return res.status(204).send();
});

// ── LIKES ────────────────────────────────────────────────────────────────────

// POST /api/posts/:id/like — toggle curtir/descurtir
server.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const db   = getDb();
  const post = db.posts.find(p => p.id === req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post não encontrado.' });
  }

  const existing = db.likes.find(
    l => l.postId === req.params.id && l.userId === req.user.id
  );

  let liked;
  if (existing) {
    db.likes = db.likes.filter(l => l.id !== existing.id);
    liked = false;
  } else {
    db.likes.push({
      id:        generateId(),
      postId:    req.params.id,
      userId:    req.user.id,
      createdAt: new Date().toISOString(),
    });
    liked = true;
  }

  saveDb(db);

  const likesCount = db.likes.filter(l => l.postId === req.params.id).length;
  return res.status(200).json({ liked, likesCount });
});

// ── COMMENTS ─────────────────────────────────────────────────────────────────

// GET /api/posts/:id/comments — lista comentários do post
server.get('/api/posts/:id/comments', requireAuth, (req, res) => {
  const db = getDb();

  const comments = db.comments
    .filter(c => c.postId === req.params.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(c => {
      const author = db.users.find(u => u.id === c.userId);
      return { ...c, author: author ? sanitizeUser(author) : null };
    });

  return res.status(200).json(comments);
});

// POST /api/posts/:id/comments — cria comentário
server.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'O comentário não pode ser vazio.' });
  }

  if (content.length > 1000) {
    return res.status(400).json({ error: 'O comentário excede 1000 caracteres.' });
  }

  const db = getDb();

  if (!db.posts.find(p => p.id === req.params.id)) {
    return res.status(404).json({ error: 'Post não encontrado.' });
  }

  const newComment = {
    id:        generateId(),
    postId:    req.params.id,
    userId:    req.user.id,
    content:   content.trim(),
    createdAt: new Date().toISOString(),
  };

  db.comments.push(newComment);
  saveDb(db);

  const author = db.users.find(u => u.id === req.user.id);

  return res.status(201).json({
    ...newComment,
    author: author ? sanitizeUser(author) : null,
  });
});

// ── Rewriter e roteador do JSON Server ───────────────────────────────────────
server.use(jsonServer.rewriter({ '/api/*': '/$1' }));
server.use(router);

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Orbit API rodando em http://localhost:${PORT}`);
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   GET  http://localhost:${PORT}/api/users      (protegido)`);
  console.log(`   GET  http://localhost:${PORT}/api/posts      (protegido)`);
  console.log(`   POST http://localhost:${PORT}/api/posts/:id/like  (protegido)\n`);
});
