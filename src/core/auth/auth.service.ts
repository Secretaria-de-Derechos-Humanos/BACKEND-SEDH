import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const result = await this.dataSource.query(
      `SELECT core.login($1, $2) AS resultado`,
      [dto.email, dto.contrasena],
    );

    const payload = result[0]?.resultado;

    if (!payload || payload.error) {
      throw new UnauthorizedException(
        payload?.error ?? 'Credenciales inválidas',
      );
    }

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
