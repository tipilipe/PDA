<?php
// Minimal PHP API for auth compatible with current frontend
// Requirements: PHP 8+, extensions: pdo_pgsql or pgsql
// Configure via environment variables in cPanel:
// - DATABASE_URL: postgresql://user:pass@host/db?sslmode=require
// - JWT_SECRET: strong secret

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Optional config.php override
$DATABASE_URL = getenv('DATABASE_URL') ?: '';
$JWT_SECRET = getenv('JWT_SECRET') ?: '';
if (file_exists(__DIR__ . '/config.php')) {
  $cfg = include __DIR__ . '/config.php';
  if (is_array($cfg)) {
    if (!$DATABASE_URL && !empty($cfg['DATABASE_URL'])) $DATABASE_URL = $cfg['DATABASE_URL'];
    if (!$JWT_SECRET && !empty($cfg['JWT_SECRET'])) $JWT_SECRET = $cfg['JWT_SECRET'];
  }
}
if (!$JWT_SECRET) { $JWT_SECRET = 'change-me'; }

function parse_database_url($url) {
  // postgres://user:pass@host/db?sslmode=require
  $parts = parse_url($url);
  $query = [];
  if (!empty($parts['query'])) parse_str($parts['query'], $query);
  $sslmode = $query['sslmode'] ?? 'require';
  $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s;sslmode=%s', $parts['host'], $parts['port'] ?? 5432, ltrim($parts['path'],'/'), $sslmode);
  $user = $parts['user'] ?? '';
  $pass = $parts['pass'] ?? '';
  return [$dsn, $user, $pass];
}

function json_body() {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function send($code, $data) { http_response_code($code); echo json_encode($data); exit; }

// Simple JWT (HS256)
function b64url($data) { return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }
function jwt_sign($payload, $secret) {
  $header = ['alg'=>'HS256','typ'=>'JWT'];
  $h = b64url(json_encode($header));
  $p = b64url(json_encode($payload));
  $sig = hash_hmac('sha256', $h.'.'.$p, $secret, true);
  return $h.'.'.$p.'.'.b64url($sig);
}

function hash_password($password) { return password_hash($password, PASSWORD_BCRYPT); }
function verify_password($password, $hash) { return password_verify($password, $hash); }

try {
  if (!$DATABASE_URL) send(500, ['error'=>'DATABASE_URL não configurada']);
  [$dsn, $user, $pass] = parse_database_url($DATABASE_URL);
  $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) { send(500, ['error'=>'Falha ao conectar ao banco', 'detail'=>$e->getMessage()]); }

// Ensure schema
try {
  $pdo->exec("CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, name TEXT, subtitle TEXT, cnpj TEXT, address TEXT, logo_url TEXT, bank_details_1 TEXT, bank_details_2 TEXT, bank_details_3 TEXT, active BOOLEAN DEFAULT TRUE);");
  $pdo->exec("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, role TEXT DEFAULT 'user');");
} catch (Throwable $e) { send(500, ['error'=>'Erro ao inicializar schema', 'detail'=>$e->getMessage()]); }

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normalize base path (assuming /api/)
// Example: /api/auth/login

if (preg_match('#/api/auth/register$#', $uri) && $method === 'POST') {
  $b = json_body();
  $companyName = trim($b['companyName'] ?? '');
  $userName = trim($b['userName'] ?? '');
  $email = trim($b['email'] ?? '');
  $password = $b['password'] ?? '';
  if (!$companyName || !$email || !$password) send(400, ['error'=>'Nome da empresa, email e senha são obrigatórios.']);
  try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO companies (name) VALUES (?) RETURNING id');
    $stmt->execute([$companyName]);
    $companyId = $stmt->fetch(PDO::FETCH_ASSOC)['id'];
    $hash = hash_password($password);
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password_hash, company_id, role) VALUES (?, ?, ?, ?, ?) RETURNING id, name, email, role');
    $stmt->execute([$userName, $email, $hash, $companyId, 'admin']);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    $pdo->commit();
    send(201, ['message'=>'Empresa e usuário criados com sucesso!','user'=>$user]);
  } catch (Throwable $e) {
    $pdo->rollBack();
    send(500, ['error'=>'Erro ao registrar usuário. O email já pode estar em uso.', 'detail'=>$e->getMessage()]);
  }
}

if (preg_match('#/api/auth/login$#', $uri) && $method === 'POST') {
  $b = json_body();
  $email = trim($b['email'] ?? '');
  $password = $b['password'] ?? '';
  try {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) send(400, ['error'=>'Email ou senha inválidos.']);
    if (!verify_password($password, $user['password_hash'])) send(400, ['error'=>'Email ou senha inválidos.']);
    $payload = [ 'userId'=>$user['id'], 'companyId'=>$user['company_id'], 'role'=>$user['role'], 'exp'=> time()+8*3600 ];
    $token = jwt_sign($payload, $JWT_SECRET);
    send(200, ['message'=>'Login bem-sucedido!','token'=>$token,'user'=>['id'=>$user['id'],'name'=>$user['name'],'email'=>$user['email']]]);
  } catch (Throwable $e) { send(500, ['error'=>'Erro interno do servidor', 'detail'=>$e->getMessage()]); }
}

send(404, ['error'=>'Not Found']);
