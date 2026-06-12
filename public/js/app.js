// Global State
let currentUser = null;
let currentAdmin = null;
let allTasks = [];
let allTags = [];
let filterStatus = 'all';
let currentTaskId = null;

// API Base URL
const API_BASE = '/api';

// Utility Functions
function showNotification(message, type = 'success') {
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function formatDate(dateString) {
  if (!dateString) return 'Không có';
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN');
}

function getStatusLabel(status) {
  const labels = {
    'todo': 'Chưa Làm',
    'in_progress': 'Đang Làm',
    'done': 'Đã Làm'
  };
  return labels[status] || status;
}

function getImportanceLabel(importance) {
  const labels = {
    'low': 'Thấp',
    'medium': 'Trung Bình',
    'high': 'Cao'
  };
  return labels[importance] || importance;
}

// Auth Toggle Functions
function toggleAuthForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
  registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
}

function toggleAdminLogin() {
  const loginForm = document.getElementById('loginForm').parentElement;
  const adminForm = document.getElementById('adminLoginForm');
  loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
  adminForm.style.display = adminForm.style.display === 'none' ? 'block' : 'none';
}

// User Registration
async function handleRegister(event) {
  event.preventDefault();
  
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  if (password !== passwordConfirm) {
    showNotification('Mật khẩu không khớp', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    if (response.ok) {
      showNotification('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
      document.getElementById('regUsername').value = '';
      document.getElementById('regEmail').value = '';
      document.getElementById('regPassword').value = '';
      document.getElementById('regPasswordConfirm').value = '';
      toggleAuthForm();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Đăng ký thất bại', 'error');
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

// User Login
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showNotification('Đăng nhập thành công!', 'success');
      showUserDashboard();
    } else {
      const error = await response.json();
      showNotification(error.error || 'Đăng nhập thất bại', 'error');
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

// Admin Login
async function handleAdminLogin(event) {
  event.preventDefault();

  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;

  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      currentAdmin = { email };
      showNotification('Đăng nhập quản trị thành công!', 'success');
      showAdminDashboard();
    } else {
      showNotification('Sai email hoặc mật khẩu', 'error');
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

// Logout
async function handleLogout() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    currentUser = null;
    showNotification('Đã đăng xuất', 'success');
    location.reload();
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

async function handleAdminLogout() {
  try {
    await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    currentAdmin = null;
    showNotification('Đã đăng xuất', 'success');
    location.reload();
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

// Show Dashboard
function showUserDashboard() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('userDashboard').style.display = 'flex';
  document.getElementById('userName').textContent = currentUser.username;
  loadTasks();
  loadTags();
}

function showAdminDashboard() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  loadAdminStatistics();
  loadAdminUsers();
}

// Task Management
async function loadTasks() {
  try {
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.append('status', filterStatus);
    
    const search = document.getElementById('searchInput')?.value;
    if (search) params.append('search', search);

    const sortBy = document.getElementById('sortBy')?.value;
    if (sortBy) params.append('sortBy', sortBy);

    const order = document.getElementById('sortOrder')?.value || 'asc';
    if (sortBy) params.append('order', order);

    const response = await fetch(`${API_BASE}/tasks?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        showNotification('Phiên đăng nhập hết hạn', 'error');
        location.reload();
      }
      return;
    }

    allTasks = await response.json();
    renderTasks();
    updateStats();
  } catch (error) {
    showNotification('Lỗi tải công việc: ' + error.message, 'error');
  }
}

function renderTasks() {
  const taskList = document.getElementById('taskList');
  
  if (allTasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Không có công việc</h3>
        <p>Bạn có thể tạo công việc mới để bắt đầu</p>
      </div>
    `;
    return;
  }

  taskList.innerHTML = allTasks.map(task => {
    const tags = task.tag_names ? task.tag_names.split(',').filter(Boolean) : [];
    const priorityClass = task.urgency === 'high' ? 'priority-high' : 
                         task.urgency === 'medium' ? 'priority-medium' : 'priority-low';

    return `
      <div class="task-card ${priorityClass}" onclick="viewTask(${task.task_id})">
        <div class="task-header">
          <div class="task-title ${task.status === 'done' ? 'done' : ''}">${task.title}</div>
          <span class="task-status ${task.status}">${getStatusLabel(task.status)}</span>
        </div>
        <div class="task-meta">
          ${task.deadline ? `<div class="task-deadline">📅 ${formatDate(task.deadline)}</div>` : ''}
          <div>⭐ ${getImportanceLabel(task.importance)}</div>
        </div>
        ${tags.length > 0 ? `
          <div class="task-tags">
            ${tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
          </div>
        ` : ''}
        <div class="task-actions">
          <button class="task-btn task-btn-primary" onclick="editTask(${task.task_id}); event.stopPropagation();">✏️ Sửa</button>
          <button class="task-btn task-btn-danger" onclick="deleteTask(${task.task_id}); event.stopPropagation();">🗑️ Xóa</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterTasks(status) {
  filterStatus = status;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  loadTasks();
}

function handleSearch() {
  loadTasks();
}

function handleSort() {
  loadTasks();
}

function showAddTaskModal() {
  document.getElementById('taskId').value = '';
  document.getElementById('taskModalTitle').textContent = 'Thêm Công Việc';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskContent').value = '';
  document.getElementById('taskDeadline').value = '';
  document.getElementById('taskStatus').value = 'todo';
  document.getElementById('taskImportance').value = 'medium';
  document.getElementById('taskUrgency').value = 'medium';
  renderTagCheckboxes([]);
  document.getElementById('taskModal').style.display = 'flex';
}

function closeTaskModal() {
  document.getElementById('taskModal').style.display = 'none';
}

async function handleSaveTask(event) {
  event.preventDefault();

  const taskId = document.getElementById('taskId').value;
  const title = document.getElementById('taskTitle').value;
  const content = document.getElementById('taskContent').value;
  const deadline = document.getElementById('taskDeadline').value;
  const status = document.getElementById('taskStatus').value;
  const importance = document.getElementById('taskImportance').value;
  const urgency = document.getElementById('taskUrgency').value;

  const selectedTags = Array.from(document.querySelectorAll('#tagCheckboxes input:checked'))
    .map(el => parseInt(el.value));

  const taskData = { title, content, deadline, status, importance, urgency, tags: selectedTags };

  try {
    const url = taskId ? `${API_BASE}/tasks/${taskId}` : `${API_BASE}/tasks`;
    const method = taskId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(taskData)
    });

    if (response.ok) {
      showNotification(taskId ? 'Công việc cập nhật thành công' : 'Công việc tạo thành công', 'success');
      closeTaskModal();
      loadTasks();
    } else {
      showNotification('Lỗi lưu công việc', 'error');
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

async function editTask(taskId) {
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const task = await response.json();
    
    document.getElementById('taskId').value = task.task_id;
    document.getElementById('taskModalTitle').textContent = 'Chỉnh Sửa Công Việc';
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskContent').value = task.content || '';
    document.getElementById('taskDeadline').value = task.deadline ? task.deadline.substring(0, 16) : '';
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskImportance').value = task.importance;
    document.getElementById('taskUrgency').value = task.urgency;

    const selectedTagIds = task.tag_ids ? task.tag_ids.split(',').map(Number) : [];
    renderTagCheckboxes(selectedTagIds);

    document.getElementById('taskModal').style.display = 'flex';
  } catch (error) {
    showNotification('Lỗi tải công việc: ' + error.message, 'error');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Bạn chắc chắn muốn xóa công việc này?')) return;

  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      showNotification('Công việc đã xóa', 'success');
      loadTasks();
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

function viewTask(taskId) {
  const task = allTasks.find(t => t.task_id === taskId);
  if (!task) return;

  currentTaskId = taskId;
  document.getElementById('viewTaskTitle').textContent = task.title;
  document.getElementById('viewTaskContent').textContent = task.content || 'Không có nội dung';
  document.getElementById('viewTaskDeadline').textContent = formatDate(task.deadline);
  document.getElementById('viewTaskStatus').textContent = getStatusLabel(task.status);
  document.getElementById('viewTaskImportance').textContent = getImportanceLabel(task.importance);
  document.getElementById('viewTaskUrgency').textContent = getImportanceLabel(task.urgency);

  const tags = task.tag_names ? task.tag_names.split(',').filter(Boolean) : [];
  document.getElementById('viewTaskTags').innerHTML = tags.length > 0 
    ? tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('')
    : 'Không có thẻ';

  document.getElementById('viewTaskModal').style.display = 'flex';
}

function closeViewTaskModal() {
  document.getElementById('viewTaskModal').style.display = 'none';
}

function editCurrentTask() {
  closeViewTaskModal();
  editTask(currentTaskId);
}

async function deleteCurrentTask() {
  closeViewTaskModal();
  deleteTask(currentTaskId);
}

// Tag Management
async function loadTags() {
  try {
    const response = await fetch(`${API_BASE}/tags`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    allTags = await response.json();
    renderTagList();
  } catch (error) {
    showNotification('Lỗi tải thẻ: ' + error.message, 'error');
  }
}

function renderTagList() {
  const tagList = document.getElementById('tagList');
  tagList.innerHTML = allTags.map(tag => `
    <div class="tag-item" onclick="filterByTag(${tag.tag_id})">
      <span>${tag.name}</span>
      <button class="tag-item-delete" onclick="deleteTag(${tag.tag_id}); event.stopPropagation();">×</button>
    </div>
  `).join('');
}

function renderTagCheckboxes(selectedIds = []) {
  const checkboxes = document.getElementById('tagCheckboxes');
  checkboxes.innerHTML = allTags.map(tag => `
    <div class="tag-checkbox">
      <input type="checkbox" value="${tag.tag_id}" 
             ${selectedIds.includes(tag.tag_id) ? 'checked' : ''}>
      <span>${tag.name}</span>
    </div>
  `).join('');
}

function showAddTagModal() {
  document.getElementById('tagName').value = '';
  document.getElementById('tagModal').style.display = 'flex';
}

function closeTagModal() {
  document.getElementById('tagModal').style.display = 'none';
}

async function handleAddTag(event) {
  event.preventDefault();

  const name = document.getElementById('tagName').value.trim();

  if (name.length > 20) {
    showNotification('Tên thẻ tối đa 20 ký tự', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });

    if (response.ok) {
      showNotification('Thẻ tạo thành công', 'success');
      closeTagModal();
      loadTags();
    } else {
      showNotification('Thẻ này đã tồn tại', 'error');
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

async function deleteTag(tagId) {
  if (!confirm('Xóa thẻ này?')) return;

  try {
    const response = await fetch(`${API_BASE}/tags/${tagId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      showNotification('Thẻ đã xóa', 'success');
      loadTags();
      loadTasks();
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

function filterByTag(tagId) {
  const tag = allTags.find(t => t.tag_id === tagId);
  if (tag) {
    document.getElementById('searchInput').value = `tag:${tag.name}`;
    filterStatus = 'all';
    loadTasks();
  }
}

// Statistics
function updateStats() {
  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === 'done').length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('totalTasks').textContent = total;
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('completionRate').textContent = rate + '%';
}

// Admin Functions
async function loadAdminStatistics() {
  try {
    const response = await fetch(`${API_BASE}/admin/statistics`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const stats = await response.json();

    document.getElementById('statTotalUsers').textContent = stats.totalUsers;
    document.getElementById('statTotalTasks').textContent = stats.totalTasks;
    document.getElementById('statCompletedTasks').textContent = stats.completedTasks;
    document.getElementById('statCompletionRate').textContent = stats.completionRate + '%';

    const tbody = document.getElementById('usageTableBody');
    tbody.innerHTML = (stats.usageStats || []).map(user => `
      <tr>
        <td>${user.username}</td>
        <td>${user.login_count || 0}</td>
        <td>${user.total_usage_seconds ? (user.total_usage_seconds / 3600).toFixed(2) : 0}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

async function loadAdminUsers() {
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      credentials: 'include'
    });

    if (!response.ok) return;

    const users = await response.json();

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>${formatDate(user.last_login)}</td>
        <td>${user.task_count}</td>
        <td>${user.is_active ? '<span style="color: green;">✓ Hoạt động</span>' : '<span style="color: red;">✗ Khóa</span>'}</td>
        <td>
          <button class="task-btn task-btn-secondary" onclick="toggleUserStatus(${user.user_id}, ${!user.is_active})">
            ${user.is_active ? 'Khóa' : 'Mở'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

async function toggleUserStatus(userId, activate) {
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_active: activate })
    });

    if (response.ok) {
      showNotification(activate ? 'Tài khoản đã mở' : 'Tài khoản đã khóa', 'success');
      loadAdminUsers();
    }
  } catch (error) {
    showNotification('Lỗi: ' + error.message, 'error');
  }
}

function showAdminSection(section) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

  if (section === 'statistics') {
    document.getElementById('statisticsSection').style.display = 'block';
  } else {
    document.getElementById('usersSection').style.display = 'block';
  }

  event.target.classList.add('active');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  try {
    const response = await fetch(`${API_BASE}/user`, {
      credentials: 'include'
    });
    if (response.ok) {
      currentUser = await response.json();
      showUserDashboard();
    }
  } catch (error) {
    console.log('Not logged in');
  }
});
