import { PrismaClient, OrgMemberRole, TaskStatus, TaskPriority, ChannelType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SyncUp database...');

  const defaultPassword = await bcrypt.hash('SyncUp#Ahmed2026!Secured', 10);

  // 1. Platform Owner (Ahmed Abdelfatah)
  const ahmed = await prisma.user.upsert({
    where: { email: 'aabdelfatah732@gmail.com' },
    update: {},
    create: {
      email: 'aabdelfatah732@gmail.com',
      fullName: 'Ahmed Abdelfatah',
      passwordHash: defaultPassword,
      isPlatformOwner: true,
      jobTitle: 'Founder & Platform Owner',
      status: 'ACTIVE',
    },
  });

  // 2. Client Organization (Dipdux)
  const dipdux = await prisma.organization.upsert({
    where: { slug: 'dipdux' },
    update: {},
    create: {
      name: 'Dipdux',
      slug: 'dipdux',
      description: 'Software development & product innovation lab',
      status: 'ACTIVE',
    },
  });

  // 3. Organization Members
  // Owner (Ahmed)
  const ahmedMember = await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: ahmed.id, organizationId: dipdux.id } },
    update: {},
    create: {
      userId: ahmed.id,
      organizationId: dipdux.id,
      role: OrgMemberRole.OWNER,
      status: 'ACTIVE',
    },
  });

  // Admin (Sara Hassan)
  const sara = await prisma.user.upsert({
    where: { email: 'sara@dipdux.com' },
    update: {},
    create: {
      email: 'sara@dipdux.com',
      fullName: 'Sara Hassan',
      passwordHash: defaultPassword,
      jobTitle: 'Organization Admin',
      status: 'ACTIVE',
    },
  });

  const saraMember = await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: sara.id, organizationId: dipdux.id } },
    update: {},
    create: {
      userId: sara.id,
      organizationId: dipdux.id,
      role: OrgMemberRole.ADMIN,
      status: 'ACTIVE',
    },
  });

  // Member (Omar Khaled)
  const omar = await prisma.user.upsert({
    where: { email: 'omar@dipdux.com' },
    update: {},
    create: {
      email: 'omar@dipdux.com',
      fullName: 'Omar Khaled',
      passwordHash: defaultPassword,
      jobTitle: 'Backend Tech Lead',
      status: 'ACTIVE',
    },
  });

  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: omar.id, organizationId: dipdux.id } },
    update: {},
    create: {
      userId: omar.id,
      organizationId: dipdux.id,
      role: OrgMemberRole.MEMBER,
      status: 'ACTIVE',
    },
  });

  // 4. Default Channels
  const generalChannel = await prisma.channel.create({
    data: {
      organizationId: dipdux.id,
      name: 'general',
      description: 'General discussion for all Dipdux members',
      type: ChannelType.PUBLIC,
      members: {
        create: [
          { orgMemberId: ahmedMember.id },
          { orgMemberId: saraMember.id },
        ],
      },
    },
  });

  const mobileChannel = await prisma.channel.create({
    data: {
      organizationId: dipdux.id,
      name: 'mobile-team',
      description: 'Mobile team sprint planning & daily updates',
      type: ChannelType.PUBLIC,
      members: {
        create: [
          { orgMemberId: ahmedMember.id },
          { orgMemberId: saraMember.id },
        ],
      },
    },
  });

  // 5. Default Project (SyncUp)
  const project = await prisma.project.create({
    data: {
      organizationId: dipdux.id,
      name: 'SyncUp',
      description: 'Private B2B SaaS Collaboration & Project Platform',
      status: 'ACTIVE',
      progress: 68,
      members: {
        create: [
          { memberId: ahmedMember.id },
          { memberId: saraMember.id },
        ],
      },
    },
  });

  // 6. Default Tasks
  const task1 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Implement authentication flow',
      description: 'Complete authentication flow including login, logout, token refresh, and secure storage.',
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      assignees: {
        create: [{ userId: ahmed.id }, { userId: omar.id }],
      },
    },
  });

  // Subtasks
  await prisma.task.createMany({
    data: [
      { projectId: project.id, parentId: task1.id, title: 'Design API endpoints', status: TaskStatus.DONE },
      { projectId: project.id, parentId: task1.id, title: 'Implement login UI', status: TaskStatus.DONE },
      { projectId: project.id, parentId: task1.id, title: 'Handle token refresh', status: TaskStatus.TODO },
      { projectId: project.id, parentId: task1.id, title: 'Add biometric authentication', status: TaskStatus.TODO },
      { projectId: project.id, parentId: task1.id, title: 'Write unit tests', status: TaskStatus.TODO },
    ],
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
