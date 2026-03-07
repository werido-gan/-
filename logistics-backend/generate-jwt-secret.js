const crypto = require('crypto');

// 生成一个64字符的随机字符串作为JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('Generated JWT_SECRET:', jwtSecret);
console.log('Please update this in your .env file.');
