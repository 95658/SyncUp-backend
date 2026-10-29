import { IsNotEmpty, IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Dipdux' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Sara Hassan' })
  @IsString()
  @IsNotEmpty()
  adminName: string;

  @ApiProperty({ example: 'sara@dipdux.com' })
  @IsEmail()
  adminEmail: string;

  @ApiPropertyOptional({ example: 'PRO' })
  @IsString()
  @IsOptional()
  plan?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  sendInvitation?: boolean;
}
