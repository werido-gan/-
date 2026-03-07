import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
// 所有用户接口都需要JWT认证
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 获取所有用户
  @Get()
  async findAll() {
    const users = await this.usersService.getAllUsers();
    return { success: true, data: { users } };
  }

  // 根据ID获取用户
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.getUserById(Number(id));
    return { success: true, data: { user } };
  }

  // 创建用户
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    return { success: true, data: { user } };
  }

  // 更新用户
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.updateUser(Number(id), updateUserDto);
    return { success: true, data: { user } };
  }

  // 修改密码
  @Put(':id/password')
  async changePassword(
    @Param('id') id: string,
    @Body() body: { oldPassword: string; password: string },
  ) {
    const user = await this.usersService.changeUserPassword(
      Number(id),
      body.oldPassword,
      body.password,
    );
    return { success: true, message: '密码修改成功' };
  }

  // 删除用户
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.usersService.deleteUser(Number(id));
    return { success: true, data: result };
  }
}
