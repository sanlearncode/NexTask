// ════════════════════════════════════════════════
//  netlify/functions/db.js
//  Kết nối PostgreSQL và khởi tạo schema CSDL
//  theo thiết kế Nhóm 17 – NexTask
// ════════════════════════════════════════════════

const { Client } = require("pg");

// ════════════════════════════════════════════════
//  SQL SCHEMA – tạo đầy đủ 7 bảng theo thiết kế
// ════════════════════════════════════════════════
const INIT_SQL = `

-- ────────────────────────────────────────────────
-- 1. BẢNG QUẢN TRỊ VIÊN
--    Lưu tài khoản admin, dùng để đăng nhập quản trị
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id          SERIAL       PRIMARY KEY,
  email       TEXT         NOT NULL UNIQUE,
  password    TEXT         NOT NULL,          -- mật khẩu đã mã hóa (hash)
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- 2. BẢNG NGƯỜI DÙNG
--    Mỗi người dùng có tên đăng nhập và email duy nhất
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL       PRIMARY KEY,
  username    TEXT         NOT NULL UNIQUE,   -- tên đăng nhập duy nhất trong hệ thống
  email       TEXT         NOT NULL UNIQUE,   -- địa chỉ email duy nhất dùng xác thực
  password    TEXT         NOT NULL,          -- mật khẩu đã mã hóa
  locked      BOOLEAN      NOT NULL DEFAULT FALSE,
  last_login  TIMESTAMPTZ,                    -- thời điểm đăng nhập gần nhất
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- 3. BẢNG LỊCH SỬ HOẠT ĐỘNG
--    Theo dõi từng phiên đăng nhập của người dùng,
--    dùng để thống kê thời gian sử dụng website
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id            SERIAL       PRIMARY KEY,
  user_id       INTEGER      NOT NULL
                             REFERENCES users(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- thời điểm bắt đầu phiên
  ended_at      TIMESTAMPTZ,                          -- thời điểm kết thúc phiên
  duration_sec  INTEGER      NOT NULL DEFAULT 0       -- tổng thời gian phiên (giây)
);

-- ────────────────────────────────────────────────
-- 4. BẢNG THỐNG KÊ
--    Liên kết admin với các lần hoạt động người dùng
--    mà admin đã xem/truy xuất báo cáo
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS statistics (
  id            SERIAL   PRIMARY KEY,
  activity_id   INTEGER  NOT NULL
                         REFERENCES activity_logs(id) ON DELETE CASCADE,
  admin_id      INTEGER  NOT NULL
                         REFERENCES admins(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- 5. BẢNG NHÃN DÁN
--    Mỗi người dùng tạo riêng nhãn dán của mình,
--    tên nhãn tối đa 20 ký tự, không trùng trong cùng user
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          SERIAL       PRIMARY KEY,
  user_id     INTEGER      NOT NULL
                           REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name),
  CONSTRAINT tags_name_max_length CHECK (char_length(name) <= 20)
);

-- ────────────────────────────────────────────────
-- 6. BẢNG CÔNG VIỆC
--    Bảng trung tâm, lưu toàn bộ thông tin công việc
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL      PRIMARY KEY,
  user_id      INTEGER     NOT NULL
                           REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,          -- tiêu đề, hỗ trợ tìm kiếm và lọc
  description  TEXT        NOT NULL DEFAULT '',  -- nội dung chi tiết mô tả công việc
  deadline     DATE,                          -- thời hạn hoàn thành, dùng lọc & sắp xếp
  status       TEXT        NOT NULL DEFAULT 'todo'
               CHECK (status IN ('todo','doing','done')),
               -- trạng thái: chưa làm / đang làm / đã làm
  importance   SMALLINT    NOT NULL DEFAULT 2
               CHECK (importance BETWEEN 1 AND 3),
               -- mức độ quan trọng: 1=thấp, 2=trung bình, 3=cao
  urgency      SMALLINT    NOT NULL DEFAULT 2
               CHECK (urgency BETWEEN 1 AND 3),
               -- mức độ khẩn cấp: 1=thấp, 2=trung bình, 3=cao
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- 7. BẢNG GÁN (task_tags)
--    Quan hệ nhiều-nhiều giữa công việc và nhãn dán
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_tags (
  task_id  INTEGER  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id   INTEGER  NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- ════════════════════════════════════════════════
-- INDEX – tăng tốc các truy vấn thường dùng
-- ════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tasks_user_id    ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline   ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_importance ON tasks(importance);
CREATE INDEX IF NOT EXISTS idx_tasks_urgency    ON tasks(urgency);
CREATE INDEX IF NOT EXISTS idx_tags_user_id     ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_started ON activity_logs(started_at);

-- ════════════════════════════════════════════════
-- SEED – tài khoản admin mặc định
-- password = hash("admin123") = "-539701190"
-- ════════════════════════════════════════════════
INSERT INTO admins (email, password)
VALUES ('admin@nextask.vn', '-539701190')
ON CONFLICT (email) DO NOTHING;
`;

// ════════════════════════════════════════════════
//  getClient – kết nối DB và chạy schema
// ════════════════════════════════════════════════
async function getClient() {
  const client = new Client({
    connectionString: process.env.NETLIFY_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  // Chạy INIT_SQL mỗi cold-start; idempotent nhờ IF NOT EXISTS
  await client.query(INIT_SQL);
  return client;
}

module.exports = { getClient };