# NEXTASK - Website Quản Lý Công Việc

NEXTASK là một ứng dụng web hiện đại để quản lý công việc cá nhân và nhóm một cách trực quan, đơn giản và hiệu quả. Người dùng có thể tạo, chỉnh sửa, theo dõi và hoàn thành các nhiệm vụ hàng ngày, từ đó nâng cao năng suất học tập và làm việc.

## Tính Năng Chính

### Cho Người Dùng Thường
- ✅ **Đăng ký và đăng nhập** với mã hóa mật khẩu bcrypt
- ➕ **Tạo công việc** với các thông tin: tiêu đề, nội dung, thời hạn, trạng thái, độ quan trọng, độ khẩn cấp
- 📝 **Chỉnh sửa công việc** - Cập nhật thông tin công việc bất kỳ lúc nào
- ❌ **Xóa công việc** - Loại bỏ công việc không cần thiết
- 📂 **Tạo thẻ/nhãn** tùy chỉnh (tối đa 20 ký tự)
- 🔍 **Tìm kiếm và lọc** công việc theo tiêu đề, thời hạn, trạng thái, nhãn
- ↕️ **Sắp xếp** công việc theo: deadline, trạng thái, độ quan trọng, độ khẩn cấp
- 📊 **Thống kê cá nhân** - Xem số lượng và tỷ lệ công việc hoàn thành
- 🎯 **Quản lý trạng thái** - Chuyển công việc giữa: Chưa Làm → Đang Làm → Đã Làm

### Cho Quản Trị Viên
- 🔐 **Đăng nhập quản trị** với thông tin được mã hóa
- 👥 **Quản lý tài khoản** - Xem danh sách người dùng
- 🔒 **Khóa/mở khóa tài khoản** - Quản lý hoạt động của người dùng
- 📊 **Thống kê hệ thống**:
  - Tổng số người dùng hoạt động
  - Tổng số công việc trong hệ thống
  - Số công việc đã hoàn thành
  - Tỷ lệ hoàn thành công việc
  - Thống kê sử dụng: số lần đăng nhập, thời gian sử dụng

## Yêu Cầu Kỹ Thuật

### Backend
- Node.js >= 14.0
- npm >= 6.0

### Công Nghệ Sử Dụng
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Backend**: Express.js
- **Database**: SQLite3
- **Authentication**: bcryptjs (mã hóa mật khẩu)
- **Session**: express-session

### Yêu Cầu Phi Chức Năng
- Thời gian phản hồi ≤ 5 giây
- Hỗ trợ tối thiểu 20 người dùng đồng thời
- Tối đa 100 công việc và 100 thẻ per người dùng
- Giao diện đơn giản, dễ sử dụng, hoạt động tốt trên các trình duyệt
- Ngôn ngữ: Tiếng Việt
- Hệ thống mở rộng mà không cần thay đổi kiến trúc chính

## Cài Đặt

### 1. Clone Repository
```bash
git clone <repository-url>
cd NexTask
```

### 2. Cài Đặt Dependencies
```bash
npm install
```

### 3. Chạy Server
```bash
npm start
```

Server sẽ chạy tại `http://localhost:3000`

### 4. Truy Cập Ứng Dụng
- Mở trình duyệt và truy cập: `http://localhost:3000`
- Đăng ký tài khoản người dùng hoặc đăng nhập bằng tài khoản quản trị

## Tài Khoản Mặc Định

### Quản Trị Viên
- **Email**: admin@nextask.com
- **Mật khẩu**: admin123

## Cấu Trúc Thư Mục

```
NexTask/
├── public/
│   ├── index.html          # Giao diện chính
│   ├── css/
│   │   └── style.css       # Styling
│   └── js/
│       └── app.js          # Logic ứng dụng
├── db.js                   # Khởi tạo cơ sở dữ liệu
├── server.js               # Server chính với API routes
├── package.json            # Thông tin dự án
└── README.md              # Tài liệu này
```

## Cơ Sở Dữ Liệu

### Bảng Chính

#### users (Người Dùng)
- user_id (PK)
- username (UNIQUE)
- email (UNIQUE)
- password (mã hóa)
- created_at
- last_login
- is_active

#### tasks (Công Việc)
- task_id (PK)
- user_id (FK)
- title
- content
- deadline
- status (todo/in_progress/done)
- importance (low/medium/high)
- urgency (low/medium/high)
- created_at
- updated_at

#### tags (Thẻ/Nhãn)
- tag_id (PK)
- user_id (FK)
- name (tối đa 20 ký tự)
- created_at

#### task_tags (Gắn Thẻ cho Công Việc)
- task_id (FK)
- tag_id (FK)

#### login_history (Lịch Sử Đăng Nhập)
- login_id (PK)
- user_id (FK)
- start_time
- end_time
- activity_duration (tính bằng giây)

#### admins (Quản Trị Viên)
- admin_id (PK)
- email (UNIQUE)
- password (mã hóa)
- created_at

## API Endpoints

### Authentication
- `POST /api/register` - Đăng ký
- `POST /api/login` - Đăng nhập
- `POST /api/logout` - Đăng xuất
- `GET /api/user` - Lấy thông tin người dùng hiện tại

### Tasks
- `GET /api/tasks` - Lấy tất cả công việc (hỗ trợ filter, search, sort)
- `GET /api/tasks/:id` - Lấy chi tiết công việc
- `POST /api/tasks` - Tạo công việc mới
- `PUT /api/tasks/:id` - Cập nhật công việc
- `DELETE /api/tasks/:id` - Xóa công việc

### Tags
- `GET /api/tags` - Lấy tất cả thẻ
- `POST /api/tags` - Tạo thẻ mới
- `DELETE /api/tags/:id` - Xóa thẻ

### Admin
- `POST /api/admin/login` - Đăng nhập quản trị
- `POST /api/admin/logout` - Đăng xuất quản trị
- `GET /api/admin/users` - Lấy danh sách người dùng
- `PUT /api/admin/users/:id/status` - Thay đổi trạng thái người dùng
- `GET /api/admin/statistics` - Lấy thống kê hệ thống

## Hướng Dùng

### 1. Đăng Ký Tài Khoản
1. Trên màn hình chính, chọn "Đăng ký ngay"
2. Nhập tên người dùng, email và mật khẩu
3. Nhấn "Đăng Ký"

### 2. Đăng Nhập
1. Nhập email và mật khẩu
2. Nhấn "Đăng Nhập"

### 3. Tạo Công Việc
1. Nhấn nút "➕ Thêm Công Việc Mới"
2. Điền thông tin: tiêu đề, nội dung, thời hạn, etc.
3. Chọn các thẻ phù hợp (tùy chọn)
4. Nhấn "Lưu"

### 4. Quản Lý Công Việc
- **Xem chi tiết**: Nhấn vào công việc
- **Chỉnh sửa**: Nhấn nút "✏️ Sửa"
- **Xóa**: Nhấn nút "🗑️ Xóa"
- **Lọc**: Sử dụng nút lọc ở bên trái
- **Sắp xếp**: Sử dụng dropdown "Sắp xếp"

### 5. Quản Trị
1. Nhấn "Quản trị viên" trên màn hình đăng nhập
2. Nhập email và mật khẩu admin
3. Xem thống kê và quản lý người dùng

## Phát Triển

### Chạy ở chế độ Development
```bash
npm run dev
```

Server sẽ tự động reload khi có thay đổi file.

### Cấu Trúc Code Frontend

**app.js** chứa các module:
- Auth (đăng ký, đăng nhập)
- Tasks (CRUD công việc)
- Tags (quản lý thẻ)
- Admin (thống kê, quản lý người dùng)
- UI (hiển thị, modal)

## Tối Ưu Hóa

### Performance
- Pagination có thể được thêm cho danh sách dài
- Caching kết quả tìm kiếm
- Lazy loading hình ảnh (nếu có)

### Security
- ✅ Mã hóa mật khẩu với bcryptjs
- ✅ Session-based authentication
- ✅ CORS protection
- 🔄 Có thể thêm JWT tokens
- 🔄 HTTPS trong production

## Troubleshooting

### Lỗi: "Cannot find module 'sqlite3'"
```bash
npm install
```

### Lỗi: "Port 3000 already in use"
```bash
# Thay đổi port
PORT=3001 npm start
```

### Database bị corrupted
```bash
# Xóa database cũ
rm nextask.db

# Chạy lại server để tạo mới
npm start
```

## Đóng Góp

Chúng tôi hoan nghênh những đóng góp và cải tiến. Vui lòng:
1. Fork repository
2. Tạo branch feature (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - xem file LICENSE để chi tiết

## Liên Hệ

- **Nhóm trưởng**: Hà Thái San
- **Thành viên**: Giang Thành Vinh
- **Trường**: Trường Đại Học Bách Khoa Hà Nội

## Changelog

### v1.0.0 (2026-06-12)
- ✅ Chức năng quản lý công việc cơ bản
- ✅ Hệ thống xác thực người dùng
- ✅ Tạo và quản lý thẻ
- ✅ Tìm kiếm, lọc, sắp xếp công việc
- ✅ Dashboard quản trị với thống kê
- ✅ Responsive design cho mobile

## Phát Triển Tiếp Theo

Các tính năng được dự kiến trong tương lai:
- 🔄 Hỗ trợ Team collaboration
- 📱 Mobile app
- 📅 Calendar view
- 🔔 Notifications
- 📧 Email reminders
- 📈 Advanced analytics
- 🌙 Dark mode
- 🌐 Multiple languages

---

Cảm ơn bạn đã sử dụng NEXTASK! 🚀