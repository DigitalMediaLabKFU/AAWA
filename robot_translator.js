/* =========================================================
   robot_translator.js  – multi-mapping version (no 4-word limit)
   ========================================================= */

/* ---------- Types ---------- */
export const WordType = {
  Verb: 'Verb', Noun: 'Noun', Adjective: 'Adjective', Adverb: 'Adverb',
  Pronoun: 'Pronoun', Numeral: 'Numeral', Conjunction: 'Conjunction',
  Particle: 'Particle', Unknown: 'Unknown'
};

/* ---------- Robo ➜ English dictionary ---------- */
export const roboDictionary = {
  /* verbs */
  poka:{en:['open','open grip'],                       type:WordType.Verb},
  meka:{en:['close','close grip'],                     type:WordType.Verb},
  kata:{en:['grab','take'],                            type:WordType.Verb},
  napa:{en:['carry','move','bring'],                   type:WordType.Verb},
  soka:{en:['rotate','turn'],                          type:WordType.Verb},
  lapa:{en:['walk','go'],                              type:WordType.Verb},
  piki:{en:['activate','turn on','power on'],          type:WordType.Verb},
  noka:{en:['deactivate','turn off','power off'],      type:WordType.Verb},
  topa:{en:['stop','halt'],                            type:WordType.Verb},
  daka:{en:['dig','mine'],                             type:WordType.Verb},
  ropa:{en:['help'],                                   type:WordType.Verb},
  milu:{en:['fix','repair'],                           type:WordType.Verb},
  fanu:{en:['build','construct'],                      type:WordType.Verb},
  gama:{en:['craft','produce'],                        type:WordType.Verb},
  hani:{en:['plant', 'to plant', 'planted', 'sow'],    type:WordType.Verb},
  zagi:{en:['harvest','gather'],                       type:WordType.Verb},
  voda:{en:['irrigate'],                               type:WordType.Verb},
  fize:{en:['charge','power up'],                      type:WordType.Verb},
  vema:{en:['scan','diagnose'],                        type:WordType.Verb},
  fola:{en:['follow'],                                 type:WordType.Verb},

  /* nouns */
  baku:{en:['container','box','crate'],                type:WordType.Noun},
  lona:{en:['object','resource'],                      type:WordType.Noun},
  basa:{en:['base','home'],                            type:WordType.Noun},
  kasi:{en:['plant', 'plants','a plant', 'the plant', 'that plant', 'this plant', 'plant is', 'plant was', 'plant will be', 'crop'],                           type:WordType.Noun},
  hido:{en:['water (resource)','water'],               type:WordType.Noun},
  zeta:{en:['metal','ore'],                            type:WordType.Noun},
  vata:{en:['battery','power cell'],                   type:WordType.Noun},
  gora:{en:['greenhouse','farm'],                      type:WordType.Noun},
  jena:{en:['generator','reactor'],                    type:WordType.Noun},
  mola:{en:['factory','workshop'],                     type:WordType.Noun},
  silo:{en:['storage','silo'],                         type:WordType.Noun},

  /* adjectives / adverbs */
  lek :{en:['left'],                                   type:WordType.Adjective},
  rek :{en:['right'],                                  type:WordType.Adjective},
  pona:{en:['good','ok'],                              type:WordType.Adjective},
  ike :{en:['bad','faulty','error'],                   type:WordType.Adjective},
  fula:{en:['full'],                                   type:WordType.Adjective},
  yoto:{en:['hot','overheated'],                       type:WordType.Adjective},
  lete:{en:['cold'],                                   type:WordType.Adjective},
  isi :{en:['here','near'],                            type:WordType.Adverb},
  asa :{en:['there','far'],                            type:WordType.Adverb},
  ina :{en:['inside'],                                 type:WordType.Adverb},
  una :{en:['outside'],                                type:WordType.Adverb},
  san :{en:['now','immediately'],                      type:WordType.Adverb},
  tan :{en:['later','then'],                           type:WordType.Adverb},

  /* functional */
  mi :{en:['i','me'],                                  type:WordType.Pronoun},
  yu :{en:['you'],                                     type:WordType.Pronoun},
  nu:{en:['zero', '0'],                                     type:WordType.Numeral},
  wan:{en:['one', '1'],                                     type:WordType.Numeral},
  tu :{en:['two', '2'],                                     type:WordType.Numeral},
  tri:{en:['three', '3'],                                   type:WordType.Numeral},
  fo:{en:['four', '4'],                                     type:WordType.Numeral},
  fi :{en:['five', '5'],                                    type:WordType.Numeral},
  su:{en:['six', '6'],                                      type:WordType.Numeral},
  ze:{en:['seven', '7'],                                    type:WordType.Numeral},
  et :{en:['eight', '8'],                                   type:WordType.Numeral},
  nai:{en:['nine', '9'],                                    type:WordType.Numeral},
  si :{en:['if'],                                      type:WordType.Conjunction},
  ba :{en:['to','for','so that'],                      type:WordType.Conjunction},
  ka :{en:['?'],                                       type:WordType.Particle},
  en :{en:['and'],                                     type:WordType.Conjunction},
  no :{en:['not','no'],                                type:WordType.Particle}
};

/* ---------- Build reverse map: EN ➜ [robo1, robo2,…] ---------- */
const englishToRoboMap = new Map();   // Map<string,string[]>

Object.entries(roboDictionary).forEach(([robo,val])=>{
  val.en
    .map(e=>e.toLowerCase().replace(/[()]/g,''))
    .sort((a,b)=>b.length - a.length)        // longer first
    .forEach(en=>{
      const arr = englishToRoboMap.get(en) || [];
      if (!arr.includes(robo)) arr.push(robo);
      englishToRoboMap.set(en, arr);
    });
});

/* ---------- Robo → English ---------- */
export const translateRoboToEnglish = (robo='')=>{
  if(!robo) return '';
  const out = robo
    .toLowerCase().split(/\s+/).filter(Boolean)
    .map(w=> w==='ka'
        ? '?'
        : roboDictionary[w]
          ? roboDictionary[w].en[0].split(' ')[0]
          : `(${w}?)`)
    .join(' ')
    .replace(' ?', '?');
  return out;
};

/* =========================================================
   EN → Robo   (multi-numerals, simple context)
   ========================================================= */
   export const translateEnglishToRobo = eng => {
    if (!eng) return '';
  
    const tokens = eng.toLowerCase().replace(/[.,!?]/g,'').split(/\s+/);
  
    const seq     = [];          // итоговая robo-фраза (сохран. порядок)
    let neg=false, isQ=eng.includes('?');
  
    /* флаги ожидания — для дизамбигуации */
    let expectVerb=false;
    let expectNoun=false;
  
    tokens.forEach(w=>{
      if(['not',"don't",'dont','no'].includes(w)){ neg=true; return; }
  
      const variants = englishToRoboMap.get(w);
      if(!variants) return;
  
      /* выбираем robo-слово */
      let picked=null;
  
      if(expectVerb)
        picked = variants.find(r=>roboDictionary[r]?.type===WordType.Verb);
      if(expectNoun && !picked)
        picked = variants.find(r=>roboDictionary[r]?.type===WordType.Noun);
  
      picked ??= variants[0];               // по-умолчанию первый
  
      if(!roboDictionary[picked]) return;
  
      seq.push(picked);
  
      /* обновляем ожидания */
      const t = roboDictionary[picked].type;
      expectVerb = false; expectNoun = false;
      if(t===WordType.Pronoun)  expectVerb = true;   // "I" → ждём глагол
      if(t===WordType.Numeral)  expectNoun = true;   // "two" → ждём сущ
    });
  
    /* fallback: если ничего не подошло */
    if(seq.length===0){
      const first = englishToRoboMap.get(tokens[0]);
      if(first) seq.push(first[0]);
    }
  
    /* отрицание и вопрос */
    if(neg) seq.unshift('no');
    if(isQ && !seq.includes('ka')) seq.push('ka');
    if(seq.includes('ka') && seq.at(-1)!=='ka'){
      seq.splice(seq.indexOf('ka'),1); seq.push('ka');
    }
    if(neg && seq[0]!=='no'){
      seq.splice(seq.indexOf('no'),1); seq.unshift('no');
    }
  
    return seq.join(' ').trim();
  };
  

/* compatibility export */
export const translateToRobot = translateEnglishToRobo;
