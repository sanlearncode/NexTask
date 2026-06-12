# NEXTASK API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All endpoints except `/register`, `/login`, and `/admin/login` require an active session.
Session is maintained via HTTP-only cookies.

---

## 🔐 Authentication Endpoints

### 1. Register User

**Endpoint:** `POST /register`

**Description:** Create a new user account

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Registration successful"
}
```

**Error Response (400):**
```json
{
  "error": "Email already exists"
}
```

---

### 2. Login User

**Endpoint:** `POST /login`

**Description:** Authenticate user and create session

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "user_id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

**Error Response (401):**
```json
{
  "error": "Invalid email or password"
}
```

---

### 3. Logout User

**Endpoint:** `POST /logout`

**Description:** End user session

**Authentication:** Required ✓

**Success Response (200):**
```json
{
  "message": "Logout successful"
}
```

---

### 4. Get Current User

**Endpoint:** `GET /user`

**Description:** Get current logged-in user info

**Authentication:** Required ✓

**Success Response (200):**
```json
{
  "user_id": 1,
  "username": "john_doe",
  "email": "john@example.com"
}
```

---

## 📋 Task Endpoints

### 1. Create Task

**Endpoint:** `POST /tasks`

**Description:** Create a new task

**Authentication:** Required ✓

**Request Body:**
```json
{
  "title": "Complete project report",
  "content": "Finish the quarterly report with all metrics",
  "deadline": "2026-06-30T17:00:00",
  "status": "todo",
  "importance": "high",
  "urgency": "medium",
  "tags": [1, 2]
}
```

**Field Details:**
- `title` (string, required): Task title
- `content` (string, optional): Detailed description
- `deadline` (datetime, optional): ISO 8601 format
- `status` (string): "todo", "in_progress", "done" (default: "todo")
- `importance` (string): "low", "medium", "high" (default: "medium")
- `urgency` (string): "low", "medium", "high" (default: "medium")
- `tags` (array, optional): Tag IDs to attach

**Success Response (200):**
```json
{
  "message": "Task created",
  "task_id": 42
}
```

---

### 2. Get All Tasks

**Endpoint:** `GET /tasks`

**Description:** Get all tasks for current user with filtering and sorting

**Authentication:** Required ✓

**Query Parameters:**
- `status` (optional): Filter by status ("todo", "in_progress", "done")
- `search` (optional): Search in title and content
- `sortBy` (optional): "deadline", "status", "importance", "urgency", "created"
- `order` (optional): "asc" or "desc" (default: "asc")

**Example Request:**
```
GET /tasks?status=todo&sortBy=deadline&order=asc&search=report
```

**Success Response (200):**
```json
[
  {
    "task_id": 1,
    "user_id": 1,
    "title": "Complete project report",
    "content": "Finish the quarterly report...",
    "deadline": "2026-06-30T17:00:00",
    "status": "in_progress",
    "importance": "high",
    "urgency": "medium",
    "created_at": "2026-06-12T10:30:00",
    "updated_at": "2026-06-12T14:20:00",
    "tag_ids": "1,2",
    "tag_names": "work,urgent"
  },
  {
    "task_id": 2,
    "user_id": 1,
    "title": "Review code",
    "content": null,
    "deadline": null,
    "status": "todo",
    "importance": "medium",
    "urgency": "low",
    "created_at": "2026-06-11T09:00:00",
    "updated_at": "2026-06-11T09:00:00",
    "tag_ids": null,
    "tag_names": null
  }
]
```

---

### 3. Get Single Task

**Endpoint:** `GET /tasks/:id`

**Description:** Get detailed information about a specific task

**Authentication:** Required ✓

**Parameters:**
- `id` (integer, path): Task ID

**Success Response (200):**
```json
{
  "task_id": 1,
  "user_id": 1,
  "title": "Complete project report",
  "content": "Finish the quarterly report with all metrics",
  "deadline": "2026-06-30T17:00:00",
  "status": "in_progress",
  "importance": "high",
  "urgency": "medium",
  "created_at": "2026-06-12T10:30:00",
  "updated_at": "2026-06-12T14:20:00",
  "tag_ids": "1,2"
}
```

**Error Response (404):**
```json
{
  "error": "Task not found"
}
```

---

### 4. Update Task

**Endpoint:** `PUT /tasks/:id`

**Description:** Update an existing task

**Authentication:** Required ✓

**Parameters:**
- `id` (integer, path): Task ID

**Request Body:**
```json
{
  "title": "Complete project report - Updated",
  "content": "Updated description...",
  "deadline": "2026-07-01T17:00:00",
  "status": "done",
  "importance": "medium",
  "urgency": "low",
  "tags": [1]
}
```

**Success Response (200):**
```json
{
  "message": "Task updated"
}
```

**Error Response (403):**
```json
{
  "error": "Forbidden"
}
```

---

### 5. Delete Task

**Endpoint:** `DELETE /tasks/:id`

**Description:** Delete a task

**Authentication:** Required ✓

**Parameters:**
- `id` (integer, path): Task ID

**Success Response (200):**
```json
{
  "message": "Task deleted"
}
```

---

## 🏷️ Tag Endpoints

### 1. Create Tag

**Endpoint:** `POST /tags`

**Description:** Create a new tag

**Authentication:** Required ✓

**Request Body:**
```json
{
  "name": "work"
}
```

**Constraints:**
- Name must be 1-20 characters
- Unique per user (cannot have duplicate tag names)

**Success Response (200):**
```json
{
  "message": "Tag created",
  "tag_id": 5
}
```

**Error Response (400):**
```json
{
  "error": "Tag name must be 1-20 characters"
}
```

---

### 2. Get All Tags

**Endpoint:** `GET /tags`

**Description:** Get all tags for current user

**Authentication:** Required ✓

**Success Response (200):**
```json
[
  {
    "tag_id": 1,
    "name": "work"
  },
  {
    "tag_id": 2,
    "name": "urgent"
  },
  {
    "tag_id": 3,
    "name": "personal"
  }
]
```

---

### 3. Delete Tag

**Endpoint:** `DELETE /tags/:id`

**Description:** Delete a tag (removed from all tasks)

**Authentication:** Required ✓

**Parameters:**
- `id` (integer, path): Tag ID

**Success Response (200):**
```json
{
  "message": "Tag deleted"
}
```

---

## 👨‍💼 Admin Endpoints

### 1. Admin Login

**Endpoint:** `POST /admin/login`

**Description:** Authenticate as admin

**Request Body:**
```json
{
  "email": "admin@nextask.com",
  "password": "admin123"
}
```

**Success Response (200):**
```json
{
  "message": "Admin login successful"
}
```

**Error Response (401):**
```json
{
  "error": "Invalid credentials"
}
```

---

### 2. Admin Logout

**Endpoint:** `POST /admin/logout`

**Description:** End admin session

**Authentication:** Required ✓ (Admin)

**Success Response (200):**
```json
{
  "message": "Logout successful"
}
```

---

### 3. Get All Users

**Endpoint:** `GET /admin/users`

**Description:** Get list of all users with stats

**Authentication:** Required ✓ (Admin)

**Success Response (200):**
```json
[
  {
    "user_id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "created_at": "2026-06-01T10:00:00",
    "last_login": "2026-06-12T15:30:00",
    "is_active": 1,
    "task_count": 5
  },
  {
    "user_id": 2,
    "username": "jane_smith",
    "email": "jane@example.com",
    "created_at": "2026-05-15T12:00:00",
    "last_login": "2026-06-05T09:15:00",
    "is_active": 0,
    "task_count": 3
  }
]
```

**Field Details:**
- `is_active`: 1 = active, 0 = locked
- `task_count`: Number of tasks created by user
- `last_login`: Most recent login time

---

### 4. Update User Status

**Endpoint:** `PUT /admin/users/:id/status`

**Description:** Lock or unlock a user account

**Authentication:** Required ✓ (Admin)

**Parameters:**
- `id` (integer, path): User ID

**Request Body:**
```json
{
  "is_active": false
}
```

**Success Response (200):**
```json
{
  "message": "User status updated"
}
```

---

### 5. Get System Statistics

**Endpoint:** `GET /admin/statistics`

**Description:** Get comprehensive system statistics

**Authentication:** Required ✓ (Admin)

**Success Response (200):**
```json
{
  "totalUsers": 15,
  "totalTasks": 87,
  "completedTasks": 42,
  "completionRate": "48.28",
  "usageStats": [
    {
      "user_id": 1,
      "username": "john_doe",
      "login_count": 34,
      "total_usage_seconds": 18900
    },
    {
      "user_id": 2,
      "username": "jane_smith",
      "login_count": 22,
      "total_usage_seconds": 12450
    }
  ]
}
```

**Field Details:**
- `completionRate`: Percentage of completed tasks (0-100)
- `total_usage_seconds`: Convert to hours: `seconds / 3600`
- `login_count`: Total number of logins

---

## 🔗 Health Check

### Health Status

**Endpoint:** `GET /health`

**Description:** Check if server is running

**Success Response (200):**
```json
{
  "status": "ok",
  "message": "NEXTASK API is running"
}
```

---

## 📊 Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Task created successfully |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | User not logged in |
| 403 | Forbidden | User trying to modify others' tasks |
| 404 | Not Found | Task ID doesn't exist |
| 500 | Server Error | Database connection error |

---

## 🔄 Common Request/Response Patterns

### Error Response Format

All errors follow this format:
```json
{
  "error": "Description of what went wrong"
}
```

### Pagination (Future)

```
GET /tasks?page=1&limit=20
```

### Search Examples

```
GET /tasks?search=report
GET /tasks?status=in_progress&sortBy=deadline&order=asc
GET /tasks?search=budget&status=todo
```

---

## 🛠️ Testing with cURL

### Example: Create a Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "deadline": "2026-06-15T18:00:00",
    "status": "todo",
    "importance": "medium",
    "tags": [1]
  }' \
  -b "connect.sid=YOUR_SESSION_COOKIE"
```

### Example: Get All Tasks

```bash
curl http://localhost:3000/api/tasks?status=todo&sortBy=deadline \
  -b "connect.sid=YOUR_SESSION_COOKIE"
```

---

## 📝 Rate Limiting (Future Implementation)

Currently not implemented, but recommended:

```
- 100 requests per minute per user
- 1000 requests per minute per IP
```

---

## 🔐 Security Headers (Production)

The API should include these headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 📋 Database Schema Reference

### users
```sql
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  created_at DATETIME,
  last_login DATETIME,
  is_active BOOLEAN
);
```

### tasks
```sql
CREATE TABLE tasks (
  task_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  title TEXT,
  content TEXT,
  deadline DATETIME,
  status TEXT,
  importance TEXT,
  urgency TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

### tags
```sql
CREATE TABLE tags (
  tag_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  name TEXT,
  created_at DATETIME,
  UNIQUE(user_id, name)
);
```

---

## 🚀 Versioning

- **Current Version:** 1.0.0
- **API Version:** /api (v1 implied)
- **Last Updated:** 2026-06-12

Future versions may use:
- `/api/v2/tasks`
- `/api/v3/admin/users`

---

## 📞 Support

For API issues or questions:
- GitHub Issues: https://github.com/sanlearncode/NexTask/issues
- API Response Time SLA: < 5 seconds

---

**End of API Documentation**
