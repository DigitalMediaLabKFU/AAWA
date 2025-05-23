export function translateToRobot(englishRaw = '') {
    const txt = englishRaw.toLowerCase().trim();
  
    /* ---------- словари ---------- */
    const verbMap = {
      // action → robot word
      'open': 'poka', 'unlock': 'poka',
      'close': 'meka', 'shut': 'meka',
      'grab': 'kata', 'take': 'kata', 'pick up': 'kata',
      'carry': 'napa', 'move': 'napa', 'bring': 'napa',
      'go': 'lapa', 'walk': 'lapa', 'head': 'lapa',
      'turn on': 'piki', 'activate': 'piki', 'power on': 'piki',
      'turn off': 'noka', 'deactivate': 'noka', 'power off': 'noka',
      'stop': 'topa', 'halt': 'topa',
      'help': 'ropa', 'assist': 'ropa',
      'repair': 'milu', 'fix': 'milu',
      'build': 'fanu', 'construct': 'fanu'
    };
  
    const nounMap = {
      'container': 'baku', 'box': 'baku',
      'battery': 'vata', 'power cell': 'vata',
      'greenhouse': 'gora', 'farm': 'gora',
      'base': 'basa',
      'storage': 'silo',
      'generator': 'jena',
      'metal': 'zeta',
      'plant': 'kasi', 'crop': 'kasi'
    };
  
    const advMap = {
      'here': 'isi',  'near': 'isi',
      'there': 'asa', 'far': 'asa',
      'inside': 'ina', 'in': 'ina',
      'outside': 'una', 'out': 'una',
      'now': 'san',  'immediately': 'san',
      'later': 'tan', 'after': 'tan'
    };
  
    /* ---------- утилы ---------- */
    const findKey = (map) =>
      Object.keys(map).find(k => txt.includes(k));
  
    // 1. вопрос?
    const isQuestion = txt.endsWith('?') || txt.startsWith('can ') || txt.startsWith('is ');
  
    // 2. отрицание?
    const isNeg = /(^|\s)not\b/.test(txt) || /\bno\b/.test(txt);
  
    // 3. компоненты
    const verbKey = findKey(verbMap);
    const nounKey = findKey(nounMap);
    const advKey  = findKey(advMap);
  
    // 4. конвертация
    let parts = [];
  
    if (isNeg) parts.push('no');            // частичка отрицания
    parts.push(verbMap[verbKey] || 'ike');  // ike = “bad/unknown” по умолчанию
    if (nounKey) parts.push(nounMap[nounKey]);
    if (advKey)  parts.push(advMap[advKey]);
  
    // 5. финальная пунктуация
    let phrase = parts.join(' ');
    phrase += isQuestion ? ' ka?' : '.';    // ka = вопросительная частица
  
    return phrase.toUpperCase();            // для «неонового» вида
  }