import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // 获取所有用户
  async getAllUsers() {
    const users = await this.userRepository.find();
    // 剔除password字段
    return users.map(({ password, ...user }) => user);
  }

  // 根据ID获取用户
  async getUserById(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }
    // 剔除password字段
    const { password, ...result } = user;
    return result;
  }

  // 根据用户名获取用户
  async getUserByUsername(username: string) {
    const user = await this.userRepository.findOneBy({ username });
    if (!user) {
      throw new NotFoundException(`用户名${username}不存在`);
    }
    // 剔除password字段
    const { password, ...result } = user;
    return result;
  }

  // 根据用户名获取完整用户（包括密码，仅用于认证）
  async getUserByUsernameWithPassword(username: string) {
    const user = await this.userRepository.findOneBy({ username });
    if (!user) {
      throw new NotFoundException(`用户名${username}不存在`);
    }
    // 返回完整用户对象，包括密码
    return user;
  }

  // 创建用户
  async createUser(userData: Partial<User>) {
    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findOneBy({
      username: userData.username,
    });
    if (existingUser) {
      throw new ConflictException(`用户名${userData.username}已存在`);
    }

    // 密码加密
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const user = this.userRepository.create(userData);
    const createdUser = await this.userRepository.save(user);
    // 剔除password字段后返回
    const { password, ...result } = createdUser;
    return result;
  }

  // 更新用户
  async updateUser(id: number, userData: Partial<User>) {
    // 直接查询完整用户对象用于更新操作
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }

    // 如果更新用户名，检查新用户名是否已存在
    if (userData.username && userData.username !== user.username) {
      const existingUser = await this.userRepository.findOneBy({
        username: userData.username,
      });
      if (existingUser) {
        throw new ConflictException(`用户名${userData.username}已存在`);
      }
    }

    // 如果更新密码，进行加密
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    Object.assign(user, userData);
    const updatedUser = await this.userRepository.save(user);
    // 剔除password字段后返回
    const { password, ...result } = updatedUser;
    return result;
  }

  // 删除用户
  async deleteUser(id: number) {
    // 直接查询完整用户对象用于删除操作
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }
    await this.userRepository.remove(user);
    return { message: '用户删除成功' };
  }

  // 修改密码
  async changeUserPassword(
    id: number,
    oldPassword: string,
    newPassword: string,
  ) {
    // 获取完整用户对象（包括密码）
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    user.password = hashedNewPassword;
    user.updated_at = new Date();
    await this.userRepository.save(user);

    // 剔除密码字段后返回
    const { password, ...result } = user;
    return result;
  }
}
