import { DokumenHukum } from '@/components/dokumen-hukum';
import { PRIVASI } from '@/constants/hukum';

export default function LayarPrivasi() {
  return <DokumenHukum bagian={PRIVASI} />;
}
