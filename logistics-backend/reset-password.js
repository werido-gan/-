require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USERNAME);
console.log('DB_PASS:', process.env.DB_PASSWORD);
const { createConnection } = require('typeorm');
const { User } = require('./dist/users/entities/user.entity');
const bcrypt = require('bcrypt');

async function resetAdminPassword() {
  console.log('=== 开始重置管理员密码 ===');
  
  try {
    // 创建数据库连接
    const connection = await createConnection({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'logistics',
      entities: [
        User
      ],
      synchronize: false
    });
    
    console.log('✓ 数据库连接成功');
    
    // 查找管理员账号
    const adminUser = await connection.getRepository(User).findOne({
      where: { username: 'admin' }
    });
    
    if (!adminUser) {
      console.log('  管理员账号不存在');
      return;
    }
    
    // 重置密码为 Admin1234
    const newPassword = 'Admin1234';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    adminUser.password = hashedPassword;
    await connection.getRepository(User).save(adminUser);
    
    console.log(' 管理员密码重置成功');
    console.log(`   用户名: ${adminUser.username}`);
    console.log(`   新密码: ${newPassword}`);
    console.log(`   邮箱: ${adminUser.email}`);
    console.log(`   角色: ${adminUser.role}`);
    
    // 关闭数据库连接
    await connection.close();
    console.log(' 数据库连接已关闭');
    
  } catch (error) {
    console.error(' 重置密码失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行重置密码脚本
resetAdminPassword();