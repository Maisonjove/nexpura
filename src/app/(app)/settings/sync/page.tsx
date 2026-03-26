import { Metadata } from 'next';
import SyncQueuePage from './SyncQueuePage';

export const metadata: Metadata = {
  title: 'Sync Queue | Settings',
  description: 'View and manage offline transactions pending sync',
};

export default function Page() {
  return <SyncQueuePage />;
}
