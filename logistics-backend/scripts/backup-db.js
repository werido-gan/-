const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'logistics'
};

// 备份目录
const backupDir = path.resolve(__dirname, '../backups');

// 确保备份目录存在
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 生成备份文件名
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFileName = `${dbConfig.database}-${timestamp}.sql`;
const backupPath = path.resolve(backupDir, backupFileName);

// 执行备份命令
const backupCommand = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p${dbConfig.password} ${dbConfig.database} > "${backupPath}"`;

console.log(`开始备份数据库: ${dbConfig.database}`);
console.log(`备份文件路径: ${backupPath}`);

exec(backupCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('备份失败:', error.message);
    process.exit(1);
  }
  
  if (stderr) {
    // MySQL可能会将密码警告输出到stderr，但不影响备份
    if (stderr.includes('Warning: Using a password on the command line interface can be insecure')) {
      console.log('注意: 使用命令行输入密码可能不安全');
    } else {
      console.error('备份过程中出现警告:', stderr);
    }
  }
  
  console.log('数据库备份成功完成!');
  
  // 计算备份文件大小
  const stats = fs.statSync(backupPath);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`备份文件大小: ${fileSizeInMB} MB`);
  
  // 清理旧备份（保留最近7天的备份）
  cleanOldBackups();
});

// 清理旧备份函
function cleanOldBackups() {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000; // 7天前的时间戳
  
  fs.readdir(backupDir, (err, files) => {
    if (err) {
      console.error('读取备份目录失败:', err.message);
      return;
    }
    
    let deletedCount = 0;
    
    files.forEach(file => {
      const filePath = path.resolve(backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && stats.mtime.getTime() < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`已删除旧备份: ${file}`);
      }
    });
    
    if (deletedCount === 0) {
      console.log('没有需要清理的旧备份');
    } else {
      console.log(`共清理了 ${deletedCount} 个旧备份`);
    }
  });
}
