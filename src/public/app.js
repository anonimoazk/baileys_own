// ===== Baileys Manager Frontend =====

const API_BASE = '/api';

// --- State ---
let instances = [];
let pollingInterval = null;
let qrPollingIntervals = {};

// --- DOM Elements ---
const elements = {
  instancesGrid: document.getElementById('instancesGrid'),
  emptyState: document.getElementById('emptyState'),
  instanceCount: document.getElementById('instanceCount'),
  createModal: document.getElementById('createModal'),
  instanceIdInput: document.getElementById('instanceIdInput'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toastContainer: document.getElementById('toastContainer'),
  createInstanceBtn: document.getElementById('createInstanceBtn'),
  closeModal: document.getElementById('closeModal'),
  cancelCreate: document.getElementById('cancelCreate'),
  confirmCreate: document.getElementById('confirmCreate'),
  refreshBtn: document.getElementById('refreshBtn'),
  toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
};

// --- API Helpers ---
function getApiKey() {
  return elements.apiKeyInput.value.trim();
}

async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Modal ---
function openModal() {
  elements.createModal.classList.add('active');
  elements.instanceIdInput.value = '';
  setTimeout(() => elements.instanceIdInput.focus(), 200);
}

function closeModal() {
  elements.createModal.classList.remove('active');
}

// --- Instance Card Rendering ---
function getStatusLabel(status) {
  const map = {
    open: 'Conectado',
    connecting: 'Conectando',
    close: 'Desconectado',
  };
  return map[status] || status || 'Desconectado';
}

function getStatusClass(status) {
  if (status === 'open') return 'open';
  if (status === 'connecting') return 'connecting';
  return 'close';
}

function createInstanceCard(instance) {
  const card = document.createElement('div');
  const connectionStatus = instance.status?.connection || 'close';
  const statusClass = getStatusClass(connectionStatus);
  card.className = `instance-card ${statusClass === 'open' ? 'connected' : ''}`;
  card.dataset.instanceId = instance.instanceId;

  const isConnected = connectionStatus === 'open';
  const isConnecting = connectionStatus === 'connecting';

  let qrSection = '';

  if (isConnected) {
    // Connected — show success state
    qrSection = `
      <div class="card-connected-status">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>WhatsApp Conectado</span>
      </div>`;
  } else if (isConnecting) {
    // Connecting — show spinner, will load QR
    qrSection = `
      <div class="card-qr">
        <div class="qr-loading">
          <div class="spinner"></div>
          <span>Aguardando QR Code...</span>
        </div>
      </div>`;
  } else {
    // Disconnected — show reconnect hint
    qrSection = `
      <div class="card-qr">
        <div class="qr-loading">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="opacity:0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span>Desconectado</span>
        </div>
      </div>`;
  }

  // Actions
  let actions = '';
  if (isConnected) {
    actions = `
      <button class="btn-danger" onclick="disconnectInstance('${instance.instanceId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Desconectar
      </button>`;
  } else {
    actions = `
      <button class="btn-action" onclick="reconnectInstanceAction('${instance.instanceId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Reconectar
      </button>
      <button class="btn-danger" onclick="deleteInstanceAction('${instance.instanceId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Deletar
      </button>`;
  }

  card.innerHTML = `
    <div class="card-header">
      <span class="card-id">${instance.instanceId}</span>
      <span class="status-badge ${statusClass}">
        <span class="status-dot"></span>
        ${getStatusLabel(connectionStatus)}
      </span>
    </div>
    ${qrSection}
    <div class="card-actions">
      ${actions}
    </div>
  `;

  return card;
}

// --- Render All Instances ---
function renderInstances() {
  elements.instancesGrid.innerHTML = '';

  if (instances.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.instanceCount.textContent = '0 instâncias';
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.instanceCount.textContent = `${instances.length} instância${instances.length > 1 ? 's' : ''}`;

  instances.forEach(instance => {
    const card = createInstanceCard(instance);
    elements.instancesGrid.appendChild(card);
  });

  // Start QR polling for connecting instances
  instances.forEach(instance => {
    const status = instance.status?.connection;
    if (status === 'connecting' && !qrPollingIntervals[instance.instanceId]) {
      startQRPolling(instance.instanceId);
    }
    if (status === 'open' || status === 'close') {
      stopQRPolling(instance.instanceId);
    }
  });
}

// --- QR Code Polling ---
function startQRPolling(instanceId) {
  if (qrPollingIntervals[instanceId]) return;

  const pollQR = async () => {
    try {
      const data = await apiRequest('GET', `/instance/qr/${instanceId}`);
      if (data.qr) {
        const card = document.querySelector(`.instance-card[data-instance-id="${instanceId}"]`);
        if (card) {
          const qrContainer = card.querySelector('.card-qr');
          if (qrContainer) {
            qrContainer.innerHTML = `<img src="${data.qr}" alt="QR Code para ${instanceId}">`;
          }
        }
      }
    } catch (err) {
      // QR not ready yet, ignore
    }
  };

  pollQR(); // Immediate first try
  qrPollingIntervals[instanceId] = setInterval(pollQR, 15000); // Poll every 15s for new QR
}

function stopQRPolling(instanceId) {
  if (qrPollingIntervals[instanceId]) {
    clearInterval(qrPollingIntervals[instanceId]);
    delete qrPollingIntervals[instanceId];
  }
}

// --- Fetch Instances ---
async function fetchInstances() {
  try {
    const data = await apiRequest('GET', '/instances');
    instances = Array.isArray(data) ? data : [];
    renderInstances();
  } catch (err) {
    // Silent fail on polling — avoid spamming toasts
    console.error('Fetch error:', err.message);
  }
}

// --- Create Instance ---
async function handleCreateInstance() {
  const instanceId = elements.instanceIdInput.value.trim();

  if (!instanceId) {
    showToast('Insira um ID para a instância.', 'error');
    elements.instanceIdInput.focus();
    return;
  }

  elements.confirmCreate.disabled = true;
  elements.confirmCreate.textContent = 'Criando...';

  try {
    await apiRequest('POST', '/instance/create', { instanceId });
    showToast(`Instância "${instanceId}" criada com sucesso!`, 'success');
    closeModal();
    // Fetch immediately to show the new instance
    await fetchInstances();
  } catch (err) {
    showToast(`Erro ao criar instância: ${err.message}`, 'error');
  } finally {
    elements.confirmCreate.disabled = false;
    elements.confirmCreate.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Criar Instância`;
  }
}

// --- Reconnect Instance ---
async function reconnectInstanceAction(instanceId) {
  try {
    showToast(`Reconectando "${instanceId}"...`, 'info');
    await apiRequest('POST', `/instance/reconnect/${instanceId}`);
    showToast(`Reconexão de "${instanceId}" iniciada!`, 'success');
    await fetchInstances();
  } catch (err) {
    showToast(`Erro ao reconectar: ${err.message}`, 'error');
  }
}

// --- Disconnect Instance (without deleting session) ---
async function disconnectInstance(instanceId) {
  if (!confirm(`Deseja desconectar a instância "${instanceId}"?\nA sessão será mantida para reconexão futura.`)) {
    return;
  }

  try {
    showToast(`Desconectando "${instanceId}"...`, 'info');
    await apiRequest('POST', `/instance/disconnect/${instanceId}`);
    showToast(`"${instanceId}" desconectado com sucesso.`, 'success');
    await fetchInstances();
  } catch (err) {
    showToast(`Erro ao desconectar: ${err.message}`, 'error');
  }
}

// --- Delete Instance ---
async function deleteInstanceAction(instanceId) {
  if (!confirm(`Tem certeza que deseja DELETAR a instância "${instanceId}"?\nIsso irá remover a sessão permanentemente.`)) {
    return;
  }

  try {
    showToast(`Deletando "${instanceId}"...`, 'info');
    await apiRequest('DELETE', `/instance/delete/${instanceId}`);
    showToast(`"${instanceId}" deletado com sucesso.`, 'success');
    stopQRPolling(instanceId);
    await fetchInstances();
  } catch (err) {
    showToast(`Erro ao deletar: ${err.message}`, 'error');
  }
}

// --- API Key visibility toggle ---
function toggleApiKeyVisibility() {
  const input = elements.apiKeyInput;
  input.type = input.type === 'password' ? 'text' : 'password';
}

// --- Start polling ---
function startPolling() {
  fetchInstances();
  pollingInterval = setInterval(fetchInstances, 5000);
}

// --- Persist API Key in localStorage ---
function loadApiKey() {
  const saved = localStorage.getItem('baileys_api_key');
  if (saved) {
    elements.apiKeyInput.value = saved;
  }
}

function saveApiKey() {
  const key = getApiKey();
  if (key) {
    localStorage.setItem('baileys_api_key', key);
  } else {
    localStorage.removeItem('baileys_api_key');
  }
}

// --- Event Listeners ---
elements.createInstanceBtn.addEventListener('click', openModal);
elements.closeModal.addEventListener('click', closeModal);
elements.cancelCreate.addEventListener('click', closeModal);
elements.confirmCreate.addEventListener('click', handleCreateInstance);
elements.refreshBtn.addEventListener('click', () => {
  elements.refreshBtn.style.transform = 'rotate(360deg)';
  setTimeout(() => elements.refreshBtn.style.transform = '', 500);
  fetchInstances();
});
elements.toggleKeyVisibility.addEventListener('click', toggleApiKeyVisibility);
elements.apiKeyInput.addEventListener('change', saveApiKey);

elements.instanceIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleCreateInstance();
});

elements.createModal.addEventListener('click', (e) => {
  if (e.target === elements.createModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// --- Make functions global for inline event handlers ---
window.reconnectInstanceAction = reconnectInstanceAction;
window.disconnectInstance = disconnectInstance;
window.deleteInstanceAction = deleteInstanceAction;

// --- Init ---
loadApiKey();
startPolling();
