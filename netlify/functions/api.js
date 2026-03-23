const { getClient } = require("./db");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Khai báo hàm băm mật khẩu và tạo token JWT (nếu cần) ở đây để tái sử dụng trong các route sau này
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "your_secret_key";

// hàm verifyToken để kiểm tra token JWT trong header Authorization
function verifyToken(event) {
  const auth = event.headers.authorization || "";
  const token = auth.replace("Bearer ", "");

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  const client = await getClient();
  try {
    const method = event.httpMethod;

    // POST /register - Đăng ký người dùng mới
    if (method === "POST" && event.path.endsWith("/register")) {
      const { username, password } = JSON.parse(event.body || "{}");

      if (!username || !password) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Missing fields" }) };
      }

      const hash = await bcrypt.hash(password, 10);

      try {
        await client.query(
          "INSERT INTO users (username, password) VALUES ($1, $2)",
          [username, hash]
        );
        return { statusCode: 201, headers: HEADERS, body: JSON.stringify({ success: true }) };
      } catch (err) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "User exists" }) };
      }
    }

    // POST /login - Đăng nhập và nhận token JWT
    if (method === "POST" && event.path.endsWith("/login")) {
      const { username, password } = JSON.parse(event.body || "{}");

      const { rows } = await client.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
      );

      if (rows.length === 0) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Invalid" }) };
      }

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Invalid" }) };
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        SECRET,
        { expiresIn: "1d" }
      );

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ token })
      };
    }

    // Lấy :id từ path (nếu có)
    const segments = event.path.replace(/\/$/, "").split("/");
    const last = segments[segments.length - 1];
    const id = last !== "names" ? parseInt(last, 10) : null;

    // GET /names
    if (method === "GET" && !id) {

      const user = verifyToken(event);
      if (!user) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      const { rows } = await client.query(
        "SELECT * FROM names WHERE user_id = $1",
        [user.id]
      );
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ names: rows }) };
    }

    // POST /names
    if (method === "POST" && !id) {

      const user = verifyToken(event);
      if (!user) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      const { name } = JSON.parse(event.body || "{}");
      if (!name || !name.trim()) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "name is required" }) };
      }
      const { rows } = await client.query(
        "INSERT INTO names (name, user_id) VALUES ($1, $2)",
        [name, user.id]
      );
      return { statusCode: 201, headers: HEADERS, body: JSON.stringify({ name: rows[0] }) };
    }

    // DELETE /names/:id
    if (method === "DELETE" && id && !isNaN(id)) {

      const user = verifyToken(event);
      if (!user) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      const { rowCount } = await client.query(
        "DELETE FROM names WHERE id = $1 AND user_id = $2",
        [id, user.id]
      );
      if (rowCount === 0) {
        return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Not found" }) };
      }
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ deleted: true }) };
    }

    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Internal server error" }) };
  } finally {
    await client.end();
  }
};