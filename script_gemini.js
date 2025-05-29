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
   
   const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';   // flash или pro
   
   /* ---------- System-prompt (копия из script_local) ---------- */
   const SYS_PROMPTS = [
     {
       role: 'user',              // Gemini ожидает user-prompt внутри contents
       parts: [{
         text: `
   YOU ARE A SEMANTICALLY AND SYNTACTICALLY RESTRICTED COMMUNICATION ...
   [вся ваша длинная инструкция остаётся здесь без изменений]`
       }]
     }
   ];
   
   /* ---------- THREE / ROBOT ---------- */
   const MODEL_URL = './Models/robot_model.glb';
   let scene, camera, renderer, clock, mixer = null;
   const actions = [];                // AnimationAction[]
   let currentAction = null;
   let poseState = 'idle';
   const poseRules = {
     HandsOpen : { requires: 'idle', produces: 'open' },
     HandsClose: { requires: 'open', produces: 'idle' },
     Walk      : { requires: 'idle', produces: 'idle' }
   };
   const transByState = { idle: 'HandsClose', open: 'HandsOpen' };
   const queue = [];                  // очередь жестов
   
   initScene();
   loadModel();
   animate();
   
   /* ---- scene ---- */
   function initScene () {
     scene = new THREE.Scene();
     new TextureLoader().load('./Textures/soft_sky.jpg', t => {
       t.mapping = THREE.EquirectangularReflectionMapping;
       scene.background = t;
     });
   
     camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
     camera.position.set(0, 1.6, 4);
   
     renderer = new THREE.WebGLRenderer({ antialias: true });
     renderer.setSize(innerWidth, innerHeight);
     renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
     document.body.appendChild(renderer.domElement);
   
     scene.add(new THREE.AmbientLight(0xffffff, 0.6));
     scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.1));
     const dir = new THREE.DirectionalLight(0xffffff, 1.3);
     dir.position.set(5, 10, 7);
     scene.add(dir);
   
     clock = new THREE.Clock();
     addEventListener('resize', () => {
       camera.aspect = innerWidth / innerHeight;
       camera.updateProjectionMatrix();
       renderer.setSize(innerWidth, innerHeight);
     });
   }
   
   /* ---- load GLB model ---- */
   function loadModel () {
     new GLTFLoader().load(MODEL_URL, gltf => {
       const root = gltf.scene;
       scene.add(root);
   
       /* авто-кадровка */
       const box  = new THREE.Box3().setFromObject(root);
       const size = box.getSize(new THREE.Vector3()).length();
       const ctr  = box.getCenter(new THREE.Vector3());
       camera.near = size / 100;
       camera.far  = size * 100;
       camera.updateProjectionMatrix();
       camera.position.copy(ctr).add(new THREE.Vector3(0, size * 0.3, size * 1.5));
       camera.lookAt(ctr);
   
       /* анимации */
       if (gltf.animations?.length) {
         mixer = new THREE.AnimationMixer(root);
         mixer.addEventListener('finished', e => {
           e.action.enabled = false;
           const rule = poseRules[e.action.getClip().name];
           if (rule) poseState = rule.produces;
           currentAction = null;
           playNext();
         });
         gltf.animations.forEach(c => {
           const act = mixer.clipAction(c);
           act.loop = THREE.LoopOnce;
           act.clampWhenFinished = true;
           actions.push(act);
         });
       }
     });
   }
   function triggerAnimation (name) {
     const next = actions.find(a => a.getClip().name === name);
     if (next) { next.reset().play(); currentAction = next; }
   }
   function expandAction (cmd) {
     const rule = poseRules[cmd];
     if (!rule) return [];
     const arr = [];
     if (rule.requires !== poseState) {
       const t = transByState[rule.requires];
       if (t) arr.push(t);
     }
     arr.push(cmd);
     return arr;
   }
   function playNext () {
     if (!currentAction && queue.length) triggerAnimation(queue.shift());
   }
   function animate () {
     requestAnimationFrame(animate);
     const dt = clock.getDelta();
     if (mixer) mixer.update(dt);
     renderer.render(scene, camera);
   }
   
   /* =========================================================
      CHAT UI
      ========================================================= */
   const chatBox   = document.getElementById('chat-messages');
   const chatInput = document.getElementById('chat-input');
   const chatSend  = document.getElementById('chat-send');
   const chatClear = document.getElementById('chat-clear');
   let history = [];
   
   function addBubble (cls, txt) {
     const d = document.createElement('div');
     d.className = cls;
     d.textContent = txt;
     chatBox.appendChild(d);
   }
   
   chatClear.onclick   = () => { history.length = 0; chatBox.innerHTML = ''; };
   chatSend.onclick    = sendMessage;
   chatInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } };
   
   async function sendMessage () {
     const enUser = chatInput.value.trim();
     if (!enUser) return;
     chatInput.value = '';
   
     addBubble('eng-user user-bubble',  `You (EN): ${enUser}`);
     addBubble('robo-user user-bubble', `You (Robo): ${translateToRobot(enUser)}`);
     chatBox.scrollTop = chatBox.scrollHeight;
     history.push({ role: 'user', content: enUser });
   
     /* placeholders */
     const roboDiv = document.createElement('div');
     roboDiv.className = 'robo-bot bot-bubble';
     roboDiv.textContent = 'Bot (Robo): …';
     chatBox.appendChild(roboDiv);
   
     const enDiv = document.createElement('div');
     enDiv.className = 'eng-bot bot-bubble';
     enDiv.textContent = 'Bot (EN): …';
     chatBox.appendChild(enDiv);
     chatBox.scrollTop = chatBox.scrollHeight;
   
     /* --------------- Gemini API --------------- */
     try {
       const { reply, action } = await callGemini([...history]);
       const enReply   = reply.trim();
       const roboReply = translateToRobot(enReply);
   
       roboDiv.textContent = `Bot (Robo): ${roboReply}`;
       enDiv.textContent   = `Bot (EN): ${enReply || '[empty]'}`;
       history.push({ role: 'assistant', content: enReply });
   
       if (action) {
         queue.length = 0;
         queue.push(...expandAction(action));
         playNext();
       }
     } catch (err) {
       enDiv.textContent   = 'Bot (EN): [error]';
       roboDiv.textContent = 'Bot (Robo): IKE.';
       console.error(err);
     }
     chatBox.scrollTop = chatBox.scrollHeight;
   }
   
   /* =========================================================
      Gemini call helper
      ========================================================= */
   async function callGemini (hist) {
     /* достаём ключ либо из localStorage, либо прямо из input */
     const apiKey = (localStorage.getItem('gemini_api_key') || keyInput.value)
                      .replace(/\s+/g, '');
     if (!apiKey) throw new Error('🔑 Не найден API-ключ: введите его и нажмите Save');
   
     const gHistory = SYS_PROMPTS.concat(
       hist.map(m => ({
         role : m.role === 'assistant' ? 'model' : 'user',
         parts: [{ text: m.content }]
       }))
     );
   
     const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
               + `?key=${encodeURIComponent(apiKey)}`;
   
     const resp = await fetch(url, {
       method : 'POST',
       headers: { 'Content-Type': 'application/json' },
       body   : JSON.stringify({ contents: gHistory })
     });
   
     /* если сервер ответил ошибкой — покажем полное тело, там reason */
     if (!resp.ok) {
       console.error(await resp.text());
       throw new Error(`Gemini ${resp.status}`);
     }
   
     const data = await resp.json();
     const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
   
     try {
       const obj = JSON.parse(raw);
       return { reply: obj.reply || '', action: obj.action || '' };
     } catch {
       /* plain-text fallback */
       return { reply: raw, action: '' };
     }
   }
   