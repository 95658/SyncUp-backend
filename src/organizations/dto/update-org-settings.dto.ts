import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrgSettingsDto {
  @ApiPropertyOptional({ example: 'NASA Jet Propulsion Lab' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'nasa-jpl' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Space Exploration & Aerospace Tech' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://nasa.gov' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Software Engineering' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({ example: '11-50' })
  @IsString()
  @IsOptional()
  companySize?: string;

  @ApiPropertyOptional({ example: '2_WEEKS' })
  @IsString()
  @IsOptional()
  defaultSprintDuration?: string;

  @ApiPropertyOptional({ example: 'FIBONACCI' })
  @IsString()
  @IsOptional()
  estimationScale?: string;

  @ApiPropertyOptional({ example: '@nasa.gov' })
  @IsString()
  @IsOptional()
  allowedDomains?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  enforce2FA?: boolean;

  @ApiPropertyOptional({ example: 'ADMINS_ONLY' })
  @IsString()
  @IsOptional()
  invitePolicy?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  qaEnforce?: boolean;
}
