import { useParams } from 'react-router-dom';
import ParentTournamentView from '@/components/quicktable/ParentTournamentView';

const ParentTournamentPage = () => {
  const { shareId } = useParams<{ shareId: string }>();

  if (!shareId) return null;

  return <ParentTournamentView shareId={shareId} />;
};

export default ParentTournamentPage;
