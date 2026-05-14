const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();

// 阿里云OSS配置
const client = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'selfmadesoftwaredownloadwebsite'
});

// 数据库初始化
const db = new sqlite3.Database('software.db');
// 修改数据库初始化部分
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS software (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    filePath TEXT NOT NULL,
    uploadTime DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      taobaoLink TEXT,
      productImageUrl TEXT,
      qrCodeUrl TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// 添加广告相关路由
app.post('/api/ads', upload.fields([
    { name: 'productImage', maxCount: 1 },
    { name: 'qrCode', maxCount: 1 }
]), async (req, res) => {
    const { title, content, taobaoLink } = req.body;
    
    try {
        // 上传图片到OSS
        const productImageUrl = req.files.productImage ? 
            (await client.put(`ads/${req.files.productImage[0].originalname}`, req.files.productImage[0].path)).url : null;
        
        const qrCodeUrl = req.files.qrCode ? 
            (await client.put(`ads/${req.files.qrCode[0].originalname}`, req.files.qrCode[0].path)).url : null;

        db.run(
            'INSERT INTO ads (title, content, taobaoLink, productImageUrl, qrCodeUrl) VALUES (?, ?, ?, ?, ?)',
            [title, content, taobaoLink, productImageUrl, qrCodeUrl],
            function(err) {
                if (err) return res.status(500).json({ error: '数据库错误' });
                res.json({ success: true });
            }
        );
    } catch (err) {
        console.error('广告上传错误:', err);
        res.status(500).json({ error: '广告上传失败' });
    }
});

app.get('/api/ads', (req, res) => {
    db.all('SELECT * FROM ads ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        res.json(rows);
    });
});

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// 用户认证相关（示例数据，实际应使用数据库）
const users = [];
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

// 路由处理
// 获取软件列表
app.get('/api/software', (req, res) => {
  db.all('SELECT * FROM software ORDER BY uploadTime DESC', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    // 过滤文件类型
    const filteredSoftware = rows.filter(row => {
      const fileExtension = path.extname(row.filePath).toLowerCase();
      return allowedFileTypes.includes(fileExtension);
    });
    
    res.json(filteredSoftware);
  });
});

// 文件上传处理
const allowedFileTypes = ['.exe']; // 允许的文件类型

app.post('/upload', authenticateAdmin, upload.single('softwareFile'), async (req, res) => {
    const { softwareName, softwareDescription, downloadSource } = req.body;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedFileTypes.includes(fileExtension)) {
        return res.status(400).json({ error: '仅支持.exe文件' });
    }
    
    try {
        // 上传到阿里云OSS
        const ossResult = await client.put(`software/${req.file.originalname}`, req.file.path);
        
        const newSoftware = {
            id: Date.now().toString(),
            name: softwareName,
            description: softwareDescription,
            fileUrl: ossResult.url,
            sourceType: 'oss' // 标记来源为OSS
        };

        db.run(`INSERT INTO software (id, name, description, filePath, sourceType) VALUES (?, ?, ?, ?, ?)`,
            [newSoftware.id, newSoftware.name, newSoftware.description, newSoftware.fileUrl, newSoftware.sourceType],
            function(err) {
                if (err) return handleDatabaseError(err, res);
                res.json({ success: true });
            }
        );
    } catch (err) {
        console.error('OSS upload error:', err);
        res.status(500).json({ error: '文件上传失败' });
    }
});

// 下载验证
app.post('/api/download/:id', (req, res) => {
  const { password } = req.body;
  if (password !== 'correctPassword') {
    return res.status(401).json({ error: '密码错误' });
  }

  db.get('SELECT filePath FROM software WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: '软件未找到' });
    }
    // 直接返回OSS的下载链接
    res.redirect(row.filePath);
  });
});

// 用户注册
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: '用户不存在' });

  try {
    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: '密码错误' });
    }
  } catch (err) {
    res.status(500).json({ error: '登录失败' });
  }
});

// 留言功能
app.get('/api/messages', (req, res) => {
  db.all('SELECT * FROM messages ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json(rows);
  });
});

app.post('/api/messages', (req, res) => {
  const { username, message } = req.body;
  db.run(
    'INSERT INTO messages (username, message) VALUES (?, ?)',
    [username, message],
    function(err) {
      if (err) return res.status(500).json({ error: '数据库错误' });
      res.json({ success: true });
    }
  );
});

// 认证中间件
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: '未授权访问' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: '无效令牌' });
    req.user = user;
    next();
  });
}

// 静态文件服务
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.use((req, res) => {
  res.status(404).json({ error: '资源未找到' });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('文件存储位置：阿里云OSS selfmadesoftwaredownloadwebsite');
});