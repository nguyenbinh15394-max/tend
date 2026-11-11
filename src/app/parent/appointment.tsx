import { ParentStub } from '@/components/parent-stub';
import { parentStrings } from '@/lib/parent-strings';

export default function NextAppointment() {
  return <ParentStub title={parentStrings('vi').appointment} />;
}
