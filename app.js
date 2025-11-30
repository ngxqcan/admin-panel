// Configuration
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbzl45r61HF5gXPJxXl5aDB6miEBK7ZQ4z7IGH0g6sHPKv7LNFMErW7JJV2J5iNLh02J1g/exec',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 15000
};

let allKeys = [];
let requestId = 0;
let isOnline = true;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Panel initialized');
    initApp();
});

// Khởi tạo ứng dụng - Skip test, load data trực tiếp
async function initApp() {
    console.log('🚀 Admin Panel Ready!');
    showAlert('🔍 Loading data...', 'info');
    
    // Đợi một chút để đảm bảo DOM ready
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Load data trực tiếp thay vì test trước
    try {
        await loadKeysData();
        // Nếu load thành công, set online
        isOnline = true;
        updateConnectionStatus();
    } catch (error) {
        console.log('⚠️ Load failed, using offline mode');
        showAlert('⚠️ Cannot connect to API. Using demo data.', 'warning');
        await loadMockData();
        isOnline = false;
        updateConnectionStatus();
    }
}

// Tab switching
function switchTab(tabName) {
    // Ẩn tất cả tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Xóa active class từ tất cả tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Hiển thị tab được chọn
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
}

// JSONP Request function - Fixed to ignore spurious errors
function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
        requestId++;
        const callbackName = 'jsonpCallback_' + requestId + '_' + Date.now();
        let timeoutId;
        let scriptElement;
        let isResolved = false;
        let callbackReceived = false;
        
        // Tạo callback function
        window[callbackName] = function(data) {
            if (isResolved) return;
            
            callbackReceived = true;
            isResolved = true;
            
            console.log('✅ JSONP callback received:', data);
            if (timeoutId) clearTimeout(timeoutId);
            
            // Resolve ngay lập tức
            resolve(data);
            
            // Cleanup sau
            setTimeout(() => cleanup(), 200);
        };

        // Cleanup function
        function cleanup() {
            try {
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (scriptElement && scriptElement.parentNode) {
                    scriptElement.parentNode.removeChild(scriptElement);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        // Tạo script tag
        scriptElement = document.createElement('script');
        scriptElement.type = 'text/javascript';
        scriptElement.async = true;
        
        // Xử lý URL
        const separator = url.includes('?') ? '&' : '?';
        scriptElement.src = url + separator + 'callback=' + callbackName;
        
        console.log('🔧 JSONP Request URL:', scriptElement.src);
        
        // Xử lý lỗi - CHỈ reject nếu callback chưa nhận được
        scriptElement.onerror = function(error) {
            // Nếu callback đã nhận rồi, ignore error này
            if (callbackReceived || isResolved) {
                console.log('ℹ️ Script error ignored (callback already received)');
                return;
            }
            
            isResolved = true;
            console.error('❌ Script load error (no callback received)');
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error('JSONP request failed - script load error'));
            cleanup();
        };
        
        // Append script vào head
        try {
            document.head.appendChild(scriptElement);
        } catch (e) {
            console.error('❌ Failed to append script:', e);
            reject(new Error('Failed to create JSONP request'));
            cleanup();
            return;
        }
        
        // Timeout after 20 seconds
        timeoutId = setTimeout(() => {
            if (isResolved || callbackReceived) return;
            
            isResolved = true;
            console.error('❌ Request timeout - no callback received');
            reject(new Error('Request timeout after 20 seconds'));
            cleanup();
        }, 20000);
    });
}

// Retry mechanism với exponential backoff
async function apiCallWithRetry(endpoint, params = {}, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await apiCall(endpoint, params);
        } catch (error) {
            if (attempt === retries) throw error;
            
            console.log(`Retry attempt ${attempt}/${retries} for ${endpoint}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
    }
}

// Universal API call function - Fixed for CORS
async function apiCall(endpoint, params = {}) {
    // Build URL - Format: BASE_URL/endpoint?params
    let url = `${CONFIG.API_URL}/${endpoint}`;
    
    // Thêm parameters
    const queryParams = [];
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            queryParams.push(`${key}=${encodeURIComponent(params[key])}`);
        }
    });
    
    // Nếu có params, thêm vào URL
    if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
    }
    
    console.log('🔧 API Call:', endpoint);
    console.log('🔧 Full URL:', url);
    
    try {
        // CHỈ SỬ DỤNG JSONP - vì Google Apps Script CORS chỉ hoạt động với JSONP
        console.log('Using JSONP request...');
        const data = await jsonpRequest(url);
        
        console.log('✅ JSONP Success:', data);
        
        // Cập nhật trạng thái online
        if (!isOnline) {
            isOnline = true;
            updateConnectionStatus();
            showAlert('🌐 Connected to API', 'success');
        }
        
        return data;
        
    } catch (jsonpError) {
        console.error('❌ JSONP failed:', jsonpError);
        
        // Chuyển sang offline mode
        isOnline = false;
        updateConnectionStatus();
        throw new Error('Connection failed: ' + jsonpError.message);
    }
}

// Load keys data
async function loadKeysData() {
    showAlert('📥 Loading keys data...', 'info');
    
    try {
        const result = await apiCallWithRetry('getkeys');
        
        if (result.success) {
            allKeys = result.keys || [];
            renderKeysTable(allKeys);
            updateStats();
            showAlert(`✅ Loaded ${allKeys.length} keys successfully!`, 'success');
        } else {
            throw new Error(result.message || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ Load error:', error);
        showAlert('⚠️ ' + error.message, 'warning');
        await loadMockData();
    }
}

// Mock data for fallback
async function loadMockData() {
    showAlert('🔄 Loading demo data...', 'info');
    
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 30);
    
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - 10);
    
    const mockKeys = [
        {
            key: 'DEMO-VIP-2024',
            expire_date: formatDateISO(futureDate),
            status: 'active',
            hwid: 'DEMO-PC-001',
            notes: 'Demo premium user',
            created_date: formatDateISO(today),
            days_remaining: 30
        },
        {
            key: 'DEMO-TEST-001',
            expire_date: formatDateISO(futureDate),
            status: 'active', 
            hwid: '',
            notes: 'Demo testing account',
            created_date: formatDateISO(today),
            days_remaining: 30
        },
        {
            key: 'DEMO-BANNED-002',
            expire_date: formatDateISO(futureDate),
            status: 'banned',
            hwid: 'BANNED-HWID-456',
            notes: 'Demo banned account',
            created_date: formatDateISO(pastDate),
            days_remaining: 0
        },
        {
            key: 'DEMO-EXPIRED-003',
            expire_date: formatDateISO(pastDate),
            status: 'expired',
            hwid: 'EXPIRED-HWID-789',
            notes: 'Demo expired account',
            created_date: formatDateISO(pastDate),
            days_remaining: 0
        }
    ];
    
    allKeys = mockKeys;
    renderKeysTable(allKeys);
    updateStats();
    showAlert('📋 Demo data loaded (Offline Mode)', 'warning');
}

// Render keys table
function renderKeysTable(keys) {
    const tbody = document.getElementById('keysTable');
    
    if (!keys || keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No keys found</td></tr>';
        return;
    }

    tbody.innerHTML = keys.map(key => {
        const isExpired = key.is_expired || new Date(key.expire_date) < new Date();
        const statusClass = key.status === 'banned' ? 'banned' : 
                           isExpired ? 'expired' : 'active';
        const statusText = key.status === 'banned' ? 'BANNED' : 
                          isExpired ? 'EXPIRED' : 'ACTIVE';
        
        return `
        <tr class="${statusClass}">
            <td><strong>${escapeHtml(key.key)}</strong></td>
            <td>${formatDate(key.expire_date)}</td>
            <td>
                <span class="status-badge status-${statusClass}">${statusText}</span>
            </td>
            <td>${escapeHtml(key.hwid) || '<em style="color: #999;">Not activated</em>'}</td>
            <td>${escapeHtml(key.notes) || ''}</td>
            <td>${key.days_remaining !== undefined ? key.days_remaining : calculateDaysRemaining(key.expire_date)} days</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-danger" 
                            onclick="banKey('${escapeHtml(key.key)}')" 
                            ${key.status === 'banned' ? 'disabled' : ''}
                            title="${key.status === 'banned' ? 'Already banned' : 'Ban this key'}">
                        ${key.status === 'banned' ? '🚫 BANNED' : '🚫 BAN'}
                    </button>
                    <button class="btn btn-update" 
                            onclick="showUpdateModal('${escapeHtml(key.key)}')" 
                            title="Update key info">
                        ✏️ UPDATE
                    </button>
                    <button class="btn btn-delete" 
                            onclick="deleteKey('${escapeHtml(key.key)}')" 
                            title="Delete permanently">
                        🗑️ DELETE
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

// Calculate days remaining
function calculateDaysRemaining(expireDate) {
    try {
        const expire = new Date(expireDate);
        const today = new Date();
        const diff = expire - today;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    } catch (e) {
        return 0;
    }
}

// Update statistics
function updateStats() {
    if (!allKeys.length) {
        setStatValue('totalKeys', 0);
        setStatValue('activeKeys', 0);
        setStatValue('bannedUsers', 0);
        setStatValue('expiredKeys', 0);
        setStatValue('totalUsers', 0);
        setStatValue('activeUsers', 0);
        updateProgressBars(0, 0, 0);
        return;
    }
    
    const totalKeys = allKeys.length;
    const activeKeys = allKeys.filter(k => {
        const isExpired = new Date(k.expire_date) < new Date();
        return k.status === 'active' && !isExpired;
    }).length;
    const bannedKeys = allKeys.filter(k => k.status === 'banned').length;
    const expiredKeys = allKeys.filter(k => {
        return new Date(k.expire_date) < new Date() || k.status === 'expired';
    }).length;

    setStatValue('totalKeys', totalKeys);
    setStatValue('activeKeys', activeKeys);
    setStatValue('bannedUsers', bannedKeys);
    setStatValue('expiredKeys', expiredKeys);
    setStatValue('totalUsers', totalKeys);
    setStatValue('activeUsers', activeKeys);
    
    // Update progress bars
    updateProgressBars(activeKeys, bannedKeys, expiredKeys);
}

function setStatValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

// Update progress bars for analytics
function updateProgressBars(active, banned, expired) {
    const total = allKeys.length || 1; // Avoid division by zero
    
    const activePercent = Math.round((active / total) * 100);
    const bannedPercent = Math.round((banned / total) * 100);
    const expiredPercent = Math.round((expired / total) * 100);
    
    // Update progress bars
    const activeProgress = document.getElementById('activeProgress');
    const bannedProgress = document.getElementById('bannedProgress');
    const expiredProgress = document.getElementById('expiredProgress');
    
    if (activeProgress) activeProgress.style.width = activePercent + '%';
    if (bannedProgress) bannedProgress.style.width = bannedPercent + '%';
    if (expiredProgress) expiredProgress.style.width = expiredPercent + '%';
    
    // Update percentages
    setStatValue('activePercentage', activePercent + '%');
    setStatValue('bannedPercentage', bannedPercent + '%');
    setStatValue('expiredPercentage', expiredPercent + '%');
}

// Ban key
async function banKey(key) {
    if (!confirm(`🚫 Ban key: ${key}?\n\nThis will prevent the key from being used.`)) {
        return;
    }

    showAlert('⏳ Banning key...', 'info');

    try {
        const result = await apiCallWithRetry('ban', { key: key });
        
        if (result.success) {
            showAlert(`✅ ${result.message}`, 'success');
            // Update local data
            const keyObj = allKeys.find(k => k.key === key);
            if (keyObj) {
                keyObj.status = 'banned';
                renderKeysTable(allKeys);
                updateStats();
            }
        } else {
            throw new Error(result.message || 'Ban failed');
        }
    } catch (error) {
        console.error('❌ Ban error:', error);
        showAlert('❌ Error: ' + error.message, 'error');
    }
}

// Delete key
async function deleteKey(key) {
    if (!confirm(`🗑️ DELETE key: ${key}?\n\n⚠️ This action cannot be undone!`)) {
        return;
    }

    showAlert('⏳ Deleting key...', 'info');

    try {
        const result = await apiCallWithRetry('deletekey', { key: key });
        
        if (result.success) {
            showAlert(`✅ ${result.message}`, 'success');
            // Remove from local data
            allKeys = allKeys.filter(k => k.key !== key);
            renderKeysTable(allKeys);
            updateStats();
        } else {
            throw new Error(result.message || 'Delete failed');
        }
    } catch (error) {
        console.error('❌ Delete error:', error);
        showAlert('❌ Error: ' + error.message, 'error');
    }
}

// Filter keys
function filterKeys() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderKeysTable(allKeys);
        return;
    }

    const filteredKeys = allKeys.filter(key => 
        key.key.toLowerCase().includes(searchTerm) ||
        (key.hwid && key.hwid.toLowerCase().includes(searchTerm)) ||
        (key.notes && key.notes.toLowerCase().includes(searchTerm)) ||
        key.status.toLowerCase().includes(searchTerm)
    );
    
    renderKeysTable(filteredKeys);
    
    // Hiển thị kết quả tìm kiếm
    showAlert(filteredKeys.length === allKeys.length ? 
        `Showing all ${allKeys.length} keys` : 
        `Found ${filteredKeys.length} of ${allKeys.length} keys`, 
        'info');
}

// Add new key modal
function showAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'block';
    document.getElementById('newKey').focus();
}

function hideAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'none';
    document.getElementById('addKeyForm').reset();
}

// Update key modal
function showUpdateModal(key) {
    const keyObj = allKeys.find(k => k.key === key);
    if (!keyObj) return;
    
    document.getElementById('updateKey').value = key;
    document.getElementById('updateExpireDays').value = keyObj.days_remaining || 30;
    document.getElementById('updateNotes').value = keyObj.notes || '';
    document.getElementById('updateKeyModal').style.display = 'block';
}

function hideUpdateModal() {
    document.getElementById('updateKeyModal').style.display = 'none';
    document.getElementById('updateKeyForm').reset();
}

// Add new key
async function addNewKey(event) {
    if (event) event.preventDefault();
    
    const newKey = document.getElementById('newKey').value.trim();
    const expireDays = parseInt(document.getElementById('expireDays').value);
    const notes = document.getElementById('keyNotes').value.trim();

    // Validation
    if (!newKey) {
        showAlert('❌ Please enter a key', 'error');
        return;
    }

    if (!expireDays || expireDays < 1 || expireDays > 3650) {
        showAlert('❌ Expire days must be between 1 and 3650', 'error');
        return;
    }

    // Check for duplicate key
    if (allKeys.some(k => k.key === newKey)) {
        showAlert('❌ Key already exists', 'error');
        return;
    }

    showAlert('⏳ Adding new key...', 'info');

    try {
        const result = await apiCallWithRetry('addkey', {
            key: newKey,
            expire_days: expireDays,
            notes: notes
        });
        
        if (result.success) {
            showAlert('✅ ' + result.message, 'success');
            
            // Reload data để đảm bảo đồng bộ
            await loadKeysData();
            hideAddKeyModal();
            
        } else {
            throw new Error(result.message || 'Add key failed');
        }
    } catch (error) {
        console.error('❌ Add key error:', error);
        showAlert('❌ Failed to add key: ' + error.message, 'error');
    }
}

// Update key
async function updateKey(event) {
    if (event) event.preventDefault();
    
    const key = document.getElementById('updateKey').value.trim();
    const expireDays = parseInt(document.getElementById('updateExpireDays').value);
    const notes = document.getElementById('updateNotes').value.trim();

    if (!key || !expireDays) {
        showAlert('❌ Please fill all required fields', 'error');
        return;
    }

    showAlert('⏳ Updating key...', 'info');

    try {
        const result = await apiCallWithRetry('updatekey', {
            key: key,
            expire_days: expireDays,
            notes: notes
        });
        
        if (result.success) {
            showAlert('✅ ' + result.message, 'success');
            await loadKeysData();
            hideUpdateModal();
        } else {
            throw new Error(result.message || 'Update failed');
        }
    } catch (error) {
        console.error('❌ Update error:', error);
        showAlert('❌ Failed to update key: ' + error.message, 'error');
    }
}

// Refresh data
async function refreshData() {
    showAlert('🔄 Refreshing data...', 'info');
    await loadKeysData();
}

// Update connection status
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    if (isOnline) {
        statusElement.innerHTML = '🟢 ONLINE';
        statusElement.className = 'status-online';
    } else {
        statusElement.innerHTML = '🔴 OFFLINE';
        statusElement.className = 'status-offline';
    }
}

// Test API connection - Enhanced with better error handling
async function testConnection() {
    console.log('🔍 Testing connection to API...');
    console.log('API URL:', CONFIG.API_URL);
    
    try {
        // Test với endpoint 'test'
        const result = await apiCall('test', {});
        console.log('✅ Test result:', result);
        
        if (result && result.success) {
            console.log('✅ Connection successful!');
            return true;
        } else {
            console.log('⚠️ API responded but success=false:', result);
            // Thử getkeys nếu test không thành công
            try {
                const result2 = await apiCall('getkeys', {});
                return result2 && result2.success;
            } catch (e) {
                return false;
            }
        }
    } catch (error) {
        console.error('🔴 Connection test failed:', error);
        return false;
    }
}

// Utility functions
function formatDate(dateString) {
    try {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    } catch (e) {
        return dateString;
    }
}

function formatDateISO(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showAlert(message, type) {
    const alert = document.getElementById('alert');
    if (!alert) {
        console.log(`Alert: [${type}] ${message}`);
        return;
    }
    
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    alert.style.display = 'block';
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => {
            alert.style.display = 'none';
        }, 300);
    }, 4000);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Event listeners
document.getElementById('addKeyModal')?.addEventListener('click', function(e) {
    if (e.target === this) hideAddKeyModal();
});

document.getElementById('updateKeyModal')?.addEventListener('click', function(e) {
    if (e.target === this) hideUpdateModal();
});

document.getElementById('addKeyForm')?.addEventListener('submit', addNewKey);
document.getElementById('updateKeyForm')?.addEventListener('submit', updateKey);

// Search with debounce
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterKeys, 300);
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // ESC to close modals
    if (e.key === 'Escape') {
        hideAddKeyModal();
        hideUpdateModal();
    }
    
    // Ctrl/Cmd + K to add key
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        showAddKeyModal();
    }
    
    // Ctrl/Cmd + R to refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshData();
    }
});

// Online/offline detection
window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionStatus();
    showAlert('🌐 Connection restored', 'success');
    loadKeysData();
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateConnectionStatus();
    showAlert('⚠️ You are offline', 'warning');
});

console.log('🚀 Admin Panel Ready!');
