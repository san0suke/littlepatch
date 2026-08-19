// End-to-end smoke test for the socket layer. Precisa do servidor rodando.
import { io } from 'socket.io-client';

// Aponte para um endereço da LAN/Tailscale para conferir que o jogo abre mesmo
// de outro aparelho: SMOKE_API=http://192.168.0.190:3000 npm run smoke -w @patch/server
const API = process.env.SMOKE_API || 'http://localhost:3000';
// Navegador sempre manda Origin; imitar aqui exercita o caminho do CORS também.
const ORIGIN = process.env.SMOKE_ORIGIN || API.replace(/:\d+$/, ':5173');

async function auth(username, email, password) {
  let res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ username, password }),
    });
  }
  const data = await res.json();
  return { token: data.token, coins: data.user.coins };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(API, { auth: { token }, extraHeaders: { Origin: ORIGIN } });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

const results = [];
const check = (name, pass, extra = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

const emit = (socket, event, ...args) =>
  new Promise((resolve) => socket.emit(event, ...args, resolve));

const nextEvent = (socket, event, timeoutMs = 4000) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

// 1. O handshake tem que recusar token inválido e token ausente.
try {
  await connect('garbage-token');
  check('rejects invalid JWT', false, 'connection was accepted');
} catch (err) {
  check('rejects invalid JWT', true, err.message);
}
try {
  await connect('');
  check('rejects missing JWT', false, 'connection was accepted');
} catch (err) {
  check('rejects missing JWT', true, err.message);
}

// 2. Dois jogadores autenticados.
const { token: tokenA } = await auth('alice', 'alice@example.com', 'secret123');
const { token: tokenB } = await auth('bob', 'bob@example.com', 'secret123');
const alice = await connect(tokenA);
const bob = await connect(tokenB);
check('accepts valid JWT (2 clients)', alice.connected && bob.connected);

// 3. Bicho: ou já existe (segunda rodada do script) ou é chocado agora.
let petA = await emit(alice, 'pet:get');
if (!petA) {
  petA = await emit(alice, 'pet:create', { name: 'Fofo', species: 'sprout' });
  check('creates a pet', petA !== null);
} else {
  check('returns the existing pet', petA.name.length > 0, petA.name);
}
let petB = (await emit(bob, 'pet:get')) ?? (await emit(bob, 'pet:create', { name: 'Brasa', species: 'ember' }));

check('pet state carries no absolute dates', !JSON.stringify(petA).includes('bornAt'));
check('age travels as a duration', typeof petA.ageMs === 'number');

// 4. Nome inválido é recusado, e um segundo bicho também.
const badName = await emit(alice, 'pet:create', { name: 'x', species: 'sprout' });
check('refuses a one-letter name', badName === null);
const secondPet = await emit(alice, 'pet:create', { name: 'Outro', species: 'pebble' });
check('one pet per account', secondPet === null);

// As recusas viajam num `server:error` avulso, sem dizer a qual pedido
// pertencem — o cliente só as mostra num aviso. Aqui isso importa: sem esta
// pausa, a recusa do bloco acima seria colhida pela checagem seguinte, que
// ficaria passando (ou falhando) pelo motivo errado.
await new Promise((resolve) => setTimeout(resolve, 300));

// 5. Cuidar do bicho. Ovo não come: se ainda não chocou, o servidor recusa.
const hatched = petA.stage !== 'egg';
if (hatched) {
  const before = petA.stats.hygiene;
  const applied = nextEvent(alice, 'pet:care-applied');
  const stated = nextEvent(alice, 'pet:state');
  alice.emit('pet:care', { action: 'clean' });
  const [careEvent, newState] = await Promise.all([applied, stated]);

  check('care is applied', careEvent !== null, careEvent?.action);
  check('hygiene went up', newState !== null && newState.stats.hygiene >= before);
  check('bath pays a coin or two', careEvent?.coinsEarned > 0);
  check('cooldown comes back with the state', (newState?.cooldownsMs?.clean ?? 0) > 0);

  // Repetir na hora tem que ser recusado — a espera é do servidor, não da tela.
  const refused = nextEvent(alice, 'server:error');
  alice.emit('pet:care', { action: 'clean' });
  const error = await refused;
  check('repeating inside the cooldown is refused', error?.code === 'cooldown', error?.message);
} else {
  const refused = nextEvent(alice, 'server:error');
  alice.emit('pet:care', { action: 'feed' });
  const error = await refused;
  check('an egg cannot be fed', error?.code === 'pet-not-hatched', error?.message);
}

// 6. Ação inventada não passa.
const bogus = nextEvent(alice, 'server:error');
alice.emit('pet:care', { action: 'teleport' });
check('unknown action is refused', (await bogus)?.code === 'invalid-action');

// 7. Jardim: alice enxerga o bicho de bob, e não o próprio.
const garden = await emit(alice, 'garden:list');
check('garden lists other players', garden.some((p) => p.petId === petB.id));
check('garden hides your own pet', !garden.some((p) => p.petId === petA.id));
check('garden knows who is online', garden.find((p) => p.petId === petB.id)?.online === true);

// 8. Mimo: alegria para o bicho de bob, moeda para alice.
//
// A espera do mimo é de 10 minutos e sobrevive ao restart do servidor (fica no
// banco), então numa segunda rodada seguida deste script ela ainda está de pé.
// As duas pontas são checadas: quando dá para mimar, o dono é avisado e quem
// visita recebe; quando não dá, o servidor recusa.
const alreadyCheered = (garden.find((p) => p.petId === petB.id)?.cheerCooldownMs ?? 0) > 0;
if (alreadyCheered) {
  const refused = nextEvent(alice, 'server:error');
  alice.emit('garden:cheer', { petId: petB.id });
  const error = await refused;
  check('cheering again inside the cooldown is refused', error?.code === 'cooldown', error?.message);
} else {
  const bobNotified = nextEvent(bob, 'garden:cheer-received');
  const aliceCoins = nextEvent(alice, 'user:coins');
  alice.emit('garden:cheer', { petId: petB.id });
  const [cheer, coins] = await Promise.all([bobNotified, aliceCoins]);
  check('the owner is notified of the cheer', cheer?.fromUsername === 'alice');
  check('cheering pays the visitor', typeof coins?.coins === 'number');
}

await new Promise((resolve) => setTimeout(resolve, 300));

const selfCheer = nextEvent(alice, 'server:error');
alice.emit('garden:cheer', { petId: petA.id });
check('cannot cheer your own pet', (await selfCheer)?.code === 'own-pet');

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);

alice.disconnect();
bob.disconnect();
process.exit(failed === 0 ? 0 : 1);
