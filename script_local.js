/* =========================================================
   script_local.js — LM-Studio + Three.js + EN→Robo
   ========================================================= */
   import * as THREE             from 'three';
   import { GLTFLoader }         from 'three/examples/loaders/GLTFLoader.js';
   import { TextureLoader }      from 'three';
   import { translateToRobot }   from './robot_translator.js';
   
   /* ---------- LLM CONFIG ---------- */
   const LLM_HOST  = 'http://localhost:1234';
   const LLM_MODEL = 'meta-llama-3-8b-instruct';
   const SYS_PROMPTS = [
     {role:'system',content:`You are Nora, a friendly service robot. Answer in very short English.`},
     {role:'system',content:`Return JSON exactly: {"reply":"text","action":"HandsOpen|HandsClose|Walk|"}.`}
   ];
   
   /* ---------- THREE / MODEL ---------- */
   const MODEL_URL = './Models/robot_model.glb';
   
   let scene,camera,renderer,clock,mixer=null;
   const actions=[]; let currentAction=null;
   let poseState='idle';
   const poseRules   = {HandsOpen:{requires:'idle',produces:'open'},
                        HandsClose:{requires:'open',produces:'idle'},
                        Walk:{requires:'idle',produces:'idle'}};
   const transitionByState={idle:'HandsClose',open:'HandsOpen'};
   const queue=[];                     // очередь жестов
   
   initScene(); loadModel(); animate();
   
   /* ---- init scene ---- */
   function initScene(){
     scene=new THREE.Scene();
     new TextureLoader().load('./Textures/soft_sky.jpg',t=>{
       t.mapping=THREE.EquirectangularReflectionMapping;
       scene.background=t;
     });
   
     camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,100);
     camera.position.set(0,1.6,4); camera.lookAt(0,1,0);
   
     renderer=new THREE.WebGLRenderer({antialias:true});
     renderer.setPixelRatio(Math.min(devicePixelRatio,2));
     renderer.setSize(innerWidth,innerHeight);
     document.body.appendChild(renderer.domElement);
   
     scene.add(new THREE.AmbientLight(0xffffff,0.6));
     scene.add(new THREE.HemisphereLight(0xffffff,0x666666,1.1));
     const dir=new THREE.DirectionalLight(0xffffff,1.4);
     dir.position.set(5,10,7); scene.add(dir);
   
     clock=new THREE.Clock();
     addEventListener('resize',()=>{
       camera.aspect=innerWidth/innerHeight;
       camera.updateProjectionMatrix();
       renderer.setSize(innerWidth,innerHeight);
     });
   }
   
   /* ---- load model & clips ---- */
   function loadModel(){
     new GLTFLoader().load(MODEL_URL,gltf=>{
       const root=gltf.scene; scene.add(root);
   
       /* авто-кадровка */
       const box = new THREE.Box3().setFromObject(root);
       const size= box.getSize(new THREE.Vector3()).length();
       const ctr = box.getCenter(new THREE.Vector3());
       camera.near=size/100; camera.far=size*100; camera.updateProjectionMatrix();
       camera.position.copy(ctr).add(new THREE.Vector3(0,size*0.3,size*1.5));
       camera.lookAt(ctr);
   
       /* анимации */
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
   
   /* ---- анимация по имени ---- */
   function triggerAnimation(name){
     const next=actions.find(a=>a.getClip().name===name);
     if(next){ next.reset().play(); currentAction=next; }
   }
   function expandAction(cmd){
     const rule=poseRules[cmd]; if(!rule) return [];
     const arr=[];
     if(rule.requires && rule.requires!==poseState){
       const trans=transitionByState[rule.requires];
       if(trans) arr.push(trans);
     }
     arr.push(cmd);
     return arr;
   }
   function playNext(){
     if(!currentAction && queue.length){ triggerAnimation(queue.shift()); }
   }
   
   /* ---- render loop ---- */
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
   
   /* ---- helpers ---- */
   function addBubble(cls,txt){
     const d=document.createElement('div');
     d.className=cls;
     d.textContent=txt;
     chatBox.appendChild(d);
   }
   
   /* ---- clear ---- */
   chatClear.onclick = ()=>{
     history.length=0;
     chatBox.innerHTML='';
     localStorage.removeItem('chatHistory');
   };
   
   /* ---- send ---- */
   chatSend.onclick=sendMessage;
   chatInput.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();sendMessage();} };
   
   async function sendMessage(){
     const enText=chatInput.value.trim();
     if(!enText) return;
     chatInput.value='';
   
     /* USER bubbles */
     addBubble('eng-user user-bubble',`You (EN): ${enText}`);
     const roboUser=translateToRobot(enText);
     addBubble('robo-user user-bubble',`You (Robo): ${roboUser}`);
     chatBox.scrollTop=chatBox.scrollHeight;
   
     history.push({role:'user',content:enText});
   
     /* placeholders for bot */
     const botRobo=document.createElement('div');
     botRobo.className='robo-bot bot-bubble';
     botRobo.textContent='Bot (Robo): …';
     chatBox.appendChild(botRobo);
   
     const botEn=document.createElement('div');
     botEn.className='eng-bot bot-bubble';
     botEn.textContent='Bot (EN): …';
     chatBox.appendChild(botEn);
     chatBox.scrollTop=chatBox.scrollHeight;
   
     try {
      /* 1. получаем JSON */
      const resp = await fetch(`${LLM_HOST}/v1/chat/completions`, {
        method : 'POST',
        headers: { 'Content-Type':'application/json' },
        body   : JSON.stringify({ model: LLM_MODEL,
                                  messages:[...SYS_PROMPTS, ...history] })
      }).then(r=>r.json());
    
      /* 2. вытаскиваем контент */
      const rawMsg = resp.choices?.[0]?.message?.content?.trim() || '{}';
    
      /* 3. пытаемся распарсить как JSON строки */
      let parsed;
      try { parsed = JSON.parse(rawMsg); }
      catch { parsed = { reply: rawMsg, action: '' }; }
    
      const enReply   = (parsed.reply  || '').trim();
      const roboReply = translateToRobot(enReply);
      const action    = (parsed.action || '').trim();
    
      /* 4. выводим */
      botRobo.textContent = `Bot (Robo): ${roboReply}`;
      botEn  .textContent = `Bot (EN): ${enReply || '[empty]'}`;
    
      history.push({ role:'assistant', content: enReply });
    
      /* 5. анимация */
      if (action) {
        queue.length = 0;
        queue.push(...expandAction(action));
        playNext();
      }
    
    } catch(err) {
      botEn .textContent = 'Bot (EN): [error]';
      botRobo.textContent = 'Bot (Robo): IKE.';
      console.error(err);
    }
     chatBox.scrollTop=chatBox.scrollHeight;
     localStorage.setItem('chatHistory',JSON.stringify(history));
   }
   