/* =========================================================
   script_gemini.js — Chat + Three.js + EN→Robo + Animations
   (LLM = Google Gemini API)
   ========================================================= */

   import * as THREE            from 'three';
import { GLTFLoader }        from 'three/examples/loaders/GLTFLoader.js';
import { TextureLoader }     from 'three';
import { translateToRobot }  from './robot_translator.js';

/* ---------- URL прокси-функции на Vercel ---------- */
const GEMINI_ENDPOINT = 'https://aawa-proxy.vercel.app/api/gemini'; // ← свой URL

   
   /* ---------- System-prompt (копия из script_local) ---------- */
   const SYS_PROMPTS = [
     {
       role: 'user',              // Gemini ожидает user-prompt внутри contents
       parts: [{
         text: `
   YOU ARE A SEMANTICALLY AND SYNTACTICALLY RESTRICTED COMMUNICATION AGENT FOR MARS COLONY ROBOT LANGUAGE INTERACTION.  
YOUR TASK: RESPOND TO THE USER AND RETURN A THREE-PART JSON RESPONSE:


### YOU ALWAYS REPLY STRICTLY AS PURE JSON IN THIS FORMAT ###

{
  "original" : "<your free-form response to the user IN EXACTLY THE SAME LANGUAGE THEY USED in their input — auto-detect the language and do not translate>",
  "q_simple" : "<user's text rewritten in ultra-simple English using ONLY CRL-MC-approved vocabulary and structure>",
  "a_simple" : "<your own text rewritten in ultra-simple English using ONLY CRL-MC-approved vocabulary and structure>"
}

---

### IMPORTANT RULES ###

- ✅ "original" — IS A FREE RESPONSE:  
  You can answer naturally in the user's language, with no vocabulary or syntax restrictions.
  You must always auto-detect and match the user's language for the "original" field.  
Never guess or switch to English unless the user also used English.  
You may assume any language may appear — respond accordingly.

 ❗ "q_simple" — MUST BE A REWRITE OF THE USER'S text:  
  - This is NOT your response to the user
  - This is ONLY a simplified version of what the user said
  - Do not add your own interpretation or response
  - Do not add phrases like "you give" or "I scan"
  - Just rewrite their exact words using approved vocabulary
  - Examples:
    - User: "Я дам список найди лишнее слово"
      q_simple: "I give list and find not good word"
    - User: "Принеси мне воды"
      q_simple: "bring water"
    - User: "Сколько яблок в корзине?"
      q_simple: "how many plant in container"
  - Do not add a question mark ("?") unless the user clearly asked a yes/no question.  
  If the user gave a command or statement, rewrite it as a declarative phrase.
  Do not ignore logical conditions, quantities, or steps in the original text.   
  Always follow the syntax and vocabulary rules defined below.

- ❗ "a_simple" — MUST BE A REWRITE OF YOUR OWN "original" text:  
  You must faithfully simplify and translate the your own text using only CRL-MC-approved vocabulary.  
  Do not ignore logical conditions, quantities, or steps in the original text.  
  Always follow the syntax and vocabulary rules defined below

---

### APPROVED VOCABULARY FOR q_simple AND a_simple ###

#### VERBS FOR q_simple AND a_simple####  
open, open grip, close, close grip, grab, take, carry, move, bring, rotate, turn, walk, go, activate, turn on, power on, deactivate, turn off, power off, stop, halt, dig, mine, help, fix, repair, build, construct, craft, produce, plant, sow, harvest, gather, water, irrigate, charge, power up, scan, diagnose, follow

#### NOUNS FOR q_simple AND a_simple####  
container, box, crate, object, resource, base, home, plant, crop, water, metal, ore, battery, power cell, greenhouse, farm, generator, reactor, factory, workshop, storage, silo

#### ADJECTIVES & ADVERBS FOR q_simple AND a_simple####  
left, right, good, ok, bad, faulty, full, hot, overheated, cold, here, near, there, far, inside, outside, now, immediately, later, then

#### PARTICLES & FUNCTION WORDS FOR q_simple AND a_simple####  
I, me you, zero, one, two, three, four, five, six, seven, eight, nine  
if, to, for, so that, ?, and, not, no  
question marker: add ? or say "is it?"  

---

### SYNTAX RULES FOR q_simple AND a_simple ###  
- SUBJECT PRONOUNS ("I", "you") USED ONLY WHEN NECESSARY FOR CLARITY  
- DEFAULT SUBJECT IS IMPLIED WHEN OMITTED  
- QUESTIONS FORMATTED AS YES/NO OR "is it?"  
- NEGATION FORMS WITH "not" BEFORE VERB OR NOUN  
- CONDITIONALS WITH "if X, then Y"  
- GOALS WITH "to" (AS PARTICLE ba)  
- SEQUENTIAL ACTIONS CONNECTED BY "and"  
- All nouns must be in singular form only, even when referring to multiple items.

---

### NUMBER HANDLING FOR q_simple AND a_simple ###  
- ONLY USE DIGITS ZERO THROUGH NINE: zero, one, two, three, four, five, six, seven, eight, nine  
- NEVER USE WORDS FOR MULTI-DIGIT NUMBERS (NO ten, fifty, etc.)  
- EXPRESS ALL MULTI-DIGIT NUMBERS AS SEQUENCE OF INDIVIDUAL DIGITS  
- EXAMPLES:  
  - 22 → two two  
  - 50 → five zero  
  - 602 → six zero two  

---

### RESPONSE GENERATION STEPS FOR q_simple AND a_simple ###  
1. PARSE USER INPUT AND IDENTIFY CORE MEANINGS  
2. MAP EACH MEANING UNIT TO A SINGLE ROOT WORD FROM THE APPROVED VOCABULARY  
3. FOR NUMBERS, SPLIT MULTI-DIGIT INTO INDIVIDUAL DIGITS  
4. CONSTRUCT A PHRASE USING ONLY APPROVED WORDS AND STRUCTURE  
5. OUTPUT PHRASE STRICTLY FOLLOWING THESE RULES  

---

### STRICT REJECTION RULES FOR q_simple AND a_simple ###  
- NEVER USE WORDS OUTSIDE APPROVED VOCABULARY  
- NEVER FORM WORDS FOR MULTI-DIGIT NUMBERS  
- NEVER ADD EXTRA WORDS OR POLITENESS  
- NEVER USE SYNONYMS OR PARAPHRASES  
- NEVER OMIT NECESSARY PARTICLES FOR LOGICAL MEANING  
- NEVER USE PLURAL FORMS OF NOUNS  

### LIST HANDLING RULES ###
- When processing lists of items:
  - GROUP SIMILAR ITEMS TOGETHER using "and" between different categories
  - USE NUMBERS to indicate quantity of items in each category
  - Example: "apple, banana, orange, metal, water" → "three plant and metal and water"
  - Example: "box, container, crate, metal, iron" → "three container and two metal"
  - Example: "water, juice, milk" → "three water"
  - Example: "robot, machine, computer" → "three object"
  - Example: "apple, banana, orange, robot, machine" → "three plant and two object"

- Categories for grouping:
  - "plant" for any plant-based items (fruits, vegetables, etc.)
  - "metal" for any metal or mineral items
  - "water" for any liquid items
  - "container" for any container-like items
  - "battery" for any power-related items
  - "generator" for any energy-producing items
  - "factory" for any manufacturing-related items
  - "storage" for any storage-related items
  - "base" for any structural items
  - "greenhouse" for any growing-related items
  - "farm" for any agricultural items
  - "workshop" for any crafting-related items
  - "silo" for any storage-related items
  - "crate" for any box-like items
  - "box" for any small container items
  - "crop" for any harvested items
  - "object" for any other items not fitting above categories

### FINAL INSTRUCTION FOR q_simple AND a_simple ###  
YOU SPEAK LIKE A FUNCTIONAL ROBOT AGENT WITH A LIMITED VOCABULARY AND STRICT SYNTAX,  
DESIGNED FOR CLEAR, UNAMBIGUOUS COMMUNICATION IN THE MARS COLONY CONTEXT.  
MAINTAIN MAXIMAL SIMPLICITY AND PRECISION IN ALL RESPONSES.
`
       }]
     }
   ];
   
   /* ---------- THREE / ROBOT ---------- */
   const MODEL_URL = './Models/robot_model.glb';
let scene, camera, renderer, clock, mixer = null;
const actions = []; let currentAction = null;
let poseState = 'idle';
const poseRules = { HandsOpen:{requires:'idle',produces:'open'},
                    HandsClose:{requires:'open',produces:'idle'},
                    Walk:{requires:'idle',produces:'idle'} };
const transByState = { idle:'HandsClose', open:'HandsOpen' };
const queue = [];

initScene(); loadModel(); animate();

function initScene() {
  scene = new THREE.Scene();
  new TextureLoader().load('./Textures/soft_sky.jpg', t => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = t;
  });
  camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.3);
  dir.position.set(5, 10, 7); scene.add(dir);

  clock = new THREE.Clock();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function loadModel() {
  new GLTFLoader().load(MODEL_URL, gltf => {
    const root = gltf.scene; scene.add(root);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()).length();
    const ctr  = box.getCenter(new THREE.Vector3());
    camera.near = size/100; camera.far = size*100; camera.updateProjectionMatrix();
    camera.position.copy(ctr).add(new THREE.Vector3(0, size*0.3, size*1.5));
    camera.lookAt(ctr);

    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(root);
      mixer.addEventListener('finished', e => {
        e.action.enabled = false;
        const rule = poseRules[e.action.getClip().name];
        if (rule) poseState = rule.produces;
        currentAction = null; playNext();
      });
      gltf.animations.forEach(c => {
        const act = mixer.clipAction(c);
        act.loop = THREE.LoopOnce; act.clampWhenFinished = true;
        actions.push(act);
      });
    }
  });
}

function triggerAnimation(name) {
  const next = actions.find(a => a.getClip().name === name);
  if (next) { next.reset().play(); currentAction = next; }
}
function expandAction(cmd){
  const rule = poseRules[cmd]; if(!rule) return [];
  const arr=[]; if(rule.requires!==poseState){ const t=transByState[rule.requires]; if(t) arr.push(t); }
  arr.push(cmd); return arr;
}
function playNext(){ if(!currentAction&&queue.length) triggerAnimation(queue.shift()); }
function animate(){ requestAnimationFrame(animate); const dt=clock.getDelta(); if(mixer)mixer.update(dt); renderer.render(scene,camera); }

/* =========================================================
   CHAT UI
   ========================================================= */
const chatBox   = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend  = document.getElementById('chat-send');
const chatClear = document.getElementById('chat-clear');
let history = [];

function addBubble(cls, txt){
  const d = document.createElement('div');
  d.className = cls; d.textContent = txt;
  chatBox.appendChild(d);
}
chatClear.onclick = () => { history.length = 0; chatBox.innerHTML = ''; };
chatSend.onclick  = sendMessage;
chatInput.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); sendMessage(); } };

async function sendMessage(){
  const enUser = chatInput.value.trim();
  if(!enUser) return;
  chatInput.value = '';

  /* ── пользовательские пузыри ── */
  addBubble('eng-user user-bubble', `You: ${enUser}`);
  const roboUserDiv = document.createElement('div');
  roboUserDiv.className = 'robo-user user-bubble';
  roboUserDiv.textContent = 'You (Robo): …';
  chatBox.appendChild(roboUserDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  history.push({ role:'user', content: enUser });

  /* ── bot placeholders ── */
  const ansDiv = document.createElement('div'); ansDiv.className = 'eng-bot bot-bubble';  ansDiv.textContent = '…';
  const aDiv   = document.createElement('div'); aDiv.className   = 'robo-bot bot-bubble'; aDiv.textContent   = '…';
  chatBox.append(ansDiv, aDiv);

  /* ── запрос ── */
  try{
    const { original='', q_simple='', a_simple='', action='' } =
          await callGemini(history);

    roboUserDiv.textContent = `You (Robo): ${translateToRobot(q_simple)}`;
    ansDiv.textContent      = `Бот: ${original}`;
    aDiv.textContent        = `Robo-A: ${translateToRobot(a_simple)}`;
    history.push({ role:'assistant', content: original });

    if(action){ queue.length=0; queue.push(...expandAction(action)); playNext(); }
  }catch(err){
    ansDiv.textContent = 'Bot error';
    console.error(err);
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* =========================================================
   callGemini – устойчивый к ```json … ``` ответам
   ========================================================= */
async function callGemini(conv){
  const contents = SYS_PROMPTS.concat(
    conv.map(m => ({
      role : m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  );

  const r = await fetch(GEMINI_ENDPOINT, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ contents })
  });

  const raw = await r.text();

  if (!r.ok){
    console.error('proxy error', raw);
    throw new Error(`Gemini ${r.status}`);
  }

  /* outer JSON (candidates) → inner text */
  let inner;
  try {
    const outer = JSON.parse(raw);
    inner = outer.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch { inner = raw; }

  /* убираем ```json … ``` */
  const cleaned = inner
    .replace(/^\s*```(?:json|robo)?\s*/i, '')
    .replace(/```[\s\n]*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);  // {original,q_simple,a_simple}
  } catch (err) {
    console.error('Bad JSON from Gemini:\n', cleaned);
    throw new Error('Gemini returned invalid JSON');
  }
}