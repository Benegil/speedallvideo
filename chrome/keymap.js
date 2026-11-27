/* SpeedAllVideo — raccourcis S / D / R échangeables par glisser-déposer (popup, options).
   keyMap = { slow, fast, reset } : toujours une permutation de s / d / r.
   onSwap : appelé après un échange (ex : signal sonore). */
function initKeyDrag(onSwap) {
    const DEF = { slow: 's', fast: 'd', reset: 'r' };
    const valid = m => m && [m.slow, m.fast, m.reset].sort().join('') === 'drs';
    const keyEls = [...document.querySelectorAll('.key[data-act]')];
    let keyMap = { ...DEF };
    const render = () => keyEls.forEach(k => { k.textContent = keyMap[k.dataset.act].toUpperCase(); });

    browser.storage.sync.get('keyMap').then(res => { if (valid(res.keyMap)) { keyMap = res.keyMap; render(); } });
    // Popup et options ouverts en même temps : chacun suit les échanges de l'autre
    browser.storage.onChanged.addListener(ch => {
        if (ch.keyMap) { keyMap = valid(ch.keyMap.newValue) ? ch.keyMap.newValue : { ...DEF }; render(); }
    });

    let dragAct = null;
    keyEls.forEach(k => {
        k.addEventListener('dragstart', e => {
            dragAct = k.dataset.act;
            k.classList.add('dragging');
            e.dataTransfer.setData('text/plain', dragAct);
            e.dataTransfer.effectAllowed = 'move';
        });
        k.addEventListener('dragend', () => { dragAct = null; keyEls.forEach(x => x.classList.remove('dragging', 'over')); });
        k.addEventListener('dragover', e => { if (dragAct && dragAct !== k.dataset.act) { e.preventDefault(); k.classList.add('over'); } });
        k.addEventListener('dragleave', () => k.classList.remove('over'));
        k.addEventListener('drop', e => {
            e.preventDefault();
            const a = dragAct, b = k.dataset.act;
            if (!a || a === b) return;
            keyMap = { ...keyMap, [a]: keyMap[b], [b]: keyMap[a] };
            browser.storage.sync.set({ keyMap });
            render();
            if (onSwap) onSwap();
        });
    });
}
