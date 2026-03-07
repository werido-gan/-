const mysql = require('mysql2');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建数据库连接
const connection = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'logistics'
});

// 连接数据库
connection.connect(err => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功!');
  
  // 查询用户表（复数形式）
  connection.query('SELECT * FROM users;', (err, results) => {
    if (err) {
      console.error('查询用户表失败:', err);
      connection.end();
      return;
    }
    
    console.log('用户表内容:');
    console.table(results);
    
    if (results.length === 0) {
      console.log('\n⚠️  数据库中没有用户，请先注册用户!');
    }
    
    connection.end();
  });
});
