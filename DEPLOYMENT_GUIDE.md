# NEXTASK - Hướng Dẫn Triển Khai & Phát Triển

## 📋 Mục Lục

1. [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
2. [Cài Đặt Ban Đầu](#cài-đặt-ban-đầu)
3. [Chạy Ứng Dụng](#chạy-ứng-dụng)
4. [Kiến Trúc & Thiết Kế](#kiến-trúc--thiết-kế)
5. [Các Tính Năng Chi Tiết](#các-tính-năng-chi-tiết)
6. [Xử Lý Lỗi](#xử-lý-lỗi)
7. [Triển Khai Production](#triển-khai-production)

---

## 🔧 Yêu Cầu Hệ Thống

### Bắt Buộc
- **Node.js**: v14.0 hoặc cao hơn
  - Tải từ: https://nodejs.org/
  - Kiểm tra: `node --version` và `npm --version`

- **npm**: v6.0 hoặc cao hơn (thường kèm theo Node.js)

### Tùy Chọn
- **Visual Studio Code**: Để phát triển
- **Git**: Để quản lý phiên bản
- **SQLite Browser**: Để kiểm tra database

### Hệ Điều Hành Hỗ Trợ
- Windows 10/11
- macOS 10.15+
- Linux (Ubuntu 18.04+, Debian 10+)

---

## 🚀 Cài Đặt Ban Đầu

### Bước 1: Clone Repository

```bash
git clone https://github.com/sanlearncode/NexTask.git
cd NexTask
```

### Bước 2: Cài Đặt Dependencies

```bash
npm install
```

Lệnh này sẽ:
- Tải xuống tất cả các gói cần thiết
- Tạo folder `node_modules/`
- Cập nhật `package-lock.json`

**Các gói được cài đặt:**
- `express` (v4.18.2) - Framework web backend
- `sqlite3` (v5.1.6) - Database driver
- `bcryptjs` (v2.4.3) - Mã hóa mật khẩu
- `express-session` (v1.17.3) - Session management
- `cors` (v2.8.5) - Cross-origin support
- `dotenv` (v16.0.3) - Environment variables

### Bước 3: Khởi Tạo Database

Database sẽ tự động được tạo khi chạy server lần đầu tiên. Không cần setup thêm.

---

## ▶️ Chạy Ứng Dụng

### Chế Độ Development (Với Auto-Reload)

```bash
npm run dev
```

**Lưu ý**: Cần cài đặt `nodemon` (package dev)

Khi chạy:
- Server sẽ chạy tại: `http://localhost:3000`
- Mỗi khi thay đổi file `.js` hoặc `.html`, server tự động reload

### Chế Độ Production

```bash
npm start
```

Hoặc chỉ định port:
```bash
PORT=8080 npm start
```

Khi chạy:
- Server sẽ chạy tại: `http://localhost:3000` (hoặc port được chỉ định)
- Logs sẽ được hiển thị trong console

### Truy Cập Ứng Dụng

1. Mở trình duyệt web
2. Truy cập: `http://localhost:3000`
3. Bạn sẽ thấy màn hình đăng nhập

---

## 🏗️ Kiến Trúc & Thiết Kế

### Cấu Trúc Folder

```
NexTask/
├── public/                   # Frontend files (static)
│   ├── index.html           # Main page
│   ├── css/
│   │   └── style.css        # All styling
│   └── js/
│       └── app.js           # Frontend logic
├── db.js                    # Database initialization & setup
├── server.js                # Backend API server
├── package.json             # Project configuration
├── package-lock.json        # Locked dependency versions
├── nextask.db              # SQLite database (auto-created)
└── README.md               # Documentation
```

### Kiến Trúc Ứng Dụng

```
┌─────────────────────────────────────────────┐
│         Browser (Client-Side)                │
│  ┌───────────────────────────────────────┐   │
│  │    HTML/CSS/JavaScript (app.js)      │   │
│  │  - User Interface                    │   │
│  │  - Form handling                     │   │
│  │  - Real-time updates                 │   │
│  └───────────────────────────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │ HTTP/JSON
                  ▼
┌─────────────────────────────────────────────┐
│     Node.js/Express Server (server.js)      │
│  ┌───────────────────────────────────────┐   │
│  │  API Routes:                          │   │
│  │  - /api/auth (login, register)        │   │
│  │  - /api/tasks (CRUD)                  │   │
│  │  - /api/tags (CRUD)                   │   │
│  │  - /api/admin/* (statistics)          │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │  Middleware:                          │   │
│  │  - Session management                 │   │
│  │  - Authentication                     │   │
│  │  - Error handling                     │   │
│  └───────────────────────────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │ SQL queries
                  ▼
┌─────────────────────────────────────────────┐
│     SQLite Database (nextask.db)            │
│  ┌───────────────────────────────────────┐   │
│  │  Tables:                              │   │
│  │  - users: 👤 user accounts           │   │
│  │  - tasks: ✓ task entries             │   │
│  │  - tags: 🏷️  labels/categories       │   │
│  │  - task_tags: task-label mapping      │   │
│  │  - admins: 👨‍💼 admin accounts         │   │
│  │  - login_history: 📊 usage tracking   │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Luồng Xác Thực

```
┌─────────────────────────────────────────────────┐
│  1. User nhập email & password                   │
│     ↓                                             │
│  2. Frontend gửi POST /api/login                 │
│     ↓                                             │
│  3. Server nhận request                          │
│     ├─ Kiểm tra email có tồn tại?               │
│     ├─ Kiểm tra mật khẩu (bcrypt compare)       │
│     ├─ Nếu OK: Tạo session                      │
│     └─ Nếu lỗi: Trả về lỗi                      │
│     ↓                                             │
│  4. Server trả về user info & cookie session    │
│     ↓                                             │
│  5. Frontend lưu user vào memory                │
│     ↓                                             │
│  6. Hiển thị dashboard                          │
└─────────────────────────────────────────────────┘
```

---

## ✨ Các Tính Năng Chi Tiết

### 1. Quản Lý Công Việc

#### Tạo Công Việc
- **Thông tin cần thiết:**
  - Tiêu đề (bắt buộc)
  - Nội dung (tùy chọn)
  - Thời hạn (tùy chọn)
  - Trạng thái: Chưa Làm / Đang Làm / Đã Làm
  - Độ quan trọng: Thấp / Trung Bình / Cao
  - Độ khẩn cấp: Thấp / Trung Bình / Cao
  - Thẻ (gắn 0 hoặc nhiều thẻ)

#### Sắp Xếp & Lọc
- **Lọc theo:**
  - Trạng thái công việc
  - Thẻ/Nhãn
  
- **Sắp xếp theo:**
  - Deadline (ngày hết hạn)
  - Trạng thái
  - Độ quan trọng
  - Độ khẩn cấp
  - Mặc định: Deadline tăng dần

#### Tìm Kiếm
- Tìm kiếm theo tiêu đề và nội dung
- Real-time khi nhập

### 2. Hệ Thống Thẻ

- **Tạo thẻ:** Tên tối đa 20 ký tự
- **Gắn thẻ:** Gắn nhiều thẻ cho một công việc
- **Xóa thẻ:** Xóa thẻ sẽ gỡ khỏi tất cả công việc
- **Phân loại:** Dùng để phân loại công việc theo danh mục

### 3. Thống Kê Cá Nhân

Người dùng có thể xem:
- Tổng số công việc
- Số công việc hoàn thành
- Tỷ lệ hoàn thành (%)

### 4. Quản Trị Viên

#### Thống Kê Hệ Thống
- 👥 Tổng số người dùng hoạt động
- 📋 Tổng số công việc tạo
- ✅ Số công việc đã hoàn thành
- 📊 Tỷ lệ hoàn thành (%)
- ⏱️ Thời gian sử dụng trung bình

#### Quản Lý Người Dùng
- Xem danh sách tất cả người dùng
- Xem thông tin: tên, email, ngày tạo, công việc
- Khóa/mở khóa tài khoản (không hoạt động)
- Theo dõi lần đăng nhập gần nhất

---

## 🐛 Xử Lý Lỗi

### Lỗi Phổ Biến & Giải Pháp

#### 1. "Cannot find module 'bcryptjs'"

**Nguyên nhân:** Dependencies chưa được cài đặt

**Giải pháp:**
```bash
npm install
```

#### 2. "EADDRINUSE :::3000"

**Nguyên nhân:** Port 3000 đã được sử dụng

**Giải pháp:**
```bash
# Option 1: Thay đổi port
PORT=3001 npm start

# Option 2: Tìm process đang chạy trên port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Option 2: Tìm process đang chạy trên port 3000 (macOS/Linux)
lsof -i :3000
kill -9 <PID>
```

#### 3. "SQLITE_CANTOPEN"

**Nguyên nhân:** Không có quyền ghi vào thư mục

**Giải pháp:**
```bash
# Kiểm tra quyền
ls -la nextask.db

# Cấp quyền (Linux/macOS)
chmod 644 nextask.db
```

#### 4. Database bị lock

**Nguyên nhân:** Có process khác đang truy cập database

**Giải pháp:**
```bash
# Xóa database cũ
rm nextask.db

# Chạy lại server (sẽ tạo database mới)
npm start
```

#### 5. Session hết hạn khi đặt lâu

**Nguyên nhân:** Cookie session hết hạn (24 giờ)

**Giải pháp:**
```bash
# Đăng nhập lại
# Hoặc sửa cookie maxAge trong server.js (dòng ~28)
```

### Xem Logs & Debug

```bash
# Chạy server với debug verbose
DEBUG=* npm start

# Hoặc sử dụng Visual Studio Code debugger
# Tạo file .vscode/launch.json:
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch NEXTASK",
      "program": "${workspaceFolder}/server.js",
      "restart": true,
      "console": "integratedTerminal"
    }
  ]
}
```

---

## 🌐 Triển Khai Production

### Chuẩn Bị

1. **Update package.json:**
```json
{
  "engines": {
    "node": ">=14.0.0",
    "npm": ">=6.0.0"
  }
}
```

2. **Tạo file .env:**
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=./nextask.db
```

3. **Update server.js cho production:**
```javascript
// Thêm vào server.js
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));
  // Thêm security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
}
```

### Triển Khai trên Heroku

```bash
# 1. Cài đặt Heroku CLI
# Download từ: https://devcenter.heroku.com/articles/heroku-cli

# 2. Login vào Heroku
heroku login

# 3. Tạo app mới
heroku create nextask-app

# 4. Deploy
git push heroku main

# 5. Xem logs
heroku logs --tail
```

### Triển Khai trên DigitalOcean

```bash
# 1. SSH vào server
ssh root@your_server_ip

# 2. Cài đặt Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone repo
git clone https://github.com/yourusername/NexTask.git
cd NexTask

# 4. Cài dependencies
npm install

# 5. Chạy với PM2 (process manager)
npm install -g pm2
pm2 start server.js --name "nextask"
pm2 save

# 6. Cấu hình nginx (reverse proxy)
# Sửa /etc/nginx/sites-available/default
server {
    listen 80;
    server_name your_domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}

# 7. Restart nginx
sudo systemctl restart nginx
```

### Triển Khai trên Docker

Tạo file `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

Tạo file `docker-compose.yml`:

```yaml
version: '3.8'
services:
  nextask:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./nextask.db:/app/nextask.db
    environment:
      - NODE_ENV=production
```

Chạy:
```bash
docker-compose up -d
```

### Monitoring & Backup

```bash
# Backup database hàng ngày
0 2 * * * cp /path/to/nextask.db /backup/nextask-$(date +\%Y\%m\%d).db

# Kiểm tra server health
curl http://localhost:3000/health
```

---

## 📊 Hiệu Suất & Tối Ưu Hóa

### Current Performance
- Time to First Byte: ~50ms
- Page Load: ~500ms
- API Response: ~100-200ms (chặn không bị quá 5s)

### Tối Ưu Hóa Tiếp Theo
- [ ] Thêm pagination cho danh sách dài
- [ ] Caching với Redis
- [ ] Database indexing trên thường xuyên query
- [ ] Compression (gzip/brotli)
- [ ] CDN cho static files
- [ ] Database pooling

---

## 🔐 Bảo Mật

### Hiện Tại
- ✅ Password hashing với bcryptjs (10 rounds)
- ✅ Session-based authentication
- ✅ CORS enabled
- ✅ SQL injection protection (parameterized queries)

### Nên Thêm
- [ ] Rate limiting
- [ ] CSRF tokens
- [ ] HTTPS/TLS
- [ ] Input validation/sanitization
- [ ] JWT tokens (thay vì session)
- [ ] API key authentication
- [ ] Two-factor authentication

---

## 📞 Support & Issues

Nếu gặp vấn đề:

1. **Kiểm tra logs:**
   ```bash
   # Windows
   echo %APPDATA%\npm\logs
   
   # macOS/Linux
   ~/.npm/_logs
   ```

2. **Xóa cache npm:**
   ```bash
   npm cache clean --force
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Contact:**
   - GitHub Issues: https://github.com/sanlearncode/NexTask/issues
   - Email: your-email@example.com

---

## 📚 Resources

- **Express.js**: https://expressjs.com/
- **SQLite**: https://www.sqlite.org/
- **bcryptjs**: https://github.com/dcodeIO/bcrypt.js
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/

---

**Phiên bản:** 1.0.0  
**Cập nhật lần cuối:** 2026-06-12  
**Licen**: MIT

Cảm ơn bạn đã sử dụng NEXTASK! 🚀
