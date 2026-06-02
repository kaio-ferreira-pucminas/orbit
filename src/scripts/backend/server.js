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
    // Padrão wildcard *.onrender.com → permite (cobre o static site na Render)
    if (/^https:\/\/[^.]+\.onrender\.com$/.test(origin)) return callback(null, true);
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
  // reviews do perfil — suporta tanto profileUserId quanto userId (compat. com seeds)
  const rawReviews = (db.reviews || []).filter(r => (r.profileUserId || r.userId) === req.params.id);

  // enriquecе cada review com campos normalizados (suporta múltiplos formatos de seed)
  const reviews = rawReviews.map(r => {
    const author = db.users.find(u => u.id === (r.authorCompanyId || r.authorId));
    return {
      ...r,
      comment:    r.comment || r.content || '',
      authorName: r.authorName || r.companyName || (author ? author.name : 'Empresa parceira'),
      authorRole: r.authorRole || r.reviewerRole || r.companyName || (author ? (author.type === 'company' ? 'Empresa parceira' : (author.title || 'Colaborador')) : 'Parceiro'),
    };
  });

  const ratingSum   = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  const ratingAvg   = reviews.length ? +(ratingSum / reviews.length).toFixed(1) : 0;

  // contagem de conexões (follows), se a coleção existir
  const connectionsCount = (db.follows || []).filter(
    f => f.followerId === req.params.id || f.followingId === req.params.id
  ).length;

  return res.status(200).json({
    user:  { ...sanitizeUser(user), connectionsCount },
    projects,
    reviews,
    stats: {
      rating:        ratingAvg,
      reviewsCount:  reviews.length,
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
    'experiences', 'interests',
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

    // Notifica o autor do post (nunca em auto-curtida)
    if (post.userId && post.userId !== req.user.id) {
      const me = db.users.find(u => u.id === req.user.id);
      db.notifications = db.notifications || [];
      db.notifications.push({
        id:        generateId(),
        userId:    post.userId,
        type:      'new_like',
        actorId:   req.user.id,
        postId:    post.id,
        message:   `${me ? me.name : 'Alguém'} curtiu seu post.`,
        read:      false,
        createdAt: new Date().toISOString(),
      });
    }
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

  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) {
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

  // Notifica o autor do post (nunca em auto-comentário)
  if (post.userId && post.userId !== req.user.id) {
    const author2 = db.users.find(u => u.id === req.user.id);
    db.notifications = db.notifications || [];
    db.notifications.push({
      id:        generateId(),
      userId:    post.userId,
      type:      'new_comment',
      actorId:   req.user.id,
      postId:    post.id,
      message:   `${author2 ? author2.name : 'Alguém'} comentou no seu post.`,
      read:      false,
      createdAt: new Date().toISOString(),
    });
  }

  saveDb(db);

  const author = db.users.find(u => u.id === req.user.id);

  return res.status(201).json({
    ...newComment,
    author: author ? sanitizeUser(author) : null,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SPRINT 02 — endpoints agregados (vagas, candidaturas, recomendações,
// mensagens, notificações). CRUD simples cai no router automático do JSON Server.
// ══════════════════════════════════════════════════════════════════════════════

// ── TALENTS (#8 Busca de Talentos — lado empresa) ────────────────────────────

// GET /api/talents — lista desenvolvedores sanitizados, com filtros opcionais
// Query: ?q=texto&skill=React&level=Pleno&available=true
server.get('/api/talents', requireAuth, (req, res) => {
  const db = getDb();
  const { q, skill, level, available } = req.query;

  let devs = (db.users || []).filter(u => u.type === 'dev' && !u.disabledAt);

  if (skill) {
    const s = String(skill).toLowerCase();
    devs = devs.filter(u => (u.skills || []).some(k => String(k).toLowerCase() === s));
  }
  if (level) {
    const lv = String(level).toLowerCase();
    devs = devs.filter(u => String(u.level || u.seniority || '').toLowerCase() === lv);
  }
  if (available === 'true') {
    devs = devs.filter(u => u.available === true);
  }
  if (q) {
    const term = String(q).toLowerCase();
    devs = devs.filter(u =>
      [u.name, u.title, u.headline, (u.skills || []).join(' ')].join(' ').toLowerCase().includes(term)
    );
  }

  // Enriquecе com rating médio (das reviews) e contagem
  const enriched = devs.map(u => {
    const reviews = (db.reviews || []).filter(r => r.profileUserId === u.id);
    const ratingSum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const rating = reviews.length ? +(ratingSum / reviews.length).toFixed(1) : 0;
    return { ...sanitizeUser(u), rating, reviewsCount: reviews.length };
  });

  return res.status(200).json(enriched);
});

// ── JOBS (#2 Listagem, #3 Detalhes) ──────────────────────────────────────────

// GET /api/jobs — lista vagas com filtros opcionais (tech, modality, level, q)
server.get('/api/jobs', requireAuth, (req, res) => {
  const db = getDb();
  const { tech, modality, level, q, status } = req.query;

  let jobs = [...(db.jobs || [])];

  if (status)   jobs = jobs.filter(j => j.status === status);
  if (modality) jobs = jobs.filter(j => j.modality === modality);
  if (level)    jobs = jobs.filter(j => j.level === level);
  if (tech)     jobs = jobs.filter(j => (j.skills || []).some(s => s.toLowerCase() === String(tech).toLowerCase()));
  if (q) {
    const term = String(q).toLowerCase();
    jobs = jobs.filter(j =>
      [j.title, j.companyName, (j.skills || []).join(' ')].join(' ').toLowerCase().includes(term)
    );
  }

  // savedByMe para o usuário atual
  const savedSet = new Set((db.saved_jobs || []).filter(s => s.userId === req.user.id).map(s => s.jobId));
  const enriched = jobs
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(j => ({ ...j, savedByMe: savedSet.has(j.id) }));

  return res.status(200).json(enriched);
});

// GET /api/jobs/:id — detalhe da vaga + empresa + flags do usuário + similares
server.get('/api/jobs/:id', requireAuth, (req, res) => {
  const db  = getDb();
  const job = (db.jobs || []).find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada.' });

  const company = (db.companies || []).find(c => c.id === job.companyId) || null;
  const savedByMe   = !!(db.saved_jobs || []).find(s => s.jobId === job.id && s.userId === req.user.id);
  const appliedByMe = !!(db.applications || []).find(a => a.jobId === job.id && a.userId === req.user.id);

  // vagas similares: compartilham pelo menos 1 skill, exceto a própria
  const similar = (db.jobs || [])
    .filter(j => j.id !== job.id && (j.skills || []).some(s => (job.skills || []).includes(s)))
    .slice(0, 3)
    .map(j => ({ id: j.id, title: j.title, companyName: j.companyName, modality: j.modality, level: j.level, salaryRange: j.salaryRange }));

  return res.status(200).json({ ...job, company, savedByMe, appliedByMe, similar });
});

// ── APPLICATIONS (#3 candidatura, #12 candidatos por vaga) ───────────────────

// POST /api/applications — candidatar-se a uma vaga
server.post('/api/applications', requireAuth, (req, res) => {
  const { jobId, coverMessage } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId é obrigatório.' });

  const db = getDb();
  if (!(db.jobs || []).find(j => j.id === jobId)) {
    return res.status(404).json({ error: 'Vaga não encontrada.' });
  }

  db.applications = db.applications || [];
  if (db.applications.find(a => a.jobId === jobId && a.userId === req.user.id)) {
    return res.status(409).json({ error: 'Você já se candidatou a esta vaga.' });
  }

  const newApp = {
    id:           generateId(),
    jobId,
    userId:       req.user.id,
    status:       'enviada',
    appliedAt:    new Date().toISOString(),
    coverMessage: (coverMessage || '').trim(),
  };
  db.applications.push(newApp);

  // Notifica a empresa dona da vaga (se houver userId vinculado)
  const job     = db.jobs.find(j => j.id === jobId);
  const company = (db.companies || []).find(c => c.id === job.companyId);
  const me      = db.users.find(u => u.id === req.user.id);
  if (company && company.userId) {
    db.notifications = db.notifications || [];
    db.notifications.push({
      id:        generateId(),
      userId:    company.userId,
      type:      'new_application',
      refId:     newApp.id,
      message:   `${me ? me.name : 'Um candidato'} se candidatou à sua vaga de ${job.title}.`,
      read:      false,
      createdAt: new Date().toISOString(),
    });
  }

  saveDb(db);
  return res.status(201).json(newApp);
});

// GET /api/applications/me — minhas candidaturas (com dados da vaga)
server.get('/api/applications/me', requireAuth, (req, res) => {
  const db = getDb();
  const list = (db.applications || [])
    .filter(a => a.userId === req.user.id)
    .map(a => {
      const job = (db.jobs || []).find(j => j.id === a.jobId) || null;
      return { ...a, job };
    })
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  return res.status(200).json(list);
});

// GET /api/jobs/:id/applications — candidatos de uma vaga (lado empresa, #12)
server.get('/api/jobs/:id/applications', requireAuth, (req, res) => {
  const db  = getDb();
  const job = (db.jobs || []).find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada.' });

  const applicants = (db.applications || [])
    .filter(a => a.jobId === req.params.id)
    .map(a => {
      const user = db.users.find(u => u.id === a.userId);
      return { ...a, candidate: user ? sanitizeUser(user) : null };
    });

  // Funil por status
  const funnel = {
    total:      applicants.length,
    em_analise: applicants.filter(a => a.status === 'em_analise').length,
    entrevista: applicants.filter(a => a.status === 'entrevista').length,
    recusado:   applicants.filter(a => a.status === 'recusado').length,
  };

  return res.status(200).json({ job, funnel, applicants });
});

// ── SAVED JOBS (#2/#3 salvar vaga, #12 histórico) ────────────────────────────

// POST /api/saved-jobs — toggle salvar/remover vaga
server.post('/api/saved-jobs', requireAuth, (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId é obrigatório.' });

  const db = getDb();
  db.saved_jobs = db.saved_jobs || [];
  const existing = db.saved_jobs.find(s => s.jobId === jobId && s.userId === req.user.id);

  let saved;
  if (existing) {
    db.saved_jobs = db.saved_jobs.filter(s => s.id !== existing.id);
    saved = false;
  } else {
    db.saved_jobs.push({
      id:      generateId(),
      userId:  req.user.id,
      jobId,
      savedAt: new Date().toISOString(),
    });
    saved = true;
  }

  saveDb(db);
  return res.status(200).json({ saved });
});

// GET /api/saved-jobs/me — minhas vagas salvas (com dados da vaga)
server.get('/api/saved-jobs/me', requireAuth, (req, res) => {
  const db = getDb();
  const list = (db.saved_jobs || [])
    .filter(s => s.userId === req.user.id)
    .map(s => {
      const job = (db.jobs || []).find(j => j.id === s.jobId) || null;
      return { ...s, job };
    });
  return res.status(200).json(list);
});

// ── RECOMMENDATIONS (#6 Oportunidades Recomendadas) ──────────────────────────

// GET /api/recommendations/me — vagas recomendadas para mim, ordenadas por match
server.get('/api/recommendations/me', requireAuth, (req, res) => {
  const db = getDb();

  // Recomendações pré-calculadas no seed
  const stored = (db.recommendations || []).filter(r => r.userId === req.user.id);

  // Enriquecе com a vaga; se não houver seed, calcula match on-the-fly pelas skills
  let list;
  if (stored.length) {
    list = stored.map(r => ({ ...r, job: (db.jobs || []).find(j => j.id === r.jobId) || null }));
  } else {
    const me = db.users.find(u => u.id === req.user.id);
    const mySkills = (me && Array.isArray(me.skills) ? me.skills : []).map(s => s.toLowerCase());
    list = (db.jobs || []).map(job => {
      const skills = job.skills || [];
      const matched = skills.filter(s => mySkills.includes(s.toLowerCase()));
      const ratio = skills.length ? matched.length / skills.length : 0;
      return {
        id: `rec-dyn-${job.id}`,
        userId: req.user.id,
        jobId: job.id,
        matchScore: Math.round(40 + ratio * 60),
        matchedSkills: matched,
        reason: matched.length
          ? `Compatível com suas habilidades em ${matched.slice(0, 3).join(', ')}.`
          : 'Selecionada para ampliar seu repertório técnico.',
        job,
      };
    });
  }

  list.sort((a, b) => b.matchScore - a.matchScore);
  return res.status(200).json(list);
});

// ── FOLLOWS (sistema de seguir) ──────────────────────────────────────────────

// Helper: existe relação de follow entre dois usuários (A segue B OU B segue A)?
function hasConnection(db, idA, idB) {
  return (db.follows || []).some(f =>
    (f.followerId === idA && f.followingId === idB) ||
    (f.followerId === idB && f.followingId === idA)
  );
}

// POST /api/follows — toggle seguir / deixar de seguir { targetUserId }
server.post('/api/follows', requireAuth, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId é obrigatório.' });
  if (targetUserId === req.user.id) return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' });

  const db = getDb();
  if (!db.users.find(u => u.id === targetUserId)) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  db.follows = db.follows || [];
  const existing = db.follows.find(f => f.followerId === req.user.id && f.followingId === targetUserId);

  let following;
  if (existing) {
    db.follows = db.follows.filter(f => f.id !== existing.id);
    following = false;
  } else {
    db.follows.push({
      id:          generateId(),
      followerId:  req.user.id,
      followingId: targetUserId,
      createdAt:   new Date().toISOString(),
    });
    following = true;

    // Notifica quem foi seguido (apenas ao começar a seguir)
    const me = db.users.find(u => u.id === req.user.id);
    db.notifications = db.notifications || [];
    db.notifications.push({
      id:        generateId(),
      userId:    targetUserId,
      type:      'new_follower',
      refId:     req.user.id,
      message:   `${me ? me.name : 'Alguém'} começou a seguir você.`,
      read:      false,
      createdAt: new Date().toISOString(),
    });
  }

  saveDb(db);
  const followsMe = (db.follows || []).some(f => f.followerId === targetUserId && f.followingId === req.user.id);
  return res.status(200).json({ following, followsMe });
});

// GET /api/users/:id/follow-status — relação entre o usuário atual e :id
server.get('/api/users/:id/follow-status', requireAuth, (req, res) => {
  const db = getDb();
  const following = (db.follows || []).some(f => f.followerId === req.user.id && f.followingId === req.params.id);
  const followsMe = (db.follows || []).some(f => f.followerId === req.params.id && f.followingId === req.user.id);
  return res.status(200).json({ following, followsMe });
});

// GET /api/connections/me — usuários que eu sigo OU que me seguem (sanitizados)
// Base para iniciar conversas. Aceita ?q= para busca por nome.
server.get('/api/connections/me', requireAuth, (req, res) => {
  const db = getDb();
  const me = req.user.id;

  const ids = new Set();
  (db.follows || []).forEach(f => {
    if (f.followerId === me)  ids.add(f.followingId);
    if (f.followingId === me) ids.add(f.followerId);
  });

  const q = (req.query.q || '').toLowerCase().trim();
  const list = [...ids]
    .map(id => db.users.find(u => u.id === id))
    .filter(Boolean)
    .filter(u => !u.disabledAt)
    .filter(u => !q || (u.name || '').toLowerCase().includes(q))
    .map(u => {
      const iFollow   = (db.follows || []).some(f => f.followerId === me && f.followingId === u.id);
      const followsMe = (db.follows || []).some(f => f.followerId === u.id && f.followingId === me);
      return { ...sanitizeUser(u), relation: { following: iFollow, followsMe } };
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return res.status(200).json(list);
});

// ── MESSAGES (#1 Sistema de Mensagens) ───────────────────────────────────────

// POST /api/conversations — inicia (ou reaproveita) conversa com { targetUserId }
// Regra: só é permitido conversar com quem você segue OU quem te segue.
server.post('/api/conversations', requireAuth, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId é obrigatório.' });
  if (targetUserId === req.user.id) return res.status(400).json({ error: 'Você não pode conversar consigo mesmo.' });

  const db = getDb();
  const target = db.users.find(u => u.id === targetUserId);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

  // Regra de follow — exceção: contas do tipo empresa podem iniciar conversa
  // diretamente (ex.: recrutador entrando em contato com um talento).
  const isCompany = req.user.type === 'company';
  if (!isCompany && !hasConnection(db, req.user.id, targetUserId)) {
    return res.status(403).json({ error: 'Você só pode iniciar conversa com usuários que segue ou que seguem você.' });
  }

  // Idempotente: reaproveita conversa existente entre os dois
  db.conversations = db.conversations || [];
  let conv = db.conversations.find(c =>
    (c.participantIds || []).includes(req.user.id) &&
    (c.participantIds || []).includes(targetUserId)
  );

  let created = false;
  if (!conv) {
    const now = new Date().toISOString();
    conv = {
      id:             generateId(),
      participantIds: [req.user.id, targetUserId],
      lastMessageAt:  now,
      createdAt:      now,
    };
    db.conversations.push(conv);
    created = true;
    saveDb(db);
  }

  return res.status(created ? 201 : 200).json({
    ...conv,
    other: sanitizeUser(target),
    lastMessage: null,
    unreadCount: 0,
    created,
  });
});

// GET /api/conversations/me — conversas do usuário, com o "outro" participante
server.get('/api/conversations/me', requireAuth, (req, res) => {
  const db = getDb();
  const list = (db.conversations || [])
    .filter(c => (c.participantIds || []).includes(req.user.id))
    .map(c => {
      const otherId  = (c.participantIds || []).find(id => id !== req.user.id);
      const other    = db.users.find(u => u.id === otherId);
      const msgs     = (db.messages || []).filter(m => m.conversationId === c.id);
      const last     = msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
      const unread   = msgs.filter(m => m.receiverId === req.user.id && !m.read).length;
      return {
        ...c,
        other: other ? sanitizeUser(other) : null,
        lastMessage: last,
        unreadCount: unread,
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  return res.status(200).json(list);
});

// GET /api/conversations/:id/messages — histórico de uma conversa
server.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  const db   = getDb();
  const conv = (db.conversations || []).find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
  if (!(conv.participantIds || []).includes(req.user.id)) {
    return res.status(403).json({ error: 'Você não participa desta conversa.' });
  }

  const msgs = (db.messages || [])
    .filter(m => m.conversationId === req.params.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return res.status(200).json(msgs);
});

// POST /api/conversations/:id/messages — envia mensagem na conversa
server.post('/api/conversations/:id/messages', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'A mensagem não pode ser vazia.' });
  }

  const db   = getDb();
  const conv = (db.conversations || []).find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
  if (!(conv.participantIds || []).includes(req.user.id)) {
    return res.status(403).json({ error: 'Você não participa desta conversa.' });
  }

  const receiverId = (conv.participantIds || []).find(id => id !== req.user.id);
  const now = new Date().toISOString();
  const newMsg = {
    id:             generateId(),
    conversationId: conv.id,
    senderId:       req.user.id,
    receiverId,
    content:        content.trim(),
    createdAt:      now,
    read:           false,
  };

  db.messages = db.messages || [];
  db.messages.push(newMsg);

  // Atualiza lastMessageAt da conversa
  const ci = db.conversations.findIndex(c => c.id === conv.id);
  db.conversations[ci].lastMessageAt = now;

  // Notifica o destinatário
  const me = db.users.find(u => u.id === req.user.id);
  db.notifications = db.notifications || [];
  db.notifications.push({
    id:        generateId(),
    userId:    receiverId,
    type:      'new_message',
    refId:     conv.id,
    message:   `Você recebeu uma nova mensagem de ${me ? me.name : 'um usuário'}.`,
    read:      false,
    createdAt: now,
  });

  saveDb(db);
  return res.status(201).json(newMsg);
});

// ── NOTIFICATIONS (#11) ──────────────────────────────────────────────────────

// Enriquece a notificação resolvendo o "actor" (quem gerou) a partir do refId,
// na hora da leitura — assim o nome/avatar aparecem mesmo em notificações antigas.
function enrichNotification(db, n, meId) {
  const mini = (u) => u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null, type: u.type } : null;

  if (n.type === 'new_follower') {
    const actor = db.users.find(u => u.id === n.refId);
    const name  = actor ? actor.name : null;
    return {
      ...n,
      actor:   mini(actor),
      message: name ? `${name} começou a seguir você.` : n.message,
      link:    actor ? `/pages/perfil-publico.html?id=${actor.id}` : null,
    };
  }

  if (n.type === 'new_message') {
    const conv = (db.conversations || []).find(c => c.id === n.refId);
    let actor = null;
    if (conv) {
      const otherId = (conv.participantIds || []).find(id => id !== meId);
      actor = db.users.find(u => u.id === otherId) || null;
    }
    const name = actor ? actor.name : null;
    return {
      ...n,
      actor:          mini(actor),
      message:        name ? `${name} te enviou uma nova mensagem.` : n.message,
      link:           conv ? `/pages/mensagens.html?c=${conv.id}` : '/pages/mensagens.html',
      conversationId: conv ? conv.id : null,
    };
  }

  if (n.type === 'new_like' || n.type === 'new_comment') {
    const actor = db.users.find(u => u.id === n.actorId);
    const name  = actor ? actor.name : null;
    const frase = n.type === 'new_like' ? 'curtiu seu post.' : 'comentou no seu post.';
    return {
      ...n,
      actor:   mini(actor),
      message: name ? `${name} ${frase}` : n.message,
      link:    '/pages/feed.html',
    };
  }

  return { ...n, actor: null, link: null };
}

// GET /api/notifications/me — notificações do usuário (enriquecidas com actor)
server.get('/api/notifications/me', requireAuth, (req, res) => {
  const db = getDb();
  const list = (db.notifications || [])
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(n => enrichNotification(db, n, req.user.id));
  const unreadCount = list.filter(n => !n.read).length;
  return res.status(200).json({ unreadCount, notifications: list });
});

// POST /api/notifications/read — marca todas (ou uma) como lidas
server.post('/api/notifications/read', requireAuth, (req, res) => {
  const { id } = req.body;
  const db = getDb();
  db.notifications = (db.notifications || []).map(n => {
    if (n.userId !== req.user.id) return n;
    if (id && n.id !== id) return n;
    return { ...n, read: true };
  });
  saveDb(db);
  const unreadCount = db.notifications.filter(n => n.userId === req.user.id && !n.read).length;
  return res.status(200).json({ unreadCount });
});

// ══════════════════════════════════════════════════════════════════════════════
// ALGORITMO DE RECOMENDAÇÃO — GRAFO SOCIAL
// ------------------------------------------------------------------------------
// A rede é modelada como um GRAFO DIRIGIDO: usuários = nós; cada follow é uma
// aresta followerId → followingId. likes/comments são sinais de interação e
// skills/technologies/hashtags formam o "perfil de interesse" de cada nó.
// O grafo é montado em MEMÓRIA a cada request (dataset pequeno → custo trivial;
// numa rede real isso seria pré-computado/cacheado). Tudo em JS puro.
//
// Técnicas de grafo usadas:
//  • Listas de adjacência (seguindo/seguidores).
//  • Vizinhos em comum / "amigos-de-amigos" (caminho U→X→C, profundidade 2).
//  • Similaridade de Jaccard entre conjuntos de interesses/skills.
// ══════════════════════════════════════════════════════════════════════════════

// Pesos ajustáveis (documentados para o relatório acadêmico)
const FEED_W  = { follow: 5, fof: 1.2, content: 3, engagement: 1.5, recency: 4, own: 2 };
const SUG_W   = { mutual: 3, followsMe: 2.5, similarity: 4, popularity: 0.5 };
const TREND_W = { halfLifeH: 72, like: 0.5, comment: 0.7, interestBoost: 1.3, hashtag: 1.0, skill: 0.5, tech: 0.4 };

function normTopic(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function extractHashtags(text) {
  const out = [];
  const re = /#([\p{L}\d][\p{L}\d_-]*)/gu;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[1]);
  return out;
}

// Decaimento de recência: 1 agora → 0.5 após `halfLifeH` horas
function recencyScore(createdAt, nowMs, halfLifeH) {
  const ageH = (nowMs - new Date(createdAt).getTime()) / 3.6e6;
  return Math.pow(0.5, Math.max(0, ageH) / halfLifeH);
}

// Índices de adjacência do grafo de follows
function buildFollowGraph(db) {
  const following = new Map(); // userId → Set(quem ele segue)
  const followers = new Map(); // userId → Set(quem o segue)
  (db.follows || []).forEach(f => {
    if (!following.has(f.followerId)) following.set(f.followerId, new Set());
    following.get(f.followerId).add(f.followingId);
    if (!followers.has(f.followingId)) followers.set(f.followingId, new Set());
    followers.get(f.followingId).add(f.followerId);
  });
  return { following, followers };
}

// # de X tal que U→X e X→C (vizinhos em comum / amigos-de-amigos)
function commonNeighbors(graph, U, C) {
  const uFollows = graph.following.get(U) || new Set();
  const cFollowers = graph.followers.get(C) || new Set();
  let n = 0;
  uFollows.forEach(x => { if (cFollowers.has(x)) n++; });
  return n;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter++; });
  return inter / (a.size + b.size - inter);
}

// Perfil de interesse de um nó: skills ∪ technologies dos projetos ∪ hashtags dos posts
function interestProfile(db, userId) {
  const set = new Set();
  const u = (db.users || []).find(x => x.id === userId);
  if (u && Array.isArray(u.skills)) u.skills.forEach(s => set.add(normTopic(s)));
  // interesses declarados (etapa de "gostos" no completar perfil) → pré-personalização
  if (u && Array.isArray(u.interests)) u.interests.forEach(i => set.add(normTopic(i)));
  (db.projects || []).filter(p => p.userId === userId).forEach(p => {
    (p.technologies || p.stack || []).forEach(t => set.add(normTopic(t)));
  });
  (db.posts || []).filter(p => p.userId === userId).forEach(p => {
    extractHashtags(p.content).forEach(h => set.add(normTopic(h)));
  });
  return set;
}

// Tópicos de um post: hashtags do conteúdo ∪ skills do autor
function postTopics(post, author) {
  const set = new Set();
  extractHashtags(post.content).forEach(h => set.add(normTopic(h)));
  if (author && Array.isArray(author.skills)) author.skills.forEach(s => set.add(normTopic(s)));
  return set;
}

// GET /api/feed/me — feed personalizado (ranqueado pelo grafo + engajamento + recência)
server.get('/api/feed/me', requireAuth, (req, res) => {
  const db    = getDb();
  const me    = req.user.id;
  const now   = Date.now();
  const graph = buildFollowGraph(db);
  const myInterests = interestProfile(db, me);
  const myFollowing = graph.following.get(me) || new Set();

  const ranked = (db.posts || []).map(post => {
    const author   = db.users.find(u => u.id === post.userId);
    const likes    = (db.likes || []).filter(l => l.postId === post.id);
    const comments = (db.comments || []).filter(c => c.postId === post.id);
    const isOwn    = post.userId === me;
    const follows  = myFollowing.has(post.userId) ? 1 : 0;
    // só considera 2º grau se ainda não segue diretamente
    const fof      = follows ? 0 : commonNeighbors(graph, me, post.userId);
    const content  = jaccard(myInterests, postTopics(post, author));
    const engage   = Math.log(1 + 2 * likes.length + 3 * comments.length);
    const recency  = recencyScore(post.createdAt, now, 72);

    const score = FEED_W.follow * follows
                + FEED_W.fof * fof
                + FEED_W.content * content
                + FEED_W.engagement * engage
                + FEED_W.recency * recency
                + FEED_W.own * (isOwn ? 1 : 0);

    return {
      ...post,
      author:        author ? sanitizeUser(author) : null,
      likesCount:    likes.length,
      commentsCount: comments.length,
      likedByMe:     likes.some(l => l.userId === me),
      _score:        +score.toFixed(3),
    };
  }).sort((a, b) => b._score - a._score);

  return res.status(200).json(ranked);
});

// GET /api/suggestions/me — quem seguir (amigos-de-amigos + skills + segue-você)
server.get('/api/suggestions/me', requireAuth, (req, res) => {
  const db    = getDb();
  const me    = req.user.id;
  const limit = parseInt(req.query.limit, 10) || 5;
  const graph = buildFollowGraph(db);
  const myFollowing = graph.following.get(me) || new Set();
  const meUser = db.users.find(u => u.id === me);
  const mySkills = new Set((meUser && meUser.skills || []).map(normTopic));

  const scored = (db.users || [])
    .filter(u => u.id !== me && !u.disabledAt && !myFollowing.has(u.id))
    .map(c => {
      const mutual    = commonNeighbors(graph, me, c.id);
      const followsMe = (graph.following.get(c.id) || new Set()).has(me) ? 1 : 0;
      const cSkills   = new Set((c.skills || []).map(normTopic));
      const sim       = jaccard(mySkills, cSkills);
      const followers = (graph.followers.get(c.id) || new Set()).size;

      const score = SUG_W.mutual * mutual
                  + SUG_W.followsMe * followsMe
                  + SUG_W.similarity * sim
                  + SUG_W.popularity * Math.log(1 + followers);

      // motivo (fator dominante) — demonstra o algoritmo p/ o usuário
      const sharedSkills = [...mySkills].filter(s => cSkills.has(s)).length;
      let reason = 'Sugerido para você';
      if (mutual > 0) {
        const exId = [...myFollowing].find(x => (graph.followers.get(c.id) || new Set()).has(x));
        const exU  = exId ? db.users.find(u => u.id === exId) : null;
        reason = exU
          ? `Seguido por ${exU.name}${mutual > 1 ? ` + ${mutual - 1}` : ''}`
          : `${mutual} conexõ${mutual > 1 ? 'es' : 'a'} em comum`;
      } else if (followsMe) {
        reason = 'Segue você';
      } else if (sharedSkills > 0) {
        reason = `${sharedSkills} habilidade${sharedSkills > 1 ? 's' : ''} em comum`;
      }

      return { ...sanitizeUser(c), _score: +score.toFixed(3), reason, mutualCount: mutual, followsMe: !!followsMe, sharedSkills };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  return res.status(200).json(scored);
});

// GET /api/trending — tópicos em alta (hashtags/skills/techs ponderados)
server.get('/api/trending', requireAuth, (req, res) => {
  const db    = getDb();
  const me    = req.user.id;
  const now   = Date.now();
  const limit = parseInt(req.query.limit, 10) || 5;
  const myInterests = interestProfile(db, me);

  const topics = new Map(); // key → { label, weight, posts:Set }

  (db.posts || []).forEach(post => {
    const author   = db.users.find(u => u.id === post.userId);
    const likes    = (db.likes || []).filter(l => l.postId === post.id).length;
    const comments = (db.comments || []).filter(c => c.postId === post.id).length;
    const rec      = recencyScore(post.createdAt, now, TREND_W.halfLifeH);
    const eng      = 1 + TREND_W.like * likes + TREND_W.comment * comments;

    // tópicos únicos deste post (hashtag tem prioridade de label e maior peso)
    const postTags = new Map(); // key → { label, w }
    const addTag = (raw, label, w) => {
      const key = normTopic(raw);
      if (!key) return;
      const cur = postTags.get(key);
      const preferHash = label.startsWith('#');
      if (!cur) postTags.set(key, { label, w });
      else postTags.set(key, { label: (cur.label.startsWith('#') ? cur.label : (preferHash ? label : cur.label)), w: Math.max(cur.w, w) });
    };
    extractHashtags(post.content).forEach(h => addTag(h, '#' + h, TREND_W.hashtag));
    if (author && Array.isArray(author.skills)) author.skills.forEach(s => addTag(s, s, TREND_W.skill));
    (db.projects || []).filter(p => p.userId === post.userId).forEach(p =>
      (p.technologies || p.stack || []).forEach(t => addTag(t, t, TREND_W.tech)));

    postTags.forEach((v, key) => {
      const boost = myInterests.has(key) ? TREND_W.interestBoost : 1;
      const add   = rec * eng * v.w * boost;
      const e = topics.get(key) || { label: v.label, weight: 0, posts: new Set() };
      e.weight += add;
      e.posts.add(post.id);
      if (v.label.startsWith('#')) e.label = v.label; // prioriza hashtag no rótulo
      topics.set(key, e);
    });
  });

  const list = [...topics.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(e => ({ tag: e.label, postsCount: e.posts.size, weight: +e.weight.toFixed(3) }));

  return res.status(200).json(list);
});

// ══════════════════════════════════════════════════════════════════════════════
// BUSCA GLOBAL — pesquisa unificada do site (pessoas, empresas, vagas, posts, tópicos)
// ══════════════════════════════════════════════════════════════════════════════

// normaliza p/ busca: minúsculas + sem acentos
function searchNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function searchTokens(q) {
  return searchNorm(q).split(/\s+/).filter(Boolean);
}
// Casa se TODOS os tokens aparecem no texto combinado dos campos.
// Score = soma dos pesos dos campos que casam todos os tokens (nome casa > bio casa).
function relevance(fields, toks) {
  const combined = fields.map(f => searchNorm(f.text)).join('  ');
  const allInCombined = toks.length > 0 && toks.every(t => combined.includes(t));
  if (!allInCombined) return 0;
  let score = 0;
  fields.forEach(f => {
    const h = searchNorm(f.text);
    if (toks.every(t => h.includes(t))) score += f.w;
  });
  return score || 0.1; // casou via combinação de campos
}

// GET /api/search?q=...&limit=  — busca em tudo, categorizado
server.get('/api/search', requireAuth, (req, res) => {
  const db    = getDb();
  const q     = req.query.q || '';
  const toks  = searchTokens(q);
  const limit = parseInt(req.query.limit, 10) || 50;
  const empty = { query: q, people: [], companies: [], jobs: [], posts: [], topics: [] };
  if (!toks.length) return res.status(200).json(empty);

  // PESSOAS (dev)
  const people = (db.users || [])
    .filter(u => u.type === 'dev' && !u.disabledAt)
    .map(u => ({ u, score: relevance([
      { text: u.name, w: 5 },
      { text: u.title, w: 3 },
      { text: u.headline, w: 2 },
      { text: (u.skills || []).join(' '), w: 3 },
      { text: u.bio, w: 1 },
    ], toks) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => ({ ...sanitizeUser(x.u), _score: +x.score.toFixed(2) }));

  // EMPRESAS
  const companies = (db.companies || [])
    .map(c => ({ c, score: relevance([
      { text: c.name, w: 5 },
      { text: c.industry, w: 3 },
      { text: c.location, w: 2 },
      { text: c.about, w: 1 },
    ], toks) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => ({ ...x.c, _score: +x.score.toFixed(2) }));

  // VAGAS (ativas primeiro)
  const jobs = (db.jobs || [])
    .map(j => ({ j, score: relevance([
      { text: j.title, w: 5 },
      { text: j.companyName, w: 3 },
      { text: (j.skills || []).join(' '), w: 3 },
      { text: j.level, w: 1 },
      { text: j.modality, w: 1 },
      { text: j.location, w: 1 },
      { text: j.description, w: 1 },
    ], toks) }))
    .filter(x => x.score > 0)
    .sort((a, b) => (b.j.status === 'active') - (a.j.status === 'active') || b.score - a.score)
    .slice(0, limit)
    .map(x => ({ ...x.j, _score: +x.score.toFixed(2) }));

  // POSTS (texto + hashtags + skills do autor)
  const posts = (db.posts || [])
    .map(p => {
      const author = db.users.find(u => u.id === p.userId);
      const hashtags = extractHashtags(p.content).join(' ');
      const authorSkills = (author && author.skills || []).join(' ');
      const score = relevance([
        { text: hashtags, w: 4 },
        { text: author ? author.name : '', w: 3 },
        { text: authorSkills, w: 2 },
        { text: p.content, w: 2 },
      ], toks);
      return { p, author, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => ({
      ...x.p,
      author:        x.author ? sanitizeUser(x.author) : null,
      likesCount:    (db.likes || []).filter(l => l.postId === x.p.id).length,
      commentsCount: (db.comments || []).filter(c => c.postId === x.p.id).length,
      likedByMe:     (db.likes || []).some(l => l.postId === x.p.id && l.userId === req.user.id),
      _score:        +x.score.toFixed(2),
    }));

  // TÓPICOS (hashtags/skills/techs que casam a busca) — p/ o modal rápido
  const topicCount = new Map();
  (db.posts || []).forEach(p => {
    const author = db.users.find(u => u.id === p.userId);
    const tags = new Set();
    extractHashtags(p.content).forEach(h => tags.add('#' + h));
    if (author && Array.isArray(author.skills)) author.skills.forEach(s => tags.add(s));
    tags.forEach(label => {
      const h = searchNorm(label);
      if (toks.every(t => h.includes(t))) {
        const e = topicCount.get(searchNorm(label)) || { tag: label, postsCount: 0 };
        e.postsCount++;
        topicCount.set(searchNorm(label), e);
      }
    });
  });
  const topics = [...topicCount.values()].sort((a, b) => b.postsCount - a.postsCount).slice(0, limit);

  return res.status(200).json({ query: q, people, companies, jobs, posts, topics });
});

// Iniciais a partir do nome (para o logo da empresa)
function companyInitials(name) {
  if (!name) return 'EM';
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

// GET /api/companies/me — empresa do usuário-empresa logado (ou null)
// (registrada ANTES de /:id para não ser capturada pela rota com parâmetro)
server.get('/api/companies/me', requireAuth, (req, res) => {
  const db = getDb();
  const company = (db.companies || []).find(c => c.userId === req.user.id) || null;
  return res.status(200).json({ company });
});

// PUT /api/companies/me — cria ou atualiza o perfil da empresa do usuário logado
server.put('/api/companies/me', requireAuth, (req, res) => {
  if (req.user.type !== 'company') {
    return res.status(403).json({ error: 'Apenas contas de empresa podem editar o perfil de empresa.' });
  }
  const db = getDb();
  db.companies = db.companies || [];

  const ALLOWED = ['name', 'logoInitials', 'industry', 'location', 'about', 'website', 'size', 'founded', 'tagline', 'interests'];
  const updates = {};
  for (const k of ALLOWED) { if (k in req.body) updates[k] = req.body[k]; }

  const me = db.users.find(u => u.id === req.user.id);
  let company = db.companies.find(c => c.userId === req.user.id);

  if (company) {
    Object.assign(company, updates, { updatedAt: new Date().toISOString() });
  } else {
    const name = updates.name || (me ? me.name : 'Empresa');
    company = Object.assign({
      id:           generateId(),
      userId:       req.user.id,
      name,
      logoInitials: updates.logoInitials || companyInitials(name),
      createdAt:    new Date().toISOString(),
    }, updates);
    if (!company.logoInitials) company.logoInitials = companyInitials(company.name);
    db.companies.push(company);
  }
  saveDb(db);
  return res.status(200).json({ company });
});

// GET /api/companies/:id — perfil público de empresa + vagas + estatísticas
server.get('/api/companies/:id', requireAuth, (req, res) => {
  const db = getDb();
  const company = (db.companies || []).find(c => c.id === req.params.id);
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada.' });

  const jobs = (db.jobs || [])
    .filter(j => j.companyId === company.id)
    .sort((a, b) => (b.status === 'active') - (a.status === 'active') || new Date(b.createdAt) - new Date(a.createdAt));

  const activeJobs = jobs.filter(j => j.status === 'active').length;
  // seguidores reais (follows no usuário-empresa) com fallback ao número de seed
  const realFollowers = company.userId
    ? (db.follows || []).filter(f => f.followingId === company.userId).length
    : 0;
  const stats = {
    jobs:         activeJobs,
    followers:    (company.followers || 0) + realFollowers,
    rating:       company.rating != null ? company.rating : null,
    reviewsCount: company.reviewsCount || 0,
    founded:      company.founded || null,
    size:         company.size || null,
    employees:    company.employees != null ? company.employees : null,
    projects:     company.projects != null ? company.projects : null,
    countries:    company.countries != null ? company.countries : null,
  };

  return res.status(200).json({ company, jobs, stats });
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
