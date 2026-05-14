// server.js — Orbit Backend (JSON Server + JWT)
// Roda em: http://localhost:3001
//
// Rotas públicas:
//   POST /api/auth/register  → cadastro de novo usuário
//   POST /api/auth/login     → login, retorna JWT
//
// Rotas protegidas (exige Bearer token):
//   GET  /api/users          → lista usuários
//   GET  /api/users/:id      → busca usuário por id
//   PATCH /api/users/:id     → atualiza usuário

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
server.use(jsonServer.bodyParser);

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

// ── Rewriter e roteador do JSON Server ───────────────────────────────────────
server.use(jsonServer.rewriter({ '/api/*': '/$1' }));
server.use(router);

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Orbit API rodando em http://localhost:${PORT}`);
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   GET  http://localhost:${PORT}/api/users  (protegido)\n`);
});
