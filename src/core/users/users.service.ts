import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async findByEmail(email: string): Promise<Employee | null> {
    return this.employeeRepo.findOne({
      where: { email },
      relations: ['role', 'role.permissions'],
    });
  }

  async findOneById(id: string): Promise<Employee | null> {
    return this.employeeRepo.findOne({
      where: { id },
      relations: ['role', 'role.permissions'],
    });
  }

  async findAll(): Promise<Employee[]> {
    return this.employeeRepo.find({ relations: ['role'] });
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const exists = await this.employeeRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El correo electrónico ya está registrado');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const employee = this.employeeRepo.create({
      ...dto,
      password: hashedPassword,
      role: { id: dto.roleId } as any,
    });

    return this.employeeRepo.save(employee);
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOneById(id);
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }

    Object.assign(employee, dto);
    return this.employeeRepo.save(employee);
  }

  async setTwoFactorSecret(id: string, secret: string): Promise<void> {
    await this.employeeRepo.update(id, { twoFactorSecret: secret });
  }

  async enableTwoFactor(id: string): Promise<void> {
    await this.employeeRepo.update(id, { twoFactorEnabled: true });
  }

  async setRefreshToken(id: string, hash: string): Promise<void> {
    await this.employeeRepo.update(id, { refreshTokenHash: hash });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.employeeRepo.update(id, { lastLoginAt: new Date() });
  }

  async remove(id: string): Promise<void> {
    const employee = await this.findOneById(id);
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    await this.employeeRepo.softRemove(employee);
  }
}
