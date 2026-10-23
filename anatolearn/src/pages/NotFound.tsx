import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState icon={<Compass className="h-10 w-10" />} title="Page not found"
        action={<Link to="/dashboard" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Back to dashboard</Link>}>
        The page you are looking for does not exist or has moved.
      </EmptyState>
    </main>
  );
}
