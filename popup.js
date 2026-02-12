const STORAGE_KEY = 'text_snippets';
let currentTheme = 'dark'; // Default theme
let currentLang = 'ru';   // Default language
let initialData = []; // To store data when options page loads for 'cancel' functionality
let draggedItem = null; // For drag and drop

// =======================
// Localization messages
// =======================
const messages = {
    ru: {
        optionsTitle: 'BroPaste',
        optionsHeading: 'BroPaste',
        textsToPaste: 'Тексты для вставки:',
        addEntryButton: 'Добавить запись',
        importButton: 'Импорт',
        exportButton: 'Экспорт',
        saveButton: 'Сохранить',
        cancelButton: 'Отмена',
        deleteButton: 'Удалить',
        placeholderTextarea: 'Введите текст здесь...',
        confirmDelete: 'Вы уверены, что хотите удалить эту запись?',
        importSuccess: 'Данные успешно импортированы!',
        importError: 'Ошибка импорта данных. Проверьте формат файла.',
        exportSuccess: 'Данные успешно экспортированы.',
        exportError: 'Ошибка экспорта данных.',
        invalidJsonFormat: 'Неверный формат JSON. Ожидается массив объектов с полем "content".',
        noDataToExport: 'Нет данных для экспорта.',
        themeLight: 'Светлая',
        themeDark: 'Тёмная',
        langEn: 'EN',
        langRu: 'RU',
        noDataToCopy: 'Нет данных для копирования',
        copiedToClipboard: '📋 Скопировано в буфер обмена!',
        copyTitle: 'Копировать'
    },
    en: {
        optionsTitle: 'BroPaste',
        optionsHeading: 'BroPaste',
        textsToPaste: 'Texts to paste:',
        addEntryButton: 'Add Entry',
        importButton: 'Import',
        exportButton: 'Export',
        saveButton: 'Save',
        cancelButton: 'Cancel',
        deleteButton: 'Delete',
        placeholderTextarea: 'Enter text here...',
        confirmDelete: 'Are you sure you want to delete this entry?',
        importSuccess: 'Data imported successfully!',
        importError: 'Error importing data. Check file format.',
        exportSuccess: 'Data exported successfully.',
        exportError: 'Error exporting data.',
        invalidJsonFormat: 'Invalid JSON format. Expected an array of objects with a "content" field.',
        noDataToExport: 'No data to export.',
        themeLight: 'Light',
        themeDark: 'Dark',
        langEn: 'EN',
        langRu: 'RU',
        noDataToCopy: 'No data to copy',
        copiedToClipboard: '📋 Copied to clipboard!',
        copyTitle: 'Copy'
    }
};

function getMessages(lang) {
    return messages[lang] || messages.ru;
}

// =======================
// Date helper for export
// =======================
function getDateStamp() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2, 2);
    return `${dd}_${mm}_${yy}`;
}

// =======================
// Localization
// =======================
function loadI18n() {
    const currentMessages = getMessages(currentLang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const msg = currentMessages[key];
        if (!msg) return;

        if (el.tagName === 'INPUT' && el.type === 'button') {
            el.value = msg;
        } else if (el.tagName === 'SPAN' || el.tagName === 'TITLE') {
            el.textContent = msg;
        } else if (el.tagName === 'BUTTON') {
            const span = el.querySelector('span');
            if (span) span.textContent = msg;
        }
    });

    // tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const msg = currentMessages[key];
        if (msg) el.title = msg;
    });

    // placeholders
    document.querySelectorAll('textarea.content').forEach(el => {
        el.placeholder = currentMessages.placeholderTextarea;
    });
}

// =======================
// Cancel
// =======================
function cancel() {
    const theTableBody = document.getElementById('liste');
    theTableBody.innerHTML = '';

    if (initialData.length > 0) {
        initialData.forEach(item => addTableRow(item.content));
    } else {
        addTableRow();
    }
    window.close();
}

// =======================
// Save
// =======================
function save() {
    const contents = document.getElementsByClassName('content');
    const newObject = [];

    for (let i = 0; i < contents.length; i++) {
        const val = contents[i].value.trim();
        if (val !== '') {
            newObject.push({ content: val });
        }
    }

    chrome.storage.local.set({ [STORAGE_KEY]: newObject }, () => {
        chrome.runtime.sendMessage({ action: 'resetMenu' });
        window.close();
    });
}

// =======================
// Add row
// =======================
function addTableRow(content = '') {
    const theTableBody = document.getElementById('liste');
    const newTR = document.createElement('tr');
    newTR.draggable = true;

    newTR.innerHTML = `
        <td style="width: 100%;">
            <textarea class="content"
                style="width: 100%; height: 38px; display: block;"
            >${content}</textarea>
        </td>
        <td>
            <div class="row-actions">
                <button class="btn-copy-row" data-i18n-title="copyTitle">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="btn-delete" data-i18n-title="deleteButton">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </td>
    `;

    const copyBtn = newTR.querySelector('.btn-copy-row');
    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const textarea = newTR.querySelector('textarea.content');
        const text = textarea.value;

        if (!text.trim()) {
            alert(getMessages(currentLang).noDataToCopy);
            return;
        }

        try {
            await navigator.clipboard.writeText(text);

            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.style.color = '#10b981';

            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '';
            }, 1000);

        } catch (err) {
            console.error('Clipboard error:', err);
            alert('Ошибка копирования');
        }
    });

    const deleteBtn = newTR.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(getMessages(currentLang).confirmDelete)) {
            newTR.remove();
        }
    });

    theTableBody.appendChild(newTR);
    loadI18n(); // локализуем только что добавленные элементы
}

// =======================
// Export
// =======================
function exportData() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        const data = result[STORAGE_KEY] || [];

        if (data.length === 0) {
            alert(getMessages(currentLang).noDataToExport);
            return;
        }

        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `bropaste_snippets_${getDateStamp()}.json`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(getMessages(currentLang).exportSuccess);
    });
}

// =======================
// Import
// =======================
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            if (
                !Array.isArray(importedData) ||
                !importedData.every(item => typeof item === 'object' && item !== null && 'content' in item)
            ) {
                throw new Error(getMessages(currentLang).invalidJsonFormat);
            }

            chrome.storage.local.set({ [STORAGE_KEY]: importedData }, () => {
                alert(getMessages(currentLang).importSuccess);
                loadOptionsData();
                chrome.runtime.sendMessage({ action: 'resetMenu' });
            });

        } catch (error) {
            console.error('Import error:', error);
            alert(`${getMessages(currentLang).importError}\n${error.message}`);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// =======================
// Load data
// =======================
function loadOptionsData() {
    const theTableBody = document.getElementById('liste');
    theTableBody.innerHTML = '';

    chrome.storage.local.get([STORAGE_KEY], (result) => {
        initialData = JSON.parse(JSON.stringify(result[STORAGE_KEY] || []));

        if (initialData.length > 0) {
            initialData.forEach(item => addTableRow(item.content));
        } else {
            addTableRow();
        }
    });
}

// =======================
// Preferences
// =======================
async function loadPreferences() {
    const result = await chrome.storage.local.get(['theme', 'lang']);
    currentTheme = result.theme || 'dark';
    currentLang = result.lang || 'ru';
    document.body.className = currentTheme;
    updateToggles();
}

function setupThemeToggles() {
    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentTheme = btn.dataset.theme;
            document.body.className = currentTheme;
            await chrome.storage.local.set({ theme: currentTheme });
            updateToggles();
        });
    });
}

function setupLangToggles() {
    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentLang = btn.dataset.lang;
            await chrome.storage.local.set({ lang: currentLang });
            updateToggles();
            loadI18n();
        });
    });
}

function updateToggles() {
    document.querySelectorAll('[data-theme]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.theme === currentTheme)
    );
    document.querySelectorAll('[data-lang]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.lang === currentLang)
    );
}

// =======================
// Drag & Drop
// =======================
function setupDragAndDrop() {
    const tbody = document.getElementById('liste');

    tbody.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'TR') {
            draggedItem = e.target;
            e.dataTransfer.setData('text/plain', '');
            draggedItem.classList.add('dragging');
        }
    });

    tbody.addEventListener('dragover', (e) => {
        e.preventDefault();
        const row = e.target.closest('tr');
        if (!row || row === draggedItem) return;

        const rect = row.getBoundingClientRect();
        const offset = e.clientY - rect.top;

        row.classList.toggle('drag-over-top', offset < rect.height / 2);
        row.classList.toggle('drag-over-bottom', offset >= rect.height / 2);
    });

    tbody.addEventListener('drop', (e) => {
        e.preventDefault();
        const row = e.target.closest('tr');
        if (!row || row === draggedItem) return;

        const rect = row.getBoundingClientRect();
        const offset = e.clientY - rect.top;

        tbody.insertBefore(
            draggedItem,
            offset < rect.height / 2 ? row : row.nextSibling
        );
    });

    tbody.addEventListener('dragend', () => {
        draggedItem = null;
        tbody.querySelectorAll('tr').forEach(tr =>
            tr.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom')
        );
    });
}

// =======================
// Init
// =======================
window.addEventListener('load', async () => {
    await loadPreferences();
    loadI18n();

    document.getElementById('save').addEventListener('click', save);
    document.getElementById('cancel').addEventListener('click', cancel);
    document.getElementById('addentry').addEventListener('click', () => addTableRow());

    document.getElementById('exportBtn').addEventListener('click', exportData);

    const importFileEl = document.getElementById('importData');
    document.getElementById('importBtn').addEventListener('click', () => importFileEl.click());
    importFileEl.addEventListener('change', importData);

    loadOptionsData();
    setupDragAndDrop();
    setupThemeToggles();
    setupLangToggles();
});
