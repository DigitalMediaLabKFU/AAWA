/* ---------- script_openai.js (OpenAI Function-Calling) ---------- */
import { initScene, setupChatUI, runLoop } from './script_core.js';

/* ── клиент для OpenAI ── */
export const llmClient = {
  apiKey: 'sk-XXXX',                // вставьте свой ключ
  model : 'gpt-4o-mini',
  async chat(messages) {
    const resp = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method : 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body   : JSON.stringify({
          model   : this.model,
          stream  : true,
          tools   : [{
            type:'function',
            function:{
              name:'robot_reply',
              parameters:{
                type:'object',
                properties:{
                  reply : { type:'string' },
                  action: { type:'string', enum:['HandsClose','HandsOpen','Walk',''] }
                },
                required:['reply','action']
              }
            }
          }],
          tool_choice:{ type:'function', function:'robot_reply' },
          messages
        })
      }
    );
    if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let raw='';
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      raw += dec.decode(value,{stream:true});
    }
    /* собираем все delta.tool_calls */
    const joined = raw.split('\n').filter(l=>l.startsWith('data:'))
      .map(l=>l.replace('data:','').trim())
      .filter(l=>l && l!=='[DONE]')
      .join('');
    const obj = JSON.parse(joined).choices[0].delta.tool_calls?.[0]
              .function.arguments ?? '{}';
    const { reply='', action='' } = JSON.parse(obj);
    return { reply, action };
  }
};

/* ── подключаем общую логику ── */
const { triggerAnimation } = initScene();
setupChatUI(llmClient, triggerAnimation);
runLoop();
