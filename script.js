const API = "/.netlify/functions/api";

async function register() {
  const username = document.getElementById("user").value;
  const password = document.getElementById("pass").value;

  const res = await fetch(API + "/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (res.ok) {
    alert("Đăng ký thành công");
    document.getElementById("user").value = "";
    document.getElementById("pass").value = "";

  } else {
    alert(data.error || "Lỗi đăng ký");
  }
}

async function login() {
  const username = document.getElementById("user").value;
  const password = document.getElementById("pass").value;

  const res = await fetch(API + "/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    alert("Đăng nhập thành công");
    load();
  } else {
    alert("Sai tài khoản hoặc mật khẩu");
  }
}


async function load() {
  try {
    const res = await fetch(API, {
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
  });

  const r = await res.json();

  if (res.status === 401) {
    localStorage.removeItem("token");
    alert("Bạn cần đăng nhập lại");
    return;
  }
    const list = document.getElementById("list");
    const names = r.names || [];
    if (!names.length) {
      list.innerHTML = '<li class="empty">Chưa có tên nào.</li>';
      return;
    }
    list.innerHTML = names.map(n =>
      `<li>${n.name} <button onclick="del(${n.id})">xóa</button></li>`
    ).join("");
  } catch (err) {
    console.error("load error:", err);
  }
}

async function add() {
  const inp = document.getElementById("inp");
  const name = inp.value.trim();
  if (!name) return;
  await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ name })
  });  
  inp.value = "";
  load();
}

async function del(id) {
  await fetch(`${API}/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
  });
  load();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inp").addEventListener("keydown", e => e.key === "Enter" && add());
  load();
});

function logout() {
  localStorage.removeItem("token");
  location.reload();
}