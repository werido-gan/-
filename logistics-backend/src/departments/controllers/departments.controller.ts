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
import { DepartmentsService } from '../services/departments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Department } from '../entities/department.entity';

@Controller('departments')
@UseGuards(JwtAuthGuard)
// 所有部门接口都需要JWT认证
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // 获取所有部门
  @Get()
  async findAll() {
    const departments = await this.departmentsService.getAllDepartments();
    return { success: true, data: { departments } };
  }

  // 根据ID获取部门
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const department = await this.departmentsService.getDepartmentById(
      Number(id),
    );
    return { success: true, data: { department } };
  }

  // 根据key获取部门
  @Get('key/:key')
  async findByKey(@Param('key') key: string) {
    const department = await this.departmentsService.getDepartmentByKey(key);
    return { success: true, data: { department } };
  }

  // 创建部门
  @Post()
  async create(@Body() departmentData: Partial<Department>) {
    const department =
      await this.departmentsService.createDepartment(departmentData);
    return { success: true, data: { department } };
  }

  // 更新部门
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() departmentData: Partial<Department>,
  ) {
    const department = await this.departmentsService.updateDepartment(
      Number(id),
      departmentData,
    );
    return { success: true, data: { department } };
  }

  // 删除部门
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.departmentsService.deleteDepartment(Number(id));
    return { success: true, data: result };
  }
}
