import { DokumenHukum } from '@/components/dokumen-hukum';
import { KETENTUAN } from '@/constants/hukum';

export default function LayarKetentuan() {
  return <DokumenHukum bagian={KETENTUAN} />;
}
