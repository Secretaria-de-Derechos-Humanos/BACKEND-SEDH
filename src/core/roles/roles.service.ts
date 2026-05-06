import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ relations: ['permissions'] });
  }

  async findOneById(id: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const exists = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Ya existe un rol con ese nombre');

    const role = this.roleRepo.create({
      name: dto.name,
      description: dto.description,
      permissions: dto.permissionIds?.map((id) => ({ id })) as any,
    });
    return this.roleRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOneById(id);
    if (!role) throw new NotFoundException('Rol no encontrado');

    if (dto.permissionIds) {
      role.permissions = dto.permissionIds.map((pid) => ({ id: pid })) as any;
    }

    Object.assign(role, { name: dto.name, description: dto.description });
    return this.roleRepo.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOneById(id);
    if (!role) throw new NotFoundException('Rol no encontrado');
    await this.roleRepo.softRemove(role);
  }
}
