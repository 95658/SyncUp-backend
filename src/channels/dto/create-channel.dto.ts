import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @ApiProperty({ example: 'mobile-team' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Mobile app development discussion' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ChannelType, default: ChannelType.PUBLIC })
  @IsEnum(ChannelType)
  @IsOptional()
  type?: ChannelType;

  @ApiPropertyOptional({ example: 'proj_123...' })
  @IsString()
  @IsOptional()
  projectId?: string;
}
