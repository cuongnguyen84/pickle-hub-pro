import { useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import ParentTournamentView from '@/components/quicktable/ParentTournamentView';

const ParentTournamentPage = () => {
  const { shareId } = useParams<{ shareId: string }>();

  if (!shareId) return null;

  return (
    <MainLayout>
      <ParentTournamentView shareId={shareId} />
    </MainLayout>
  );
};

export default ParentTournamentPage;
