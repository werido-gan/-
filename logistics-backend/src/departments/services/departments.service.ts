import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  // 获取所有部门
  async getAllDepartments() {
    return await this.departmentRepository.find();
  }

  // 根据ID获取部门
  async getDepartmentById(id: number) {
    const department = await this.departmentRepository.findOneBy({ id });
    if (!department) {
      throw new NotFoundException(`ID为${id}的部门不存在`);
    }
    return department;
  }

  // 根据key获取部门
  async getDepartmentByKey(key: string) {
    const department = await this.departmentRepository.findOneBy({ key });
    if (!department) {
      throw new NotFoundException(`部门键${key}不存在`);
    }
    return department;
  }

  // 创建部门
  async createDepartment(departmentData: Partial<Department>) {
    const department = this.departmentRepository.create(departmentData);
    return await this.departmentRepository.save(department);
  }

  // 更新部门
  async updateDepartment(id: number, departmentData: Partial<Department>) {
    const department = await this.getDepartmentById(id);
    Object.assign(department, departmentData);
    return await this.departmentRepository.save(department);
  }

  // 删除部门
  async deleteDepartment(id: number) {
    const department = await this.getDepartmentById(id);
    await this.departmentRepository.remove(department);
    return { message: '部门删除成功' };
  }
}
