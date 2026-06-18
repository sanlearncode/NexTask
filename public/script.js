const API = "/.netlify/functions/api";

// ── STATE 
let currentUser     = null;   // { id, username, email, role, sessionId? }
let editingTaskId   = null;
let activeTagFilter = null;
let allTasks        = [];     // cache local sau mỗi lần fetch
let allTags         = [];     // cache local

// ── HASH
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

// ── HTTP helpers 
async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (currentUser?.role === "user"  && currentUser.id)
    headers["X-User-Id"]  = String(currentUser.id);
  if (currentUser?.role === "admin" && currentUser.id)
    headers["X-Admin-Id"] = String(currentUser.id);

  const res = await fetch(`${API}/${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Lỗi không xác định");
  return data;
}

const apiGet    = (path)        => apiFetch(path, { method: "GET" });
const apiPost   = (path, body)  => apiFetch(path, { method: "POST",   body: JSON.stringify(body) });
const apiPut    = (path, body)  => apiFetch(path, { method: "PUT",    body: JSON.stringify(body) });
const apiPatch  = (path, body)  => apiFetch(path, { method: "PATCH",  body: JSON.stringify(body) });
const apiDelete = (path)        => apiFetch(path, { method: "DELETE" });

async function askAI(message){

  const data = await apiPost(
    "chatbot",
    { message }
  );

  return data.reply;
}

//  AUTH
let loginRole = "user";

function setRole(r) {
  loginRole = r;
  document.getElementById("roleUser").classList.toggle("active",  r === "user");
  document.getElementById("roleAdmin").classList.toggle("active", r === "admin");
  document.getElementById("tabRegister").style.display = r === "admin" ? "none" : "";
  if (r === "admin") switchLoginTab("login");
}

function switchLoginTab(t) {
  document.getElementById("loginForm").style.display =
    t === "login" ? "block" : "none";

  document.getElementById("registerForm").style.display =
    t === "register" ? "block" : "none";

  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");

  if (tabLogin)
    tabLogin.classList.toggle("active", t === "login");

  if (tabRegister)
    tabRegister.classList.toggle("active", t === "register");
}

async function doLogin() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;
  const errEl    = document.getElementById("loginError");
  errEl.classList.remove("show");
  if (!email || !password) { errEl.classList.add("show"); return; }

  try {
    const data = await apiPost("login", { email, password: hash(password), role: loginRole });
    if (loginRole === "admin") {
      currentUser = { ...data.admin, role: "admin" };
    } else {
      currentUser = { ...data.user, role: "user", sessionId: data.sessionId };
    }
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("app").classList.remove("hidden");
    initApp();
  } catch (e) {
    errEl.classList.add("show");
  }
}

async function doRegister() {
  const username = document.getElementById("regName").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;
  const errEl    = document.getElementById("regError");
  errEl.classList.remove("show");

  if (!username || !email || !password) { errEl.textContent = "Vui lòng điền đầy đủ thông tin"; errEl.classList.add("show"); return; }
  if (password.length < 6)              { errEl.textContent = "Mật khẩu ít nhất 6 ký tự";       errEl.classList.add("show"); return; }

  try {
    await apiPost("register", { username, email, password: hash(password) });
    showToast("Đăng ký thành công! Hãy đăng nhập.", "success");
    switchLoginTab("login");
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.add("show");
  }
}

async function logout() {
  if (currentUser?.sessionId) {
    try { await apiPost("logout", { sessionId: currentUser.sessionId }); } catch {}
  }
  currentUser     = null;
  activeTagFilter = null;
  allTasks = []; allTags = [];
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("landingPage").style.display = "block";
  
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPass").value  = "";
}

//  KHỞI TẠO APP
function initApp() {
  const name = currentUser.username || currentUser.email;
  document.getElementById("userDisplayName").textContent = name;
  document.getElementById("userDisplayRole").textContent = currentUser.role === "admin" ? "Quản trị viên" : "Đăng xuất";
  document.getElementById("userAvatar").textContent      = name[0].toUpperCase();

  const isAdmin = currentUser.role === "admin";
  document.getElementById("nav-admin").style.display = isAdmin ? "flex" : "none";
  document.getElementById("addTaskBtn").style.display = isAdmin ? "none" : "flex";

  activeTagFilter = null;
  showView("tasks");
}

//  VIEWS
function showView(v) {
  ["tasks","stats","calendar","admin"].forEach(x => {
    document.getElementById("view-" + x).style.display = x === v ? "block" : "none";
    document.getElementById("nav-"  + x)?.classList.toggle("active", x === v);
  });
  const titles = { tasks:"Công việc của tôi", stats:"Thống kê & Phân tích", calendar:"Lịch công việc", admin:"Quản lý tài khoản" };
  document.getElementById("pageTitle").textContent = titles[v];
  if (v === "tasks") loadTasks();
  if (v === "stats") loadStats();
  if (v === "calendar") loadCalendar();
  if (v === "admin") loadAdmin();
}

//  TASKS – fetch + render
async function loadTasks() {
  showLoading("tasksList");
  try {
    const sortBy  = document.getElementById("sortBy").value;
    const sortDir = document.getElementById("sortDir").value;
    const status  = document.getElementById("filterStatus").value;
    const q       = document.getElementById("searchInput").value.trim();

    let url = `tasks?sort=${sortBy}&dir=${sortDir}`;
    if (status) url += `&status=${status}`;
    if (q)      url += `&q=${encodeURIComponent(q)}`;
    if (activeTagFilter) url += `&tag=${encodeURIComponent(activeTagFilter)}`;

    const data = await apiGet(url);
    allTasks = data.tasks || [];
    renderTaskList(allTasks);

    updateTopStats();

    loadNotifications();
    document.getElementById("taskCountLabel").textContent = `${allTasks.length} công việc`;

    // Load tags cho sidebar
    await loadTags();
  } catch (e) {
    document.getElementById("tasksList").innerHTML =
      `<div class="empty-state"><h3>Không thể tải dữ liệu</h3><p>${esc(e.message)}</p></div>`;
  }
}

function filterTasks() { loadTasks(); } 

async function loadTags() {
  try {
    const data = await apiGet("tags");
    allTags = data.tags || [];
    renderSidebarTags();
    renderTagFilters();
  } catch {}
}

// ── Render 
const STATUS_MAP = {
  todo:  { label:"Chưa làm", cls:"badge-status-todo"  },
  doing: { label:"Đang làm", cls:"badge-status-doing" },
  done:  { label:"Đã làm",   cls:"badge-status-done"  },
};
const IMP_MAP = {
  1:{label:"Thấp",       cls:"badge-imp-low" },
  2:{label:"Trung bình", cls:"badge-imp-med" },
  3:{label:"Cao",        cls:"badge-imp-high"},
};
const URG_MAP = {
  1:{label:"Thấp",       cls:"badge-urg-low" },
  2:{label:"Trung bình", cls:"badge-urg-med" },
  3:{label:"Cao",        cls:"badge-urg-high"},
};

function renderTaskList(tasks) {
  const el = document.getElementById("tasksList");
  if (!tasks.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M12 9v6"/>
      </svg>
      <h3>Chưa có công việc nào</h3><p>Nhấn "Tạo công việc" để bắt đầu</p>
    </div>`;
    return;
  }
  el.innerHTML = tasks.map(t => taskCardHTML(t)).join("");
}

function taskCardHTML(t) {
  const st  = STATUS_MAP[t.status]    || STATUS_MAP.todo;
  const imp = IMP_MAP[t.importance]   || IMP_MAP[2];
  const urg = URG_MAP[t.urgency]      || URG_MAP[2];
  const today     = todayStr();
  const dl        = t.deadline ? t.deadline.slice(0,10) : "";
  const isOverdue = dl && dl < today && t.status !== "done";
  const isSoon    = dl && dl >= today && dl <= addDays(today,3) && t.status !== "done";
  const dlClass   = isOverdue ? "overdue" : isSoon ? "soon" : "";
  const tags = (t.tags || []).map(tag => `<span class="badge badge-tag">${esc(tag)}</span>`).join("");

  return `
  <div class="task-card${t.status==="done"?" done":""}" onclick="editTask(${t.id})">
    <div class="task-top">
      <div class="task-checkbox${t.status==="done"?" checked":""}"
           onclick="event.stopPropagation();toggleDone(${t.id},'${t.status}')"></div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ""}
        <div class="task-meta">
          <span class="badge ${st.cls}">${st.label}</span>
          <span class="badge ${imp.cls}">★ ${imp.label}</span>
          <span class="badge ${urg.cls}">⚡ ${urg.label}</span>
          ${tags}
          ${dl ? `<span class="deadline ${dlClass}">📅 ${fmtDate(dl)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" title="Sửa"
                onclick="event.stopPropagation();editTask(${t.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn delete" title="Xóa"
                onclick="event.stopPropagation();deleteTask(${t.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>`;
}

async function toggleDone(id, currentStatus) {
  const newStatus = currentStatus === "done" ? "todo" : "done";
  try {
    await apiPut(`tasks/${id}`, { status: newStatus });
    showToast(newStatus === "done" ? "Đã hoàn thành ✓" : "Đã mở lại công việc");
    loadTasks();
  } catch (e) { showToast(e.message, "error"); }
}

async function deleteTask(id) {
  if (!confirm("Bạn chắc chắn muốn xóa công việc này?")) return;
  try {
    await apiDelete(`tasks/${id}`);
    showToast("Đã xóa công việc", "error");
    loadTasks();
  } catch (e) { showToast(e.message, "error"); }
}

function updateTopStats() {
  const today   = todayStr();
  const done    = allTasks.filter(t => t.status === "done").length;
  const doing   = allTasks.filter(t => t.status === "doing").length;
  const overdue = allTasks.filter(t => t.deadline && t.deadline.slice(0,10) < today && t.status !== "done").length;
  const rate    = allTasks.length ? Math.round(done / allTasks.length * 100) : 0;

  document.getElementById("s-total").textContent   = allTasks.length;
  document.getElementById("s-doing").textContent   = doing;
  document.getElementById("s-done").textContent    = done;
  document.getElementById("s-rate").textContent    = `Tỉ lệ: ${rate}%`;
  document.getElementById("s-overdue").textContent = overdue;
  document.getElementById("badge-active").textContent = allTasks.filter(t => t.status !== "done").length;
}

//  MODAL CÔNG VIỆC
function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;
  document.getElementById("modalTitle").textContent   = task ? "Chỉnh sửa công việc" : "Tạo công việc mới";
  document.getElementById("f-title").value            = task?.title       || "";
  document.getElementById("f-desc").value             = task?.description || "";
  document.getElementById("f-deadline").value         = task?.deadline?.slice(0,10) || "";
  document.getElementById("f-status").value           = task?.status      || "todo";
  document.getElementById("f-importance").value       = task?.importance  || 2;
  document.getElementById("f-urgency").value          = task?.urgency     || 2;
  document.getElementById("e-title").classList.remove("show");
  document.getElementById("e-deadline").classList.remove("show");
  renderTagSelector(task?.tags || []);
  document.getElementById("taskOverlay").classList.add("open");
  setTimeout(() => document.getElementById("f-title").focus(), 100);
}

function editTask(id) {
  const t = allTasks.find(x => x.id === id);
  if (t) openTaskModal(t);
}

function closeTaskModal() { document.getElementById("taskOverlay").classList.remove("open"); }
function closeTaskModalOutside(e) { if (e.target === document.getElementById("taskOverlay")) closeTaskModal(); }

async function saveTask() {
  const title    = document.getElementById("f-title").value.trim();
  const deadline = document.getElementById("f-deadline").value;
  let valid = true;
  if (!title)    { document.getElementById("e-title").classList.add("show");    valid = false; }
  else             document.getElementById("e-title").classList.remove("show");
  if (!deadline) { document.getElementById("e-deadline").classList.add("show"); valid = false; }
  else             document.getElementById("e-deadline").classList.remove("show");
  if (!valid) return;

  const selectedTags = [...document.querySelectorAll(".tag-option.selected")].map(el => el.dataset.tag);
  const payload = {
    title,
    description: document.getElementById("f-desc").value.trim(),
    deadline,
    status:     document.getElementById("f-status").value,
    importance: +document.getElementById("f-importance").value,
    urgency:    +document.getElementById("f-urgency").value,
    tags: selectedTags,
  };

  try {
    if (editingTaskId) {
      await apiPut(`tasks/${editingTaskId}`, payload);
      showToast("Đã cập nhật công việc", "success");
    } else {
      await apiPost("tasks", payload);
      showToast("Đã tạo công việc mới ✓", "success");
    }
    closeTaskModal();
    loadTasks();
  } catch (e) { showToast(e.message, "error"); }
}

//  NHÃN DÁN
function renderTagSelector(selected = []) {
  document.getElementById("tagSelector").innerHTML = allTags.length
    ? allTags.map(tag =>
        `<div class="tag-option${selected.includes(tag.name) ? " selected" : ""}"
              data-tag="${esc(tag.name)}"
              onclick="this.classList.toggle('selected')">${esc(tag.name)}</div>`
      ).join("")
    : `<span style="font-size:.8rem;color:var(--text-muted)">Chưa có nhãn — hãy tạo nhãn trước</span>`;
}

function renderSidebarTags() {
  document.getElementById("sidebarTags").innerHTML = allTags.map(tag =>
    `<button class="nav-item" onclick="setTagFilter('${esc(tag.name)}')" style="font-size:.82rem">
       <span style="width:8px;height:8px;background:var(--accent);border-radius:50%;flex-shrink:0"></span>
       ${esc(tag.name)}
     </button>`
  ).join("");
}

function renderTagFilters() {
  document.getElementById("tagFilters").innerHTML =
    `<div class="tag-filter${!activeTagFilter?" active":""}" onclick="setTagFilter(null)">Tất cả</div>` +
    allTags.map(tag =>
      `<div class="tag-filter${activeTagFilter===tag.name?" active":""}"
            onclick="setTagFilter('${esc(tag.name)}')">${esc(tag.name)}</div>`
    ).join("");
}

function setTagFilter(tag) {
  activeTagFilter = tag;
  renderTagFilters();
  loadTasks();
}

function renderAllTagsInModal() {
  document.getElementById("allTagsList").innerHTML = allTags.length
    ? allTags.map(tag =>
        `<div class="tag-option">
           ${esc(tag.name)}
           <span class="del-tag" onclick="deleteTag(${tag.id},'${esc(tag.name)}')" title="Xóa nhãn">✕</span>
         </div>`
      ).join("")
    : `<span style="font-size:.8rem;color:var(--text-muted)">Chưa có nhãn nào</span>`;
}

function openTagModal() {
  renderAllTagsInModal();
  document.getElementById("tagOverlay").classList.add("open");
  setTimeout(() => document.getElementById("newTagInput").focus(), 100);
}
async function closeTagModal() {
  document.getElementById("tagOverlay").classList.remove("open");
  await loadTags();
}
function closeTagModalOutside(e) { if (e.target === document.getElementById("tagOverlay")) closeTagModal(); }

async function addTag() {
  const name  = document.getElementById("newTagInput").value.trim();
  const errEl = document.getElementById("tagError");
  if (!name) { errEl.classList.add("show"); return; }
  try {
    const data = await apiPost("tags", { name });
    allTags.push(data.tag);
    document.getElementById("newTagInput").value = "";
    errEl.classList.remove("show");
    renderAllTagsInModal();
    showToast("Đã thêm nhãn dán");
  } catch (e) {
    errEl.classList.add("show");
  }
}

async function deleteTag(id, name) {
  try {
    await apiDelete(`tags/${id}`);
    allTags = allTags.filter(t => t.id !== id);
    renderAllTagsInModal();
    showToast(`Đã xóa nhãn "${name}"`);
  } catch (e) { showToast(e.message, "error"); }
}

//  VIEW THỐNG KÊ
async function loadStats() {
  if (!allTasks.length) {
    try { const d = await apiGet("tasks"); allTasks = d.tasks || []; } catch {}
  }
  const tasks   = allTasks;
  const today   = todayStr();
  const done    = tasks.filter(t => t.status === "done").length;
  const doing   = tasks.filter(t => t.status === "doing").length;
  const todo    = tasks.filter(t => t.status === "todo").length;
  const overdue = tasks.filter(t => t.deadline && t.deadline.slice(0,10) < today && t.status !== "done").length;
  const rate    = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  document.getElementById("sv-rate").textContent       = `${rate}%`;
  document.getElementById("sv-done-count").textContent = `${done}/${tasks.length} hoàn thành`;
  document.getElementById("sv-doing").textContent      = doing;
  document.getElementById("sv-overdue").textContent    = overdue;

  const maxS = Math.max(todo, doing, done, 1);
  document.getElementById("statusChart").innerHTML =
    `<div class="bar-chart">
       ${barColHTML("Chưa làm", todo,  maxS, "#9CA3AF")}
       ${barColHTML("Đang làm", doing, maxS, "#3B82F6")}
       ${barColHTML("Đã làm",   done,  maxS, "#22C55E")}
     </div>`;

  const impCfg = [
    { lv:3, label:"🔴 Quan trọng cao",  color:"var(--red)"    },
    { lv:2, label:"🟡 Quan trọng TB",   color:"var(--orange)" },
    { lv:1, label:"🟢 Quan trọng thấp", color:"var(--green)"  },
  ];
  document.getElementById("impChart").innerHTML =
    `<div style="display:flex;flex-direction:column;gap:12px">` +
    impCfg.map(({ lv, label, color }) => {
      const g = tasks.filter(t => t.importance === lv);
      return progressRowHTML(label, g.filter(t=>t.status==="done").length, g.length, color);
    }).join("") + `</div>`;

  const q1 = tasks.filter(t => t.importance===3 && t.urgency===3);
  const q2 = tasks.filter(t => t.importance===3 && t.urgency< 3);
  const q3 = tasks.filter(t => t.importance< 3  && t.urgency===3);
  const q4 = tasks.filter(t => t.importance< 3  && t.urgency< 3);
  document.getElementById("eisenhower").innerHTML =
    matrixCellHTML("mc-q1","🔴 Khẩn & Quan trọng",          "Làm ngay",     q1) +
    matrixCellHTML("mc-q2","🟡 Quan trọng, không khẩn",     "Lên kế hoạch", q2) +
    matrixCellHTML("mc-q3","🟠 Khẩn, ít quan trọng",        "Uỷ quyền",     q3) +
    matrixCellHTML("mc-q4","🟢 Không khẩn & ít quan trọng", "Để sau",       q4);
}

function barColHTML(label, val, max, color) {
  const h = Math.max(4, Math.round((val/max)*100));
  return `<div class="bar-col">
    <div class="bar-val">${val}</div>
    <div class="bar" style="height:${h}px;background:${color}"></div>
    <div class="bar-label">${label}</div>
  </div>`;
}
function progressRowHTML(label, done, total, color) {
  const pct = total ? Math.round(done/total*100) : 0;
  return `<div class="progress-row">
    <div class="progress-label">${label}</div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
    <div class="progress-pct" style="color:${color}">${pct}%</div>
  </div>`;
}
function matrixCellHTML(cls, label, action, tasks) {
  const items = tasks.slice(0,4).map(t=>`<div class="mc-task">${esc(t.title)}</div>`).join("");
  return `<div class="matrix-cell ${cls}">
    <div class="mc-label">${label} <span class="mc-action">(${action})</span></div>
    <div class="mc-tasks">${items||'<div class="mc-empty">Không có</div>'}</div>
    <div class="mc-count">${tasks.length} công việc</div>
  </div>`;
}

//  VIEW ADMIN
async function loadAdmin() {
  showLoading("usersTableBody");
  try {
    const [usersData, statsData] = await Promise.all([
      apiGet("admin/users"),
      apiGet("admin/stats"),
    ]);
    const users = usersData.users || [];
    const stats = statsData;

    document.getElementById("av-users").textContent  = stats.users?.total  || users.length;
    document.getElementById("av-active").textContent = stats.users?.active_count || users.filter(u=>!u.locked).length;
    document.getElementById("av-locked").textContent = stats.users?.locked_count || users.filter(u=>u.locked).length;

    document.getElementById("usersTableBody").innerHTML = users.map(u => `
      <tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td style="color:var(--text-muted)">${esc(u.email)}</td>
        <td>${u.task_count||0} cv (${u.done_count||0} hoàn thành)</td>
        <td>
          <span class="status-dot ${u.locked?"dot-locked":"dot-active"}"></span>
          ${u.locked?"Đã khóa":"Hoạt động"}
        </td>
        <td>
          <button class="btn btn-sm ${u.locked?"btn-primary":"btn-warn"}"
                  onclick="toggleLock(${u.id},${!u.locked})">
            ${u.locked?"Mở khóa":"Khóa"}
          </button>
        </td>
      </tr>`).join("");
  } catch (e) {
    document.getElementById("usersTableBody").innerHTML =
      `<tr><td colspan="5" style="color:var(--text-muted);padding:20px">Không thể tải dữ liệu: ${esc(e.message)}</td></tr>`;
  }
}

async function toggleLock(userId, locked) {
  try {
    await apiPatch(`admin/users/${userId}/lock`, { locked });
    showToast(locked ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
    loadAdmin();
  } catch (e) { showToast(e.message, "error"); }
}

//  UTILS
function esc(s) {
  return String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function todayStr()    { return new Date().toISOString().split("T")[0]; }
function fmtDate(d)    { if(!d)return""; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; }
function addDays(d,n)  { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split("T")[0]; }

function showLoading(elId) {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">
    <div style="font-size:1.4rem;margin-bottom:8px">⏳</div>Đang tải...</div>`;
}

function showToast(msg, type = "") {
  const wrap = document.getElementById("toastWrap");
  const t    = document.createElement("div");
  t.className   = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Keyboard shortcuts 
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeTaskModal(); closeTagModal(); }
});

function openLogin(tab = "login") {

  document.getElementById("landingPage").style.display = "none";

  document.getElementById("loginScreen")
          .classList.add("active");

  switchLoginTab(tab);
}

function backToLanding(){

    document.getElementById("landingPage").style.display = "block";

    document.getElementById("loginScreen")
            .classList.remove("active");
}

function toggleChat(){

  const chat =
    document.getElementById("aiChatbot");

  chat.style.display =
    chat.style.display === "flex"
      ? "none"
      : "flex";
}

function addMessage(text,type){

  const messages =
    document.getElementById("chatMessages");

  const div =
    document.createElement("div");

  div.className =
    type === "user"
      ? "chat-user"
      : "chat-ai";

  div.innerHTML =
    `<div class="chat-bubble">
      ${esc(text)}
    </div>`;

  messages.appendChild(div);

  messages.scrollTop =
    messages.scrollHeight;
}

async function sendAIMessage(){

  const input =
    document.getElementById("chatInput");

  const message =
    input.value.trim();

  if(!message) return;

  addMessage(message,"user");

  input.value = "";

  addMessage("Đang suy nghĩ...","ai");

  try{

    const reply =
      await askAI(message);

    const msgs =
      document.querySelectorAll(".chat-ai");

    msgs[msgs.length-1].innerHTML =
      `<div class="chat-bubble">
        ${reply}
      </div>`;

  }catch(err){

    const msgs =
      document.querySelectorAll(".chat-ai");

    msgs[msgs.length-1].innerHTML =
      `<div class="chat-bubble">
        Lỗi: ${err.message}
      </div>`;
  }
}

let calendarDate = new Date();

function changeMonth(step){

  calendarDate.setMonth(
    calendarDate.getMonth() + step
  );

  loadCalendar();
}

function loadCalendar(){

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();

  document.getElementById(
    "calendarMonth"
  ).textContent =
    `Tháng ${month+1} / ${year}`;

  const firstDay =
    new Date(year,month,1).getDay();

  const daysInMonth =
    new Date(year,month+1,0).getDate();

  const calendar =
    document.getElementById("calendarDays");

  let html = "";

  for(let i=0;i<firstDay;i++){
    html += `<div class="calendar-cell empty"></div>`;
  }

  for(let day=1;day<=daysInMonth;day++){

    const dateStr =
      `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

    const tasks =
      allTasks.filter(
        t => t.deadline &&
        t.deadline.slice(0,10) === dateStr
      );

    html += `
      <div class="calendar-cell">

        <div class="calendar-date">
          ${day}
        </div>

        ${tasks.map(t=>`
          <div class="calendar-task">
            ${esc(t.title)}
          </div>
        `).join("")}

      </div>
    `;
  }

  calendar.innerHTML = html;
}

let notifications = [];

function toggleNotifications(){

  const panel =
    document.getElementById(
      "notificationPanel"
    );

  panel.style.display =
    panel.style.display === "block"
      ? "none"
      : "block";
}

function loadNotifications(){

  const today =
    todayStr();

  notifications = [];

  allTasks.forEach(task => {

    if(!task.deadline)
      return;

    const deadline =
      task.deadline.slice(0,10);

    if(
      deadline < today &&
      task.status !== "done"
    ){
      notifications.push({
        type:"overdue",
        text:`⚠️ ${task.title} đã quá hạn`
      });
    }

    else if(
      deadline === today &&
      task.status !== "done"
    ){
      notifications.push({
        type:"soon",
        text:`📅 Hôm nay: ${task.title}`
      });
    }

  });

  renderNotifications();
}

function renderNotifications(){

  document.getElementById(
    "notificationBadge"
  ).textContent =
    notifications.length;

  const list =
    document.getElementById(
      "notificationList"
    );

  if(!notifications.length){

    list.innerHTML =
      `<div class="notification-item">
        Không có thông báo
      </div>`;

    return;
  }

  list.innerHTML =
    notifications.map(n => `
      <div class="notification-item ${n.type}">
        ${n.text}
      </div>
    `).join("");
}