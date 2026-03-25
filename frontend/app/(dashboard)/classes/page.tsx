import Link from 'next/link';
import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';
import ClassList from './ClassList';

export const metadata = { title: 'Classes — EduTrack SMS' };

export default function ClassesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Classes</h2>
        <Link href="/classes/new">
          <Button size="md" variant="primary">
            <Plus className="w-4 h-4" />
            New Class
          </Button>
        </Link>
      </div>
      <ClassList />
    </div>
  );
}
