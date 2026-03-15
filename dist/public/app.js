// ===== Baileys Manager Frontend =====

const API_BASE = '/api';

// --- State ---
let instances = [];
let currentInstanceId = null;
let currentView = 'list'; // 'list' or 'detail'
let pollingInterval = null;
let qrPollingInterval = null;

// --- DOM Elements ---
const el = {
  // Views
  listView: document.getElementById('listView'),
  detailView: document.getElementById('detailView'),

  // List view
  instancesGrid: document.getElementById('instancesGrid'),
  emptyState: document.getElementById('emptyState'),
  instanceCount: document.getElementById('instanceCount'),
  createInstanceBtn: document.getElementById('createInstanceBtn'),
  refreshBtn: document.getElementById('refreshBtn'),

  // Detail view
  backToList: document.getElementById('backToList'),
  detailTitle: document.getElementById('detailTitle'),
  detailName: document.getElementById('detailName'),
  detailApiUrl: document.getElementById('detailApiUrl'),
  detailId: document.getElementById('detailId'),
  detailToken: document.getElementById('detailToken'),
  detailStatus: document.getElementById('detailStatus'),
  detailActions: document.getElementById('detailActions'),
  qrPanel: document.getElementById('qrPanel'),
  qrDisplay: document.getElementById('qrDisplay'),
  webhookNotice: document.getElementById('webhookNotice'),
  webhookUrlDisplay: document.getElementById('webhookUrlDisplay'),
  webhookUrlConfig: document.getElementById('webhookUrlConfig'),
  endpointsList: document.getElementById('endpointsList'),

  // Tabs
  tabData: document.getElementById('tabData'),
  tabWebhooks: document.getElementById('tabWebhooks'),

  // Modal
  createModal: document.getElementById('createModal'),
  instanceIdInput: document.getElementById('instanceIdInput'),
  closeModal: document.getElementById('closeModal'),
  cancelCreate: document.getElementById('cancelCreate'),
  confirmCreate: document.getElementById('confirmCreate'),

  // Other
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
  toastContainer: document.getElementById('toastContainer'),
  header: document.getElementById('header'),
};

// --- API Helpers ---
function getApiKey() {
  return el.apiKeyInput.value.trim();
}

function getBaseUrl() {
  return window.location.origin;
}

async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) headers['x-api-key'] = apiKey;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
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
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Navigation ---
function showListView() {
  currentView = 'list';
  currentInstanceId = null;
  el.listView.classList.remove('hidden');
  el.detailView.classList.add('hidden');
  stopQRPolling();
  startListPolling();
}

function showDetailView(instanceId) {
  currentView = 'detail';
  currentInstanceId = instanceId;
  el.listView.classList.add('hidden');
  el.detailView.classList.remove('hidden');
  stopListPolling();
  populateDetailView(instanceId);
  startDetailPolling(instanceId);

  // Reset to data tab
  switchTab('data');
}

// --- Tabs ---
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');

  el.tabData.classList.toggle('hidden', tabName !== 'data');
  el.tabWebhooks.classList.toggle('hidden', tabName !== 'webhooks');
}

// --- Copy ---
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const text = element.innerText || element.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado!', 'success');

    // Animate copy button
    const btn = document.querySelector(`[data-copy="${elementId}"]`);
    if (btn) {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    }
  }).catch(() => {
    showToast('Erro ao copiar', 'error');
  });
}

// --- List View ---
function renderInstances() {
  el.instancesGrid.innerHTML = '';

  if (instances.length === 0) {
    el.emptyState.classList.remove('hidden');
    el.instanceCount.textContent = '0 instâncias';
    return;
  }

  el.emptyState.classList.add('hidden');
  el.instanceCount.textContent = `${instances.length} instância${instances.length > 1 ? 's' : ''}`;

  instances.forEach(instance => {
    const card = createInstanceCard(instance);
    el.instancesGrid.appendChild(card);
  });
}

function createInstanceCard(instance) {
  const card = document.createElement('div');
  const status = instance.status?.connection || 'close';
  const statusClass = getStatusClass(status);
  card.className = `instance-card ${statusClass === 'open' ? 'connected' : ''}`;

  card.innerHTML = `
    <div class="card-header">
      <span class="card-id">${instance.instanceId}</span>
      <span class="status-badge ${statusClass}">
        <span class="status-dot"></span>
        ${getStatusLabel(status)}
      </span>
    </div>
    <span class="card-subtitle">Clique para ver detalhes da instância</span>
    <div class="card-open-hint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      Abrir detalhes
    </div>
  `;

  card.addEventListener('click', () => showDetailView(instance.instanceId));
  return card;
}

// --- Detail View ---
function populateDetailView(instanceId) {
  const instance = instances.find(i => i.instanceId === instanceId);
  const apiKey = getApiKey();
  const base = getBaseUrl();

  // Title
  el.detailTitle.textContent = `Dados da instância ${instanceId}`;
  el.detailName.textContent = instanceId;

  // API URL
  const apiUrl = `${base}/api/message/sendText/${instanceId}`;
  el.detailApiUrl.textContent = apiUrl;

  // ID & Token
  el.detailId.textContent = instanceId;
  el.detailToken.textContent = apiKey || '(insira a API Key no header)';

  // Webhook
  el.webhookUrlDisplay.textContent = 'Configurado via variável WEBHOOK_URL no servidor';

  // Webhook config tab
  el.webhookUrlConfig.textContent = 'Definido via env WEBHOOK_URL no servidor';

  // Status
  updateDetailStatus(instance);

  // QR
  updateQRPanel(instance);

  // Endpoints list
  renderEndpoints(instanceId);
}

function updateDetailStatus(instance) {
  const status = instance?.status?.connection || 'close';
  const statusClass = getStatusClass(status);

  el.detailStatus.className = `status-badge ${statusClass}`;
  el.detailStatus.innerHTML = `<span class="status-dot"></span> ${getStatusLabel(status)}`;

  // Actions
  let actionsHTML = '';
  if (status === 'open') {
    actionsHTML = `
      <button class="btn-danger" onclick="disconnectInstance('${instance.instanceId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Desconectar
      </button>`;
  } else {
    actionsHTML = `
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
  el.detailActions.innerHTML = actionsHTML;
}

function updateQRPanel(instance) {
  const status = instance?.status?.connection || 'close';

  if (status === 'open') {
    el.qrPanel.querySelector('h3').textContent = 'WhatsApp Conectado';
    el.qrPanel.querySelector('p').textContent = 'Sua instância está conectada e pronta para uso.';
    el.qrDisplay.innerHTML = `
      <div class="qr-connected">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>Conectado</span>
      </div>`;
    stopQRPolling();
  } else if (status === 'connecting') {
    el.qrPanel.querySelector('h3').textContent = 'Leia o QRCode';
    el.qrPanel.querySelector('p').textContent = 'Abra o aplicativo do WhatsApp e leia o QRCode abaixo para conectar a esta instância.';
    el.qrDisplay.innerHTML = `
      <div class="qr-loading">
        <div class="spinner"></div>
        <span>Gerando QR Code...</span>
      </div>`;
    startQRPolling(instance.instanceId);
  } else {
    el.qrPanel.querySelector('h3').textContent = 'Leia o QRCode';
    el.qrPanel.querySelector('p').textContent = 'Reconecte a instância para gerar um novo QR Code.';
    el.qrDisplay.innerHTML = `
      <div class="qr-loading">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="opacity:0.3">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        <span>Desconectado</span>
      </div>`;
  }
}

function renderEndpoints(instanceId) {
  const endpoints = [
    { method: 'POST', path: `/api/instance/create` },
    { method: 'GET', path: `/api/instance/status/${instanceId}` },
    { method: 'GET', path: `/api/instance/qr/${instanceId}` },
    { method: 'POST', path: `/api/message/sendText/${instanceId}` },
    { method: 'POST', path: `/api/message/sendMedia/${instanceId}` },
    { method: 'POST', path: `/api/instance/reconnect/${instanceId}` },
    { method: 'POST', path: `/api/instance/disconnect/${instanceId}` },
    { method: 'DELETE', path: `/api/instance/delete/${instanceId}` },
  ];

  el.endpointsList.innerHTML = endpoints.map(ep => `
    <div class="endpoint-item">
      <span class="endpoint-method ${ep.method.toLowerCase()}">${ep.method}</span>
      <span class="endpoint-path">${ep.path}</span>
    </div>
  `).join('');
}

// --- QR Code Polling ---
function startQRPolling(instanceId) {
  stopQRPolling();

  const pollQR = async () => {
    try {
      const data = await apiRequest('GET', `/instance/qr/${instanceId}`);
      if (data.qr && currentInstanceId === instanceId) {
        el.qrDisplay.innerHTML = `<img src="${data.qr}" alt="QR Code para ${instanceId}">`;
      }
    } catch (err) {
      // QR not ready yet or instance changed status
    }
  };

  pollQR();
  qrPollingInterval = setInterval(pollQR, 20000);
}

function stopQRPolling() {
  if (qrPollingInterval) {
    clearInterval(qrPollingInterval);
    qrPollingInterval = null;
  }
}

// --- Polling ---
async function fetchInstances() {
  try {
    const data = await apiRequest('GET', '/instances');
    instances = Array.isArray(data) ? data : [];

    if (currentView === 'list') {
      renderInstances();
    } else if (currentView === 'detail' && currentInstanceId) {
      const instance = instances.find(i => i.instanceId === currentInstanceId);
      if (instance) {
        updateDetailStatus(instance);
        updateQRPanel(instance);
      }
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

function startListPolling() {
  stopListPolling();
  fetchInstances();
  pollingInterval = setInterval(fetchInstances, 5000);
}

function stopListPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function startDetailPolling(instanceId) {
  stopListPolling();
  pollingInterval = setInterval(fetchInstances, 5000);
}

// --- Modal ---
function openModal() {
  el.createModal.classList.add('active');
  el.instanceIdInput.value = '';
  setTimeout(() => el.instanceIdInput.focus(), 200);
}

function closeModal() {
  el.createModal.classList.remove('active');
}

// --- Actions ---
async function handleCreateInstance() {
  const instanceId = el.instanceIdInput.value.trim();
  if (!instanceId) {
    showToast('Insira um ID para a instância.', 'error');
    el.instanceIdInput.focus();
    return;
  }

  el.confirmCreate.disabled = true;
  el.confirmCreate.textContent = 'Criando...';

  try {
    await apiRequest('POST', '/instance/create', { instanceId });
    showToast(`Instância "${instanceId}" criada com sucesso!`, 'success');
    closeModal();
    await fetchInstances();
    // Automatically open the new instance detail
    showDetailView(instanceId);
  } catch (err) {
    showToast(`Erro ao criar instância: ${err.message}`, 'error');
  } finally {
    el.confirmCreate.disabled = false;
    el.confirmCreate.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Criar Instância`;
  }
}

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

async function disconnectInstance(instanceId) {
  if (!confirm(`Deseja desconectar a instância "${instanceId}"?\nA sessão será mantida para reconexão futura.`)) return;

  try {
    showToast(`Desconectando "${instanceId}"...`, 'info');
    await apiRequest('POST', `/instance/disconnect/${instanceId}`);
    showToast(`"${instanceId}" desconectado com sucesso.`, 'success');
    await fetchInstances();
  } catch (err) {
    showToast(`Erro ao desconectar: ${err.message}`, 'error');
  }
}

async function deleteInstanceAction(instanceId) {
  if (!confirm(`Tem certeza que deseja DELETAR a instância "${instanceId}"?\nIsso irá remover a sessão permanentemente.`)) return;

  try {
    showToast(`Deletando "${instanceId}"...`, 'info');
    await apiRequest('DELETE', `/instance/delete/${instanceId}`);
    showToast(`"${instanceId}" deletado com sucesso.`, 'success');
    stopQRPolling();
    showListView();
    await fetchInstances();
  } catch (err) {
    showToast(`Erro ao deletar: ${err.message}`, 'error');
  }
}

// --- Helpers ---
function getStatusLabel(status) {
  return { open: 'Conectado', connecting: 'Conectando', close: 'Desconectado' }[status] || status || 'Desconectado';
}

function getStatusClass(status) {
  if (status === 'open') return 'open';
  if (status === 'connecting') return 'connecting';
  return 'close';
}

function toggleApiKeyVisibility() {
  el.apiKeyInput.type = el.apiKeyInput.type === 'password' ? 'text' : 'password';
}

function loadApiKey() {
  const saved = localStorage.getItem('baileys_api_key');
  if (saved) el.apiKeyInput.value = saved;
}

function saveApiKey() {
  const key = getApiKey();
  key ? localStorage.setItem('baileys_api_key', key) : localStorage.removeItem('baileys_api_key');
}

// --- Event Listeners ---
el.createInstanceBtn.addEventListener('click', openModal);
el.closeModal.addEventListener('click', closeModal);
el.cancelCreate.addEventListener('click', closeModal);
el.confirmCreate.addEventListener('click', handleCreateInstance);
el.backToList.addEventListener('click', showListView);
el.toggleKeyVisibility.addEventListener('click', toggleApiKeyVisibility);
el.apiKeyInput.addEventListener('change', saveApiKey);

el.refreshBtn.addEventListener('click', () => {
  el.refreshBtn.style.transform = 'rotate(360deg)';
  setTimeout(() => el.refreshBtn.style.transform = '', 500);
  fetchInstances();
});

el.instanceIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleCreateInstance();
});

el.createModal.addEventListener('click', (e) => {
  if (e.target === el.createModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(btn.dataset.copy);
  });
});

// Global functions for inline handlers
window.reconnectInstanceAction = reconnectInstanceAction;
window.disconnectInstance = disconnectInstance;
window.deleteInstanceAction = deleteInstanceAction;

// --- Init ---
loadApiKey();
startListPolling();
