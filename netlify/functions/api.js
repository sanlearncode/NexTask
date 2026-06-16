const { getClient } = require("./db");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Admin-Id",
};

// ── Helpers 
const respond  = (data, code = 200) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify(data) });
const fail     = (msg,  code = 400) => ({ statusCode: code, headers: HEADERS, body: JSON.stringify({ error: msg }) });
const getBody  = (event)            => { try { return JSON.parse(event.body || "{}"); } catch { return {}; } };
const getUserId  = (event)          => parseInt(event.headers["x-user-id"]  || event.headers["X-User-Id"]  || "0", 10);
const getAdminId = (event)          => parseInt(event.headers["x-admin-id"] || event.headers["X-Admin-Id"] || "0", 10);

// ── Parse path thành mảng segments
function parsePath(event) {
  // Ưu tiên rawPath (Netlify v2), fallback về path
  const fullPath = event.rawPath || event.path || "";
  // Xóa mọi prefix đến và bao gồm "/api"
  const afterApi = fullPath.replace(/^.*\/api\/?/, "");
  return afterApi.split("/").filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  let client;
  try {
    client = await getClient();
  } catch (e) {
    console.error("DB connect error:", e);
    return fail("Không thể kết nối cơ sở dữ liệu", 500);
  }

  try {
    const method = event.httpMethod;
    const parts  = parsePath(event);
    const [seg0, seg1, seg2] = parts;

    console.log(`[${method}] segments:`, parts);

    //  AUTH

    // POST /api/register
    if (method === "POST" && seg0 === "register") {
      const { username, email, password } = getBody(event);
      if (!username || !email || !password) return fail("Thiếu thông tin bắt buộc");

      // Kiểm tra trùng
      const dup = await client.query(
        "SELECT id FROM users WHERE email=$1 OR username=$2",
        [email.toLowerCase().trim(), username.trim()]
      );
      if (dup.rows.length) return fail("Email hoặc tên đăng nhập đã tồn tại", 409);

      const { rows } = await client.query(
        `INSERT INTO users (username, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, locked, created_at`,
        [username.trim(), email.toLowerCase().trim(), password]
      );
      return respond({ user: rows[0] }, 201);
    }

    // POST /api/login
    if (method === "POST" && seg0 === "login") {
      const { email, password, role } = getBody(event);
      if (!email || !password) return fail("Thiếu email hoặc mật khẩu");

      if (role === "admin") {
        const { rows } = await client.query(
          "SELECT id, email FROM admins WHERE email=$1 AND password=$2",
          [email.toLowerCase().trim(), password]
        );
        if (!rows.length) return fail("Sai thông tin đăng nhập", 401);
        return respond({ role: "admin", admin: rows[0] });
      }

      // User login
      const { rows } = await client.query(
        `SELECT id, username, email, locked
         FROM users WHERE email=$1 AND password=$2`,
        [email.toLowerCase().trim(), password]
      );
      if (!rows.length) return fail("Sai email hoặc mật khẩu", 401);
      const user = rows[0];
      if (user.locked) return fail("Tài khoản đã bị khóa", 403);

      // Cập nhật last_login và ghi log
      await client.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);
      const { rows: logRows } = await client.query(
        "INSERT INTO activity_logs (user_id) VALUES ($1) RETURNING id",
        [user.id]
      );
      return respond({ role: "user", user, sessionId: logRows[0].id });
    }

    // POST /api/logout
    if (method === "POST" && seg0 === "logout") {
      const { sessionId } = getBody(event);
      if (sessionId) {
        await client.query(
          `UPDATE activity_logs
           SET ended_at=NOW(),
               duration_sec=GREATEST(0, EXTRACT(EPOCH FROM (NOW()-started_at))::INTEGER)
           WHERE id=$1`,
          [sessionId]
        );
      }
      return respond({ success: true });
    }

    //  TASKS

    // GET /api/tasks
    if (method === "GET" && seg0 === "tasks" && !seg1) {
      const uid = getUserId(event);
      if (!uid) return fail("Yêu cầu xác thực", 401);

      const qp = event.queryStringParameters || {};
      const { status, sort = "deadline", dir = "asc", tag, q } = qp;
      const validSort = ["deadline","status","importance","urgency","created_at"].includes(sort)
        ? sort : "deadline";
      const validDir = dir === "desc" ? "DESC" : "ASC";

      let sql = `
        SELECT t.id, t.title, t.description,
               t.deadline::TEXT AS deadline,
               t.status, t.importance, t.urgency,
               t.created_at, t.updated_at,
               COALESCE(
                 JSON_AGG(tg.name ORDER BY tg.name)
                 FILTER (WHERE tg.id IS NOT NULL), '[]'
               ) AS tags
        FROM tasks t
        LEFT JOIN task_tags tt ON tt.task_id = t.id
        LEFT JOIN tags tg      ON tg.id = tt.tag_id
        WHERE t.user_id = $1
      `;
      const params = [uid];
      let p = 2;

      if (status) { sql += ` AND t.status=$${p++}`;           params.push(status); }
      if (q)      { sql += ` AND t.title ILIKE $${p++}`;      params.push(`%${q}%`); }
      if (tag) {
        sql += ` AND EXISTS (
          SELECT 1 FROM task_tags tt2
          JOIN tags tg2 ON tg2.id=tt2.tag_id
          WHERE tt2.task_id=t.id AND tg2.name=$${p++}
        )`;
        params.push(tag);
      }

      sql += ` GROUP BY t.id ORDER BY t.${validSort} ${validDir} NULLS LAST`;

      const { rows } = await client.query(sql, params);
      return respond({ tasks: rows });
    }

    // POST /api/tasks
    if (method === "POST" && seg0 === "tasks" && !seg1) {
      const uid = getUserId(event);
      if (!uid) return fail("Yêu cầu xác thực", 401);

      const { title, description="", deadline, status="todo",
              importance=2, urgency=2, tags=[] } = getBody(event);
      if (!title?.trim()) return fail("Tiêu đề là bắt buộc");
      if (!deadline)      return fail("Thời hạn là bắt buộc");

      // Giới hạn 100 công việc / user
      const { rows: cnt } = await client.query(
        "SELECT COUNT(*) FROM tasks WHERE user_id=$1", [uid]
      );
      if (parseInt(cnt[0].count) >= 100) return fail("Đã đạt giới hạn 100 công việc");

      const { rows } = await client.query(
        `INSERT INTO tasks (user_id,title,description,deadline,status,importance,urgency)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [uid, title.trim(), description, deadline, status, importance, urgency]
      );
      const task = rows[0];

      // Gắn tags
      for (const tagName of tags) {
        if (!tagName || tagName.length > 20) continue;
        const { rows: tagRows } = await client.query(
          `INSERT INTO tags (user_id,name) VALUES ($1,$2)
           ON CONFLICT (user_id,name) DO UPDATE SET name=EXCLUDED.name
           RETURNING id`,
          [uid, tagName]
        );
        await client.query(
          "INSERT INTO task_tags (task_id,tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [task.id, tagRows[0].id]
        );
      }
      return respond({ task }, 201);
    }

    // PUT /api/tasks/:id
    if (method === "PUT" && seg0 === "tasks" && seg1) {
      const uid = getUserId(event);
      const tid = parseInt(seg1, 10);
      if (!uid || isNaN(tid)) return fail("Yêu cầu xác thực", 401);

      const { title, description, deadline, status,
              importance, urgency, tags } = getBody(event);

      const fields = [], params = [];
      let p = 1;
      if (title       !== undefined) { fields.push(`title=$${p++}`);       params.push(title.trim()); }
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

      if (Array.isArray(tags)) {
        await client.query("DELETE FROM task_tags WHERE task_id=$1", [tid]);
        for (const tagName of tags) {
          if (!tagName || tagName.length > 20) continue;
          const { rows: tagRows } = await client.query(
            `INSERT INTO tags (user_id,name) VALUES ($1,$2)
             ON CONFLICT (user_id,name) DO UPDATE SET name=EXCLUDED.name
             RETURNING id`,
            [uid, tagName]
          );
          await client.query(
            "INSERT INTO task_tags (task_id,tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            [tid, tagRows[0].id]
          );
        }
      }
      return respond({ updated: true });
    }

    // DELETE /api/tasks/:id
    if (method === "DELETE" && seg0 === "tasks" && seg1) {
      const uid = getUserId(event);
      const tid = parseInt(seg1, 10);
      if (!uid || isNaN(tid)) return fail("Yêu cầu xác thực", 401);
      const { rowCount } = await client.query(
        "DELETE FROM tasks WHERE id=$1 AND user_id=$2", [tid, uid]
      );
      if (!rowCount) return fail("Không tìm thấy công việc", 404);
      return respond({ deleted: true });
    }

    //  TAGS

    // GET /api/tags
    if (method === "GET" && seg0 === "tags" && !seg1) {
      const uid = getUserId(event);
      if (!uid) return fail("Yêu cầu xác thực", 401);
      const { rows } = await client.query(
        "SELECT id, name FROM tags WHERE user_id=$1 ORDER BY name", [uid]
      );
      return respond({ tags: rows });
    }

    // POST /api/tags
    if (method === "POST" && seg0 === "tags" && !seg1) {
      const uid = getUserId(event);
      if (!uid) return fail("Yêu cầu xác thực", 401);
      const { name } = getBody(event);
      if (!name?.trim())         return fail("Tên nhãn không được rỗng");
      if (name.trim().length>20) return fail("Tên nhãn tối đa 20 ký tự");

      const { rows: cnt } = await client.query(
        "SELECT COUNT(*) FROM tags WHERE user_id=$1", [uid]
      );
      if (parseInt(cnt[0].count) >= 100) return fail("Đã đạt giới hạn 100 nhãn");

      const { rows } = await client.query(
        "INSERT INTO tags (user_id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *",
        [uid, name.trim()]
      );
      if (!rows.length) return fail("Nhãn đã tồn tại", 409);
      return respond({ tag: rows[0] }, 201);
    }

    // DELETE /api/tags/:id
    if (method === "DELETE" && seg0 === "tags" && seg1) {
      const uid = getUserId(event);
      const tid = parseInt(seg1, 10);
      if (!uid || isNaN(tid)) return fail("Yêu cầu xác thực", 401);
      const { rowCount } = await client.query(
        "DELETE FROM tags WHERE id=$1 AND user_id=$2", [tid, uid]
      );
      if (!rowCount) return fail("Không tìm thấy nhãn", 404);
      return respond({ deleted: true });
    }

    //  CHATBOT

    // POST /api/chatbot
    if (method === "POST" && seg0 === "chatbot") {
      const uid = getUserId(event);
      if (!uid) return fail("Yêu cầu xác thực", 401);

      const { message, tasks = [] } = getBody(event);
      if (!message?.trim()) return fail("Tin nhắn trống", 400);

      const userMessage = message.toLowerCase().trim();
      
      // Phân tích task từ client
      const today = new Date().toISOString().split('T')[0];
      const todayTasks = tasks.filter(t => 
        t.deadline === today && t.status !== "done"
      );
      const overdueTasks = tasks.filter(t => 
        t.deadline && t.deadline < today && t.status !== "done"
      );
      const upcomingTasks = tasks.filter(t => 
        t.deadline && t.deadline > today && t.status !== "done"
      );
      const urgentTasks = tasks.filter(t => 
        t.urgency === 3 && t.status !== "done"
      );
      const importantTasks = tasks.filter(t => 
        t.importance === 3 && t.status !== "done"
      );

      let reply = "";

      // Xử lý các loại câu hỏi phổ biến
      if (userMessage.includes("hôm nay") || userMessage.includes("công việc hôm nay")) {
        if (todayTasks.length === 0) {
          reply = "Bạn không có công việc nào hôm nay! Hãy thư giãn. 😊";
        } else {
          reply = `Bạn có ${todayTasks.length} công việc hôm nay:\n`;
          todayTasks.slice(0, 5).forEach((t, i) => {
            reply += `${i + 1}. ${t.title} (${t.status === "doing" ? "Đang làm" : "Chưa làm"})\n`;
          });
          if (todayTasks.length > 5) {
            reply += `... và ${todayTasks.length - 5} công việc khác`;
          }
        }
      } else if (userMessage.includes("quá hạn") || userMessage.includes("trễ") || userMessage.includes("hạn chót")) {
        if (overdueTasks.length === 0) {
          reply = "Tốt lắm! Bạn không có công việc nào quá hạn. 🎉";
        } else {
          reply = `⚠️ Bạn có ${overdueTasks.length} công việc đã quá hạn:\n`;
          overdueTasks.slice(0, 3).forEach((t, i) => {
            reply += `${i + 1}. ${t.title} (hạn: ${t.deadline})\n`;
          });
          reply += "\nHãy ưu tiên hoàn thành những công việc này!";
        }
      } else if (userMessage.includes("khẩn cấp") || userMessage.includes("gấp")) {
        if (urgentTasks.length === 0) {
          reply = "Không có công việc khẩn cấp nào. Bạn có thể sắp xếp thời gian thoải mái! 🌟";
        } else {
          reply = `⏰ Bạn có ${urgentTasks.length} công việc khẩn cấp:\n`;
          urgentTasks.slice(0, 3).forEach((t, i) => {
            reply += `${i + 1}. ${t.title}\n`;
          });
        }
      } else if (userMessage.includes("quan trọng") || userMessage.includes("ưu tiên")) {
        if (importantTasks.length === 0) {
          reply = "Không có công việc quan trọng nào. Tuyệt vời! ✨";
        } else {
          reply = `⭐ Bạn có ${importantTasks.length} công việc quan trọng:\n`;
          importantTasks.slice(0, 3).forEach((t, i) => {
            reply += `${i + 1}. ${t.title}\n`;
          });
        }
      } else if (userMessage.includes("sắp tới") || userMessage.includes("tuần tới")) {
        if (upcomingTasks.length === 0) {
          reply = "Bạn không có công việc sắp tới. Thời gian của bạn khá trống! 🎯";
        } else {
          reply = `📅 Bạn có ${upcomingTasks.length} công việc sắp tới:\n`;
          upcomingTasks.slice(0, 4).forEach((t, i) => {
            reply += `${i + 1}. ${t.title} (${t.deadline})\n`;
          });
        }
      } else if (userMessage.includes("tổng số") || userMessage.includes("bao nhiêu công việc")) {
        reply = `Bạn có tổng cộng ${tasks.length} công việc:\n`;
        reply += `• Chưa làm: ${tasks.filter(t => t.status === "todo").length}\n`;
        reply += `• Đang làm: ${tasks.filter(t => t.status === "doing").length}\n`;
        reply += `• Đã làm: ${tasks.filter(t => t.status === "done").length}`;
      } else if (userMessage.includes("gợi ý") || userMessage.includes("nên làm gì")) {
        if (todayTasks.length > 0) {
          reply = `Tôi gợi ý bạn nên bắt đầu với:\n"${todayTasks[0].title}"\n\nHãy tập trung hoàn thành công việc này trước! 💪`;
        } else if (urgentTasks.length > 0) {
          reply = `Tôi gợi ý bạn nên ưu tiên công việc khẩn cấp:\n"${urgentTasks[0].title}"\n\nĐây là việc cần được xử lý ngay! ⏰`;
        } else if (importantTasks.length > 0) {
          reply = `Tôi gợi ý bạn nên làm công việc quan trọng:\n"${importantTasks[0].title}"\n\nĐây sẽ giúp bạn đạt được mục tiêu! 🎯`;
        } else if (upcomingTasks.length > 0) {
          reply = `Bạn vẫn có việc cần làm:\n"${upcomingTasks[0].title}"\n\nHãy bắt đầu chuẩn bị từ bây giờ! 📝`;
        } else {
          reply = "Tuyệt vời! Bạn đã hoàn thành tất cả công việc. Hãy tạo những công việc mới và tiếp tục phát triển bản thân! 🚀";
        }
      } else if (userMessage.includes("hello") || userMessage.includes("xin chào") || userMessage.includes("hi")) {
        const hour = new Date().getHours();
        let greeting = "Chào buổi sáng! ☀️";
        if (hour >= 12 && hour < 17) greeting = "Chào buổi chiều! 🌤️";
        if (hour >= 17 && hour < 21) greeting = "Chào buổi tối! 🌙";
        if (hour >= 21 || hour < 6) greeting = "Bạn còn thức đấy à? 🌙";
        
        reply = `${greeting}\n\nTôi là trợ lý AI của NexTask. Tôi có thể giúp bạn:\n`;
        reply += `• Xem công việc hôm nay\n`;
        reply += `• Kiểm tra công việc quá hạn\n`;
        reply += `• Xem danh sách ưu tiên\n`;
        reply += `• Nhận gợi ý công việc cần làm\n\n`;
        reply += `Hỏi tôi bất cứ điều gì về công việc của bạn! 😊`;
      } else if (userMessage.includes("thank") || userMessage.includes("cảm ơn")) {
        reply = "Vui lòng! Tôi luôn sẵn sàng giúp bạn. Hãy tiếp tục hoàn thành công việc của bạn nhé! 💪";
      } else {
        // Phản hồi mặc định cho các câu hỏi không được nhận dạng
        reply = `Tôi hiểu bạn muốn hỏi về: "${message}"\n\n`;
        reply += `Dưới đây là một số gợi ý:\n`;
        reply += `• "Công việc hôm nay" - Xem danh sách việc hôm nay\n`;
        reply += `• "Công việc quá hạn" - Kiểm tra việc đã hết hạn\n`;
        reply += `• "Gợi ý" - Nhận gợi ý công việc ưu tiên\n`;
        reply += `• "Khẩn cấp" - Xem công việc cần làm gấp\n`;
        reply += `• "Tổng số" - Xem thống kê công việc\n\n`;
        reply += `Hoặc hãy nói với tôi bất cứ điều gì bạn cần! 😊`;
      }

      return respond({ reply });
    }

    //  ADMIN

    // GET /api/admin/users
    if (method === "GET" && seg0 === "admin" && seg1 === "users" && !seg2) {
      const aid = getAdminId(event);
      if (!aid) return fail("Yêu cầu quyền admin", 401);

      // Tự động khóa tài khoản không hoạt động 3 tháng
      await client.query(`
        UPDATE users SET locked=TRUE
        WHERE locked=FALSE
          AND (last_login IS NULL OR last_login < NOW() - INTERVAL '90 days')
      `);

      const { rows } = await client.query(`
        SELECT u.id, u.username, u.email, u.locked,
               u.last_login, u.created_at,
               COUNT(t.id)                                   AS task_count,
               COUNT(t.id) FILTER (WHERE t.status='done')   AS done_count
        FROM users u
        LEFT JOIN tasks t ON t.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at
      `);
      return respond({ users: rows });
    }

    if (method === "PATCH" && seg0 === "admin" && seg1 === "users" && seg2 && parts[3] === "lock") {
      const aid = getAdminId(event);
      if (!aid) return fail("Yêu cầu quyền admin", 401);
      const uid = parseInt(seg2, 10);
      if (isNaN(uid)) return fail("ID không hợp lệ");
      const { locked } = getBody(event);
      await client.query("UPDATE users SET locked=$1 WHERE id=$2", [locked, uid]);
      return respond({ updated: true });
    }

    if (method === "GET" && seg0 === "admin" && seg1 === "stats") {
      const aid = getAdminId(event);
      if (!aid) return fail("Yêu cầu quyền admin", 401);

      const [usersR, tasksR, actR] = await Promise.all([
        client.query(`
          SELECT COUNT(*)                           AS total,
                 COUNT(*) FILTER (WHERE locked)     AS locked_count,
                 COUNT(*) FILTER (WHERE NOT locked) AS active_count
          FROM users
        `),
        client.query(`
          SELECT COUNT(*)                                AS total,
                 COUNT(*) FILTER (WHERE status='done')  AS done_count,
                 COUNT(*) FILTER (WHERE status='doing') AS doing_count,
                 COUNT(*) FILTER (WHERE status='todo')  AS todo_count
          FROM tasks
        `),
        client.query(`
          SELECT COALESCE(SUM(duration_sec),0) AS total_seconds,
                 COUNT(*) AS session_count
          FROM activity_logs
          WHERE started_at >= NOW() - INTERVAL '30 days'
        `),
      ]);
      return respond({
        users:    usersR.rows[0],
        tasks:    tasksR.rows[0],
        activity: actR.rows[0],
      });
    }

    // ── Không khớp route nào
    return fail(`Route không tồn tại: [${method}] /${parts.join("/")}`, 404);

  } catch (e) {
    console.error("Handler error:", e);
    return fail("Lỗi máy chủ nội bộ: " + e.message, 500);
  } finally {
    if (client) await client.end();
  }
};