import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgMemberRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: OrgMemberRole })
  @IsEnum(OrgMemberRole)
  role: OrgMemberRole;
}
