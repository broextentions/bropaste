const STORAGE_KEY = 'text_snippets';
const PARENT_ID = 'parent_paste';

// === ИНИЦИАЛИЗАЦИЯ МЕНЮ ===
chrome.runtime.onInstalled.addListener(createMenu);
chrome.runtime.onStartup.addListener(createMenu);

function createMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: PARENT_ID,
            title: "BroPaste",
            contexts: ["editable"]
        });

        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const items = result[STORAGE_KEY] || [];
            items.forEach((item, index) => {
                let shortTitle = item.content.trim().substring(0, 30);
                if (item.content.length > 30) shortTitle += "...";
                
                chrome.contextMenus.create({
                    id: `paste_${index}`,
                    parentId: PARENT_ID,
                    title: shortTitle || `(Запись ${index + 1})`,
                    contexts: ["editable"]
                });
            });
        });
    });
}

// === ФУНКЦИЯ ВСТАВКИ (Внедряется в страницу) ===
async function googleSafePaste(text) {
    // 1. Ждем восстановления фокуса после закрытия контекстного меню
    // Google полям нужно время, чтобы понять, что они снова активны
    await new Promise(r => setTimeout(r, 50));

    let el = document.activeElement;

    // Если фокус слетел на body (бывает при правом клике), ищем последнее активное поле
    if (!el || el.tagName === 'BODY') {
        el = document.querySelector('textarea:hover, input:hover') || document.activeElement;
    }

    if (!el) return;
    el.focus();

    // 2. Попытка №1: Современный insertText (самый надежный для Google)
    const success = document.execCommand('insertText', false, text);

    // 3. Попытка №2: Если execCommand заблокирован (для очень вредных полей)
    if (!success || el.value.indexOf(text) === -1) {
        
        // Используем setRangeText - это современный стандарт HTML5
        // Он автоматически обрабатывает selectionStart/End и вставляет текст
        if (typeof el.setRangeText === 'function') {
            el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
        } else {
            // Fallback: прямая вставка через value
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value;
            el.value = val.slice(0, start) + text + val.slice(end);
            el.selectionStart = el.selectionEnd = start + text.length;
        }

        // === ЭМУЛЯЦИЯ СОБЫТИЙ (Критически важно для Google!) ===
        
        // Google Forms/Translate реагируют на input с типом insertText
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: text,
            view: window
        });
        el.dispatchEvent(inputEvent);
        
        // Событие textInput (для старых скриптов Google Closure)
        try {
            const textEvent = document.createEvent('TextEvent');
            textEvent.initTextEvent('textInput', true, true, window, text, 9, "en-US");
            el.dispatchEvent(textEvent);
        } catch(e) {}

        // Обычные события изменения
        el.dispatchEvent(new Event('change', { bubbles: true }));
        
        // ХАК ДЛЯ ВЫСОТЫ (rows="1")
        if (el.tagName === 'TEXTAREA') {
            el.style.height = 'auto';
            el.style.height = (el.scrollHeight + 5) + 'px';
            
            // Заставляем React/Angular переварить изменение
            const keyEvent = new KeyboardEvent('keydown', { bubbles:true, key:'Shift' });
            el.dispatchEvent(keyEvent);
        }
    }
}

// === ОБРАБОТЧИК КЛИКА ===
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith("paste_")) {
        const index = parseInt(info.menuItemId.replace("paste_", ""));
        
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const items = result[STORAGE_KEY] || [];
            if (items[index]) {
                const textToPaste = items[index].content;

                // ВАЖНО: world: 'MAIN' позволяет скрипту работать как часть страницы
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    world: 'MAIN',
                    func: googleSafePaste,
                    args: [textToPaste]
                }).catch(err => console.error("Paste failed:", err));
            }
        });
    }
});