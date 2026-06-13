
const DB = {
  get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

function initDB() {
  if (!DB.get("nt_users")) {
    DB.set("nt_users", [
      { id: 1, name: "Hà Thái San",     email: "san@nextask.vn",  password: hash("123456"),  locked: false, lastLogin: Date.now() },
      { id: 2, name: "Giang Thành Vinh",email: "vinh@nextask.vn", password: hash("123456"),  locked: false, lastLogin: Date.now() - 86400000 * 5 },
    ]);
  }
  if (!DB.get("nt_admins")) {
    DB.set("nt_admins", [{ id: 1, name: "Admin", email: "admin@nextask.vn", password: hash("admin123") }]);
  }
  if (!DB.get("nt_tags")) {
    DB.set("nt_tags", ["Học tập", "Cá nhân", "Công việc", "Khẩn cấp", "Dự án"]);
  }
  if (!DB.get("nt_tasks")) {
    const uid = 1;
    DB.set("nt_tasks", [
      { id: 1, userId: uid, title: "Nộp báo cáo giữa kỳ",      description: "Hoàn thiện và nộp báo cáo môn Kỹ thuật phần mềm", deadline: "2026-06-20", status: "doing", importance: 3, urgency: 3, tags: ["Học tập","Dự án"],        createdAt: Date.now()-86400000*3 },
      { id: 2, userId: uid, title: "Ôn tập thi cuối kỳ",        description: "Ôn lại toàn bộ nội dung học kỳ",                  deadline: "2026-07-01", status: "todo",  importance: 3, urgency: 2, tags: ["Học tập"],                  createdAt: Date.now()-86400000*2 },
      { id: 3, userId: uid, title: "Họp nhóm dự án",            description: "Thảo luận tiến độ và phân công công việc",         deadline: "2026-06-15", status: "done",  importance: 2, urgency: 3, tags: ["Dự án","Công việc"],        createdAt: Date.now()-86400000   },
      { id: 4, userId: uid, title: "Đọc sách Clean Code",       description: "Đọc chương 1–3",                                   deadline: "2026-06-25", status: "todo",  importance: 2, urgency: 1, tags: ["Cá nhân"],                   createdAt: Date.now()            },
      { id: 5, userId: uid, title: "Nộp form đăng ký học phần", description: "Đăng ký học phần học kỳ tới",                     deadline: "2026-06-10", status: "todo",  importance: 3, urgency: 3, tags: ["Học tập","Khẩn cấp"],       createdAt: Date.now()-86400000*5 },
    ]);
  }
}

let currentUser    = null;
let editingTaskId  = null;
let activeTagFilter = null;

let loginRole = "user";

function setRole(r) {
  loginRole = r;
  document.getElementById("roleUser").classList.toggle("active",  r === "user");
  document.getElementById("roleAdmin").classList.toggle("active", r === "admin");
  document.getElementById("tabRegister").style.display = r === "admin" ? "none" : "";
  if (r === "admin") switchLoginTab("login");
}

function switchLoginTab(t) {
  document.getElementById("loginForm").style.display    = t === "login"    ? "block" : "none";
  document.getElementById("registerForm").style.display = t === "register" ? "block" : "none";
  document.getElementById("tabLogin").classList.toggle("active",    t === "login");
  document.getElementById("tabRegister").classList.toggle("active", t === "register");
}

function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;
  const errEl = document.getElementById("loginError");

  if (loginRole === "admin") {
    const a = (DB.get("nt_admins") || []).find(u => u.email === email && u.password === hash(pass));
    if (!a) { errEl.classList.add("show"); return; }
    currentUser = { ...a, role: "admin" };
  } else {
    const users = DB.get("nt_users") || [];
    const u = users.find(u => u.email === email && u.password === hash(pass));
    if (!u) { errEl.classList.add("show"); return; }
    if (u.locked) { showToast("Tài khoản đã bị khóa", "error"); return; }
    u.lastLogin = Date.now();
    DB.set("nt_users", users);
    currentUser = { ...u, role: "user" };
  }
  errEl.classList.remove("show");
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("app").classList.remove("hidden");
  initApp();
}

function doRegister() {
  const name  = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass  = document.getElementById("regPass").value;
  const errEl = document.getElementById("regError");

  if (!name || !email || !pass)    { errEl.textContent = "Vui lòng điền đầy đủ thông tin"; errEl.classList.add("show"); return; }
  if (pass.length < 6)             { errEl.textContent = "Mật khẩu ít nhất 6 ký tự";       errEl.classList.add("show"); return; }

  const users = DB.get("nt_users") || [];
  if (users.find(u => u.email === email)) { errEl.textContent = "Email đã được sử dụng"; errEl.classList.add("show"); return; }

  users.push({ id: Date.now(), name, email, password: hash(pass), locked: false, lastLogin: Date.now() });
  DB.set("nt_users", users);
  errEl.classList.remove("show");
  showToast("Đăng ký thành công! Hãy đăng nhập.", "success");
  switchLoginTab("login");
}

function logout() {
  currentUser     = null;
  activeTagFilter = null;
  document.getElementById("loginScreen").classList.add("active");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPass").value  = "";
}

function initApp() {
  const name = currentUser.name || currentUser.email;
  document.getElementById("userDisplayName").textContent = name;
  document.getElementById("userDisplayRole").textContent = currentUser.role === "admin" ? "Quản trị viên" : "Đăng xuất";
  document.getElementById("userAvatar").textContent      = name[0].toUpperCase();

  const isAdmin = currentUser.role === "admin";
  document.getElementById("nav-admin").style.display = isAdmin ? "flex"  : "none";
  document.getElementById("addTaskBtn").style.display = isAdmin ? "none"  : "flex";

  activeTagFilter = null;
  renderSidebarTags();
  showView("tasks");
}

function showView(v) {
  ["tasks", "stats", "admin"].forEach(x => {
    document.getElementById("view-" + x).style.display = x === v ? "block" : "none";
    document.getElementById("nav-"  + x)?.classList.toggle("active", x === v);
  });
  const titles = { tasks: "Công việc của tôi", stats: "Thống kê & Phân tích", admin: "Quản lý tài khoản" };
  document.getElementById("pageTitle").textContent = titles[v];
  if (v === "tasks") { filterTasks(); updateTopStats(); }
  if (v === "stats") renderStats();
  if (v === "admin") renderAdmin();
}

function getTasks() {
  const all = DB.get("nt_tasks") || [];
  return currentUser.role === "admin" ? all : all.filter(t => t.userId === currentUser.id);
}

function saveTasks(myTasks) {
  const all    = DB.get("nt_tasks") || [];
  const others = all.filter(t => t.userId !== currentUser.id);
  DB.set("nt_tasks", currentUser.role === "admin" ? myTasks : [...others, ...myTasks]);
}

function filterTasks() {
  let tasks = getTasks();
  const q       = (document.getElementById("searchInput").value || "").toLowerCase();
  const status  = document.getElementById("filterStatus").value;
  const sortBy  = document.getElementById("sortBy").value;
  const sortDir = document.getElementById("sortDir").value;

  if (q)               tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description||"").toLowerCase().includes(q));
  if (status)          tasks = tasks.filter(t => t.status === status);
  if (activeTagFilter) tasks = tasks.filter(t => (t.tags||[]).includes(activeTagFilter));

  const statusOrder = { todo: 0, doing: 1, done: 2 };
  tasks.sort((a, b) => {
    let va, vb;
    if (sortBy === "deadline")   { va = a.deadline || "9999-99-99"; vb = b.deadline || "9999-99-99"; }
    else if (sortBy === "status")     { va = statusOrder[a.status]; vb = statusOrder[b.status]; }
    else if (sortBy === "importance") { va = a.importance; vb = b.importance; }
    else /* urgency */                { va = a.urgency;    vb = b.urgency;    }
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  renderTaskList(tasks);
  updateTopStats();
  document.getElementById("taskCountLabel").textContent = `${tasks.length} công việc`;
}

const STATUS_MAP = {
  todo:  { label: "Chưa làm", cls: "badge-status-todo"  },
  doing: { label: "Đang làm", cls: "badge-status-doing" },
  done:  { label: "Đã làm",   cls: "badge-status-done"  },
};
const IMP_MAP = {
  1: { label: "Thấp",       cls: "badge-imp-low"  },
  2: { label: "Trung bình", cls: "badge-imp-med"  },
  3: { label: "Cao",        cls: "badge-imp-high" },
};
const URG_MAP = {
  1: { label: "Thấp",       cls: "badge-urg-low"  },
  2: { label: "Trung bình", cls: "badge-urg-med"  },
  3: { label: "Cao",        cls: "badge-urg-high" },
};

function renderTaskList(tasks) {
  const el = document.getElementById("tasksList");
  if (!tasks.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 12h6M12 9v6"/>
        </svg>
        <h3>Chưa có công việc nào</h3>
        <p>Nhấn "Tạo công việc" để bắt đầu</p>
      </div>`;
    return;
  }
  el.innerHTML = tasks.map(t => taskCardHTML(t)).join("");
}

function taskCardHTML(t) {
  const st  = STATUS_MAP[t.status]     || STATUS_MAP.todo;
  const imp = IMP_MAP[t.importance]    || IMP_MAP[2];
  const urg = URG_MAP[t.urgency]       || URG_MAP[2];
  const today     = todayStr();
  const isOverdue = t.deadline && t.deadline < today && t.status !== "done";
  const isSoon    = t.deadline && t.deadline >= today && t.deadline <= addDays(today, 3) && t.status !== "done";
  const dlClass   = isOverdue ? "overdue" : isSoon ? "soon" : "";
  const tags = (t.tags || []).map(tag => `<span class="badge badge-tag">${esc(tag)}</span>`).join("");

  return `
  <div class="task-card${t.status==="done"?" done":""}" onclick="editTask(${t.id})">
    <div class="task-top">
      <div class="task-checkbox${t.status==="done"?" checked":""}"
           onclick="event.stopPropagation();toggleDone(${t.id})"></div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ""}
        <div class="task-meta">
          <span class="badge ${st.cls}">${st.label}</span>
          <span class="badge ${imp.cls}">★ ${imp.label}</span>
          <span class="badge ${urg.cls}">⚡ ${urg.label}</span>
          ${tags}
          ${t.deadline ? `<span class="deadline ${dlClass}">📅 ${fmtDate(t.deadline)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" title="Sửa"
                onclick="event.stopPropagation();editTask(${t.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn delete" title="Xóa"
                onclick="event.stopPropagation();deleteTask(${t.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>`;
}

function toggleDone(id) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.status = t.status === "done" ? "todo" : "done";
  saveTasks(tasks);
  filterTasks();
  showToast(t.status === "done" ? "Đã hoàn thành ✓" : "Đã mở lại công việc");
}

function deleteTask(id) {
  if (!confirm("Bạn chắc chắn muốn xóa công việc này?")) return;
  saveTasks(getTasks().filter(t => t.id !== id));
  filterTasks();
  showToast("Đã xóa công việc", "error");
}

function updateTopStats() {
  const tasks   = getTasks();
  const today   = todayStr();
  const done    = tasks.filter(t => t.status === "done").length;
  const doing   = tasks.filter(t => t.status === "doing").length;
  const overdue = tasks.filter(t => t.deadline && t.deadline < today && t.status !== "done").length;
  const rate    = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  document.getElementById("s-total").textContent   = tasks.length;
  document.getElementById("s-doing").textContent   = doing;
  document.getElementById("s-done").textContent    = done;
  document.getElementById("s-rate").textContent    = `Tỉ lệ: ${rate}%`;
  document.getElementById("s-overdue").textContent = overdue;
  document.getElementById("badge-active").textContent = tasks.filter(t => t.status !== "done").length;
}

function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;
  document.getElementById("modalTitle").textContent   = task ? "Chỉnh sửa công việc" : "Tạo công việc mới";
  document.getElementById("f-title").value            = task?.title       || "";
  document.getElementById("f-desc").value             = task?.description || "";
  document.getElementById("f-deadline").value         = task?.deadline    || "";
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
  const t = getTasks().find(x => x.id === id);
  if (t) openTaskModal(t);
}

function closeTaskModal() { document.getElementById("taskOverlay").classList.remove("open"); }
function closeTaskModalOutside(e) { if (e.target === document.getElementById("taskOverlay")) closeTaskModal(); }

function saveTask() {
  const title       = document.getElementById("f-title").value.trim();
  const deadline    = document.getElementById("f-deadline").value;
  let valid = true;
  if (!title)    { document.getElementById("e-title").classList.add("show");    valid = false; }
  else             document.getElementById("e-title").classList.remove("show");
  if (!deadline) { document.getElementById("e-deadline").classList.add("show"); valid = false; }
  else             document.getElementById("e-deadline").classList.remove("show");
  if (!valid) return;

  const selectedTags = [...document.querySelectorAll(".tag-option.selected")].map(el => el.dataset.tag);
  const tasks = getTasks();

  if (editingTaskId) {
    const t = tasks.find(x => x.id === editingTaskId);
    if (t) Object.assign(t, {
      title,
      description: document.getElementById("f-desc").value.trim(),
      deadline,
      status:     document.getElementById("f-status").value,
      importance: +document.getElementById("f-importance").value,
      urgency:    +document.getElementById("f-urgency").value,
      tags: selectedTags,
    });
  } else {
    const all = DB.get("nt_tasks") || [];
    if (all.length >= 100) { showToast("Đã đạt giới hạn 100 công việc", "error"); return; }
    tasks.push({
      id: Date.now(),
      userId: currentUser.id,
      title,
      description: document.getElementById("f-desc").value.trim(),
      deadline,
      status:     document.getElementById("f-status").value,
      importance: +document.getElementById("f-importance").value,
      urgency:    +document.getElementById("f-urgency").value,
      tags: selectedTags,
      createdAt: Date.now(),
    });
  }
  saveTasks(tasks);
  closeTaskModal();
  filterTasks();
  showToast(editingTaskId ? "Đã cập nhật công việc" : "Đã tạo công việc mới ✓", "success");
}

function renderTagSelector(selected = []) {
  const tags = DB.get("nt_tags") || [];
  document.getElementById("tagSelector").innerHTML = tags.length
    ? tags.map(tag =>
        `<div class="tag-option${selected.includes(tag) ? " selected" : ""}"
              data-tag="${esc(tag)}"
              onclick="this.classList.toggle('selected')">${esc(tag)}</div>`
      ).join("")
    : `<span style="font-size:.8rem;color:var(--text-muted)">Chưa có nhãn — hãy tạo nhãn trước</span>`;
}

function renderSidebarTags() {
  const tags = DB.get("nt_tags") || [];
  document.getElementById("sidebarTags").innerHTML = tags.map(tag =>
    `<button class="nav-item" onclick="setTagFilter('${esc(tag)}')" style="font-size:.82rem">
       <span style="width:8px;height:8px;background:var(--accent);border-radius:50%;flex-shrink:0"></span>
       ${esc(tag)}
     </button>`
  ).join("");
  renderTagFilters();
}

function renderTagFilters() {
  const tags = DB.get("nt_tags") || [];
  document.getElementById("tagFilters").innerHTML =
    `<div class="tag-filter${!activeTagFilter ? " active" : ""}" onclick="setTagFilter(null)">Tất cả</div>` +
    tags.map(tag =>
      `<div class="tag-filter${activeTagFilter === tag ? " active" : ""}"
            onclick="setTagFilter('${esc(tag)}')">${esc(tag)}</div>`
    ).join("");
}

function setTagFilter(tag) {
  activeTagFilter = tag;
  renderTagFilters();
  filterTasks();
}

function openTagModal() {
  renderAllTags();
  document.getElementById("tagOverlay").classList.add("open");
  setTimeout(() => document.getElementById("newTagInput").focus(), 100);
}
function closeTagModal() {
  document.getElementById("tagOverlay").classList.remove("open");
  renderSidebarTags();
}
function closeTagModalOutside(e) { if (e.target === document.getElementById("tagOverlay")) closeTagModal(); }

function renderAllTags() {
  const tags = DB.get("nt_tags") || [];
  document.getElementById("allTagsList").innerHTML = tags.length
    ? tags.map(tag =>
        `<div class="tag-option">
           ${esc(tag)}
           <span class="del-tag" onclick="deleteTag('${esc(tag)}')" title="Xóa nhãn">✕</span>
         </div>`
      ).join("")
    : `<span style="font-size:.8rem;color:var(--text-muted)">Chưa có nhãn nào</span>`;
}

function addTag() {
  const name  = document.getElementById("newTagInput").value.trim();
  const tags  = DB.get("nt_tags") || [];
  const errEl = document.getElementById("tagError");
  if (!name || tags.includes(name) || tags.length >= 100) { errEl.classList.add("show"); return; }
  errEl.classList.remove("show");
  tags.push(name);
  DB.set("nt_tags", tags);
  document.getElementById("newTagInput").value = "";
  renderAllTags();
  showToast("Đã thêm nhãn dán");
}

function deleteTag(name) {
  DB.set("nt_tags", (DB.get("nt_tags") || []).filter(t => t !== name));
  // Xóa tag khỏi tất cả tasks
  const all = DB.get("nt_tasks") || [];
  all.forEach(t => { if (t.tags) t.tags = t.tags.filter(tg => tg !== name); });
  DB.set("nt_tasks", all);
  renderAllTags();
  showToast("Đã xóa nhãn dán");
}

function renderStats() {
  const tasks   = getTasks();
  const today   = todayStr();
  const done    = tasks.filter(t => t.status === "done").length;
  const doing   = tasks.filter(t => t.status === "doing").length;
  const todo    = tasks.filter(t => t.status === "todo").length;
  const overdue = tasks.filter(t => t.deadline && t.deadline < today && t.status !== "done").length;
  const rate    = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  document.getElementById("sv-rate").textContent       = `${rate}%`;
  document.getElementById("sv-done-count").textContent = `${done}/${tasks.length} hoàn thành`;
  document.getElementById("sv-doing").textContent      = doing;
  document.getElementById("sv-overdue").textContent    = overdue;

  // Bar chart trạng thái
  const maxS = Math.max(todo, doing, done, 1);
  document.getElementById("statusChart").innerHTML =
    `<div class="bar-chart">
       ${barColHTML("Chưa làm", todo,  maxS, "#9CA3AF")}
       ${barColHTML("Đang làm", doing, maxS, "#3B82F6")}
       ${barColHTML("Đã làm",   done,  maxS, "#22C55E")}
     </div>`;

  const impLabels = { 3: "🔴 Quan trọng cao", 2: "🟡 Quan trọng TB", 1: "🟢 Quan trọng thấp" };
  const impColors = { 3: "var(--red)", 2: "var(--orange)", 1: "var(--green)" };
  document.getElementById("impChart").innerHTML =
    `<div style="display:flex;flex-direction:column;gap:12px">` +
    [3, 2, 1].map(lv => {
      const g = tasks.filter(t => t.importance === lv);
      const d = g.filter(t => t.status === "done").length;
      return progressRowHTML(impLabels[lv], d, g.length, impColors[lv]);
    }).join("") +
    `</div>`;

  const q1 = tasks.filter(t => t.importance === 3 && t.urgency === 3);
  const q2 = tasks.filter(t => t.importance === 3 && t.urgency  <  3);
  const q3 = tasks.filter(t => t.importance  <  3 && t.urgency === 3);
  const q4 = tasks.filter(t => t.importance  <  3 && t.urgency  <  3);
  document.getElementById("eisenhower").innerHTML =
    matrixCellHTML("mc-q1", "🔴 Khẩn & Quan trọng",          "Làm ngay",     q1) +
    matrixCellHTML("mc-q2", "🟡 Quan trọng, không khẩn",     "Lên kế hoạch", q2) +
    matrixCellHTML("mc-q3", "🟠 Khẩn, ít quan trọng",        "Uỷ quyền",     q3) +
    matrixCellHTML("mc-q4", "🟢 Không khẩn & ít quan trọng", "Để sau",       q4);
}

function barColHTML(label, val, max, color) {
  const h = Math.max(4, Math.round((val / max) * 100));
  return `<div class="bar-col">
    <div class="bar-val">${val}</div>
    <div class="bar" style="height:${h}px;background:${color}"></div>
    <div class="bar-label">${label}</div>
  </div>`;
}

function progressRowHTML(label, done, total, color) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return `<div class="progress-row">
    <div class="progress-label">${label}</div>
    <div class="progress-track">
      <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <div class="progress-pct" style="color:${color}">${pct}%</div>
  </div>`;
}

function matrixCellHTML(cls, label, action, tasks) {
  const items = tasks.slice(0, 4).map(t => `<div class="mc-task">${esc(t.title)}</div>`).join("");
  return `<div class="matrix-cell ${cls}">
    <div class="mc-label">${label} <span class="mc-action">(${action})</span></div>
    <div class="mc-tasks">${items || '<div class="mc-empty">Không có</div>'}</div>
    <div class="mc-count">${tasks.length} công việc</div>
  </div>`;
}

function renderAdmin() {
  const users    = DB.get("nt_users") || [];
  const allTasks = DB.get("nt_tasks") || [];
  const threeMonthsAgo = Date.now() - 90 * 24 * 3600 * 1000;

  // Tự động khóa tài khoản không hoạt động 3 tháng
  let changed = false;
  users.forEach(u => {
    if (!u.locked && u.lastLogin && u.lastLogin < threeMonthsAgo) { u.locked = true; changed = true; }
  });
  if (changed) DB.set("nt_users", users);

  document.getElementById("av-users").textContent  = users.length;
  document.getElementById("av-active").textContent = users.filter(u => !u.locked).length;
  document.getElementById("av-locked").textContent = users.filter(u =>  u.locked).length;

  document.getElementById("usersTableBody").innerHTML = users.map(u => {
    const utasks = allTasks.filter(t => t.userId === u.id);
    const udone  = utasks.filter(t => t.status === "done").length;
    return `<tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td style="color:var(--text-muted)">${esc(u.email)}</td>
      <td>${utasks.length} cv (${udone} hoàn thành)</td>
      <td>
        <span class="status-dot ${u.locked ? "dot-locked" : "dot-active"}"></span>
        ${u.locked ? "Đã khóa" : "Hoạt động"}
      </td>
      <td>
        <button class="btn btn-sm ${u.locked ? "btn-primary" : "btn-warn"}"
                onclick="toggleLock(${u.id})">
          ${u.locked ? "Mở khóa" : "Khóa"}
        </button>
      </td>
    </tr>`;
  }).join("");
}

function toggleLock(id) {
  const users = DB.get("nt_users") || [];
  const u = users.find(x => x.id === id);
  if (u) {
    u.locked = !u.locked;
    DB.set("nt_users", users);
    renderAdmin();
    showToast(u.locked ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
  }
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function todayStr()       { return new Date().toISOString().split("T")[0]; }
function fmtDate(d)       { if (!d) return ""; const [y,m,day]=d.split("-"); return `${day}/${m}/${y}`; }
function addDays(d, n)    { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split("T")[0]; }

function showToast(msg, type = "") {
  const wrap = document.getElementById("toastWrap");
  const t    = document.createElement("div");
  t.className   = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeTaskModal(); closeTagModal(); }
});

initDB();