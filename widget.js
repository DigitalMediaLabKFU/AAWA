(function(){
    /* 1. создаём кнопку-кружок 🤖 */
    const btn = document.createElement('div');
    btn.id = 'robot-launcher';
    btn.innerHTML = '🤖';
    document.body.appendChild(btn);
  
    /* 2. создаём iframe, где будет жить mini-chat */
    const frame = document.createElement('iframe');
    frame.id  = 'robot-frame';
    frame.src = 'widget.html';           // ← путь к скопированной странице
    frame.title = 'Mars-Bot chat';
    document.body.appendChild(frame);
  
    /* 3. по клику показываем / скрываем */
    btn.onclick = () => {
      frame.style.display =
        frame.style.display === 'block' ? 'none' : 'block';
    };
  })();
  