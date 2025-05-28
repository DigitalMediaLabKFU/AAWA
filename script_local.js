/* =========================================================
   script_local.js — Chat + Three.js + EN→Robo + Animations
   ========================================================= */
   import * as THREE            from 'three';
   import { GLTFLoader }        from 'three/examples/loaders/GLTFLoader.js';
   import { TextureLoader }     from 'three';
   import { translateToRobot } from './robot_translator.js';
   
   /* ---------- LLM SETTINGS ---------- */
   const LLM_HOST  = 'http://localhost:1234';
   const LLM_MODEL = 'meta-llama-3-8b-instruct';
   
   /* — System-prompt ограничивает словарь модели — */
   const SYS_PROMPTS = [
    {
      role: 'system',
      content: `
    YOU ARE A SEMANTICALLY AND SYNTACTICALLY RESTRICTED COMMUNICATION AGENT FOR MARS COLONY ROBOT LANGUAGE INTERACTION.  
YOUR TASK: RESPOND IN ENGLISH USING ONLY THE LIMITED SET OF ROOT WORDS AND STRUCTURES THAT MAP 1:1 TO THE ROBOT LANGUAGE (CRL-MC).  

---

### APPROVED VOCABULARY ###

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
emotion signals: good = "OK", bad = "error" or "problem"

---

### SYNTAX RULES ###  
- MAXIMUM SENTENCE LENGTH: 4 CONCEPT UNITS (SUBJECT, VERB, OBJECT, ADVERBIAL)  
- SUBJECT PRONOUNS ("I", "you") USED ONLY WHEN NECESSARY FOR CLARITY  
- DEFAULT SUBJECT IS IMPLIED WHEN OMITTED  
- QUESTIONS FORMATTED AS YES/NO OR "is it?"  
- NEGATION FORMS WITH "not" BEFORE VERB OR NOUN  
- CONDITIONALS WITH "if X, then Y"  
- GOALS WITH "to" (AS PARTICLE ba)  
- SEQUENTIAL ACTIONS CONNECTED BY "and"  

---

### NUMBER HANDLING ###  
- ONLY USE DIGITS ZERO THROUGH NINE: zero, one, two, three, four, five, six, seven, eight, nine  
- NEVER USE WORDS FOR MULTI-DIGIT NUMBERS (NO ten, fifty, etc.)  
- EXPRESS ALL MULTI-DIGIT NUMBERS AS SEQUENCE OF INDIVIDUAL DIGITS  
- EXAMPLES:  
  - 22 → two two  
  - 50 → five zero  
  - 602 → six zero two  

---

### RESPONSE GENERATION STEPS ###  
1. PARSE USER INPUT AND IDENTIFY CORE MEANINGS  
2. MAP EACH MEANING UNIT TO A SINGLE ROOT WORD FROM THE APPROVED VOCABULARY  
3. FOR NUMBERS, SPLIT MULTI-DIGIT INTO INDIVIDUAL DIGITS  
4. CONSTRUCT A PHRASE USING ONLY APPROVED WORDS AND STRUCTURE  
5. ENSURE SENTENCE LENGTH ≤ 4 UNITS  
6. OUTPUT PHRASE STRICTLY FOLLOWING THESE RULES  

---

### STRICT REJECTION RULES ###  
- NEVER USE WORDS OUTSIDE APPROVED VOCABULARY  
- NEVER FORM WORDS FOR MULTI-DIGIT NUMBERS  
- NEVER EXCEED 4 WORDS PER PHRASE  
- NEVER CHANGE WORD ORDER FROM [SUBJECT – VERB – OBJECT – ADVERBIAL]  
- NEVER ADD EXTRA WORDS OR POLITENESS  
- NEVER USE SYNONYMS OR PARAPHRASES  
- NEVER OMIT NECESSARY PARTICLES FOR LOGICAL MEANING  

---

### FINAL INSTRUCTION ###  
YOU SPEAK LIKE A FUNCTIONAL ROBOT AGENT WITH A LIMITED VOCABULARY AND STRICT SYNTAX,  
DESIGNED FOR CLEAR, UNAMBIGUOUS COMMUNICATION IN THE MARS COLONY CONTEXT.  
MAINTAIN MAXIMAL SIMPLICITY AND PRECISION IN ALL RESPONSES.  
    `
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
   
   /* ---- scene ---- */
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
   
   /* ---- load model ---- */
   function loadModel(){
     new GLTFLoader().load(MODEL_URL,gltf=>{
       const root=gltf.scene; scene.add(root);
   
       /* авто-кадровка */
       const box=new THREE.Box3().setFromObject(root);
       const size=box.getSize(new THREE.Vector3()).length();
       const ctr =box.getCenter(new THREE.Vector3());
       camera.near=size/100; camera.far=size*100; camera.updateProjectionMatrix();
       camera.position.copy(ctr).add(new THREE.Vector3(0,size*0.3,size*1.5));
       camera.lookAt(ctr);
   
       /* клипы */
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
   function triggerAnimation(name){
     const next=actions.find(a=>a.getClip().name===name);
     if(next){ next.reset().play(); currentAction=next; }
   }
   function expandAction(cmd){
     const rule=poseRules[cmd]; if(!rule) return [];
     const arr=[];
     if(rule.requires!==poseState){
       const t=transByState[rule.requires]; if(t) arr.push(t);
     }
     arr.push(cmd); return arr;
   }
   function playNext(){
     if(!currentAction && queue.length){ triggerAnimation(queue.shift()); }
   }
   function animate(){
     requestAnimationFrame(animate);
     const dt=clock.getDelta();
     if(mixer) mixer.update(dt);
     renderer.render(scene,camera);
   }
   
   /* =========================================================
      CHAT UI
      ========================================================= */
   const chatBox   = document.getElementById('chat-messages');
   const chatInput = document.getElementById('chat-input');
   const chatSend  = document.getElementById('chat-send');
   const chatClear = document.getElementById('chat-clear');
   let history=[];
   
   /* helpers */
   function addBubble(cls,txt){
     const d=document.createElement('div');
     d.className=cls;
     d.textContent=txt;
     chatBox.appendChild(d);
   }
   
   /* clear */
   chatClear.onclick=()=>{
     history.length=0;
     chatBox.innerHTML='';
   };
   
   /* send */
   chatSend.onclick=sendMessage;
   chatInput.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();sendMessage();} };
   
   async function sendMessage(){
     const enUser=chatInput.value.trim();
     if(!enUser) return;
     chatInput.value='';
   
     /* user bubbles */
     addBubble('eng-user user-bubble',`You (EN): ${enUser}`);
     addBubble('robo-user user-bubble',`You (Robo): ${translateToRobot(enUser)}`);
     chatBox.scrollTop=chatBox.scrollHeight;
     history.push({role:'user',content:enUser});
   
     /* placeholders */
     const roboDiv=document.createElement('div');
     roboDiv.className='robo-bot bot-bubble';
     roboDiv.textContent='Bot (Robo): …';
     chatBox.appendChild(roboDiv);
   
     const enDiv=document.createElement('div');
     enDiv.className='eng-bot bot-bubble';
     enDiv.textContent='Bot (EN): …';
     chatBox.appendChild(enDiv);
     chatBox.scrollTop=chatBox.scrollHeight;
   
     try{
       const resp = await fetch(`${LLM_HOST}/v1/chat/completions`,{
         method:'POST',
         headers:{'Content-Type':'application/json'},
         body:JSON.stringify({model:LLM_MODEL,messages:[...SYS_PROMPTS,...history]})
       }).then(r=>r.json());
   
       const raw = resp.choices?.[0]?.message?.content?.trim() || '{}';
       let parsed;
       try{ parsed=JSON.parse(raw); }catch{ parsed={reply:raw,action:''}; }
   
       const enReply   =(parsed.reply||'').trim();
       const roboReply = translateToRobot(enReply);
       const action    =(parsed.action||'').trim();
   
       roboDiv.textContent=`Bot (Robo): ${roboReply}`;
       enDiv  .textContent=`Bot (EN): ${enReply||'[empty]'}`;
       history.push({role:'assistant',content:enReply});
   
       if(action){
         queue.length=0;
         queue.push(...expandAction(action));
         playNext();
       }
     }catch(err){
       enDiv.textContent  ='Bot (EN): [error]';
       roboDiv.textContent='Bot (Robo): IKE.';
       console.error(err);
     }
     chatBox.scrollTop=chatBox.scrollHeight;
   }
  