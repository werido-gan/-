// 管理员账号初始化脚本
const { createConnection } = require('typeorm');
const { User, Role } = require('../dist/users/entities/user.entity');
const bcrypt = require('bcrypt');

// 管理员账号配置
const adminConfig = {
  username: 'admin',
  password: 'Admin1234', // 可以根据需要修改密码
  email: 'admin@logistics.example.com',
  role: Role.ADMIN
};

async function initAdminUser() {
  console.log('=== 开始初始化管理员账号 ===');
  
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
    
    // 检查管理员账号是否已存在
    const existingAdmin = await connection.getRepository(User).findOne({
      where: { username: adminConfig.username }
    });
    
    if (existingAdmin) {
      console.log('⚠️  管理员账号已存在');
      console.log(`   用户名: ${existingAdmin.username}`);
      console.log(`   邮箱: ${existingAdmin.email}`);
      console.log(`   角色: ${existingAdmin.role}`);
    } else {
      // 创建管理员账号
      const hashedPassword = await bcrypt.hash(adminConfig.password, 10);
      
      const newAdmin = connection.getRepository(User).create({
        ...adminConfig,
        password: hashedPassword
      });
      
      await connection.getRepository(User).save(newAdmin);
      
      console.log('✓ 管理员账号创建成功');
      console.log(`   用户名: ${newAdmin.username}`);
      console.log(`   密码: ${adminConfig.password}`); // 只在创建时显示明文密码
      console.log(`   邮箱: ${newAdmin.email}`);
      console.log(`   角色: ${newAdmin.role}`);
    }
    
    // 关闭数据库连接
    await connection.close();
    console.log('✓ 数据库连接已关闭');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行初始化脚本
initAdminUser();
