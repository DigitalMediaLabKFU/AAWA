/* =========================================================
   script_gemini.js — Chat + Three.js + EN→Robo + Animations
   (LLM = Google Gemini API)
   ========================================================= */

   import * as THREE            from 'three';
   import { GLTFLoader }        from 'three/examples/loaders/GLTFLoader.js';
   import { TextureLoader }     from 'three';
   import { translateToRobot }  from './robot_translator.js';
   
   /* ---------- Gemini SETTINGS ---------- */
   const keyBar = document.createElement('div');
   keyBar.style.cssText = `
     position:fixed; top:4px; left:4px; z-index:9999;
     backdrop-filter:blur(4px); background:rgba(0,0,0,.5);
     padding:4px 8px; border-radius:6px; font:14px/18px sans-serif; color:#fff`;
   keyBar.innerHTML = `
     <input id="gkey" type="password" placeholder="Gemini API key"
            style="width:220px; padding:3px 6px; border:1px solid #555;
                   border-radius:4px; background:#222; color:#9f9">
     <button id="gkSave"
            style="margin-left:6px; padding:3px 8px; cursor:pointer;">Save</button>`;
   document.body.appendChild(keyBar);
   
   const keyInput = /** @type {HTMLInputElement} */(document.getElementById('gkey'));
   const gkSave   = document.getElementById('gkSave');
   keyInput.value = localStorage.getItem('gemini_api_key') || '';
   
   function saveKey () {
     /* убираем все служебные символы, а не только по краям */
     const clean = keyInput.value.replace(/\s+/g, '');
     localStorage.setItem('gemini_api_key', clean);
     gkSave.textContent = '✓';
     setTimeout(() => gkSave.textContent = 'Save', 1200);
   }
   gkSave.onclick     = saveKey;
   keyInput.onkeydown = e => { if (e.key === 'Enter') saveKey(); };
   
   const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
   const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';   // flash или pro
   
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
  "original" : "<your free-form response to the user IN USER'S LANGUAGE (not limited by CRL-MC)>",
  "q_simple" : "<user's text rewritten in ultra-simple English using ONLY CRL-MC-approved vocabulary and structure>",
  "a_simple" : "<your own text rewritten in ultra-simple English using ONLY CRL-MC-approved vocabulary and structure>"
}

---

### IMPORTANT RULES ###

- ✅ "original" — IS A FREE RESPONSE:  
  You can answer naturally in the user's language, with no vocabulary or syntax restrictions.

 ❗ "q_simple" — MUST BE A REWRITE OF THE USER'S text:  
  You must faithfully simplify and translate the user's text using only CRL-MC-approved vocabulary.  
  Do not ignore logical conditions, quantities, or steps in the original question.   
  Always follow the syntax and vocabulary rules defined below.

- ❗ "a_simple" — MUST BE A REWRITE OF YOUR OWN "original" text:  
  You must faithfully simplify and translate the your own text using only CRL-MC-approved vocabulary.  
  Do not ignore logical conditions, quantities, or steps in the original question.  
  Always follow the syntax and vocabulary rules defined below

---

### APPROVED VOCABULARY FOR q_simple AND a_simple ###

#### VERBS ####  
open, open grip, close, close grip, grab, take, carry, move, bring, rotate, turn, walk, go, activate, turn on, power on, deactivate, turn off, power off, stop, halt, dig, mine, help, fix, repair, build, construct, craft, produce, plant, sow, harvest, gather, water, irrigate, charge, power up, scan, diagnose, follow

#### NOUNS ####  
container, box, crate, object, resource, base, home, plant, crop, water, metal, ore, battery, power cell, greenhouse, farm, generator, reactor, factory, workshop, storage, silo

#### ADJECTIVES & ADVERBS ####  
left, right, good, ok, bad, faulty, full, hot, overheated, cold, here, near, there, far, inside, outside, now, immediately, later, then

#### PARTICLES & FUNCTION WORDS ####  
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
6. OUTPUT PHRASE STRICTLY FOLLOWING THESE RULES  

---

### STRICT REJECTION RULES FOR q_simple AND a_simple ###  
- NEVER USE WORDS OUTSIDE APPROVED VOCABULARY  
- NEVER FORM WORDS FOR MULTI-DIGIT NUMBERS  
- NEVER ADD EXTRA WORDS OR POLITENESS  
- NEVER USE SYNONYMS OR PARAPHRASES  
- NEVER OMIT NECESSARY PARTICLES FOR LOGICAL MEANING  

---

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
let scene,camera,renderer,clock,mixer=null;
const actions=[]; let currentAction=null;
let poseState='idle';
const poseRules = {HandsOpen:{requires:'idle',produces:'open'},
                   HandsClose:{requires:'open',produces:'idle'},
                   Walk:{requires:'idle',produces:'idle'}};
const transByState={idle:'HandsClose',open:'HandsOpen'};
const queue=[];

initScene(); loadModel(); animate();

function initScene(){
  scene=new THREE.Scene();
  new TextureLoader().load('./Textures/soft_sky.jpg',t=>{
    t.mapping=THREE.EquirectangularReflectionMapping;
    scene.background=t;
  });
  camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,100);
  camera.position.set(0,1.6,4);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff,0.6));
  scene.add(new THREE.HemisphereLight(0xffffff,0x666666,1.1));
  const dir=new THREE.DirectionalLight(0xffffff,1.3);
  dir.position.set(5,10,7); scene.add(dir);

  clock=new THREE.Clock();
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
}
function loadModel(){
  new GLTFLoader().load(MODEL_URL,gltf=>{
    const root=gltf.scene; scene.add(root);

    const box=new THREE.Box3().setFromObject(root);
    const size=box.getSize(new THREE.Vector3()).length();
    const ctr =box.getCenter(new THREE.Vector3());
    camera.near=size/100; camera.far=size*100; camera.updateProjectionMatrix();
    camera.position.copy(ctr).add(new THREE.Vector3(0,size*0.3,size*1.5));
    camera.lookAt(ctr);

    if(gltf.animations?.length){
      mixer=new THREE.AnimationMixer(root);
      mixer.addEventListener('finished',e=>{
        e.action.enabled=false;
        const rule=poseRules[e.action.getClip().name];
        if(rule) poseState=rule.produces;
        currentAction=null; playNext();
      });
      gltf.animations.forEach(c=>{
        const act=mixer.clipAction(c);
        act.loop=THREE.LoopOnce; act.clampWhenFinished=true;
        actions.push(act);
      });
    }
  });
}
function triggerAnimation(n){const a=actions.find(x=>x.getClip().name===n); if(a){a.reset().play(); currentAction=a;}}
function expandAction(cmd){
  const rule=poseRules[cmd]; if(!rule) return [];
  const arr=[]; if(rule.requires!==poseState){const t=transByState[rule.requires]; if(t) arr.push(t);}
  arr.push(cmd); return arr;
}
function playNext(){if(!currentAction&&queue.length) triggerAnimation(queue.shift());}
function animate(){requestAnimationFrame(animate); const dt=clock.getDelta(); if(mixer)mixer.update(dt); renderer.render(scene,camera);}

/* =========================================================
   CHAT UI
   ========================================================= */
const chatBox   = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend  = document.getElementById('chat-send');
const chatClear = document.getElementById('chat-clear');
let history=[];

function addBubble(cls,txt){
  const d=document.createElement('div');
  d.className=cls; d.textContent=txt;
  chatBox.appendChild(d);
}
chatClear.onclick = ()=>{history.length=0; chatBox.innerHTML='';};
chatSend.onclick  = sendMessage;
chatInput.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();sendMessage();} };

async function sendMessage(){
  const enUser = chatInput.value.trim();
  if(!enUser) return;
  chatInput.value='';

  addBubble('eng-user user-bubble',`You (EN): ${enUser}`);
  const roboUserDiv = document.createElement('div');
  roboUserDiv.className = 'robo-user user-bubble';
  roboUserDiv.textContent = 'You (Robo): …';
  chatBox.appendChild(roboUserDiv);
  //addBubble('robo-user user-bubble',`You (Robo): ${translateToRobot(enUser)}`);
  chatBox.scrollTop=chatBox.scrollHeight;
  history.push({role:'user',content:enUser});

  /* placeholders */
  const ansDiv = document.createElement('div'); ansDiv.className='eng-bot bot-bubble';  ansDiv.textContent='…';
  const aDiv   = document.createElement('div'); aDiv.className ='robo-bot bot-bubble'; aDiv.textContent='…';
  chatBox.append(ansDiv,aDiv); chatBox.scrollTop=chatBox.scrollHeight;

  try{
    const {original='',q_simple='',a_simple='',action=''} =
          await callGemini([...history]);

    roboUserDiv.textContent = `You (Robo): ${translateToRobot(q_simple)}`;
    aDiv .textContent = `Robo-A: ${translateToRobot(a_simple)}`;
    ansDiv.textContent= `Бот: ${original}`;
    history.push({role:'assistant',content:original});

    if(action){
      queue.length=0; queue.push(...expandAction(action)); playNext();
    }
  }catch(err){
    ansDiv.textContent = 'Bot error';
    console.error(err);
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* =========================================================
   Gemini REST v1beta helper
   ========================================================= */
   async function callGemini(conv) {
    const apiKey = localStorage.getItem('gemini_api_key')?.trim();
    if (!apiKey) throw new Error('Введите API-ключ');
  
    const contents = SYS_PROMPTS.concat(
      conv.map(m => ({
        role : m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    );
  
    const resp = await fetch(
      `${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ contents })
      }
    );
  
    const raw = await resp.text();
  
    if (!resp.ok) {                         // 4xx / 5xx
      console.error('Gemini raw error', raw);
      throw new Error(`Gemini ${resp.status}`);
    }
  
    /* 1️⃣ убираем ```json ... ```  при необходимости */
    let jsonStr = raw
      .replace(/^\s*```json\s*/i, '')       // начало блока
      .replace(/^\s*```/m, '')              // конец блока
      .trim();
  
    /* 2️⃣ парсим в объект; если не получилось — кидаем ошибку */
    let payload;
    try {
      const outer = JSON.parse(jsonStr);
      jsonStr = outer.candidates?.[0]?.content?.parts?.[0]?.text || jsonStr;
      payload = JSON.parse(
        jsonStr
          .replace(/^\s*```json\s*/i, '')
          .replace(/^\s*```/m, '')
          .trim()
      );
    } catch (e) {
      console.error('Не удалось разобрать JSON', e, '\nИсходная строка:', jsonStr);
      throw new Error('Gemini прислал невалидный JSON');
    }
  
    return payload;   // {original, q_simple, a_simple, …}   // { original, q_simple, a_simple, ... }
   }
   