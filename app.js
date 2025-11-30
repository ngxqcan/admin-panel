// Configuration
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwI3sKcP-Fy8xw0tTpP7Jv8WZhEs7mEYXPcZQac72Y43a-hoE_qCbgaqcQQ4bGDqArp9w/exec',
    SECRET_KEY: '271006',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

let allKeys = [];
let requestId = 0;
let isOnline = true;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Panel initialized - Optimized for Hosting');
    initApp();
});

// Khởi tạo ứng dụng
async function initApp() {
    showAlert('🔍 Checking connection...', 'info');
    
    // Test connection trước
    const connected = await testConnection();
    
    if (connected) {
        showAlert('✅ Connected to Google Sheets API', 'success');
        await loadKeysData();
    } else {
        showAlert('⚠️ Using offline mode with mock data', 'warning');
        await loadMockData();
    }
    
    updateConnectionStatus();
}

// Tab switching - optimized
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

// JSONP Request function - Optimized
function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
        requestId++;
        const callbackName = 'jsonpCallback_' + requestId;
        let timeoutId;
        
        // Tạo callback function
        window[callbackName] = function(data) {
            if (timeoutId) clearTimeout(timeoutId);
            resolve(data);
            cleanup();
        };

        // Cleanup function
        function cleanup() {
            delete window[callbackName];
            const script = document.getElementById('jsonpScript_' + callbackName);
            if (script) script.remove();
        }

        // Tạo script tag
        const script = document.createElement('script');
        script.id = 'jsonpScript_' + callbackName;
        script.src = url + '&callback=' + callbackName + '&t=' + Date.now();
        
        script.onerror = () => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error('JSONP request failed'));
            cleanup();
        };
        
        document.head.appendChild(script);
        
        // Timeout after 15 seconds
        timeoutId = setTimeout(() => {
            if (window[callbackName]) {
                reject(new Error('Request timeout'));
                cleanup();
            }
        }, 15000);
    });
}

// Retry mechanism với exponential backoff
async function apiCallWithRetry(endpoint, params = {}, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await apiCall(endpoint, params);
        } catch (error) {
            if (attempt === retries) throw error;
            
            console.log(`Retry attempt ${attempt} for ${endpoint}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
    }
}

// Universal API call function - Optimized
async function apiCall(endpoint, params = {}) {
    // Build URL với secret key và cache buster
    let url = `${CONFIG.API_URL}/${endpoint}?secret=${CONFIG.SECRET_KEY}&_=${Date.now()}`;
    
    // Thêm các parameters khác
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        }
    });
    
    console.log('🔧 API Call:', endpoint, params);
    
    try {
        // Ưu tiên JSONP cho cross-origin
        const data = await jsonpRequest(url);
        
        // Cập nhật trạng thái online
        if (!isOnline) {
            isOnline = true;
            updateConnectionStatus();
        }
        
        return data;
    } catch (error) {
        console.error('❌ API Call failed:', error);
        
        // Fallback to fetch (chỉ trên cùng origin)
        if (window.location.protocol === 'https:') {
            try {
                const response = await fetch(url, { 
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                
                if (!isOnline) {
                    isOnline = true;
                    updateConnectionStatus();
                }
                
                return data;
            } catch (fetchError) {
                console.error('❌ Fetch also failed:', fetchError);
            }
        }
        
        // Chuyển sang offline mode
        isOnline = false;
        updateConnectionStatus();
        throw new Error('Connection failed - Using offline mode');
    }
}

// Load keys data - Optimized
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

// Mock data for fallback - Enhanced
async function loadMockData() {
    showAlert('🔄 Loading demo data...', 'info');
    
    // Tạo mock data thực tế hơn
    const mockKeys = [
        {
            key: 'VIP-KEY-2024',
            expire_date: '2025-12-31',
            status: 'active',
            hwid: 'USER-PC-001',
            notes: 'Premium user',
            created_date: '2024-01-15'
        },
        {
            key: 'TEST-KEY-001',
            expire_date: '2024-06-30',
            status: 'active', 
            hwid: 'TEST-HWID',
            notes: 'Testing account',
            created_date: '2024-01-10'
        },
        {
            key: 'BANNED-KEY-002',
            expire_date: '2024-12-31',
            status: 'banned',
            hwid: 'HWID-456789',
            notes: 'Violation of terms',
            created_date: '2024-01-05'
        }
    ];
    
    allKeys = mockKeys;
    renderKeysTable(allKeys);
    updateStats();
    showAlert('📋 Demo data loaded (Offline Mode)', 'warning');
}

// Render keys table - Optimized
function renderKeysTable(keys) {
    const tbody = document.getElementById('keysTable');
    
    if (!keys || keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No keys found</td></tr>';
        return;
    }

    tbody.innerHTML = keys.map(key => `
        <tr>
            <td><strong>${escapeHtml(key.key)}</strong></td>
            <td>${formatDate(key.expire_date)}</td>
            <td>
                <span class="status-${key.status}">${key.status.toUpperCase()}</span>
            </td>
            <td>${escapeHtml(key.hwid) || '<em>Not set</em>'}</td>
            <td>${escapeHtml(key.notes) || ''}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-danger" onclick="banKey('${escapeHtml(key.key)}')" 
                            ${key.status === 'banned' ? 'disabled' : ''}
                            title="Ban this key">
                        ${key.status === 'banned' ? 'BANNED' : 'BAN'}
                    </button>
                    <button class="btn btn-delete" onclick="deleteKey('${escapeHtml(key.key)}')" 
                            title="Delete this key permanently">
                        DELETE
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Update statistics - Optimized
function updateStats() {
    if (!allKeys.length) return;
    
    const totalKeys = allKeys.length;
    const activeKeys = allKeys.filter(k => k.status === 'active').length;
    const bannedKeys = allKeys.filter(k => k.status === 'banned').length;
    const expiredKeys = allKeys.filter(k => new Date(k.expire_date) < new Date()).length;
    const activeUsers = Math.max(0, activeKeys - expiredKeys);

    // Cập nhật DOM một lần
    const stats = {
        'totalKeys': totalKeys,
        'activeKeys': activeKeys,
        'totalUsers': totalKeys,
        'bannedUsers': bannedKeys,
        'expiredKeys': expiredKeys,
        'activeUsers': activeUsers
    };

    Object.keys(stats).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = stats[id];
        }
    });
}

// Ban key - Optimized
async function banKey(key) {
    if (!confirm(`🚫 Ban key: ${key}?\nThis will prevent the key from being used.`)) {
        return;
    }

    showAlert('⏳ Banning key...', 'info');

    try {
        const result = await apiCallWithRetry('ban', { key: key });
        
        if (result.success) {
            showAlert(`✅ Successfully banned key: ${key}`, 'success');
            // Update local data
            const keyIndex = allKeys.findIndex(k => k.key === key);
            if (keyIndex !== -1) {
                allKeys[keyIndex].status = 'banned';
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

// Delete key - Optimized
async function deleteKey(key) {
    if (!confirm(`🗑️ DELETE key: ${key}?\n⚠️ This action cannot be undone!`)) {
        return;
    }

    showAlert('⏳ Deleting key...', 'info');

    try {
        const result = await apiCallWithRetry('deletekey', { key: key });
        
        if (result.success) {
            showAlert(`✅ Successfully deleted key: ${key}`, 'success');
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

// Filter keys - Optimized
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
    const searchInfo = document.getElementById('searchInfo');
    if (searchInfo) {
        searchInfo.textContent = filteredKeys.length === allKeys.length ? 
            '' : `Found ${filteredKeys.length} keys`;
    }
}

// Add new key modal
function showAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'block';
    document.getElementById('newKey').focus();
}

function hideAddKeyModal() {
    document.getElementById('addKeyModal').style.display = 'none';
    // Reset form
    document.getElementById('addKeyForm').reset();
}

// Add new key - Optimized
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
        showAlert('❌ Please enter valid expire days (1-3650)', 'error');
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
            // Thêm key mới vào danh sách
            allKeys.push({
                key: newKey,
                expire_date: result.expire_date,
                status: 'active',
                hwid: '',
                notes: notes,
                created_date: new Date().toISOString().split('T')[0]
            });
            
            renderKeysTable(allKeys);
            updateStats();
            hideAddKeyModal();
            showAlert('✅ Key added successfully!', 'success');
            
        } else {
            throw new Error(result.message || 'Add key failed');
        }
    } catch (error) {
        console.error('❌ Add key error:', error);
        showAlert('❌ Failed to add key: ' + error.message, 'error');
    }
}

// Refresh data - Optimized
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

// Test API connection - Enhanced
async function testConnection() {
    try {
        const result = await apiCall('getkeys');
        return result && result.success;
    } catch (error) {
        console.log('🔴 Connection test failed:', error.message);
        return false;
    }
}

// Utility functions - Optimized
function formatDate(dateString) {
    try {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
    } catch (e) {
        return dateString;
    }
}

function showAlert(message, type) {
    const alert = document.getElementById('alert');
    if (!alert) return;
    
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

// Event listeners - Optimized
document.getElementById('addKeyModal')?.addEventListener('click', function(e) {
    if (e.target === this) hideAddKeyModal();
});

document.getElementById('addKeyForm')?.addEventListener('submit', addNewKey);

// Search with debounce
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterKeys, 300);
});

// Online/offline detection
window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionStatus();
    showAlert('🌐 Connection restored', 'success');
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateConnectionStatus();
    showAlert('⚠️ You are offline', 'warning');
});

console.log('🚀 Optimized Admin Panel Ready for Hosting!');