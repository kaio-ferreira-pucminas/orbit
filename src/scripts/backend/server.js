// server.js — Orbit Backend (JSON Server + JWT + Resend)
// Roda em: http://localhost:3001
//
// Rotas públicas:
//   POST /api/auth/register             → cadastro (envia email de boas-vindas)
//   POST /api/auth/login                → login, retorna JWT
//   POST /api/auth/forgot-password      → gera token e envia email com link
//   POST /api/auth/reset-password       → valida token e atualiza senha
//
// Rotas protegidas (exige Bearer token):
//   GET    /api/users                   → lista usuários
//   GET    /api/users/:id               → busca usuário por id
//   GET    /api/users/:id/profile       → perfil agregado
//   PATCH  /api/users/:id               → atualiza próprio perfil
//   GET    /api/posts                   → lista posts (com autor + contadores)
//   POST   /api/posts                   → cria post
//   DELETE /api/posts/:id               → deleta próprio post
//   POST   /api/posts/:id/like          → toggle curtir
//   GET    /api/posts/:id/comments      → lista comentários do post
//   POST   /api/posts/:id/comments      → cria comentário
//   POST   /api/auth/deactivate/request → gera código e envia por email
//   POST   /api/auth/deactivate/confirm → valida código e desativa conta
//
// Rotas de dev (apenas para auditoria de emails):
//   GET    /api/dev/emails              → lista todos os emails enviados
//   GET    /api/dev/emails/:id          → renderiza HTML do email no navegador

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const jsonServer = require('json-server');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');

const { sendEmail }              = require('./emails/emailService');
const {
  welcomeEmail,
  resetPasswordEmail,
  deactivationCodeEmail,
  accountDeletedEmail,
} = require('./emails/templates');

// ── Configurações ────────────────────────────────────────────────────────────
const PORT       = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'orbit-jwt-secret-2026';
const JWT_EXPIRES = '1d';
const DB_PATH    = path.join(__dirname, 'db.json');
const APP_URL    = process.env.APP_URL || 'http://localhost:3000';

// CORS — lista de origens permitidas (em produção, usa env CORS_ORIGINS separada por vírgula)
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3010')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const RESET_TOKEN_TTL_MIN  = 60;     // 1 hora
const DEACTIVATE_CODE_TTL  = 15;     // 15 min
const ACCOUNT_DELETE_DAYS  = 30;     // dias após disabledAt

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

// CORS customizado — substitui o do JSON Server pra respeitar CORS_ORIGINS
const cors = require('cors');
server.use(cors({
  origin: function (origin, callback) {
    // Sem origin (curl, healthcheck) → permite
    if (!origin) return callback(null, true);
    // Origin na whitelist → permite
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);
    // Padrão wildcard *.vercel.app → permite (cobre previews)
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return callback(null, true);
    // Resto → bloqueia
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  credentials: true,
}));

// Aumenta limite do body parser para suportar upload de imagens/PDFs em base64
// (10MB raw → ~13MB base64; avatar + currículo no mesmo PATCH → bumpamos pra 30MB)
const express = require('express');
server.use(express.json({ limit: '30mb' }));
server.use(express.urlencoded({ extended: true, limit: '30mb' }));

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

  // Envia email de boas-vindas (não bloqueia o fluxo se falhar)
  try {
    const tpl = welcomeEmail({ name: newUser.name, appUrl: APP_URL });
    await sendEmail(db, {
      to:      newUser.email,
      subject: tpl.subject,
      html:    tpl.html,
      type:    'welcome',
      userId:  newUser.id,
    });
  } catch (err) {
    console.warn('Falha ao enviar welcome email:', err.message);
  }

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

  const senhaCorreta = await bcrypt.compare(password, user.passwordHash);
  if (!senhaCorreta) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  // Conta desativada: reativa se ainda está dentro dos 30 dias
  if (user.disabledAt) {
    const idx = db.users.findIndex(u => u.id === user.id);
    db.users[idx].disabledAt = null;
    db.users[idx].updatedAt  = new Date().toISOString();
    saveDb(db);
    user.disabledAt = null;
    console.log(`✅ Conta reativada por login: ${user.email}`);
  }

  const token = jwt.sign(
    { id: user.id, type: user.type, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return res.status(200).json({ token, user: sanitizeUser(user) });
});

// ── POST /api/auth/forgot-password ──────────────────────────────────────────
server.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Informe seu e-mail.' });

  const db   = getDb();
  const user = db.users.find(u => u.email === email);

  // IMPORTANTE: por segurança, sempre retornamos a mesma resposta.
  // Não revelamos se o e-mail existe ou não.
  if (!user) {
    return res.status(200).json({ message: 'Se este e-mail estiver cadastrado, você receberá um link.' });
  }

  // Invalida tokens anteriores deste usuário
  db.password_reset_tokens = (db.password_reset_tokens || []).filter(t => t.userId !== user.id);

  const token = crypto.randomBytes(32).toString('hex');
  const now   = Date.now();
  db.password_reset_tokens.push({
    id:        generateId(),
    userId:    user.id,
    token,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RESET_TOKEN_TTL_MIN * 60 * 1000).toISOString(),
    usedAt:    null,
  });

  // Envia email
  const resetUrl = `${APP_URL}/pages/reset-password.html?token=${token}`;
  try {
    const tpl = resetPasswordEmail({
      name:             user.name,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MIN,
    });
    await sendEmail(db, {
      to:      user.email,
      subject: tpl.subject,
      html:    tpl.html,
      type:    'reset',
      userId:  user.id,
    });
  } catch (err) {
    console.warn('Falha ao enviar email de reset:', err.message);
  }

  saveDb(db);
  return res.status(200).json({ message: 'Se este e-mail estiver cadastrado, você receberá um link.' });
});

// ── POST /api/auth/reset-password ───────────────────────────────────────────
server.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token e senha são obrigatórios.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
  }

  const db    = getDb();
  const entry = (db.password_reset_tokens || []).find(t => t.token === token);

  if (!entry || entry.usedAt || new Date(entry.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
  }

  const userIdx = db.users.findIndex(u => u.id === entry.userId);
  if (userIdx === -1) {
    return res.status(400).json({ error: 'Usuário não encontrado.' });
  }

  // Atualiza senha
  db.users[userIdx].passwordHash = await bcrypt.hash(password, 10);
  db.users[userIdx].updatedAt    = new Date().toISOString();

  // Marca token como usado
  entry.usedAt = new Date().toISOString();

  saveDb(db);
  return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
});

// ── POST /api/auth/deactivate/request ───────────────────────────────────────
server.post('/api/auth/deactivate/request', requireAuth, async (req, res) => {
  const db    = getDb();
  const user  = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  // Invalida códigos anteriores
  db.deactivation_codes = (db.deactivation_codes || []).filter(c => c.userId !== user.id);

  // Gera código de 6 dígitos
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now  = Date.now();
  db.deactivation_codes.push({
    id:        generateId(),
    userId:    user.id,
    code,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEACTIVATE_CODE_TTL * 60 * 1000).toISOString(),
    usedAt:    null,
  });

  // Envia email
  try {
    const tpl = deactivationCodeEmail({
      name:             user.name,
      code,
      expiresInMinutes: DEACTIVATE_CODE_TTL,
    });
    await sendEmail(db, {
      to:      user.email,
      subject: tpl.subject,
      html:    tpl.html,
      type:    'deactivation',
      userId:  user.id,
    });
  } catch (err) {
    console.warn('Falha ao enviar email de desativação:', err.message);
  }

  saveDb(db);
  return res.status(200).json({ message: 'Código enviado para o seu e-mail.' });
});

// ── POST /api/auth/deactivate/confirm ───────────────────────────────────────
server.post('/api/auth/deactivate/confirm', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Informe o código recebido por e-mail.' });

  const db    = getDb();
  const entry = (db.deactivation_codes || []).find(
    c => c.userId === req.user.id && c.code === code
  );

  if (!entry || entry.usedAt || new Date(entry.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Código inválido ou expirado.' });
  }

  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) return res.status(404).json({ error: 'Usuário não encontrado.' });

  // Soft delete
  db.users[userIdx].disabledAt = new Date().toISOString();
  db.users[userIdx].updatedAt  = new Date().toISOString();
  entry.usedAt = new Date().toISOString();

  saveDb(db);
  return res.status(200).json({ message: 'Conta desativada. Você tem 30 dias para reativá-la fazendo login novamente.' });
});

// ── DEV: visualização dos emails enviados ───────────────────────────────────
// Sem autenticação por simplicidade (rota apenas pra debug local)

server.get('/api/dev/emails', (req, res) => {
  const db = getDb();
  const list = (db.sent_emails || [])
    .slice()
    .reverse()
    .map(e => ({
      id: e.id, type: e.type, to: e.to, subject: e.subject,
      userId: e.userId, createdAt: e.createdAt,
      providerId: e.providerId, providerError: e.providerError,
    }));
  return res.json(list);
});

server.get('/api/dev/emails/:id', (req, res) => {
  const db    = getDb();
  const email = (db.sent_emails || []).find(e => e.id === req.params.id);
  if (!email) return res.status(404).send('Email não encontrado');
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(email.html);
});

// ── Cleanup: exclui contas desativadas há mais de 30 dias ───────────────────
async function cleanupExpiredAccounts() {
  const db    = getDb();
  const limit = Date.now() - ACCOUNT_DELETE_DAYS * 24 * 60 * 60 * 1000;
  const toDelete = (db.users || []).filter(
    u => u.disabledAt && new Date(u.disabledAt).getTime() < limit
  );

  if (toDelete.length === 0) return;

  for (const user of toDelete) {
    console.log(`🗑️  Excluindo conta expirada: ${user.email} (desativada em ${user.disabledAt})`);

    // Email de confirmação de exclusão
    try {
      const tpl = accountDeletedEmail({ name: user.name });
      await sendEmail(db, {
        to:      user.email,
        subject: tpl.subject,
        html:    tpl.html,
        type:    'deleted',
        userId:  user.id,
      });
    } catch (err) {
      console.warn('Falha ao enviar email de exclusão:', err.message);
    }

    // Remove user + dados relacionados
    db.users    = db.users.filter(u => u.id !== user.id);
    db.posts    = (db.posts    || []).filter(p => p.userId !== user.id);
    db.comments = (db.comments || []).filter(c => c.userId !== user.id);
    db.likes    = (db.likes    || []).filter(l => l.userId !== user.id);
    db.projects = (db.projects || []).filter(p => p.userId !== user.id);
    db.reviews  = (db.reviews  || []).filter(r => r.userId !== user.id);
    db.password_reset_tokens = (db.password_reset_tokens || []).filter(t => t.userId !== user.id);
    db.deactivation_codes    = (db.deactivation_codes    || []).filter(c => c.userId !== user.id);
  }

  saveDb(db);
}

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
server.listen(PORT, async () => {
  console.log(`\n🚀 Orbit API rodando em http://localhost:${PORT}`);
  console.log(`   📮 Auth:    POST /api/auth/{register,login,forgot-password,reset-password}`);
  console.log(`   👥 Users:   GET/PATCH /api/users/:id  (protegido)`);
  console.log(`   📝 Posts:   GET/POST/DELETE /api/posts  (protegido)`);
  console.log(`   ⚠️  Conta:   POST /api/auth/deactivate/{request,confirm}  (protegido)`);
  console.log(`   📧 Dev:     GET /api/dev/emails  (audit dos emails enviados)`);

  if (!process.env.RESEND_API_KEY) {
    console.warn(`\n⚠️  RESEND_API_KEY não configurado no .env — emails serão apenas simulados.`);
  } else {
    console.log(`\n✉️  Resend configurado (de: ${process.env.RESEND_FROM_EMAIL})`);
  }

  // Roda cleanup uma vez ao iniciar e depois a cada 1h
  await cleanupExpiredAccounts();
  setInterval(cleanupExpiredAccounts, 60 * 60 * 1000);
  console.log('');
});
