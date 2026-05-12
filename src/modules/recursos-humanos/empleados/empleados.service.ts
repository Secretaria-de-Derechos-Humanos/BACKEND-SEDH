import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { HistorialCargo } from './entities/historial-cargo.entity';
import { HorasDisponible } from './entities/horas-disponible.entity';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    @InjectRepository(Empleado) private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(HistorialCargo) private readonly historialRepo: Repository<HistorialCargo>,
    @InjectRepository(HorasDisponible) private readonly horasRepo: Repository<HorasDisponible>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.empleadoRepo.find({ relations: ['cargo', 'tipoContratacion', 'sexo', 'estadoCivil'] });
  }

  async findOne(email: string) {
    const empleado = await this.empleadoRepo.findOne({
      where: { emailInstitucional: email },
      relations: ['cargo', 'tipoContratacion', 'sexo', 'estadoCivil', 'municipio'],
    });
    if (!empleado) throw new NotFoundException(`Empleado ${email} no encontrado`);
    return empleado;
  }

  crear(dto: CrearEmpleadoDto) {
    const empleado = this.empleadoRepo.create(dto);
    return this.empleadoRepo.save(empleado);
  }

  async actualizar(email: string, dto: ActualizarEmpleadoDto) {
    await this.findOne(email);
    await this.empleadoRepo.update({ emailInstitucional: email }, dto as Partial<Empleado>);
    return this.findOne(email);
  }

  findHistorial(email: string) {
    return this.historialRepo.find({ where: { emailInstitucional: email } });
  }

  findHorasDisponibles(email: string) {
    return this.horasRepo.find({ where: { emailInstitucional: email } });
  }

  async buscarEmpleadoAdmin(emailEmpleado: string, emailAdmin: string, rol: number, idmodulo: number) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.buscar_empleado($1, $2, $3, $4)',
        [emailEmpleado, emailAdmin, String(rol), String(idmodulo)],
      );
      return rows[0]?.buscar_empleado ?? null;
    } catch (error) {
      this.logger.error(`Error en buscarEmpleadoAdmin: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
}
