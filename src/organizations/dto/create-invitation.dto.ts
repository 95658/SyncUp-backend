import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgMemberRole } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({ example: 'ahmed@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: OrgMemberRole, default: OrgMemberRole.MEMBER })
  @IsEnum(OrgMemberRole)
  role: OrgMemberRole = OrgMemberRole.MEMBER;

  @ApiPropertyOptional({ description: 'Pre-assign to a team ID' })
  @IsOptional()
  @IsString()
  teamId?: string;
}
