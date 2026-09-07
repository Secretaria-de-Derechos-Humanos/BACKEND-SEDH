import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  NotFoundException,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Request, Response } from 'express';
import { extname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { ConstanciasService } from './constancias.service';
import { CrearConstanciaDto } from './dto/crear-constancia.dto';
import { RechazarConstanciaDto } from './dto/rechazar-constancia.dto';

@ApiTags('Constancias')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/constancias')
export class ConstanciasController {
  constructor(private readonly constanciasService: ConstanciasService) {}

  // ============================================================
  // USUARIO AUTENTICADO
  // ============================================================

  private obtenerUsuario(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const user = request.user as {
      sub?: string;
      idUsuario?: string;
      email?: string;
      roles?: {
        r: number;
        m: number[];
      }[];
    };

    const idUsuario = user.idUsuario ?? user.sub;

    if (!idUsuario || !user.email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return {
      idUsuario,
      email: user.email,
      roles: (user.roles ?? []).map((rol) => Number(rol.r)),
    };
  }

  // ============================================================
  // AUTORIZACIÓN EMPLEADO
  // ============================================================

  private validarEmpleado(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const usuario = this.obtenerUsuario(request);

    // 1 = Empleado
    // 5 = Administrador
    const autorizado = usuario.roles.includes(1) || usuario.roles.includes(5);

    if (!autorizado) {
      throw new UnauthorizedException('No tiene permisos para realizar solicitudes de constancias');
    }

    return usuario;
  }

  // ============================================================
  // AUTORIZACIÓN RRHH
  // ============================================================

  private validarGestionConstancias(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const usuario = this.obtenerUsuario(request);

    // 3 = Subgerencia RRHH
    // 5 = Administrador
    const autorizado = usuario.roles.includes(3) || usuario.roles.includes(5);

    if (!autorizado) {
      throw new UnauthorizedException(
        'No tiene permisos para gestionar solicitudes de constancias',
      );
    }

    return usuario;
  }

  // ============================================================
  // EMPLEADO - CREAR SOLICITUD
  // ============================================================

  @Post()
  @ApiOperation({
    summary: 'Crear una solicitud de constancia de trabajo',
  })
  crearConstancia(@Req() request: Request, @Body() body: CrearConstanciaDto) {
    const usuario = this.validarEmpleado(request);

    return this.constanciasService.crearConstancia(usuario.idUsuario, usuario.email, body);
  }

  // ============================================================
  // EMPLEADO - MIS SOLICITUDES
  // ============================================================

  @Get('mis-solicitudes')
  @ApiOperation({
    summary: 'Consultar mis solicitudes de constancias',
  })
  obtenerMisConstancias(@Req() request: Request) {
    const usuario = this.validarEmpleado(request);

    return this.constanciasService.obtenerMisConstancias(usuario.idUsuario);
  }

  // ============================================================
  // EMPLEADO - CONSULTAR UNA SOLICITUD PROPIA
  // ============================================================

  @Get('mis-solicitudes/:id')
  @ApiOperation({
    summary: 'Consultar una solicitud propia de constancia',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de constancia',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  obtenerMiConstancia(@Param('id') idConstancia: string, @Req() request: Request) {
    const usuario = this.validarEmpleado(request);

    return this.constanciasService.obtenerMiConstancia(idConstancia, usuario.idUsuario);
  }

  // ============================================================
  // RRHH - TODAS LAS SOLICITUDES
  // ============================================================

  @Get()
  @ApiOperation({
    summary: 'Consultar todas las solicitudes de constancias',
  })
  obtenerTodas(@Req() request: Request) {
    this.validarGestionConstancias(request);

    return this.constanciasService.obtenerTodas();
  }

  // ============================================================
  // RRHH - SOLICITUDES PENDIENTES
  // ============================================================

  @Get('pendientes')
  @ApiOperation({
    summary: 'Consultar solicitudes de constancias pendientes',
  })
  obtenerPendientes(@Req() request: Request) {
    this.validarGestionConstancias(request);

    return this.constanciasService.obtenerPendientes();
  }

  // ============================================================
  // RRHH - RECHAZAR SOLICITUD
  // ============================================================

  @Post(':id/rechazar')
  @ApiOperation({
    summary: 'Rechazar una solicitud de constancia',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de constancia',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  rechazarConstancia(
    @Param('id') idConstancia: string,
    @Req() request: Request,
    @Body() body: RechazarConstanciaDto,
  ) {
    const usuario = this.validarGestionConstancias(request);

    return this.constanciasService.rechazarConstancia(
      idConstancia,
      usuario.idUsuario,
      body.motivoRechazo,
    );
  }

  // ============================================================
  // RRHH - CARGAR CONSTANCIA
  // ============================================================

  @Post(':id/generar')
  @ApiOperation({
    summary: 'Cargar la constancia de trabajo generada',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de constancia',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF o Word (.docx) de la constancia',
        },
      },
      required: ['archivo'],
    },
  })
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const ruta = 'uploads/constancias';

          if (!existsSync(ruta)) {
            mkdirSync(ruta, {
              recursive: true,
            });
          }

          callback(null, ruta);
        },

        filename: (_request, file, callback) => {
          const extension = extname(file.originalname);

          const nombreOriginal = file.originalname
            .replace(extension, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');

          const nombreArchivo = `${Date.now()}-${nombreOriginal}${extension}`;

          callback(null, nombreArchivo);
        },
      }),

      fileFilter: (_request, file, callback) => {
        const extensionesPermitidas = ['.pdf', '.docx'];

        const tiposPermitidos = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        const extension = extname(file.originalname).toLowerCase();

        const extensionValida = extensionesPermitidas.includes(extension);

        const tipoValido = tiposPermitidos.includes(file.mimetype);

        if (!extensionValida || !tipoValido) {
          return callback(
            new UnauthorizedException('Solo se permiten archivos PDF o Word (.docx).'),
            false,
          );
        }

        callback(null, true);
      },

      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async generarConstancia(
    @Param('id') idConstancia: string,
    @Req() request: Request,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 10 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType:
              /^application\/(pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    archivo: Express.Multer.File,
  ) {
    const usuario = this.validarGestionConstancias(request);

    return this.constanciasService.generarConstancia(idConstancia, usuario.idUsuario, archivo);
  }

  // ============================================================
  // EMPLEADO - DESCARGAR CONSTANCIA
  // ============================================================

  @Get(':id/descargar')
  @ApiOperation({
    summary: 'Descargar una constancia propia',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la constancia',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  async descargarConstancia(
    @Param('id') idConstancia: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const usuario = this.validarEmpleado(request);

    const archivo = await this.constanciasService.obtenerArchivoConstancia(
      idConstancia,
      usuario.idUsuario,
    );

    const rutaAbsoluta = resolve(process.cwd(), archivo.rutaArchivo);

    if (!existsSync(rutaAbsoluta)) {
      throw new NotFoundException('El archivo de la constancia no se encuentra en el servidor.');
    }

    response.setHeader('Content-Type', archivo.tipoArchivo);

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(archivo.nombreArchivo)}"`,
    );

    response.sendFile(rutaAbsoluta);
  }
}
