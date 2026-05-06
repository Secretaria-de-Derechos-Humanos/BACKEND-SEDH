import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { AuditLog } from './entities/audit-log.entity';
import { Employee } from '../users/entities/employee.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    const employee = await this.usersService.findByEmail(dto.email);

    if (!employee || !employee.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, employee.password);
    if (!passwordValid) {
      await this.audit('LOGIN', employee, ipAddress, userAgent, { success: false });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (employee.twoFactorEnabled) {
      return { requires2FA: true, email: employee.email };
    }

    return this.issueTokens(employee, ipAddress, userAgent);
  }

  async verify2fa(dto: Verify2faDto, ipAddress: string, userAgent: string) {
    const employee = await this.usersService.findByEmail(dto.email);

    if (!employee || !employee.isActive || !employee.twoFactorEnabled) {
      throw new UnauthorizedException('Verificación 2FA inválida');
    }

    const secret = this.decrypt2faSecret(employee.twoFactorSecret!);
    const isValid = authenticator.verify({ token: dto.token, secret });

    if (!isValid) {
      await this.audit('LOGIN', employee, ipAddress, userAgent, { success: false, reason: '2FA_FAILED' });
      throw new UnauthorizedException('Código 2FA inválido');
    }

    return this.issueTokens(employee, ipAddress, userAgent);
  }

  async generate2faSecret(employeeId: string) {
    const employee = await this.usersService.findOneById(employeeId);
    if (!employee) throw new BadRequestException('Empleado no encontrado');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(employee.email, 'SEDH', secret);
    const encryptedSecret = this.encrypt2faSecret(secret);

    await this.usersService.setTwoFactorSecret(employeeId, encryptedSecret);

    return { otpAuthUrl };
  }

  async enableTwoFactor(employeeId: string, token: string) {
    const employee = await this.usersService.findOneById(employeeId);
    if (!employee?.twoFactorSecret) throw new BadRequestException('Primero genera el secreto 2FA');

    const secret = this.decrypt2faSecret(employee.twoFactorSecret);
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) throw new UnauthorizedException('Código 2FA inválido');

    await this.usersService.enableTwoFactor(employeeId);
    return { message: '2FA habilitado correctamente' };
  }

  private async issueTokens(employee: Employee, ipAddress: string, userAgent: string) {
    const sessionId = crypto.randomUUID();

    const payload = { sub: employee.id, email: employee.email, sessionId };

    const accessToken = this.jwtService.sign(payload, {
      algorithm: 'RS256',
      expiresIn: this.config.get<string>('jwt.accessExpiration', '15m'),
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await this.usersService.setRefreshToken(employee.id, refreshTokenHash);
    await this.usersService.updateLastLogin(employee.id);
    await this.audit('LOGIN', employee, ipAddress, userAgent, { success: true, sessionId });

    return { accessToken, refreshToken };
  }

  private encrypt2faSecret(secret: string): string {
    const key = Buffer.from(this.config.get<string>('app.encryptionKey')!, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt2faSecret(encrypted: string): string {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
    const key = Buffer.from(this.config.get<string>('app.encryptionKey')!, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(Buffer.from(encryptedHex, 'hex')) + decipher.final('utf-8');
  }

  private async audit(
    action: AuditLog['action'],
    employee: Employee,
    ipAddress: string,
    userAgent: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        employeeId: employee.id,
        employeeEmail: employee.email,
        action,
        resource: 'auth',
        ipAddress,
        userAgent,
        metadata,
      }),
    );
  }
}
