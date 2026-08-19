#!/usr/bin/env tsx
import { prisma } from '@talentos/db';

(async function(){
  const m = await prisma.mission.findFirst();
  console.log('mission exists?', !!m);
  if (m) console.log('id', m.id, 'published', m.published);
  await prisma.$disconnect();
})();
