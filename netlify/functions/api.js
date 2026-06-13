// ════════════════════════════════════════════════
//  netlify/functions/api.js
//  REST API cho NexTask – chạy trên Netlify Functions
//
//  Routes:
//    Auth
//      POST   /api/register          đăng ký người dùng
//      POST   /api/login             đăng nhập (user + admin)
//      POST   /api/logout            kết thúc phiên hoạt động
//
//    Tasks  (yêu cầu user_id qua header X-User-Id)
//      GET    /api/tasks             lấy danh sách (filter + sort)
//      POST   /api/tasks             tạo công việc mới
//      PUT    /api/tasks/:id         cập nhật công việc
//      DELETE /api/tasks/:id         xóa công việc
//
//    Tags
//      GET    /api/tags              lấy nhãn của user
//      POST   /api/tags              tạo nhãn mới
//      DELETE /api/tags/:id          xóa nhãn
//
//    Admin  (yêu cầu admin_id qua header X-Admin-Id)
//      GET    /api/admin/users       danh sách người dùng + thống kê
//      PATCH  /api/admin/users/:id/lock   khóa / mở khóa
//      GET    /api/admin/stats       thống kê toàn hệ thống
// ════════════════════════════════════════════════

const { getClient } = require("./db");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Admin-Id",
};

// ── Helpers ──────────────────────────────────────
const ok  = (body, code = 200)   => ({ statusCode: code,  headers: HEADERS, body: JSON.stringify(body) });
const err = (msg, code = 400)    => ({ statusCode: code,  headers: HEADERS, body: JSON.stringify({ error: msg }) });
const body = (event)             => JSON.parse(event.body || "{}");
const userId  = (event)          => parseInt(event.headers["x-user-id"]  || "0", 10);
const adminId = (event)          => parseInt(event.headers["x-admin-id"] || "0", 10);

// Trích path segments và resource id
function parsePath(event) {
  // event.path  => /.netlify/functions/api/tasks/123
  const raw = event.path.replace(/\/\.netlify\/functions\/api\/?/, "").replace(/^\//, "");
  const parts = raw.split("/").filter(Boolean);
  // parts = ["tasks"] | ["tasks","123"] | ["admin","users"] | ...
  return parts;
}

// ════════════════════════════════════════════════
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEADERS, body: "" };

  const client = await getClient();
  try {
    const method = event.httpMethod;
    const parts  = parsePath(event);
    const [res, sub, subId] = parts;  // resource, sub-resource, sub-id

    // ── ĐĂNG KÝ ────────────────────────────────
    // POST /api/register
    if (method === "POST" && res === "register") {
      const { username, email, password } = body(event);
      if (!username || !email || !password) return err("Thiếu thông tin bắt buộc");
      if (password.length < 6) return err("Mật khẩu ít nhất 6 ký tự");

      const dup = await client.query(
        "SELECT id FROM users WHERE email=$1 OR username=$2", [email, username]
      );
      if (dup.rows.length) return err("Email hoặc tên đăng nhập đã tồn tại", 409);

      const { rows } = await client.query(
        `INSERT INTO users (username, email, password)
         VALUES ($1, $2, $3) RETURNING id, username, email, locked, created_at`,
        [username, email, password]   // password nên được hash ở client trước khi gửi
      );
      return ok({ user: rows[0] }, 201);
    }

    // ── ĐĂNG NHẬP ──────────────────────────────
    // POST /api/login
    if (method === "POST" && res === "login") {
      const { email, password, role } = body(event);
      if (!email || !password) return err("Thiếu email hoặc mật khẩu");

      if (role === "admin") {
        const { rows } = await client.query(
          "SELECT id, email FROM admins WHERE email=$1 AND password=$2", [email, password]
        );
        if (!rows.length) return err("Sai thông tin đăng nhập", 401);
        return ok({ role: "admin", admin: rows[0] });
      }

      const { rows } = await client.query(
        "SELECT id, username, email, locked FROM users WHERE email=$1 AND password=$2",
        [email, password]
      );
      if (!rows.length) return err("Sai email hoặc mật khẩu", 401);
      const user = rows[0];
      if (user.locked) return err("Tài khoản đã bị khóa", 403);

      // Ghi lịch sử đăng nhập
      await client.query(
        "UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]
      );
      const { rows: logRows } = await client.query(
        "INSERT INTO activity_logs (user_id) VALUES ($1) RETURNING id",
        [user.id]
      );

      return ok({ role: "user", user, sessionId: logRows[0].id });
    }

    // ── ĐĂNG XUẤT ──────────────────────────────
    // POST /api/logout   body: { sessionId }
    if (method === "POST" && res === "logout") {
      const { sessionId } = body(event);
      if (sessionId) {
        await client.query(
          `UPDATE activity_logs
           SET ended_at=NOW(),
               duration_sec=EXTRACT(EPOCH FROM (NOW()-started_at))::INTEGER
           WHERE id=$1`,
          [sessionId]
        );
      }
      return ok({ success: true });
    }

    // ════════════════════════════════════════════
    //  TASKS
    // ════════════════════════════════════════════

    // GET /api/tasks?status=&sort=deadline&dir=asc&tag=
    if (method === "GET" && res === "tasks") {
      const uid = userId(event);
      if (!uid) return err("Yêu cầu xác thực", 401);

      const { status, sort = "deadline", dir = "asc", tag, q } = event.queryStringParameters || {};
      const validSort = ["deadline","status","importance","urgency","created_at"].includes(sort) ? sort : "deadline";
      const validDir  = dir === "desc" ? "DESC" : "ASC";

      let query = `
        SELECT t.id, t.title, t.description, t.deadline, t.status,
               t.importance, t.urgency, t.created_at, t.updated_at,
               COALESCE(
                 JSON_AGG(tg.name ORDER BY tg.name) FILTER (WHERE tg.id IS NOT NULL),
                 '[]'
               ) AS tags
        FROM tasks t
        LEFT JOIN task_tags tt ON tt.task_id = t.id
        LEFT JOIN tags tg      ON tg.id      = tt.tag_id
        WHERE t.user_id = $1
      `;
      const params = [uid];
      let p = 2;

      if (status)              { query += ` AND t.status=$${p++}`;                params.push(status); }
      if (q)                   { query += ` AND t.title ILIKE $${p++}`;           params.push(`%${q}%`); }
      if (tag) {
        query += ` AND EXISTS (
          SELECT 1 FROM task_tags tt2
          JOIN tags tg2 ON tg2.id=tt2.tag_id
          WHERE tt2.task_id=t.id AND tg2.name=$${p++}
        )`;
        params.push(tag);
      }

      query += ` GROUP BY t.id ORDER BY t.${validSort} ${validDir} NULLS LAST`;

      const { rows } = await client.query(query, params);
      return ok({ tasks: rows });
    }

    // POST /api/tasks  – tạo công việc mới
    if (method === "POST" && res === "tasks") {
      const uid = userId(event);
      if (!uid) return err("Yêu cầu xác thực", 401);

      const { title, description="", deadline, status="todo", importance=2, urgency=2, tags=[] } = body(event);
      if (!title)    return err("Tiêu đề là bắt buộc");
      if (!deadline) return err("Thời hạn là bắt buộc");

      // Giới hạn 100 công việc mỗi user
      const { rows: cnt } = await client.query("SELECT COUNT(*) FROM tasks WHERE user_id=$1", [uid]);
      if (parseInt(cnt[0].count) >= 100) return err("Đã đạt giới hạn 100 công việc", 400);

      const { rows } = await client.query(
        `INSERT INTO tasks (user_id,title,description,deadline,status,importance,urgency)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [uid, title, description, deadline, status, importance, urgency]
      );
      const task = rows[0];

      // Gắn tags (tạo mới nếu chưa có)
      for (const tagName of tags) {
        if (!tagName || tagName.length > 20) continue;
        const { rows: tagRows } = await client.query(
          `INSERT INTO tags (user_id, name) VALUES ($1,$2)
           ON CONFLICT (user_id, name) DO UPDATE SET name=EXCLUDED.name
           RETURNING id`,
          [uid, tagName]
        );
        await client.query(
          "INSERT INTO task_tags (task_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [task.id, tagRows[0].id]
        );
      }
      return ok({ task }, 201);
    }

    // PUT /api/tasks/:id – cập nhật công việc
    if (method === "PUT" && res === "tasks" && sub) {
      const uid = userId(event);
      const tid = parseInt(sub, 10);
      if (!uid) return err("Yêu cầu xác thực", 401);

      const { title, description, deadline, status, importance, urgency, tags } = body(event);

      const fields = [];
      const params = [];
      let p = 1;
      if (title       !== undefined) { fields.push(`title=$${p++}`);       params.push(title);       }
      if (description !== undefined) { fields.push(`description=$${p++}`); params.push(description); }
      if (deadline    !== undefined) { fields.push(`deadline=$${p++}`);    params.push(deadline);    }
      if (status      !== undefined) { fields.push(`status=$${p++}`);      params.push(status);      }
      if (importance  !== undefined) { fields.push(`importance=$${p++}`);  params.push(importance);  }
      if (urgency     !== undefined) { fields.push(`urgency=$${p++}`);     params.push(urgency);     }
      if (fields.length) {
        fields.push(`updated_at=NOW()`);
        params.push(uid, tid);
        await client.query(
          `UPDATE tasks SET ${fields.join(",")} WHERE user_id=$${p++} AND id=$${p++}`,
          params
        );
      }

      // Cập nhật tags
      if (Array.isArray(tags)) {
        await client.query("DELETE FROM task_tags WHERE task_id=$1", [tid]);
        for (const tagName of tags) {
          if (!tagName || tagName.length > 20) continue;
          const { rows: tagRows } = await client.query(
            `INSERT INTO tags (user_id, name) VALUES ($1,$2)
             ON CONFLICT (user_id, name) DO UPDATE SET name=EXCLUDED.name
             RETURNING id`,
            [uid, tagName]
          );
          await client.query(
            "INSERT INTO task_tags (task_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            [tid, tagRows[0].id]
          );
        }
      }
      return ok({ updated: true });
    }

    // DELETE /api/tasks/:id
    if (method === "DELETE" && res === "tasks" && sub) {
      const uid = userId(event);
      const tid = parseInt(sub, 10);
      if (!uid) return err("Yêu cầu xác thực", 401);
      const { rowCount } = await client.query(
        "DELETE FROM tasks WHERE id=$1 AND user_id=$2", [tid, uid]
      );
      if (!rowCount) return err("Không tìm thấy công việc", 404);
      return ok({ deleted: true });
    }

    // ════════════════════════════════════════════
    //  TAGS
    // ════════════════════════════════════════════

    // GET /api/tags
    if (method === "GET" && res === "tags") {
      const uid = userId(event);
      if (!uid) return err("Yêu cầu xác thực", 401);
      const { rows } = await client.query(
        "SELECT id, name FROM tags WHERE user_id=$1 ORDER BY name", [uid]
      );
      return ok({ tags: rows });
    }

    // POST /api/tags
    if (method === "POST" && res === "tags") {
      const uid = userId(event);
      if (!uid) return err("Yêu cầu xác thực", 401);
      const { name } = body(event);
      if (!name || !name.trim())      return err("Tên nhãn không được rỗng");
      if (name.trim().length > 20)    return err("Tên nhãn tối đa 20 ký tự");

      const { rows: cnt } = await client.query("SELECT COUNT(*) FROM tags WHERE user_id=$1", [uid]);
      if (parseInt(cnt[0].count) >= 100) return err("Đã đạt giới hạn 100 nhãn", 400);

      const { rows } = await client.query(
        "INSERT INTO tags (user_id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *",
        [uid, name.trim()]
      );
      if (!rows.length) return err("Nhãn đã tồn tại", 409);
      return ok({ tag: rows[0] }, 201);
    }

    // DELETE /api/tags/:id
    if (method === "DELETE" && res === "tags" && sub) {
      const uid = userId(event);
      const tid = parseInt(sub, 10);
      if (!uid) return err("Yêu cầu xác thực", 401);
      const { rowCount } = await client.query(
        "DELETE FROM tags WHERE id=$1 AND user_id=$2", [tid, uid]
      );
      if (!rowCount) return err("Không tìm thấy nhãn", 404);
      return ok({ deleted: true });
    }

    // ════════════════════════════════════════════
    //  ADMIN
    // ════════════════════════════════════════════

    // GET /api/admin/users
    if (method === "GET" && res === "admin" && sub === "users") {
      const aid = adminId(event);
      if (!aid) return err("Yêu cầu quyền admin", 401);

      // Tự động khóa tài khoản không hoạt động 3 tháng
      await client.query(`
        UPDATE users SET locked=TRUE
        WHERE locked=FALSE
          AND (last_login IS NULL OR last_login < NOW() - INTERVAL '90 days')
      `);

      const { rows } = await client.query(`
        SELECT u.id, u.username, u.email, u.locked, u.last_login, u.created_at,
               COUNT(t.id)                                       AS task_count,
               COUNT(t.id) FILTER (WHERE t.status='done')       AS done_count
        FROM users u
        LEFT JOIN tasks t ON t.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at
      `);
      return ok({ users: rows });
    }

    // PATCH /api/admin/users/:id/lock
    if (method === "PATCH" && res === "admin" && sub === "users" && subId === "lock") {
      const aid = adminId(event);
      if (!aid) return err("Yêu cầu quyền admin", 401);
      const uid = parseInt(parts[2], 10);   // /admin/users/:id/lock
      const { locked } = body(event);
      await client.query("UPDATE users SET locked=$1 WHERE id=$2", [locked, uid]);
      return ok({ updated: true });
    }

    // GET /api/admin/stats
    if (method === "GET" && res === "admin" && sub === "stats") {
      const aid = adminId(event);
      if (!aid) return err("Yêu cầu quyền admin", 401);

      const [usersR, tasksR, actR] = await Promise.all([
        client.query(`
          SELECT COUNT(*)                            AS total,
                 COUNT(*) FILTER (WHERE locked)      AS locked_count,
                 COUNT(*) FILTER (WHERE NOT locked)  AS active_count
          FROM users
        `),
        client.query(`
          SELECT COUNT(*)                             AS total,
                 COUNT(*) FILTER (WHERE status='done')  AS done_count,
                 COUNT(*) FILTER (WHERE status='doing') AS doing_count,
                 COUNT(*) FILTER (WHERE status='todo')  AS todo_count
          FROM tasks
        `),
        client.query(`
          SELECT COALESCE(SUM(duration_sec),0) AS total_seconds,
                 COUNT(*)                       AS session_count
          FROM activity_logs
          WHERE started_at >= NOW() - INTERVAL '30 days'
        `),
      ]);

      return ok({
        users:    usersR.rows[0],
        tasks:    tasksR.rows[0],
        activity: actR.rows[0],
      });
    }

    // ── 405 Fallthrough ─────────────────────────
    return err("Không tìm thấy route", 404);

  } catch (e) {
    console.error(e);
    return err("Lỗi máy chủ nội bộ", 500);
  } finally {
    await client.end();
  }
};