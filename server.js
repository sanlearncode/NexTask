const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'nextask-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session.adminId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ============= USER ROUTES =============

// Register user
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.json({ message: 'Registration successful' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

    // Create login session
    const loginSession = await db.get(
      'INSERT INTO login_history (user_id) VALUES (?) RETURNING login_id',
      [user.user_id]
    );

    req.session.userId = user.user_id;
    req.session.username = user.username;
    req.session.loginId = loginSession?.login_id;

    res.json({ 
      message: 'Login successful',
      user: { user_id: user.user_id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout user
app.post('/api/logout', requireAuth, async (req, res) => {
  try {
    if (req.session.loginId) {
      const duration = Math.floor((Date.now() - req.session.startTime) / 1000);
      await db.run(
        'UPDATE login_history SET end_time = CURRENT_TIMESTAMP, activity_duration = ? WHERE login_id = ?',
        [duration, req.session.loginId]
      );
    }
    req.session.destroy();
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/user', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT user_id, username, email FROM users WHERE user_id = ?', [req.session.userId]);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= TASK ROUTES =============

// Create task
app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { title, content, deadline, status, importance, urgency, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await db.run(
      `INSERT INTO tasks (user_id, title, content, deadline, status, importance, urgency) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.session.userId, title, content, deadline, status || 'todo', importance || 'medium', urgency || 'medium']
    );

    const taskId = result.lastID;

    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        await db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, tagId]);
      }
    }

    res.json({ message: 'Task created', task_id: taskId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks for user
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { status, search, sortBy, order } = req.query;
    let query = `
      SELECT t.*, GROUP_CONCAT(tg.tag_id) as tag_ids, GROUP_CONCAT(tgs.name) as tag_names
      FROM tasks t
      LEFT JOIN task_tags tg ON t.task_id = tg.task_id
      LEFT JOIN tags tgs ON tg.tag_id = tgs.tag_id
      WHERE t.user_id = ?
    `;
    const params = [req.session.userId];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (t.title LIKE ? OR t.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY t.task_id';

    if (sortBy) {
      const sortField = {
        'deadline': 'deadline',
        'status': 'status',
        'importance': 'importance',
        'urgency': 'urgency',
        'created': 'created_at'
      }[sortBy] || 'created_at';
      query += ` ORDER BY ${sortField} ${order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      query += ' ORDER BY deadline ASC';
    }

    const tasks = await db.all(query, params);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single task
app.get('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await db.get(
      `SELECT t.*, GROUP_CONCAT(tg.tag_id) as tag_ids
       FROM tasks t
       LEFT JOIN task_tags tg ON t.task_id = tg.task_id
       WHERE t.task_id = ? AND t.user_id = ?
       GROUP BY t.task_id`,
      [req.params.id, req.session.userId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { title, content, deadline, status, importance, urgency, tags } = req.body;

    // Verify ownership
    const task = await db.get('SELECT user_id FROM tasks WHERE task_id = ?', [req.params.id]);
    if (!task || task.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.run(
      `UPDATE tasks SET title = ?, content = ?, deadline = ?, status = ?, importance = ?, urgency = ?, updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`,
      [title, content, deadline, status, importance, urgency, req.params.id]
    );

    // Update tags
    await db.run('DELETE FROM task_tags WHERE task_id = ?', [req.params.id]);
    if (tags && Array.isArray(tags)) {
      for (const tagId of tags) {
        await db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [req.params.id, tagId]);
      }
    }

    res.json({ message: 'Task updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await db.get('SELECT user_id FROM tasks WHERE task_id = ?', [req.params.id]);
    if (!task || task.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.run('DELETE FROM tasks WHERE task_id = ?', [req.params.id]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= TAG ROUTES =============

// Create tag
app.post('/api/tags', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.length > 20) {
      return res.status(400).json({ error: 'Tag name must be 1-20 characters' });
    }

    const result = await db.run(
      'INSERT INTO tags (user_id, name) VALUES (?, ?)',
      [req.session.userId, name]
    );

    res.json({ message: 'Tag created', tag_id: result.lastID });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all tags for user
app.get('/api/tags', requireAuth, async (req, res) => {
  try {
    const tags = await db.all(
      'SELECT tag_id, name FROM tags WHERE user_id = ? ORDER BY name ASC',
      [req.session.userId]
    );
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete tag
app.delete('/api/tags/:id', requireAuth, async (req, res) => {
  try {
    const tag = await db.get('SELECT user_id FROM tags WHERE tag_id = ?', [req.params.id]);
    if (!tag || tag.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.run('DELETE FROM tags WHERE tag_id = ?', [req.params.id]);
    res.json({ message: 'Tag deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ADMIN ROUTES =============

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const admin = await db.get('SELECT * FROM admins WHERE email = ?', [email]);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.adminId = admin.admin_id;
    res.json({ message: 'Admin login successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout successful' });
});

// Get user list (admin)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.all(
      `SELECT user_id, username, email, created_at, last_login, is_active, 
              (SELECT COUNT(*) FROM tasks WHERE user_id = users.user_id) as task_count
       FROM users ORDER BY created_at DESC`
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lock/Unlock user (admin)
app.put('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.run('UPDATE users SET is_active = ? WHERE user_id = ?', [is_active, req.params.id]);
    res.json({ message: 'User status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics (admin)
app.get('/api/admin/statistics', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const totalTasks = await db.get('SELECT COUNT(*) as count FROM tasks');
    const completedTasks = await db.get("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'");
    const inProgressTasks = await db.get("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'");
    
    const usageStats = await db.all(`
      SELECT u.user_id, u.username, COUNT(lh.login_id) as login_count, SUM(lh.activity_duration) as total_usage_seconds
      FROM users u
      LEFT JOIN login_history lh ON u.user_id = lh.user_id
      WHERE u.is_active = 1
      GROUP BY u.user_id
      ORDER BY total_usage_seconds DESC
    `);

    const completionRate = totalTasks.count > 0 
      ? ((completedTasks.count / totalTasks.count) * 100).toFixed(2)
      : 0;

    res.json({
      totalUsers: totalUsers.count,
      totalTasks: totalTasks.count,
      completedTasks: completedTasks.count,
      inProgressTasks: inProgressTasks.count,
      completionRate: completionRate,
      usageStats: usageStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'NEXTASK API is running' });
});

// Root route - serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NEXTASK server running on http://localhost:${PORT}`);
});
