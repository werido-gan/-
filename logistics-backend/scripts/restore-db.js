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

// 获取命令行参数中的备份文件名
const backupFileName = process.argv[2];

if (!backupFileName) {
  console.error('请提供备份文件名');
  console.log('用法: node scripts/restore-db.js <backup-file-name.sql>');
  process.exit(1);
}

// 检查备份文件是否存在
const backupPath = path.resolve(backupDir, backupFileName);

if (!fs.existsSync(backupPath)) {
  console.error(`备份文件不存在: ${backupPath}`);
  
  // 列出可用的备份文件
  console.log('\n可用的备份文件:');
  try {
    const files = fs.readdirSync(backupDir);
    files
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => fs.statSync(path.resolve(backupDir, b)).mtime - fs.statSync(path.resolve(backupDir, a)).mtime)
      .forEach(file => {
        const stats = fs.statSync(path.resolve(backupDir, file));
        console.log(`${file} (${new Date(stats.mtime).toLocaleString()})`);
      });
  } catch (err) {
    console.error('读取备份目录失败:', err.message);
  }
  
  process.exit(1);
}

// 执行恢复命令
const restoreCommand = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p${dbConfig.password} ${dbConfig.database} < "${backupPath}"`;

console.log(`开始恢复数据库: ${dbConfig.database}`);
console.log(`使用备份文件: ${backupPath}`);

exec(restoreCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('恢复失败:', error.message);
    process.exit(1);
  }
  
  if (stderr) {
    // MySQL可能会将密码警告输出到stderr，但不影响恢复
    if (stderr.includes('Warning: Using a password on the command line interface can be insecure')) {
      console.log('注意: 使用命令行输入密码可能不安全');
    } else {
      console.error('恢复过程中出现警告:', stderr);
    }
  }
  
  console.log('数据库恢复成功完成!');
});
