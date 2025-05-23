/* ---------- script_core.js (общие функции) ---------- */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

/* === конфиг анимаций === */
const MODEL_URL  = './Models/robot_model.glb';
const actionMap  = { HandsClose:'HandsClose', HandsOpen:'HandsOpen', Walk:'Walk' };
const PROMPT_TAG = 'ИИ: ';

/* глобальные переменные сцены */
let scene, camera, renderer, clock, mixer=null;
const actions=[]; let currentAction=null;

/* ----------  SCENE  ---------- */
export function initScene() {
  scene = new THREE.Scene();
  new TextureLoader().load('./Textures/soft_sky.jpg', t=>{
    t.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = t;
  });

  camera = new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,100);
  camera.position.set(0,1.6,4); camera.lookAt(0,1,0);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.toneMappingExposure = 1.4;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff,0.5));
  scene.add(new THREE.HemisphereLight(0xffffff,0x666666,1.1));
  const dir = new THREE.DirectionalLight(0xffffff,1.5);
  dir.position.set(5,10,7); scene.add(dir);

  clock = new THREE.Clock();
  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });

  /* загрузка GLB */
  new GLTFLoader().load(MODEL_URL, gltf=>{
    const root=gltf.scene; scene.add(root);
    const box=new THREE.Box3().setFromObject(root);
    const size=box.getSize(new THREE.Vector3()).length();
    const ctr =box.getCenter(new THREE.Vector3());
    camera.near=size/100; camera.far=size*100; camera.updateProjectionMatrix();
    camera.position.copy(ctr).add(new THREE.Vector3(0,size*0.3,size*1.5));
    camera.lookAt(ctr);

    if(gltf.animations?.length){
      mixer=new THREE.AnimationMixer(root);
      gltf.animations.forEach(c=>actions.push(mixer.clipAction(c)));
      currentAction=actions[0]; currentAction.play();
    }
  });

  function triggerAnimation(key){
    const clipName = actionMap[key] ?? '';
    if(!clipName) return;
    const next = actions.find(a=>a.getClip().name===clipName);
    if(!next || next===currentAction) return;
    next.reset().play();
    currentAction.crossFadeTo(next,0.4,false);
    currentAction = next;
  }

  return { triggerAnimation };
}

/* ----------  CHAT UI  ---------- */
export function setupChatUI(llmClient, triggerAnimation){
  const chatBox   = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend  = document.getElementById('chat-send');
  const chatClear = document.getElementById('chat-clear');

  let history=[];
  try{ const s=localStorage.getItem('chatHistory'); if(s) history=JSON.parse(s);}catch{}
  renderHistory();

  function renderHistory(){
    chatBox.innerHTML='';
    history.forEach(m=>{
      const d=document.createElement('div');
      d.className = m.role==='user'?'user':'assistant';
      d.textContent = (m.role==='user'?'Вы: ':PROMPT_TAG) + m.content;
      chatBox.appendChild(d);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendMessage(){
    const txt=chatInput.value.trim();
    if(!txt) return;
    chatInput.value='';

    history.push({role:'user',content:txt});
    const u=document.createElement('div'); u.className='user';
    u.textContent='Вы: '+txt; chatBox.appendChild(u);

    const a=document.createElement('div'); a.className='assistant';
    a.textContent=PROMPT_TAG+'…'; chatBox.appendChild(a);
    chatBox.scrollTop = chatBox.scrollHeight;

    try{
      const {reply,action}=await llmClient.chat(history);
      a.textContent=PROMPT_TAG+reply;
      history.push({role:'assistant',content:reply});
      triggerAnimation(action);
    }catch(err){
      a.textContent=PROMPT_TAG+'[ошибка]'; console.error(err);
    }finally{
      if(history.length>40) history.splice(0,history.length-40);
      localStorage.setItem('chatHistory',JSON.stringify(history));
    }
  }

  chatSend .addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); sendMessage(); }
  });
  chatClear.addEventListener('click', ()=>{
    history=[]; localStorage.removeItem('chatHistory'); renderHistory();
  });
}

/* ----------  RENDER LOOP  ---------- */
export function runLoop(){
  function animate(){
    requestAnimationFrame(animate);
    const dt=clock?.getDelta() ?? 0;
    if(mixer) mixer.update(dt);
    renderer.render(scene,camera);
  }
  animate();
}
