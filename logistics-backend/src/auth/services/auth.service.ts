import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Role } from '../../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/services/users.service';
import logger from '../../common/services/logger.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    try {
      logger.info(`Login attempt for username: ${username}`);

      // 使用UsersService获取完整用户信息（包括密码）用于认证
      const user =
        await this.usersService.getUserByUsernameWithPassword(username);

      if (!user) {
        logger.warn(`User not found: ${username}`);
        return null;
      }

      if (await bcrypt.compare(pass, user.password)) {
        const { password, ...result } = user;
        logger.info(`Login successful for user: ${username}`);
        return result;
      } else {
        logger.warn(`Incorrect password for user: ${username}`);
        return null;
      }
    } catch (error) {
      // 记录错误日志
      logger.error(
        `Error during login validation for ${username}: ${error.message}`,
        error.stack,
      );
      // 用户不存在时，getUserByUsernameWithPassword会抛出NotFoundException
      // 我们将其转换为null返回，保持原有API行为
      return null;
    }
  }

  async login(user: any) {
    const payload = {
      username: user.username,
      role: user.role,
      sub: user.id,
    };

    const access_token = this.jwtService.sign(payload);

    logger.info(
      `JWT token issued for user: ${user.username}, role: ${user.role}`,
    );

    // 返回完整的用户信息，不只是部分字段
    const { password, ...completeUserInfo } = user;

    return {
      access_token,
      user: completeUserInfo,
    };
  }

  async register(
    username: string,
    password: string,
    email?: string,
    role: Role = Role.USER,
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = this.usersRepository.create({
      username,
      password: hashedPassword,
      email,
      role,
    });
    await this.usersRepository.save(newUser);
    const { password: _, ...result } = newUser;
    return result;
  }

  async findUserById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }
}
